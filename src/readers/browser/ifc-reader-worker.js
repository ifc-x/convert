import IfcReaderBrowser from './ifc-reader';

self.onmessage = async (event) => {
  const { id, input } = event.data;

  try {
    const reader = new IfcReaderBrowser();

    const result = await reader.read(input, {
      progressCallback: (progress) => {
        self.postMessage({ id, progress });
      }
    });

    self.postMessage({ id, result });
  } catch(err) {
    self.postMessage({ id, error: err.message });
  }
};