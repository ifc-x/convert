import { describe, it, expect } from "vitest";

const isNode = typeof window === 'undefined';

let convert, readFile, join;

if (isNode) {
  ({ convert } = await import("/dist/index.node.js"));
  ({ readFile } = await import("node:fs/promises"));
  ({ join } = await import("node:path"));
} else {
  ({ convert } = await import("/dist/index.browser.js"));
}
const readFileToUint8Array = async (name) => {
  let output;

  if (isNode) {
    const fixturePath = join("test/fixtures", name);
    output = new Uint8Array(await readFile(fixturePath));
  } else {
    const res = await fetch("test/fixtures/" + name);
    output = new Uint8Array(await res.arrayBuffer());
  }
  return output;
};

describe("convert()", () => {
  it("converts IFC → SQLite", async () => {
    const input = await readFileToUint8Array("test.ifc");
    const expected = await readFileToUint8Array("test.sqlite");

    const result = await convert(input, {
      inputType: "ifc",
      outputType: "sqlite"
    });

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(expected.length);
  });

  it("converts IFC → FRAG", async () => {
    const input = await readFileToUint8Array("test.ifc");
    const expected = await readFileToUint8Array("test.frag");

    const result = await convert(input, {
      inputType: "ifc",
      outputType: "frag"
    });

    expect(result).toBeInstanceOf(Uint8Array);

    // FRAG output is different everytime due to the compression method,
    // so let's add ±50 bytes of tolerance when comparing to the reference.
    const compressionTolerance = 50;

    expect(result.length)
      .toBeGreaterThanOrEqual(expected.length - compressionTolerance)
      .toBeLessThanOrEqual(expected.length + compressionTolerance);
  });

  it("converts FRAG → SQLITE", async () => {
    const input = await readFileToUint8Array("test.frag");
    const expected = await readFileToUint8Array("test.sqlite");

    const result = await convert(input, {
      inputType: "frag",
      outputType: "sqlite"
    });

    expect(result).toBeInstanceOf(Uint8Array);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(expected.length);
  });
});
