/**
 * SQLite-backed config store using better-sqlite3.
 * Stores JSON values keyed by string name.
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

export class ConfigStore {
  private db: DatabaseType;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
  }

  get(key: string): unknown {
    const row = this.db
      .prepare('SELECT value FROM config WHERE key = ?')
      .get(key) as { value: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.value) as unknown;
  }

  set(key: string, value: unknown): void {
    this.db
      .prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
      .run(key, JSON.stringify(value));
  }

  getAll(): Record<string, unknown> {
    const rows = this.db
      .prepare('SELECT key, value FROM config')
      .all() as Array<{ key: string; value: string }>;
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = JSON.parse(row.value) as unknown;
    }
    return result;
  }

  delete(key: string): void {
    this.db.prepare('DELETE FROM config WHERE key = ?').run(key);
  }

  close(): void {
    this.db.close();
  }
}
