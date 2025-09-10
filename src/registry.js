class Registry {
  constructor() {
    this.readers = [];
    this.writers = [];
  }

  async addReader(readerClass) {
    this.readers.push(readerClass);
  }

  async addWriter(writerClass) {
    this.writers.push(writerClass);
  }

  findReader(env, type) {
    const matches = this.readers
      .filter(r => r.environments.includes(env) && r.formats.includes(type))
      .sort((a, b) => b.priority - a.priority);
    return matches[0];
  }

  findWriter(env, format = "db") {
    const matches = this.writers
      .filter(w => w.environments.includes(env) && w.formats.includes(format))
      .sort((a, b) => b.priority - a.priority);
    return matches[0];
  }
}

export const registry = new Registry();
