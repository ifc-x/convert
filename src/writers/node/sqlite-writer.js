import { BaseWriter } from "../../adapters/base-writer.js";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from 'fs';
import os from 'os';
import path from 'path';

export default class SqliteWriter extends BaseWriter {
  static formats = ["db", "db3", "sqlite", "sqlite3"];
  static environments = ["node"];
  static priority = 10;

  async write({ columns, rows, relations }, { progressCallback }) {
    this.initProgress();

    this.totalRows = Object.keys(rows).length;

    this.progressCallback = progressCallback;

    this.emitProgress();

    const db = await open({
      filename: ':memory:',
      driver: sqlite3.Database,
    });

    await db.exec('PRAGMA foreign_keys = OFF;');
    await db.exec(`DROP TABLE IF EXISTS Entities;`);
    await db.exec(`DROP TABLE IF EXISTS Hierarchy;`);
    await db.exec('PRAGMA foreign_keys = ON;');

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
      await insertStmt.run(...values);
    }
    await insertStmt.finalize();

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
      } catch (e) {}
    }

    const tempFilePath = path.join(os.tmpdir(), `tempdb-${Date.now()}.sqlite`);

    await new Promise((resolve, reject) => {
      const backup = db.getDatabaseInstance().backup(tempFilePath);

      backup.step(-1, function(err) {
        if (err) {
          reject(err);
          return;
        }
        backup.finish(function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });

    const data = new Uint8Array(fs.readFileSync(tempFilePath));

    await db.close();
    
    return data;
  }

  initProgress() {
    this.step = 1;
    this.totalRows = 0;
    this.processedRows = 0;
    this.totalRelations = 0;
    this.processedRelations = 0;
    this.progressCallback = null;
  }

  emitProgress() {
    if (!this.progressCallback) {
      return;
    }
    const totalRows = this.processedRows / (this.totalRows || 1) * 0.5;
    const totalRelations = this.step >= 2 ? this.processedRelations / (this.totalRelations || 1) * 0.5 : 0;

    this.progressCallback(totalRows + totalRelations);
  }
}
