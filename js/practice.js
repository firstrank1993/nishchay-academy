// ============================================
// NISHCHAY ACADEMY — Practice MCQ
// ============================================

import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const topicIdParam = urlParams.get('topicId');
const topicNameParam = urlParams.get('topicName');
const typeParam = urlParams.get('type');

let allQuestions = [];
let currentQuestions = [];
let currentIndex = 0;
let score = 0;
let answered = 0;
let practiceType = typeParam || 'ALL';
let currentUser = null;

onAuthStateChanged(auth, user => { currentUser = user; });

document.addEventListener('DOMContentLoaded', async () => {
  await loadSubjects();

  if (topicIdParam) {
    // Coming from topic detail page
    document.getElementById('modeSelector').style.display = 'none';
    await loadQuestions();
    if (typeParam) setPracticeType(typeParam);
    else startPractice();
  } else {
    setPracticeType('ALL');
    await loadQuestions();
  }
});

async function loadSubjects() {
  try {
    const snap = await getDocs(collection(db, 'subjects'));
    const sel = document.getElementById('subjectFilter');
    snap.forEach(d => {
      sel.innerHTML += `<option value="${d.id}">${d.data().name}</option>`;
    });
  } catch(e) { console.error(e); }
}

async function loadQuestions() {
  document.getElementById('practiceLoader').style.display = 'block';
  document.getElementById('practiceArea').style.display = 'none';
  document.getElementById('practiceEmpty').style.display = 'none';

  try {
    const snap = await getDocs(collection(db, 'questions'));
    allQuestions = [];
    snap.forEach(d => allQuestions.push({ id: d.id, ...d.data() }));
    document.getElementById('practiceLoader').style.display = 'none';
  } catch(e) {
    console.error(e);
    document.getElementById('practiceLoader').style.display = 'none';
  }
}

window.setPracticeType = function(type) {
  practiceType = type;

  // Update UI
  ['PYQ','IMP','ALL'].forEach(t => {
    const el = document.getElementById(`mode${t}`);
    if (!el) return;
    el.style.border = t === type ? '2px solid var(--primary)' : '1px solid var(--border)';
  });

  startPractice();
};

function startPractice() {
  const subjectFilter = document.getElementById('subjectFilter')?.value || '';

  // Filter questions
  currentQuestions = allQuestions.filter(q => {
    const matchType = practiceType === 'ALL' || q.type === practiceType;
    const matchTopic = !topicIdParam || q.topicId === topicIdParam;
    const matchSubject = !subjectFilter || q.subjectId === subjectFilter;
    return matchType && matchTopic && matchSubject;
  });

  // Shuffle
  currentQuestions = currentQuestions.sort(() => Math.random() - 0.5);

  if (currentQuestions.length === 0) {
    document.getElementById('practiceArea').style.display = 'none';
    document.getElementById('practiceEmpty').style.display = 'block';
    return;
  }

  currentIndex = 0;
  score = 0;
  answered = 0;

  document.getElementById('practiceEmpty').style.display = 'none';
  document.getElementById('practiceSummary').style.display = 'none';
  document.getElementById('practiceArea').style.display = 'block';

  showQuestion();
}

window.loadPracticeQuestions = function() {
  startPractice();
};

function showQuestion() {
  const q = currentQuestions[currentIndex];
  const total = currentQuestions.length;

  // Progress
  document.getElementById('progressText').textContent = `Question ${currentIndex + 1} of ${total}`;
  document.getElementById('scoreText').textContent = `Score: ${score}`;
  document.getElementById('progressBar').style.width = `${((currentIndex) / total) * 100}%`;

  // PYQ Badge
  if (q.type === 'PYQ' && q.pyqExamName) {
    document.getElementById('pyqBadge').style.display = 'block';
    document.getElementById('pyqBadgeText').textContent = `${q.pyqExamName} ${q.pyqYear || ''} — ${q.pyqExamBodyName || ''}`;
  } else {
    document.getElementById('pyqBadge').style.display = 'none';
  }

  // Question
  document.getElementById('questionText').textContent = q.questionText;

  // Options
  const optLabels = ['A', 'B', 'C', 'D'];
  const container = document.getElementById('optionsContainer');
  container.innerHTML = '';

  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      width:100%; padding:12px 14px; border-radius:10px;
      border:1.5px solid var(--border); background:white;
      font-size:14px; text-align:left; cursor:pointer;
      font-family:Inter,sans-serif; transition:all 0.2s;
      display:flex; align-items:center; gap:10px;
    `;
    btn.innerHTML = `
      <span style="width:28px; height:28px; border-radius:50%; background:var(--primary-light); color:var(--primary); font-weight:700; font-size:13px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${optLabels[i]}</span>
      <span>${opt}</span>
    `;
    btn.onclick = () => selectOption(i, btn);
    container.appendChild(btn);
  });

  // Hide buttons
  document.getElementById('nextBtn').style.display = 'none';
  document.getElementById('finishBtn').style.display = 'none';
}

function selectOption(selectedIndex, btn) {
  const q = currentQuestions[currentIndex];
  const buttons = document.getElementById('optionsContainer').children;
  const isCorrect = selectedIndex === q.correctOption;

  if (isCorrect) score++;
  answered++;

  // Color all options
  Array.from(buttons).forEach((b, i) => {
    b.style.cursor = 'default';
    b.onclick = null;
    if (i === q.correctOption) {
      b.style.background = '#DCFCE7';
      b.style.borderColor = '#16A34A';
    } else if (i === selectedIndex && !isCorrect) {
      b.style.background = '#FEE2E2';
      b.style.borderColor = '#DC2626';
    }
  });

  // Show explanation
  if (q.explanation) {
    const expDiv = document.createElement('div');
    expDiv.style.cssText = `
      margin-top:12px; padding:12px; background:#EFF6FF;
      border-radius:10px; font-size:13px; color:var(--primary);
      border-left:3px solid var(--primary); line-height:1.6;
    `;
    expDiv.innerHTML = `<strong>💡 Explanation:</strong> ${q.explanation}`;
    document.getElementById('optionsContainer').appendChild(expDiv);
  }

  document.getElementById('scoreText').textContent = `Score: ${score}`;

  // Show next or finish
  if (currentIndex < currentQuestions.length - 1) {
    document.getElementById('nextBtn').style.display = 'block';
  } else {
    document.getElementById('finishBtn').style.display = 'block';
  }
}

window.nextQuestion = function() {
  currentIndex++;
  showQuestion();
};

window.finishPractice = function() {
  const total = currentQuestions.length;
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

  document.getElementById('practiceArea').style.display = 'none';
  document.getElementById('practiceSummary').style.display = 'block';

  document.getElementById('summaryCorrect').textContent = score;
  document.getElementById('summaryWrong').textContent = total - score;
  document.getElementById('summaryAccuracy').textContent = `${accuracy}%`;
  document.getElementById('summaryTotal').textContent = total;
  document.getElementById('summaryText').textContent = `You scored ${score} out of ${total} (${accuracy}% accuracy)`;
};

window.restartPractice = function() {
  document.getElementById('practiceSummary').style.display = 'none';
  startPractice();
};
