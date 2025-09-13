import { BaseWriter } from "../../adapters/base-writer.js";
import initSqlJs from "sql.js";
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

/**
 * SQLite writer for the browser, implemented with `sql.js` (WASM).
 *
 * - Creates two tables: `Entities` (entity attributes) and `Hierarchy` (parent-child relations).
 * - Exports a SQLite binary as a `Uint8Array`, suitable for saving or downloading.
 * - Reports progress during row and relation insertion.
 *
 * @extends BaseWriter
 */
export default class SqliteWriter extends BaseWriter {
  /** @type {string[]} Supported output formats */
  static formats = ["db", "db3", "sqlite", "sqlite3"];

  /** @type {string[]} Supported environments */
  static environments = ["browser"];

  /** @type {number} Priority when multiple writers are registered */
  static priority = 10;

  /**
   * Write parsed IFC/FRAG data into a SQLite database in the browser.
   *
   * @param {Object} data - Structured model data.
   * @param {Object.<string, number>} data.columns - Column definitions.  
   *   Keys = column names, values = numeric type codes (1=INTEGER, 2=INTEGER, 3=REAL, else TEXT).
   * @param {Object.<string, Object>} data.rows - Entity rows keyed by ID, each containing column-value pairs.
   * @param {Array<{ancestor: number, descendant: number, depth: number}>} data.relations - Hierarchical relations.
   *
   * @param {Object} options - Write options.
   * @param {(progress: number) => void} [options.progressCallback] - Progress callback (0–1).
   *
   * @returns {Promise<Uint8Array>} SQLite database as a `Uint8Array`.
   */
  async write({ columns, rows, relations }, { progressCallback }) {
    this.initProgress();

    this.totalRows = Object.keys(rows).length;

    this.progressCallback = progressCallback;

    this.emitProgress();

    const SQL = await initSqlJs({
        locateFile: file => wasmUrl
      });

    const db = new SQL.Database();

    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec(`DROP TABLE IF EXISTS Entities;`);
    db.exec(`DROP TABLE IF EXISTS Hierarchy;`);
    db.exec('PRAGMA foreign_keys = ON;');

    const columnNames = Object.keys(columns);

    const keys = {
      ExpressID: 'PRIMARY KEY',
      GlobalId: 'UNIQUE',
    };

    const columnSQLs = [];

    for (const columnName in columns) {
      const columnType = columns[columnName];
      let typeName = 'TEXT';
      let columnKey = keys[columnName] ?? '';

      if (columnType === 1) {
        typeName = 'INTEGER';
      } else if (columnType === 2) {
        typeName = 'INTEGER';
      } else if (columnType === 3) {
        typeName = 'REAEL';
      }
      columnSQLs.push(`"${columnName}" ${typeName} ${columnKey}`);
    }
    const columnsSQL = columnSQLs.join(",\n");

    db.exec(`
      CREATE TABLE Entities (
        ${columnsSQL}
      );
    `);

    db.exec(`
      CREATE TABLE Hierarchy (
        ParentID INTEGER,
        ChildID INTEGER,
        Depth INTEGER,
        FOREIGN KEY(ParentID) REFERENCES Entities(ExpressID),
        FOREIGN KEY(ChildID) REFERENCES Entities(ExpressID)
      );
    `);

    const insertStmt = db.prepare(
      `INSERT INTO Entities (${Array.from(columnNames)
        .map((c) => `"${c}"`)
        .join(',')}) VALUES (${Array.from(columnNames)
        .map(() => '?')
        .join(',')});`
    );

    for (const row of Object.values(rows)) {
      this.processedRows++;

      this.emitProgress();

      const values = Array.from(columnNames).map((c) => row[c] ?? null);
      
      insertStmt.run(values);
    }
    insertStmt.free();

    this.totalRelations = relations.length;

    this.step++;

    for (const relation of relations) {
      this.processedRelations++;

      this.emitProgress();

      try {
        db.run(
          `INSERT INTO Hierarchy (ParentID, ChildID, Depth) VALUES (?, ?, ?);`,
          [relation.ancestor, relation.descendant, relation.depth]
        );
      } catch (e) {}
    }
    const data = db.export();

    db.close();

    return data;
  }

  /**
   * Initialize internal progress counters.
   */
  initProgress() {
    this.step = 1;
    this.totalRows = 0;
    this.processedRows = 0;
    this.totalRelations = 0;
    this.processedRelations = 0;
    this.progressCallback = null;
  }

  /**
   * Emit progress to the callback if defined.
   *
   * - Rows contribute up to 50% of total progress.
   * - Relations contribute up to 50% (after step 2 begins).
   *
   * @private
   */
  emitProgress() {
    if (!this.progressCallback) {
      return;
    }
    const totalRows = this.processedRows / (this.totalRows || 1) * 0.5;
    const totalRelations = this.step >= 2 ? this.processedRelations / (this.totalRelations || 1) * 0.5 : 0;

    this.progressCallback(totalRows + totalRelations);
  }
}
