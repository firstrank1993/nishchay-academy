// ============================================
// NISHCHAY ACADEMY — Home Page (All Features)
// ============================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, getDoc, addDoc, updateDoc, setDoc,
  doc, query, where, orderBy, limit,
  serverTimestamp, increment, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── GLOBALS ──
let currentUser = null;
let currentQOD = null;
let currentQuiz = null;
let quizQuestions = [];
let quizCurrentIndex = 0;
let quizAnswers = [];
let quizAttemptId = null;
let quizScore = 0;

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    // Load everything in parallel — nothing blocks anything else
    loadExamBodies();
    loadDailyQuote();
    loadTodayInHistory();
    loadLeaderboardPreview();

    if (user) {
      loadStreakAndPoints(user);
      loadQOD(user);
      loadDailyQuiz(user);
    } else {
      // Still show QOD/Quiz cards but without attempt state
      loadQOD(null);
      loadDailyQuiz(null);
    }
  });
});

// ── HELPER: today string ──
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
}

window.scrollToSection = function(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ============================================================
// 1. EXAM BODIES
// ============================================================
async function loadExamBodies() {
  const skeletonLoader = document.getElementById('skeletonLoader');
  const examBodiesList = document.getElementById('examBodiesList');
  const emptyState     = document.getElementById('emptyState');
  try {
    const snapshot = await getDocs(collection(db, 'examBodies'));
    skeletonLoader.style.display = 'none';
    if (snapshot.empty) { emptyState.style.display = 'block'; return; }

    const bodies = [];
    snapshot.forEach(d => bodies.push({ id: d.id, ...d.data() }));
    bodies.sort((a, b) => (a.order||0) - (b.order||0));

    let html = '';
    bodies.forEach(data => {
      if (data.isActive === false) return;
      const initials = data.name.length <= 5
        ? data.name.toUpperCase()
        : data.name.substring(0,4).toUpperCase();
      html += `
        <div class="exam-body-card card-clickable"
          onclick="window.location.href='exam.html?bodyId=${data.id}&bodyName=${encodeURIComponent(data.name)}'">
          <div class="exam-body-icon">${initials}</div>
          <div class="exam-body-info">
            <h3>${data.name}</h3>
            <p>${data.description || 'Click to see exams'}</p>
          </div>
          <svg style="margin-left:auto;color:#CBD5E1;" width="20" height="20"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </div>`;
    });

    if (!html) { emptyState.style.display = 'block'; return; }
    examBodiesList.innerHTML = html;
    examBodiesList.style.display = 'flex';
  } catch (e) {
    skeletonLoader.style.display = 'none';
    emptyState.style.display = 'block';
    console.error('Exam bodies error:', e);
  }
}

// ============================================================
// 2. STREAK & POINTS
// ============================================================
async function loadStreakAndPoints(user) {
  try {
    const userRef  = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const data = userSnap.data();

    const today   = todayStr();
    const lastDay = data.lastActiveDate || '';

    // Calculate yesterday string
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const yesterday = `${yd.getFullYear()}-${String(yd.getMonth()+1).padStart(2,'0')}-${String(yd.getDate()).padStart(2,'0')}`;

    let streak = data.currentStreak || 0;
    let longest = data.longestStreak || 0;
    let totalPts = data.totalPoints || 0;
    let weekPts  = data.weeklyPoints || 0;

    // Week/month key for reset detection
    const now = new Date();
    const weekKey  = `${now.getFullYear()}-W${Math.ceil(now.getDate()/7)}`;
    const monthKey = `${now.getFullYear()}-${now.getMonth()+1}`;

    let updates = {};

    // Reset stale weekly/monthly points
    if ((data.weekKey || '') !== weekKey)   { updates.weeklyPoints  = 0; updates.weekKey  = weekKey; weekPts = 0; }
    if ((data.monthKey || '') !== monthKey) { updates.monthlyPoints = 0; updates.monthKey = monthKey; }

    // Streak logic
    if (lastDay === today) {
      // Already logged in today — no change
    } else if (lastDay === yesterday) {
      // Consecutive day
      streak += 1;
      updates.currentStreak  = streak;
      updates.lastActiveDate = today;
    } else {
      // Streak broken
      streak = 1;
      updates.currentStreak  = 1;
      updates.lastActiveDate = today;
    }

    if (streak > longest) {
      updates.longestStreak = streak;
      longest = streak;
    }

    // Login points (5 pts per day, only once)
    if (lastDay !== today) {
      const loginPts = 5;
      updates.totalPoints  = increment(loginPts);
      updates.weeklyPoints = increment(loginPts);
      updates.monthlyPoints = increment(loginPts);
      totalPts += loginPts;
      weekPts  += loginPts;
      // Log
      await addDoc(collection(db, 'users', user.uid, 'pointsLog'), {
        type: 'login', points: loginPts, date: today, createdAt: serverTimestamp()
      });
    }

    if (Object.keys(updates).length) await updateDoc(userRef, updates);

    // Update leaderboard doc
    await setDoc(doc(db, 'leaderboard', user.uid), {
      userId:        user.uid,
      fullName:      data.fullName || 'Student',
      district:      data.district || '',
      photoUrl:      data.photoUrl || '',
      totalPoints:   totalPts,
      weeklyPoints:  weekPts,
      monthlyPoints: data.monthlyPoints || 0,
      currentStreak: streak,
      updatedAt:     serverTimestamp()
    }, { merge: true });

    // Show streak badge
    if (streak > 0) {
      document.getElementById('streakBadge').style.display = 'block';
      document.getElementById('streakCount').textContent   = streak;
    }
    document.getElementById('pointsBar').style.display     = 'flex';
    document.getElementById('totalPointsEl').textContent   = totalPts;
    document.getElementById('weeklyPointsEl').textContent  = weekPts;

  } catch (e) {
    console.error('Streak/points error:', e);
  }
}

// ============================================================
// 3. DAILY QUOTE
// ============================================================
async function loadDailyQuote() {
  const card   = document.getElementById('hubQuoteCard');
  const textEl = document.getElementById('hubQuoteText');
  const authEl = document.getElementById('hubQuoteAuthor');
  try {
    const today = todayStr();

    // Check scheduled first
    const scheduled = await getDocs(query(
      collection(db, 'dailyQuotes'),
      where('scheduledDate', '==', today),
      where('isActive', '==', true),
      limit(1)
    ));

    let quote = null;

    if (!scheduled.empty) {
      quote = scheduled.docs[0].data();
    } else {
      // Round-robin rotation
      const all = await getDocs(query(
        collection(db, 'dailyQuotes'),
        where('isActive', '==', true)
      ));
      if (!all.empty) {
        const list = [];
        all.forEach(d => { if (!d.data().scheduledDate) list.push(d.data()); });
        if (list.length) {
          list.sort((a,b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
          quote = list[dayOfYear() % list.length];
        }
      }
    }

    if (!quote) { card.style.opacity = '0.5'; textEl.textContent = 'No quote for today'; return; }
    textEl.textContent = '\u201C' + quote.text + '\u201D';
    authEl.textContent = '\u2014 ' + quote.author;

    // Also fill the big quote card in hub (already filled above)
  } catch (e) {
    console.error('Quote error:', e);
  }
}

// ============================================================
// 4. QUESTION OF THE DAY
// ============================================================
async function loadQOD(user) {
  const section = document.getElementById('qodSection');
  const hubCard = document.getElementById('hubQodCard');
  const hubText = document.getElementById('hubQodText');
  const hubStatus = document.getElementById('hubQodStatus');
  try {
    const today = todayStr();
    const qodSnap = await getDocs(query(
      collection(db, 'questionOfDay'),
      where('activeDate', '==', today),
      where('isActive', '==', true),
      limit(1)
    ));

    if (qodSnap.empty) return;

    const qodDoc = qodSnap.docs[0];
    const qod    = { id: qodDoc.id, ...qodDoc.data() };
    currentQOD   = qod;

    // Fetch the actual question from question bank
    const qSnap = await getDoc(doc(db, 'questions', qod.questionId));
    if (!qSnap.exists()) return;
    const q = { id: qSnap.id, ...qSnap.data() };

    // Show hub card preview
    hubText.textContent = q.question?.substring(0, 80) + (q.question?.length > 80 ? '...' : '');

    // Check if user already attempted
    let alreadyAttempted = false;
    if (user) {
      const attemptSnap = await getDoc(
        doc(db, 'users', user.uid, 'qodAttempts', qod.id)
      );
      alreadyAttempted = attemptSnap.exists();
    }

    if (alreadyAttempted) {
      hubStatus.textContent = '✅ Attempted today';
    } else {
      hubStatus.textContent = '👆 Tap to attempt';
    }

    // Render full section
    section.style.display = 'block';
    document.getElementById('qodQuestion').textContent = q.question;

    const optionsEl = document.getElementById('qodOptions');
    const options   = [q.option1, q.option2, q.option3, q.option4].filter(Boolean);

    options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.textContent = `${String.fromCharCode(65+i)}. ${opt}`;
      btn.style.cssText = `
        padding:12px 14px;border-radius:var(--radius-sm);
        border:1.5px solid var(--border);background:white;
        font-size:13px;font-weight:500;text-align:left;
        cursor:pointer;transition:all 0.2s;font-family:Inter,sans-serif;
        color:var(--text-primary);width:100%;
      `;
      if (alreadyAttempted) {
        btn.disabled = true;
        btn.style.opacity = '0.6';
      } else {
        btn.onclick = () => submitQOD(i, q.correctOption - 1, qod, q, options, user);
      }
      optionsEl.appendChild(btn);
    });

    if (alreadyAttempted) {
      document.getElementById('qodResult').style.display    = 'block';
      document.getElementById('qodResult').style.background = '#f0fdf4';
      document.getElementById('qodResult').innerHTML =
        '<p style="color:#15803d;font-weight:600;">✅ You already attempted today\'s question!</p>';
      if (qod.explanation) {
        document.getElementById('qodExplanation').style.display = 'block';
        document.getElementById('qodExplanationText').textContent = qod.explanation;
      }
    }

  } catch (e) {
    console.error('QOD error:', e);
  }
}

async function submitQOD(selected, correct, qod, q, options, user) {
  const isCorrect = selected === correct;
  const optBtns   = document.getElementById('qodOptions').querySelectorAll('button');

  optBtns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) {
      btn.style.background    = '#dcfce7';
      btn.style.borderColor   = '#16a34a';
      btn.style.color         = '#15803d';
      btn.style.fontWeight    = '700';
    } else if (i === selected && !isCorrect) {
      btn.style.background    = '#fee2e2';
      btn.style.borderColor   = '#dc2626';
      btn.style.color         = '#dc2626';
    }
  });

  const resultEl = document.getElementById('qodResult');
  resultEl.style.display    = 'block';
  resultEl.style.background = isCorrect ? '#f0fdf4' : '#fef2f2';
  resultEl.innerHTML = isCorrect
    ? '<p style="color:#15803d;font-weight:700;">🎉 Correct! Well done!</p>'
    : `<p style="color:#dc2626;font-weight:700;">❌ Incorrect. Correct answer: ${String.fromCharCode(65+correct)}. ${options[correct]}</p>`;

  if (qod.explanation) {
    document.getElementById('qodExplanation').style.display = 'block';
    document.getElementById('qodExplanationText').textContent = qod.explanation;
  }
  document.getElementById('qodShareRow').style.display = 'block';

  // Save to Firestore
  if (user) {
    try {
      await setDoc(doc(db, 'users', user.uid, 'qodAttempts', qod.id), {
        qodId: qod.id, selectedOption: selected,
        isCorrect, attemptedAt: serverTimestamp()
      });

      // Increment QOD analytics
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'questionOfDay', qod.id);
        const snap = await tx.get(ref);
        const d = snap.data();
        tx.update(ref, {
          totalAttempts: (d.totalAttempts || 0) + 1,
          correctCount:  (d.correctCount  || 0) + (isCorrect ? 1 : 0)
        });
      });

      // Award points
      if (isCorrect) {
        const pts = 10;
        await updateDoc(doc(db, 'users', user.uid), {
          totalPoints:   increment(pts),
          weeklyPoints:  increment(pts),
          monthlyPoints: increment(pts)
        });
        await addDoc(collection(db, 'users', user.uid, 'pointsLog'), {
          type: 'qod', points: pts, date: todayStr(), createdAt: serverTimestamp()
        });
        showToast(`+${pts} points earned! 🎉`, 'success');
      }
    } catch (e) { console.error('QOD save error:', e); }
  }
}

