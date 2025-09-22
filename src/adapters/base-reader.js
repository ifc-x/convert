export class BaseReader {
  static formats = [];
  static environments = [];
  static priority = 0;

  async read(input, options = {}) {
    throw new Error("read() not implemented");
  }

  emitsProgress(type) {
    return true;
  }
}