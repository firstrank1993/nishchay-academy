// ============================================
// NISHCHAY ACADEMY — Admin Exam Management
// ============================================

import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let editingBodyId = null;
let editingExamId = null;
let examBodiesCache = [];
let examsCache = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  await loadExamBodies();
  await loadExams();
});

// ── TAB SWITCHER ──
window.switchTab = function(tab) {
  document.getElementById('section1').style.display =
    tab === 1 ? 'block' : 'none';
  document.getElementById('section2').style.display =
    tab === 2 ? 'block' : 'none';
  document.getElementById('tab1').style.background =
    tab === 1 ? 'white' : 'transparent';
  document.getElementById('tab1').style.color =
    tab === 1 ? 'var(--primary)' : 'var(--text-secondary)';
  document.getElementById('tab1').style.boxShadow =
    tab === 1 ? 'var(--shadow-sm)' : 'none';
  document.getElementById('tab2').style.background =
    tab === 2 ? 'white' : 'transparent';
  document.getElementById('tab2').style.color =
    tab === 2 ? 'var(--primary)' : 'var(--text-secondary)';
  document.getElementById('tab2').style.boxShadow =
    tab === 2 ? 'var(--shadow-sm)' : 'none';
};

// ── EXAM BODIES ──
async function loadExamBodies() {
  const loader = document.getElementById('bodiesLoader');
  const list = document.getElementById('bodiesList');

  try {
    const snapshot = await getDocs(collection(db, 'examBodies'));
    examBodiesCache = [];
    snapshot.forEach(d =>
      examBodiesCache.push({ id: d.id, ...d.data() })
    );
    examBodiesCache.sort((a, b) => (a.order||0) - (b.order||0));

    loader.style.display = 'none';

    if (examBodiesCache.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:20px;">No exam bodies yet</p>';
      list.style.display = 'flex';
      return;
    }

    list.innerHTML = examBodiesCache.map(body => `
      <div class="exam-body-card">
        <div class="exam-body-icon">${body.name.substring(0,4)}</div>
        <div class="exam-body-info">
          <h3>${body.name}</h3>
          <p>${body.description || ''}</p>
        </div>
        <div style="display:flex;gap:6px;margin-left:auto;">
          <button onclick="editBody('${body.id}')"
            class="btn btn-sm btn-outline">Edit</button>
          <button onclick="deleteBody('${body.id}')"
            class="btn btn-sm"
            style="background:#FEE2E2;color:#DC2626;border:none;">Del</button>
        </div>
      </div>
    `).join('');
    list.style.display = 'flex';

    // Populate exam body dropdown
    const select = document.getElementById('examBodySelect');
    select.innerHTML = '<option value="">Select Exam Body</option>';
    examBodiesCache.forEach(b => {
      select.innerHTML +=
        `<option value="${b.id}">${b.name}</option>`;
    });

  } catch(err) { console.error(err); }
}

window.showAddBodyForm = function() {
  editingBodyId = null;
  document.getElementById('bodyFormTitle').textContent = 'Add Exam Body';
  document.getElementById('bodyName').value = '';
  document.getElementById('bodyDesc').value = '';
  document.getElementById('bodyOrder').value = '';
  document.getElementById('bodyForm').style.display = 'block';
  document.getElementById('bodyForm').scrollIntoView({ behavior: 'smooth' });
};

window.hideBodyForm = function() {
  document.getElementById('bodyForm').style.display = 'none';
  editingBodyId = null;
};

window.editBody = function(id) {
  const body = examBodiesCache.find(b => b.id === id);
  if (!body) return;
  editingBodyId = id;
  document.getElementById('bodyFormTitle').textContent = 'Edit Exam Body';
  document.getElementById('bodyName').value = body.name;
  document.getElementById('bodyDesc').value = body.description || '';
  document.getElementById('bodyOrder').value = body.order || '';
  document.getElementById('bodyForm').style.display = 'block';
  document.getElementById('bodyForm').scrollIntoView({ behavior: 'smooth' });
};

window.saveExamBody = async function() {
  const name = document.getElementById('bodyName').value.trim();
  const desc = document.getElementById('bodyDesc').value.trim();
  const order = parseInt(document.getElementById('bodyOrder').value) || 0;

  if (!name) { showToast('Please enter a name', 'error'); return; }

  const btn = document.getElementById('saveBodyBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    if (editingBodyId) {
      await updateDoc(doc(db, 'examBodies', editingBodyId),
        { name, description: desc, order, isActive: true });
      showToast('Exam body updated!', 'success');
    } else {
      await addDoc(collection(db, 'examBodies'),
        { name, description: desc, order, isActive: true,
          createdAt: serverTimestamp() });
      showToast('Exam body added!', 'success');
    }
    hideBodyForm();
    await loadExamBodies();
  } catch(err) {
    showToast('Error saving. Try again.', 'error');
    console.error(err);
  }

  btn.disabled = false; btn.textContent = 'Save';
};

