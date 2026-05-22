// ============================================
// NISHCHAY ACADEMY — Admin Subjects & Topics
// ============================================

import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let subjectsCache = [];
let topicsCache = [];
let examsCache = [];
let syllabusCache = [];
let editingSubjectId = null;
let editingTopicId = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  await loadAll();
});

async function loadAll() {
  await loadSubjects();
  await loadTopics();
  await loadExams();
  await loadSyllabus();
}

// ── TAB SWITCHER ──
window.switchTab = function(tab) {
  [1,2,3].forEach(i => {
    document.getElementById(`section${i}`).style.display = i === tab ? 'block' : 'none';
    document.getElementById(`tab${i}`).style.background = i === tab ? 'white' : 'transparent';
    document.getElementById(`tab${i}`).style.color = i === tab ? 'var(--primary)' : 'var(--text-secondary)';
    document.getElementById(`tab${i}`).style.boxShadow = i === tab ? 'var(--shadow-sm)' : 'none';
  });
};

// ── SUBJECTS ──
async function loadSubjects() {
  const loader = document.getElementById('subjectsLoader');
  const list = document.getElementById('subjectsList');
  try {
    const snap = await getDocs(collection(db, 'subjects'));
    subjectsCache = [];
    snap.forEach(d => subjectsCache.push({ id: d.id, ...d.data() }));
    subjectsCache.sort((a, b) => (a.order||0) - (b.order||0));

    loader.style.display = 'none';

    // Populate subject dropdowns
    const sel = document.getElementById('topicSubjectSelect');
    sel.innerHTML = '<option value="">Select Subject</option>';
    const sel2 = document.getElementById('syllabusSubjectSelect');
    sel2.innerHTML = '<option value="">Select Subject</option>';
    subjectsCache.forEach(s => {
      sel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
      sel2.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });

    if (subjectsCache.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:20px;">No subjects yet</p>';
      list.style.display = 'flex'; return;
    }

    list.innerHTML = subjectsCache.map(s => `
      <div class="exam-body-card">
        <div class="exam-body-icon" style="font-size:12px;">${s.name.substring(0,2).toUpperCase()}</div>
        <div class="exam-body-info">
          <h3>${s.name}</h3>
          <p>${s.description || ''}</p>
        </div>
        <div style="display:flex; gap:6px; margin-left:auto;">
          <button onclick="editSubject('${s.id}')" class="btn btn-sm btn-outline">Edit</button>
          <button onclick="deleteSubject('${s.id}')" class="btn btn-sm" style="background:#FEE2E2;color:#DC2626;border:none;">Del</button>
        </div>
      </div>
    `).join('');
    list.style.display = 'flex';
  } catch(e) { console.error(e); }
}

window.showAddSubjectForm = function() {
  editingSubjectId = null;
  document.getElementById('subjectFormTitle').textContent = 'Add Subject';
  document.getElementById('subjectName').value = '';
  document.getElementById('subjectDesc').value = '';
  document.getElementById('subjectOrder').value = '';
  document.getElementById('subjectForm').style.display = 'block';
  document.getElementById('subjectForm').scrollIntoView({ behavior:'smooth' });
};

window.hideSubjectForm = function() {
  document.getElementById('subjectForm').style.display = 'none';
  editingSubjectId = null;
};

window.editSubject = function(id) {
  const s = subjectsCache.find(x => x.id === id);
  if (!s) return;
  editingSubjectId = id;
  document.getElementById('subjectFormTitle').textContent = 'Edit Subject';
  document.getElementById('subjectName').value = s.name;
  document.getElementById('subjectDesc').value = s.description || '';
  document.getElementById('subjectOrder').value = s.order || '';
  document.getElementById('subjectForm').style.display = 'block';
  document.getElementById('subjectForm').scrollIntoView({ behavior:'smooth' });
};

