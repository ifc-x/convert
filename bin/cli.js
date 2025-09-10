#!/usr/bin/env node
import fs from "fs";
import { convert } from "../src/index.js";

async function run() {
  const args = process.argv.slice(2);

  if (args.length <= 1) {
    console.log("Usage: ifc-x-convert <input.ifc> <ouput.db>");
    return;
  }
  const data = new Uint8Array(fs.readFileSync(args[0]));

  console.log(await convert(data, { type: 'ifc', progressCallback: (progress) => console.log(progress) }));
}
run();
