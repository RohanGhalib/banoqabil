import { NextRequest, NextResponse } from 'next/server';
import { db, initDb } from '@/lib/db';

// GET: paginated, filtered, searchable student list
export async function GET(req: NextRequest) {
  await initDb();
  const { searchParams } = new URL(req.url);
  const search   = searchParams.get('search')?.toLowerCase().trim() || '';
  const filter   = searchParams.get('filter') || 'all';
  const page     = Math.max(1, parseInt(searchParams.get('page')     || '1'));
  const pageSize = Math.min(200, parseInt(searchParams.get('pageSize') || '50'));

  try {
    // Build WHERE clauses
    const conditions: string[] = [];
    const args: any[]          = [];

    if (filter === 'p1') { conditions.push('priority = 1'); }
    else if (filter === 'p2') { conditions.push('priority = 2'); }
    else if (filter === 'p3') { conditions.push('priority = 3'); }
    else if (filter === 'p4') { conditions.push('priority = 4'); }
    else if (filter === 'enrolled') { conditions.push('enrolled = 1'); }
    else if (filter === 'male')   { conditions.push("gender = 'Male'"); }
    else if (filter === 'female') { conditions.push("gender = 'Female'"); }

    if (search) {
      conditions.push('(lower(id) LIKE ? OR lower(name) LIKE ?)');
      args.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    const [countRes, rowsRes] = await Promise.all([
      db.execute({ sql: `SELECT COUNT(*) as cnt FROM students ${where}`, args }),
      db.execute({ sql: `SELECT * FROM students ${where} ORDER BY priority ASC, id ASC LIMIT ? OFFSET ?`, args: [...args, pageSize, offset] }),
    ]);

    const totalCount = Number((countRes.rows[0] as any).cnt);
    const students = rowsRes.rows.map(r => ({
      id:         r.id,
      name:       r.name,
      gender:     r.gender,
      interviewed:r.interviewed,
      deposit:    r.deposit,
      batch1:     r.batch1,
      priority:   Number(r.priority),
      status:     r.status,
      enrolled:   Boolean(Number(r.enrolled)),
      campusId:   r.campusId,
      roomId:     r.roomId,
      slotKey:    r.slotKey,
      courseCode: r.courseCode,
    }));

    return NextResponse.json({ success: true, students, totalCount, page, pageSize, totalPages: Math.ceil(totalCount / pageSize) });
  } catch (err: any) {
    console.error('[GET /api/students]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: add single student OR bulk array
export async function POST(req: NextRequest) {
  await initDb();
  try {
    const body = await req.json();

    if (Array.isArray(body)) {
      // Bulk insert
      let added = 0, duplicates = 0;
      for (const s of body) {
        const sid = String(s.id).trim();
        const res = await db.execute({
          sql: `INSERT OR IGNORE INTO students (id, name, gender, interviewed, deposit, batch1, priority, status, enrolled)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          args: [sid, s.name || 'Unknown', s.gender || 'Male', s.interviewed || 'No', s.deposit || 'No', s.batch1 || 'No', Number(s.priority) || 4, s.status || ''],
        });
        if (res.rowsAffected > 0) added++; else duplicates++;
      }
      return NextResponse.json({ success: true, added, duplicates });
    }

    // Single student
    const { id, name, gender, priority, interviewed, deposit, status } = body;
    if (!id || !name || !gender) return NextResponse.json({ success: false, error: 'ID, Name, and Gender are required.' }, { status: 400 });

    const res = await db.execute({
      sql: `INSERT OR IGNORE INTO students (id, name, gender, interviewed, deposit, batch1, priority, status, enrolled)
            VALUES (?, ?, ?, ?, ?, 'No', ?, ?, 0)`,
      args: [String(id).trim(), name.trim(), gender, interviewed || 'No', deposit || 'No', Number(priority) || 4, status?.trim() || 'Manually added'],
    });

    if (res.rowsAffected === 0) return NextResponse.json({ success: false, error: 'Student ID already exists.' }, { status: 409 });
    return NextResponse.json({ success: true, message: 'Student added.' });
  } catch (err: any) {
    console.error('[POST /api/students]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