window.saveSubject = async function() {
  const name = document.getElementById('subjectName').value.trim();
  const desc = document.getElementById('subjectDesc').value.trim();
  const order = parseInt(document.getElementById('subjectOrder').value) || 0;
  if (!name) { showToast('Enter subject name', 'error'); return; }

  const btn = document.getElementById('saveSubjectBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    if (editingSubjectId) {
      await updateDoc(doc(db,'subjects',editingSubjectId), { name, description:desc, order, isActive:true });
      showToast('Subject updated!', 'success');
    } else {
      await addDoc(collection(db,'subjects'), { name, description:desc, order, isActive:true, createdAt:serverTimestamp() });
      showToast('Subject added!', 'success');
    }
    hideSubjectForm();
    await loadSubjects();
  } catch(e) { showToast('Error saving','error'); console.error(e); }

  btn.disabled = false; btn.textContent = 'Save';
};

window.deleteSubject = async function(id) {
  if (!confirm('Delete this subject?')) return;
  try {
    await deleteDoc(doc(db,'subjects',id));
    showToast('Deleted!','success');
    await loadSubjects();
  } catch(e) { showToast('Error deleting','error'); }
};

// ── TOPICS ──
async function loadTopics() {
  const loader = document.getElementById('topicsLoader');
  const list = document.getElementById('topicsList');
  try {
    const snap = await getDocs(collection(db,'topics'));
    topicsCache = [];
    snap.forEach(d => topicsCache.push({ id:d.id, ...d.data() }));
    topicsCache.sort((a,b) => (a.order||0)-(b.order||0));

    loader.style.display = 'none';

    if (topicsCache.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:20px;">No topics yet</p>';
      list.style.display = 'flex'; return;
    }

    list.innerHTML = topicsCache.map(t => {
      const subject = subjectsCache.find(s => s.id === t.subjectId);
      return `
        <div class="exam-body-card">
          <div class="exam-body-icon" style="background:linear-gradient(135deg,#16A34A,#15803d);font-size:12px;">${t.name.substring(0,2).toUpperCase()}</div>
          <div class="exam-body-info">
            <h3>${t.name}</h3>
            <p>${subject ? subject.name : 'Unknown subject'}</p>
          </div>
          <div style="display:flex; gap:6px; margin-left:auto;">
            <button onclick="editTopic('${t.id}')" class="btn btn-sm btn-outline">Edit</button>
            <button onclick="deleteTopic('${t.id}')" class="btn btn-sm" style="background:#FEE2E2;color:#DC2626;border:none;">Del</button>
          </div>
        </div>
      `;
    }).join('');
    list.style.display = 'flex';
  } catch(e) { console.error(e); }
}

window.showAddTopicForm = function() {
  editingTopicId = null;
  document.getElementById('topicFormTitle').textContent = 'Add Topic';
  document.getElementById('topicName').value = '';
  document.getElementById('topicDesc').value = '';
  document.getElementById('topicOrder').value = '';
  document.getElementById('topicSubjectSelect').value = '';
  document.getElementById('topicForm').style.display = 'block';
  document.getElementById('topicForm').scrollIntoView({ behavior:'smooth' });
};

window.hideTopicForm = function() {
  document.getElementById('topicForm').style.display = 'none';
  editingTopicId = null;
};

window.editTopic = function(id) {
  const t = topicsCache.find(x => x.id === id);
  if (!t) return;
  editingTopicId = id;
  document.getElementById('topicFormTitle').textContent = 'Edit Topic';
  document.getElementById('topicName').value = t.name;
  document.getElementById('topicDesc').value = t.description || '';
  document.getElementById('topicOrder').value = t.order || '';
  document.getElementById('topicSubjectSelect').value = t.subjectId || '';
  document.getElementById('topicForm').style.display = 'block';
  document.getElementById('topicForm').scrollIntoView({ behavior:'smooth' });
};

