// ============================================
// NISHCHAY ACADEMY — Topic Detail Page
// ============================================

import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const topicId = urlParams.get('topicId');
const topicName = urlParams.get('topicName');
const subjectName = urlParams.get('subjectName');
const examName = urlParams.get('examName');
const subjectId = urlParams.get('subjectId');
const examId = urlParams.get('examId');

document.addEventListener('DOMContentLoaded', async () => {
  if (!topicId) {
    window.location.href = 'index.html';
    return;
  }

  // Set page info
  const decodedTopic = decodeURIComponent(topicName || '');
  const decodedSubject = decodeURIComponent(subjectName || '');
  const decodedExam = decodeURIComponent(examName || '');

  document.getElementById('pageTitle').textContent = decodedTopic;
  document.getElementById('topicTitle').textContent = decodedTopic;
  document.getElementById('breadcrumb').textContent = `${decodedExam} → ${decodedSubject}`;
  document.title = `${decodedTopic} — Nishchay Academy`;

  // Set button links
  document.getElementById('pyqBtn').onclick = () => {
    window.location.href = `practice.html?topicId=${topicId}&topicName=${topicName}&type=PYQ`;
  };

  document.getElementById('impBtn').onclick = () => {
    window.location.href = `practice.html?topicId=${topicId}&topicName=${topicName}&type=IMP`;
  };

  document.getElementById('testBtn').onclick = () => {
    window.location.href = `test.html?topicId=${topicId}&topicName=${topicName}`;
  };

  await loadMaterials();
});

// Scroll to section helper
window.scrollToSection = function(sectionId) {
  document.getElementById(sectionId).scrollIntoView({ behavior: 'smooth' });
};

async function loadMaterials() {
  const loader = document.getElementById('materialsLoader');
  const list = document.getElementById('materialsList');
  const empty = document.getElementById('materialsEmpty');

  try {
    const snapshot = await getDocs(collection(db, 'studyMaterials'));
    const materials = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.topicId === topicId && data.isActive !== false) {
        materials.push({ id: doc.id, ...data });
      }
    });

    materials.sort((a, b) => (a.order || 0) - (b.order || 0));

    loader.style.display = 'none';

    if (materials.length === 0) {
      empty.style.display = 'block';
      return;
    }

    let html = '';
    materials.forEach(data => {
      if (data.type === 'youtube') {
        html += `
          <div class="card" style="display:flex; align-items:center; gap:14px; cursor:pointer;"
               onclick="window.open('${data.youtubeUrl}', '_blank')">
            <div style="width:48px; height:48px; background:#FF0000; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <span style="color:white; font-size:20px;">▶</span>
            </div>
            <div>
              <div style="font-size:14px; font-weight:600;">${data.title}</div>
              <div style="font-size:12px; color:var(--text-secondary);">YouTube Video</div>
            </div>
          </div>`;
      } else if (data.type === 'pdf') {
        html += `
          <div class="card" style="display:flex; align-items:center; gap:14px; cursor:pointer;"
               onclick="window.open('${data.fileUrl}', '_blank')">
            <div style="width:48px; height:48px; background:#DC2626; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <span style="color:white; font-size:14px; font-weight:700;">PDF</span>
            </div>
            <div>
              <div style="font-size:14px; font-weight:600;">${data.title}</div>
              <div style="font-size:12px; color:var(--text-secondary);">PDF Document</div>
            </div>
          </div>`;
      } else if (data.type === 'text') {
        html += `
          <div class="card">
            <div style="font-size:14px; font-weight:600; margin-bottom:8px;">${data.title}</div>
            <div style="font-size:13px; color:var(--text-secondary); line-height:1.7;">${data.content}</div>
          </div>`;
      }
    });

    list.innerHTML = html;
    list.style.display = 'flex';

  } catch (error) {
    loader.style.display = 'none';
    empty.style.display = 'block';
    console.error('Error loading materials:', error);
  }
}
