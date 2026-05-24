// ============================================
// NISHCHAY ACADEMY — Profile Page
// ============================================

import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, updateDoc, collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    document.getElementById('notLoggedIn').style.display = 'block';
    return;
  }

  currentUser = user;
  document.getElementById('profileContent').style.display = 'block';

  // Set photo and email
  document.getElementById('profilePhoto').src = user.photoURL || 'assets/images/avatar.png';
  document.getElementById('profileEmail').textContent = user.email;

  await loadProfile(user.uid);
  await loadStats(user.uid);
});

async function loadProfile(userId) {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      const data = snap.data();
      document.getElementById('profileName').textContent = data.fullName || currentUser.displayName || 'Student';
      document.getElementById('editName').value = data.fullName || currentUser.displayName || '';
      document.getElementById('editMobile').value = data.mobile || '';
      document.getElementById('editDistrict').value = data.district || '';
      document.getElementById('editQualification').value = data.qualification || '';
    } else {
      document.getElementById('profileName').textContent = currentUser.displayName || 'Student';
      document.getElementById('editName').value = currentUser.displayName || '';
    }
  } catch(e) {
    console.error(e);
  }
}

async function loadStats(userId) {
  try {
    const snap = await getDocs(collection(db, 'testAttempts'));
    const attempts = [];
    snap.forEach(d => {
      if (d.data().userId === userId) attempts.push(d.data());
    });

    document.getElementById('statTests').textContent = attempts.length;

    if (attempts.length > 0) {
      const avg = Math.round(
        attempts.reduce((sum, a) => sum + (a.accuracy || 0), 0) / attempts.length
      );
      document.getElementById('statAccuracy').textContent = `${avg}%`;
    } else {
      document.getElementById('statAccuracy').textContent = 'N/A';
    }
  } catch(e) {
    console.error(e);
  }
}

window.saveProfile = async function() {
  if (!currentUser) return;

  const fullName = document.getElementById('editName').value.trim();
  const mobile = document.getElementById('editMobile').value.trim();
  const district = document.getElementById('editDistrict').value;
  const qualification = document.getElementById('editQualification').value;

  if (!fullName) { showToast('Enter your full name', 'error'); return; }
  if (!mobile || mobile.length !== 10) { showToast('Enter valid 10-digit mobile number', 'error'); return; }
  if (!district) { showToast('Please select your district', 'error'); return; }
  if (!qualification) { showToast('Please select your qualification', 'error'); return; }

  const btn = document.getElementById('saveProfileBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    await updateDoc(doc(db, 'users', currentUser.uid), {
      fullName, mobile, district, qualification, profileComplete: true
    });

    document.getElementById('profileName').textContent = fullName;
    showToast('Profile saved!', 'success');
  } catch(e) {
    showToast('Error saving profile', 'error');
    console.error(e);
  }

  btn.disabled = false; btn.textContent = 'Save Profile';
};

window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};