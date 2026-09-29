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
# A local build secret, never part of web assets or source archives.
key_path = Path(os.environ.get('AMAP_KEY_FILE', str(root.parent/'amap-key.txt')))
amap_key = os.environ.get('AMAP_WEB_KEY', '').strip()
if not amap_key and key_path.is_file(): amap_key = key_path.read_text().strip()
if amap_key and (len(amap_key) != 32 or any(c not in '0123456789abcdefABCDEF' for c in amap_key)):
 raise SystemExit('Invalid AMAP Web service key format')
(build/'assets/amap-key.txt').write_text(amap_key)
print('AMap fallback: ' + ('configured' if amap_key else 'disabled (no local key)'))
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
