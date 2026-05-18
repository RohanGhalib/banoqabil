#!/usr/bin/env node
/**
 * scripts/seed-sqlite.js
 * Seeds students from Bano_Qabil_Enrollment_Manager.html into SQLite/Turso.
 * Run: npm run seed
 */

const { createClient } = require('@libsql/client');
const { loadEnvConfig } = require('@next/env');
const fs = require('fs');
const path = require('path');

loadEnvConfig(process.cwd());

const url = process.env.TURSO_DATABASE_URL || 'file:./data/banoqabil.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

const db = createClient({ url, authToken });

async function main() {
  console.log(`\n🗄️  Connecting to: ${url}\n`);

  // ── Create tables ───────────────────────────────────────────────────────────
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS students (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      gender      TEXT NOT NULL DEFAULT 'Male',
      interviewed TEXT NOT NULL DEFAULT 'No',
      deposit     TEXT NOT NULL DEFAULT 'No',
      batch1      TEXT NOT NULL DEFAULT 'No',
      priority    INTEGER NOT NULL DEFAULT 4,
      status      TEXT NOT NULL DEFAULT '',
      enrolled    INTEGER NOT NULL DEFAULT 0,
      campusId    TEXT, roomId TEXT, slotKey TEXT, courseCode TEXT,
      createdAt   TEXT DEFAULT (datetime('now'))
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
  `);
  console.log('✅ Tables ready');

  // ── Parse students from HTML ────────────────────────────────────────────────
  const htmlPath = path.join(process.cwd(), 'raw_html', 'Bano_Qabil_Enrollment_Manager.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Extract the JS array embedded in the HTML
  const match = html.match(/let students\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) {
    console.error('❌ Could not find student data array in HTML');
    process.exit(1);
  }

  const students = JSON.parse(match[1]);
  console.log(`📋 Parsed ${students.length} students from HTML`);

  // ── Batch insert students ───────────────────────────────────────────────────
  let added = 0, skipped = 0;
  const BATCH = 100;

  for (let i = 0; i < students.length; i += BATCH) {
    const chunk = students.slice(i, i + BATCH);
    const statements = chunk.map(s => {
      const sid = String(s.id).trim();
      return {
        sql: `INSERT OR IGNORE INTO students (id, name, gender, interviewed, deposit, batch1, priority, status, enrolled)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        args: [
          sid,
          (s.name || 'Unknown').trim(),
          s.gender || 'Male',
          s.interviewed || 'No',
          s.deposit || 'No',
          s.batch1 || 'No',
          Number(s.priority) || 4,
          s.status || '',
        ],
      };
    });

    try {
      const results = await db.batch(statements, 'write');
      results.forEach(res => {
        if (res.rowsAffected > 0) added++; else skipped++;
      });
    } catch (err) {
      console.error(`\n❌ Batch insertion failed for chunk starting at index ${i}:`, err);
    }
    process.stdout.write(`\r  Inserted ${Math.min(i + BATCH, students.length)} / ${students.length}...`);
  }
  console.log(`\n✅ Students: ${added} added, ${skipped} skipped (duplicates)`);

  // ── Seed default timetable slots ────────────────────────────────────────────
  const defaults = {
    'ds-lab1': {
      '0-0':{ course:'GD', gender:'M', cap:50 }, '0-1':{ course:'GD', gender:'F', cap:50 },
      '0-2':{ course:'VE', gender:'F', cap:50 }, '0-3':{ course:'VE', gender:'M', cap:50 },
      '1-0':{ course:'CS', gender:'M', cap:50 }, '1-1':{ course:'CS', gender:'F', cap:50 },
      '1-2':{ course:'WD', gender:'F', cap:50 }, '1-3':{ course:'WD', gender:'M', cap:50 },
      '2-0':{ course:'CS', gender:'M', cap:50 }, '2-1':{ course:'CS', gender:'F', cap:50 },
      '2-2':{ course:'GD', gender:'F', cap:50 }, '2-3':{ course:'GD', gender:'M', cap:50 },
    },
    'ds-lab2': {
      '0-0':{ course:'VE', gender:'M', cap:40 }, '0-1':{ course:'VE', gender:'F', cap:40 },
      '1-0':{ course:'CS', gender:'M', cap:40 }, '1-1':{ course:'CS', gender:'F', cap:40 },
      '2-0':{ course:'WD', gender:'M', cap:40 }, '2-1':{ course:'WD', gender:'F', cap:40 },
    },
    'ds-cls': {
      '0-0':{ course:'DM', gender:'M', cap:50 }, '0-1':{ course:'DM', gender:'F', cap:50 },
      '0-2':{ course:'AiE', gender:'F', cap:50 }, '0-3':{ course:'AiE', gender:'M', cap:50 },
      '1-0':{ course:'DM', gender:'M', cap:50 }, '1-1':{ course:'DM', gender:'F', cap:50 },
      '1-2':{ course:'AiE', gender:'F', cap:50 }, '1-3':{ course:'AiE', gender:'M', cap:50 },
      '2-0':{ course:'DM', gender:'M', cap:50 }, '2-1':{ course:'DM', gender:'F', cap:50 },
      '2-2':{ course:'AiE', gender:'F', cap:50 }, '2-3':{ course:'AiE', gender:'M', cap:50 },
    },
    'ic-lab': {
      '0-0':{ course:'GD', gender:'M', cap:35 }, '0-1':{ course:'GD', gender:'F', cap:35 },
      '0-2':{ course:'VE', gender:'F', cap:35 }, '0-3':{ course:'VE', gender:'M', cap:35 },
      '1-0':{ course:'CS', gender:'M', cap:35 }, '1-1':{ course:'CS', gender:'F', cap:35 },
      '2-0':{ course:'WD', gender:'M', cap:35 }, '2-1':{ course:'WD', gender:'F', cap:35 },
    },
    'ic-cls': {
      '0-0':{ course:'DM', gender:'M', cap:45 }, '0-1':{ course:'DM', gender:'F', cap:45 },
      '0-2':{ course:'AiE', gender:'F', cap:45 }, '0-3':{ course:'AiE', gender:'M', cap:45 },
      '1-0':{ course:'DM', gender:'M', cap:45 }, '1-1':{ course:'DM', gender:'F', cap:45 },
      '1-2':{ course:'AiE', gender:'F', cap:45 }, '1-3':{ course:'AiE', gender:'M', cap:45 },
      '2-0':{ course:'DM', gender:'M', cap:45 }, '2-1':{ course:'DM', gender:'F', cap:45 },
      '2-2':{ course:'AiE', gender:'F', cap:45 }, '2-3':{ course:'AiE', gender:'M', cap:45 },
    },
  };
  const campusOf = { 'ds-lab1':'ds','ds-lab2':'ds','ds-cls':'ds','ic-lab':'ic','ic-cls':'ic' };

  let slotCount = 0;
  for (const [roomId, slotMap] of Object.entries(defaults)) {
    const campusId = campusOf[roomId];
    for (const [slotKey, s] of Object.entries(slotMap)) {
      const id = `${campusId}-${roomId}-${slotKey}`;
      await db.execute({
        sql: `INSERT OR IGNORE INTO slots (id, campusId, roomId, slotKey, course, gender, capacity)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [id, campusId, roomId, slotKey, s.course, s.gender, s.cap],
      });
      slotCount++;
    }
  }
  console.log(`✅ Slots: ${slotCount} default timetable slots seeded`);
  console.log('\n🎉 Seed complete!\n');
  process.exit(0);
}

main().catch(err => { console.error('❌ Seed failed:', err); process.exit(1); });
