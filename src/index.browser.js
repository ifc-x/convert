import Converter from "./converter.js";
import { registry } from "./registry.js";

import IfcReaderBrowser from "./readers/browser/ifc-reader-async.js";
import FragReaderBrowser from "./readers/browser/frag-reader-async.js";
import FragWriterBrowser from "./writers/browser/frag-writer-async.js";
import SqliteWriterBrowser from "./writers/browser/sqlite-writer-async.js";

registry.addReader(IfcReaderBrowser);
registry.addReader(FragReaderBrowser);
registry.addWriter(FragWriterBrowser);
registry.addWriter(SqliteWriterBrowser);

/**
 * Quick convert utility using global registry.
 * 
 * @param {string|File|Blob|ArrayBuffer|Uint8Array} input - input data or file
 * @param {object} options - optional overrides
 *   - inputType: string (ifc, frag, etc.)
 *   - outputType: string (sqlite, db, xlsx, etc.)
 *   - env: string (node/browser)
 *   - readerClass: force specific reader
 *   - writerClass: force specific writer
 *   - middleware: array of functions to transform data
 *   - progressCallback: progress callback function
 */
export async function convert(input, options = {}) {
  const { middleware = [], readerClass, writerClass, env, inputType, outputType, progressCallback } = options;

  const converter = new Converter({ env, readerClass, writerClass });

  middleware.forEach(fn => converter.use(fn));

  return converter.convert(input, { inputType, outputType, progressCallback });
}

export { Converter, registry };
