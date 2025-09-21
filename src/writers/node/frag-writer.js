import { IfcImporter } from "@thatopen/fragments";
import { BaseWriter } from "../../adapters/base-writer.js";
import { downloadFileToLocal } from "../../utilities/node/data.js";
import { dirname } from "path";

/**
 * SQLite writer for persisting IFC/FRAG data into a relational database file.
 *
 * - Creates two tables: `Entities` (attributes) and `Hierarchy` (parent-child relations).
 * - Supports progress tracking during row and relation insertion.
 * - Produces a `Uint8Array` of the final SQLite file contents.
 *
 * @extends BaseWriter
 */
export default class FragWriterNode extends BaseWriter {
  /** @type {string[]} Supported output formats */
  static formats = ["frag"];

  /** @type {string[]} Supported environments */
  static environments = ["node"];

  /** @type {number} Priority when multiple writers are registered */
  static priority = 10;

  /** @type {string[]} Supported input types */
  static inputs = ["ifc"];

  constructor() {
    super();

    this.serializer = new IfcImporter();
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

    const wasmPath = await downloadFileToLocal('https://unpkg.com/web-ifc@latest/web-ifc-node.wasm');

    this.serializer.wasm = { absolute: true, path: dirname(wasmPath) + '/' };

    const fragmentBytes = await this.serializer.process({
      bytes: input,
      progressCallback: (progress, data) => {
        this.progress = progress;

        this.emitProgress();
      }
    });

    console.log('FRAG', fragmentBytes.length);

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
