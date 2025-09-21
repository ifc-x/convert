class y {
  constructor() {
    this.readers = [], this.writers = [];
  }
  /**
   * Register a new reader class.
   *
   * @param {Function} readerClass - Reader class to add.
   *   Must define `environments`, `formats`, and `priority` as static fields.
   * @returns {Promise<void>}
   */
  async addReader(e) {
    this.readers.push(e);
  }
  /**
   * Register a new writer class.
   *
   * @param {Function} writerClass - Writer class to add.
   *   Must define `environments`, `formats`, and `priority` as static fields.
   * @returns {Promise<void>}
   */
  async addWriter(e) {
    this.writers.push(e);
  }
  /**
   * Find the most suitable reader for a given environment and input type.
   *
   * Readers are filtered by environment and format, then sorted by descending priority.
   * The highest-priority match is returned.
   *
   * @param {"node"|"browser"} env - Target environment.
   * @param {string} type - Input type/format (e.g., `"ifc"`, `"frag"`).
   * @returns {Function|undefined} Matching reader class, or `undefined` if none found.
   */
  findReader(e, r) {
    return this.readers.filter((s) => s.environments.includes(e) && s.formats.includes(r)).sort((s, t) => t.priority - s.priority)[0];
  }
  /**
   * Find the most suitable writer for a given environment and output format.
   *
   * Writers are filtered by environment and format, then sorted by descending priority.
   * The highest-priority match is returned.
   *
   * @param {"node"|"browser"} env - Target environment.
   * @param {string} [format="sqlite"] - Output format (e.g., `"sqlite"`, `"xlsx"`).
   * @returns {Function|undefined} Matching writer class, or `undefined` if none found.
   */
  findWriter(e, r = "sqlite") {
    return this.writers.filter((s) => s.environments.includes(e) && s.formats.includes(r)).sort((s, t) => t.priority - s.priority)[0];
  }
  /**
   * Find the most compatible reader/writer pair for a given conversion.
   *
   * The method looks up all registered readers that support the given input
   * format and environment, and all writers that support the given output
   * format and environment. It then tries to match them by checking if the
   * reader can produce a data type that the writer can consume. The highest-
   * priority matching pair is returned.
   *
   * @param {"node"|"browser"} env - Target environment in which conversion runs.
   * @param {string} inputFormat - Input format (e.g., `"ifc"`, `"frag"`).
   * @param {string} outputFormat - Output format (e.g., `"sqlite"`, `"xlsx"`).
   * @returns {{
   *   ReaderClass: Function,
   *   WriterClass: Function,
   *   dataType: string
   * } | null} Matching pair with the agreed `dataType`, or `null` if none found.
   */
  findCompatiblePair(e, r, n = "sqlite") {
    const s = this.readers.filter((o) => o.environments.includes(e) && o.formats.includes(r)), t = this.writers.filter((o) => o.environments.includes(e) && o.formats.includes(n));
    for (const o of s.sort((c, a) => a.priority - c.priority))
      for (const c of t.sort((a, d) => d.priority - a.priority)) {
        const a = (o.outputs || []).find((d) => (c.inputs || []).includes(d));
        if (a)
          return { ReaderClass: o, WriterClass: c, dataType: a };
      }
    return null;
  }
}
const l = new y(), g = typeof process < "u" && process?.versions?.node, m = g ? "node" : "browser";
class b {
  /**
   * Create a new Converter instance.
   * @param {Object} [options] - Configuration options.
   * @param {"node"|"browser"} [options.env] - Environment the converter runs in.
   * @param {Function} [options.readerClass] - Forced reader class to use instead of auto-detection.
   * @param {Function} [options.writerClass] - Forced writer class to use instead of auto-detection.
   */
  constructor({ env: e, readerClass: r, writerClass: n } = {}) {
    this.env = e || m, this.forcedReader = r, this.forcedWriter = n, this.middleware = [];
  }
  /**
   * Add a middleware function to transform data during conversion.
   * @param {Function} fn - Middleware function that receives and returns data.
   * @returns {Converter} The converter instance (chainable).
   */
  use(e) {
    return this.middleware.push(e), this;
  }
  /**
   * Get the reader instance for a given type.
   * @param {string} type - The file type to read.
   * @returns {Object} Reader instance.
   * @throws {Error} If no reader is registered for the type.
   */
  getReader(e) {
    if (this.forcedReader) return new this.forcedReader();
    const r = l.findReader(this.env, e);
    if (!r)
      throw new Error(`No reader registered for type=${e} env=${this.env}`);
    return new r();
  }
  /**
   * Get the writer instance.
   * @param {string} type - The file type to write.
   * @returns {Object} Writer instance.
   * @throws {Error} If no writer is registered for the environment.
   */
  getWriter(e) {
    if (this.forcedWriter) return new this.forcedWriter();
    const r = l.findWriter(this.env, e);
    if (!r)
      throw new Error(`No writer registered for type=${e} env=${this.env}`);
    return new r();
  }
  /**
   * Initialize progress tracking.
   */
  initProgress() {
    this.progress = null, this.progressCallback = null;
  }
  /**
   * Emit progress to the registered progress callback.
   * @param {number} progress - Progress as a decimal (0–1).
   */
  emitProgress(e) {
    var r = this.progress;
    this.progress = Math.round(e * 100), r !== this.progress && this.progressCallback && this.progressCallback(this.progress);
  }
  /**
   * Convert a file or buffer to the desired output format using optional middleware.
   * @param {Uint8Array} input - Input data.
   * @param {Object} [options] - Conversion options.
   * @param {string} [options.type] - Explicit type of the input.
   * @param {Function} [options.progressCallback] - Callback for progress updates (0–100).
   * @returns {Promise<Uint8Array>} Converted output as a Uint8Array.
   */
  async convert(e, { inputType: r, outputType: n, progressCallback: s } = {}) {
    const t = r, o = n;
    this.progressCallback = s;
    const c = l.findCompatiblePair(this.env, t, o);
    if (!c)
      throw new Error(`No compatible reader/writer for ${t} → ${o}`);
    const { ReaderClass: a, WriterClass: d, dataType: u } = c, h = new a(), w = new d();
    let p = await h.read(
      e,
      { type: u, progressCallback: (f) => this.emitProgress(f * 0.5) }
    );
    for (const f of this.middleware)
      p = await f(p);
    return w.write(
      p,
      { type: u, progressCallback: (f) => this.emitProgress(0.5 + f * 0.5) }
    );
  }
}
async function v(i) {
  if (i instanceof Uint8Array)
    return i;
  if (i instanceof ArrayBuffer)
    return new Uint8Array(i);
  if (typeof i == "string") {
    const r = await (await fetch(i)).arrayBuffer();
    return new Uint8Array(r);
  }
  if (typeof File < "u" && i instanceof File || typeof Blob < "u" && i instanceof Blob) {
    const e = await i.arrayBuffer();
    return new Uint8Array(e);
  }
  throw new Error("Cannot convert input to Uint8Array");
}
function k(i) {
  if (typeof i == "string" && i.includes("."))
    return i.split(".").pop().toLowerCase();
  if (typeof File < "u" && i instanceof File || typeof Blob < "u" && i instanceof Blob && i.name)
    return i.name.split(".").pop().toLowerCase();
  throw new Error("Unable to detect type — pass { type } explicitly");
}
async function B(i, e = {}) {
  const { middleware: r = [], readerClass: n, writerClass: s, env: t, outputType: o, progressCallback: c } = e;
  let { inputType: a } = e;
  a ||= k(i);
  const d = new b({ env: t, readerClass: n, writerClass: s });
  return r.forEach((u) => d.use(u)), d.convert(await v(i), { inputType: a, outputType: o, progressCallback: c });
}
class C {
  static formats = ["ifc"];
  static environments = ["browser"];
  static priority = 10;
  static outputs = ["tabular", "ifc"];
  constructor() {
    this.worker = new Worker(new URL(
      /* @vite-ignore */
      "/assets/ifc-reader-worker-CIdLR5ic.js",
      import.meta.url
    ), {
      type: "module"
    }), this.requestId = 0, this.pending = /* @__PURE__ */ new Map(), this.worker.onmessage = (e) => {
      const { id: r, result: n = null, error: s = null, progress: t = null } = e.data, { resolve: o, reject: c, progressCallback: a } = this.pending.get(r);
      if (t !== null) {
        a(t);
        return;
      }
      this.pending.delete(r), s ? c(new Error(s)) : o(n);
    };
  }
  read(e, { type: r, progressCallback: n } = {}) {
    return r == "ifc" ? e : (n ||= () => {
    }, new Promise(async (s, t) => {
      try {
        const o = this.requestId++;
        this.pending.set(o, { resolve: s, reject: t, progressCallback: n }), this.worker.postMessage({ id: o, buffer: e.buffer }, [e.buffer]);
      } catch (o) {
        t(o);
      }
    }));
  }
}
class R {
  static formats = ["frag"];
  static environments = ["browser"];
  static priority = 10;
  static outputs = ["tabular"];
  constructor() {
    this.worker = new Worker(new URL(
      /* @vite-ignore */
      "/assets/frag-reader-worker-DBG-HGDV.js",
      import.meta.url
    ), {
      type: "module"
    }), this.requestId = 0, this.pending = /* @__PURE__ */ new Map(), this.worker.onmessage = (e) => {
      const { id: r, result: n = null, error: s = null, progress: t = null } = e.data, { resolve: o, reject: c, progressCallback: a } = this.pending.get(r);
      if (t !== null) {
        a(t);
        return;
      }
      this.pending.delete(r), s ? c(new Error(s)) : o(n);
    };
  }
  read(e, { progressCallback: r } = {}) {
    return r ||= () => {
    }, new Promise(async (n, s) => {
      try {
        const t = this.requestId++;
        this.pending.set(t, { resolve: n, reject: s, progressCallback: r }), this.worker.postMessage({ id: t, buffer: e.buffer }, [e.buffer]);
      } catch (t) {
        s(t);
      }
    });
  }
}
class W {
  static formats = ["frag"];
  static environments = ["browser"];
  static priority = 10;
  static inputs = ["ifc"];
  constructor() {
    this.worker = new Worker(new URL(
      /* @vite-ignore */
      "/assets/frag-writer-worker-DuXh9UCh.js",
      import.meta.url
    ), {
      type: "module"
    }), this.requestId = 0, this.pending = /* @__PURE__ */ new Map(), this.worker.onmessage = (e) => {
      const { id: r, result: n = null, error: s = null, progress: t = null } = e.data, { resolve: o, reject: c, progressCallback: a } = this.pending.get(r);
      if (t !== null) {
        a(t);
        return;
      }
      this.pending.delete(r), s ? c(new Error(s)) : o(n);
    };
  }
  write(e, { progressCallback: r } = {}) {
    return r ||= () => {
    }, new Promise(async (n, s) => {
      try {
        const t = this.requestId++;
        this.pending.set(t, { resolve: n, reject: s, progressCallback: r }), this.worker.postMessage({ id: t, input: e });
      } catch (t) {
        s(t);
      }
    });
  }
}
class q {
  static formats = ["db", "db3", "sqlite", "sqlite3"];
  static environments = ["browser"];
  static priority = 10;
  static inputs = ["tabular"];
  constructor() {
    this.worker = new Worker(new URL(
      /* @vite-ignore */
      "/assets/sqlite-writer-worker-Btyf4S85.js",
      import.meta.url
    ), {
      type: "module"
    }), this.requestId = 0, this.pending = /* @__PURE__ */ new Map(), this.worker.onmessage = (e) => {
      const { id: r, result: n = null, error: s = null, progress: t = null } = e.data, { resolve: o, reject: c, progressCallback: a } = this.pending.get(r);
      if (t !== null) {
        a(t);
        return;
      }
      this.pending.delete(r), s ? c(new Error(s)) : o(n);
    };
  }
  write(e, { progressCallback: r } = {}) {
    return r ||= () => {
    }, new Promise(async (n, s) => {
      try {
        const t = this.requestId++;
        this.pending.set(t, { resolve: n, reject: s, progressCallback: r }), this.worker.postMessage({ id: t, input: e });
      } catch (t) {
        s(t);
      }
    });
  }
}
l.addReader(C);
l.addReader(R);
l.addWriter(W);
l.addWriter(q);
export {
  b as Converter,
  B as convert,
  l as registry
};
