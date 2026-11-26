import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const RELEASE_ROOT = path.join(ROOT, 'DEPLOY_MANUAL', 'NTK_Creator_Command_Releases');

function ensureCleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}

function main() {
  ensureCleanDir(RELEASE_ROOT);

  const dirWinPort = path.join(RELEASE_ROOT, '01_Windows_Portable');
  const dirWinSetup = path.join(RELEASE_ROOT, '02_Windows_Installer');
  const dirLinux = path.join(RELEASE_ROOT, '03_Linux');
  const dirAndroid = path.join(RELEASE_ROOT, '04_Android_APK');

  fs.mkdirSync(dirWinPort, { recursive: true });
  fs.mkdirSync(dirWinSetup, { recursive: true });
  fs.mkdirSync(dirLinux, { recursive: true });
  fs.mkdirSync(dirAndroid, { recursive: true });

  const distDir = path.join(ROOT, 'desktop', 'dist');
  const winPortable = path.join(distDir, 'NTK-Creator-Command-Portable-1.0.0.exe');
  const winSetup = path.join(distDir, 'NTK-Creator-Command-Setup-1.0.0.exe');
  const linuxTar = path.join(distDir, 'NTK-Creator-Command-1.0.0-linux-x64.tar.gz');
  const linuxAppImage = path.join(distDir, 'NTK-Creator-Command-1.0.0-linux-x64.AppImage');
  const androidApk = path.join(
    ROOT,
    'android-app',
    'app',
    'build',
    'outputs',
    'apk',
    'release',
    'app-release.apk'
  );

  const copied = {
    winPortable: copyIfExists(winPortable, path.join(dirWinPort, 'NTK-Creator-Command-Portable-1.0.0.exe')),
    winSetup: copyIfExists(winSetup, path.join(dirWinSetup, 'NTK-Creator-Command-Setup-1.0.0.exe')),
    linuxTar: copyIfExists(linuxTar, path.join(dirLinux, 'NTK-Creator-Command-1.0.0-linux-x64.tar.gz')),
    linuxAppImage: copyIfExists(linuxAppImage, path.join(dirLinux, 'NTK-Creator-Command-1.0.0-linux-x64.AppImage')),
    androidApk: copyIfExists(androidApk, path.join(dirAndroid, 'NTK-Creator-Command-v1.0.0-Android8plus.apk')),
  };

  fs.writeFileSync(
    path.join(RELEASE_ROOT, '00_START_HERE_WHICH_APP_DO_I_USE.txt'),
    `NTK CREATOR COMMAND v1.0.0 — WHICH FOLDER SHOULD YOU OPEN?

Every package below is 100% self-contained with all dependencies bundled.
It works on brand-new devices with NO internet connection, NO Node.js, and NO coding setup required.

Pick the folder that matches your device:

1. 01_Windows_Portable
   Best when you want to run the app right away on Windows with NO installation.
   You can even copy it to a USB flash drive.

2. 02_Windows_Installer
   Best when you want a normal Windows program with Desktop and Start Menu shortcuts.

3. 03_Linux
   Use this on Ubuntu, Linux Mint, Fedora, Debian, or other 64-bit Linux PCs.

4. 04_Android_APK
   Install this on any Android phone or tablet running Android 8.0 or newer (up to Android 16).
   Works standalone and offline on your phone with no PC required.

Open the folder you want and read the short "HOW_TO_..." text file inside.
`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(dirWinPort, 'HOW_TO_USE_WINDOWS_PORTABLE.txt'),
    `HOW TO USE NTK CREATOR COMMAND (WINDOWS PORTABLE)

1. Double-click "NTK-Creator-Command-Portable-1.0.0.exe".
2. If Windows SmartScreen appears, click "More info" -> "Run anyway".
3. Wait a few seconds while your private Creator Atelier starts.
4. Your saved books, spreadsheets, packs, and settings are stored automatically in a folder named "NTK-Creator-Command-Data" right next to this .exe file.
`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(dirWinSetup, 'HOW_TO_INSTALL_WINDOWS.txt'),
    `HOW TO INSTALL NTK CREATOR COMMAND ON WINDOWS

1. Double-click "NTK-Creator-Command-Setup-1.0.0.exe".
2. If Windows SmartScreen appears, click "More info" -> "Run anyway".
3. Follow the simple setup wizard (choose your install folder if you want).
4. Once finished, open "NTK Creator Command" from your Desktop or Windows Start Menu.
`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(dirLinux, 'HOW_TO_RUN_ON_LINUX.txt'),
    `HOW TO RUN NTK CREATOR COMMAND ON LINUX (64-BIT)

Option A — If you see "NTK-Creator-Command-1.0.0-linux-x64.AppImage":
1. Right-click the .AppImage file -> Properties -> Permissions -> check "Allow executing file as program" (or run: chmod +x NTK-Creator-Command-*.AppImage).
2. Double-click the .AppImage file to launch.

Option B — Using "NTK-Creator-Command-1.0.0-linux-x64.tar.gz":
1. Right-click the .tar.gz file and click "Extract Here" (or run: tar -xzf NTK-Creator-Command-1.0.0-linux-x64.tar.gz).
2. Open the extracted folder and double-click "START_NTK_CREATOR_COMMAND.sh" (or run ./START_NTK_CREATOR_COMMAND.sh in Terminal).
3. Your data and generated files are saved in ~/.config/ntk-creator-command/.
`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(dirAndroid, 'HOW_TO_INSTALL_ON_ANDROID.txt'),
    `HOW TO INSTALL NTK CREATOR COMMAND ON ANDROID (ANDROID 8.0 TO LATEST)

1. Copy "NTK-Creator-Command-v1.0.0-Android8plus.apk" to your phone (via USB, WhatsApp, Telegram, Google Drive, or Bluetooth).
2. Open your phone's "Files" or "My Files" app and tap the .apk file.
3. If Android asks for permission to install apps from that file manager or browser:
   - Tap "Settings" on the popup.
   - Turn ON "Allow from this source".
   - Go back and tap "Install".
4. Open "NTK Creator Command" from your app drawer.
5. Everything works standalone on your phone:
   - Browse all 30 benchmarked channels in Atlas
   - Create PDF ebooks, Excel spreadsheets, planners, and prompt ZIPs in Press & Cinema
   - Save files directly to your phone's Downloads folder or share them from Vault
   - Optionally add your free Gemini / Groq / OpenRouter keys in the menu under API Key Vault
`,
    'utf8'
  );

  console.log('Release assembly summary:', JSON.stringify(copied, null, 2));
  for (const [k, ok] of Object.entries(copied)) {
    if (k !== 'linuxAppImage' && !ok) {
      throw new Error(`Missing required release artifact: ${k}`);
    }
  }
}

main();
