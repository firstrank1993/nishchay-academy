// ============================================
// NISHCHAY ACADEMY — Admin Study Materials
// ============================================

import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let subjectsCache = [];
let topicsCache = [];
let materialsCache = [];
let editingId = null;
let selectedMType = 'text';

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  await loadSubjects();
  await loadAllTopics();
  await loadMaterials();
});

async function loadSubjects() {
  const snap = await getDocs(collection(db, 'subjects'));
  subjectsCache = [];
  snap.forEach(d => subjectsCache.push({ id: d.id, ...d.data() }));

  const sel = document.getElementById('mSubjectSelect');
  const filterSel = document.getElementById('filterSubject');
  subjectsCache.forEach(s => {
    sel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    filterSel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
}

async function loadAllTopics() {
  const snap = await getDocs(collection(db, 'topics'));
  topicsCache = [];
  snap.forEach(d => topicsCache.push({ id: d.id, ...d.data() }));
}

async function loadMaterials() {
  const loader = document.getElementById('materialsLoader');
  const list = document.getElementById('materialsList');

  try {
    const snap = await getDocs(collection(db, 'studyMaterials'));
    materialsCache = [];
    snap.forEach(d => materialsCache.push({ id: d.id, ...d.data() }));
    materialsCache.sort((a, b) => (a.order||0) - (b.order||0));

    loader.style.display = 'none';
    renderMaterials(materialsCache);
  } catch(e) {
    console.error(e);
    loader.style.display = 'none';
  }
}

function renderMaterials(materials) {
  const list = document.getElementById('materialsList');
  const count = document.getElementById('materialsCount');

  count.textContent = `${materials.length} material${materials.length !== 1 ? 's' : ''} found`;

  if (materials.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:20px;">No materials yet</p>';
    list.style.display = 'flex';
    return;
  }

  const typeIcons = { text: '📝', youtube: '▶️', pdf: '📄' };
  const typeColors = {
    text: 'var(--primary)',
    youtube: '#DC2626',
    pdf: '#D97706'
  };

  list.innerHTML = materials.map(m => {
    const subject = subjectsCache.find(s => s.id === m.subjectId);
    const topic = topicsCache.find(t => t.id === m.topicId);

    return `
      <div class="card">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
          <div style="width:40px; height:40px; border-radius:8px; background:${typeColors[m.type] || 'var(--primary)'}20; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0;">
            ${typeIcons[m.type] || '📄'}
          </div>
          <div style="flex:1;">
            <div style="font-size:14px; font-weight:600;">${m.title}</div>
            <div style="font-size:12px; color:var(--text-secondary);">
              ${subject ? subject.name : ''} ${topic ? '→ ' + topic.name : ''}
            </div>
          </div>
          <span class="badge badge-primary" style="font-size:10px;">${m.type}</span>
        </div>
        ${m.type === 'text' ? `<p style="font-size:12px; color:var(--text-secondary); line-height:1.6;">${(m.content || '').substring(0, 100)}${(m.content||'').length > 100 ? '...' : ''}</p>` : ''}
        ${m.type === 'youtube' ? `<p style="font-size:12px; color:var(--text-secondary);">${m.youtubeUrl || ''}</p>` : ''}
        ${m.type === 'pdf' ? `<p style="font-size:12px; color:var(--text-secondary);">${(m.fileUrl || '').substring(0, 60)}...</p>` : ''}
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button onclick="editMaterial('${m.id}')" class="btn btn-sm btn-outline">Edit</button>
          <button onclick="deleteMaterial('${m.id}')" class="btn btn-sm" style="background:#FEE2E2;color:#DC2626;border:none;">Delete</button>
        </div>
      </div>
    `;
  }).join('');
  list.style.display = 'flex';
}

window.filterMaterials = function() {
  const subjectFilter = document.getElementById('filterSubject').value;
  const typeFilter = document.getElementById('filterType').value;

  const filtered = materialsCache.filter(m => {
    const matchSubject = !subjectFilter || m.subjectId === subjectFilter;
    const matchType = !typeFilter || m.type === typeFilter;
    return matchSubject && matchType;
  });

  renderMaterials(filtered);
};

window.selectMType = function(type) {
  selectedMType = type;
  ['text','youtube','pdf'].forEach(t => {
    const btn = document.getElementById(`type${t.charAt(0).toUpperCase() + t.slice(1)}`);
    btn.style.background = t === type ? 'var(--primary)' : 'transparent';
    btn.style.color = t === type ? 'white' : 'var(--primary)';
    btn.style.border = t === type ? 'none' : '1.5px solid var(--primary)';
  });
  document.getElementById('textSection').style.display = type === 'text' ? 'block' : 'none';
  document.getElementById('youtubeSection').style.display = type === 'youtube' ? 'block' : 'none';
  document.getElementById('pdfSection').style.display = type === 'pdf' ? 'block' : 'none';
};

window.loadTopicsForSubject = function() {
  const subjectId = document.getElementById('mSubjectSelect').value;
  const topicSelect = document.getElementById('mTopicSelect');
  topicSelect.innerHTML = '<option value="">Select Topic</option>';
  topicsCache
    .filter(t => t.subjectId === subjectId)
    .forEach(t => {
      topicSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });
};

window.showAddForm = function() {
  editingId = null;
  document.getElementById('formTitle').textContent = 'Add Study Material';
  document.getElementById('mTitle').value = '';
  document.getElementById('mContent').value = '';
  document.getElementById('mYoutubeUrl').value = '';
  document.getElementById('mFileUrl').value = '';
  document.getElementById('mOrder').value = '';
  document.getElementById('mSubjectSelect').value = '';
  document.getElementById('mTopicSelect').value = '';
  selectMType('text');
  document.getElementById('materialForm').style.display = 'block';
  document.getElementById('materialForm').scrollIntoView({ behavior: 'smooth' });
};

window.hideForm = function() {
  document.getElementById('materialForm').style.display = 'none';
  editingId = null;
};

window.editMaterial = function(id) {
  const m = materialsCache.find(x => x.id === id);
  if (!m) return;
  editingId = id;
  document.getElementById('formTitle').textContent = 'Edit Study Material';
  document.getElementById('mTitle').value = m.title || '';
  document.getElementById('mContent').value = m.content || '';
  document.getElementById('mYoutubeUrl').value = m.youtubeUrl || '';
  document.getElementById('mFileUrl').value = m.fileUrl || '';
  document.getElementById('mOrder').value = m.order || '';
  document.getElementById('mSubjectSelect').value = m.subjectId || '';
  loadTopicsForSubject();
  document.getElementById('mTopicSelect').value = m.topicId || '';
  selectMType(m.type || 'text');
  document.getElementById('materialForm').style.display = 'block';
  document.getElementById('materialForm').scrollIntoView({ behavior: 'smooth' });
};

window.saveMaterial = async function() {
  const title = document.getElementById('mTitle').value.trim();
  const subjectId = document.getElementById('mSubjectSelect').value;
  const topicId = document.getElementById('mTopicSelect').value;
  const order = parseInt(document.getElementById('mOrder').value) || 0;

  if (!title) { showToast('Enter a title', 'error'); return; }
  if (!subjectId) { showToast('Select a subject', 'error'); return; }
  if (!topicId) { showToast('Select a topic', 'error'); return; }

  const data = {
    title, subjectId, topicId, type: selectedMType, order, isActive: true
  };

  if (selectedMType === 'text') {
    const content = document.getElementById('mContent').value.trim();
    if (!content) { showToast('Enter content', 'error'); return; }
    data.content = content;
  } else if (selectedMType === 'youtube') {
    const url = document.getElementById('mYoutubeUrl').value.trim();
    if (!url) { showToast('Enter YouTube URL', 'error'); return; }
    data.youtubeUrl = url;
  } else if (selectedMType === 'pdf') {
    const url = document.getElementById('mFileUrl').value.trim();
    if (!url) { showToast('Enter file URL', 'error'); return; }
    data.fileUrl = url;
  }

  const btn = document.getElementById('saveMBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    if (editingId) {
      await updateDoc(doc(db, 'studyMaterials', editingId), data);
      showToast('Material updated!', 'success');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'studyMaterials'), data);
      showToast('Material added!', 'success');
    }
    hideForm();
    await loadMaterials();
  } catch(e) {
    showToast('Error saving', 'error');
    console.error(e);
  }

  btn.disabled = false; btn.textContent = 'Save';
};

window.deleteMaterial = async function(id) {
  if (!confirm('Delete this material?')) return;
  try {
    await deleteDoc(doc(db, 'studyMaterials', id));
    showToast('Deleted!', 'success');
    await loadMaterials();
  } catch(e) {
    showToast('Error deleting', 'error');
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