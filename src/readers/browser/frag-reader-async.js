export default class FragReaderAsyncBrowser {
  static formats = ["frag"];
  static environments = ["browser"];
  static priority = 10;
  static outputs = ["tabular"];

  constructor() {
    this.worker = new Worker(new URL('./frag-reader-worker.js', import.meta.url), {
      type: 'module'
    });

    this.requestId = 0;
    this.pending = new Map();

    this.worker.onmessage = (e) => {
      const { id, result = null, error = null, progress = null } = e.data;

      const { resolve, reject, progressCallback } = this.pending.get(id);

      if (progress !== null) {
        progressCallback(progress);

        return;
      }
      this.pending.delete(id);

      if (error) reject(new Error(error));
      else resolve(result);
    };
  }

  read(input, { progressCallback } = {}) {
    progressCallback ||= () => {};

    return new Promise(async (resolve, reject) => {
      try {
        const id = this.requestId++;

        this.pending.set(id, { resolve, reject, progressCallback });

        this.worker.postMessage({ id, buffer: input.buffer }, [input.buffer]);
      } catch(err) {
        reject(err);
      }
    });
  }
}
