const admin = require('firebase-admin');
require('dotenv').config();

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY;
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://circlechat-app04-default-rtdb.asia-southeast1.firebasedatabase.app';

let initialized = false;

if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: FIREBASE_DATABASE_URL,
  });
  initialized = true;
} else {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL: FIREBASE_DATABASE_URL,
    });
    initialized = true;
  } catch (error) {
    console.warn('Firebase Admin initialization failed:', error.message);
  }
}

module.exports = {
  admin,
  auth: initialized ? admin.auth() : null,
  firestore: initialized ? admin.firestore() : null,
  initialized,
};
