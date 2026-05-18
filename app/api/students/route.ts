import { NextRequest, NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';

// GET: Query students with search, filters, and pagination
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const filter = searchParams.get('filter') || 'all'; // all, p1, p2, p3, p4, enrolled, male, female
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    // Fetch all students (dataset is ~1000, fetching all is very fast and allows complex filter/search)
    const snapshot = await db.collection('students').orderBy('priority', 'asc').get();
    let list = snapshot.docs.map(doc => doc.data());

    // Apply Search
    if (search) {
      list = list.filter((s: any) => 
        s.id.toLowerCase().includes(search) || 
        s.name.toLowerCase().includes(search)
      );
    }

    // Apply Filter
    if (filter !== 'all') {
      if (filter === 'p1') list = list.filter((s: any) => s.priority === 1);
      else if (filter === 'p2') list = list.filter((s: any) => s.priority === 2);
      else if (filter === 'p3') list = list.filter((s: any) => s.priority === 3);
      else if (filter === 'p4') list = list.filter((s: any) => s.priority === 4);
      else if (filter === 'enrolled') list = list.filter((s: any) => s.enrolled === true);
      else if (filter === 'male') list = list.filter((s: any) => s.gender === 'Male');
      else if (filter === 'female') list = list.filter((s: any) => s.gender === 'Female');
    }

    // Calculate dynamic stats
    const totalCount = list.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedList = list.slice(startIndex, startIndex + pageSize);

    return NextResponse.json({
      success: true,
      students: paginatedList,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize)
    });
  } catch (error: any) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Add new student manually OR bulk-merge uploaded students
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Check if bulk upload list
    if (Array.isArray(body)) {
      console.log(`📥 Bulk upload request received for ${body.length} students...`);
      const BATCH_SIZE = 500;
      let added = 0;
      let duplicates = 0;

      // Fetch existing IDs to avoid duplicates
      const snapshot = await db.collection('students').select('id').get();
      const existingIds = new Set(snapshot.docs.map(doc => doc.id));

      for (let i = 0; i < body.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = body.slice(i, i + BATCH_SIZE);
        let batchHasOperations = false;

        chunk.forEach((s: any) => {
          const sid = String(s.id).trim();
          if (existingIds.has(sid)) {
            duplicates++;
            return;
          }
          
          existingIds.add(sid);
          const docRef = db.collection('students').doc(sid);
          batch.set(docRef, {
            id: sid,
            name: s.name || 'Unknown',
            gender: s.gender || 'Male',
            interviewed: s.interviewed || 'No',
            deposit: s.deposit || 'No',
            batch1: s.batch1 || 'No',
            priority: Number(s.priority) || 4,
            status: s.status || 'Uploaded Registration',
            enrolled: false,
            campusId: null,
            roomId: null,
            slotKey: null,
            courseCode: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          added++;
          batchHasOperations = true;
        });

        if (batchHasOperations) {
          await batch.commit();
        }
      }

      return NextResponse.json({
        success: true,
        message: `Successfully merged bulk data. Added ${added} students. Skipped ${duplicates} duplicates.`,
        added,
        duplicates
      });
    }

    // Manual single student entry
    const { id, name, gender, priority, interviewed, deposit, status } = body;
    if (!id || !name || !gender) {
      return NextResponse.json({ success: false, error: 'Student ID, Name, and Gender are required fields.' }, { status: 400 });
    }

    const sid = String(id).trim();
    const docRef = db.collection('students').doc(sid);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      return NextResponse.json({ success: false, error: 'Student ID already exists in the database.' }, { status: 409 });
    }

    const newStudent = {
      id: sid,
      name: name.trim(),
      gender,
      priority: Number(priority) || 4,
      interviewed: interviewed || 'No',
      deposit: deposit || 'No',
      batch1: 'No',
      status: status.trim() || 'Manually added',
      enrolled: false,
      campusId: null,
      roomId: null,
      slotKey: null,
      courseCode: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docRef.set(newStudent);

    return NextResponse.json({
      success: true,
      message: 'Student added successfully!',
      student: newStudent
    });
  } catch (error: any) {
    console.error('Error adding student:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
