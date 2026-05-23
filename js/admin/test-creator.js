// ============================================
// NISHCHAY ACADEMY — Admin Test Creator
// ============================================

import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let examsCache = [];
let topicsCache = [];
let questionsCache = [];
let currentTestId = null;
let sectionsCache = [];
let isActive = false;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  await loadExams();
  await loadTopics();
  await loadQuestions();
  await loadTests();
});

// ── LOAD DATA ──
async function loadExams() {
  const snap = await getDocs(collection(db, 'exams'));
  examsCache = [];
  snap.forEach(d => examsCache.push({ id: d.id, ...d.data() }));
  const sel = document.getElementById('testExamSelect');
  examsCache.forEach(e => {
    sel.innerHTML += `<option value="${e.id}">${e.name}</option>`;
  });
}

async function loadTopics() {
  const snap = await getDocs(collection(db, 'topics'));
  topicsCache = [];
  snap.forEach(d => topicsCache.push({ id: d.id, ...d.data() }));
  const sel = document.getElementById('sectionTopic');
  topicsCache.forEach(t => {
    sel.innerHTML += `<option value="${t.id}">${t.name}</option>`;
  });
}

async function loadQuestions() {
  const snap = await getDocs(collection(db, 'questions'));
  questionsCache = [];
  snap.forEach(d => questionsCache.push({ id: d.id, ...d.data() }));
}

// ── LOAD TESTS LIST ──
async function loadTests() {
  const loader = document.getElementById('testsLoader');
  const list = document.getElementById('testsList');

  try {
    const snap = await getDocs(collection(db, 'tests'));
    const tests = [];
    snap.forEach(d => tests.push({ id: d.id, ...d.data() }));
    tests.sort((a, b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));

    loader.style.display = 'none';

    if (tests.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:20px;">No tests yet</p>';
      list.style.display = 'flex';
      return;
    }

    list.innerHTML = tests.map(t => {
      // Format dates if available
      let scheduleInfo = '';
      if (t.activateAt) {
        const activateDate = t.activateAt.toDate
          ? t.activateAt.toDate().toLocaleString('en-IN')
          : new Date(t.activateAt).toLocaleString('en-IN');
        scheduleInfo += `<div style="font-size:11px;color:var(--text-secondary);margin-top:3px;">🕐 Activates: ${activateDate}</div>`;
      }
      if (t.expiresAt) {
        const expiryDate = t.expiresAt.toDate
          ? t.expiresAt.toDate().toLocaleString('en-IN')
          : new Date(t.expiresAt).toLocaleString('en-IN');
        scheduleInfo += `<div style="font-size:11px;color:var(--danger);margin-top:2px;">⏰ Expires: ${expiryDate}</div>`;
      }

      return `
        <div class="card">
          <div style="display:flex; align-items:flex-start; gap:12px;">
            <div class="exam-body-icon" style="background:linear-gradient(135deg,#DC2626,#b91c1c); font-size:20px; flex-shrink:0;">🎯</div>
            <div style="flex:1;">
              <h3 style="font-size:14px; font-weight:700;">${t.title}</h3>
              <p style="font-size:12px; color:var(--text-secondary);">${t.duration} min • ${t.totalMarks} marks • ${t.isActive ? '🟢 Active' : '🔴 Inactive'}</p>
              ${scheduleInfo}
            </div>
          </div>
          <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
            <button onclick="editTest('${t.id}')" class="btn btn-sm btn-outline">Edit</button>
            <button onclick="toggleTestActive('${t.id}', ${t.isActive})" class="btn btn-sm" style="background:${t.isActive ? '#FEF3C7' : '#DCFCE7'};color:${t.isActive ? '#D97706' : 'var(--success)'};border:none;">
              ${t.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button onclick="shareTest('${t.id}', '${t.title}')" class="btn btn-sm" style="background:#E0F2FE;color:#0284C7;border:none;">Share</button>
            <button onclick="deleteTest('${t.id}')" class="btn btn-sm" style="background:#FEE2E2;color:#DC2626;border:none;">Delete</button>
          </div>
        </div>
      `;
    }).join('');
    list.style.display = 'flex';

  } catch(e) { console.error(e); }
}

// ── TOGGLE ACTIVE ──
window.toggleActive = function() {
  isActive = !isActive;
  const slider = document.getElementById('toggleSlider');
  slider.style.background = isActive ? 'var(--primary)' : '#CBD5E1';
};

