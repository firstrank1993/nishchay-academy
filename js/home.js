// ============================================
// NISHCHAY ACADEMY — Home Page
// ============================================

import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Run when page loads
document.addEventListener('DOMContentLoaded', async () => {
  await loadExamBodies();
});

// Load all exam bodies from Firestore
async function loadExamBodies() {
  const skeletonLoader = document.getElementById('skeletonLoader');
  const examBodiesList = document.getElementById('examBodiesList');
  const emptyState = document.getElementById('emptyState');

  try {
    // Simple fetch — no complex query needed
    const snapshot = await getDocs(collection(db, 'examBodies'));

    // Hide skeleton loader
    skeletonLoader.style.display = 'none';

    if (snapshot.empty) {
      emptyState.style.display = 'block';
      return;
    }

    // Sort by order field
    const examBodies = [];
    snapshot.forEach(doc => {
      examBodies.push({ id: doc.id, ...doc.data() });
    });
    examBodies.sort((a, b) => (a.order || 0) - (b.order || 0));

    // Build HTML for each exam body
    let html = '';
    examBodies.forEach(data => {
      if (data.isActive === false) return;
      const initials = data.name.length <= 5 ? data.name.toUpperCase() : data.name.substring(0, 4).toUpperCase();

      html += `
        <div class="exam-body-card card-clickable"
             onclick="window.location.href='exam.html?bodyId=${data.id}&bodyName=${encodeURIComponent(data.name)}'">
          <div class="exam-body-icon">${initials}</div>
          <div class="exam-body-info">
            <h3>${data.name}</h3>
            <p>${data.description || 'Click to see exams'}</p>
          </div>
          <svg style="margin-left:auto; color:#CBD5E1;" width="20" height="20"
               viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </div>
      `;
    });

    if (html === '') {
      emptyState.style.display = 'block';
      return;
    }

    examBodiesList.innerHTML = html;
    examBodiesList.style.display = 'flex';

  } catch (error) {
    skeletonLoader.style.display = 'none';
    emptyState.style.display = 'block';
    console.error('Error loading exam bodies:', error);
  }
}