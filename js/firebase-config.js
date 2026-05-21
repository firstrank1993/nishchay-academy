// ============================================
// NISHCHAY ACADEMY — Firebase Configuration
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

// Your Firebase project credentials
const firebaseConfig = {
  apiKey: "AIzaSyC-L2TzQr2OVYlKmgx0V2ribsXem4ZqkeQ",
  authDomain: "nishchayacademydhg.firebaseapp.com",
  projectId: "nishchayacademydhg",
  storageBucket: "nishchayacademydhg.firebasestorage.app",
  messagingSenderId: "913777397699",
  appId: "1:913777397699:web:a4ead0bf04eba45faeb776",
  measurementId: "G-XFD2VESJMK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const db = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);

// Export so other files can use them
export { db, auth, analytics };