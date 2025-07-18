const { SerialPort } = require('serialport');

async function getPorts() {
  const ports = await SerialPort.list();
  return ports.map(p => p.path);
}

module.exports = { getPorts };
