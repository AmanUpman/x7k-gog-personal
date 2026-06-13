// Copy this file to firebase-config.js and fill in your Firebase project details.
// Setup (free, ~5 minutes):
// 1. https://console.firebase.google.com → Create project
// 2. Authentication → Sign-in method → Enable Google
// 3. Firestore Database → Create database (production mode is fine)
// 4. Firestore → Rules → paste:
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /users/{userId} {
//          allow read, write: if request.auth != null && request.auth.uid == userId;
//        }
//      }
//    }
// 5. Project settings → Your apps → Web app → copy config below
// 6. Authentication → Settings → Authorized domains → add your GitHub Pages domain

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export const cloudSyncEnabled =
  firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.projectId !== "YOUR_PROJECT_ID";
