#!/usr/bin/env python3
"""Smoke-test Desktop's Docker image or a native p2pd on an empty, disposable Mutinynet wallet."""
import argparse
from contextlib import ExitStack
import hashlib
import json
import os
import platform
import secrets
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
runtime = parser.add_mutually_exclusive_group(required=True)
runtime.add_argument('--image', help='Locally available p2pd Docker image')
runtime.add_argument('--binary', type=Path, help='Native p2pd executable')
parser.add_argument('--report', type=Path, required=True)
args = parser.parse_args()
name = 'kaleido-p2pd-beta-' + secrets.token_hex(6)
volume = name + '-data'
env = dict(os.environ, P2PD_API_TOKEN=secrets.token_hex(32), P2PD_PASSPHRASE=secrets.token_hex(32))
with socket.socket() as probe:
    probe.bind(('127.0.0.1', 0))
    port = probe.getsockname()[1]
report = {'host_os': platform.system(), 'network': 'signetcustom', 'checks': {}}
PROXY = 'https://proxy-v1.kaleidoswap.com/json-rpc'
TRANSPORT = 'rpcs://proxy-v1.kaleidoswap.com/json-rpc'
# Published Mutinynet faucet contract and the RGB BFA schema used by the browser extension.
USDT_ID = 'rgb:2FB8lVZA-dnFf4ci-wdU9xin-Rjm72L1-LSOyAq3-KAICMoI'
BFA_SCHEMA = '3I0xZVEQnQxYVk7vDnh5uNtQyUfsmThw6dX9n_Gvb5o'

