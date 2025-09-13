import { registry } from "./registry.js";
import path from "path";

export default class Converter {
  constructor({ env, readerClass, writerClass } = {}) {
    this.env = env || (typeof window === "undefined" ? "node" : "browser");
    this.forcedReader = readerClass;
    this.forcedWriter = writerClass;
    this.middleware = [];
  }

  use(fn) {
    this.middleware.push(fn);
    return this; // chainable
  }

  detectType(input) {
    if (typeof input === "string" && input.includes(".")) {
      return path.extname(input).slice(1).toLowerCase();
    }
    if (typeof File !== "undefined" && input instanceof File) {
      return input.name.split(".").pop().toLowerCase();
    }
    if (typeof Blob !== "undefined" && input instanceof Blob && input.name) {
      return input.name.split(".").pop().toLowerCase();
    }
    throw new Error("Unable to detect type — pass { type } explicitly");
  }

  getReader(type) {
    if (this.forcedReader) return new this.forcedReader();
    const ReaderClass = registry.findReader(this.env, type);
    if (!ReaderClass) {
      throw new Error(`No reader registered for type=${type} env=${this.env}`);
    }
    return new ReaderClass();
  }

  getWriter() {
    if (this.forcedWriter) return new this.forcedWriter();
    const WriterClass = registry.findWriter(this.env);
    if (!WriterClass) {
      throw new Error(`No writer registered for db env=${this.env}`);
    }
    return new WriterClass();
  }

  initProgress() {
    this.progress = null;
    this.progress = null;
    this.progressCallback = null;
  }

  emitProgress(progress) {
    var currentProgress = this.progress;

    this.progress = Math.round(progress * 100);

    if (currentProgress === this.progress) {
      return;
    }
    this.progressCallback && this.progressCallback(this.progress);
  }

  async toUint8Array(input) {
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

  async convert(input, { type, progressCallback } = {}) {
    const detectedType = type || this.detectType(input);
    let reader = this.getReader(detectedType);
    let writer = this.getWriter();
    let progress = null;
    
    const emitProgress = (newProgress) => {
      if (!progressCallback) {
        return;
      }
      var prevProgress = progress;

      progress = Math.round(newProgress * 100);

      if (prevProgress === progress) {
        return;
      }
      progressCallback(progress);
    };

    let data = await reader.read(
      await this.toUint8Array(input), 
      { 
        type: detectedType, 
        progressCallback: (progress) => emitProgress(progress * 0.5)
      }
    );

    for (const fn of this.middleware) {
      data = await fn(data);
    }
    return writer.write(
      data, 
      { 
        type: detectedType, 
        progressCallback: (progress) => emitProgress(0.5 + progress * 0.5) 
      }
    );
  }
}
