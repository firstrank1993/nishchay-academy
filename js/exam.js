// ============================================
// NISHCHAY ACADEMY — Exam Page
// ============================================

import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const bodyId = urlParams.get('bodyId');
const bodyName = urlParams.get('bodyName');

// Update page title with exam body name
document.addEventListener('DOMContentLoaded', async () => {
  if (bodyName) {
    document.getElementById('pageTitle').textContent = bodyName;
    document.getElementById('sectionTitle').textContent = `Select Exam — ${decodeURIComponent(bodyName)}`;
    document.title = `${decodeURIComponent(bodyName)} — Nishchay Academy`;
  }

  if (!bodyId) {
    window.location.href = 'index.html';
    return;
  }

  await loadExams();
});

// Load exams for this exam body
async function loadExams() {
  const skeletonLoader = document.getElementById('skeletonLoader');
  const examsList = document.getElementById('examsList');
  const emptyState = document.getElementById('emptyState');

  try {
    const snapshot = await getDocs(collection(db, 'exams'));

    skeletonLoader.style.display = 'none';

    // Filter exams for this body and sort by order
    const exams = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.examBodyId === bodyId && data.isActive !== false) {
        exams.push({ id: doc.id, ...data });
      }
    });

    exams.sort((a, b) => (a.order || 0) - (b.order || 0));

    if (exams.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    // Build HTML
    let html = '';
    exams.forEach(data => {
      const initials = data.name.substring(0, 3).toUpperCase();

      html += `
        <div class="exam-body-card card-clickable"
             onclick="window.location.href='subject.html?examId=${data.id}&examName=${encodeURIComponent(data.name)}&bodyName=${encodeURIComponent(bodyName)}'">
          <div class="exam-body-icon" style="background: linear-gradient(135deg, #0D47A1, #1a237e);">
            ${initials}
          </div>
          <div class="exam-body-info">
            <h3>${data.name}</h3>
            <p>${data.description || 'Click to see subjects'}</p>
          </div>
          <svg class="exam-body-arrow" width="20" height="20"
               viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </div>
      `;
    });

    examsList.innerHTML = html;
    examsList.style.display = 'flex';

  } catch (error) {
    skeletonLoader.style.display = 'none';
    emptyState.style.display = 'block';
    console.error('Error loading exams:', error);
  }
}
