export class BaseWriter {
  static formats = [];
  static environments = [];
  static priority = 0;

  async write(data, options = {}) {
    throw new Error("write() not implemented");
  }

  emitsProgress(type) {
    return true;
  }
}
