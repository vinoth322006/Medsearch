import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { config } from './index';

if (config.firebase.serviceAccountKey) {
  try {
    const serviceAccount = JSON.parse(config.firebase.serviceAccountKey);
    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized with provided service account key.');
  } catch (error) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
  }
} else {
  // Fallback to Application Default Credentials
  // When running locally without credentials, verifyIdToken still works if we provide the projectId
  initializeApp({
    projectId: 'vinothpalanivel'
  });
  console.log('Firebase Admin SDK initialized with fallback projectId.');
}

export const firebaseAdminAuth = getAuth();
