// ============================================
// NISHCHAY ACADEMY — Result Page
// ============================================

import { db } from './firebase-config.js';
import {
  doc, getDoc, collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const attemptId = urlParams.get('attemptId');
let attemptData = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!attemptId) {
    window.location.href = 'my-results.html';
    return;
  }
  await loadResult();
});

async function loadResult() {
  try {
    const attemptSnap = await getDoc(
      doc(db, 'testAttempts', attemptId)
    );
    if (!attemptSnap.exists()) {
      window.location.href = 'my-results.html';
      return;
    }

    attemptData = { id: attemptSnap.id, ...attemptSnap.data() };

    document.getElementById('resultLoader').style.display = 'none';
    document.getElementById('resultContent').style.display = 'block';

    // Fill basic stats
    document.getElementById('resultTestTitle').textContent =
      attemptData.testTitle || 'Test Result';
    document.getElementById('resultScore').textContent =
      attemptData.totalScore;
    document.getElementById('resultMarks').textContent =
      `out of ${attemptData.totalMarks} marks`;
    document.getElementById('resultCorrect').textContent =
      attemptData.correct || 0;
    document.getElementById('resultWrong').textContent =
      attemptData.wrong || 0;

    // Skipped = 5th option selected (no negative)
    // Unattempted = completely blank (negative applied)
    const skipped = attemptData.skipped || 0;
    const unattempted = attemptData.unattempted || 0;
    document.getElementById('resultUnattempted').textContent =
      skipped + unattempted;

    document.getElementById('resultAccuracy').textContent =
      `${attemptData.accuracy || 0}%`;

    // Show total time taken
    if (attemptData.totalTimeTaken) {
      const mins = Math.floor(attemptData.totalTimeTaken / 60);
      const secs = attemptData.totalTimeTaken % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      const statsGrid = document.getElementById('statsGrid');
      if (statsGrid) {
        const timeCard = document.createElement('div');
        timeCard.className = 'card';
        timeCard.style.cssText =
          'text-align:center; grid-column:span 2;';
        timeCard.innerHTML = `
          <div style="font-size:22px;font-weight:800;color:#7C3AED;">
            ⏱ ${timeStr}
          </div>
          <div style="font-size:12px;color:var(--text-secondary);">
            Total Time Taken
          </div>
        `;
        statsGrid.appendChild(timeCard);
      }
    }

    // Show skipped vs unattempted breakdown
    if (skipped > 0 || unattempted > 0) {
      const statsGrid = document.getElementById('statsGrid');
      if (statsGrid) {
        const breakdownCard = document.createElement('div');
        breakdownCard.className = 'card';
        breakdownCard.style.cssText =
          'grid-column:span 2; padding:12px;';
        breakdownCard.innerHTML = `
          <div style="font-size:12px;font-weight:700;
                      margin-bottom:8px;color:var(--text-primary);">
            Unattempted Breakdown
          </div>
          <div style="display:flex;gap:16px;">
            <div style="text-align:center;">
              <div style="font-size:18px;font-weight:800;
                          color:#0284C7;">${skipped}</div>
              <div style="font-size:11px;color:var(--text-secondary);">
                Skipped (E)<br/>
                <span style="color:var(--success);font-size:10px;">
                  No negative
                </span>
              </div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:18px;font-weight:800;
                          color:#DC2626;">${unattempted}</div>
              <div style="font-size:11px;color:var(--text-secondary);">
                Left Blank<br/>
                <span style="color:var(--danger);font-size:10px;">
                  Negative applied
                </span>
              </div>
            </div>
          </div>
        `;
        statsGrid.appendChild(breakdownCard);
      }
    }

    // Rank board button
    const rankBtn = document.getElementById('viewRankBtn');
    if (rankBtn) {
      rankBtn.style.display = 'block';
      rankBtn.style.background = '#F3E8FF';
      rankBtn.style.color = '#7C3AED';
      rankBtn.style.border = '1.5px solid #DDD6FE';
      rankBtn.onclick = () => {
        window.location.href =
          `rankboard.html?testId=${attemptData.testId}`;
      };
    }

    // Calculate rank
    await calculateRank(attemptData);

    // Draw chart
    const ctx = document.getElementById('resultChart')
      .getContext('2d');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [
          'Correct',
          'Wrong',
          'Skipped (E)',
          'Left Blank'
        ],
        datasets: [{
          data: [
            attemptData.correct || 0,
            attemptData.wrong || 0,
            skipped,
            unattempted
          ],
          backgroundColor: [
            '#16A34A',
            '#DC2626',
            '#0284C7',
            '#94A3B8'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        cutout: '65%'
      }
    });

    // Load answer review
    if (attemptData.answers) {
      await loadAnswerReview(attemptData.answers);
    }

  } catch(e) {
    console.error(e);
  }
}

