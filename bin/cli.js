#!/usr/bin/env node
import fs from "fs";
import { convert } from "../src/index.js";

async function run() {
  const args = process.argv.slice(2);

  if (args.length <= 1) {
    console.log("Usage: ifc-x-convert <input.ifc> <output.db>");
    
    return;
  }
  const inputFile = args[0];
  const outputFile = args[1];

  try {
    const data = new Uint8Array(fs.readFileSync(inputFile));

    const result = await convert(data, {
      type: "ifc",
      progressCallback: (progress) => console.log(progress),
    });

    fs.writeFileSync(outputFile, Buffer.from(result));

    console.log(`Conversion complete: ${outputFile}`);
  } catch (err) {
    console.error("Error during conversion:", err);
  }
}

run();