window.toggleTestActive = async function(testId, current) {
  try {
    await updateDoc(doc(db, 'tests', testId), { isActive: !current });
    showToast(`Test ${!current ? 'activated' : 'deactivated'}!`, 'success');
    await loadTests();
  } catch(e) { showToast('Error', 'error'); }
};

// ── DELETE TEST ──
window.deleteTest = async function(testId) {
  if (!confirm('Delete this test permanently? This cannot be undone.')) return;
  try {
    // Delete all sections first
    const sectionsSnap = await getDocs(collection(db, 'tests', testId, 'sections'));
    for (const s of sectionsSnap.docs) {
      await deleteDoc(doc(db, 'tests', testId, 'sections', s.id));
    }
    // Delete the test itself
    await deleteDoc(doc(db, 'tests', testId));
    showToast('Test deleted!', 'success');
    await loadTests();
  } catch(e) {
    showToast('Error deleting test', 'error');
    console.error(e);
  }
};

// ── SHARE TEST ──
window.shareTest = function(testId, testTitle) {
  const url = `https://nishchayacademydhg.web.app/test.html?testId=${testId}`;
  const message = `📚 *Nishchay Academy*\n\n🎯 *${testTitle}*\n\nAttempt this mock test now:\n${url}`;

  if (navigator.share) {
    navigator.share({ title: testTitle, text: message, url });
  } else {
    navigator.clipboard.writeText(message).then(() => {
      showToast('Test link copied! Share on WhatsApp or Telegram.', 'success');
    });
  }
};

// ── FORM ──
window.showCreateForm = function() {
  currentTestId = null;
  sectionsCache = [];
  isActive = false;
  document.getElementById('testFormTitle').textContent = 'Create Test';
  document.getElementById('testTitle').value = '';
  document.getElementById('testExamSelect').value = '';
  document.getElementById('testDuration').value = '';
  document.getElementById('testTotalMarks').value = '';
  document.getElementById('testActivateAt').value = '';
  document.getElementById('testExpiresAt').value = '';
  document.getElementById('toggleSlider').style.background = '#CBD5E1';
  document.getElementById('sectionsArea').style.display = 'none';
  document.getElementById('sectionsList').innerHTML = '';
  document.getElementById('testsListSection').style.display = 'none';
  document.getElementById('testForm').style.display = 'block';
};

window.hideCreateForm = function() {
  document.getElementById('testForm').style.display = 'none';
  document.getElementById('testsListSection').style.display = 'block';
  currentTestId = null;
};

window.editTest = async function(testId) {
  try {
    const snap = await getDoc(doc(db, 'tests', testId));
    if (!snap.exists()) return;
    const t = snap.data();
    currentTestId = testId;

    document.getElementById('testFormTitle').textContent = 'Edit Test';
    document.getElementById('testTitle').value = t.title || '';
    document.getElementById('testExamSelect').value = t.examId || '';
    document.getElementById('testDuration').value = t.duration || '';
    document.getElementById('testTotalMarks').value = t.totalMarks || '';
    isActive = t.isActive || false;
    document.getElementById('toggleSlider').style.background = isActive ? 'var(--primary)' : '#CBD5E1';

    // Set dates if available
    if (t.activateAt) {
      const d = t.activateAt.toDate ? t.activateAt.toDate() : new Date(t.activateAt);
      document.getElementById('testActivateAt').value = d.toISOString().slice(0,16);
    } else {
      document.getElementById('testActivateAt').value = '';
    }

    if (t.expiresAt) {
      const d = t.expiresAt.toDate ? t.expiresAt.toDate() : new Date(t.expiresAt);
      document.getElementById('testExpiresAt').value = d.toISOString().slice(0,16);
    } else {
      document.getElementById('testExpiresAt').value = '';
    }

    document.getElementById('testsListSection').style.display = 'none';
    document.getElementById('testForm').style.display = 'block';
    document.getElementById('sectionsArea').style.display = 'block';

    await loadSections(testId);
  } catch(e) { console.error(e); }
};

