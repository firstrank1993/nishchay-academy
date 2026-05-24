// ============================================
// NISHCHAY ACADEMY — Admin Test Creator
// ============================================

import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

let examsCache = [];
let topicsCache = [];
let questionsCache = [];
let currentTestId = null;
let sectionsCache = [];
let isActive = false;
let freshQuestionsFromExcel = [];

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
    tests.sort((a, b) =>
      (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)
    );

    loader.style.display = 'none';

    if (tests.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:20px;">No tests yet</p>';
      list.style.display = 'flex';
      return;
    }

    list.innerHTML = tests.map(t => {
      let scheduleInfo = '';
      if (t.activateAt) {
        const d = t.activateAt.toDate
          ? t.activateAt.toDate().toLocaleString('en-IN')
          : new Date(t.activateAt).toLocaleString('en-IN');
        scheduleInfo += `<div style="font-size:11px;color:var(--text-secondary);margin-top:3px;">🕐 Activates: ${d}</div>`;
      }
      if (t.expiresAt) {
        const d = t.expiresAt.toDate
          ? t.expiresAt.toDate().toLocaleString('en-IN')
          : new Date(t.expiresAt).toLocaleString('en-IN');
        scheduleInfo += `<div style="font-size:11px;color:var(--danger);margin-top:2px;">⏰ Expires: ${d}</div>`;
      }

      return `
        <div class="card">
          <div style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
            <div class="exam-body-icon"
              style="background:linear-gradient(135deg,#DC2626,#b91c1c);
                     font-size:20px; flex-shrink:0;">🎯</div>
            <div style="flex:1;">
              <h3 style="font-size:14px; font-weight:700;">${t.title}</h3>
              <p style="font-size:12px; color:var(--text-secondary);">
                ${t.duration} min • ${t.totalMarks} marks •
                ${t.isActive ? '🟢 Active' : '🔴 Inactive'}
              </p>
              ${scheduleInfo}
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button onclick="editTest('${t.id}')"
              class="btn btn-sm btn-outline">Edit</button>
            <button onclick="toggleTestActive('${t.id}', ${t.isActive})"
              class="btn btn-sm"
              style="background:${t.isActive ? '#FEF3C7' : '#DCFCE7'};
                     color:${t.isActive ? '#D97706' : 'var(--success)'};
                     border:none;">
              ${t.isActive ? 'Deactivate' : 'Activate'}
            </button>
            <button onclick="shareTest('${t.id}','${encodeURIComponent(t.title)}')"
              class="btn btn-sm"
              style="background:#E0F2FE;color:#0284C7;border:none;">
              📤 Share
            </button>
            <button onclick="viewRankBoard('${t.id}')"
              class="btn btn-sm"
              style="background:#F3E8FF;color:#7C3AED;border:none;">
              🏆 Ranks
            </button>
            <button onclick="deleteTest('${t.id}')"
              class="btn btn-sm"
              style="background:#FEE2E2;color:#DC2626;border:none;">
              Delete
            </button>
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
  document.getElementById('toggleSlider').style.background =
    isActive ? 'var(--primary)' : '#CBD5E1';
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
    const sectionsSnap = await getDocs(
      collection(db, 'tests', testId, 'sections')
    );
    for (const s of sectionsSnap.docs) {
      await deleteDoc(doc(db, 'tests', testId, 'sections', s.id));
    }
    await deleteDoc(doc(db, 'tests', testId));
    showToast('Test deleted!', 'success');
    await loadTests();
  } catch(e) {
    showToast('Error deleting test', 'error');
    console.error(e);
  }
};

// ── SHARE TEST ──
window.shareTest = function(testId, encodedTitle) {
  const testTitle = decodeURIComponent(encodedTitle);
  const url = `https://nishchayacademydhg.web.app/test.html?testId=${testId}`;
  const message = `📚 *Nishchay Academy*\n\n🎯 *${testTitle}*\n\nAttempt this mock test now:\n${url}`;
  if (navigator.share) {
    navigator.share({ title: testTitle, text: message, url });
  } else {
    navigator.clipboard.writeText(message).then(() => {
      showToast('Test link copied!', 'success');
    });
  }
};

// ── VIEW RANK BOARD ──
window.viewRankBoard = function(testId) {
  window.open(`/rankboard.html?testId=${testId}`, '_blank');
};

// ── FORM ──
window.showCreateForm = function() {
  currentTestId = null;
  sectionsCache = [];
  isActive = false;
  freshQuestionsFromExcel = [];
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
    document.getElementById('toggleSlider').style.background =
      isActive ? 'var(--primary)' : '#CBD5E1';

    if (t.activateAt) {
      const d = t.activateAt.toDate
        ? t.activateAt.toDate() : new Date(t.activateAt);
      document.getElementById('testActivateAt').value =
        d.toISOString().slice(0,16);
    } else {
      document.getElementById('testActivateAt').value = '';
    }

    if (t.expiresAt) {
      const d = t.expiresAt.toDate
        ? t.expiresAt.toDate() : new Date(t.expiresAt);
      document.getElementById('testExpiresAt').value =
        d.toISOString().slice(0,16);
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
      title, examId, duration, totalMarks, isActive,
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

  } catch(e) {
    showToast('Error saving', 'error');
    console.error(e);
  }

  btn.disabled = false; btn.textContent = 'Save & Add Sections';
};

// ── SECTIONS ──
async function loadSections(testId) {
  const list = document.getElementById('sectionsList');
  try {
    const snap = await getDocs(
      collection(db, 'tests', testId, 'sections')
    );
    sectionsCache = [];
    snap.forEach(d => sectionsCache.push({ id: d.id, ...d.data() }));
    sectionsCache.sort((a, b) => (a.order||0) - (b.order||0));

    if (sectionsCache.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:16px;">No sections yet. Add a section above.</p>';
      return;
    }

    list.innerHTML = sectionsCache.map(s => `
      <div class="card">
        <div style="display:flex; justify-content:space-between;
                    align-items:center; margin-bottom:8px;">
          <h4 style="font-size:14px; font-weight:700;">${s.title}</h4>
          <button onclick="deleteSection('${s.id}')"
            class="btn btn-sm"
            style="background:#FEE2E2;color:#DC2626;border:none;">Del</button>
        </div>
        <div style="font-size:12px; color:var(--text-secondary);">
          ${s.questionIds?.length || 0} questions •
          ${s.marksPerQ} marks each •
          ${s.negativeMarks > 0
            ? '-' + s.negativeMarks + ' negative'
            : 'No negative marking'}
        </div>
      </div>
    `).join('');

  } catch(e) { console.error(e); }
}

window.showAddSection = function() {
  freshQuestionsFromExcel = [];
  document.getElementById('freshQStatus').style.display = 'none';
  document.getElementById('sectionForm').style.display = 'block';
  document.getElementById('sectionForm').scrollIntoView({ behavior: 'smooth' });
};

window.hideSectionForm = function() {
  document.getElementById('sectionForm').style.display = 'none';
  freshQuestionsFromExcel = [];
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
    let questionIds = [];

    if (freshQuestionsFromExcel.length > 0 && !topicId) {
      // Save fresh questions from Excel first
      showToast('Saving fresh questions...', 'info');
      for (const qData of freshQuestionsFromExcel) {
        const ref = await addDoc(collection(db, 'questions'), {
          ...qData, createdAt: serverTimestamp()
        });
        questionIds.push(ref.id);
      }
      freshQuestionsFromExcel = [];
      document.getElementById('freshQStatus').style.display = 'none';
    } else if (topicId) {
      // Auto-select from existing questions by topic
      const topicQuestions = questionsCache.filter(
        q => q.topicId === topicId
      );
      const shuffled = topicQuestions.sort(() => Math.random() - 0.5);
      questionIds = shuffled.slice(0, questionCount).map(q => q.id);
    }

    await addDoc(collection(db, 'tests', currentTestId, 'sections'), {
      title, topicId, questionIds, marksPerQ, negativeMarks,
      order: sectionsCache.length + 1,
      createdAt: serverTimestamp()
    });

    showToast(`Section added with ${questionIds.length} questions!`, 'success');
    hideSectionForm();
    document.getElementById('sectionTitle').value = '';
    document.getElementById('sectionTopic').value = '';
    document.getElementById('questionCount').value = '';
    await loadSections(currentTestId);

  } catch(e) {
    showToast('Error adding section', 'error');
    console.error(e);
  }

  btn.disabled = false; btn.textContent = 'Add Section';
};

