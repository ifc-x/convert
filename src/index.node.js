import Converter from "./converter.js";
import { registry } from "./registry.js";

import IfcReaderNode from "./readers/node/ifc-reader.js";
import FragReaderNode from "./readers/node/frag-reader.js";
import FragWriterNode from "./writers/node/frag-writer.js";
import SqliteWriterNode from "./writers/node/sqlite-writer.js";

registry.addReader(IfcReaderNode);
registry.addReader(FragReaderNode);
registry.addWriter(FragWriterNode);
registry.addWriter(SqliteWriterNode);

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