// ── SAVE TEST ──
window.saveTestDetails = async function() {
  const title = document.getElementById('testTitle').value.trim();
  const examId = document.getElementById('testExamSelect').value;
  const duration = parseInt(document.getElementById('testDuration').value) || 60;
  const totalMarks = parseInt(document.getElementById('testTotalMarks').value) || 100;
  const activateAtVal = document.getElementById('testActivateAt').value;
  const expiresAtVal = document.getElementById('testExpiresAt').value;

  if (!title) { showToast('Enter test title', 'error'); return; }

  const btn = document.getElementById('saveTestBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    const data = {
      title,
      examId,
      duration,
      totalMarks,
      isActive,
      activateAt: activateAtVal ? new Date(activateAtVal) : null,
      expiresAt: expiresAtVal ? new Date(expiresAtVal) : null,
      createdAt: serverTimestamp()
    };

    if (currentTestId) {
      await updateDoc(doc(db, 'tests', currentTestId), data);
      showToast('Test updated!', 'success');
    } else {
      const ref = await addDoc(collection(db, 'tests'), data);
      currentTestId = ref.id;
      showToast('Test created! Now add sections.', 'success');
    }

    document.getElementById('sectionsArea').style.display = 'block';
    await loadSections(currentTestId);

  } catch(e) { showToast('Error saving', 'error'); console.error(e); }

  btn.disabled = false; btn.textContent = 'Save & Add Sections';
};

// ── SECTIONS ──
async function loadSections(testId) {
  const list = document.getElementById('sectionsList');
  try {
    const snap = await getDocs(collection(db, 'tests', testId, 'sections'));
    sectionsCache = [];
    snap.forEach(d => sectionsCache.push({ id: d.id, ...d.data() }));
    sectionsCache.sort((a, b) => (a.order||0) - (b.order||0));

    if (sectionsCache.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:16px;">No sections yet. Add a section above.</p>';
      return;
    }

    list.innerHTML = sectionsCache.map(s => `
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <h4 style="font-size:14px; font-weight:700;">${s.title}</h4>
          <button onclick="deleteSection('${s.id}')" class="btn btn-sm" style="background:#FEE2E2;color:#DC2626;border:none;">Del</button>
        </div>
        <div style="font-size:12px; color:var(--text-secondary);">
          ${s.questionIds?.length || 0} questions •
          ${s.marksPerQ} marks each •
          ${s.negativeMarks > 0 ? '-'+s.negativeMarks+' negative' : 'No negative marking'}
        </div>
      </div>
    `).join('');

  } catch(e) { console.error(e); }
}

window.showAddSection = function() {
  document.getElementById('sectionForm').style.display = 'block';
  document.getElementById('sectionForm').scrollIntoView({ behavior: 'smooth' });
};

window.hideSectionForm = function() {
  document.getElementById('sectionForm').style.display = 'none';
};

window.saveSection = async function() {
  const title = document.getElementById('sectionTitle').value.trim();
  const topicId = document.getElementById('sectionTopic').value;
  const marksPerQ = parseFloat(document.getElementById('marksPerQ').value) || 1;
  const negativeMarks = parseFloat(document.getElementById('negativeMarks').value) || 0;
  const questionCount = parseInt(document.getElementById('questionCount').value) || 10;

  if (!title) { showToast('Enter section title', 'error'); return; }
  if (!currentTestId) { showToast('Save test first', 'error'); return; }

  const btn = document.getElementById('saveSectionBtn');
  btn.disabled = true; btn.textContent = 'Adding...';

  try {
    // Auto-select questions from topic
    let questionIds = [];
    if (topicId) {
      const topicQuestions = questionsCache.filter(q => q.topicId === topicId);
      const shuffled = topicQuestions.sort(() => Math.random() - 0.5);
      questionIds = shuffled.slice(0, questionCount).map(q => q.id);
    }

    const sectionData = {
      title,
      topicId,
      questionIds,
      marksPerQ,
      negativeMarks,
      order: sectionsCache.length + 1,
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'tests', currentTestId, 'sections'), sectionData);
    showToast(`Section added with ${questionIds.length} questions!`, 'success');

    hideSectionForm();
    document.getElementById('sectionTitle').value = '';
    document.getElementById('sectionTopic').value = '';
    document.getElementById('questionCount').value = '';
    await loadSections(currentTestId);

  } catch(e) { showToast('Error adding section', 'error'); console.error(e); }

  btn.disabled = false; btn.textContent = 'Add Section';
};

window.deleteSection = async function(sectionId) {
  if (!confirm('Delete this section?')) return;
  try {
    await deleteDoc(doc(db, 'tests', currentTestId, 'sections', sectionId));
    showToast('Section deleted!', 'success');
    await loadSections(currentTestId);
  } catch(e) { showToast('Error', 'error'); }
};

window.finishTest = async function() {
  if (sectionsCache.length === 0) {
    showToast('Add at least one section first', 'error');
    return;
  }
  showToast('Test published successfully! 🎉', 'success');
  setTimeout(() => {
    hideCreateForm();
    loadTests();
  }, 1500);
};

// ── TOAST ──
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};