// cliResolver.js
const os = require('os');
const path = require('path');
const fs = require('fs');

function getBundledCLIPath() {
  const platform = os.platform();
  let cliPath;

  if (platform === 'win32') {
    cliPath = path.join(__dirname, 'cli-bundled', 'windows', 'arduino-cli.exe');
  } else if (platform === 'darwin') {
    cliPath = path.join(__dirname, 'cli-bundled', 'mac', 'arduino-cli');
  } else if (platform === 'linux') {
    cliPath = path.join(__dirname, 'cli-bundled', 'linux', 'arduino-cli');
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  if (!fs.existsSync(cliPath)) {
    throw new Error(`❌ Bundled Arduino CLI not found for platform: ${platform}`);
  }

  if (platform !== 'win32') {
    fs.chmodSync(cliPath, 0o755); // make it executable
  }

  return cliPath;
}

module.exports = { getBundledCLIPath };
