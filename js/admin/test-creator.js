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
let subjectsCache = [];
let topicsCache = [];
let questionsCache = [];
let currentTestId = null;
let sectionsCache = [];
let isActive = false;
let freshQuestionsFromExcel = [];
let testTotalMarks = 0;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  await loadExams();
  await loadSubjects();
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

async function loadSubjects() {
  const snap = await getDocs(collection(db, 'subjects'));
  subjectsCache = [];
  snap.forEach(d => subjectsCache.push({ id: d.id, ...d.data() }));
  subjectsCache.sort((a, b) => (a.order||0) - (b.order||0));
}

async function loadTopics() {
  const snap = await getDocs(collection(db, 'topics'));
  topicsCache = [];
  snap.forEach(d => topicsCache.push({ id: d.id, ...d.data() }));
  topicsCache.sort((a, b) => (a.order||0) - (b.order||0));
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
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
            <div class="exam-body-icon"
              style="background:linear-gradient(135deg,#DC2626,#b91c1c);font-size:20px;flex-shrink:0;">🎯</div>
            <div style="flex:1;">
              <h3 style="font-size:14px;font-weight:700;">${t.title}</h3>
              <p style="font-size:12px;color:var(--text-secondary);">
                ${t.duration} min • ${t.totalMarks} marks •
                ${t.isActive ? '🟢 Active' : '🔴 Inactive'}
              </p>
              ${scheduleInfo}
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="editTest('${t.id}')" class="btn btn-sm btn-outline">Edit</button>
            <button onclick="toggleTestActive('${t.id}',${t.isActive})" class="btn btn-sm"
              style="background:${t.isActive ? '#FEF3C7':'#DCFCE7'};
                     color:${t.isActive ? '#D97706':'var(--success)'};border:none;">
              ${t.isActive ? 'Deactivate':'Activate'}
            </button>
            <button onclick="shareTest('${t.id}','${encodeURIComponent(t.title)}')"
              class="btn btn-sm" style="background:#E0F2FE;color:#0284C7;border:none;">📤 Share</button>
            <button onclick="viewRankBoard('${t.id}')"
              class="btn btn-sm" style="background:#F3E8FF;color:#7C3AED;border:none;">🏆 Ranks</button>
            <button onclick="deleteTest('${t.id}')"
              class="btn btn-sm" style="background:#FEE2E2;color:#DC2626;border:none;">Delete</button>
          </div>
        </div>
      `;
    }).join('');
    list.style.display = 'flex';

  } catch(e) { console.error(e); }
}

// ── MARKS TRACKING ──
function getUsedMarks() {
  return sectionsCache.reduce((total, s) => {
    return total + ((s.questionIds?.length || 0) * (s.marksPerQ || 1));
  }, 0);
}

function getRemainingMarks() {
  return testTotalMarks - getUsedMarks();
}

function updateMarksDisplay() {
  const used = getUsedMarks();
  const total = testTotalMarks;
  const remaining = total - used;
  const percent = total > 0 ? Math.min((used / total) * 100, 100) : 0;

  document.getElementById('marksUsedDisplay').textContent =
    `${used} / ${total}`;
  document.getElementById('marksProgressBar').style.width = `${percent}%`;
  document.getElementById('marksProgressBar').style.background =
    percent >= 100 ? 'var(--danger)' : percent >= 80 ? 'var(--warning)' : 'var(--primary)';
  document.getElementById('marksRemainingText').textContent =
    remaining > 0
      ? `${remaining} marks remaining`
      : remaining === 0
      ? '✅ All marks used perfectly!'
      : `⚠️ Exceeded by ${Math.abs(remaining)} marks!`;
}

// ── CHECK MARKS WARNING ──
window.checkMarksWarning = function() {
  const qCount = parseInt(document.getElementById('questionCount').value) || 0;
  const marksPerQ = parseFloat(document.getElementById('marksPerQ').value) || 1;
  const sectionMarks = qCount * marksPerQ;
  const remaining = getRemainingMarks();
  const warning = document.getElementById('marksWarning');
  const warningText = document.getElementById('marksWarningText');

  if (sectionMarks > remaining && remaining > 0) {
    warning.style.display = 'block';
    warningText.textContent =
      `This section will use ${sectionMarks} marks but only ${remaining} marks are remaining. Please adjust question count or marks per question.`;
  } else if (remaining <= 0 && testTotalMarks > 0) {
    warning.style.display = 'block';
    warningText.textContent =
      `No marks remaining. Total marks (${testTotalMarks}) already used. Please edit existing sections first.`;
  } else {
    warning.style.display = 'none';
  }
};

// ── SUBJECT CHECKBOXES ──
function renderSubjectCheckboxes() {
  const container = document.getElementById('subjectCheckboxes');

  if (subjectsCache.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-secondary);">No subjects found. Add subjects first.</p>';
    return;
  }

  container.innerHTML = subjectsCache.map(s => `
    <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;
                  background:var(--bg);border-radius:var(--radius-sm);cursor:pointer;
                  border:1px solid var(--border);">
      <input type="checkbox" value="${s.id}"
        onchange="onSubjectChange()"
        style="width:18px;height:18px;cursor:pointer;accent-color:var(--primary);"/>
      <span style="font-size:14px;font-weight:500;">${s.name}</span>
    </label>
  `).join('');
}

window.onSubjectChange = function() {
  const selectedSubjectIds = getSelectedSubjectIds();
  renderTopicCheckboxes(selectedSubjectIds);
  updateAvailableCount();
};

function getSelectedSubjectIds() {
  const checkboxes = document.querySelectorAll(
    '#subjectCheckboxes input[type="checkbox"]:checked'
  );
  return Array.from(checkboxes).map(cb => cb.value);
}

function getSelectedTopicIds() {
  const checkboxes = document.querySelectorAll(
    '#topicCheckboxes input[type="checkbox"]:checked'
  );
  return Array.from(checkboxes).map(cb => cb.value);
}

function renderTopicCheckboxes(subjectIds) {
  const container = document.getElementById('topicCheckboxes');

  if (subjectIds.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-secondary);">Select subjects first to see topics.</p>';
    return;
  }

  const filteredTopics = topicsCache.filter(t =>
    subjectIds.includes(t.subjectId)
  );

  if (filteredTopics.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-secondary);">No topics found for selected subjects.</p>';
    return;
  }

  // Group by subject
  let html = '';
  subjectIds.forEach(sId => {
    const subject = subjectsCache.find(s => s.id === sId);
    const subjectTopics = filteredTopics.filter(t => t.subjectId === sId);
    if (subjectTopics.length === 0) return;

    html += `
      <div style="margin-bottom:8px;">
        <p style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:6px;">
          ${subject?.name || ''}
        </p>
        ${subjectTopics.map(t => `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;
                        background:var(--bg);border-radius:var(--radius-sm);cursor:pointer;
                        border:1px solid var(--border);margin-bottom:4px;">
            <input type="checkbox" value="${t.id}"
              onchange="updateAvailableCount()"
              style="width:18px;height:18px;cursor:pointer;accent-color:var(--primary);"/>
            <span style="font-size:13px;">${t.name}</span>
          </label>
        `).join('')}
      </div>
    `;
  });

  container.innerHTML = html;
}

// ── UPDATE AVAILABLE QUESTION COUNT ──
window.updateAvailableCount = function() {
  const topicIds = getSelectedTopicIds();
  const sources = [];
  if (document.getElementById('sourcePYQ').checked) sources.push('PYQ');
  if (document.getElementById('sourceIMP').checked) sources.push('IMP');

  const difficulties = [];
  if (document.getElementById('diffEasy').checked) difficulties.push('easy');
  if (document.getElementById('diffMedium').checked) difficulties.push('medium');
  if (document.getElementById('diffHard').checked) difficulties.push('hard');

  const available = questionsCache.filter(q => {
    const matchTopic = topicIds.length === 0 || topicIds.includes(q.topicId);
    const matchSource = sources.length === 0 || sources.includes(q.type);
    const matchDiff = difficulties.length === 0 || difficulties.includes(q.difficulty);
    return matchTopic && matchSource && matchDiff;
  });

  const info = document.getElementById('availableCountInfo');
  info.textContent = topicIds.length === 0
    ? 'Select topics to see available questions.'
    : `✅ ${available.length} questions available matching your filters.`;
  info.style.color = available.length > 0 ? 'var(--success)' : 'var(--danger)';

  checkMarksWarning();
};

// ── TOGGLE ACTIVE ──
window.toggleActive = function() {
  isActive = !isActive;
  document.getElementById('toggleSlider').style.background =
    isActive ? 'var(--primary)' : '#CBD5E1';
};

window.toggleTestActive = async function(testId, current) {
  try {
    await updateDoc(doc(db, 'tests', testId), { isActive: !current });
    showToast(`Test ${!current ? 'activated':'deactivated'}!`, 'success');
    await loadTests();
  } catch(e) { showToast('Error', 'error'); }
};

// ── DELETE TEST ──
window.deleteTest = async function(testId) {
  if (!confirm('Delete this test permanently?')) return;
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
  } catch(e) { showToast('Error deleting', 'error'); console.error(e); }
};

// ── SHARE & RANK ──
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

window.viewRankBoard = function(testId) {
  window.open(`/rankboard.html?testId=${testId}`, '_blank');
};

// ── CREATE FORM ──
window.showCreateForm = function() {
  currentTestId = null;
  sectionsCache = [];
  isActive = false;
  freshQuestionsFromExcel = [];
  testTotalMarks = 0;
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
    testTotalMarks = t.totalMarks || 0;

    document.getElementById('testFormTitle').textContent = 'Edit Test';
    document.getElementById('testTitle').value = t.title || '';
    document.getElementById('testExamSelect').value = t.examId || '';
    document.getElementById('testDuration').value = t.duration || '';
    document.getElementById('testTotalMarks').value = t.totalMarks || '';
    isActive = t.isActive || false;
    document.getElementById('toggleSlider').style.background =
      isActive ? 'var(--primary)' : '#CBD5E1';

    if (t.activateAt) {
      const d = t.activateAt.toDate ? t.activateAt.toDate() : new Date(t.activateAt);
      document.getElementById('testActivateAt').value = d.toISOString().slice(0,16);
    } else { document.getElementById('testActivateAt').value = ''; }

    if (t.expiresAt) {
      const d = t.expiresAt.toDate ? t.expiresAt.toDate() : new Date(t.expiresAt);
      document.getElementById('testExpiresAt').value = d.toISOString().slice(0,16);
    } else { document.getElementById('testExpiresAt').value = ''; }

    document.getElementById('testsListSection').style.display = 'none';
    document.getElementById('testForm').style.display = 'block';
    document.getElementById('sectionsArea').style.display = 'block';

    await loadSections(testId);
    updateMarksDisplay();

  } catch(e) { console.error(e); }
};

// ── SAVE TEST ──
window.saveTestDetails = async function() {
  const title = document.getElementById('testTitle').value.trim();
  const examId = document.getElementById('testExamSelect').value;
  const duration = parseInt(document.getElementById('testDuration').value) || 60;
  const totalMarks = parseInt(document.getElementById('testTotalMarks').value) || 0;
  const activateAtVal = document.getElementById('testActivateAt').value;
  const expiresAtVal = document.getElementById('testExpiresAt').value;

  if (!title) { showToast('Enter test title', 'error'); return; }
  if (totalMarks <= 0) { showToast('Enter valid total marks', 'error'); return; }

  testTotalMarks = totalMarks;

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
    updateMarksDisplay();

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

    updateMarksDisplay();

    if (sectionsCache.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:16px;">No sections yet.</p>';
      return;
    }

    list.innerHTML = sectionsCache.map(s => {
      const sectionMarks = (s.questionIds?.length || 0) * (s.marksPerQ || 1);
      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 style="font-size:14px;font-weight:700;">${s.title}</h4>
            <button onclick="deleteSection('${s.id}')" class="btn btn-sm"
              style="background:#FEE2E2;color:#DC2626;border:none;">Del</button>
          </div>
          <div style="font-size:12px;color:var(--text-secondary);display:flex;flex-wrap:wrap;gap:8px;">
            <span>📝 ${s.questionIds?.length || 0} questions</span>
            <span>✅ ${s.marksPerQ} marks/Q</span>
            <span>❌ ${s.negativeMarks > 0 ? '-'+s.negativeMarks : 'No negative'}</span>
            <span style="color:var(--primary);font-weight:600;">🏆 ${sectionMarks} marks total</span>
          </div>
        </div>
      `;
    }).join('');

  } catch(e) { console.error(e); }
}

