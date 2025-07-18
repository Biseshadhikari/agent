const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');
const unzipper = require('unzipper');
const { exec } = require('child_process');

function getDownloadURL() {
  const version = '0.35.2'; // use latest known stable version
  const base = `https://downloads.arduino.cc/arduino-cli/arduino-cli_${version}`;

  const platform = os.platform();
  if (platform === 'win32') return `${base}_Windows_64bit.zip`;
  if (platform === 'darwin') return `${base}_macOS_64bit.zip`;
  if (platform === 'linux') return `${base}_Linux_64bit.zip`;

  throw new Error('Unsupported platform: ' + platform);
}

async function downloadAndExtractArduinoCLI(onStatus = () => {}) {
  const url = getDownloadURL();
  const cliFolder = path.join(__dirname, 'cli-bin');
  const zipPath = path.join(cliFolder, 'arduino-cli.zip');
  const cliBinary = path.join(cliFolder, os.platform() === 'win32' ? 'arduino-cli.exe' : 'arduino-cli');

  fs.mkdirSync(cliFolder, { recursive: true });

  onStatus('📦 Downloading Arduino CLI...');

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(zipPath);
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`❌ Download failed with status ${res.statusCode}`));
      }

      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });

    req.on('error', (err) => reject(new Error('❌ Failed to download CLI: ' + err.message)));
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('❌ CLI download timed out.'));
    });
  });

  onStatus('📂 Extracting CLI...');

  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: cliFolder }))
    .promise();

  fs.unlinkSync(zipPath);

  if (!fs.existsSync(cliBinary)) {
    throw new Error('CLI binary not found after extraction.');
  }

  if (os.platform() !== 'win32') {
    fs.chmodSync(cliBinary, 0o755);
  }

  return cliBinary;
}


async function setupCLIIfNeeded(onStatus = () => {}) {
  const cliBinary = await downloadAndExtractArduinoCLI(onStatus);
  const run = (cmd) => new Promise((res) => exec(`"${cliBinary}" ${cmd}`, () => res()));

  onStatus('🔧 Initializing CLI config...');
  await run('config init');

  onStatus('📦 Installing board cores...');
  await run('core update-index');
  await run('core install arduino:avr');

  onStatus('✅ Arduino CLI ready');
  return cliBinary;
}

module.exports = { setupCLIIfNeeded };
