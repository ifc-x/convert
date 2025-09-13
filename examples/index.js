import { convert } from '../src/index.js';

const fileInput = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const progressInner = document.getElementById('progressInner');
const percentText = document.getElementById('percentText');
const statusText = document.getElementById('statusText');
const downloadAnchor = document.getElementById('downloadAnchor');

let currentFile = null;
let currentUrl = null;

fileInput.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  currentFile = f || null;
  convertBtn.disabled = !currentFile;
  resetUI();
  if (currentFile) {
    statusText.textContent = `Selected: ${currentFile.name}`;
  }
});

convertBtn.addEventListener('click', async () => {
  if (!currentFile) return;
  convertBtn.disabled = true;
  fileInput.disabled = true;
  downloadAnchor.style.display = 'none';
  setProgress(0, 'Starting...');

  try {
    // progress callback
    const progressCallback = (progress) => {
      setProgress(progress, 'Processing');
    };

    // Call the user's convert function. It should pick a browser reader & writer automatically.
    const result = await convert(currentFile, { progressCallback });

    // Normalize result into a Blob
    const blob = new Blob([result.buffer ? result.buffer : result], { type: 'application/octet-stream' });

    // Create download link
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }
    const extension = '.db';
    const filename = (currentFile && currentFile.name ? stripExtension(currentFile.name) : 'converted') + extension;
    currentUrl = URL.createObjectURL(blob);
    downloadAnchor.href = currentUrl;
    downloadAnchor.download = filename;
    downloadAnchor.style.display = 'inline-flex';
    downloadAnchor.textContent = `Download ${filename}`;

    setProgress(100, 'Complete');
    statusText.textContent = 'Conversion finished.';
  } catch (err) {
    console.error(err);
    setProgress(0, 'Error');
    statusText.textContent = 'Error: ' + (err && err.message ? err.message : String(err));
    alert('Conversion failed. See console for details.');
  } finally {
    convertBtn.disabled = false;
    fileInput.disabled = false;
  }
});

function setProgress(progress, status) {
  progressInner.style.width = progress + '%';
  percentText.textContent = progress + '%';
  statusText.textContent = status || statusText.textContent;
  // update ARIA
  const pb = document.querySelector('.progress-bar');
  if (pb) pb.setAttribute('aria-valuenow', String(progress));
}

function resetUI() {
  setProgress(0, 'Idle');
  downloadAnchor.style.display = 'none';
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

function stripExtension(name) {
  return name.replace(/\.[^/.]+$/, '');
}

// small initialization
setProgress(0, 'Idle');