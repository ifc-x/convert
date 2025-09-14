import { IfcImporter } from "@thatopen/fragments";
import { BaseWriter } from "../../adapters/base-writer.js";

/**
 * SQLite writer for the browser, implemented with `sql.js` (WASM).
 *
 * - Creates two tables: `Entities` (entity attributes) and `Hierarchy` (parent-child relations).
 * - Exports a SQLite binary as a `Uint8Array`, suitable for saving or downloading.
 * - Reports progress during row and relation insertion.
 *
 * @extends BaseWriter
 */
export default class FragWriterBrowser extends BaseWriter {
  /** @type {string[]} Supported output formats */
  static formats = ["frag"];

  /** @type {string[]} Supported environments */
  static environments = ["browser"];

  /** @type {number} Priority when multiple writers are registered */
  static priority = 10;

  /** @type {string[]} Supported input types */
  static inputs = ["ifc"];

  constructor() {
    super();

    this.serializer = new IfcImporter();
    this.serializer.wasm = { absolute: true, path: 'https://unpkg.com/web-ifc@latest/' };
  }

  /**
   * Write parsed data into a fragment format.
   *
   * @param {Object} input - IFC bytes
   * 
   * @param {Object} options - Write options.
   * @param {(progress: number) => void} [options.progressCallback] - Progress callback (0–1).
   *
   * @returns {Promise<Uint8Array>} Fragment file contents as a `Uint8Array`.
   */
  async write(input, { progressCallback }) {
    this.initProgress();

    this.progressCallback = progressCallback;
    this.emitProgress();

    const fragmentBytes = await this.serializer.process({
      bytes: input,
      progressCallback: (progress, data) => {
        this.progress = progress;

        this.emitProgress();
      }
    });

    return fragmentBytes;
  }

  /**
   * Initialize internal progress counters.
   */
  initProgress() {
    this.progress = 0;
    this.progressCallback = null;
  }

  /**
   * Emit progress to the callback if defined.
   *
   * - Rows contribute up to 50% of total progress.
   * - Relations contribute up to 50% (after step 2 begins).
   *
   * @private
   */
  emitProgress() {
    if (!this.progressCallback) return;

    this.progressCallback(this.progress);
  }
}
