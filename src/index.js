import Converter from "./converter.js";
import { registry } from "./registry.js";

// ----------------------------
// Built-in Node readers
// ----------------------------
import IfcReaderNode from "./readers/node/ifc-reader.js";
import SqliteWriterNode from "./writers/node/sqlite-writer.js";

// ----------------------------
// Built-in Browser readers
// ----------------------------
import IfcReaderBrowser from "./readers/browser/ifc-reader.js";
import SqliteWriterBrowser from "./writers/browser/sqlite-writer.js";

// ----------------------------
// Register built-in adapters
// ----------------------------
registry.addReader(IfcReaderNode);
registry.addReader(IfcReaderBrowser);

registry.addWriter(SqliteWriterNode);
registry.addWriter(SqliteWriterBrowser);

/**
 * Quick convert utility using global registry.
 * 
 * @param {string|File|Blob} input - input data or file
 * @param {object} options - optional overrides
 *   - type: string (frag, ifc, etc.)
 *   - env: string (node/browser)
 *   - readerClass: force specific reader
 *   - writerClass: force specific writer
 *   - middleware: array of functions to transform data
 *   - progressCallback: progress callback function
 */
export async function convert(input, options = {}) {
  const { middleware = [], readerClass, writerClass, env, type, progressCallback } = options;

  const converter = new Converter({ env, readerClass, writerClass });

  middleware.forEach(fn => converter.use(fn));

  return converter.convert(input, { type, progressCallback });
}

export { Converter, registry };