window.shareQOD = function() {
  const text = `I attempted today's Question of the Day on Nishchay Academy! 🧠\nPrepare for Gujarat Govt Exams: ${window.location.origin}`;
  if (navigator.share) {
    navigator.share({ title: 'Nishchay Academy — QOD', text });
  } else {
    navigator.clipboard?.writeText(text);
    showToast('Link copied!', 'success');
  }
};

// ============================================================
// 5. DAILY QUIZ
// ============================================================
async function loadDailyQuiz(user) {
  const section = document.getElementById('quizSection');
  const hubCard = document.getElementById('hubQuizCard');
  const hubText = document.getElementById('hubQuizText');
  const hubStatus = document.getElementById('hubQuizStatus');
  try {
    const today = todayStr();
    const quizSnap = await getDocs(query(
      collection(db, 'dailyQuiz'),
      where('startDate', '<=', today),
      where('isActive', '==', true),
      limit(5)
    ));

    // Find quiz where endDate >= today
    let quiz = null;
    quizSnap.forEach(d => {
      const data = d.data();
      if (!quiz && data.endDate >= today) {
        quiz = { id: d.id, ...data };
      }
    });

    if (!quiz) return;
    currentQuiz = quiz;

    // Check if user already attempted
    let attempted = false;
    if (user) {
      const attSnap = await getDocs(query(
        collection(db, 'dailyQuizAttempts'),
        where('userId', '==', user.uid),
        where('quizId', '==', quiz.id),
        limit(1)
      ));
      attempted = !attSnap.empty;
    }

    hubText.textContent = quiz.title?.substring(0,60) || 'Daily Quiz';
    hubStatus.textContent = attempted ? '✅ Completed' : `${quiz.questionCount || 0} questions`;

    section.style.display = 'block';
    document.getElementById('quizTitle').textContent = quiz.title;
    document.getElementById('quizMeta').textContent  =
      `${quiz.questionCount} Questions · ${quiz.subject || ''}`;
    document.getElementById('quizBadge').textContent =
      attempted ? '✅ Done' : '🟢 Active';

    const participants = quiz.totalParticipants || 0;
    const avgScore     = participants > 0
      ? Math.round((quiz.totalScore || 0) / participants)
      : 0;
    document.getElementById('quizParticipants').textContent = participants;
    document.getElementById('quizAvgScore').textContent     = avgScore;
    document.getElementById('quizDifficulty').textContent   =
      (quiz.difficulty || 'Medium').charAt(0).toUpperCase() +
      (quiz.difficulty || 'medium').slice(1);

    const btn = document.getElementById('quizAttemptBtn');
    if (attempted) {
      btn.textContent          = '✅ Already Completed';
      btn.disabled             = true;
      btn.style.opacity        = '0.6';
    }

  } catch (e) {
    console.error('Daily quiz load error:', e);
  }
}

