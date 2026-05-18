import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db, admin, isUsingPlaceholders } from '@/lib/firebase-admin';

const defaults: Record<string, Record<string, { course: string; gender: string; cap: number }>> = {
  'ds-lab1': {
    '0-0': { course: 'GD', gender: 'M', cap: 50 },
    '0-1': { course: 'GD', gender: 'F', cap: 50 },
    '0-2': { course: 'VE', gender: 'F', cap: 50 },
    '0-3': { course: 'VE', gender: 'M', cap: 50 },
    '1-0': { course: 'CS', gender: 'M', cap: 50 },
    '1-1': { course: 'CS', gender: 'F', cap: 50 },
    '1-2': { course: 'WD', gender: 'F', cap: 50 },
    '1-3': { course: 'WD', gender: 'M', cap: 50 },
    '2-0': { course: 'CS', gender: 'M', cap: 50 },
    '2-1': { course: 'CS', gender: 'F', cap: 50 },
    '2-2': { course: 'GD', gender: 'F', cap: 50 },
    '2-3': { course: 'GD', gender: 'M', cap: 50 },
  },
  'ds-lab2': {
    '0-0': { course: 'VE', gender: 'M', cap: 40 },
    '0-1': { course: 'VE', gender: 'F', cap: 40 },
    '1-0': { course: 'CS', gender: 'M', cap: 40 },
    '1-1': { course: 'CS', gender: 'F', cap: 40 },
    '2-0': { course: 'WD', gender: 'M', cap: 40 },
    '2-1': { course: 'WD', gender: 'F', cap: 40 },
  },
  'ds-cls': {
    '0-0': { course: 'DM', gender: 'M', cap: 50 },
    '0-1': { course: 'DM', gender: 'F', cap: 50 },
    '0-2': { course: 'AiE', gender: 'F', cap: 50 },
    '0-3': { course: 'AiE', gender: 'M', cap: 50 },
    '1-0': { course: 'DM', gender: 'M', cap: 50 },
    '1-1': { course: 'DM', gender: 'F', cap: 50 },
    '1-2': { course: 'AiE', gender: 'F', cap: 50 },
    '1-3': { course: 'AiE', gender: 'M', cap: 50 },
    '2-0': { course: 'DM', gender: 'M', cap: 50 },
    '2-1': { course: 'DM', gender: 'F', cap: 50 },
    '2-2': { course: 'AiE', gender: 'F', cap: 50 },
    '2-3': { course: 'AiE', gender: 'M', cap: 50 },
  },
  'ic-lab': {
    '0-0': { course: 'GD', gender: 'M', cap: 35 },
    '0-1': { course: 'GD', gender: 'F', cap: 35 },
    '0-2': { course: 'VE', gender: 'F', cap: 35 },
    '0-3': { course: 'VE', gender: 'M', cap: 35 },
    '1-0': { course: 'CS', gender: 'M', cap: 35 },
    '1-1': { course: 'CS', gender: 'F', cap: 35 },
    '2-0': { course: 'WD', gender: 'M', cap: 35 },
    '2-1': { course: 'WD', gender: 'F', cap: 35 },
  },
  'ic-cls': {
    '0-0': { course: 'DM', gender: 'M', cap: 45 },
    '0-1': { course: 'DM', gender: 'F', cap: 45 },
    '0-2': { course: 'AiE', gender: 'F', cap: 45 },
    '0-3': { course: 'AiE', gender: 'M', cap: 45 },
    '1-0': { course: 'DM', gender: 'M', cap: 45 },
    '1-1': { course: 'DM', gender: 'F', cap: 45 },
    '1-2': { course: 'AiE', gender: 'F', cap: 45 },
    '1-3': { course: 'AiE', gender: 'M', cap: 45 },
    '2-0': { course: 'DM', gender: 'M', cap: 45 },
    '2-1': { course: 'DM', gender: 'F', cap: 45 },
    '2-2': { course: 'AiE', gender: 'F', cap: 45 },
    '2-3': { course: 'AiE', gender: 'M', cap: 45 },
  },
};

export async function POST() {
  if (isUsingPlaceholders()) {
    return NextResponse.json({
      success: false,
      error: '⚠️ Seeding failed: You are still using placeholder credentials inside your .env.local file. Please generate and paste your actual Firebase Service Account Client Email and Private Key in your local .env.local file to establish a live connection to Firestore!'
    }, { status: 400 });
  }

  try {
    console.log('🌐 Web seeder POST request received...');
    
    // 1. Read Bano Qabil original HTML
    const htmlPath = path.join(process.cwd(), 'raw_html/Bano_Qabil_Enrollment_Manager.html');
    if (!fs.existsSync(htmlPath)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Original HTML file Bano_Qabil_Enrollment_Manager.html not found in raw_html/' 
      }, { status: 404 });
    }

    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const match = htmlContent.match(/let\s+students\s*=\s*(\[[\s\S]*?\])\s*;/);
    if (!match) {
      return NextResponse.json({ 
        success: false, 
        error: 'Could not parse student JSON list inside script tag in the HTML file' 
      }, { status: 400 });
    }

    let students = JSON.parse(match[1]);
    
    // Deduplicate
    const seen = new Set();
    students = students.filter((s: any) => {
      if (!s.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    console.log(`✨ Found ${students.length} unique students to write to Firestore...`);

    // Write in chunks of 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < students.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = students.slice(i, i + BATCH_SIZE);

      chunk.forEach((s: any) => {
        const docRef = db.collection('students').doc(String(s.id));
        batch.set(docRef, {
          id: String(s.id),
          name: s.name || 'Unknown',
          gender: s.gender || 'Male',
          interviewed: s.interviewed || 'No',
          deposit: s.deposit || 'No',
          batch1: s.batch1 || 'No',
          priority: Number(s.priority) || 4,
          status: s.status || 'Imported Registration',
          enrolled: s.enrolled || false,
          campusId: s.campusId || null,
          roomId: s.roomId || null,
          slotKey: s.slotKey || null,
          courseCode: s.courseCode || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      console.log(`📦 Web seeded students chunk ${i + 1} to ${Math.min(i + BATCH_SIZE, students.length)}`);
    }

    // 2. Seed default Timetable slots
    console.log('⏰ Web seeding defaults for Timetable Scheduler slots...');
    const slotBatch = db.batch();
    let slotCount = 0;

    Object.entries(defaults).forEach(([roomId, slots]) => {
      const campusId = roomId.startsWith('ds') ? 'ds' : 'ic';
      Object.entries(slots).forEach(([slotKey, sl]) => {
        const slotId = `${roomId}-${slotKey}`;
        const docRef = db.collection('slots').doc(slotId);
        slotBatch.set(docRef, {
          id: slotId,
          campusId,
          roomId,
          slotKey,
          course: sl.course,
          gender: sl.gender,
          capacity: Number(sl.cap) || 50,
        });
        slotCount++;
      });
    });

    await slotBatch.commit();
    console.log(`🎉 Web seeding successfully created ${slotCount} slots.`);

    return NextResponse.json({
      success: true,
      seededStudents: students.length,
      seededSlots: slotCount,
    });
  } catch (error: any) {
    console.error('❌ Web seeder failure:', error);
    return NextResponse.json({ success: false, error: error.message || error }, { status: 500 });
  }
}
