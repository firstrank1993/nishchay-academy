// ============================================
// NISHCHAY ACADEMY — Practice MCQ
// ============================================

import { db, auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, doc, setDoc,
  getDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const topicIdParam = urlParams.get('topicId');
const topicNameParam = urlParams.get('topicName');
const typeParam = urlParams.get('type');

let allQuestions = [];
let currentQuestions = [];
let currentIndex = 0;
let score = 0;
let practiceType = typeParam || 'ALL';
let currentUser = null;
let bookmarkedIds = new Set();
let isBookmarkMode = false;
let topicsCache = [];

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    await loadBookmarks(user.uid);
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  await loadSubjects();
  await loadTopicsCache();

  if (topicIdParam) {
    document.getElementById('modeSelector').style.display = 'none';
    await loadQuestions();
    if (typeParam) setPracticeType(typeParam);
    else startPractice();
  } else {
    setPracticeType('ALL');
    await loadQuestions();
  }
});

// ── LOAD DATA ──
async function loadSubjects() {
  try {
    const snap = await getDocs(collection(db, 'subjects'));
    const sel = document.getElementById('subjectFilter');
    snap.forEach(d => {
      sel.innerHTML +=
        `<option value="${d.id}">${d.data().name}</option>`;
    });
  } catch(e) { console.error(e); }
}

async function loadTopicsCache() {
  try {
    const snap = await getDocs(collection(db, 'topics'));
    topicsCache = [];
    snap.forEach(d =>
      topicsCache.push({ id: d.id, ...d.data() })
    );
  } catch(e) { console.error(e); }
}

window.onSubjectFilterChange = function() {
  const subjectId =
    document.getElementById('subjectFilter').value;
  const topicSelect = document.getElementById('topicFilter');

  topicSelect.innerHTML = '<option value="">All Topics</option>';
  if (subjectId) {
    topicsCache
      .filter(t => t.subjectId === subjectId)
      .forEach(t => {
        topicSelect.innerHTML +=
          `<option value="${t.id}">${t.name}</option>`;
      });
  }
  loadPracticeQuestions();
};

async function loadQuestions() {
  document.getElementById('practiceLoader').style.display = 'block';
  document.getElementById('practiceArea').style.display = 'none';
  document.getElementById('practiceEmpty').style.display = 'none';

  try {
    const snap = await getDocs(collection(db, 'questions'));
    allQuestions = [];
    snap.forEach(d => {
      const data = d.data();
      // Skip test-only questions in practice
      if (!data.isTestOnly) {
        allQuestions.push({ id: d.id, ...data });
      }
    });
    document.getElementById('practiceLoader').style.display = 'none';
  } catch(e) {
    console.error(e);
    document.getElementById('practiceLoader').style.display = 'none';
  }
}

// ── BOOKMARKS ──
async function loadBookmarks(userId) {
  try {
    const snap = await getDocs(
      collection(db, 'users', userId, 'bookmarks')
    );
    bookmarkedIds = new Set();
    snap.forEach(d => bookmarkedIds.add(d.id));
  } catch(e) { console.error(e); }
}

window.toggleBookmark = async function() {
  if (!currentUser) {
    showToast('Please login to bookmark questions', 'error');
    return;
  }

  const q = currentQuestions[currentIndex];
  if (!q) return;

  const bookmarkRef = doc(
    db, 'users', currentUser.uid, 'bookmarks', q.id
  );

  try {
    if (bookmarkedIds.has(q.id)) {
      // Remove bookmark
      await deleteDoc(bookmarkRef);
      bookmarkedIds.delete(q.id);
      document.getElementById('bookmarkBtn').style.opacity = '0.4';
      showToast('Bookmark removed', 'info');
    } else {
      // Add bookmark
      await setDoc(bookmarkRef, {
        questionId: q.id,
        topicId: q.topicId || '',
        subjectId: q.subjectId || '',
        createdAt: serverTimestamp()
      });
      bookmarkedIds.add(q.id);
      document.getElementById('bookmarkBtn').style.opacity = '1';
      showToast('Question bookmarked! 🔖', 'success');
    }
  } catch(e) {
    showToast('Error saving bookmark', 'error');
    console.error(e);
  }
};

window.loadBookmarkedQuestions = async function() {
  if (!currentUser) {
    showToast('Please login to see bookmarks', 'error');
    return;
  }

  document.getElementById('practiceLoader').style.display = 'block';
  document.getElementById('modeSelector').style.display = 'none';
  document.getElementById('practiceEmpty').style.display = 'none';

  try {
    const snap = await getDocs(
      collection(db, 'users', currentUser.uid, 'bookmarks')
    );

    if (snap.empty) {
      document.getElementById('practiceLoader').style.display =
        'none';
      document.getElementById('practiceEmpty').style.display =
        'block';
      document.getElementById('practiceEmpty')
        .querySelector('h3').textContent = 'No Bookmarks Yet';
      document.getElementById('practiceEmpty')
        .querySelector('p').textContent =
        'Bookmark questions during practice to see them here.';
      return;
    }

    const bookmarkIds = [];
    snap.forEach(d => bookmarkIds.push(d.id));

    // Load those specific questions
    isBookmarkMode = true;
    currentQuestions = allQuestions.filter(q =>
      bookmarkIds.includes(q.id)
    );

    document.getElementById('practiceLoader').style.display = 'none';

    if (currentQuestions.length === 0) {
      document.getElementById('practiceEmpty').style.display =
        'block';
      return;
    }

    // Shuffle
    currentQuestions = currentQuestions.sort(
      () => Math.random() - 0.5
    );

    currentIndex = 0;
    score = 0;

    document.getElementById('practiceEmpty').style.display = 'none';
    document.getElementById('practiceSummary').style.display = 'none';
    document.getElementById('practiceArea').style.display = 'block';
    document.getElementById('practiceMode').textContent =
      `🔖 Bookmarked Questions (${currentQuestions.length})`;

    showQuestion();

  } catch(e) {
    document.getElementById('practiceLoader').style.display = 'none';
    showToast('Error loading bookmarks', 'error');
    console.error(e);
  }
};