window.startDailyQuiz = async function() {
  if (!currentUser) { showToast('Please login to attempt the quiz', 'info'); return; }
  if (!currentQuiz)  return;

  try {
    // Fetch questions from question bank
    const ids = currentQuiz.questionIds || [];
    if (!ids.length) { showToast('Quiz has no questions yet', 'info'); return; }

    quizQuestions     = [];
    quizCurrentIndex  = 0;
    quizAnswers       = [];
    quizScore         = 0;

    // Fetch up to 20 questions
    const fetchIds = ids.slice(0, 20);
    for (const qid of fetchIds) {
      const snap = await getDoc(doc(db, 'questions', qid));
      if (snap.exists()) quizQuestions.push({ id: snap.id, ...snap.data() });
    }

    if (!quizQuestions.length) { showToast('Could not load quiz questions', 'error'); return; }

    document.getElementById('quizModalTitle').textContent = currentQuiz.title;
    document.getElementById('quizModal').style.display   = 'block';
    document.getElementById('quizResultScreen').style.display = 'none';
    renderQuizQuestion();

  } catch (e) {
    console.error('Start quiz error:', e);
    showToast('Error starting quiz', 'error');
  }
};

function renderQuizQuestion() {
  const q   = quizQuestions[quizCurrentIndex];
  const tot = quizQuestions.length;

  document.getElementById('quizProgress').textContent =
    `Question ${quizCurrentIndex + 1} of ${tot}`;
  document.getElementById('quizProgressBar').style.width =
    `${((quizCurrentIndex) / tot) * 100}%`;
  document.getElementById('quizModalQuestion').textContent = q.question;
  document.getElementById('quizNextBtn').style.display    = 'none';

  const opts = [q.option1, q.option2, q.option3, q.option4].filter(Boolean);
  const el   = document.getElementById('quizModalOptions');
  el.innerHTML = '';
  opts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.textContent = `${String.fromCharCode(65+i)}. ${opt}`;
    btn.style.cssText = `
      padding:12px 14px;border-radius:var(--radius-sm);
      border:1.5px solid var(--border);background:white;
      font-size:14px;font-weight:500;text-align:left;
      cursor:pointer;transition:all 0.2s;font-family:Inter,sans-serif;
      color:var(--text-primary);width:100%;
    `;
    btn.onclick = () => selectQuizAnswer(i, q.correctOption - 1, opts, btn, el.querySelectorAll('button'));
    el.appendChild(btn);
  });
}

