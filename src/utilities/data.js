/**
 * Convert input into a Uint8Array.
 * @param {string|ArrayBuffer|Uint8Array|File|Blob} input - The input to convert.
 * @returns {Promise<Uint8Array>} The input as a Uint8Array.
 * @throws {Error} If input cannot be converted.
 */
export async function toUint8Array(input) {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  if (typeof input === "string") {
    const response = await fetch(input);
    const buffer = await response.arrayBuffer();

    return new Uint8Array(buffer);
  }
  if (
    (typeof File !== "undefined" && input instanceof File) ||
    (typeof Blob !== "undefined" && input instanceof Blob)
  ) {
    const buffer = await input.arrayBuffer();

    return new Uint8Array(buffer);
  }
  throw new Error("Cannot convert input to Uint8Array");
}

/**
 * Detect the type/extension of the input file or blob.
 * 
 * @param {*} input - The input to detect the type of.
 * @returns {string} The detected file type (extension).
 * @throws {Error} When type cannot be detected.
 */
export function detectType(input) {
  if (typeof input === "string" && input.includes(".")) {
    return input.split(".").pop().toLowerCase();
  }
  if (typeof File !== "undefined" && input instanceof File) {
    return input.name.split(".").pop().toLowerCase();
  }
  if (typeof Blob !== "undefined" && input instanceof Blob && input.name) {
    return input.name.split(".").pop().toLowerCase();
  }
  throw new Error("Unable to detect type — pass { type } explicitly");
}
