import { BaseWriter } from "../../adapters/base-writer.js";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * SQLite writer for persisting IFC/FRAG data into a relational database file.
 *
 * - Creates two tables: `Entities` (attributes) and `Hierarchy` (parent-child relations).
 * - Supports progress tracking during row and relation insertion.
 * - Produces a `Uint8Array` of the final SQLite file contents.
 *
 * @extends BaseWriter
 */
export default class SqliteWriter extends BaseWriter {
  /** @type {string[]} Supported output formats */
  static formats = ["db", "db3", "sqlite", "sqlite3"];

  /** @type {string[]} Supported environments */
  static environments = ["node"];

  /** @type {number} Priority when multiple writers are registered */
  static priority = 10;

  /** @type {string[]} Supported input types */
  static inputs = ["tabular"];

  /**
   * Write parsed data into a SQLite database file.
   *
   * @param {Object} data - Structured model data.
   * @param {Object.<string, number>} data.columns - Column definitions where keys are column names and values are numeric type codes (1=INTEGER, 2=INTEGER, 3=REAL, else TEXT).
   * @param {Object.<string, Object>} data.rows - Entity rows keyed by ID, each containing column-value pairs.
   * @param {Array<{ancestor: number, descendant: number, depth: number}>} data.relations - Hierarchical relations between entities.
   *
   * @param {Object} options - Write options.
   * @param {(progress: number) => void} [options.progressCallback] - Progress callback (0–1).
   *
   * @returns {Promise<Uint8Array>} SQLite file contents as a `Uint8Array`.
   */
  async write({ columns, rows, relations }, { progressCallback }) {
    this.initProgress();

    this.totalRows = Object.keys(rows).length;
    this.progressCallback = progressCallback;
    this.emitProgress();

    const db = await open({
      filename: ":memory:",
      driver: sqlite3.Database,
    });

    await db.exec("PRAGMA foreign_keys = OFF;");
    await db.exec("DROP TABLE IF EXISTS Entities;");
    await db.exec("DROP TABLE IF EXISTS Hierarchy;");
    await db.exec("PRAGMA foreign_keys = ON;");

    const columnNames = Object.keys(columns);

    const keys = {
      ExpressID: "PRIMARY KEY",
      GlobalId: "UNIQUE",
    };

    // Build SQL column definitions
    const columnSQLs = [];
    for (const columnName in columns) {
      const columnType = columns[columnName];
      let typeName = "TEXT";
      let columnKey = keys[columnName] ?? "";

      if (columnType === 1) {
        typeName = "INTEGER";
      } else if (columnType === 2) {
        typeName = "INTEGER";
      } else if (columnType === 3) {
        typeName = "REAL";
      }
      columnSQLs.push(`"${columnName}" ${typeName} ${columnKey}`);
    }
    const columnsSQL = columnSQLs.join(",\n");

    await db.exec(`
      CREATE TABLE Entities (
        ${columnsSQL}
      );
    `);

    await db.exec(`
      CREATE TABLE Hierarchy (
        ParentID INTEGER,
        ChildID INTEGER,
        Depth INTEGER,
        FOREIGN KEY(ParentID) REFERENCES Entities(ExpressID),
        FOREIGN KEY(ChildID) REFERENCES Entities(ExpressID)
      );
    `);

    const insertStmt = await db.prepare(
      `INSERT INTO Entities (${columnNames.map((c) => `"${c}"`).join(",")})
       VALUES (${columnNames.map(() => "?").join(",")});`
    );

    for (const row of Object.values(rows)) {
      this.processedRows++;
      this.emitProgress();

      const values = columnNames.map((c) => row[c] ?? null);
      await insertStmt.run(...values);
    }
    await insertStmt.finalize();

    // Insert relations
    this.totalRelations = relations.length;
    this.step++;
    for (const relation of relations) {
      this.processedRelations++;
      this.emitProgress();
      try {
        await db.run(
          `INSERT INTO Hierarchy (ParentID, ChildID, Depth) VALUES (?, ?, ?);`,
          relation.ancestor,
          relation.descendant,
          relation.depth
        );
      } catch (e) {
        // skip duplicate/invalid relation errors
      }
    }

    const tempFilePath = join(tmpdir(), `tempdb-${Date.now()}.sqlite`);
    await new Promise((resolve, reject) => {
      const backup = db.getDatabaseInstance().backup(tempFilePath);
      backup.step(-1, function (err) {
        if (err) {
          reject(err);
          return;
        }
        backup.finish(function (err) {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });

    const data = new Uint8Array(readFileSync(tempFilePath));

    await db.close();
    
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
    if (!this.progressCallback) return;

    const totalRows = (this.processedRows / (this.totalRows || 1)) * 0.5;
    const totalRelations =
      this.step >= 2
        ? (this.processedRelations / (this.totalRelations || 1)) * 0.5
        : 0;

    this.progressCallback(totalRows + totalRelations);
  }
}