function selectQuizAnswer(selected, correct, opts, clickedBtn, allBtns) {
  const isCorrect = selected === correct;
  if (isCorrect) quizScore++;

  quizAnswers.push({ questionId: quizQuestions[quizCurrentIndex].id, selected, correct, isCorrect });

  allBtns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct) {
      btn.style.background = '#dcfce7'; btn.style.borderColor = '#16a34a';
    } else if (i === selected && !isCorrect) {
      btn.style.background = '#fee2e2'; btn.style.borderColor = '#dc2626';
    }
  });

  document.getElementById('quizNextBtn').style.display = 'block';
  document.getElementById('quizNextBtn').textContent =
    quizCurrentIndex < quizQuestions.length - 1 ? 'Next Question →' : 'Finish Quiz';
}

window.nextQuizQuestion = function() {
  quizCurrentIndex++;
  if (quizCurrentIndex < quizQuestions.length) {
    renderQuizQuestion();
  } else {
    finishQuiz();
  }
};

async function finishQuiz() {
  const tot      = quizQuestions.length;
  const accuracy = Math.round((quizScore / tot) * 100);

  document.getElementById('quizModalOptions').innerHTML = '';
  document.getElementById('quizModalQuestion').textContent = '';
  document.getElementById('quizProgress').textContent      = '';
  document.getElementById('quizProgressBar').style.width   = '100%';
  document.getElementById('quizNextBtn').style.display     = 'none';
  document.getElementById('quizResultScreen').style.display = 'block';
  document.getElementById('quizResultScore').textContent    = `${quizScore} / ${tot}`;
  document.getElementById('quizResultAccuracy').textContent =
    `Accuracy: ${accuracy}% · ${isCorrect ? 'Great job!' : 'Keep practising!'}`;

  // Save attempt
  if (currentUser && currentQuiz) {
    try {
      const answers = {};
      quizAnswers.forEach(a => { answers[a.questionId] = a.selected; });

      await addDoc(collection(db, 'dailyQuizAttempts'), {
        userId: currentUser.uid, quizId: currentQuiz.id,
        score: quizScore, totalQ: tot, accuracy,
        answers, attemptedAt: serverTimestamp()
      });

      // Update quiz analytics
      await updateDoc(doc(db, 'dailyQuiz', currentQuiz.id), {
        totalParticipants: increment(1),
        totalScore:        increment(quizScore)
      });

      // Award points
      const pts = 20;
      await updateDoc(doc(db, 'users', currentUser.uid), {
        totalPoints:   increment(pts),
        weeklyPoints:  increment(pts),
        monthlyPoints: increment(pts)
      });
      await addDoc(collection(db, 'users', currentUser.uid, 'pointsLog'), {
        type: 'quiz', points: pts, date: todayStr(), createdAt: serverTimestamp()
      });

      showToast(`+${pts} points for completing the quiz! 🎉`, 'success');

      // Refresh the quiz section
      document.getElementById('quizAttemptBtn').textContent = '✅ Already Completed';
      document.getElementById('quizAttemptBtn').disabled    = true;
      document.getElementById('quizBadge').textContent      = '✅ Done';

    } catch (e) { console.error('Quiz save error:', e); }
  }
}