window.deleteSection = async function(sectionId) {
  if (!confirm('Delete this section?')) return;
  try {
    await deleteDoc(
      doc(db, 'tests', currentTestId, 'sections', sectionId)
    );
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
  setTimeout(() => { hideCreateForm(); loadTests(); }, 1500);
};

// ── FRESH QUESTIONS EXCEL UPLOAD ──
window.downloadFreshQTemplate = function() {
  const wb = XLSX.utils.book_new();
  const headers = [
    'Question Text',
    'Option A', 'Option B', 'Option C', 'Option D',
    'Correct Answer (A/B/C/D)',
    'Difficulty (easy/medium/hard)',
    'Explanation'
  ];
  const sample = [
    'Which article deals with Right to Equality?',
    'Article 12', 'Article 14', 'Article 19', 'Article 21',
    'B', 'medium',
    'Article 14 deals with Right to Equality'
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.writeFile(wb, 'fresh_questions_template.xlsx');
  showToast('Template downloaded!', 'success');
};

window.handleFreshQUpload = async function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const status = document.getElementById('freshQStatus');
  status.style.display = 'block';
  status.style.background = '#EFF6FF';
  status.style.color = 'var(--primary)';
  status.textContent = 'Reading file...';

  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const dataRows = rows.slice(1).filter(r => r[0]);

    freshQuestionsFromExcel = dataRows.map(row => ({
      questionText: String(row[0]||'').trim(),
      options: [
        String(row[1]||'').trim(),
        String(row[2]||'').trim(),
        String(row[3]||'').trim(),
        String(row[4]||'').trim()
      ],
      correctOption: ['A','B','C','D'].indexOf(
        String(row[5]||'A').trim().toUpperCase()
      ),
      difficulty: String(row[6]||'medium').trim().toLowerCase(),
      explanation: String(row[7]||'').trim(),
      type: 'IMP'
    })).filter(q => q.questionText && q.options[0]);

    status.style.background = '#DCFCE7';
    status.style.color = 'var(--success)';
    status.textContent =
      `✅ ${freshQuestionsFromExcel.length} questions ready. Now click "Add Section" to save.`;

  } catch(e) {
    status.style.background = '#FEE2E2';
    status.style.color = '#DC2626';
    status.textContent = 'Error reading file. Make sure it is a valid Excel file.';
    console.error(e);
  }

  event.target.value = '';
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