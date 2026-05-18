import { createClient } from '@libsql/client';

// ─── Connection ────────────────────────────────────────────────────────────────
// Local dev  : TURSO_DATABASE_URL=file:./data/banoqabil.db  (no auth token)
// Vercel/Prod: TURSO_DATABASE_URL=libsql://...turso.io  + TURSO_AUTH_TOKEN=...
const url = process.env.TURSO_DATABASE_URL ?? 'file:./data/banoqabil.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = createClient({ url, authToken });

// ─── Schema Migration (runs on first import) ───────────────────────────────────
// This is idempotent — safe to call on every cold start.
export async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS students (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      gender     TEXT NOT NULL DEFAULT 'Male',
      interviewed TEXT NOT NULL DEFAULT 'No',
      deposit    TEXT NOT NULL DEFAULT 'No',
      batch1     TEXT NOT NULL DEFAULT 'No',
      priority   INTEGER NOT NULL DEFAULT 4,
      status     TEXT NOT NULL DEFAULT '',
      enrolled   INTEGER NOT NULL DEFAULT 0,
      campusId   TEXT,
      roomId     TEXT,
      slotKey    TEXT,
      courseCode TEXT,
      createdAt  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS slots (
      id        TEXT PRIMARY KEY,
      campusId  TEXT NOT NULL,
      roomId    TEXT NOT NULL,
      slotKey   TEXT NOT NULL,
      course    TEXT NOT NULL,
      gender    TEXT NOT NULL DEFAULT 'M',
      capacity  INTEGER NOT NULL DEFAULT 50,
      UNIQUE(campusId, roomId, slotKey)
    );

    CREATE INDEX IF NOT EXISTS idx_students_priority ON students(priority);
    CREATE INDEX IF NOT EXISTS idx_students_enrolled ON students(enrolled);
    CREATE INDEX IF NOT EXISTS idx_students_gender   ON students(gender);
    CREATE INDEX IF NOT EXISTS idx_slots_campus      ON slots(campusId);
  `);
}

// ─── Seed default slots from original HTML timetable ──────────────────────────
// Matches the defaults object in bano_qabil_batch2_timetable.html exactly.
export async function seedDefaultSlots() {
  const defaults: Record<string, Record<string, { course: string; gender: string; cap: number }>> = {
    'ds-lab1': {
      '0-0': { course: 'GD', gender: 'M', cap: 50 }, '0-1': { course: 'GD', gender: 'F', cap: 50 },
      '0-2': { course: 'VE', gender: 'F', cap: 50 }, '0-3': { course: 'VE', gender: 'M', cap: 50 },
      '1-0': { course: 'CS', gender: 'M', cap: 50 }, '1-1': { course: 'CS', gender: 'F', cap: 50 },
      '1-2': { course: 'WD', gender: 'F', cap: 50 }, '1-3': { course: 'WD', gender: 'M', cap: 50 },
      '2-0': { course: 'CS', gender: 'M', cap: 50 }, '2-1': { course: 'CS', gender: 'F', cap: 50 },
      '2-2': { course: 'GD', gender: 'F', cap: 50 }, '2-3': { course: 'GD', gender: 'M', cap: 50 },
    },
    'ds-lab2': {
      '0-0': { course: 'VE', gender: 'M', cap: 40 }, '0-1': { course: 'VE', gender: 'F', cap: 40 },
      '1-0': { course: 'CS', gender: 'M', cap: 40 }, '1-1': { course: 'CS', gender: 'F', cap: 40 },
      '2-0': { course: 'WD', gender: 'M', cap: 40 }, '2-1': { course: 'WD', gender: 'F', cap: 40 },
    },
    'ds-cls': {
      '0-0': { course: 'DM', gender: 'M', cap: 50 }, '0-1': { course: 'DM', gender: 'F', cap: 50 },
      '0-2': { course: 'AiE', gender: 'F', cap: 50 }, '0-3': { course: 'AiE', gender: 'M', cap: 50 },
      '1-0': { course: 'DM', gender: 'M', cap: 50 }, '1-1': { course: 'DM', gender: 'F', cap: 50 },
      '1-2': { course: 'AiE', gender: 'F', cap: 50 }, '1-3': { course: 'AiE', gender: 'M', cap: 50 },
      '2-0': { course: 'DM', gender: 'M', cap: 50 }, '2-1': { course: 'DM', gender: 'F', cap: 50 },
      '2-2': { course: 'AiE', gender: 'F', cap: 50 }, '2-3': { course: 'AiE', gender: 'M', cap: 50 },
    },
    'ic-lab': {
      '0-0': { course: 'GD', gender: 'M', cap: 35 }, '0-1': { course: 'GD', gender: 'F', cap: 35 },
      '0-2': { course: 'VE', gender: 'F', cap: 35 }, '0-3': { course: 'VE', gender: 'M', cap: 35 },
      '1-0': { course: 'CS', gender: 'M', cap: 35 }, '1-1': { course: 'CS', gender: 'F', cap: 35 },
      '2-0': { course: 'WD', gender: 'M', cap: 35 }, '2-1': { course: 'WD', gender: 'F', cap: 35 },
    },
    'ic-cls': {
      '0-0': { course: 'DM', gender: 'M', cap: 45 }, '0-1': { course: 'DM', gender: 'F', cap: 45 },
      '0-2': { course: 'AiE', gender: 'F', cap: 45 }, '0-3': { course: 'AiE', gender: 'M', cap: 45 },
      '1-0': { course: 'DM', gender: 'M', cap: 45 }, '1-1': { course: 'DM', gender: 'F', cap: 45 },
      '1-2': { course: 'AiE', gender: 'F', cap: 45 }, '1-3': { course: 'AiE', gender: 'M', cap: 45 },
      '2-0': { course: 'DM', gender: 'M', cap: 45 }, '2-1': { course: 'DM', gender: 'F', cap: 45 },
      '2-2': { course: 'AiE', gender: 'F', cap: 45 }, '2-3': { course: 'AiE', gender: 'M', cap: 45 },
    },
  };

  const campusOf: Record<string, string> = {
    'ds-lab1': 'ds', 'ds-lab2': 'ds', 'ds-cls': 'ds',
    'ic-lab': 'ic', 'ic-cls': 'ic',
  };

  for (const [roomId, slotMap] of Object.entries(defaults)) {
    const campusId = campusOf[roomId];
    for (const [slotKey, s] of Object.entries(slotMap)) {
      const id = `${campusId}-${roomId}-${slotKey}`;
      await db.execute({
        sql: `INSERT OR IGNORE INTO slots (id, campusId, roomId, slotKey, course, gender, capacity)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [id, campusId, roomId, slotKey, s.course, s.gender, s.cap],
      });
    }
  }
}
