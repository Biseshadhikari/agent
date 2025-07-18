const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

async function compileAndUploadCode(code, fqbn, port) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arduino-sketch-'));
  const sketchName = path.basename(tmpDir);
  const inoFile = path.join(tmpDir, `${sketchName}.ino`);

  await fs.writeFile(inoFile, code, 'utf8');

  const cmd = `arduino-cli upload -p ${port} --fqbn ${fqbn} ${tmpDir}`;

  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message);
      } else {
        resolve(stdout);
      }
    });
  });
}

module.exports = { compileAndUploadCode };