window.deleteBody = async function(id) {
  if (!confirm('Delete this exam body? This cannot be undone.')) return;
  try {
    await deleteDoc(doc(db, 'examBodies', id));
    showToast('Deleted!', 'success');
    await loadExamBodies();
  } catch(err) { showToast('Error deleting.', 'error'); }
};

// ── EXAMS ──
async function loadExams() {
  const loader = document.getElementById('examsLoader');
  const list = document.getElementById('examsList');

  try {
    const snapshot = await getDocs(collection(db, 'exams'));
    examsCache = [];
    snapshot.forEach(d => examsCache.push({ id: d.id, ...d.data() }));
    examsCache.sort((a, b) => (a.order||0) - (b.order||0));

    loader.style.display = 'none';

    if (examsCache.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:20px;">No exams yet</p>';
      list.style.display = 'flex';
      return;
    }

    list.innerHTML = examsCache.map(exam => {
      const body = examBodiesCache.find(b => b.id === exam.examBodyId);
      return `
        <div class="exam-body-card">
          <div class="exam-body-icon"
            style="background:linear-gradient(135deg,#0D47A1,#1a237e);
                   font-size:11px;">
            ${exam.name.substring(0,4)}
          </div>
          <div class="exam-body-info">
            <h3>${exam.name}</h3>
            <p>${body ? body.name : 'Unknown body'}</p>
            ${exam.syllabusUrl ? `
              <a href="${exam.syllabusUrl}" target="_blank"
                style="font-size:11px;color:var(--primary);">
                📄 Syllabus PDF linked
              </a>
            ` : ''}
          </div>
          <div style="display:flex;gap:6px;margin-left:auto;">
            <button onclick="editExam('${exam.id}')"
              class="btn btn-sm btn-outline">Edit</button>
            <button onclick="deleteExam('${exam.id}')"
              class="btn btn-sm"
              style="background:#FEE2E2;color:#DC2626;border:none;">Del</button>
          </div>
        </div>
      `;
    }).join('');
    list.style.display = 'flex';

  } catch(err) { console.error(err); }
}

window.showAddExamForm = function() {
  editingExamId = null;
  document.getElementById('examFormTitle').textContent = 'Add Exam';
  document.getElementById('examName').value = '';
  document.getElementById('examDesc').value = '';
  document.getElementById('examOrder').value = '';
  document.getElementById('examBodySelect').value = '';
  document.getElementById('examSyllabusUrl').value = '';
  document.getElementById('examForm').style.display = 'block';
  document.getElementById('examForm').scrollIntoView({ behavior: 'smooth' });
};

window.hideExamForm = function() {
  document.getElementById('examForm').style.display = 'none';
  editingExamId = null;
};

window.editExam = function(id) {
  const exam = examsCache.find(e => e.id === id);
  if (!exam) return;
  editingExamId = id;
  document.getElementById('examFormTitle').textContent = 'Edit Exam';
  document.getElementById('examName').value = exam.name;
  document.getElementById('examDesc').value = exam.description || '';
  document.getElementById('examOrder').value = exam.order || '';
  document.getElementById('examBodySelect').value = exam.examBodyId || '';
  document.getElementById('examSyllabusUrl').value =
    exam.syllabusUrl || '';
  document.getElementById('examForm').style.display = 'block';
  document.getElementById('examForm').scrollIntoView({ behavior: 'smooth' });
};

window.saveExam = async function() {
  const examBodyId = document.getElementById('examBodySelect').value;
  const name = document.getElementById('examName').value.trim();
  const desc = document.getElementById('examDesc').value.trim();
  const order = parseInt(document.getElementById('examOrder').value) || 0;
  const syllabusUrl =
    document.getElementById('examSyllabusUrl').value.trim();

  if (!examBodyId) {
    showToast('Please select an exam body', 'error'); return;
  }
  if (!name) {
    showToast('Please enter exam name', 'error'); return;
  }

  const btn = document.getElementById('saveExamBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    const data = {
      name, description: desc, examBodyId,
      order, isActive: true,
      syllabusUrl: syllabusUrl || ''
    };

    if (editingExamId) {
      await updateDoc(doc(db, 'exams', editingExamId), data);
      showToast('Exam updated!', 'success');
    } else {
      await addDoc(collection(db, 'exams'),
        { ...data, createdAt: serverTimestamp() });
      showToast('Exam added!', 'success');
    }
    hideExamForm();
    await loadExams();
  } catch(err) {
    showToast('Error saving. Try again.', 'error');
    console.error(err);
  }

  btn.disabled = false; btn.textContent = 'Save';
};

window.deleteExam = async function(id) {
  if (!confirm('Delete this exam? This cannot be undone.')) return;
  try {
    await deleteDoc(doc(db, 'exams', id));
    showToast('Deleted!', 'success');
    await loadExams();
  } catch(err) { showToast('Error deleting.', 'error'); }
};

// Toast
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};