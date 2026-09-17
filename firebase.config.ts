// firebase.config.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// TODO: Replace with your actual Firebase project configuration
// You can find this in your Firebase Console -> Project Settings -> General -> Your apps
// Your actual Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBKoZEN98-mn5gbi5PiF7s-CgDiYsc-OAQ",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "multilingual-ai-evaluation.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "multilingual-ai-evaluation",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "multilingual-ai-evaluation.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "1026821613424",
  appId: process.env.FIREBASE_APP_ID || "1:1026821613424:web:e5bd1c2500d38ec27a51b5"
};

// Exported so a secondary app instance can be spun up (e.g. to create a user
// account without disturbing the currently signed-in admin's session).
export { firebaseConfig };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;
