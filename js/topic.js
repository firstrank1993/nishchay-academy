// ============================================
// NISHCHAY ACADEMY — Topic Page
// ============================================

import { db } from './firebase-config.js';
import {
  collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const subjectId = urlParams.get('subjectId');
const subjectName = urlParams.get('subjectName');
const examId = urlParams.get('examId');
const examName = urlParams.get('examName');

document.addEventListener('DOMContentLoaded', async () => {
  if (subjectName) {
    document.getElementById('pageTitle').textContent =
      decodeURIComponent(subjectName);
    document.getElementById('sectionTitle').textContent =
      decodeURIComponent(subjectName);
    document.title =
      `${decodeURIComponent(subjectName)} — Nishchay Academy`;
  }

  if (!subjectId) {
    window.location.href = 'index.html';
    return;
  }

  await loadTopics();
});

async function loadTopics() {
  const skeletonLoader = document.getElementById('skeletonLoader');
  const topicsList = document.getElementById('topicsList');
  const emptyState = document.getElementById('emptyState');

  try {
    const snapshot = await getDocs(collection(db, 'topics'));
    const topics = [];

    snapshot.forEach(d => {
      const data = d.data();
      if (data.subjectId === subjectId &&
          data.isActive !== false) {
        topics.push({ id: d.id, ...data });
      }
    });

    topics.sort((a, b) => (a.order||0) - (b.order||0));

    skeletonLoader.style.display = 'none';

    if (topics.length === 0) {
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
    topics.forEach((data, index) => {
      const color = colors[index % colors.length];

      html += `
        <div class="exam-body-card card-clickable"
          onclick="window.location.href='topic-detail.html?topicId=${data.id}&topicName=${encodeURIComponent(data.name)}&subjectId=${subjectId}&subjectName=${encodeURIComponent(subjectName)}&examId=${examId}&examName=${encodeURIComponent(examName)}'">
          <div class="exam-body-icon"
            style="background:${color}; font-size:24px;">
            📖
          </div>
          <div class="exam-body-info">
            <h3>${data.name}</h3>
            <p>${data.description || 'Study • Practice • Test'}</p>
          </div>
          <svg class="exam-body-arrow" width="20" height="20"
            viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </div>
      `;
    });

    topicsList.innerHTML = html;
    topicsList.style.display = 'flex';

  } catch(error) {
    skeletonLoader.style.display = 'none';
    emptyState.style.display = 'block';
    console.error('Error loading topics:', error);
  }
}