function isCorrect() { return quizScore === quizQuestions.length; }

window.closeQuizModal = function() {
  document.getElementById('quizModal').style.display = 'none';
};

window.shareQuizResult = function() {
  const tot  = quizQuestions.length;
  const acc  = Math.round((quizScore / tot) * 100);
  const text = `I scored ${quizScore}/${tot} (${acc}%) in today's Daily Quiz on Nishchay Academy! 🎯\nPrepare with us: ${window.location.origin}`;
  if (navigator.share) {
    navigator.share({ title: 'Nishchay Academy Daily Quiz', text });
  } else {
    navigator.clipboard?.writeText(text);
    showToast('Result copied!', 'success');
  }
};

// ============================================================
// 6. TODAY IN HISTORY
// ============================================================
async function loadTodayInHistory() {
  const section   = document.getElementById('historySection');
  const hubCard   = document.getElementById('hubHistoryCard');
  const hubText   = document.getElementById('hubHistoryText');
  const hubYear   = document.getElementById('hubHistoryYear');
  try {
    const now   = new Date();
    const month = now.getMonth() + 1;
    const day   = now.getDate();

    const snap = await getDocs(query(
      collection(db, 'historyEvents'),
      where('month', '==', month),
      where('day',   '==', day),
      where('isActive', '==', true),
      limit(1)
    ));

    if (snap.empty) return;
    const event = snap.docs[0].data();

    hubText.textContent = event.title?.substring(0,70) + (event.title?.length > 70 ? '...' : '');
    hubYear.textContent = event.year ? `Year: ${event.year}` : '';

    section.style.display = 'block';
    if (event.imageUrl) {
      const img = document.getElementById('historyImage');
      img.src = event.imageUrl;
      img.style.display = 'block';
    }
    document.getElementById('historyYear').textContent  = event.year ? `Year ${event.year}` : '';
    document.getElementById('historyTitle').textContent = event.title;
    document.getElementById('historyDesc').textContent  = event.description;

  } catch (e) {
    console.error('History error:', e);
  }
}

