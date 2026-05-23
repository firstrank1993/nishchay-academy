// ============================================
// NISHCHAY ACADEMY — Result Page
// ============================================

import { db } from './firebase-config.js';
import {
  doc, getDoc, collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const attemptId = urlParams.get('attemptId');

document.addEventListener('DOMContentLoaded', async () => {
  if (!attemptId) {
    window.location.href = 'my-results.html';
    return;
  }
  await loadResult();
});

async function loadResult() {
  try {
    const attemptSnap = await getDoc(doc(db, 'testAttempts', attemptId));
    if (!attemptSnap.exists()) {
      window.location.href = 'my-results.html';
      return;
    }

    const attempt = { id: attemptSnap.id, ...attemptSnap.data() };

    // Show content
    document.getElementById('resultLoader').style.display = 'none';
    document.getElementById('resultContent').style.display = 'block';

    // Fill stats
    document.getElementById('resultTestTitle').textContent = attempt.testTitle || 'Test Result';
    document.getElementById('resultScore').textContent = attempt.totalScore;
    document.getElementById('resultMarks').textContent = `out of ${attempt.totalMarks} marks`;
    document.getElementById('resultCorrect').textContent = attempt.correct || 0;
    document.getElementById('resultWrong').textContent = attempt.wrong || 0;
    document.getElementById('resultUnattempted').textContent = attempt.unattempted || 0;
    document.getElementById('resultAccuracy').textContent = `${attempt.accuracy || 0}%`;

    // Draw chart
    const ctx = document.getElementById('resultChart').getContext('2d');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Correct', 'Wrong', 'Skipped'],
        datasets: [{
          data: [attempt.correct||0, attempt.wrong||0, attempt.unattempted||0],
          backgroundColor: ['#16A34A', '#DC2626', '#94A3B8'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        },
        cutout: '65%'
      }
    });

    // Load question review
    if (attempt.answers) {
      await loadAnswerReview(attempt.answers);
    }

  } catch(e) {
    console.error(e);
  }
}

async function loadAnswerReview(answers) {
  const reviewContainer = document.getElementById('answerReview');
  const questionIds = Object.keys(answers);

  if (questionIds.length === 0) return;

  const optLabels = ['A','B','C','D'];
  let html = '';

  for (const qId of questionIds) {
    try {
      const qSnap = await getDoc(doc(db, 'questions', qId));
      if (!qSnap.exists()) continue;

      const q = qSnap.data();
      const answer = answers[qId];
      const isCorrect = answer.isCorrect;
      const selectedOpt = answer.selectedOption;

      html += `
        <div class="card" style="border-left:4px solid ${isCorrect ? 'var(--success)' : selectedOpt === -1 ? 'var(--border)' : 'var(--danger)'};">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span class="badge ${isCorrect ? 'badge-success' : selectedOpt === -1 ? 'badge-primary' : 'badge-danger'}">
              ${isCorrect ? '✓ Correct' : selectedOpt === -1 ? 'Skipped' : '✗ Wrong'}
            </span>
            <span style="font-size:12px; color:var(--text-secondary);">${answer.marksAwarded > 0 ? '+' : ''}${answer.marksAwarded} marks</span>
          </div>
          <p style="font-size:14px; font-weight:600; margin-bottom:10px; line-height:1.5;">${q.questionText}</p>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${q.options.map((opt, i) => `
              <div style="padding:8px 12px; border-radius:8px; font-size:13px;
                background:${i === q.correctOption ? '#DCFCE7' : i === selectedOpt && !isCorrect ? '#FEE2E2' : '#F8FAFC'};
                color:${i === q.correctOption ? 'var(--success)' : i === selectedOpt && !isCorrect ? 'var(--danger)' : 'var(--text-secondary)'};
                border:1px solid ${i === q.correctOption ? '#BBF7D0' : i === selectedOpt && !isCorrect ? '#FECACA' : 'var(--border)'};">
                <strong>${optLabels[i]}.</strong> ${opt}
                ${i === q.correctOption ? ' ✓' : ''}
                ${i === selectedOpt && !isCorrect ? ' ✗' : ''}
              </div>
            `).join('')}
          </div>
          ${q.explanation ? `
            <div style="margin-top:10px; padding:10px; background:#EFF6FF; border-radius:8px; font-size:12px; color:var(--primary); line-height:1.6;">
              💡 ${q.explanation}
            </div>
          ` : ''}
        </div>
      `;
    } catch(e) { console.error(e); }
  }

  reviewContainer.innerHTML = html;
  reviewContainer.style.display = 'flex';
}