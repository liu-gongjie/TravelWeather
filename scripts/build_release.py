#!/usr/bin/env python3
"""Build with the owner's explicit local release key and macOS Keychain password."""
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
key = Path(os.environ.get('ANDROID_KEYSTORE', str(root.parent / 'signing/TravelWeather-release.p12'))).expanduser()
if not key.is_file():
    raise SystemExit('Release signing key missing; restore its private backup. No replacement will be generated.')
result = subprocess.run(['/usr/bin/security', 'find-generic-password', '-a', 'travelweather',
                         '-s', 'TravelWeather.release.signing.v1', '-w'], capture_output=True, text=True)
if result.returncode or not result.stdout.rstrip('\r\n'):
    raise SystemExit('Release signing password unavailable in macOS Keychain')
password = result.stdout.rstrip('\r\n')
env = {**os.environ, 'ANDROID_KEYSTORE': str(key), 'ANDROID_KEY_ALIAS': 'travelweather',
       'ANDROID_STORE_PASSWORD': password, 'ANDROID_KEY_PASSWORD': password,
       'ANDROID_APK_OUTPUT': str(root / 'TravelWeather-release.apk')}
subprocess.run([sys.executable, str(root / 'build_android.py')], cwd=root, env=env, check=True)
