import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let subjectsCache = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  document.getElementById('adminEmail').textContent = user.email;
  const now = new Date();
  document.getElementById('autoDay').textContent   = now.getDate();
  document.getElementById('autoMonth').textContent = MONTHS[now.getMonth()+1];
  await loadSubjects();
  await loadEvents();
});

// Load subjects for dropdown
async function loadSubjects() {
  try {
    const snap = await getDocs(collection(db, 'subjects'));
    subjectsCache = [];
    snap.forEach(d => subjectsCache.push({ id: d.id, ...d.data() }));
    subjectsCache.sort((a, b) => (a.order||0) - (b.order||0));

    const sel = document.getElementById('histSubjectDropdown');
    if (sel) {
      sel.innerHTML = '<option value="">-- Select Subject (optional) --</option>';
      subjectsCache.forEach(s => {
        sel.innerHTML += `<option value="${s.name}">${s.name}</option>`;
      });
    }
  } catch(e) { console.error('Error loading subjects:', e); }
}

// FIX: Removed orderBy — sort client-side to avoid composite index error
async function loadEvents() {
  const loader = document.getElementById('histLoader');
  const list   = document.getElementById('histList');
  const empty  = document.getElementById('histEmpty');
  const count  = document.getElementById('eventCount');
  try {
    // No orderBy — avoids composite index requirement
    const snap = await getDocs(collection(db, 'historyEvents'));
    loader.style.display = 'none';
    if (snap.empty) { empty.style.display = 'block'; return; }

    const events = [];
    snap.forEach(d => events.push({ id: d.id, ...d.data() }));
    // Sort client-side by month then day
    events.sort((a, b) => a.month !== b.month ? a.month - b.month : a.day - b.day);

    count.textContent = `${events.length} event${events.length !== 1 ? 's' : ''}`;
    list.innerHTML = '';
    events.forEach(e => {
      const isActive = e.isActive !== false;
      const card = document.createElement('div');
      card.className = 'card';
      // FIX: Show full date instead of just year
      const fullDate = `${e.day} ${MONTHS[e.month]} ${e.year}`;
      card.innerHTML = `
        <div style="display:flex;gap:10px;align-items:flex-start;">
          ${e.imageUrl ? `<img src="${e.imageUrl}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;flex-shrink:0;"/>` : ''}
          <div style="flex:1;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
              <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;
                background:#fef3c7;color:#d97706;">📅 ${fullDate}</span>
              ${e.subject ? `<span style="font-size:11px;font-weight:700;padding:3px 8px;
                border-radius:99px;background:#f3e8ff;color:#7c3aed;">${e.subject}</span>` : ''}
              <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;
                background:${isActive ? '#dcfce7' : '#fee2e2'};
                color:${isActive ? '#15803d' : '#dc2626'};">
                ${isActive ? '✅ Active' : '❌ Inactive'}
              </span>
            </div>
            <p style="font-size:14px;font-weight:700;margin-bottom:4px;">${e.title}</p>
            <p style="font-size:12px;color:var(--text-secondary);">
              ${(e.description||'').substring(0,80)}${(e.description||'').length > 80 ? '...' : ''}
            </p>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
          <button onclick="toggleEvent('${e.id}',${isActive})" class="btn btn-sm"
            style="flex:1;border:none;background:${isActive ? '#fee2e2' : '#dcfce7'};
                   color:${isActive ? '#dc2626' : '#15803d'};">
            ${isActive ? '⏸ Deactivate' : '▶ Activate'}
          </button>
          <button onclick="deleteEvent('${e.id}')" class="btn btn-sm"
            style="background:#fee2e2;color:#dc2626;border:none;">🗑 Delete</button>
        </div>`;
      list.appendChild(card);
    });
    list.style.display = 'flex';
  } catch(e) {
    console.error(e);
    loader.style.display = 'none';
    showToast('Error loading events', 'error');
  }
}

window.addHistoryEvent = async function() {
  const now   = new Date();
  const day   = now.getDate();
  const month = now.getMonth() + 1;
  const year  = parseInt(document.getElementById('histYear').value);
  const title = document.getElementById('histTitle').value.trim();
  const desc  = document.getElementById('histDesc').value.trim();
  const image = document.getElementById('histImage').value.trim();

  // Subject: prefer dropdown, fallback to manual text
  const dropdown = document.getElementById('histSubjectDropdown').value;
  const manual   = document.getElementById('histSubject').value.trim();
  const subj     = dropdown || manual || null;

  if (!year)  { showToast('Please enter year', 'error'); return; }
  if (!title) { showToast('Please enter title', 'error'); return; }
  if (!desc)  { showToast('Please enter description', 'error'); return; }

  const btn = document.querySelector('button[onclick="addHistoryEvent()"]');
  btn.textContent = 'Saving...'; btn.disabled = true;
  try {
    await addDoc(collection(db, 'historyEvents'), {
      day, month, year, title, description: desc,
      subject: subj, imageUrl: image || null,
      isActive: true, createdAt: serverTimestamp()
    });
    ['histYear','histTitle','histDesc','histSubject','histImage'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('histSubjectDropdown').value = '';
    showToast('Event saved! ✅', 'success');
    document.getElementById('histList').style.display   = 'none';
    document.getElementById('histLoader').style.display = 'block';
    document.getElementById('histEmpty').style.display  = 'none';
    await loadEvents();
  } catch(e) {
    console.error(e);
    showToast('Error saving', 'error');
  } finally {
    btn.textContent = 'Save Event'; btn.disabled = false;
  }
};

// Sync dropdown to manual field when dropdown changes
window.onSubjectDropdownChange = function() {
  const dropdown = document.getElementById('histSubjectDropdown').value;
  if (dropdown) {
    document.getElementById('histSubject').value = dropdown;
  }
};

window.downloadHistoryTemplate = function() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Day','Month (1-12)','Year','Title','Description','Subject/Topic Tag','Image URL (optional)'],
    [11, 6, 1947, 'India gained independence', 'Brief description here', '📚 History', '']
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'History Events');
  XLSX.writeFile(wb, 'history-events-template.xlsx');
};

window.bulkUploadHistory = async function(event) {
  const file = event.target.files[0]; if (!file) return;
  const status = document.getElementById('bulkHistoryStatus');
  status.style.display = 'block'; status.style.background = '#fef9c3'; status.style.color = '#854d0e';
  status.textContent = 'Reading file...';
  try {
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    let success = 0, failed = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]; if (!row || row.length < 5) continue;
      try {
        const day   = parseInt(row[0]);
        const month = parseInt(row[1]);
        const year  = parseInt(row[2]);
        const title = String(row[3]||'').trim();
        const desc  = String(row[4]||'').trim();
        const subj  = String(row[5]||'').trim();
        const img   = String(row[6]||'').trim();
        if (!day||!month||!year||!title||!desc) { failed++; continue; }
        await addDoc(collection(db,'historyEvents'), {
          day, month, year, title, description: desc,
          subject: subj || null, imageUrl: img || null,
          isActive: true, createdAt: serverTimestamp()
        });
        success++;
        if (success % 5 === 0) status.textContent = `Uploading... ${success} done`;
      } catch(e) { failed++; }
    }
    status.style.background = '#dcfce7'; status.style.color = '#15803d';
    status.textContent = `✅ Done! ${success} uploaded.${failed > 0 ? ' ' + failed + ' failed.' : ''}`;
    document.getElementById('histList').style.display   = 'none';
    document.getElementById('histLoader').style.display = 'block';
    await loadEvents();
  } catch(e) {
    status.style.background = '#fee2e2'; status.style.color = '#dc2626';
    status.textContent = 'Error reading file.';
    console.error(e);
  }
  event.target.value = '';
};

window.toggleEvent = async function(id, current) {
  try {
    await updateDoc(doc(db,'historyEvents',id), { isActive: !current });
    showToast(current ? 'Deactivated' : 'Activated ✅', current ? 'info' : 'success');
    document.getElementById('histList').style.display   = 'none';
    document.getElementById('histLoader').style.display = 'block';
    await loadEvents();
  } catch(e) { showToast('Error', 'error'); }
};

window.deleteEvent = async function(id) {
  if (!confirm('Delete this event?')) return;
  try {
    await deleteDoc(doc(db,'historyEvents',id));
    showToast('Deleted', 'info');
    document.getElementById('histList').style.display   = 'none';
    document.getElementById('histLoader').style.display = 'block';
    await loadEvents();
  } catch(e) { showToast('Error', 'error'); }
};

window.showToast = function(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`; t.textContent = msg;
  c.appendChild(t); setTimeout(() => t.remove(), 3000);
};