window.showAddSection = function() {
  freshQuestionsFromExcel = [];
  document.getElementById('freshQStatus').style.display = 'none';
  document.getElementById('sectionTitle').value = '';
  document.getElementById('marksPerQ').value = '1';
  document.getElementById('negativeMarks').value = '0';
  document.getElementById('questionCount').value = '';
  document.getElementById('marksWarning').style.display = 'none';
  document.getElementById('availableCountInfo').textContent =
    'Select subjects, topics and filters to see available questions.';
  document.getElementById('availableCountInfo').style.color = 'var(--text-secondary)';

  // Reset all checkboxes
  document.querySelectorAll('#subjectCheckboxes input').forEach(cb => cb.checked = false);
  document.getElementById('sourcePYQ').checked = false;
  document.getElementById('sourceIMP').checked = true;
  document.getElementById('diffEasy').checked = true;
  document.getElementById('diffMedium').checked = true;
  document.getElementById('diffHard').checked = true;
  document.getElementById('topicCheckboxes').innerHTML =
    '<p style="font-size:12px;color:var(--text-secondary);">Select subjects first to see topics.</p>';

  // Render subject checkboxes
  renderSubjectCheckboxes();

  document.getElementById('sectionForm').style.display = 'block';
  document.getElementById('sectionForm').scrollIntoView({ behavior: 'smooth' });
};

