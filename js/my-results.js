// ============================================
// NISHCHAY ACADEMY — My Results Page
// ============================================

import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    document.getElementById('notLoggedIn').style.display = 'block';
    return;
  }
  document.getElementById('loggedInContent').style.display = 'block';
  await loadResults(user.uid);
});

async function loadResults(userId) {
  const loader = document.getElementById('resultsLoader');
  const list = document.getElementById('resultsList');
  const empty = document.getElementById('resultsEmpty');

  try {
    const snap = await getDocs(collection(db, 'testAttempts'));
    const attempts = [];

    snap.forEach(d => {
      const data = d.data();
      if (data.userId === userId) {
        attempts.push({ id: d.id, ...data });
      }
    });

    // Sort by newest first
    attempts.sort((a, b) => {
      const aTime = a.submittedAt?.seconds || 0;
      const bTime = b.submittedAt?.seconds || 0;
      return bTime - aTime;
    });

    loader.style.display = 'none';

    if (attempts.length === 0) {
      empty.style.display = 'block';
      return;
    }

    // Calculate summary stats
    const totalAttempts = attempts.length;
    const avgAccuracy = Math.round(
      attempts.reduce((sum, a) => sum + (a.accuracy || 0), 0) / totalAttempts
    );
    const bestScore = Math.max(...attempts.map(a => a.totalScore || 0));
    const totalCorrect = attempts.reduce((sum, a) => sum + (a.correct || 0), 0);

    document.getElementById('totalAttempts').textContent = totalAttempts;
    document.getElementById('avgAccuracy').textContent = `${avgAccuracy}%`;
    document.getElementById('bestScore').textContent = bestScore;
    document.getElementById('totalCorrect').textContent = totalCorrect;

    // Build results list
    list.innerHTML = attempts.map(a => {
      const date = a.submittedAt?.toDate
        ? a.submittedAt.toDate().toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
          })
        : 'Unknown date';

      const percentage = a.totalMarks > 0
        ? Math.round((a.totalScore / a.totalMarks) * 100) : 0;

      const scoreColor = percentage >= 70
        ? 'var(--success)' : percentage >= 40
        ? 'var(--accent)' : 'var(--danger)';

      return `
        <div class="card card-clickable"
             onclick="window.location.href='result.html?attemptId=${a.id}'"
             style="display:flex; align-items:center; gap:14px;">
          <div style="width:52px; height:52px; border-radius:50%; background:${scoreColor}20; border:2px solid ${scoreColor}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <span style="font-size:13px; font-weight:800; color:${scoreColor};">${percentage}%</span>
          </div>
          <div style="flex:1;">
            <h3 style="font-size:14px; font-weight:700; margin-bottom:3px;">${a.testTitle || 'Test'}</h3>
            <p style="font-size:12px; color:var(--text-secondary);">
              ${a.totalScore}/${a.totalMarks} marks • ${a.correct||0} correct • ${date}
            </p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </div>
      `;
    }).join('');

    list.style.display = 'flex';

  } catch(e) {
    loader.style.display = 'none';
    empty.style.display = 'block';
    console.error(e);
  }
}