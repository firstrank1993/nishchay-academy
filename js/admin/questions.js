// ============================================
// NISHCHAY ACADEMY — Admin Question Bank
// ============================================

import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let subjectsCache = [];
let topicsCache = [];
let questionsCache = [];
let filteredQuestions = [];
let editingQId = null;
let selectedCorrect = 0;
let selectedType = 'PYQ';

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  await loadSubjects();
  await loadAllTopics();
  await loadQuestions();
});

// ── LOAD DATA ──
async function loadSubjects() {
  const snap = await getDocs(collection(db, 'subjects'));
  subjectsCache = [];
  snap.forEach(d => subjectsCache.push({ id: d.id, ...d.data() }));

  const sel = document.getElementById('qSubjectSelect');
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

async function loadQuestions() {
  const loader = document.getElementById('questionsLoader');
  const list = document.getElementById('questionsList');

  try {
    const snap = await getDocs(collection(db, 'questions'));
    questionsCache = [];
    snap.forEach(d => questionsCache.push({ id: d.id, ...d.data() }));
    filteredQuestions = [...questionsCache];

    loader.style.display = 'none';
    renderQuestions(filteredQuestions);
  } catch(e) {
    console.error(e);
    loader.style.display = 'none';
  }
}

function renderQuestions(questions) {
  const list = document.getElementById('questionsList');
  const count = document.getElementById('questionsCount');

  count.textContent = `${questions.length} question${questions.length !== 1 ? 's' : ''} found`;

  if (questions.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:20px;">No questions found</p>';
    list.style.display = 'flex';
    return;
  }

  list.innerHTML = questions.map(q => {
    const subject = subjectsCache.find(s => s.id === q.subjectId);
    const topic = topicsCache.find(t => t.id === q.topicId);
    const typeBadge = q.type === 'PYQ'
      ? `<span class="badge badge-warning">PYQ ${q.pyqYear || ''}</span>`
      : `<span class="badge badge-success">IMP</span>`;

    return `
      <div class="card" style="gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <p style="font-size:14px; font-weight:600; flex:1; line-height:1.5;">${q.questionText}</p>
          ${typeBadge}
        </div>
        <div style="font-size:12px; color:var(--text-secondary);">
          ${subject ? subject.name : ''} ${topic ? '→ ' + topic.name : ''}
          ${q.type === 'PYQ' && q.pyqExamName ? '• ' + q.pyqExamName : ''}
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:4px;">
          ${q.options ? q.options.map((opt, i) => `
            <div style="font-size:12px; padding:5px 8px; border-radius:6px; background:${i === q.correctOption ? '#DCFCE7' : '#F8FAFC'}; color:${i === q.correctOption ? 'var(--success)' : 'var(--text-secondary)'}; border:1px solid ${i === q.correctOption ? '#BBF7D0' : 'var(--border)'};">
              ${['A','B','C','D'][i]}. ${opt}
            </div>
          `).join('') : ''}
        </div>
        <div style="display:flex; gap:6px; margin-top:4px;">
          <button onclick="editQuestion('${q.id}')" class="btn btn-sm btn-outline">Edit</button>
          <button onclick="deleteQuestion('${q.id}')" class="btn btn-sm" style="background:#FEE2E2;color:#DC2626;border:none;">Delete</button>
        </div>
      </div>
    `;
  }).join('');
  list.style.display = 'flex';
}

// ── FILTER ──
window.filterQuestions = function() {
  const subjectFilter = document.getElementById('filterSubject').value;
  const typeFilter = document.getElementById('filterType').value;

  filteredQuestions = questionsCache.filter(q => {
    const matchSubject = !subjectFilter || q.subjectId === subjectFilter;
    const matchType = !typeFilter || q.type === typeFilter;
    return matchSubject && matchType;
  });

  renderQuestions(filteredQuestions);
};

// ── FORM ──
window.showAddForm = function() {
  editingQId = null;
  document.getElementById('formTitle').textContent = 'Add Question';
  document.getElementById('questionText').value = '';
  document.getElementById('opt0').value = '';
  document.getElementById('opt1').value = '';
  document.getElementById('opt2').value = '';
  document.getElementById('opt3').value = '';
  document.getElementById('explanation').value = '';
  document.getElementById('pyqExamName').value = '';
  document.getElementById('pyqYear').value = '';
  document.getElementById('pyqExamBodyName').value = '';
  document.getElementById('qSubjectSelect').value = '';
  document.getElementById('qTopicSelect').value = '';
  document.getElementById('difficulty').value = 'medium';
  setCorrect(0);
  selectType('PYQ');
  document.getElementById('questionForm').style.display = 'block';
  document.getElementById('questionForm').scrollIntoView({ behavior: 'smooth' });
};

window.hideForm = function() {
  document.getElementById('questionForm').style.display = 'none';
  editingQId = null;
};

window.selectType = function(type) {
  selectedType = type;
  document.getElementById('typePYQ').style.background = type === 'PYQ' ? 'var(--primary)' : 'transparent';
  document.getElementById('typePYQ').style.color = type === 'PYQ' ? 'white' : 'var(--primary)';
  document.getElementById('typeIMP').style.background = type === 'IMP' ? 'var(--primary)' : 'transparent';
  document.getElementById('typeIMP').style.color = type === 'IMP' ? 'white' : 'var(--primary)';
  document.getElementById('pyqInfo').style.display = type === 'PYQ' ? 'block' : 'none';
};

window.setCorrect = function(index) {
  selectedCorrect = index;
  [0,1,2,3].forEach(i => {
    const btn = document.getElementById(`opt${i}btn`);
    btn.style.background = i === index ? 'var(--success)' : 'transparent';
    btn.style.color = i === index ? 'white' : 'var(--primary)';
    btn.style.border = i === index ? 'none' : '1.5px solid var(--primary)';
  });
};

window.loadTopicsForSubject = function() {
  const subjectId = document.getElementById('qSubjectSelect').value;
  const topicSelect = document.getElementById('qTopicSelect');
  topicSelect.innerHTML = '<option value="">Select Topic</option>';

  topicsCache
    .filter(t => t.subjectId === subjectId)
    .forEach(t => {
      topicSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });
};

window.editQuestion = function(id) {
  const q = questionsCache.find(x => x.id === id);
  if (!q) return;
  editingQId = id;

  document.getElementById('formTitle').textContent = 'Edit Question';
  document.getElementById('questionText').value = q.questionText;
  document.getElementById('opt0').value = q.options[0] || '';
  document.getElementById('opt1').value = q.options[1] || '';
  document.getElementById('opt2').value = q.options[2] || '';
  document.getElementById('opt3').value = q.options[3] || '';
  document.getElementById('explanation').value = q.explanation || '';
  document.getElementById('difficulty').value = q.difficulty || 'medium';
  document.getElementById('qSubjectSelect').value = q.subjectId || '';
  loadTopicsForSubject();
  document.getElementById('qTopicSelect').value = q.topicId || '';
  selectType(q.type || 'PYQ');
  setCorrect(q.correctOption || 0);

  if (q.type === 'PYQ') {
    document.getElementById('pyqExamName').value = q.pyqExamName || '';
    document.getElementById('pyqYear').value = q.pyqYear || '';
    document.getElementById('pyqExamBodyName').value = q.pyqExamBodyName || '';
  }

  document.getElementById('questionForm').style.display = 'block';
  document.getElementById('questionForm').scrollIntoView({ behavior: 'smooth' });
};

window.saveQuestion = async function() {
  const questionText = document.getElementById('questionText').value.trim();
  const subjectId = document.getElementById('qSubjectSelect').value;
  const topicId = document.getElementById('qTopicSelect').value;
  const options = [
    document.getElementById('opt0').value.trim(),
    document.getElementById('opt1').value.trim(),
    document.getElementById('opt2').value.trim(),
    document.getElementById('opt3').value.trim(),
  ];
  const explanation = document.getElementById('explanation').value.trim();
  const difficulty = document.getElementById('difficulty').value;

  if (!questionText) { showToast('Enter question text', 'error'); return; }
  if (!subjectId) { showToast('Select a subject', 'error'); return; }
  if (!topicId) { showToast('Select a topic', 'error'); return; }
  if (options.some(o => !o)) { showToast('Fill all 4 options', 'error'); return; }

  const btn = document.getElementById('saveQBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  const data = {
    questionText,
    options,
    correctOption: selectedCorrect,
    subjectId,
    topicId,
    type: selectedType,
    difficulty,
    explanation,
  };

  if (selectedType === 'PYQ') {
    data.pyqExamName = document.getElementById('pyqExamName').value.trim();
    data.pyqYear = document.getElementById('pyqYear').value.trim();
    data.pyqExamBodyName = document.getElementById('pyqExamBodyName').value.trim();
  }

  try {
    if (editingQId) {
      await updateDoc(doc(db, 'questions', editingQId), data);
      showToast('Question updated!', 'success');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'questions'), data);
      showToast('Question added!', 'success');
    }
    hideForm();
    await loadQuestions();
  } catch(e) {
    showToast('Error saving', 'error');
    console.error(e);
  }

  btn.disabled = false; btn.textContent = 'Save';
};

window.deleteQuestion = async function(id) {
  if (!confirm('Delete this question?')) return;
  try {
    await deleteDoc(doc(db, 'questions', id));
    showToast('Deleted!', 'success');
    await loadQuestions();
  } catch(e) {
    showToast('Error deleting', 'error');
  }
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