// ── CALCULATE RANK ──
async function calculateRank(attempt) {
  try {
    const snap = await getDocs(collection(db, 'testAttempts'));
    const allAttempts = [];

    snap.forEach(d => {
      const data = d.data();
      if (data.testId === attempt.testId) {
        allAttempts.push({ id: d.id, ...data });
      }
    });

    allAttempts.sort((a, b) => {
      if (b.totalScore !== a.totalScore)
        return b.totalScore - a.totalScore;
      return (b.accuracy||0) - (a.accuracy||0);
    });

    const rank =
      allAttempts.findIndex(a => a.id === attempt.id) + 1;
    const total = allAttempts.length;

    if (rank > 0) {
      const banner = document.getElementById('resultBanner');
      if (banner) {
        const rankDiv = document.createElement('div');
        rankDiv.style.cssText = `
          margin-top:12px; padding:8px 16px;
          background:rgba(255,255,255,0.15);
          border-radius:20px; display:inline-block;
          font-size:14px; font-weight:600;
        `;
        rankDiv.innerHTML =
          `🏆 Rank <strong>#${rank}</strong> out of ${total} students`;
        banner.appendChild(rankDiv);
      }
    }
  } catch(e) { console.error(e); }
}

// ── ANSWER REVIEW ──
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
      const status = answer.status || 'unattempted';
      const selectedOpt = answer.selectedOption;
      const isCorrect = answer.isCorrect;

      // Time taken
      const timeTaken = answer.timeTaken || 0;
      const timeDisplay = timeTaken >= 60
        ? `${Math.floor(timeTaken/60)}m ${timeTaken%60}s`
        : `${timeTaken}s`;

      // Status display
      let statusBadge = '';
      let borderColor = 'var(--border)';

      if (status === 'correct') {
        statusBadge = `<span class="badge badge-success">✓ Correct</span>`;
        borderColor = 'var(--success)';
      } else if (status === 'wrong') {
        statusBadge = `<span class="badge badge-danger">✗ Wrong</span>`;
        borderColor = 'var(--danger)';
      } else if (status === 'skipped') {
        statusBadge = `
          <span class="badge"
            style="background:#E0F2FE;color:#0284C7;">
            E Skipped
          </span>`;
        borderColor = '#0284C7';
      } else {
        statusBadge = `<span class="badge badge-warning">Left Blank</span>`;
        borderColor = 'var(--warning)';
      }

      html += `
        <div class="card"
          style="border-left:4px solid ${borderColor};">

          <div style="display:flex;justify-content:space-between;
                      margin-bottom:8px;flex-wrap:wrap;gap:6px;">
            ${statusBadge}
            <div style="display:flex;gap:8px;align-items:center;">
              <span style="font-size:12px;
                           color:var(--text-secondary);">
                ⏱ ${timeDisplay}
              </span>
              <span style="font-size:12px;
                           color:var(--text-secondary);">
                ${answer.marksAwarded > 0 ? '+' : ''}
                ${answer.marksAwarded} marks
              </span>
            </div>
          </div>

          <p style="font-size:14px;font-weight:600;
                    margin-bottom:10px;line-height:1.5;">
            ${q.questionText}
          </p>

          <div style="display:flex;flex-direction:column;gap:6px;">
            ${q.options.map((opt, i) => `
              <div style="padding:8px 12px;border-radius:8px;
                          font-size:13px;
                background:${i === q.correctOption
                  ? '#DCFCE7'
                  : i === selectedOpt && status === 'wrong'
                  ? '#FEE2E2'
                  : '#F8FAFC'};
                color:${i === q.correctOption
                  ? 'var(--success)'
                  : i === selectedOpt && status === 'wrong'
                  ? 'var(--danger)'
                  : 'var(--text-secondary)'};
                border:1px solid ${i === q.correctOption
                  ? '#BBF7D0'
                  : i === selectedOpt && status === 'wrong'
                  ? '#FECACA'
                  : 'var(--border)'};">
                <strong>${optLabels[i]}.</strong> ${opt}
                ${i === q.correctOption ? ' ✓' : ''}
                ${i === selectedOpt && status === 'wrong'
                  ? ' ✗' : ''}
              </div>
            `).join('')}

            ${status === 'skipped' ? `
              <div style="padding:8px 12px;border-radius:8px;
                          font-size:13px;background:#E0F2FE;
                          color:#0284C7;border:1px solid #BAE6FD;">
                <strong>E.</strong> I don't want to attempt
                <span style="font-size:11px;margin-left:6px;
                       background:#DCFCE7;color:var(--success);
                       padding:2px 6px;border-radius:4px;">
                  No negative marks ✓
                </span>
              </div>
            ` : ''}
          </div>

          ${q.explanation ? `
            <div style="margin-top:10px;padding:10px;
                        background:#EFF6FF;border-radius:8px;
                        font-size:12px;color:var(--primary);
                        line-height:1.6;">
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