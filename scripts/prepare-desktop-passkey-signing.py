#!/usr/bin/env python3
"""Prepare the two signing inputs for the optional Desktop passkey macOS overlay."""

import argparse
import datetime
import os
from pathlib import Path
import plistlib
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1] / "src-tauri"
RP = "webcredentials:keys.kaleidoswap.com"
DOMAINS = "com.apple.developer.associated-domains"
TEAM = "com.apple.developer.team-identifier"
APP_ID = "com.apple.application-identifier"


def signed_entitlements(profile, bundle_id):
    expires = profile.get("ExpirationDate")
    if not expires or expires.replace(tzinfo=datetime.timezone.utc) <= datetime.datetime.now(datetime.timezone.utc):
        raise ValueError("The supplied provisioning profile has expired or lacks an expiry")
    entitlements = profile["Entitlements"]
    app_id = entitlements.get(APP_ID, "")
    prefix, _, signed_bundle = app_id.partition(".")
    if not prefix or signed_bundle != bundle_id:
        raise ValueError("Use an explicit App ID profile for the bundle being signed")
    team = entitlements.get(TEAM)
    if not team or team not in profile.get("TeamIdentifier", []):
        raise ValueError("The profile must authorize its signing team")
    domains = entitlements.get(DOMAINS, [])
    if isinstance(domains, str):
        domains = [domains]
    if "*" not in domains and RP not in domains:
        raise ValueError("The profile must authorize Associated Domains for the Desktop passkey RP")
    with (ROOT / "Entitlements.plist").open("rb") as file:
        signed = plistlib.load(file)
    signed.update({APP_ID: app_id, TEAM: team, DOMAINS: [RP]})
    return signed


def replace_file(destination, content):
    with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as file:
        file.write(content)
        path = Path(file.name)
    try:
        os.replace(path, destination)
    finally:
        path.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", type=Path, help="Apple-issued Developer ID provisioning profile")
    parser.add_argument("bundle_id", help="Active Tauri bundle identifier, including any beta overlay")
    args = parser.parse_args()
    raw = args.profile.read_bytes()
    decoded = subprocess.run(["/usr/bin/security", "cms", "-D"], input=raw, check=True, capture_output=True)
    entitlements = signed_entitlements(plistlib.loads(decoded.stdout), args.bundle_id)
    output = ROOT / "target" / "passkey-signing"
    output.mkdir(parents=True, exist_ok=True)
    replace_file(output / "embedded.provisionprofile", raw)
    replace_file(output / "Entitlements.plist", plistlib.dumps(entitlements))
    print(f"Prepared passkey signing inputs for {args.bundle_id} in {output}")


if __name__ == "__main__":
    main()