// ── PRACTICE TYPE ──
window.setPracticeType = function(type) {
  practiceType = type;

  ['PYQ','IMP','ALL'].forEach(t => {
    const el = document.getElementById(`mode${t}`);
    if (!el) return;
    el.style.border = t === type
      ? '2px solid var(--primary)'
      : '1px solid var(--border)';
  });

  startPractice();
};

function startPractice() {
  isBookmarkMode = false;
  const subjectFilter =
    document.getElementById('subjectFilter')?.value || '';
  const topicFilter =
    document.getElementById('topicFilter')?.value || '';

  currentQuestions = allQuestions.filter(q => {
    const matchType =
      practiceType === 'ALL' || q.type === practiceType;
    const matchTopic =
      !topicIdParam || q.topicId === topicIdParam;
    const matchSubject =
      !subjectFilter || q.subjectId === subjectFilter;
    const matchTopicFilter =
      !topicFilter || q.topicId === topicFilter;
    return matchType && matchTopic &&
           matchSubject && matchTopicFilter;
  });

  // Shuffle
  currentQuestions = currentQuestions.sort(
    () => Math.random() - 0.5
  );

  if (currentQuestions.length === 0) {
    document.getElementById('practiceArea').style.display = 'none';
    document.getElementById('practiceEmpty').style.display = 'block';
    return;
  }

  currentIndex = 0;
  score = 0;

  document.getElementById('practiceEmpty').style.display = 'none';
  document.getElementById('practiceSummary').style.display = 'none';
  document.getElementById('practiceArea').style.display = 'block';

  const modeLabels = {
    'PYQ': '📝 PYQ Practice',
    'IMP': '⭐ IMP MCQ Practice',
    'ALL': '🎯 Mixed Practice'
  };
  document.getElementById('practiceMode').textContent =
    modeLabels[practiceType] || 'Practice';

  showQuestion();
}

window.loadPracticeQuestions = function() {
  if (!isBookmarkMode) startPractice();
};

// ── SHOW QUESTION ──
function showQuestion() {
  const q = currentQuestions[currentIndex];
  const total = currentQuestions.length;

  document.getElementById('progressText').textContent =
    `Question ${currentIndex+1} of ${total}`;
  document.getElementById('scoreText').textContent =
    `Score: ${score}`;
  document.getElementById('progressBar').style.width =
    `${((currentIndex) / total) * 100}%`;

  // Bookmark button state
  const bookmarkBtn = document.getElementById('bookmarkBtn');
  if (bookmarkBtn) {
    bookmarkBtn.style.opacity =
      bookmarkedIds.has(q.id) ? '1' : '0.4';
    bookmarkBtn.title = bookmarkedIds.has(q.id)
      ? 'Remove bookmark' : 'Bookmark this question';
  }

  // PYQ Badge
  if (q.type === 'PYQ' && q.pyqExamName) {
    document.getElementById('pyqBadge').style.display = 'block';
    document.getElementById('pyqBadgeText').textContent =
      `${q.pyqExamName} ${q.pyqYear||''} — ${q.pyqExamBodyName||''}`;
  } else {
    document.getElementById('pyqBadge').style.display = 'none';
  }

  document.getElementById('questionText').textContent =
    q.questionText;

  const optLabels = ['A','B','C','D'];
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
      <span style="width:28px;height:28px;border-radius:50%;
        background:var(--primary-light);color:var(--primary);
        font-weight:700;font-size:13px;
        display:flex;align-items:center;justify-content:center;
        flex-shrink:0;">${optLabels[i]}</span>
      <span>${opt}</span>
    `;
    btn.onclick = () => selectOption(i, btn);
    container.appendChild(btn);
  });

  document.getElementById('nextBtn').style.display = 'none';
  document.getElementById('finishBtn').style.display = 'none';
}

function selectOption(selectedIndex, btn) {
  const q = currentQuestions[currentIndex];
  const buttons =
    document.getElementById('optionsContainer').children;
  const isCorrect = selectedIndex === q.correctOption;

  if (isCorrect) score++;

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
    expDiv.innerHTML =
      `<strong>💡 Explanation:</strong> ${q.explanation}`;
    document.getElementById('optionsContainer')
      .appendChild(expDiv);
  }

  document.getElementById('scoreText').textContent =
    `Score: ${score}`;

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
  const accuracy = total > 0
    ? Math.round((score / total) * 100) : 0;

  document.getElementById('practiceArea').style.display = 'none';
  document.getElementById('practiceSummary').style.display = 'block';

  document.getElementById('summaryCorrect').textContent = score;
  document.getElementById('summaryWrong').textContent =
    total - score;
  document.getElementById('summaryAccuracy').textContent =
    `${accuracy}%`;
  document.getElementById('summaryTotal').textContent = total;
  document.getElementById('summaryText').textContent =
    `You scored ${score} out of ${total} (${accuracy}% accuracy)`;
};

window.restartPractice = function() {
  document.getElementById('practiceSummary').style.display = 'none';
  if (isBookmarkMode) {
    loadBookmarkedQuestions();
  } else {
    startPractice();
  }
};

window.exitPractice = function() {
  document.getElementById('practiceArea').style.display = 'none';
  document.getElementById('practiceSummary').style.display = 'none';
  document.getElementById('practiceEmpty').style.display = 'none';
  document.getElementById('modeSelector').style.display = 'block';
  isBookmarkMode = false;
};

window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};