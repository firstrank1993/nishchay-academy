// ============================================
// NISHCHAY ACADEMY — Test Page
// ============================================

import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, doc, getDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const testIdParam = urlParams.get('testId');

let currentUser = null;
let testData = null;
let testSections = [];
let allTestQuestions = [];
let userAnswers = {};       // -1 = unattempted, -2 = skipped (5th option)
let reviewFlags = new Set();
let currentQIndex = 0;
let timerInterval = null;
let timeLeft = 0;
let testStartTime = null;
let questionStartTime = null;
let questionTimings = {};

onAuthStateChanged(auth, user => {
  currentUser = user;
});

document.addEventListener('DOMContentLoaded', async () => {
  if (testIdParam) {
    await loadTestIntro(testIdParam);
  } else {
    await loadAllTests();
  }
});

// ── LOAD ALL TESTS ──
async function loadAllTests() {
  const loader = document.getElementById('testsLoader');
  const list   = document.getElementById('testsList');
  const empty  = document.getElementById('testsEmpty');

  try {
    const snap = await getDocs(collection(db, 'tests'));
    const tests = [];

    snap.forEach(d => {
      const data = d.data();
      const now = new Date();
      const isActive    = data.isActive;
      const notExpired  = !data.expiresAt ||
        new Date(data.expiresAt.seconds * 1000) > now;
      const isActivated = !data.activateAt ||
        new Date(data.activateAt.seconds * 1000) <= now;
      if (isActive && notExpired && isActivated) {
        tests.push({ id: d.id, ...data });
      }
    });

    tests.sort((a, b) =>
      (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)
    );

    loader.style.display = 'none';

    if (tests.length === 0) {
      empty.style.display = 'block';
      return;
    }

    list.innerHTML = tests.map(t => `
      <div class="card">
        <div style="display:flex;align-items:center;gap:12px;
                    margin-bottom:12px;cursor:pointer;"
             onclick="window.location.href='test.html?testId=${t.id}'">
          <div class="exam-body-icon"
            style="background:linear-gradient(135deg,#DC2626,#b91c1c);
                   font-size:20px;flex-shrink:0;">🎯</div>
          <div style="flex:1;">
            <h3 style="font-size:15px;font-weight:700;">${t.title}</h3>
            <p style="font-size:12px;color:var(--text-secondary);">
              ${t.duration} min • ${t.totalMarks} marks
            </p>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="window.location.href='test.html?testId=${t.id}'"
            class="btn btn-primary btn-sm" style="flex:1;">
            Attempt Test
          </button>
          <button onclick="shareTest('${t.id}','${encodeURIComponent(t.title)}')"
            class="btn btn-sm"
            style="background:#E0F2FE;color:#0284C7;border:none;">
            📤 Share
          </button>
        </div>
      </div>
    `).join('');
    list.style.display = 'flex';

  } catch(e) {
    loader.style.display = 'none';
    empty.style.display = 'block';
    console.error(e);
  }
}

// ── SHARE TEST ──
window.shareTest = function(testId, encodedTitle) {
  const testTitle = decodeURIComponent(encodedTitle);
  const url = `https://nishchayacademydhg.web.app/test.html?testId=${testId}`;
  const message = `📚 *Nishchay Academy*\n\n🎯 *${testTitle}*\n\nAttempt this mock test now:\n${url}`;
  if (navigator.share) {
    navigator.share({ title: testTitle, text: message, url });
  } else {
    navigator.clipboard.writeText(message).then(() => {
      showToast('Link copied! Share on WhatsApp or Telegram.', 'success');
    });
  }
};

// ── LOAD TEST INTRO ──
async function loadTestIntro(testId) {
  document.getElementById('testsListSection').style.display = 'none';
  document.getElementById('testIntroSection').style.display = 'block';

  try {
    const testSnap = await getDoc(doc(db, 'tests', testId));
    if (!testSnap.exists()) {
      window.location.href = 'test.html';
      return;
    }

    testData = { id: testSnap.id, ...testSnap.data() };

    const sectionsSnap = await getDocs(
      collection(db, 'tests', testId, 'sections')
    );
    testSections = [];
    sectionsSnap.forEach(d =>
      testSections.push({ id: d.id, ...d.data() })
    );
    testSections.sort((a, b) => (a.order||0) - (b.order||0));

    let totalQ = 0;
    testSections.forEach(s => totalQ += (s.questionIds?.length || 0));

    document.getElementById('introTitle').textContent     = testData.title;
    document.getElementById('testTitle').textContent      = testData.title;
    document.getElementById('introDuration').textContent  = `${testData.duration} minutes`;
    document.getElementById('introQuestions').textContent = totalQ;
    document.getElementById('introMarks').textContent     = testData.totalMarks;

    const hasNegative = testSections.some(s => s.negativeMarks > 0);
    document.getElementById('introNegative').textContent =
      hasNegative ? 'Yes' : 'No';

  } catch(e) { console.error(e); }
}

