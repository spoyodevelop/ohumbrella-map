import type { Client } from "@libsql/client";

export async function createCurrentWeatherTable(client: Client): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS current_weather (
      sigungu_code    TEXT PRIMARY KEY,
      sido_code       TEXT NOT NULL,
      name            TEXT NOT NULL,
      time            TEXT NOT NULL,
      pty             INTEGER DEFAULT 0,
      rn1             REAL DEFAULT 0,
      tmp             REAL,
      pop             INTEGER,
      pop_source_time TEXT,
      sky             INTEGER,
      sky_source_time TEXT,
      updated_at      TEXT NOT NULL
    )
  `);
}
