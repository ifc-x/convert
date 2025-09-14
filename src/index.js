import Converter from "./converter.js";
import { registry } from "./registry.js";

if (typeof process !== 'undefined' && process?.versions?.node) {
  const IfcReaderNode = await import("./readers/node/ifc-reader.js");
  const FragReaderNode = await import("./readers/node/frag-reader.js");
  const FragWriterNode = await import("./writers/node/frag-writer.js");
  const SqliteWriterNode = await import("./writers/node/sqlite-writer.js");

  registry.addReader(IfcReaderNode.default);
  registry.addReader(FragReaderNode.default);
  registry.addWriter(FragWriterNode.default);
  registry.addWriter(SqliteWriterNode.default);
} else {
  const IfcReaderBrowser = await import("./readers/browser/ifc-reader-async.js");
  const FragReaderBrowser = await import("./readers/browser/frag-reader-async.js");
  const FragWriterBrowser = await import("./writers/browser/frag-writer-async.js");
  const SqliteWriterBrowser = await import("./writers/browser/sqlite-writer-async.js");

  registry.addReader(IfcReaderBrowser.default);
  registry.addReader(FragReaderBrowser.default);
  registry.addWriter(FragWriterBrowser.default);
  registry.addWriter(SqliteWriterBrowser.default);
}

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
