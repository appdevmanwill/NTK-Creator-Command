const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  const outDir = context.appOutDir;
  const resourcesDir =
    context.electronPlatformName === 'darwin'
      ? path.join(outDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
      : path.join(outDir, 'resources');

  const srcModules = path.join(process.cwd(), 'desktop', 'server-bundle', 'node_modules');
  const dstModules = path.join(resourcesDir, 'server-bundle', 'node_modules');

  if (fs.existsSync(srcModules) && !fs.existsSync(path.join(dstModules, 'next'))) {
    console.log(`Copying server-bundle/node_modules into ${dstModules}...`);
    fs.cpSync(srcModules, dstModules, { recursive: true, force: true });
  }

  if (context.electronPlatformName === 'linux') {
    const binName = context.packager.executableName || 'ntk-creator-command';
    const startScript = `#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/${binName}" --no-sandbox "$@"
`;
    const startPath = path.join(outDir, 'START_NTK_CREATOR_COMMAND.sh');
    fs.writeFileSync(startPath, startScript, { encoding: 'utf8', mode: 0o755 });

    const desktopEntry = `[Desktop Entry]
Type=Application
Name=NTK Creator Command
Comment=Private Creator Atelier by NTK Hub
Exec=./START_NTK_CREATOR_COMMAND.sh
Terminal=false
Categories=Utility;Office;
`;
    fs.writeFileSync(path.join(outDir, 'NTK-Creator-Command.desktop'), desktopEntry, 'utf8');
    console.log('Added Linux novice launcher scripts to:', outDir);
  }
};
