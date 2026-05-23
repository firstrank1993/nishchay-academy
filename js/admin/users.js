// ============================================
// NISHCHAY ACADEMY — Admin Users
// ============================================

import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let usersCache = [];
let attemptsCache = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  await loadUsers();
  await loadAttempts();
});

async function loadUsers() {
  const loader = document.getElementById('usersLoader');
  const list = document.getElementById('usersList');
  const empty = document.getElementById('usersEmpty');

  try {
    const snap = await getDocs(collection(db, 'users'));
    usersCache = [];
    snap.forEach(d => usersCache.push({ id: d.id, ...d.data() }));

    // Sort by newest first
    usersCache.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });

    document.getElementById('totalUsers').textContent = usersCache.length;

    loader.style.display = 'none';

    if (usersCache.length === 0) {
      empty.style.display = 'block';
      return;
    }

    document.getElementById('usersCount').textContent =
      `${usersCache.length} student${usersCache.length !== 1 ? 's' : ''} registered`;

    renderUsers(usersCache);

  } catch(e) {
    console.error(e);
    loader.style.display = 'none';
    empty.style.display = 'block';
  }
}

async function loadAttempts() {
  try {
    const snap = await getDocs(collection(db, 'testAttempts'));
    attemptsCache = [];
    snap.forEach(d => attemptsCache.push({ id: d.id, ...d.data() }));
    document.getElementById('totalAttempts').textContent = attemptsCache.length;
  } catch(e) { console.error(e); }
}

function renderUsers(users) {
  const list = document.getElementById('usersList');

  if (users.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:20px;">No users found</p>';
    list.style.display = 'flex';
    return;
  }

  list.innerHTML = users.map(u => {
    const userAttempts = attemptsCache.filter(a => a.userId === u.id).length;
    const joinDate = u.createdAt?.toDate
      ? u.createdAt.toDate().toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric'
        })
      : 'Unknown';

    const initials = (u.fullName || u.email || 'U')
      .substring(0, 2).toUpperCase();

    return `
      <div class="card">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
          <div style="width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,var(--primary),var(--primary-dark)); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:14px; flex-shrink:0;">
            ${u.photoUrl
              ? `<img src="${u.photoUrl}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">`
              : initials}
          </div>
          <div style="flex:1;">
            <h3 style="font-size:14px; font-weight:700;">${u.fullName || 'No name set'}</h3>
            <p style="font-size:12px; color:var(--text-secondary);">${u.email || ''}</p>
          </div>
          ${u.isBlocked
            ? '<span class="badge badge-danger">Blocked</span>'
            : '<span class="badge badge-success">Active</span>'}
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:10px;">
          <div style="text-align:center; padding:8px; background:var(--bg); border-radius:8px;">
            <div style="font-size:14px; font-weight:700; color:var(--primary);">${userAttempts}</div>
            <div style="font-size:10px; color:var(--text-secondary);">Tests</div>
          </div>
          <div style="text-align:center; padding:8px; background:var(--bg); border-radius:8px;">
            <div style="font-size:11px; font-weight:600; color:var(--text-primary);">${u.district || '-'}</div>
            <div style="font-size:10px; color:var(--text-secondary);">District</div>
          </div>
          <div style="text-align:center; padding:8px; background:var(--bg); border-radius:8px;">
            <div style="font-size:11px; font-weight:600; color:var(--text-primary);">${u.qualification || '-'}</div>
            <div style="font-size:10px; color:var(--text-secondary);">Education</div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; color:var(--text-secondary);">Joined: ${joinDate}</span>
          <button
            onclick="toggleBlock('${u.id}', ${u.isBlocked || false})"
            class="btn btn-sm"
            style="background:${u.isBlocked ? '#DCFCE7' : '#FEE2E2'};
                   color:${u.isBlocked ? 'var(--success)' : '#DC2626'};
                   border:none;">
            ${u.isBlocked ? 'Unblock' : 'Block'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  list.style.display = 'flex';
}

window.searchUsers = function() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();

  if (!query) {
    renderUsers(usersCache);
    document.getElementById('usersCount').textContent =
      `${usersCache.length} student${usersCache.length !== 1 ? 's' : ''} registered`;
    return;
  }

  const filtered = usersCache.filter(u =>
    (u.fullName || '').toLowerCase().includes(query) ||
    (u.email || '').toLowerCase().includes(query) ||
    (u.district || '').toLowerCase().includes(query) ||
    (u.mobile || '').includes(query)
  );

  document.getElementById('usersCount').textContent =
    `${filtered.length} result${filtered.length !== 1 ? 's' : ''} found`;

  renderUsers(filtered);
};

window.toggleBlock = async function(userId, isBlocked) {
  const action = isBlocked ? 'unblock' : 'block';
  if (!confirm(`Are you sure you want to ${action} this user?`)) return;

  try {
    await updateDoc(doc(db, 'users', userId), { isBlocked: !isBlocked });
    showToast(`User ${action}ed successfully!`, 'success');

    // Update local cache
    const user = usersCache.find(u => u.id === userId);
    if (user) user.isBlocked = !isBlocked;
    renderUsers(usersCache);

  } catch(e) {
    showToast('Error updating user', 'error');
    console.error(e);
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