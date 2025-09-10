import { BaseReader } from "../../adapters/base-reader.js";

export default class IfcReader extends BaseReader {
  static formats = ["ifc"];
  static environments = ["browser"];
  static priority = 10;

  async read(input) {
    return { type: "ifc", content: input };
  }
}
