/**
 * Registry for managing available readers and writers.
 * 
 * A reader is responsible for parsing input formats (e.g., IFC, FRAG),
 * while a writer is responsible for serializing the parsed data to an output format
 * (e.g., SQLite, Excel).
 *
 * Each reader/writer class must define:
 * - `static environments: string[]` – environments supported (`["node"]`, `["browser"]`, or both).
 * - `static formats: string[]` – supported formats (e.g., `["ifc"]`, `["frag"]`, `["sqlite"]`).
 * - `static priority: number` – numeric priority (higher wins when multiple matches).
 */
class Registry {
  constructor() {
    /**
     * Registered reader classes.
     * @type {Function[]}
     */
    this.readers = [];

    /**
     * Registered writer classes.
     * @type {Function[]}
     */
    this.writers = [];
  }

  /**
   * Register a new reader class.
   *
   * @param {Function} readerClass - Reader class to add.
   *   Must define `environments`, `formats`, and `priority` as static fields.
   * @returns {Promise<void>}
   */
  async addReader(readerClass) {
    this.readers.push(readerClass);
  }

  /**
   * Register a new writer class.
   *
   * @param {Function} writerClass - Writer class to add.
   *   Must define `environments`, `formats`, and `priority` as static fields.
   * @returns {Promise<void>}
   */
  async addWriter(writerClass) {
    this.writers.push(writerClass);
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
  findReader(env, type) {
    const matches = this.readers
      .filter(r => r.environments.includes(env) && r.formats.includes(type))
      .sort((a, b) => b.priority - a.priority);
    return matches[0];
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
  findWriter(env, format = "sqlite") {
    const matches = this.writers
      .filter(w => w.environments.includes(env) && w.formats.includes(format))
      .sort((a, b) => b.priority - a.priority);

    return matches[0];
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
  findCompatiblePair(env, inputFormat, outputFormat = "sqlite") {
    const readers = this.readers
      .filter(r => r.environments.includes(env) && r.formats.includes(inputFormat));

    const writers = this.writers
      .filter(w => w.environments.includes(env) && w.formats.includes(outputFormat));

    for (const ReaderClass of readers.sort((a, b) => b.priority - a.priority)) {
      for (const WriterClass of writers.sort((a, b) => b.priority - a.priority)) {
        const type = (ReaderClass.outputs || []).find(t => (WriterClass.inputs || []).includes(t));

        if (type) {
          return { ReaderClass, WriterClass, dataType: type };
        }
      }
    }
    return null;
  }
}

/**
 * Global singleton registry used by default.
 * @type {Registry}
 */
export const registry = new Registry();
