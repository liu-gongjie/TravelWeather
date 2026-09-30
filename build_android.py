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
key=build/'debug.keystore'
if not key.exists():run(java/'bin/keytool','-genkeypair','-keystore',key,'-storepass','android','-keypass','android','-alias','androiddebugkey','-dname','CN=TravelWeather Debug','-keyalg','RSA','-validity','10000')
output=root/'TravelWeather-debug.apk'
run(bt/'apksigner','sign','--ks',key,'--ks-pass','pass:android','--out',output,build/'aligned.apk')
run(bt/'apksigner','verify',output)
print(output)
