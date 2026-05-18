import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

// PUT: Update student data (including enrolling/assigning slots)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const docRef = db.collection('students').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ success: false, error: 'Student not found.' }, { status: 404 });
    }

    const currentData = docSnap.data();

    // Prepare fields to update
    const updateData: Record<string, any> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.gender !== undefined) updateData.gender = body.gender;
    if (body.priority !== undefined) updateData.priority = Number(body.priority);
    if (body.interviewed !== undefined) updateData.interviewed = body.interviewed;
    if (body.deposit !== undefined) updateData.deposit = body.deposit;
    if (body.status !== undefined) updateData.status = body.status;
    
    // Enrollment Specifics
    if (body.enrolled !== undefined) {
      updateData.enrolled = Boolean(body.enrolled);

      if (body.enrolled) {
        // Enrolling in a class
        updateData.campusId = body.campusId || null;
        updateData.roomId = body.roomId || null;
        updateData.slotKey = body.slotKey || null;
        updateData.courseCode = body.courseCode || null;
      } else {
        // Resetting enrollment back to general pool
        updateData.campusId = null;
        updateData.roomId = null;
        updateData.slotKey = null;
        updateData.courseCode = null;
      }
    }

    await docRef.update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Student updated successfully!',
      student: { ...currentData, ...updateData }
    });
  } catch (error: any) {
    console.error('Error updating student:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Delete student from the database
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const docRef = db.collection('students').doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ success: false, error: 'Student not found.' }, { status: 404 });
    }

    await docRef.delete();

    return NextResponse.json({
      success: true,
      message: 'Student deleted successfully!'
    });
  } catch (error: any) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