window.saveTopic = async function() {
  const subjectId = document.getElementById('topicSubjectSelect').value;
  const name = document.getElementById('topicName').value.trim();
  const desc = document.getElementById('topicDesc').value.trim();
  const order = parseInt(document.getElementById('topicOrder').value) || 0;
  if (!subjectId) { showToast('Select a subject','error'); return; }
  if (!name) { showToast('Enter topic name','error'); return; }

  const btn = document.getElementById('saveTopicBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    if (editingTopicId) {
      await updateDoc(doc(db,'topics',editingTopicId), { name, description:desc, subjectId, order, isActive:true });
      showToast('Topic updated!','success');
    } else {
      await addDoc(collection(db,'topics'), { name, description:desc, subjectId, order, isActive:true, createdAt:serverTimestamp() });
      showToast('Topic added!','success');
    }
    hideTopicForm();
    await loadTopics();
  } catch(e) { showToast('Error saving','error'); console.error(e); }

  btn.disabled = false; btn.textContent = 'Save';
};

window.deleteTopic = async function(id) {
  if (!confirm('Delete this topic?')) return;
  try {
    await deleteDoc(doc(db,'topics',id));
    showToast('Deleted!','success');
    await loadTopics();
  } catch(e) { showToast('Error deleting','error'); }
};

// ── SYLLABUS ──
async function loadExams() {
  try {
    const snap = await getDocs(collection(db,'exams'));
    examsCache = [];
    snap.forEach(d => examsCache.push({ id:d.id, ...d.data() }));
    const sel = document.getElementById('syllabusExamSelect');
    sel.innerHTML = '<option value="">Select Exam</option>';
    examsCache.forEach(e => {
      sel.innerHTML += `<option value="${e.id}">${e.name}</option>`;
    });
  } catch(e) { console.error(e); }
}

async function loadSyllabus() {
  const list = document.getElementById('syllabusList');
  try {
    const snap = await getDocs(collection(db,'examSyllabus'));
    syllabusCache = [];
    snap.forEach(d => syllabusCache.push({ id:d.id, ...d.data() }));

    if (syllabusCache.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:20px;">No syllabus links yet</p>';
      return;
    }

    list.innerHTML = syllabusCache.map(s => {
      const exam = examsCache.find(e => e.id === s.examId);
      const subject = subjectsCache.find(x => x.id === s.subjectId);
      return `
        <div class="exam-body-card">
          <div class="exam-body-icon" style="background:linear-gradient(135deg,#7C3AED,#6d28d9);font-size:11px;">SYL</div>
          <div class="exam-body-info">
            <h3>${exam ? exam.name : 'Unknown exam'}</h3>
            <p>${subject ? subject.name : 'Unknown subject'}</p>
          </div>
          <button onclick="deleteSyllabus('${s.id}')" class="btn btn-sm" style="background:#FEE2E2;color:#DC2626;border:none;margin-left:auto;">Del</button>
        </div>
      `;
    }).join('');
  } catch(e) { console.error(e); }
}

window.showAddSyllabusForm = function() {
  document.getElementById('syllabusForm').style.display = 'block';
  document.getElementById('syllabusForm').scrollIntoView({ behavior:'smooth' });
};

window.hideSyllabusForm = function() {
  document.getElementById('syllabusForm').style.display = 'none';
};

window.saveSyllabus = async function() {
  const examId = document.getElementById('syllabusExamSelect').value;
  const subjectId = document.getElementById('syllabusSubjectSelect').value;
  const order = parseInt(document.getElementById('syllabusOrder').value) || 1;

  if (!examId) { showToast('Select an exam','error'); return; }
  if (!subjectId) { showToast('Select a subject','error'); return; }

  const btn = document.getElementById('saveSyllabusBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    await addDoc(collection(db,'examSyllabus'), { examId, subjectId, order, createdAt:serverTimestamp() });
    showToast('Subject linked to exam!','success');
    hideSyllabusForm();
    await loadSyllabus();
  } catch(e) { showToast('Error saving','error'); console.error(e); }

  btn.disabled = false; btn.textContent = 'Save';
};

window.deleteSyllabus = async function(id) {
  if (!confirm('Remove this subject from exam?')) return;
  try {
    await deleteDoc(doc(db,'examSyllabus',id));
    showToast('Removed!','success');
    await loadSyllabus();
  } catch(e) { showToast('Error','error'); }
};

// Toast
window.showToast = function(message, type='info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};