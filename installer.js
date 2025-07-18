const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const tar = require('tar');
const AdmZip = require('adm-zip');

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const INSTALL_DIR = path.join(__dirname, 'arduino-cli');

function getCliAssetName(version) {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'darwin') {
    if (arch === 'arm64') return `arduino-cli_${version}_macOS_arm64.tar.gz`;
    return `arduino-cli_${version}_macOS_64bit.tar.gz`;
  }
  if (platform === 'win32') {
    if (arch === 'x64') return `arduino-cli_${version}_Windows_64bit.zip`;
    return `arduino-cli_${version}_Windows_32bit.zip`;
  }
  if (platform === 'linux') {
    if (arch === 'x64') return `arduino-cli_${version}_Linux_64bit.tar.gz`;
    return `arduino-cli_${version}_Linux_ARM64.tar.gz`;
  }
  throw new Error('Unsupported OS or architecture');
}

async function downloadAndInstallArduinoCli(win) {
  if (fs.existsSync(INSTALL_DIR)) {
    const cliPath = getArduinoCliPath();
    if (fs.existsSync(cliPath)) {
      win.webContents.send('log', 'Arduino CLI already installed');
      return cliPath;
    }
  }

  const releaseData = await axios.get('https://api.github.com/repos/arduino/arduino-cli/releases/latest');
  const version = releaseData.data.tag_name.startsWith('v') ? releaseData.data.tag_name.slice(1) : releaseData.data.tag_name;

  const assetName = getCliAssetName(version);
  const downloadUrl = `https://github.com/arduino/arduino-cli/releases/download/v${version}/${assetName}`;

  win.webContents.send('log', `⬇️ Downloading Arduino CLI version ${version}...`);

  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  fs.mkdirSync(INSTALL_DIR, { recursive: true });

  const destPath = path.join(DOWNLOADS_DIR, assetName);
  const writer = fs.createWriteStream(destPath);

  const response = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream' });
  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  win.webContents.send('log', '📦 Extracting Arduino CLI...');

  if (assetName.endsWith('.zip')) {
    const zip = new AdmZip(destPath);
    zip.extractAllTo(INSTALL_DIR, true);
  } else if (assetName.endsWith('.tar.gz')) {
    await tar.x({ file: destPath, cwd: INSTALL_DIR });
  } else {
    throw new Error('Unsupported archive format');
  }

  try { fs.unlinkSync(destPath); } catch {}

  win.webContents.send('log', '✅ Arduino CLI installed');

  return getArduinoCliPath();
}

function getArduinoCliPath() {
  const platform = os.platform();
  if (platform === 'win32') {
    return path.join(INSTALL_DIR, 'arduino-cli.exe');
  }
  return path.join(INSTALL_DIR, 'arduino-cli');
}

module.exports = { downloadAndInstallArduinoCli, getArduinoCliPath };
