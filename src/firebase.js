// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyBkaGOYVziUI6MOg9Rk_cdNBPdAMZJ61xM',
  authDomain: 'circlechat-app04.firebaseapp.com',
  projectId: 'circlechat-app04',
  storageBucket: 'circlechat-app04.firebasestorage.app',
  messagingSenderId: '524023748736',
  appId: '1:524023748736:web:72f0a1552ae212069aae65',
  measurementId: 'G-3JRXV0EBBT',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

let analytics = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch((error) => {
  console.warn('Firebase analytics not supported:', error);
});

export { app, analytics };
