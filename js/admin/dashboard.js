// ============================================
// NISHCHAY ACADEMY — Admin Dashboard
// ============================================

import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let loginRequired = true;

// ── AUTH CHECK ──
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('adminEmail').textContent = user.email;
  await loadStats();
  await loadLoginSetting();
});

// ── LOAD STATS ──
async function loadStats() {
  try {
    const [questions, users, tests, subjects] = await Promise.all([
      getDocs(collection(db, 'questions')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'tests')),
      getDocs(collection(db, 'subjects'))
    ]);
    document.getElementById('totalQuestions').textContent = questions.size;
    document.getElementById('totalUsers').textContent = users.size;
    document.getElementById('totalTests').textContent = tests.size;
    document.getElementById('totalSubjects').textContent = subjects.size;
  } catch(e) {
    console.error('Error loading stats:', e);
  }
}

// ── LOGIN SETTING ──
async function loadLoginSetting() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'appConfig'));
    loginRequired = snap.exists()
      ? (snap.data().loginRequired !== false)
      : true;
  } catch(e) {
    loginRequired = true;
  }
  updateToggleUI();
}

function updateToggleUI() {
  const track = document.getElementById('loginToggleTrack');
  const dot = document.getElementById('loginToggleDot');
  const status = document.getElementById('loginToggleStatus');

  if (track) {
    track.style.background = loginRequired ? 'var(--primary)' : '#CBD5E1';
  }
  if (dot) {
    dot.style.left = loginRequired ? '26px' : '3px';
  }
  if (status) {
    status.textContent = loginRequired
      ? '🔒 ON — Users must log in to use the app'
      : '🔓 OFF — App accessible without login';
    status.style.color = loginRequired
      ? 'var(--success)' : 'var(--danger)';
  }
}

window.toggleLoginRequired = async function() {
  const prev = loginRequired;
  loginRequired = !loginRequired;
  updateToggleUI();

  try {
    await setDoc(
      doc(db, 'settings', 'appConfig'),
      { loginRequired },
      { merge: true }
    );
    showToast(
      loginRequired
        ? '🔒 Login is now required'
        : '🔓 App is now accessible without login',
      'success'
    );
  } catch(e) {
    // Revert on error
    loginRequired = prev;
    updateToggleUI();
    showToast('Error saving setting', 'error');
    console.error(e);
  }
};

// ── LOGOUT ──
window.adminLogout = async function() {
  await signOut(auth);
  window.location.href = 'index.html';
};

// ── TOAST ──
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};