window.hideSectionForm = function() {
  document.getElementById('sectionForm').style.display = 'none';
  freshQuestionsFromExcel = [];
};

window.saveSection = async function() {
  const title = document.getElementById('sectionTitle').value.trim();
  const marksPerQ = parseFloat(document.getElementById('marksPerQ').value) || 1;
  const negativeMarks = parseFloat(document.getElementById('negativeMarks').value) || 0;
  const questionCount = parseInt(document.getElementById('questionCount').value) || 0;

  if (!title) { showToast('Enter section title', 'error'); return; }
  if (!currentTestId) { showToast('Save test first', 'error'); return; }

  // Marks validation
  const sectionMarks = questionCount * marksPerQ;
  const remaining = getRemainingMarks();

  if (freshQuestionsFromExcel.length === 0 && questionCount === 0) {
    showToast('Enter number of questions or upload Excel', 'error');
    return;
  }

  if (sectionMarks > remaining && freshQuestionsFromExcel.length === 0) {
    showToast(
      `Warning: Section uses ${sectionMarks} marks but only ${remaining} remaining. Adjust and try again.`,
      'warning'
    );
    return;
  }

  const btn = document.getElementById('saveSectionBtn');
  btn.disabled = true; btn.textContent = 'Adding...';

  try {
    let questionIds = [];

    if (freshQuestionsFromExcel.length > 0) {
      // Save fresh questions from Excel
      showToast('Saving fresh questions...', 'info');
      for (const qData of freshQuestionsFromExcel) {
        const ref = await addDoc(collection(db, 'questions'), {
          ...qData, createdAt: serverTimestamp()
        });
        questionIds.push(ref.id);
      }
      freshQuestionsFromExcel = [];
      document.getElementById('freshQStatus').style.display = 'none';

    } else {
      // Filter questions based on selections
      const topicIds = getSelectedTopicIds();
      const sources = [];
      if (document.getElementById('sourcePYQ').checked) sources.push('PYQ');
      if (document.getElementById('sourceIMP').checked) sources.push('IMP');

      const difficulties = [];
      if (document.getElementById('diffEasy').checked) difficulties.push('easy');
      if (document.getElementById('diffMedium').checked) difficulties.push('medium');
      if (document.getElementById('diffHard').checked) difficulties.push('hard');

      const filtered = questionsCache.filter(q => {
        const matchTopic = topicIds.length === 0 || topicIds.includes(q.topicId);
        const matchSource = sources.length === 0 || sources.includes(q.type);
        const matchDiff = difficulties.length === 0 || difficulties.includes(q.difficulty);
        return matchTopic && matchSource && matchDiff;
      });

      if (filtered.length === 0) {
        showToast('No questions found matching your filters', 'error');
        btn.disabled = false; btn.textContent = 'Add Section';
        return;
      }

      // Shuffle and pick
      const shuffled = filtered.sort(() => Math.random() - 0.5);
      questionIds = shuffled.slice(0, questionCount).map(q => q.id);
    }

    // Save section
    await addDoc(collection(db, 'tests', currentTestId, 'sections'), {
      title, questionIds, marksPerQ, negativeMarks,
      order: sectionsCache.length + 1,
      createdAt: serverTimestamp()
    });

    showToast(`Section added with ${questionIds.length} questions!`, 'success');
    hideSectionForm();
    await loadSections(currentTestId);
    updateMarksDisplay();

  } catch(e) {
    showToast('Error adding section', 'error');
    console.error(e);
  }

  btn.disabled = false; btn.textContent = 'Add Section';
};

