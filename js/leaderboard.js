import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser  = null;
let currentField = 'weeklyPoints';

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  loadLeaderboard('weeklyPoints');
});

window.switchTab = function(tab) {
  const map = { weekly:'weeklyPoints', monthly:'monthlyPoints', alltime:'totalPoints' };
  ['weekly','monthly','alltime'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const active = t === tab;
    el.style.cssText = `
      flex:1;padding:8px 4px;border:none;border-radius:var(--radius-sm);
      font-size:13px;cursor:pointer;font-family:Inter,sans-serif;
      ${active ? 'background:var(--primary);color:white;font-weight:700;'
               : 'background:transparent;color:var(--text-secondary);font-weight:600;'}
    `;
  });
  currentField = map[tab];
  loadLeaderboard(currentField);
};

async function loadLeaderboard(field) {
  const loader = document.getElementById('leaderLoader');
  const list   = document.getElementById('leaderList');
  const empty  = document.getElementById('leaderEmpty');
  loader.style.display = 'block';
  list.style.display   = 'none';
  empty.style.display  = 'none';

  try {
    const snap = await getDocs(query(
      collection(db, 'leaderboard'),
      orderBy(field, 'desc'),
      limit(50)
    ));
    loader.style.display = 'none';
    if (snap.empty) { empty.style.display = 'block'; return; }

    const entries = [];
    snap.forEach(d => entries.push({ id: d.id, ...d.data() }));

    // Podium
    renderPodium(entries, field);

    // My rank
    if (currentUser) {
      const myIdx = entries.findIndex(e => e.id === currentUser.uid);
      if (myIdx !== -1) {
        document.getElementById('myRankCard').style.display = 'block';
        document.getElementById('myRankNum').textContent    = `#${myIdx + 1}`;
        document.getElementById('myRankPts').textContent    =
          `${entries[myIdx][field] || 0} points`;
      }
    }

    // Full list
    const medals = ['🥇','🥈','🥉'];
    list.innerHTML = '';
    entries.forEach((e, i) => {
      const isMe = currentUser && e.id === currentUser.uid;
      const card = document.createElement('div');
      card.style.cssText = `
        background:${isMe ? '#eff6ff' : 'white'};
        border:1.5px solid ${isMe ? 'var(--primary)' : 'var(--border)'};
        border-radius:var(--radius-md);padding:12px 14px;
        display:flex;align-items:center;gap:12px;
      `;
      card.innerHTML = `
        <div style="font-size:${i<3?'20':'14'}px;font-weight:800;min-width:32px;
                    text-align:center;color:${i<3?'inherit':'var(--text-secondary)'};">
          ${i < 3 ? medals[i] : `#${i+1}`}
        </div>
        <div style="flex:1;min-width:0;">
          <p style="font-size:14px;font-weight:700;overflow:hidden;
                    text-overflow:ellipsis;white-space:nowrap;">
            ${e.fullName || 'Student'}${isMe ? ' (You)' : ''}
          </p>
          <p style="font-size:11px;color:var(--text-secondary);margin-top:2px;">
            ${e.district || 'Gujarat'} · 🔥 ${e.currentStreak || 0} day streak
          </p>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <p style="font-size:16px;font-weight:800;color:var(--primary);">
            ${e[field] || 0}
          </p>
          <p style="font-size:10px;color:var(--text-secondary);">pts</p>
        </div>
      `;
      list.appendChild(card);
    });
    list.style.display = 'flex';
  } catch(e) {
    console.error('Leaderboard error:', e);
    document.getElementById('leaderLoader').style.display = 'none';
    document.getElementById('leaderEmpty').style.display  = 'block';
  }
}

function renderPodium(entries, field) {
  if (entries.length < 1) return;
  document.getElementById('podiumSection').style.display = 'block';
  const fill = (prefix, entry) => {
    if (!entry) return;
    document.getElementById(`${prefix}name`).textContent =
      (entry.fullName || 'Student').split(' ')[0];
    document.getElementById(`${prefix}pts`).textContent  =
      `${entry[field] || 0} pts`;
    document.getElementById(`${prefix}dist`).textContent =
      entry.district || '';
  };
  fill('p1', entries[0]);
  fill('p2', entries[1]);
  fill('p3', entries[2]);
}

window.showToast = function(msg, type='info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`; t.textContent = msg;
  c.appendChild(t); setTimeout(() => t.remove(), 3000);
};
