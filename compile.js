const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

const CLI_PATH = path.join(__dirname, 'arduino-cli', 'arduino-cli');

function compileAndUpload(code, port) {
  const sketchDir = path.join(os.tmpdir(), 'arduino-sketch');
  const sketchPath = path.join(sketchDir, 'sketch.ino');

  fs.mkdirSync(sketchDir, { recursive: true });
  fs.writeFileSync(sketchPath, code);

  return new Promise((resolve, reject) => {
    const commands = [
      `"${CLI_PATH}" core update-index`,
      `"${CLI_PATH}" core install arduino:avr`,
      `"${CLI_PATH}" compile --fqbn arduino:avr:uno "${sketchDir}"`,
      `"${CLI_PATH}" upload -p ${port} --fqbn arduino:avr:uno "${sketchDir}"`
    ].join(' && ');

    exec(commands, (err, stdout, stderr) => {
      if (err) return reject(stderr || stdout);
      resolve(stdout);
    });
  });
}

module.exports = { compileAndUpload };
