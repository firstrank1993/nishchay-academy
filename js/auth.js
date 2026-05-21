// ============================================
// NISHCHAY ACADEMY — Authentication
// ============================================

import { auth } from './firebase-config.js';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();

// Watch login state and update header button
onAuthStateChanged(auth, async (user) => {
  const authBtn = document.getElementById('authBtn');
  if (!authBtn) return;

  if (user) {
    // User is logged in — show avatar
    authBtn.innerHTML = `
      <img 
        src="${user.photoURL || 'assets/images/avatar.png'}" 
        class="header-avatar"
        onclick="window.location.href='profile.html'"
        title="${user.displayName}"
      />
    `;
    // Save user to Firestore if first time
    await saveUserIfNew(user);
  } else {
    // User is not logged in — show login button
    authBtn.innerHTML = `
      <button class="btn btn-sm" 
              style="background:rgba(255,255,255,0.2); color:white; border:1px solid rgba(255,255,255,0.4);"
              onclick="loginWithGoogle()">
        Login
      </button>
    `;
  }
});

// Google Login
window.loginWithGoogle = async function() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Login error:', error);
    showToast('Login failed. Please try again.', 'error');
  }
};

// Logout
window.logout = async function() {
  try {
    await signOut(auth);
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Logout error:', error);
  }
};

// Save new user to Firestore
async function saveUserIfNew(user) {
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // First time login — save basic info
      await setDoc(userRef, {
        fullName: user.displayName || '',
        email: user.email || '',
        photoUrl: user.photoURL || '',
        createdAt: serverTimestamp(),
        isBlocked: false,
        profileComplete: false
      });
    }
  } catch (error) {
    console.error('Error saving user:', error);
  }
}

// Toast notification helper
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
};