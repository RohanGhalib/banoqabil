import { NextRequest, NextResponse } from 'next/server';
import { db, initDb, seedDefaultSlots } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: all slots enriched with live roster counts via a single SQL JOIN
export async function GET() {
  await initDb();
  try {
    // Fetch all slots
    const slotsRes = await db.execute('SELECT * FROM slots');

    // Fetch enrolled students grouped for fast lookup
    const studentsRes = await db.execute(
      `SELECT id, name, gender, priority, status, roomId, slotKey
       FROM students WHERE enrolled = 1`
    );

    const enrolled = studentsRes.rows;

    // Enrich each slot with counts and roster
    const slots = slotsRes.rows.map((slot: any) => {
      const roster = enrolled.filter(
        (s: any) => s.roomId === slot.roomId && s.slotKey === slot.slotKey
      );
      return {
        id:           slot.id,
        campusId:     slot.campusId,
        roomId:       slot.roomId,
        slotKey:      slot.slotKey,
        course:       slot.course,
        gender:       slot.gender,
        capacity:     Number(slot.capacity),
        enrolledCount:roster.length,
        maleCount:    roster.filter((s: any) => s.gender === 'Male').length,
        femaleCount:  roster.filter((s: any) => s.gender === 'Female').length,
        roster: roster.map((s: any) => ({
          id: s.id, name: s.name, gender: s.gender,
          priority: Number(s.priority), status: s.status,
        })),
      };
    });

    return NextResponse.json({ success: true, slots });
  } catch (err: any) {
    console.error('[GET /api/slots]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: upsert a slot config (assign or update course/gender/capacity)
// DELETE body: send { campusId, roomId, slotKey, clear: true } to remove a slot
export async function POST(req: NextRequest) {
  await initDb();
  try {
    const body = await req.json();
    const { campusId, roomId, slotKey, course, gender, capacity, clear } = body;

    if (!campusId || !roomId || !slotKey) {
      return NextResponse.json({ success: false, error: 'campusId, roomId, slotKey required.' }, { status: 400 });
    }

    const id = `${campusId}-${roomId}-${slotKey}`;

    if (clear) {
      await db.execute({ sql: 'DELETE FROM slots WHERE id = ?', args: [id] });
      return NextResponse.json({ success: true, message: 'Slot cleared.' });
    }

    if (!course || !gender || capacity === undefined) {
      return NextResponse.json({ success: false, error: 'course, gender, capacity required.' }, { status: 400 });
    }

    await db.execute({
      sql: `INSERT INTO slots (id, campusId, roomId, slotKey, course, gender, capacity)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET course=excluded.course, gender=excluded.gender, capacity=excluded.capacity`,
      args: [id, campusId, roomId, slotKey, course, gender, Number(capacity)],
    });

    return NextResponse.json({ success: true, message: 'Slot saved.' });
  } catch (err: any) {
    console.error('[POST /api/slots]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
