#!/usr/bin/env python3
"""Fail before a costly build if the selected identity cannot sign a notarized app."""
import os
import subprocess
import sys

identity = os.environ.get('APPLE_SIGNING_IDENTITY', '')
identities = subprocess.run(['security', 'find-identity', '-v', '-p', 'codesigning'],
                            check=True, capture_output=True, text=True).stdout
matches = [line for line in identities.splitlines()
           if '"Developer ID Application:' in line and identity and
           (f'"{identity}"' in line or identity.upper() in line.split('"', 1)[0])]
if len(matches) != 1:
    sys.exit('A unique valid Developer ID Application identity with its private key is required; '
             'Apple Development/Distribution and ad-hoc identities cannot be used here.')
print('Developer ID Application signing identity is available.')
