
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app); // Initialize Firestore instance

// Enable Firestore offline persistence
// This setting applies globally to this Firestore instance (db).
// All data fetched through this instance (exams, subjects, classes, students, scores, etc.)
// will automatically benefit from local caching and offline capabilities.
if (typeof window !== 'undefined') { // Ensure this runs only on the client-side
  enableIndexedDbPersistence(db, { cacheSizeBytes: CACHE_SIZE_UNLIMITED })
    .then(() => {
      // console.log("Firestore offline persistence enabled successfully."); // Optional: for debugging
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        // This means persistence is already enabled in another tab or this tab has been opened again.
        // Firestore only allows one tab to enable persistence. This is usually not a critical error for subsequent tabs.
        // console.warn("Firestore offline persistence failed (failed-precondition). It might be already enabled in another tab.");
      } else if (err.code === 'unimplemented') {
        // The current browser does not support all of the features required to enable persistence.
        console.warn("Firestore offline persistence failed (unimplemented). This browser does not support the required features.");
      } else {
        console.error("Firestore offline persistence failed with error: ", err);
      }
    });
}

export { app, auth, db };

