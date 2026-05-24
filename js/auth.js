// ============================================
// NISHCHAY ACADEMY — Authentication
// ============================================

import { auth, db } from './firebase-config.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp, collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();

// Watch login state and update header button
onAuthStateChanged(auth, async (user) => {
  const authBtn = document.getElementById('authBtn');
  if (!authBtn) return;

  if (user) {
    // Check if admin
    const isAdmin = await checkIfAdmin(user.email);

    // Show avatar + admin button if admin
    authBtn.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        ${isAdmin ? `
          <a href="/admin/dashboard.html"
            style="background:rgba(255,255,255,0.2);
                   color:white;
                   border:1px solid rgba(255,255,255,0.4);
                   padding:6px 10px;
                   border-radius:6px;
                   font-size:12px;
                   font-weight:700;
                   text-decoration:none;
                   white-space:nowrap;
                   display:inline-flex;
                   align-items:center;
                   gap:4px;">
            ⚙️ <span>Admin</span>
          </a>
        ` : ''}
        <img
          src="${user.photoURL || 'assets/images/avatar.png'}"
          class="header-avatar"
          onclick="window.location.href='profile.html'"
          title="${user.displayName}"
        />
      </div>
    `;

    // Save user to Firestore if first time
    await saveUserIfNew(user);

  } else {
    // User is not logged in — show login button
    authBtn.innerHTML = `
      <button class="btn btn-sm"
        style="background:rgba(255,255,255,0.2);
               color:white;
               border:1px solid rgba(255,255,255,0.4);"
        onclick="loginWithGoogle()">
        Login
      </button>
    `;
  }
});

// Check if email is in admins collection
async function checkIfAdmin(email) {
  try {
    const snapshot = await getDocs(collection(db, 'admins'));
    let isAdmin = false;
    snapshot.forEach(doc => {
      if (doc.data().email === email) isAdmin = true;
    });
    return isAdmin;
  } catch(e) {
    return false;
  }
}

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
      // Redirect to profile page to complete setup
      if (!window.location.pathname.includes('profile.html')) {
        showToast('Welcome! Please complete your profile.', 'info');
        setTimeout(() => {
          window.location.href = 'profile.html';
        }, 1500);
      }
    } else {
      // Check if profile is incomplete
      const data = userSnap.data();
      if (!data.profileComplete &&
          !window.location.pathname.includes('profile.html')) {
        showToast('Please complete your profile first.', 'info');
        setTimeout(() => {
          window.location.href = 'profile.html';
        }, 1500);
      }
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
  setTimeout(() => toast.remove(), 3000);
};