import { NextRequest, NextResponse } from 'next/server';
import { db, initDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// PUT: Update a student (enroll, unenroll, edit fields)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await initDb();
  try {
    const { id } = await params;
    const body = await req.json();

    // Check student exists
    const existing = await db.execute({ sql: 'SELECT id FROM students WHERE id = ?', args: [id] });
    if (existing.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Student not found.' }, { status: 404 });
    }

    // Build dynamic SET clause
    const sets: string[] = [];
    const args: any[]   = [];

    if (body.name       !== undefined) { sets.push('name = ?');        args.push(body.name); }
    if (body.gender     !== undefined) { sets.push('gender = ?');      args.push(body.gender); }
    if (body.priority   !== undefined) { sets.push('priority = ?');    args.push(Number(body.priority)); }
    if (body.interviewed !== undefined){ sets.push('interviewed = ?'); args.push(body.interviewed); }
    if (body.deposit    !== undefined) { sets.push('deposit = ?');     args.push(body.deposit); }
    if (body.status     !== undefined) { sets.push('status = ?');      args.push(body.status); }

    if (body.enrolled !== undefined) {
      sets.push('enrolled = ?');
      args.push(body.enrolled ? 1 : 0);

      if (body.enrolled) {
        sets.push('campusId = ?', 'roomId = ?', 'slotKey = ?', 'courseCode = ?');
        args.push(body.campusId || null, body.roomId || null, body.slotKey || null, body.courseCode || null);
      } else {
        sets.push('campusId = NULL', 'roomId = NULL', 'slotKey = NULL', 'courseCode = NULL');
      }
    }

    if (sets.length === 0) return NextResponse.json({ success: false, error: 'No fields to update.' }, { status: 400 });

    args.push(id);
    await db.execute({ sql: `UPDATE students SET ${sets.join(', ')} WHERE id = ?`, args });

    return NextResponse.json({ success: true, message: 'Student updated.' });
  } catch (err: any) {
    console.error('[PUT /api/students/[id]]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Remove a student
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await initDb();
  try {
    const { id } = await params;
    const res = await db.execute({ sql: 'DELETE FROM students WHERE id = ?', args: [id] });
    if (res.rowsAffected === 0) return NextResponse.json({ success: false, error: 'Student not found.' }, { status: 404 });
    return NextResponse.json({ success: true, message: 'Student deleted.' });
  } catch (err: any) {
    console.error('[DELETE /api/students/[id]]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
