import { convert } from '../src/index.browser.js';

const fileInput = document.getElementById('fileInput');
const outputTypeSelect = document.getElementById('outputType');
const convertBtn = document.getElementById('convertBtn');
const progressInner = document.getElementById('progressInner');
const percentText = document.getElementById('percentText');
const statusText = document.getElementById('statusText');
const downloadAnchor = document.getElementById('downloadAnchor');

let currentFile = null;
let currentUrl = null;
let detectedInputType = null;

fileInput.addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  currentFile = f || null;
  convertBtn.disabled = !currentFile;
  resetUI();

  if (currentFile) {
    // detect input type from extension
    const ext = currentFile.name.split('.').pop().toLowerCase();
    if (ext === 'ifc') {
      detectedInputType = 'ifc';
    } else if (ext === 'frag') {
      detectedInputType = 'frag';
    } else {
      detectedInputType = null;
    }

    statusText.textContent = detectedInputType
      ? `Selected: ${currentFile.name} (detected ${detectedInputType.toUpperCase()})`
      : `Selected: ${currentFile.name} (unknown type)`;
  }
});

convertBtn.addEventListener('click', async () => {
  if (!currentFile) return;

  const outputType = outputTypeSelect.value;

  convertBtn.disabled = true;
  fileInput.disabled = true;
  outputTypeSelect.disabled = true;
  downloadAnchor.style.display = 'none';
  setProgress(0, 'Starting...');

  try {
    // progress callback
    const progressCallback = (progress) => {
      setProgress(progress, 'Processing');
    };

    // Call the user's convert function with detected input type
    const result = await convert(currentFile, {
      progressCallback,
      inputType: detectedInputType,
      outputType,
    });

    // Normalize result into a Blob
    const blob = new Blob([result.buffer ? result.buffer : result], {
      type: 'application/octet-stream',
    });

    // Create download link
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      currentUrl = null;
    }

    const extension = outputType === 'sqlite' ? '.db' : '.frag';
    const filename =
      (currentFile && currentFile.name
        ? stripExtension(currentFile.name)
        : 'converted') + extension;

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
    statusText.textContent =
      'Error: ' + (err && err.message ? err.message : String(err));
    alert('Conversion failed. See console for details.');
  } finally {
    convertBtn.disabled = false;
    fileInput.disabled = false;
    outputTypeSelect.disabled = false;
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
