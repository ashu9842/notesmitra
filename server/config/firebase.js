import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import config from './env.js';
import logger from '../utils/logger.js';

let firebaseInitialized = false;

export const initializeFirebase = () => {
  if (
    !config.firebaseProjectId ||
    !config.firebaseClientEmail ||
    !config.firebasePrivateKey
  ) {
    logger.info('Firebase Admin SDK not configured — Google login disabled.');
    return;
  }

  if (getApps().length > 0) {
    firebaseInitialized = true;
    return;
  }

  try {
    initializeApp({
      credential: cert({
        projectId: config.firebaseProjectId,
        clientEmail: config.firebaseClientEmail,
        // Private key comes in as a string with literal \n — convert to real newlines
        privateKey: config.firebasePrivateKey.replace(/\\n/g, '\n'),
      }),
    });
    firebaseInitialized = true;
    logger.info('Firebase Admin SDK initialized.');
  } catch (err) {
    logger.error('Failed to initialize Firebase Admin SDK:', err.message);
  }
};

export const verifyFirebaseToken = async (idToken) => {
  if (!firebaseInitialized) {
    throw new Error('Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
  }
  return getAuth().verifyIdToken(idToken);
};

export const isFirebaseEnabled = () => firebaseInitialized;
