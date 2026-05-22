// ============================================
// NISHCHAY ACADEMY — Admin Dashboard
// ============================================

import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Check admin access on load
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }

  // Show admin email
  document.getElementById('adminEmail').textContent = user.email;

  // Load stats
  await loadStats();
});

// Load dashboard stats
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
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Admin logout
window.adminLogout = async function() {
  await signOut(auth);
  window.location.href = 'index.html';
};
