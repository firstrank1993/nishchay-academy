// ============================================
// NISHCHAY ACADEMY — Rank Board
// ============================================

import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let testsCache = [];
let currentTestData = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadTests();

  // Check if testId in URL
  const urlParams = new URLSearchParams(window.location.search);
  const testId = urlParams.get('testId');
  if (testId) {
    document.getElementById('testSelect').value = testId;
    await loadRankBoard();
  }
});

async function loadTests() {
  try {
    const snap = await getDocs(collection(db, 'tests'));
    testsCache = [];
    snap.forEach(d => {
      if (d.data().isActive) {
        testsCache.push({ id: d.id, ...d.data() });
      }
    });
    testsCache.sort((a, b) =>
      (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)
    );

    const sel = document.getElementById('testSelect');
    testsCache.forEach(t => {
      sel.innerHTML += `<option value="${t.id}">${t.title}</option>`;
    });
  } catch(e) { console.error(e); }
}

window.loadRankBoard = async function() {
  const testId = document.getElementById('testSelect').value;
  if (!testId) return;

  const loader = document.getElementById('rankLoader');
  const content = document.getElementById('rankContent');
  const empty = document.getElementById('rankEmpty');

  loader.style.display = 'block';
  content.style.display = 'none';
  empty.style.display = 'none';

  try {
    // Get test data
    const testSnap = await getDoc(doc(db, 'tests', testId));
    if (!testSnap.exists()) return;
    currentTestData = { id: testSnap.id, ...testSnap.data() };

    // Get all attempts for this test
    const attemptsSnap = await getDocs(collection(db, 'testAttempts'));
    const attempts = [];

    // Get best attempt per user
    const userBestAttempt = {};

    attemptsSnap.forEach(d => {
      const data = d.data();
      if (data.testId === testId) {
        const uid = data.userId;
        if (!userBestAttempt[uid] ||
            data.totalScore > userBestAttempt[uid].totalScore) {
          userBestAttempt[uid] = { id: d.id, ...data };
        }
      }
    });

    // Convert to array and sort
    Object.values(userBestAttempt).forEach(a => attempts.push(a));
    attempts.sort((a, b) => {
      if (b.totalScore !== a.totalScore)
        return b.totalScore - a.totalScore;
      if (b.accuracy !== a.accuracy)
        return (b.accuracy||0) - (a.accuracy||0);
      return (a.totalTimeTaken||0) - (b.totalTimeTaken||0);
    });

    loader.style.display = 'none';

    if (attempts.length === 0) {
      empty.style.display = 'block';
      return;
    }

    // Load user names
    const usersSnap = await getDocs(collection(db, 'users'));
    const usersMap = {};
    usersSnap.forEach(d => {
      usersMap[d.id] = d.data();
    });

    // Fill test info
    document.getElementById('rankTestTitle').textContent =
      currentTestData.title;
    document.getElementById('rankTestInfo').textContent =
      `${currentTestData.totalMarks} marks • ${attempts.length} participants`;
    document.getElementById('totalParticipants').textContent =
      `${attempts.length} students`;

    // Fill podium (top 3)
    if (attempts.length >= 1) {
      document.getElementById('podiumSection').style.display = 'block';
      fillPodium(attempts, usersMap);
    }

    // Fill full rankings
    renderRankList(attempts, usersMap);

    content.style.display = 'block';

  } catch(e) {
    loader.style.display = 'none';
    empty.style.display = 'block';
    console.error(e);
  }
};

function fillPodium(attempts, usersMap) {
  const positions = [
    { rank: 1, nameId: 'rank1Name', scoreId: 'rank1Score' },
    { rank: 2, nameId: 'rank2Name', scoreId: 'rank2Score' },
    { rank: 3, nameId: 'rank3Name', scoreId: 'rank3Score' },
  ];

  positions.forEach(pos => {
    const attempt = attempts[pos.rank - 1];
    if (!attempt) return;

    const user = usersMap[attempt.userId];
    const name = user?.fullName || 'Student';
    const timeTaken = attempt.totalTimeTaken || 0;
    const mins = Math.floor(timeTaken / 60);
    const secs = timeTaken % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    document.getElementById(pos.nameId).textContent =
      name.length > 12 ? name.substring(0, 12) + '...' : name;
    document.getElementById(pos.scoreId).textContent =
      `${attempt.totalScore} marks • ${attempt.accuracy}%`;
  });
}

function renderRankList(attempts, usersMap) {
  const list = document.getElementById('rankList');

  const medalColors = ['#F59E0B', '#94A3B8', '#CD7C3E'];
  const medals = ['🥇', '🥈', '🥉'];

  list.innerHTML = attempts.map((attempt, index) => {
    const rank = index + 1;
    const user = usersMap[attempt.userId];
    const name = user?.fullName || 'Student';
    const district = user?.district || '';

    const timeTaken = attempt.totalTimeTaken || 0;
    const mins = Math.floor(timeTaken / 60);
    const secs = timeTaken % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

    const percentage = currentTestData.totalMarks > 0
      ? Math.round(
          (attempt.totalScore / currentTestData.totalMarks) * 100
        )
      : 0;

    const rankDisplay = rank <= 3
      ? `<span style="font-size:20px;">${medals[rank-1]}</span>`
      : `<span style="width:32px; height:32px; border-radius:50%;
           background:var(--primary-light); color:var(--primary);
           font-weight:800; font-size:13px;
           display:flex; align-items:center; justify-content:center;">
           ${rank}
         </span>`;

    return `
      <div class="card" style="display:flex; align-items:center; gap:12px;">
        ${rankDisplay}
        <div style="flex:1;">
          <div style="font-size:14px; font-weight:700;">${name}</div>
          <div style="font-size:11px; color:var(--text-secondary);">
            ${district ? district + ' • ' : ''}⏱ ${timeStr}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:15px; font-weight:800; color:var(--primary);">
            ${attempt.totalScore}
          </div>
          <div style="font-size:11px; color:var(--text-secondary);">
            ${attempt.accuracy}% accuracy
          </div>
        </div>
      </div>
    `;
  }).join('');

  list.style.display = 'flex';
}

window.shareRankBoard = function() {
  const testId = document.getElementById('testSelect').value;
  if (!testId) {
    showToast('Please select a test first', 'error');
    return;
  }

  const url = `https://nishchayacademydhg.web.app/rankboard.html?testId=${testId}`;
  const testTitle = currentTestData?.title || 'Mock Test';
  const message = `🏆 *Nishchay Academy — Rank Board*\n\n📝 *${testTitle}*\n\nSee the full rankings here:\n${url}`;

  if (navigator.share) {
    navigator.share({ title: 'Rank Board', text: message, url });
  } else {
    navigator.clipboard.writeText(message).then(() => {
      showToast('Rank board link copied!', 'success');
    });
  }
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