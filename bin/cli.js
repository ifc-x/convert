#!/usr/bin/env node
import fs from "fs";
import { convert } from "../dist/index.node.js";

const args = process.argv.slice(2);

if (args.length <= 1) {
  console.log("Usage: ifc-x-convert <input.ifc> <output.db>");
  
  process.exit(1);
}
const inputFile = args[0];
const inputType = inputFile.split('.').pop();
const outputFile = args[1];
const outputType = outputFile.split('.').pop();

try {
  const data = new Uint8Array(fs.readFileSync(inputFile));

  const result = await convert(data, {
    inputType,
    outputType,
    progressCallback: (progress) => console.log(progress),
  });

  fs.writeFileSync(outputFile, Buffer.from(result));
} catch (err) {
  console.error(`Error: ${err}`);
}