// ── START TEST ──
window.startTest = async function() {
  if (!currentUser) {
    showToast('Please login to attempt test', 'error');
    return;
  }

  document.getElementById('startBtn').disabled = true;
  document.getElementById('startBtn').textContent = 'Loading questions...';

  try {
    allTestQuestions = [];

    for (const section of testSections) {
      for (const qId of (section.questionIds || [])) {
        const qSnap = await getDoc(doc(db, 'questions', qId));
        if (qSnap.exists()) {
          allTestQuestions.push({
            id: qSnap.id,
            ...qSnap.data(),
            sectionId:    section.id,
            sectionTitle: section.title,
            marksPerQ:    section.marksPerQ    || 1,
            negativeMarks: section.negativeMarks || 0
          });
        }
      }
    }

    if (allTestQuestions.length === 0) {
      showToast('No questions in this test yet', 'error');
      document.getElementById('startBtn').disabled = false;
      document.getElementById('startBtn').textContent = 'Start Test 🎯';
      return;
    }

    userAnswers      = {};
    questionTimings  = {};
    reviewFlags      = new Set();
    currentQIndex    = 0;
    questionStartTime = new Date();
    testStartTime    = new Date();

    timeLeft = testData.duration * 60;
    startTimer();

    document.getElementById('testIntroSection').style.display = 'none';
    document.getElementById('testArea').style.display         = 'block';
    document.getElementById('timerDisplay').style.display     = 'block';
    document.getElementById('bottomNav').style.display        = 'none';

    buildQuestionNav();
    showTestQuestion();

  } catch(e) {
    console.error(e);
    showToast('Error loading test', 'error');
    document.getElementById('startBtn').disabled = false;
    document.getElementById('startBtn').textContent = 'Start Test 🎯';
  }
};

