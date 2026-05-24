// ============================================
// NISHCHAY ACADEMY — Subject Page
// ============================================

import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const examId = urlParams.get('examId');
const examName = urlParams.get('examName');
const bodyName = urlParams.get('bodyName');

document.addEventListener('DOMContentLoaded', async () => {
  if (examName) {
    document.getElementById('pageTitle').textContent =
      decodeURIComponent(examName);
    document.getElementById('sectionTitle').textContent =
      `Subjects — ${decodeURIComponent(examName)}`;
    document.title =
      `${decodeURIComponent(examName)} — Nishchay Academy`;
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
  const container = document.querySelector('.page-container');

  try {
    // Load exam data to get syllabus URL
    const examSnap = await getDoc(doc(db, 'exams', examId));
    const examData = examSnap.exists() ? examSnap.data() : null;

    // Get syllabus links from examSyllabus
    const syllabusSnap = await getDocs(collection(db, 'examSyllabus'));
    const subjectIds = [];
    syllabusSnap.forEach(d => {
      const data = d.data();
      if (data.examId === examId) {
        subjectIds.push(data.subjectId);
      }
    });

    // Show syllabus PDF button if available
    if (examData?.syllabusUrl && container) {
      const syllabusBtn = document.createElement('div');
      syllabusBtn.style.cssText = 'margin-bottom:16px;';
      syllabusBtn.innerHTML = `
        <a href="${examData.syllabusUrl}" target="_blank"
          style="display:flex;align-items:center;gap:12px;
                 padding:14px 16px;
                 background:linear-gradient(135deg,#DC2626,#b91c1c);
                 border-radius:var(--radius-md);color:white;
                 text-decoration:none;
                 box-shadow:0 4px 12px rgba(220,38,38,0.3);">
          <span style="font-size:24px;">📄</span>
          <div>
            <div style="font-size:14px;font-weight:700;">
              Download Official Syllabus
            </div>
            <div style="font-size:12px;opacity:0.85;">
              PDF • Official document
            </div>
          </div>
          <span style="margin-left:auto;font-size:20px;">⬇️</span>
        </a>
      `;
      const loader = document.getElementById('skeletonLoader');
      if (loader) container.insertBefore(syllabusBtn, loader);
    }

    if (subjectIds.length === 0) {
      skeletonLoader.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    // Get all subjects
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = [];
    subjectsSnap.forEach(d => {
      if (subjectIds.includes(d.id) &&
          d.data().isActive !== false) {
        subjects.push({ id: d.id, ...d.data() });
      }
    });
    subjects.sort((a, b) => (a.order||0) - (b.order||0));

    skeletonLoader.style.display = 'none';

    if (subjects.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

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

      html += `
        <div class="exam-body-card card-clickable"
          onclick="window.location.href='topic.html?subjectId=${data.id}&subjectName=${encodeURIComponent(data.name)}&examId=${examId}&examName=${encodeURIComponent(examName)}'">
          <div class="exam-body-icon"
            style="background:${color}; font-size:24px;">
            📚
          </div>
          <div class="exam-body-info">
            <h3>${data.name}</h3>
            <p>${data.description || 'Click to see topics'}</p>
          </div>
          <svg class="exam-body-arrow" width="20" height="20"
            viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </div>
      `;
    });

    subjectsList.innerHTML = html;
    subjectsList.style.display = 'flex';

  } catch(error) {
    skeletonLoader.style.display = 'none';
    emptyState.style.display = 'block';
    console.error('Error loading subjects:', error);
  }
}