window.deleteSection = async function(sectionId) {
  if (!confirm('Delete this section?')) return;
  try {
    await deleteDoc(doc(db, 'tests', currentTestId, 'sections', sectionId));
    showToast('Section deleted!', 'success');
    await loadSections(currentTestId);
    updateMarksDisplay();
  } catch(e) { showToast('Error', 'error'); }
};

window.finishTest = async function() {
  if (sectionsCache.length === 0) {
    showToast('Add at least one section first', 'error');
    return;
  }

  const used = getUsedMarks();
  if (used !== testTotalMarks) {
    const diff = testTotalMarks - used;
    if (!confirm(
      `Warning: Used marks (${used}) ${diff > 0 ? 'is less than' : 'exceeds'} total marks (${testTotalMarks}) by ${Math.abs(diff)}. Publish anyway?`
    )) return;
  }

  showToast('Test published successfully! 🎉', 'success');
  setTimeout(() => { hideCreateForm(); loadTests(); }, 1500);
};

// ── FRESH QUESTIONS EXCEL ──
window.downloadFreshQTemplate = function() {
  const wb = XLSX.utils.book_new();
  const headers = [
    'Question Text',
    'Option A', 'Option B', 'Option C', 'Option D',
    'Correct Answer (A/B/C/D)',
    'Type (PYQ or IMP)',
    'Difficulty (easy/medium/hard)',
    'Explanation',
    'PYQ Exam Name (if PYQ)',
    'PYQ Year (if PYQ)',
    'PYQ Exam Body (if PYQ)'
  ];
  const sample = [
    'Which article deals with Right to Equality?',
    'Article 12', 'Article 14', 'Article 19', 'Article 21',
    'B', 'PYQ', 'medium',
    'Article 14 deals with Right to Equality',
    'Talati', '2022', 'GPSSB'
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

    freshQuestionsFromExcel = dataRows.map(row => {
      const type = String(row[6]||'IMP').trim().toUpperCase();
      const qData = {
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
        type: type === 'PYQ' ? 'PYQ' : 'IMP',
        difficulty: String(row[7]||'medium').trim().toLowerCase(),
        explanation: String(row[8]||'').trim()
      };

      if (type === 'PYQ') {
        qData.pyqExamName = String(row[9]||'').trim();
        qData.pyqYear = String(row[10]||'').trim();
        qData.pyqExamBodyName = String(row[11]||'').trim();
      }

      return qData;
    }).filter(q => q.questionText && q.options[0]);

    status.style.background = '#DCFCE7';
    status.style.color = 'var(--success)';
    status.textContent =
      `✅ ${freshQuestionsFromExcel.length} questions ready. Click "Add Section" to save.`;

  } catch(e) {
    status.style.background = '#FEE2E2';
    status.style.color = '#DC2626';
    status.textContent = 'Error reading file.';
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