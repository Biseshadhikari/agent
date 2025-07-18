const { app, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs/promises');
const os = require('os');
const find = require('find-process');
const { exec } = require('child_process');
const { downloadAndInstallArduinoCli, getArduinoCliPath } = require('./installer');

let mainWindow;
let arduinoCliPath;

function killPort(port) {
  return new Promise((resolve, reject) => {
    const cmd = process.platform === 'win32'
      ? `netstat -ano | findstr :${port}`
      : `lsof -i tcp:${port} | grep LISTEN`;

    exec(cmd, (err, stdout) => {
      if (err || !stdout) {
        resolve(); // Port is free or not found, nothing to kill
        return;
      }

      const lines = stdout.trim().split('\n');
      const pids = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        return process.platform === 'win32'
          ? parts[4] // PID column in netstat for Windows
          : parts[1]; // PID column in lsof for Unix
      });

      const uniquePids = [...new Set(pids)];

      Promise.all(
        uniquePids.map(pid => {
          return new Promise((res, rej) => {
            try {
              process.kill(pid, 'SIGKILL');
              res();
            } catch (e) {
              rej(e);
            }
          });
        })
      ).then(resolve).catch(reject);
    });
  });
}
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('renderer.html');

  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('log', 'Starting Arduino Upload Agent...');
  });

  try {
    arduinoCliPath = await downloadAndInstallArduinoCli(mainWindow);
    mainWindow.webContents.send('log', `✅ Arduino CLI ready: ${arduinoCliPath}`);
  } catch (err) {
    mainWindow.webContents.send('log', `❌ Arduino CLI install failed: ${err.message}`);
    return;
  }

  startHttpServer();
}

function runArduinoCliCommand(args, cwd) {
  return new Promise((resolve, reject) => {
    const cliCmd = `"${arduinoCliPath}" ${args.join(' ')}`;
    exec(cliCmd, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || stdout || error.message);
      } else {
        resolve(stdout);
      }
    });
  });
}

// Parse port from `arduino-cli board list` output
async function detectPort(fqbn) {
  const output = await runArduinoCliCommand(['board', 'list']);
  /*
  Sample output:
  Port         Type              Board Name          FQBN
  /dev/cu.usbmodem14101 Serial Port (USB) Arduino Uno       arduino:avr:uno
  */

  const lines = output.split('\n').map(line => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.includes(fqbn)) {
      // The line includes FQBN
      const parts = line.split(/\s+/);
      const port = parts[0];
      if (port && port !== 'Port') {
        return port;
      }
    }
  }
  return null; // no port found
}

async function startHttpServer() {
  const appServer = express();
  appServer.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }));
  appServer.use(bodyParser.json({ limit: '5mb' }));

  appServer.post('/upload', async (req, res) => {
    const { code, fqbn } = req.body;

    mainWindow.webContents.send('log', 'Received upload request');

    if (!code || !fqbn) {
      res.status(400).json({ error: 'Missing required fields: code, fqbn' });
      return;
    }


    try {
      const sketchDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arduino-sketch-'));
      const folderName = path.basename(sketchDir);
      const sketchFile = path.join(sketchDir, `${folderName}.ino`);

      await fs.writeFile(sketchFile, code, 'utf8');
      mainWindow.webContents.send('log', `Saved sketch to ${sketchFile}`);

      mainWindow.webContents.send('log', 'Compiling sketch...');
      await runArduinoCliCommand(['compile', '--fqbn', fqbn, sketchDir]);

      mainWindow.webContents.send('log', 'Compilation successful! Detecting upload port...');
      const port = await detectPort(fqbn);

      if (!port) {
        throw new Error('No upload port detected for board');
      }

      mainWindow.webContents.send('log', `Detected upload port: ${port}`);
      mainWindow.webContents.send('log', 'Uploading sketch...');
      await runArduinoCliCommand(['upload', '-p', port, '--fqbn', fqbn, sketchDir]);

      mainWindow.webContents.send('log', '✅ Upload successful');
      res.json({ success: true, message: 'Upload successful!' });
    } catch (err) {
      mainWindow.webContents.send('log', '❌ Upload failed: ' + err.toString());
      res.status(500).json({ success: false, message: err.toString() });
    }
  });
  


  const PORT = 3000;
  await killPort(PORT);
  appServer.listen(PORT, () => {
    mainWindow.webContents.send('log', `HTTP server running on http://localhost:${PORT}`);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});
