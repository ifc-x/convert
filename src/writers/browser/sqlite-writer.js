import { BaseWriter } from "../../adapters/base-writer.js";

export default class SqliteWriter extends BaseWriter {
  static formats = ["db"];
  static environments = ["browser"];
  static priority = 10;

  async write(data) {
    console.log("Writing to Browser DB (IndexedDB):", data);
    return true;
  }
}
