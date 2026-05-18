import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    
    // Replace standard escaped newline characters in the private key
    const privateKey = process.env.FIREBASE_PRIVATE_KEY 
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
      : undefined;

    const isPrivateKeyValid = privateKey && privateKey.includes('-----BEGIN PRIVATE KEY-----');

    if (process.env.FIRESTORE_EMULATOR_HOST) {
      // If emulator is active, initialize with dummy settings
      admin.initializeApp({
        projectId: projectId || 'bano-qabil-local',
      });
      console.log('🔥 Firebase Admin initialized using Firestore Emulator!');
    } else if (projectId && clientEmail && isPrivateKeyValid) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('✅ Firebase Admin initialized using Service Account environment variables.');
    } else {
      // If we are compiling, testing, or lack credentials, initialize in static build mode
      admin.initializeApp({
        projectId: projectId || 'bano-qabil-local',
      });
      console.log('⚠️ Firebase Admin initialized in static build mode (placeholder credentials).');
    }
  } catch (error) {
    console.error('❌ Firebase Admin Initialization Error:', error);
  }
}

const db = admin.firestore();

// Allow writing properties with undefined values by ignoring them rather than crashing
db.settings({ ignoreUndefinedProperties: true });

export { db, admin };
