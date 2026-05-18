import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

// GET: Fetch all classroom slots with dynamic occupancy and gender counts
export async function GET(req: NextRequest) {
  try {
    // 1. Fetch all slots from Firestore
    const slotsSnap = await db.collection('slots').get();
    const slots = slotsSnap.docs.map(doc => doc.data());

    // 2. Fetch all enrolled students
    const studentsSnap = await db.collection('students').where('enrolled', '==', true).get();
    const enrolledStudents = studentsSnap.docs.map(doc => doc.data());

    // 3. Merge aggregates dynamically
    const enrichedSlots = slots.map((slot: any) => {
      const slotStudents = enrolledStudents.filter((s: any) => 
        s.roomId === slot.roomId && 
        s.slotKey === slot.slotKey
      );

      const enrolledCount = slotStudents.length;
      const maleCount = slotStudents.filter((s: any) => s.gender === 'Male').length;
      const femaleCount = slotStudents.filter((s: any) => s.gender === 'Female').length;

      return {
        ...slot,
        enrolledCount,
        maleCount,
        femaleCount,
        // Also attach direct student names/ids for the roster inspector!
        roster: slotStudents.map((s: any) => ({
          id: s.id,
          name: s.name,
          gender: s.gender,
          priority: s.priority,
          status: s.status
        }))
      };
    });

    return NextResponse.json({
      success: true,
      slots: enrichedSlots
    });
  } catch (error: any) {
    console.error('Error fetching slots:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Add or update a slot configuration
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { campusId, roomId, slotKey, course, gender, capacity } = body;

    if (!campusId || !roomId || !slotKey || !course || !gender || capacity === undefined) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: campusId, roomId, slotKey, course, gender, capacity.' 
      }, { status: 400 });
    }

    const slotId = `${roomId}-${slotKey}`;
    const docRef = db.collection('slots').doc(slotId);

    const slotData = {
      id: slotId,
      campusId,
      roomId,
      slotKey,
      course,
      gender,
      capacity: Number(capacity)
    };

    await docRef.set(slotData, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'Timetable slot configured successfully!',
      slot: slotData
    });
  } catch (error: any) {
    console.error('Error configuring slot:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