window.shareHistory = function() {
  const title = document.getElementById('historyTitle').textContent;
  const desc  = document.getElementById('historyDesc').textContent;
  const text  = `📅 Today in History\n\n${title}\n\n${desc}\n\nLearn more at Nishchay Academy: ${window.location.origin}`;
  if (navigator.share) {
    navigator.share({ title: 'Today in History', text });
  } else {
    navigator.clipboard?.writeText(text);
    showToast('Copied to clipboard!', 'success');
  }
};

// ============================================================
// 7. LEADERBOARD PREVIEW
// ============================================================
async function loadLeaderboardPreview() {
  const el = document.getElementById('hubLeaderPreview');
  try {
    const snap = await getDocs(query(
      collection(db, 'leaderboard'),
      orderBy('weeklyPoints', 'desc'),
      limit(3)
    ));
    if (snap.empty) { el.textContent = 'No rankings yet'; return; }
    let html = '';
    const medals = ['🥇', '🥈', '🥉'];
    let i = 0;
    snap.forEach(d => {
      const data = d.data();
      html += `<div>${medals[i]} ${data.fullName?.split(' ')[0] || 'Student'} — ${data.weeklyPoints || 0} pts</div>`;
      i++;
    });
    el.innerHTML = html;
  } catch (e) {
    el.textContent = 'See rankings →';
  }
}

// ============================================================
// TOAST
// ============================================================
window.showToast = function(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};
