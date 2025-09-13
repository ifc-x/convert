import SqliteWriterBrowser from './sqlite-writer';

self.onmessage = async (event) => {
  const { id, input } = event.data;

  try {
    const writer = new SqliteWriterBrowser();

    const result = await writer.write(input, {
      progressCallback: (progress) => {
        self.postMessage({ id, progress });
      }
    });

    self.postMessage({ id, result });
  } catch(err) {
    self.postMessage({ id, error: err.message });
  }
};