// ============================================
// NISHCHAY ACADEMY — Admin Authentication
// ============================================

import { auth, db } from '../firebase-config.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();

// Check if already logged in as admin
onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById('loadingMsg').style.display = 'block';
    const isAdmin = await checkAdminAccess(user.email);
    if (isAdmin) {
      window.location.href = 'dashboard.html';
    } else {
      document.getElementById('loadingMsg').style.display = 'none';
      document.getElementById('errorMsg').style.display = 'block';
      await signOut(auth);
    }
  }
});

// Admin login
window.adminLogin = async function() {
  const loginBtn = document.getElementById('loginBtn');
  const errorMsg = document.getElementById('errorMsg');
  const loadingMsg = document.getElementById('loadingMsg');

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';
  errorMsg.style.display = 'none';

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    loadingMsg.style.display = 'block';

    const isAdmin = await checkAdminAccess(user.email);

    if (isAdmin) {
      window.location.href = 'dashboard.html';
    } else {
      errorMsg.style.display = 'block';
      loadingMsg.style.display = 'none';
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign in with Google';
      await signOut(auth);
    }
  } catch (error) {
    console.error('Login error:', error);
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign in with Google';
  }
};

// Check admin whitelist
async function checkAdminAccess(email) {
  try {
    const snapshot = await getDocs(collection(db, 'admins'));
    let isAdmin = false;
    snapshot.forEach(doc => {
      if (doc.data().email === email) {
        isAdmin = true;
      }
    });
    return isAdmin;
  } catch (error) {
    console.error('Error checking admin:', error);
    return false;
  }
}

// Export for other admin pages
window.checkAdminAccess = checkAdminAccess;
