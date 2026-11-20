#!/usr/bin/env python3
"""Exercise the desktop Docker launch contract on custom signet with an unfunded, disposable wallet."""
import argparse
import json
import os
import platform
import secrets
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--image', required=True)
parser.add_argument('--report', type=Path, required=True)
args = parser.parse_args()
name = 'kaleido-p2pd-beta-' + secrets.token_hex(6)
volume = name + '-data'
env = dict(os.environ, P2PD_API_TOKEN=secrets.token_hex(32), P2PD_PASSPHRASE=secrets.token_hex(32))
with socket.socket() as probe:
    probe.bind(('127.0.0.1', 0))
    port = probe.getsockname()[1]
report = {'image': args.image, 'host_os': platform.system(), 'network': 'signetcustom', 'checks': {}}

def docker(*parts, check=True, timeout=180, process_env=env):
    result = subprocess.run(['docker', *parts], capture_output=True, text=True,
                            env=process_env, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError('Docker operation failed: ' + parts[0] + ': ' + result.stderr[-1600:])
    return result

def request(endpoint, authenticated=True, headers=None):
    h = {'Authorization': 'Bearer ' + env['P2PD_API_TOKEN']} if authenticated else {}
    h.update(headers or {})
    req = urllib.request.Request(f'http://127.0.0.1:{port}/api/{endpoint}', headers=h)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, None

def ready():
    deadline = time.monotonic() + 150
    while time.monotonic() < deadline:
        try:
            code, info = request('info')
            if code == 200:
                assert info['network'] == 'signetcustom'
                return info
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            pass
        running = docker('inspect', '--format', '{{.State.Running}}', name).stdout.strip()
        if running != 'true':
            raise RuntimeError('Test daemon stopped before API readiness')
        time.sleep(2)
    raise TimeoutError('Signet daemon did not become ready within 150 seconds')

common = ['--name', name, '--port', str(port), '--bind', '0.0.0.0', '--data-dir', '/data',
          '--network', 'signetcustom', '--indexer', 'https://esplora.signet.kaleidoswap.com',
          '--proxy', 'https://proxy.iriswallet.com/0.2/json-rpc', '--relay', 'wss://relay.kaleidoswap.com',
          '--fee-address', 'tb1qksue05dv7z57mezp3j74cr64lrah57vufhjktw', '--fee-bps', '100',
          '--min-fee-sat', '1000', '--keystore', 'encrypted', '--no-rgbmap']
mount = ['-v', volume + ':/data', '-e', 'P2PD_API_TOKEN', '-e', 'P2PD_PASSPHRASE']
created_volume = False
try:
    image = json.loads(docker('image', 'inspect', args.image).stdout)[0]
    assert image['Os'] == 'linux'
    assert image['Config']['User'] not in ('', 'root', '0')
    report.update(image_id=image['Id'], architecture=image['Architecture'], container_os=image['Os'])
    docker('volume', 'create', volume)
    created_volume = True
    docker('run', '--pull=never', '-d', '--name', name, '-p', f'127.0.0.1:{port}:{port}',
           *mount, args.image, *common)
    first = ready()
    bindings = json.loads(docker('inspect', name).stdout)[0]['NetworkSettings']['Ports'][f'{port}/tcp']
    assert all(binding['HostIp'] == '127.0.0.1' for binding in bindings)
    report['checks']['loopback_only_port'] = True
    assert request('info', authenticated=False)[0] == 401
    assert request('info', headers={'Authorization': 'Bearer invalid'})[0] == 401
    assert request('info', headers={'Origin': 'https://untrusted.invalid'})[0] == 403
    assert request('info', headers={'Host': 'untrusted.invalid'})[0] == 403
    report['checks']['token_origin_host_guards'] = True
    code, balance = request('balance')
    assert code == 200 and balance['btc_spendable_sat'] == 0
    report['checks']['signet_sync_unfunded_wallet'] = True
    mode = docker('exec', name, 'stat', '-c', '%u %a', '/data/keys.json').stdout.strip()
    assert mode == '10001 600', mode
    digest = docker('exec', name, 'sha256sum', '/data/keys.json').stdout.split()[0]
    report['checks']['nonroot_private_encrypted_keystore'] = True
    duplicate = docker('run', '--pull=never', '--rm', '--name', name + '-duplicate', *mount, args.image, *common, check=False, timeout=30)
    assert duplicate.returncode != 0 and 'wallet is already in use' in duplicate.stderr
    report['checks']['exclusive_wallet_lock'] = True
    docker('stop', '--time', '20', name)
    wrong_env = dict(env, P2PD_PASSPHRASE=secrets.token_hex(32))
    wrong = docker('run', '--pull=never', '--rm', '--name', name + '-wrong-passphrase', *mount, args.image, *common,
                   check=False, timeout=45, process_env=wrong_env)
    assert wrong.returncode != 0 and 'wrong passphrase' in wrong.stderr
    report['checks']['wrong_passphrase_rejected'] = True
    docker('start', name)
    second = ready()
    assert first['npub'] == second['npub']
    assert digest == docker('exec', name, 'sha256sum', '/data/keys.json').stdout.split()[0]
    assert request('balance')[1]['btc_spendable_sat'] == 0
    report['checks']['restart_preserves_wallet'] = True
    report['result'] = 'passed'
    print('PASS: Docker signet startup, API guards, encrypted keystore, lock and restart')
except Exception as error:
    report.update(result='failed', error=str(error))
    raise
finally:
    docker('rm', '-f', name, name + '-duplicate', name + '-wrong-passphrase', check=False)
    if created_volume:
        docker('volume', 'rm', volume, check=False)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + '\n')