def docker(*parts, check=True, timeout=180, process_env=env):
    result = subprocess.run(['docker', *parts], capture_output=True, text=True,
                            env=process_env, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError('Docker operation failed: ' + parts[0] + ': ' + result.stderr[-1600:])
    return result

def request(endpoint, authenticated=True, headers=None, *, body=None):
    h = {'Authorization': 'Bearer ' + env['P2PD_API_TOKEN']} if authenticated else {}
    h.update(headers or {})
    if body is not None:
        h['Content-Type'] = 'application/json'
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(f'http://127.0.0.1:{port}/api/{endpoint}', headers=h, data=data)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, None

def ready(is_running):
    deadline = time.monotonic() + 150
    while time.monotonic() < deadline:
        try:
            code, info = request('info')
            if code == 200:
                assert info['network'] == 'signetcustom'
                return info
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            pass
        if not is_running():
            raise RuntimeError('Test daemon stopped before API readiness')
        time.sleep(2)
    raise TimeoutError('Signet daemon did not become ready within 150 seconds')

common = ['--name', name, '--port', str(port),
          '--network', 'signetcustom', '--indexer', 'https://esplora.signet.kaleidoswap.com',
          '--proxy', PROXY, '--relay', 'wss://relay.kaleidoswap.com',
          '--fee-address', 'tb1qksue05dv7z57mezp3j74cr64lrah57vufhjktw', '--fee-bps', '100',
          '--min-fee-sat', '1000', '--keystore', 'encrypted', '--no-rgbmap']
mount = ['-v', volume + ':/data', '-e', 'P2PD_API_TOKEN', '-e', 'P2PD_PASSPHRASE']


def check_invoices():
    checks = report['checks']

    def required(endpoint, body):
        code, result = request(endpoint, body=body)
        if code != 200:
            raise RuntimeError(f'{endpoint} returned HTTP {code}')
        return result

    code, balance = request('balance')
    assert code == 200 and balance['assets'] == [], 'expected an empty asset wallet'
    assert all(balance[key] == 0 for key in ('btc_spendable_sat', 'btc_settled_sat', 'btc_pending_sat')), 'expected zero BTC'
    checks['signet_sync_unfunded_wallet'] = True
    started = int(time.time())
    issued = required('rgb/invoice', {'witness': True, 'amount': 0, 'duration_secs': 600})
    decoded = required('rgb/decode', {'invoice': issued['invoice']})
    assert decoded['network'] == 'SignetCustom' and decoded['recipient_type'] == 'Witness', 'wrong witness network or type'
    assert decoded['recipient_id'] == issued['recipient_id'], 'decoded payee changed'
    assert decoded['asset_id'] is None and decoded['asset_schema'] is None, 'open invoice bound an asset'
    assert decoded['assignment'] == {'type': 'Any'}, 'open invoice bound an assignment'
    assert decoded['expiration_timestamp'] == issued['expiration_timestamp'], 'decoded expiry changed'
    # The Linux container may be a few seconds away from the host clock.
    assert started + 590 <= decoded['expiration_timestamp'] <= int(time.time()) + 610, 'wrong invoice lifetime'
    assert decoded['transport_endpoints'] == issued['transport_endpoints'] == [TRANSPORT], 'wrong transport'
    checks['open_witness_invoice_round_trip'] = True

    # Decode an externally composed BFA request to the disposable recipient. The invoice
    # describes a single base unit; display precision belongs to the asset's metadata.
    terms = f"{USDT_ID}/{BFA_SCHEMA}/ae/{issued['recipient_id']}"
    fixed = required('rgb/decode', {'invoice': terms})
    assert fixed['asset_id'] == USDT_ID and fixed['asset_schema'] == 'Bfa', 'wrong contract or schema'
    assert fixed['assignment'] == {'type': 'Fungible', 'value': 1}, 'BFA invoice lost its fixed amount'
    assert fixed['network'] == 'SignetCustom' and fixed['recipient_type'] == 'Witness', 'wrong BFA network or type'
    assert fixed['recipient_id'] == issued['recipient_id'], 'decoded BFA payee changed'
    if fixed.get('precision') is not None:
        assert fixed['precision'] == 6, 'wrong display precision for Mutinynet faucet USDT'
    report['invoice_display_precision'] = fixed.get('precision')
    checks['mutinynet_bfa_invoice_in_base_units'] = True

    code, _ = request('rgb/decode', body={'invoice': terms.replace('/ae/', '/!!!/')})
    assert code == 400, f'invalid invoice amount returned HTTP {code}'
    code, _ = request('rgb/invoice', body={'witness': True, 'amount': -1})
    assert code == 422, f'negative receive amount returned HTTP {code}'
    checks['invalid_invoice_terms_rejected'] = True

def check_native():
    report['binary'] = args.binary.name
    digest = hashlib.sha256()
    with args.binary.open('rb') as binary:
        for block in iter(lambda: binary.read(1024 * 1024), b''):
            digest.update(block)
    report['binary_sha256'] = digest.hexdigest()
    with tempfile.TemporaryDirectory(prefix='desktop-p2pd-invoice-') as directory:
        command = [str(args.binary.resolve()), *common, '--bind', '127.0.0.1',
                   '--data-dir', str(Path(directory) / 'wallet')]
        with (Path(directory) / 'smoke.log').open('wb') as log:
            process = subprocess.Popen(command, env=env, stdout=log, stderr=log)
            try:
                ready(lambda: process.poll() is None)
                check_invoices()
            finally:
                process.terminate()
                try:
                    process.wait(timeout=20)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()

def check_docker(cleanup):
    report['image'] = args.image
    docker_args = [*common, '--bind', '0.0.0.0', '--data-dir', '/data']

    def running():
        return docker('inspect', '--format', '{{.State.Running}}', name).stdout.strip() == 'true'

    image = json.loads(docker('image', 'inspect', args.image).stdout)[0]
    assert image['Os'] == 'linux'
    assert image['Config']['User'] not in ('', 'root', '0')
    report.update(image_id=image['Id'], architecture=image['Architecture'], container_os=image['Os'])
    docker('volume', 'create', volume)
    cleanup.callback(docker, 'volume', 'rm', volume, check=False)
    cleanup.callback(docker, 'rm', '-f', name, name + '-duplicate', name + '-wrong-passphrase', check=False)
    docker('run', '--pull=never', '-d', '--name', name, '-p', f'127.0.0.1:{port}:{port}',
           *mount, args.image, *docker_args)
    first = ready(running)
    bindings = json.loads(docker('inspect', name).stdout)[0]['NetworkSettings']['Ports'][f'{port}/tcp']
    assert all(binding['HostIp'] == '127.0.0.1' for binding in bindings)
    report['checks']['loopback_only_port'] = True
    assert request('info', authenticated=False)[0] == 401
    assert request('info', headers={'Authorization': 'Bearer invalid'})[0] == 401
    assert request('info', headers={'Origin': 'https://untrusted.invalid'})[0] == 403
    assert request('info', headers={'Host': 'untrusted.invalid'})[0] == 403
    report['checks']['token_origin_host_guards'] = True
    check_invoices()
    mode = docker('exec', name, 'stat', '-c', '%u %a', '/data/keys.json').stdout.strip()
    assert mode == '10001 600', mode
    digest = docker('exec', name, 'sha256sum', '/data/keys.json').stdout.split()[0]
    report['checks']['nonroot_private_encrypted_keystore'] = True
    duplicate = docker('run', '--pull=never', '--rm', '--name', name + '-duplicate', *mount, args.image, *docker_args, check=False, timeout=30)
    assert duplicate.returncode != 0 and 'wallet is already in use' in duplicate.stderr
    report['checks']['exclusive_wallet_lock'] = True
    docker('stop', '--time', '20', name)
    wrong_env = dict(env, P2PD_PASSPHRASE=secrets.token_hex(32))
    wrong = docker('run', '--pull=never', '--rm', '--name', name + '-wrong-passphrase', *mount, args.image, *docker_args,
                   check=False, timeout=45, process_env=wrong_env)
    assert wrong.returncode != 0 and 'wrong passphrase' in wrong.stderr
    report['checks']['wrong_passphrase_rejected'] = True
    docker('start', name)
    second = ready(running)
    assert first['npub'] == second['npub']
    assert digest == docker('exec', name, 'sha256sum', '/data/keys.json').stdout.split()[0]
    assert request('balance')[1]['btc_spendable_sat'] == 0
    report['checks']['restart_preserves_wallet'] = True


try:
    if args.image:
        with ExitStack() as cleanup:
            check_docker(cleanup)
    else:
        check_native()
    report['result'] = 'passed'
    print('PASS: Mutinynet wallet and RGB invoice smoke checks')
except Exception as error:
    report.update(result='failed', error=str(error) or type(error).__name__)
    raise
finally:
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + '\n')
