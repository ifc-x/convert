import { registry } from "./registry.js";
import { ENV } from "./utilities/env.js";

/**
 * Class for converting IFC files to various formats like SQLite or Excel.
 */
export default class Converter {
  /**
   * Create a new Converter instance.
   * @param {Object} [options] - Configuration options.
   * @param {"node"|"browser"} [options.env] - Environment the converter runs in.
   * @param {Function} [options.readerClass] - Forced reader class to use instead of auto-detection.
   * @param {Function} [options.writerClass] - Forced writer class to use instead of auto-detection.
   */
  constructor({ env, readerClass, writerClass } = {}) {
    this.env = env || ENV;
    this.forcedReader = readerClass;
    this.forcedWriter = writerClass;
    this.middleware = [];
  }

  /**
   * Add a middleware function to transform data during conversion.
   * @param {Function} fn - Middleware function that receives and returns data.
   * @returns {Converter} The converter instance (chainable).
   */
  use(fn) {
    this.middleware.push(fn);
    return this;
  }

  /**
   * Get the reader instance for a given type.
   * @param {string} type - The file type to read.
   * @returns {Object} Reader instance.
   * @throws {Error} If no reader is registered for the type.
   */
  getReader(type) {
    if (this.forcedReader) return new this.forcedReader();
    const ReaderClass = registry.findReader(this.env, type);
    if (!ReaderClass) {
      throw new Error(`No reader registered for type=${type} env=${this.env}`);
    }
    return new ReaderClass();
  }

  /**
   * Get the writer instance.
   * @param {string} type - The file type to write.
   * @returns {Object} Writer instance.
   * @throws {Error} If no writer is registered for the environment.
   */
  getWriter(type) {
    if (this.forcedWriter) return new this.forcedWriter();
    const WriterClass = registry.findWriter(this.env, type);
    if (!WriterClass) {
      throw new Error(`No writer registered for type=${type} env=${this.env}`);
    }
    return new WriterClass();
  }

  /**
   * Initialize progress tracking.
   */
  initProgress() {
    this.progress = null;
    this.progressCallback = null;
  }

  /**
   * Emit progress to the registered progress callback.
   * @param {number} progress - Progress as a decimal (0–1).
   */
  emitProgress(progress) {
    var currentProgress = this.progress;

    this.progress = Math.round(progress * 100);

    if (currentProgress === this.progress) {
      return;
    }
    this.progressCallback && this.progressCallback(this.progress);
  }

  /**
   * Convert a file or buffer to the desired output format using optional middleware.
   * @param {Uint8Array} input - Input data.
   * @param {Object} [options] - Conversion options.
   * @param {string} [options.type] - Explicit type of the input.
   * @param {Function} [options.progressCallback] - Callback for progress updates (0–100).
   * @returns {Promise<Uint8Array>} Converted output as a Uint8Array.
   */
  async convert(input, { inputType, outputType, progressCallback } = {}) {
    const detectedInputType = inputType;
    const detectedOutputType = outputType;

    this.progressCallback = progressCallback;

    const pair = registry.findCompatiblePair(this.env, detectedInputType, detectedOutputType);

    if (!pair) {
      throw new Error(`No compatible reader/writer for ${detectedInputType} → ${detectedOutputType}`);
    }
    const { ReaderClass, WriterClass, dataType } = pair;

    const reader = new ReaderClass();
    const writer = new WriterClass();

    let data = await reader.read(
      input, 
      { type: dataType, progressCallback: (p) => this.emitProgress(p * 0.5) }
    );

    for (const fn of this.middleware) {
      data = await fn(data);
    }

    return writer.write(
      data, 
      { type: dataType, progressCallback: (p) => this.emitProgress(0.5 + p * 0.5) }
    );
  }
}
