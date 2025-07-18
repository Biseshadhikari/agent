const portSelect = document.getElementById('port-select');
const codeBox = document.getElementById('code');
const uploadBtn = document.getElementById('upload');
const statusDiv = document.getElementById('status');

async function refreshPorts() {
  try {
    const ports = await window.arduinoAPI.getPorts();
    portSelect.innerHTML = '';
    if (ports.length === 0) {
      portSelect.innerHTML = '<option>No Arduino detected</option>';
    } else {
      ports.forEach(p => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = p;
        portSelect.appendChild(opt);
      });
    }
  } catch (err) {
    portSelect.innerHTML = '<option>Error loading ports</option>';
  }
}

uploadBtn.onclick = async () => {
  const code = codeBox.value;
  const port = portSelect.value;
  statusDiv.textContent = 'Uploading...';

  try {
    const output = await window.arduinoAPI.compileAndUpload(code, port);
    statusDiv.textContent = '✅ Upload Success:\n' + output;
  } catch (e) {
    statusDiv.classList.add('error');
    statusDiv.textContent = '❌ Upload Failed:\n' + e;
  }
};

refreshPorts();
setInterval(refreshPorts, 5000);  // Poll USB ports every 5 seconds
