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
let userAnswers = {};
let currentQIndex = 0;
let timerInterval = null;
let timeLeft = 0;
let testStartTime = null;

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
  const list = document.getElementById('testsList');
  const empty = document.getElementById('testsEmpty');

  try {
    const snap = await getDocs(collection(db, 'tests'));
    const tests = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.isActive) tests.push({ id: d.id, ...data });
    });
    tests.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    loader.style.display = 'none';

    if (tests.length === 0) {
      empty.style.display = 'block';
      return;
    }

    list.innerHTML = tests.map(t => `
      <div class="exam-body-card card-clickable"
           onclick="window.location.href='test.html?testId=${t.id}'">
        <div class="exam-body-icon" style="background:linear-gradient(135deg,#DC2626,#b91c1c); font-size:20px;">🎯</div>
        <div class="exam-body-info">
          <h3>${t.title}</h3>
          <p>${t.duration} min • ${t.totalMarks} marks</p>
        </div>
        <svg class="exam-body-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
      </div>
    `).join('');
    list.style.display = 'flex';

  } catch(e) {
    loader.style.display = 'none';
    empty.style.display = 'block';
    console.error(e);
  }
}

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

    // Load sections
    const sectionsSnap = await getDocs(collection(db, 'tests', testId, 'sections'));
    testSections = [];
    sectionsSnap.forEach(d => testSections.push({ id: d.id, ...d.data() }));
    testSections.sort((a, b) => (a.order||0) - (b.order||0));

    // Count total questions
    let totalQ = 0;
    testSections.forEach(s => totalQ += (s.questionIds?.length || 0));

    document.getElementById('introTitle').textContent = testData.title;
    document.getElementById('testTitle').textContent = testData.title;
    document.getElementById('introDuration').textContent = `${testData.duration} minutes`;
    document.getElementById('introQuestions').textContent = totalQ;
    document.getElementById('introMarks').textContent = testData.totalMarks;

    // Check negative marking
    const hasNegative = testSections.some(s => s.negativeMarks > 0);
    document.getElementById('introNegative').textContent = hasNegative ? 'Yes' : 'No';

  } catch(e) {
    console.error(e);
  }
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
    // Load all questions for all sections
    allTestQuestions = [];
    for (const section of testSections) {
      for (const qId of (section.questionIds || [])) {
        const qSnap = await getDoc(doc(db, 'questions', qId));
        if (qSnap.exists()) {
          allTestQuestions.push({
            id: qSnap.id,
            ...qSnap.data(),
            sectionId: section.id,
            sectionTitle: section.title,
            marksPerQ: section.marksPerQ || 1,
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

    userAnswers = {};
    currentQIndex = 0;
    testStartTime = new Date();

    // Start timer
    timeLeft = testData.duration * 60;
    startTimer();

    // Show test area
    document.getElementById('testIntroSection').style.display = 'none';
    document.getElementById('testArea').style.display = 'block';
    document.getElementById('timerDisplay').style.display = 'block';
    document.getElementById('bottomNav').style.display = 'none';

    buildQuestionNav();
    showTestQuestion();

  } catch(e) {
    console.error(e);
    showToast('Error loading test', 'error');
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
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const display = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  document.getElementById('timerDisplay').textContent = display;

  // Turn red when less than 5 minutes
  if (timeLeft <= 300) {
    document.getElementById('timerDisplay').style.background = 'rgba(220,38,38,0.3)';
  }
}

// ── QUESTION NAVIGATOR ──
function buildQuestionNav() {
  const nav = document.getElementById('questionNav');
  nav.innerHTML = allTestQuestions.map((q, i) => `
    <button onclick="goToQuestion(${i})" id="navBtn${i}" style="
      width:34px; height:34px; border-radius:8px; border:1.5px solid var(--border);
      background:white; font-size:12px; font-weight:600; cursor:pointer;
      font-family:Inter,sans-serif;
    ">${i+1}</button>
  `).join('');
}

function updateNavButton(index) {
  const btn = document.getElementById(`navBtn${index}`);
  if (!btn) return;
  const isAnswered = userAnswers[allTestQuestions[index].id] !== undefined;
  btn.style.background = isAnswered ? 'var(--success)' : 'white';
  btn.style.color = isAnswered ? 'white' : 'var(--text-primary)';
  btn.style.borderColor = isAnswered ? 'var(--success)' : 'var(--border)';
}

window.goToQuestion = function(index) {
  currentQIndex = index;
  showTestQuestion();
};

// ── SHOW QUESTION ──
function showTestQuestion() {
  const q = allTestQuestions[currentQIndex];
  const total = allTestQuestions.length;
  const answeredCount = Object.keys(userAnswers).length;

  document.getElementById('testProgress').textContent = `Question ${currentQIndex+1} of ${total}`;
  document.getElementById('testAnswered').textContent = `Answered: ${answeredCount}`;
  document.getElementById('testProgressBar').style.width = `${((currentQIndex+1)/total)*100}%`;

  // Highlight current nav button
  allTestQuestions.forEach((_, i) => {
    const btn = document.getElementById(`navBtn${i}`);
    if (btn) btn.style.outline = i === currentQIndex ? '2px solid var(--primary)' : 'none';
  });

  // PYQ badge
  if (q.type === 'PYQ' && q.pyqExamName) {
    document.getElementById('testPyqBadge').style.display = 'block';
    document.getElementById('testPyqBadge').innerHTML = `<span class="badge badge-warning">${q.pyqExamName} ${q.pyqYear||''}</span>`;
  } else {
    document.getElementById('testPyqBadge').style.display = 'none';
  }

  document.getElementById('testQuestionText').textContent = q.questionText;

  const optLabels = ['A','B','C','D'];
  const container = document.getElementById('testOptionsContainer');
  container.innerHTML = '';

  const selectedAnswer = userAnswers[q.id];

  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    const isSelected = selectedAnswer === i;
    btn.style.cssText = `
      width:100%; padding:12px 14px; border-radius:10px;
      border:${isSelected ? '2px solid var(--primary)' : '1.5px solid var(--border)'};
      background:${isSelected ? 'var(--primary-light)' : 'white'};
      font-size:14px; text-align:left; cursor:pointer;
      font-family:Inter,sans-serif; transition:all 0.2s;
      display:flex; align-items:center; gap:10px;
    `;
    btn.innerHTML = `
      <span style="width:28px; height:28px; border-radius:50%; background:${isSelected ? 'var(--primary)' : 'var(--primary-light)'}; color:${isSelected ? 'white' : 'var(--primary)'}; font-weight:700; font-size:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${optLabels[i]}</span>
      <span>${opt}</span>
    `;
    btn.onclick = () => {
      userAnswers[q.id] = i;
      updateNavButton(currentQIndex);
      showTestQuestion();
    };
    container.appendChild(btn);
  });

  // Prev/Next buttons
  document.getElementById('prevBtn').disabled = currentQIndex === 0;
  document.getElementById('nextTestBtn').textContent = currentQIndex === total-1 ? 'Last Question' : 'Next →';
}

window.prevTestQuestion = function() {
  if (currentQIndex > 0) { currentQIndex--; showTestQuestion(); }
};

window.nextTestQuestion = function() {
  if (currentQIndex < allTestQuestions.length-1) { currentQIndex++; showTestQuestion(); }
};

// ── SUBMIT ──
window.confirmSubmit = function() {
  const answered = Object.keys(userAnswers).length;
  const total = allTestQuestions.length;
  const unanswered = total - answered;

  if (unanswered > 0) {
    if (!confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) return;
  } else {
    if (!confirm('Submit test?')) return;
  }
  submitTest();
};

async function submitTest() {
  clearInterval(timerInterval);
  document.getElementById('timerDisplay').style.display = 'none';

  let totalScore = 0;
  let correct = 0;
  let wrong = 0;
  const answers = {};

  allTestQuestions.forEach(q => {
    const selected = userAnswers[q.id];
    const isCorrect = selected === q.correctOption;
    const isAnswered = selected !== undefined;

    if (isAnswered && isCorrect) {
      totalScore += q.marksPerQ;
      correct++;
    } else if (isAnswered && !isCorrect) {
      totalScore -= q.negativeMarks || 0;
      wrong++;
    }

    answers[q.id] = {
      selectedOption: selected ?? -1,
      isCorrect: isAnswered ? isCorrect : false,
      marksAwarded: isAnswered ? (isCorrect ? q.marksPerQ : -(q.negativeMarks||0)) : 0
    };
  });

  const accuracy = allTestQuestions.length > 0
    ? Math.round((correct / allTestQuestions.length) * 100) : 0;

  try {
    const attemptData = {
      userId: currentUser?.uid || 'guest',
      testId: testIdParam,
      testTitle: testData.title,
      startedAt: testStartTime,
      submittedAt: new Date(),
      totalScore: Math.max(0, totalScore),
      totalMarks: testData.totalMarks,
      totalQuestions: allTestQuestions.length,
      correct,
      wrong,
      unattempted: allTestQuestions.length - correct - wrong,
      accuracy,
      answers
    };

    const attemptRef = await addDoc(collection(db, 'testAttempts'), attemptData);

    // Redirect to result page
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
