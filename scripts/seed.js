const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Load environment variables manually
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY 
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
  : undefined;

if (!admin.apps.length) {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    admin.initializeApp({
      projectId: projectId || 'bano-qabil-local',
    });
    console.log('🔥 Initialized Firestore Emulator in seeder!');
  } else if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log('✅ Initialized Firebase Admin from Service Account env vars.');
  } else {
    console.error('❌ Missing Firebase credentials! Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
    console.error('💡 If using emulator locally, set FIRESTORE_EMULATOR_HOST="localhost:8080"');
    process.exit(1);
  }
}

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const defaults = {
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

async function seed() {
  console.log('🚀 Starting Bano Qabil database seeding/migration...');

  // 1. Seed Student Data from raw HTML
  const htmlPath = path.join(__dirname, '../raw_html/Bano_Qabil_Enrollment_Manager.html');
  if (!fs.existsSync(htmlPath)) {
    console.error(`❌ original HTML not found at: ${htmlPath}`);
    process.exit(1);
  }

  console.log('📄 Reading enrollment HTML file...');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  console.log('🔍 Extracting students JSON array via regex...');
  const match = htmlContent.match(/let\s+students\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!match) {
    console.error('❌ Could not find "let students = [...];" inside the HTML file script tag!');
    process.exit(1);
  }

  let students = [];
  try {
    students = JSON.parse(match[1]);
  } catch (err) {
    console.error('❌ JSON parsing of students failed!', err);
    process.exit(1);
  }

  // Deduplicate by ID
  const seen = new Set();
  students = students.filter((s) => {
    if (!s.id || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  console.log(`✨ Parsed ${students.length} unique student documents.`);

  // Write in batches of 500 (Firestore limits single batch sizes to 500)
  console.log('✍️ Uploading students to Firestore "students" collection...');
  const BATCH_SIZE = 500;
  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = students.slice(i, i + BATCH_SIZE);

    chunk.forEach((s) => {
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
        campusId: null,
        roomId: null,
        slotKey: null,
        courseCode: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`📦 Written students ${i + 1} to ${Math.min(i + BATCH_SIZE, students.length)}...`);
  }

  // 2. Seed default Timetable slots
  console.log('⏰ Seeding default timetable slots to Firestore "slots" collection...');
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
  console.log(`🎉 Successfully seeded ${slotCount} default slots!`);
  console.log('🚀 Seeding completed successfully! Your database is now active.');
}

seed().catch((err) => {
  console.error('❌ Seeding failed with error:', err);
  process.exit(1);
});
