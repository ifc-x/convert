import Converter from "./converter.js";
import { registry } from "./registry.js";
import { toUint8Array, detectType } from './utilities/data.js';

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
  const { middleware = [], readerClass, writerClass, env, outputType, progressCallback } = options;
  let { inputType } = options;

  inputType ||= detectType(input);

  const converter = new Converter({ env, readerClass, writerClass });

  middleware.forEach(fn => converter.use(fn));

  return converter.convert(await toUint8Array(input), { inputType, outputType, progressCallback });
}

export { Converter, registry };
