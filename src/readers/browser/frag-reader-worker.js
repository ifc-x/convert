import FragReaderBrowser from './frag-reader';

self.onmessage = async (event) => {
  const { id, buffer } = event.data;

  try {
    const reader = new FragReaderBrowser();

    const result = await reader.read(new Uint8Array(buffer), {
      progressCallback: (progress) => {
        self.postMessage({ id, progress });
      }
    });

    self.postMessage({ id, result });
  } catch(err) {
    self.postMessage({ id, error: err.message });
  }
};