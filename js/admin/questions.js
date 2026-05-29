// ============================================
// NISHCHAY ACADEMY — Admin Question Bank
// ============================================

import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

let subjectsCache = [];
let topicsCache = [];
let questionsCache = [];
let filteredQuestions = [];
let editingQId = null;
let selectedCorrect = 0;
let selectedType = 'PYQ';
let bulkModeActive = false;
let selectedQuestionIds = new Set();

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
  subjectsCache.sort((a, b) => (a.order||0) - (b.order||0));

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
  topicsCache.sort((a, b) => (a.order||0) - (b.order||0));
}

async function loadQuestions() {
  const loader = document.getElementById('questionsLoader');
  const list = document.getElementById('questionsList');

  try {
    const snap = await getDocs(collection(db, 'questions'));
    questionsCache = [];
    snap.forEach(d => {
      const data = d.data();
      if (!data.isTestOnly) {
        questionsCache.push({ id: d.id, ...data });
      }
    });
    filteredQuestions = [...questionsCache];
    loader.style.display = 'none';
    renderQuestions(filteredQuestions);
  } catch(e) {
    console.error(e);
    loader.style.display = 'none';
  }
}

// ── FILTER ──
window.onSubjectFilterChange = function() {
  const subjectId = document.getElementById('filterSubject').value;
  const topicSelect = document.getElementById('filterTopic');
  topicSelect.innerHTML = '<option value="">All Topics</option>';
  if (subjectId) {
    topicsCache
      .filter(t => t.subjectId === subjectId)
      .forEach(t => {
        topicSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`;
      });
  }
  filterQuestions();
};

window.filterQuestions = function() {
  const subjectFilter = document.getElementById('filterSubject').value;
  const topicFilter = document.getElementById('filterTopic').value;
  const typeFilter = document.getElementById('filterType').value;
  const diffFilter = document.getElementById('filterDifficulty').value;

  filteredQuestions = questionsCache.filter(q => {
    const matchSubject = !subjectFilter || q.subjectId === subjectFilter;
    const matchTopic = !topicFilter || q.topicId === topicFilter;
    const matchType = !typeFilter || q.type === typeFilter;
    const matchDiff = !diffFilter || q.difficulty === diffFilter;
    return matchSubject && matchTopic && matchType && matchDiff;
  });

  if (bulkModeActive) {
    selectedQuestionIds.clear();
    updateSelectedCount();
  }

  renderQuestions(filteredQuestions);
};

function updateSelectedCount() {
  const el = document.getElementById('selectedCountText');
  if (el) el.textContent = `${selectedQuestionIds.size} selected`;
}

// ── RENDER ──
function renderQuestions(questions) {
  const list = document.getElementById('questionsList');
  const count = document.getElementById('questionsCount');

  count.textContent =
    `${questions.length} question${questions.length !== 1 ? 's' : ''} found`;

  if (questions.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:20px;">No questions found</p>';
    list.style.display = 'flex';
    return;
  }

  list.innerHTML = questions.map(q => {
    const subject = subjectsCache.find(s => s.id === q.subjectId);
    const topic = topicsCache.find(t => t.id === q.topicId);
    const typeBadge = q.type === 'PYQ'
      ? `<span class="badge badge-warning">PYQ ${q.pyqYear||''}</span>`
      : `<span class="badge badge-success">IMP</span>`;
    const diffBadge = q.difficulty === 'easy'
      ? `<span class="badge badge-success" style="font-size:10px;">Easy</span>`
      : q.difficulty === 'hard'
      ? `<span class="badge badge-danger" style="font-size:10px;">Hard</span>`
      : `<span class="badge badge-warning" style="font-size:10px;">Medium</span>`;

    // Image badge — shown if question has any images
    const hasImages = q.questionImage ||
      (q.optionImages && q.optionImages.some(u => u));
    const imageBadge = hasImages
      ? `<span style="font-size:10px;background:#E0F2FE;
           color:#0284C7;padding:2px 6px;border-radius:4px;
           font-weight:600;">🖼️ IMG</span>`
      : '';

    const checkbox = bulkModeActive ? `
      <input type="checkbox" class="question-select-cb"
        ${selectedQuestionIds.has(q.id) ? 'checked' : ''}
        onchange="toggleQuestionSelect('${q.id}', this)"
        style="width:20px;height:20px;cursor:pointer;
               accent-color:var(--primary);flex-shrink:0;
               margin-top:2px;"/>
    ` : '';

    return `
      <div class="card">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          ${checkbox}
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;
                        align-items:flex-start;gap:8px;
                        margin-bottom:6px;flex-wrap:wrap;">
              <p style="font-size:14px;font-weight:600;flex:1;
                         line-height:1.5;min-width:200px;">
                ${q.questionText || '(Image Question)'}
                ${q.questionImage
                  ? `<img src="${q.questionImage}"
                       style="display:block;max-width:100%;
                              max-height:80px;object-fit:contain;
                              border-radius:6px;margin-top:6px;
                              border:1px solid var(--border);" />` : ''}
              </p>
              <div style="display:flex;gap:4px;flex-wrap:wrap;flex-shrink:0;">
                ${typeBadge}
                ${diffBadge}
                ${imageBadge}
              </div>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">
              📚 ${subject ? subject.name : 'No subject'}
              ${topic ? ' → 📖 '+topic.name : ''}
              ${q.type === 'PYQ' && q.pyqExamName
                ? ' • '+q.pyqExamName+' '+q.pyqYear : ''}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;
                        gap:4px;margin-bottom:8px;">
              ${q.options ? q.options.map((opt, i) => {
                const hasOptImg = q.optionImages && q.optionImages[i];
                return `
                  <div style="font-size:12px;padding:5px 8px;
                              border-radius:6px;
                    background:${i === q.correctOption ? '#DCFCE7' : '#F8FAFC'};
                    color:${i === q.correctOption
                      ? 'var(--success)' : 'var(--text-secondary)'};
                    border:1px solid ${i === q.correctOption
                      ? '#BBF7D0' : 'var(--border)'};">
                    ${['A','B','C','D'][i]}.
                    ${hasOptImg
                      ? `<img src="${q.optionImages[i]}"
                           style="max-height:40px;max-width:100%;
                                  object-fit:contain;
                                  border-radius:4px;
                                  vertical-align:middle;
                                  margin-left:4px;" />`
                      : opt}
                    ${i === q.correctOption ? ' ✓' : ''}
                  </div>
                `;
              }).join('') : ''}
            </div>
            ${!bulkModeActive ? `
              <div style="display:flex;gap:6px;">
                <button onclick="editQuestion('${q.id}')"
                  class="btn btn-sm btn-outline">Edit</button>
                <button onclick="deleteQuestion('${q.id}')"
                  class="btn btn-sm"
                  style="background:#FEE2E2;color:#DC2626;border:none;">
                  Delete
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  list.style.display = 'flex';
}

// ── BULK MODE ──
window.toggleBulkMode = function() {
  bulkModeActive = !bulkModeActive;
  selectedQuestionIds.clear();

  const btn = document.getElementById('bulkModeBtn');
  const bar = document.getElementById('bulkDeleteBar');

  btn.textContent = bulkModeActive ? '✕ Cancel Select' : '☑ Select';
  btn.style.background = bulkModeActive ? '#FEE2E2' : 'transparent';
  btn.style.color = bulkModeActive ? '#DC2626' : 'var(--primary)';
  bar.style.display = bulkModeActive ? 'flex' : 'none';

  renderQuestions(filteredQuestions);
};

window.toggleQuestionSelect = function(id, checkbox) {
  if (checkbox.checked) {
    selectedQuestionIds.add(id);
  } else {
    selectedQuestionIds.delete(id);
  }
  updateSelectedCount();
};

window.selectAllVisible = function() {
  filteredQuestions.forEach(q => selectedQuestionIds.add(q.id));
  document.querySelectorAll('.question-select-cb').forEach(cb => {
    cb.checked = true;
  });
  updateSelectedCount();
};

window.selectAllFiltered = function() {
  filteredQuestions.forEach(q => selectedQuestionIds.add(q.id));
  document.querySelectorAll('.question-select-cb').forEach(cb => {
    cb.checked = true;
  });
  updateSelectedCount();
  showToast(`${selectedQuestionIds.size} questions selected`, 'info');
};

window.clearSelection = function() {
  selectedQuestionIds.clear();
  document.querySelectorAll('.question-select-cb').forEach(cb => {
    cb.checked = false;
  });
  updateSelectedCount();
};

window.deleteSelectedQuestions = async function() {
  if (selectedQuestionIds.size === 0) {
    showToast('Select at least one question', 'error');
    return;
  }
  if (!confirm(
    `⚠️ Delete ${selectedQuestionIds.size} questions permanently?\n\nThis cannot be undone.`
  )) return;

  const deleteBtn = document.querySelector('#bulkDeleteBar button:last-child');
  if (deleteBtn) { deleteBtn.disabled = true; deleteBtn.textContent = 'Deleting...'; }

  let deleted = 0;
  try {
    for (const id of selectedQuestionIds) {
      await deleteDoc(doc(db, 'questions', id));
      deleted++;
    }
    showToast(`✅ ${deleted} questions deleted!`, 'success');
    selectedQuestionIds.clear();
    bulkModeActive = false;

    const btn = document.getElementById('bulkModeBtn');
    const bar = document.getElementById('bulkDeleteBar');
    if (btn) {
      btn.textContent = '☑ Select';
      btn.style.background = 'transparent';
      btn.style.color = 'var(--primary)';
    }
    if (bar) bar.style.display = 'none';

    await loadQuestions();
    filterQuestions();

  } catch(e) {
    showToast('Error deleting questions', 'error');
    console.error(e);
  }

  if (deleteBtn) {
    deleteBtn.disabled = false;
    deleteBtn.textContent = '🗑 Delete Selected';
  }
};

// ── IMAGE FIELDS — injected dynamically into the form ──
function ensureImageFields() {
  if (document.getElementById('imageFieldsContainer')) return;

  const saveBtn = document.getElementById('saveQBtn');
  if (!saveBtn) return;

  const container = document.createElement('div');
  container.id = 'imageFieldsContainer';
  container.style.cssText = 'margin-bottom:16px;';
  container.innerHTML = `
    <div style="padding:14px;background:#F0F9FF;
                border-radius:10px;border:1px solid #BAE6FD;">
      <p style="font-size:13px;font-weight:700;
                color:#0284C7;margin-bottom:4px;">
        🖼️ Image URLs
        <span style="font-weight:400;font-size:11px;
                     color:var(--text-secondary);margin-left:6px;">
          (Optional — leave blank for text-only)
        </span>
      </p>
      <p style="font-size:11px;color:var(--text-secondary);
                margin-bottom:12px;line-height:1.5;">
        Upload images to GitHub → assets/question-images/ folder → 
        copy the raw URL → paste below.
      </p>

      <label style="font-size:12px;font-weight:600;
                    display:block;margin-bottom:4px;">
        Question Image URL
      </label>
      <input id="questionImageUrl" type="url"
        placeholder="https://raw.githubusercontent.com/firstrank1993/nishchay-academy/main/assets/question-images/..."
        style="width:100%;padding:10px 12px;
               border:1.5px solid var(--border);
               border-radius:var(--radius-sm);font-size:13px;
               font-family:Inter,sans-serif;
               box-sizing:border-box;margin-bottom:12px;" />

      ${['A','B','C','D'].map((l,i) => `
        <label style="font-size:12px;font-weight:600;
                      display:block;margin-bottom:4px;">
          Option ${l} Image URL
        </label>
        <input id="optImgUrl${i}" type="url"
          placeholder="https://raw.githubusercontent.com/firstrank1993/nishchay-academy/main/assets/question-images/..."
          style="width:100%;padding:10px 12px;
                 border:1.5px solid var(--border);
                 border-radius:var(--radius-sm);font-size:13px;
                 font-family:Inter,sans-serif;
                 box-sizing:border-box;margin-bottom:10px;" />
      `).join('')}
    </div>
  `;

  saveBtn.parentNode.insertBefore(container, saveBtn);
}

function clearImageFields() {
  const qImg = document.getElementById('questionImageUrl');
  if (qImg) qImg.value = '';
  [0,1,2,3].forEach(i => {
    const el = document.getElementById(`optImgUrl${i}`);
    if (el) el.value = '';
  });
}

function populateImageFields(q) {
  const qImg = document.getElementById('questionImageUrl');
  if (qImg) qImg.value = q.questionImage || '';
  [0,1,2,3].forEach(i => {
    const el = document.getElementById(`optImgUrl${i}`);
    if (el) el.value = (q.optionImages && q.optionImages[i]) ? q.optionImages[i] : '';
  });
}

// ── ADD/EDIT FORM ──
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
  document.getElementById('qTopicSelect').innerHTML =
    '<option value="">Select Topic</option>';
  document.getElementById('difficulty').value = 'medium';
  setCorrect(0);
  selectType('PYQ');

  document.getElementById('questionForm').style.display = 'block';
  ensureImageFields();
  clearImageFields();

  document.getElementById('questionForm').scrollIntoView({
    behavior: 'smooth'
  });
};

window.hideForm = function() {
  document.getElementById('questionForm').style.display = 'none';
  editingQId = null;
};

window.selectType = function(type) {
  selectedType = type;
  document.getElementById('typePYQ').style.background =
    type === 'PYQ' ? 'var(--primary)' : 'transparent';
  document.getElementById('typePYQ').style.color =
    type === 'PYQ' ? 'white' : 'var(--primary)';
  document.getElementById('typeIMP').style.background =
    type === 'IMP' ? 'var(--primary)' : 'transparent';
  document.getElementById('typeIMP').style.color =
    type === 'IMP' ? 'white' : 'var(--primary)';
  document.getElementById('pyqInfo').style.display =
    type === 'PYQ' ? 'block' : 'none';
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
  ensureImageFields();
  populateImageFields(q);

  document.getElementById('questionForm').scrollIntoView({
    behavior: 'smooth'
  });
};

window.saveQuestion = async function() {
  const questionText =
    document.getElementById('questionText').value.trim();
  const subjectId =
    document.getElementById('qSubjectSelect').value;
  const topicId =
    document.getElementById('qTopicSelect').value;
  const options = [
    document.getElementById('opt0').value.trim(),
    document.getElementById('opt1').value.trim(),
    document.getElementById('opt2').value.trim(),
    document.getElementById('opt3').value.trim(),
  ];
  const explanation =
    document.getElementById('explanation').value.trim();
  const difficulty =
    document.getElementById('difficulty').value;

  // Image fields (optional)
  const questionImageUrl =
    (document.getElementById('questionImageUrl')?.value || '').trim();
  const optionImageUrls = [0,1,2,3].map(i =>
    (document.getElementById(`optImgUrl${i}`)?.value || '').trim()
  );

  // Validation — allow empty questionText if there's a question image
  if (!questionText && !questionImageUrl) {
    showToast('Enter question text or add a question image', 'error');
    return;
  }
  if (!subjectId) { showToast('Select a subject', 'error'); return; }
  if (!topicId) { showToast('Select a topic', 'error'); return; }

  // Allow empty options only if they have images
  const optionsValid = options.every((opt, i) =>
    opt !== '' || (optionImageUrls[i] !== '')
  );
  if (!optionsValid) {
    showToast('Fill all 4 options (text or image URL)', 'error');
    return;
  }

  const btn = document.getElementById('saveQBtn');
  btn.disabled = true; btn.textContent = 'Saving...';

  const data = {
    questionText,
    options,
    correctOption: selectedCorrect,
    subjectId, topicId,
    type: selectedType,
    difficulty, explanation,
  };

  // Add image fields only if they have values
  if (questionImageUrl) {
    data.questionImage = questionImageUrl;
  }
  if (optionImageUrls.some(u => u !== '')) {
    data.optionImages = optionImageUrls;
  }

  if (selectedType === 'PYQ') {
    data.pyqExamName =
      document.getElementById('pyqExamName').value.trim();
    data.pyqYear =
      document.getElementById('pyqYear').value.trim();
    data.pyqExamBodyName =
      document.getElementById('pyqExamBodyName').value.trim();
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
    filterQuestions();
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
    filterQuestions();
  } catch(e) { showToast('Error deleting', 'error'); }
};

// ── BULK UPLOAD ──
window.showBulkUpload = function() {
  document.getElementById('bulkUploadSection').style.display = 'block';
  document.getElementById('bulkUploadSection').scrollIntoView({
    behavior: 'smooth'
  });
};

window.hideBulkUpload = function() {
  document.getElementById('bulkUploadSection').style.display = 'none';
};

window.downloadTemplate = function() {
  const wb = XLSX.utils.book_new();
  const headers = [
    'Question Text',
    'Option A', 'Option B', 'Option C', 'Option D',
    'Correct Answer (A/B/C/D)',
    'Type (PYQ or IMP)',
    'Subject Name',
    'Topic Name',
    'Difficulty (easy/medium/hard)',
    'Explanation',
    'PYQ Exam Name',
    'PYQ Year',
    'PYQ Exam Body',
    // ── NEW: Image URL columns ──
    'Question Image URL (optional)',
    'Option A Image URL (optional)',
    'Option B Image URL (optional)',
    'Option C Image URL (optional)',
    'Option D Image URL (optional)'
  ];
  const sampleRow = [
    'What is Article 14?',
    'Right to Equality',
    'Right to Freedom',
    'Right against Exploitation',
    'Right to Religion',
    'A', 'PYQ',
    'ભારતીય બંધારણ',
    'મૂળભૂત અધિકારો',
    'medium',
    'Article 14 deals with Right to Equality',
    'Talati', '2022', 'GPSSB',
    // Image URL columns — leave blank for text questions
    '', '', '', '', ''
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.writeFile(wb, 'nishchay_questions_template.xlsx');
  showToast('Template downloaded!', 'success');
};

window.handleExcelUpload = async function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const status = document.getElementById('uploadStatus');
  status.style.display = 'block';
  status.style.background = '#EFF6FF';
  status.style.color = 'var(--primary)';
  status.textContent = 'Reading Excel file...';

  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const dataRows = rows.slice(1).filter(row => row[0]);

    if (dataRows.length === 0) {
      status.style.background = '#FEE2E2';
      status.style.color = '#DC2626';
      status.textContent = 'No data found in Excel file.';
      return;
    }

    status.textContent = `Found ${dataRows.length} questions. Uploading...`;

    let success = 0; let failed = 0;

    for (const row of dataRows) {
      try {
        const questionText    = String(row[0]||'').trim();
        const optA            = String(row[1]||'').trim();
        const optB            = String(row[2]||'').trim();
        const optC            = String(row[3]||'').trim();
        const optD            = String(row[4]||'').trim();
        const correctLetter   = String(row[5]||'A').trim().toUpperCase();
        const type            = String(row[6]||'IMP').trim().toUpperCase();
        const subjectName     = String(row[7]||'').trim();
        const topicName       = String(row[8]||'').trim();
        const difficulty      = String(row[9]||'medium').trim().toLowerCase();
        const explanation     = String(row[10]||'').trim();
        const pyqExamName     = String(row[11]||'').trim();
        const pyqYear         = String(row[12]||'').trim();
        const pyqExamBodyName = String(row[13]||'').trim();
        // ── NEW: Image URL columns ──
        const questionImageUrl  = String(row[14]||'').trim();
        const optAImageUrl      = String(row[15]||'').trim();
        const optBImageUrl      = String(row[16]||'').trim();
        const optCImageUrl      = String(row[17]||'').trim();
        const optDImageUrl      = String(row[18]||'').trim();

        // Allow empty questionText if questionImageUrl is provided
        if (!questionText && !questionImageUrl) { failed++; continue; }
        if (!optA && !optAImageUrl) { failed++; continue; }

        const subject = subjectsCache.find(s =>
          s.name.toLowerCase() === subjectName.toLowerCase()
        );
        if (!subject) { failed++; continue; }

        const topic = topicsCache.find(t =>
          t.name.toLowerCase() === topicName.toLowerCase() &&
          t.subjectId === subject.id
        );
        if (!topic) { failed++; continue; }

        const correctMap = { 'A':0,'B':1,'C':2,'D':3 };
        const correctOption = correctMap[correctLetter] ?? 0;

        const qData = {
          questionText,
          options: [optA, optB, optC, optD],
          correctOption,
          subjectId: subject.id,
          topicId: topic.id,
          type: type === 'PYQ' ? 'PYQ' : 'IMP',
          difficulty, explanation,
          createdAt: serverTimestamp()
        };

        if (type === 'PYQ') {
          qData.pyqExamName = pyqExamName;
          qData.pyqYear = pyqYear;
          qData.pyqExamBodyName = pyqExamBodyName;
        }

        // Add image fields only if they have values
        if (questionImageUrl) {
          qData.questionImage = questionImageUrl;
        }
        const optionImages = [optAImageUrl, optBImageUrl, optCImageUrl, optDImageUrl];
        if (optionImages.some(u => u !== '')) {
          qData.optionImages = optionImages;
        }

        await addDoc(collection(db, 'questions'), qData);
        success++;

        if (success % 5 === 0) {
          status.textContent = `Uploading... ${success} done so far`;
        }

      } catch(e) { failed++; console.error('Row error:', e); }
    }

    status.style.background = '#DCFCE7';
    status.style.color = 'var(--success)';
    status.textContent =
      `✅ Done! ${success} uploaded. ${failed > 0 ? failed+' failed.' : ''}`;

    await loadQuestions();
    filterQuestions();

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
