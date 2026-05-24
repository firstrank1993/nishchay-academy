// ============================================
// NISHCHAY ACADEMY — Subject Page
// ============================================

import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const examId = urlParams.get('examId');
const examName = urlParams.get('examName');
const bodyName = urlParams.get('bodyName');

document.addEventListener('DOMContentLoaded', async () => {
  if (examName) {
    document.getElementById('pageTitle').textContent = decodeURIComponent(examName);
    document.getElementById('sectionTitle').textContent = `Subjects — ${decodeURIComponent(examName)}`;
    document.title = `${decodeURIComponent(examName)} — Nishchay Academy`;
  }

  if (!examId) {
    window.location.href = 'index.html';
    return;
  }

  await loadSubjects();
});

async function loadSubjects() {
  const skeletonLoader = document.getElementById('skeletonLoader');
  const subjectsList = document.getElementById('subjectsList');
  const emptyState = document.getElementById('emptyState');

  try {
    // Get syllabus entries for this exam
    const syllabusSnap = await getDocs(collection(db, 'examSyllabus'));
    const subjectIds = [];

    syllabusSnap.forEach(doc => {
      const data = doc.data();
      if (data.examId === examId) {
        subjectIds.push(data.subjectId);
      }
    });

    if (subjectIds.length === 0) {
      skeletonLoader.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    // Get all subjects
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = [];

    subjectsSnap.forEach(doc => {
      if (subjectIds.includes(doc.id) && doc.data().isActive !== false) {
        subjects.push({ id: doc.id, ...doc.data() });
      }
    });

    subjects.sort((a, b) => (a.order || 0) - (b.order || 0));

    skeletonLoader.style.display = 'none';

    if (subjects.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    // Color array for subject icons
    const colors = [
      'linear-gradient(135deg, #1565C0, #0D47A1)',
      'linear-gradient(135deg, #16A34A, #15803d)',
      'linear-gradient(135deg, #D97706, #b45309)',
      'linear-gradient(135deg, #DC2626, #b91c1c)',
      'linear-gradient(135deg, #7C3AED, #6d28d9)',
      'linear-gradient(135deg, #0891B2, #0e7490)',
    ];

    let html = '';
    subjects.forEach((data, index) => {
      const color = colors[index % colors.length];
      const initials = '📚';

      html += `
        <div class="exam-body-card card-clickable"
             onclick="window.location.href='topic.html?subjectId=${data.id}&subjectName=${encodeURIComponent(data.name)}&examId=${examId}&examName=${encodeURIComponent(examName)}'">
          <div class="exam-body-icon" style="background:${color}; font-size:24px;">
            ${initials}
          </div>
          <div class="exam-body-info">
            <h3>${data.name}</h3>
            <p>${data.description || 'Click to see topics'}</p>
          </div>
          <svg class="exam-body-arrow" width="20" height="20"
               viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </div>
      `;
    });

    subjectsList.innerHTML = html;
    subjectsList.style.display = 'flex';

  } catch (error) {
    skeletonLoader.style.display = 'none';
    emptyState.style.display = 'block';
    console.error('Error loading subjects:', error);
  }
}
