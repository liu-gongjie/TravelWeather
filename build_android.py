#!/usr/bin/env python3
"""Build without Gradle downloads using the locally installed Android SDK and JDK."""
from pathlib import Path
import os, shutil, subprocess, zipfile
root=Path(__file__).resolve().parent
sdk=Path(os.environ.get('ANDROID_HOME',str(Path.home()/'Library/Android/sdk')))
version=os.environ.get('ANDROID_BUILD_TOOLS','35.0.0')
bt=sdk/'build-tools'/version
platform=sdk/'platforms'/os.environ.get('ANDROID_PLATFORM','android-34')/'android.jar'
java=Path(os.environ.get('JAVA_HOME','/Applications/Android Studio.app/Contents/jbr/Contents/Home'))
env={**os.environ,'JAVA_HOME':str(java),'PATH':str(java/'bin')+os.pathsep+os.environ['PATH']}
# Signing identity must be supplied explicitly; never generate a replacement silently.
required_signing = ('ANDROID_KEYSTORE', 'ANDROID_KEY_ALIAS', 'ANDROID_STORE_PASSWORD')
missing = [name for name in required_signing if not os.environ.get(name)]
if missing:
 raise SystemExit('Missing signing configuration: ' + ', '.join(missing))
key = Path(os.environ['ANDROID_KEYSTORE']).expanduser()
if not key.is_absolute(): key = root / key
if not key.is_file():
 raise SystemExit('Signing keystore does not exist; restore the original or provide an explicitly chosen key')
if not os.access(key, os.R_OK):
 raise SystemExit('Signing keystore is not readable')
alias = os.environ['ANDROID_KEY_ALIAS']
# PKCS12 commonly uses the same password for the store and its private-key entry.
env['ANDROID_KEY_PASSWORD'] = os.environ.get('ANDROID_KEY_PASSWORD') or os.environ['ANDROID_STORE_PASSWORD']
build=root/'build'; build.mkdir(exist_ok=True)
for folder in ['classes','dex','assets/web']:(build/folder).mkdir(parents=True,exist_ok=True)
shutil.copytree(root/'web',build/'assets/web',dirs_exist_ok=True)
# The upstream AMap secret is server-only. Remove old 0.11 build assets.
from urllib.parse import urlsplit
(build/'assets/amap-key.txt').unlink(missing_ok=True)
proxy = os.environ.get('GEOCODER_PROXY_URL', '').strip()
if proxy:
 parsed = urlsplit(proxy)
 if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
  raise SystemExit('GEOCODER_PROXY_URL must be an HTTPS endpoint without credentials, query or fragment')
(build/'assets/geocoder-proxy.txt').write_text(proxy)
print('Address fallback: ' + ('HTTPS proxy configured' if proxy else 'disabled (proxy not configured)'))
def run(*args):subprocess.run([str(a) for a in args],check=True,cwd=root,env=env)
run(bt/'aapt','package','-f','-M',root/'android/AndroidManifest.xml','-S',root/'android/res','-A',build/'assets','-I',platform,'-F',build/'unsigned.apk')
run(java/'bin/javac','-encoding','UTF-8','-source','8','-target','8','-bootclasspath',platform,'-d',build/'classes',*list((root/'android/src').rglob('*.java')))
run(bt/'d8','--lib',platform,'--min-api','23','--output',build/'dex',*list((build/'classes').rglob('*.class')))
with zipfile.ZipFile(build/'unsigned.apk','a',zipfile.ZIP_DEFLATED) as z:
 for f in (build/'dex').glob('*.dex'):z.write(f,f.name)
run(bt/'zipalign','-f','4',build/'unsigned.apk',build/'aligned.apk')
output=Path(os.environ.get('ANDROID_APK_OUTPUT', str(root/'TravelWeather.apk'))).expanduser()
# Environment references keep password values out of command arguments and error messages.
run(bt/'apksigner','sign','--ks',key,'--ks-key-alias',alias,
    '--ks-pass','env:ANDROID_STORE_PASSWORD','--key-pass','env:ANDROID_KEY_PASSWORD',
    '--out',output,build/'aligned.apk')
run(bt/'apksigner','verify',output)
print(output)