// ── TIMER ──
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      showToast('Time up! Submitting test...', 'warning');
      setTimeout(submitTest, 2000);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins  = Math.floor(timeLeft / 60);
  const secs  = timeLeft % 60;
  const display =
    `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  document.getElementById('timerDisplay').textContent = display;
  if (timeLeft <= 300) {
    document.getElementById('timerDisplay').style.background =
      'rgba(220,38,38,0.3)';
  }
}

// ── QUESTION NAVIGATOR ──
function buildQuestionNav() {
  const nav = document.getElementById('questionNav');
  nav.innerHTML = allTestQuestions.map((q, i) => `
    <button onclick="goToQuestion(${i})" id="navBtn${i}"
      style="width:34px;height:34px;border-radius:8px;
             border:1.5px solid var(--border);
             background:white;font-size:11px;font-weight:600;
             cursor:pointer;font-family:Inter,sans-serif;">
      ${i+1}
    </button>
  `).join('');
}

function updateNavButton(index) {
  const btn = document.getElementById(`navBtn${index}`);
  if (!btn) return;
  const q        = allTestQuestions[index];
  const answer   = userAnswers[q.id];
  const isReview = reviewFlags.has(q.id);

  if (isReview) {
    btn.style.background   = '#FEF3C7';
    btn.style.borderColor  = '#F59E0B';
    btn.style.color        = '#D97706';
  } else if (answer === -2) {
    btn.style.background   = '#E0F2FE';
    btn.style.borderColor  = '#0284C7';
    btn.style.color        = '#0284C7';
  } else if (answer !== undefined) {
    btn.style.background   = 'var(--success)';
    btn.style.borderColor  = 'var(--success)';
    btn.style.color        = 'white';
  } else {
    btn.style.background   = 'white';
    btn.style.borderColor  = 'var(--border)';
    btn.style.color        = 'var(--text-primary)';
  }
}

window.goToQuestion = function(index) {
  recordQuestionTime();
  currentQIndex     = index;
  questionStartTime = new Date();
  showTestQuestion();
};

function recordQuestionTime() {
  if (questionStartTime && allTestQuestions[currentQIndex]) {
    const qId       = allTestQuestions[currentQIndex].id;
    const timeSpent = Math.round((new Date() - questionStartTime) / 1000);
    questionTimings[qId] = (questionTimings[qId] || 0) + timeSpent;
  }
}

// ── TOGGLE REVIEW FLAG ──
window.toggleReview = function() {
  const q = allTestQuestions[currentQIndex];
  if (reviewFlags.has(q.id)) {
    reviewFlags.delete(q.id);
    document.getElementById('reviewBtn').style.opacity = '0.4';
    showToast('Review flag removed', 'info');
  } else {
    reviewFlags.add(q.id);
    document.getElementById('reviewBtn').style.opacity = '1';
    showToast('Marked for review 🔖', 'info');
  }
  updateNavButton(currentQIndex);
};

// ── SHOW TEST QUESTION (with image support) ──
function showTestQuestion() {
  const q             = allTestQuestions[currentQIndex];
  const total         = allTestQuestions.length;
  const answeredCount = Object.keys(userAnswers).length;

  document.getElementById('testProgress').textContent =
    `Question ${currentQIndex+1} of ${total}`;
  document.getElementById('testAnswered').textContent =
    `Answered: ${answeredCount}`;
  document.getElementById('testProgressBar').style.width =
    `${((currentQIndex+1)/total)*100}%`;

  // Review button
  document.getElementById('reviewBtn').style.opacity =
    reviewFlags.has(q.id) ? '1' : '0.4';

  // Highlight current nav button
  allTestQuestions.forEach((_, i) => {
    const btn = document.getElementById(`navBtn${i}`);
    if (btn) btn.style.outline =
      i === currentQIndex ? '2px solid var(--primary)' : 'none';
  });

  // PYQ badge
  if (q.type === 'PYQ' && q.pyqExamName) {
    document.getElementById('testPyqBadge').style.display = 'block';
    document.getElementById('testPyqBadge').innerHTML =
      `<span class="badge badge-warning">${q.pyqExamName} ${q.pyqYear||''}</span>`;
  } else {
    document.getElementById('testPyqBadge').style.display = 'none';
  }

  // ── Question Text ──
  document.getElementById('testQuestionText').textContent =
    q.questionText || '';

  // ── Question Image (optional) ──
  let qImgEl = document.getElementById('testQuestionImg');
  if (!qImgEl) {
    qImgEl = document.createElement('img');
    qImgEl.id  = 'testQuestionImg';
    qImgEl.alt = 'Question Image';
    qImgEl.style.cssText = `
      width:100%; max-height:260px; object-fit:contain;
      border-radius:10px; margin-top:10px; margin-bottom:4px;
      border:1px solid var(--border); display:block;
    `;
    qImgEl.onerror = function() { this.style.display = 'none'; };
    document.getElementById('testQuestionText')
      .insertAdjacentElement('afterend', qImgEl);
  }
  if (q.questionImage) {
    qImgEl.src = q.questionImage;
    qImgEl.style.display = 'block';
  } else {
    qImgEl.style.display = 'none';
  }

  // ── Options ──
  const optLabels     = ['A','B','C','D','E'];
  const container     = document.getElementById('testOptionsContainer');
  container.innerHTML = '';
  const selectedAnswer = userAnswers[q.id];

  // Options A B C D
  q.options.forEach((opt, i) => {
    const isSelected   = selectedAnswer === i;
    const hasOptImage  = q.optionImages && q.optionImages[i];

    const btn = document.createElement('button');
    btn.style.cssText = `
      width:100%; padding:12px 14px; border-radius:10px;
      border:${isSelected
        ? '2px solid var(--primary)'
        : '1.5px solid var(--border)'};
      background:${isSelected ? 'var(--primary-light)' : 'white'};
      font-size:14px; text-align:left; cursor:pointer;
      font-family:Inter,sans-serif; transition:all 0.2s;
      display:flex; align-items:center; gap:10px;
    `;

    const labelHTML = `
      <span style="width:28px;height:28px;border-radius:50%;
        background:${isSelected ? 'var(--primary)' : 'var(--primary-light)'};
        color:${isSelected ? 'white' : 'var(--primary)'};
        font-weight:700;font-size:13px;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;">
        ${optLabels[i]}
      </span>
    `;

    if (hasOptImage) {
      btn.innerHTML = `
        ${labelHTML}
        <img src="${q.optionImages[i]}" alt="Option ${optLabels[i]}"
          style="max-width:calc(100% - 50px);max-height:120px;
                 object-fit:contain;border-radius:6px;
                 pointer-events:none;" />
      `;
    } else {
      btn.innerHTML = `${labelHTML}<span>${opt}</span>`;
    }

    btn.onclick = () => {
      userAnswers[q.id] = i;
      updateNavButton(currentQIndex);
      showTestQuestion();
    };
    container.appendChild(btn);
  });

  // 5th option — Skip (no negative marking)
  const isSkipped = selectedAnswer === -2;
  const skipBtn   = document.createElement('button');
  skipBtn.style.cssText = `
    width:100%; padding:12px 14px; border-radius:10px;
    border:${isSkipped ? '2px solid #64748B' : '1.5px solid var(--border)'};
    background:${isSkipped ? '#F1F5F9' : 'white'};
    font-size:14px; text-align:left; cursor:pointer;
    font-family:Inter,sans-serif; transition:all 0.2s;
    display:flex; align-items:center; gap:10px;
  `;
  skipBtn.innerHTML = `
    <span style="width:28px;height:28px;border-radius:50%;
      background:${isSkipped ? '#64748B' : '#F1F5F9'};
      color:${isSkipped ? 'white' : '#64748B'};
      font-weight:700;font-size:13px;
      display:flex;align-items:center;justify-content:center;
      flex-shrink:0;">E</span>
    <span style="color:#64748B;">I don't want to attempt this question
      <span style="font-size:11px;background:#DCFCE7;
             color:var(--success);padding:2px 6px;
             border-radius:4px;margin-left:6px;">
        No negative marks
      </span>
    </span>
  `;
  skipBtn.onclick = () => {
    userAnswers[q.id] = -2;
    updateNavButton(currentQIndex);
    showTestQuestion();
  };
  container.appendChild(skipBtn);

  document.getElementById('prevBtn').disabled =
    currentQIndex === 0;
  document.getElementById('nextTestBtn').textContent =
    currentQIndex === total-1 ? 'Last Question' : 'Next →';
}

window.prevTestQuestion = function() {
  if (currentQIndex > 0) {
    recordQuestionTime();
    currentQIndex--;
    questionStartTime = new Date();
    showTestQuestion();
  }
};

window.nextTestQuestion = function() {
  if (currentQIndex < allTestQuestions.length-1) {
    recordQuestionTime();
    currentQIndex++;
    questionStartTime = new Date();
    showTestQuestion();
  }
};

// ── SUBMIT ──
window.confirmSubmit = function() {
  const answered   = Object.keys(userAnswers).length;
  const total      = allTestQuestions.length;
  const unanswered = total - answered;

  if (unanswered > 0) {
    if (!confirm(
      `You have ${unanswered} completely unanswered question(s).\n⚠️ Negative marks will apply to these.\n\nSubmit anyway?`
    )) return;
  } else {
    if (!confirm('Submit test?')) return;
  }
  submitTest();
};

async function submitTest() {
  recordQuestionTime();
  clearInterval(timerInterval);
  document.getElementById('timerDisplay').style.display = 'none';

  let totalScore  = 0;
  let correct     = 0;
  let wrong       = 0;
  let skipped     = 0;
  let unattempted = 0;
  const answers   = {};

  allTestQuestions.forEach(q => {
    const selected = userAnswers[q.id];

    if (selected === undefined) {
      unattempted++;
      totalScore -= q.negativeMarks || 0;
      answers[q.id] = {
        selectedOption: -1,
        isCorrect:      false,
        marksAwarded:   -(q.negativeMarks||0),
        timeTaken:      questionTimings[q.id] || 0,
        status:         'unattempted'
      };
    } else if (selected === -2) {
      skipped++;
      answers[q.id] = {
        selectedOption: -2,
        isCorrect:      false,
        marksAwarded:   0,
        timeTaken:      questionTimings[q.id] || 0,
        status:         'skipped'
      };
    } else if (selected === q.correctOption) {
      correct++;
      totalScore += q.marksPerQ;
      answers[q.id] = {
        selectedOption: selected,
        isCorrect:      true,
        marksAwarded:   q.marksPerQ,
        timeTaken:      questionTimings[q.id] || 0,
        status:         'correct'
      };
    } else {
      wrong++;
      totalScore -= q.negativeMarks || 0;
      answers[q.id] = {
        selectedOption: selected,
        isCorrect:      false,
        marksAwarded:   -(q.negativeMarks||0),
        timeTaken:      questionTimings[q.id] || 0,
        status:         'wrong'
      };
    }
  });

  const totalTimeTaken = Math.round(
    (new Date() - testStartTime) / 1000
  );
  const accuracy = (correct + wrong) > 0
    ? Math.round((correct / (correct + wrong)) * 100) : 0;

  try {
    const attemptData = {
      userId:          currentUser?.uid || 'guest',
      testId:          testIdParam,
      testTitle:       testData.title,
      startedAt:       testStartTime,
      submittedAt:     new Date(),
      totalScore:      Math.max(0, totalScore),
      totalMarks:      testData.totalMarks,
      totalQuestions:  allTestQuestions.length,
      correct, wrong, skipped, unattempted,
      accuracy, totalTimeTaken, answers
    };

    const attemptRef = await addDoc(
      collection(db, 'testAttempts'), attemptData
    );
    window.location.href = `result.html?attemptId=${attemptRef.id}`;

  } catch(e) {
    console.error(e);
    showToast('Error saving result', 'error');
  }
}

window.confirmExit = function() {
  if (document.getElementById('testArea').style.display === 'block') {
    if (!confirm('Exit test? Your progress will be lost.')) return;
    clearInterval(timerInterval);
  }
  window.history.back();
};

window.showToast = function(message, type='info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};

