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
let currentUser   = null;
let currentQOD    = null;
let currentQODQ   = null;
let currentQuiz   = null;
let quizQuestions = [];
let quizIndex     = 0;
let quizAnswers   = [];
let quizScore     = 0;

// ── HELPERS ──
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dayOfYear() {
  const n = new Date(), s = new Date(n.getFullYear(),0,0);
  return Math.floor((n-s)/86400000);
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  // These load for everyone, no login needed
  loadDailyQuote();
  loadTodayInHistory();
  loadLeaderboardPreview();
  loadExamBodies();

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      updateStreakAndPoints(user);
      loadQOD(user);
      loadDailyQuiz(user);
    } else {
      loadQOD(null);
      loadDailyQuiz(null);
    }
  });
});

// ============================================================
// EXAM BODIES — original logic preserved exactly
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
    document.getElementById('skeletonLoader').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    console.error('Exam bodies error:', e);
  }
}

// ============================================================
// STREAK & POINTS
// ============================================================
async function updateStreakAndPoints(user) {
  try {
    const userRef  = doc(db, 'users', user.uid);
    const snap     = await getDoc(userRef);
    if (!snap.exists()) return;
    const data     = snap.data();
    const today    = todayStr();
    const yd       = new Date(); yd.setDate(yd.getDate()-1);
    const yesterday = `${yd.getFullYear()}-${String(yd.getMonth()+1).padStart(2,'0')}-${String(yd.getDate()).padStart(2,'0')}`;
    const lastDay  = data.lastActiveDate || '';
    const now      = new Date();
    const weekKey  = `${now.getFullYear()}-W${Math.ceil(now.getDate()/7)}`;
    const monthKey = `${now.getFullYear()}-${now.getMonth()+1}`;

    let streak  = data.currentStreak  || 0;
    let longest = data.longestStreak  || 0;
    let total   = data.totalPoints    || 0;
    let weekly  = data.weeklyPoints   || 0;
    let monthly = data.monthlyPoints  || 0;
    let updates = {};

    if ((data.weekKey  || '') !== weekKey)  { updates.weeklyPoints  = 0; updates.weekKey  = weekKey;  weekly  = 0; }
    if ((data.monthKey || '') !== monthKey) { updates.monthlyPoints = 0; updates.monthKey = monthKey; monthly = 0; }

    if (lastDay === today) {
      // already counted today
    } else if (lastDay === yesterday) {
      streak++;
      updates.currentStreak = streak;
      updates.lastActiveDate = today;
    } else {
      streak = 1;
      updates.currentStreak = 1;
      updates.lastActiveDate = today;
    }
    if (streak > longest) { updates.longestStreak = streak; longest = streak; }

    // Award login points once per day
    if (lastDay !== today) {
      const pts = 5;
      updates.totalPoints   = increment(pts);
      updates.weeklyPoints  = increment(pts);
      updates.monthlyPoints = increment(pts);
      total  += pts; weekly += pts; monthly += pts;
      await addDoc(collection(db, 'users', user.uid, 'pointsLog'), {
        type:'login', points:pts, date:today, createdAt:serverTimestamp()
      });
    }

    if (Object.keys(updates).length) await updateDoc(userRef, updates);

    // Update leaderboard cache
    await setDoc(doc(db, 'leaderboard', user.uid), {
      userId:        user.uid,
      fullName:      data.fullName  || 'Student',
      district:      data.district  || '',
      photoUrl:      data.photoUrl  || '',
      totalPoints:   total,
      weeklyPoints:  weekly,
      monthlyPoints: monthly,
      currentStreak: streak,
      updatedAt:     serverTimestamp()
    }, { merge: true });

    // Show streak badge
    if (streak > 0) {
      document.getElementById('streakBadge').style.display = 'block';
      document.getElementById('streakCount').textContent   = streak;
    }
    const pr = document.getElementById('pointsRow');
    pr.style.display = 'flex';
    document.getElementById('totalPointsEl').textContent  = total;
    document.getElementById('weeklyPointsEl').textContent = weekly;
  } catch(e) { console.error('Streak error:', e); }
}

// ============================================================
// DAILY QUOTE
// ============================================================
async function loadDailyQuote() {
  const textEl = document.getElementById('hubQuoteText');
  const authEl = document.getElementById('hubQuoteAuthor');
  try {
    const today = todayStr();
    // Check scheduled quote first
    const scheduled = await getDocs(query(
      collection(db, 'dailyQuotes'),
      where('scheduledDate','==', today),
      where('isActive','==', true),
      limit(1)
    ));
    let quote = null;
    if (!scheduled.empty) {
      quote = scheduled.docs[0].data();
    } else {
      // Rotation fallback
      const all = await getDocs(query(
        collection(db, 'dailyQuotes'),
        where('isActive','==', true)
      ));
      if (!all.empty) {
        const list = [];
        all.forEach(d => { if (!d.data().scheduledDate) list.push(d.data()); });
        if (list.length) {
          list.sort((a,b) => (a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
          quote = list[dayOfYear() % list.length];
        }
      }
    }
    if (!quote) { textEl.textContent = 'No quote added yet'; return; }
    textEl.textContent = '\u201C' + quote.text + '\u201D';
    authEl.textContent = '\u2014 ' + quote.author;
  } catch(e) {
    textEl.textContent = 'Quote unavailable';
    console.error('Quote error:', e);
  }
}

// ============================================================
// QUESTION OF THE DAY
// ============================================================
async function loadQOD(user) {
  const section = document.getElementById('qodSection');
  try {
    const today = todayStr();
    const snap  = await getDocs(query(
      collection(db, 'questionOfDay'),
      where('activeDate','==', today),
      where('isActive','==', true),
      limit(1)
    ));
    if (snap.empty) {
      document.getElementById('hubQodText').textContent   = 'No question today';
      document.getElementById('hubQodStatus').textContent = '';
      return;
    }
    const qodDoc = snap.docs[0];
    const qod    = { id: qodDoc.id, ...qodDoc.data() };
    currentQOD   = qod;

    const qSnap  = await getDoc(doc(db, 'questions', qod.questionId));
    if (!qSnap.exists()) return;
    const q = { id: qSnap.id, ...qSnap.data() };
    currentQODQ = q;

    // Hub preview
    document.getElementById('hubQodText').textContent =
      q.question?.substring(0,70) + (q.question?.length > 70 ? '...' : '');

    // Check if already attempted
    let attempted = false;
    if (user) {
      const attSnap = await getDoc(doc(db,'users',user.uid,'qodAttempts',qod.id));
      attempted = attSnap.exists();
    }
    document.getElementById('hubQodStatus').textContent =
      attempted ? '✅ Done' : '👆 Tap to attempt';

    // Render full section
    section.style.display = 'block';
    document.getElementById('qodQuestion').textContent = q.question;
    const opts = [q.option1, q.option2, q.option3, q.option4].filter(Boolean);
    const optDiv = document.getElementById('qodOptions');
    optDiv.innerHTML = '';
    opts.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.textContent = String.fromCharCode(65+i) + '. ' + opt;
      btn.style.cssText = `
        width:100%;padding:12px 14px;border-radius:10px;
        border:1.5px solid #e2e8f0;background:white;
        font-size:13px;font-weight:500;text-align:left;
        cursor:pointer;font-family:Inter,sans-serif;color:#1e293b;
        transition:border-color 0.2s;
      `;
      if (attempted) {
        btn.disabled = true; btn.style.opacity = '0.6';
      } else {
        btn.onclick = () => submitQOD(i, q.correctOption-1, qod, opts, user);
      }
      optDiv.appendChild(btn);
    });

    if (attempted) {
      const res = document.getElementById('qodResult');
      res.style.display = 'block';
      res.style.background = '#f0fdf4';
      res.innerHTML = '<p style="color:#15803d;font-weight:600;">✅ Already attempted today!</p>';
      if (qod.explanation) {
        document.getElementById('qodExplanation').style.display = 'block';
        document.getElementById('qodExplanationText').textContent = qod.explanation;
      }
    }
  } catch(e) {
    console.error('QOD error:', e);
    document.getElementById('hubQodText').textContent = 'Unavailable';
  }
}

async function submitQOD(selected, correct, qod, opts, user) {
  const isCorrect = selected === correct;
  const btns = document.getElementById('qodOptions').querySelectorAll('button');
  btns.forEach((b,i) => {
    b.disabled = true;
    if (i === correct) {
      b.style.background = '#dcfce7'; b.style.borderColor = '#16a34a';
      b.style.fontWeight = '700';
    } else if (i === selected && !isCorrect) {
      b.style.background = '#fee2e2'; b.style.borderColor = '#dc2626';
    }
  });
  const res = document.getElementById('qodResult');
  res.style.display = 'block';
  res.style.background = isCorrect ? '#f0fdf4' : '#fef2f2';
  res.innerHTML = isCorrect
    ? '<p style="color:#15803d;font-weight:700;font-size:14px;">🎉 Correct! Well done!</p>'
    : `<p style="color:#dc2626;font-weight:700;font-size:14px;">❌ Wrong. Correct: ${String.fromCharCode(65+correct)}. ${opts[correct]}</p>`;

  if (qod.explanation) {
    document.getElementById('qodExplanation').style.display = 'block';
    document.getElementById('qodExplanationText').textContent = qod.explanation;
  }
  document.getElementById('qodShareBtn').style.display = 'block';
  document.getElementById('hubQodStatus').textContent  = '✅ Done';

  if (!user) return;
  try {
    await setDoc(doc(db,'users',user.uid,'qodAttempts',qod.id), {
      qodId:qod.id, selectedOption:selected, isCorrect, attemptedAt:serverTimestamp()
    });
    await runTransaction(db, async tx => {
      const ref  = doc(db,'questionOfDay',qod.id);
      const snap = await tx.get(ref);
      const d    = snap.data();
      tx.update(ref, {
        totalAttempts: (d.totalAttempts||0)+1,
        correctCount:  (d.correctCount||0)+(isCorrect?1:0)
      });
    });
    if (isCorrect) {
      const pts = 10;
      await updateDoc(doc(db,'users',user.uid), {
        totalPoints:increment(pts), weeklyPoints:increment(pts), monthlyPoints:increment(pts)
      });
      await addDoc(collection(db,'users',user.uid,'pointsLog'), {
        type:'qod', points:pts, date:todayStr(), createdAt:serverTimestamp()
      });
      showToast('+10 points for correct answer! 🎉', 'success');
    }
  } catch(e) { console.error('QOD save error:', e); }
}

window.shareQOD = function() {
  const text = `I attempted today's Question of the Day on Nishchay Academy! 🧠\n${window.location.origin}`;
  if (navigator.share) { navigator.share({ title:'Nishchay Academy QOD', text }); }
  else { navigator.clipboard?.writeText(text); showToast('Copied!', 'success'); }
};

// ============================================================
// DAILY QUIZ
// ============================================================
async function loadDailyQuiz(user) {
  const section = document.getElementById('quizSection');
  try {
    const today = todayStr();
    const snap  = await getDocs(query(
      collection(db, 'dailyQuiz'),
      where('isActive','==', true),
      limit(10)
    ));
    if (snap.empty) {
      document.getElementById('hubQuizText').textContent   = 'No quiz today';
      document.getElementById('hubQuizStatus').textContent = '';
      return;
    }
    let quiz = null;
    snap.forEach(d => {
      const data = d.data();
      if (!quiz && data.startDate <= today && data.endDate >= today) {
        quiz = { id: d.id, ...data };
      }
    });
    if (!quiz) {
      document.getElementById('hubQuizText').textContent   = 'No quiz today';
      document.getElementById('hubQuizStatus').textContent = '';
      return;
    }
    currentQuiz = quiz;

    let attempted = false;
    if (user) {
      const attSnap = await getDocs(query(
        collection(db,'dailyQuizAttempts'),
        where('userId','==',user.uid),
        where('quizId','==',quiz.id),
        limit(1)
      ));
      attempted = !attSnap.empty;
    }

    document.getElementById('hubQuizText').textContent   = quiz.title?.substring(0,60) || 'Daily Quiz';
    document.getElementById('hubQuizStatus').textContent = attempted ? '✅ Completed' : `${quiz.questionCount||0} Qs`;

    section.style.display = 'block';
    document.getElementById('quizTitle').textContent = quiz.title;
    document.getElementById('quizMeta').textContent  =
      `${quiz.questionCount} Questions · ${quiz.difficulty || 'Medium'}`;
    document.getElementById('quizBadge').textContent  = attempted ? '✅ Done' : '🟢 Active';
    const p = quiz.totalParticipants || 0;
    document.getElementById('quizParticipants').textContent = p;
    document.getElementById('quizAvgScore').textContent =
      p > 0 ? Math.round((quiz.totalScore||0)/p) : '-';
    document.getElementById('quizDifficulty').textContent =
      (quiz.difficulty||'Medium')[0].toUpperCase() + (quiz.difficulty||'medium').slice(1);

    if (attempted) {
      const btn = document.getElementById('quizAttemptBtn');
      btn.textContent = '✅ Already Completed';
      btn.disabled = true; btn.style.opacity = '0.6';
    }
  } catch(e) {
    console.error('Quiz load error:', e);
    document.getElementById('hubQuizText').textContent = 'Unavailable';
  }
}

window.startDailyQuiz = async function() {
  if (!currentUser) { showToast('Please login to attempt', 'info'); return; }
  if (!currentQuiz)  return;
  const ids = (currentQuiz.questionIds || []).slice(0,20);
  if (!ids.length)  { showToast('Quiz has no questions', 'info'); return; }

  quizQuestions = []; quizIndex = 0; quizAnswers = []; quizScore = 0;
  for (const id of ids) {
    const s = await getDoc(doc(db,'questions',id));
    if (s.exists()) quizQuestions.push({ id:s.id, ...s.data() });
  }
  if (!quizQuestions.length) { showToast('Could not load questions', 'error'); return; }

  document.getElementById('quizModalTitle').textContent    = currentQuiz.title;
  document.getElementById('quizResultScreen').style.display = 'none';
  document.getElementById('quizModal').style.display        = 'block';
  document.body.style.overflow = 'hidden';
  renderQuizQuestion();
};

function renderQuizQuestion() {
  const q   = quizQuestions[quizIndex];
  const tot = quizQuestions.length;
  document.getElementById('quizProgressText').textContent  =
    `Question ${quizIndex+1} of ${tot}`;
  document.getElementById('quizProgressBar').style.width   =
    `${(quizIndex/tot)*100}%`;
  document.getElementById('quizModalQuestion').textContent = q.question;
  document.getElementById('quizNextBtn').style.display     = 'none';
  const opts = [q.option1,q.option2,q.option3,q.option4].filter(Boolean);
  const el   = document.getElementById('quizModalOptions');
  el.innerHTML = '';
  opts.forEach((opt,i) => {
    const btn = document.createElement('button');
    btn.textContent = String.fromCharCode(65+i) + '. ' + opt;
    btn.style.cssText = `
      width:100%;padding:12px 14px;border-radius:10px;
      border:1.5px solid #e2e8f0;background:white;
      font-size:14px;font-weight:500;text-align:left;
      cursor:pointer;font-family:Inter,sans-serif;color:#1e293b;
    `;
    btn.onclick = () => pickQuizAnswer(i, q.correctOption-1, el.querySelectorAll('button'));
    el.appendChild(btn);
  });
}

function pickQuizAnswer(sel, correct, btns) {
  const ok = sel === correct;
  if (ok) quizScore++;
  quizAnswers.push({ questionId:quizQuestions[quizIndex].id, sel, correct, ok });
  btns.forEach((b,i) => {
    b.disabled = true;
    if (i===correct) { b.style.background='#dcfce7'; b.style.borderColor='#16a34a'; }
    else if (i===sel && !ok) { b.style.background='#fee2e2'; b.style.borderColor='#dc2626'; }
  });
  const nextBtn = document.getElementById('quizNextBtn');
  nextBtn.style.display    = 'block';
  nextBtn.textContent = quizIndex < quizQuestions.length-1 ? 'Next →' : 'Finish Quiz';
}

window.nextQuizQuestion = function() {
  quizIndex++;
  if (quizIndex < quizQuestions.length) { renderQuizQuestion(); }
  else { finishQuiz(); }
};

async function finishQuiz() {
  const tot = quizQuestions.length;
  const acc = Math.round((quizScore/tot)*100);
  document.getElementById('quizModalOptions').innerHTML    = '';
  document.getElementById('quizModalQuestion').textContent = '';
  document.getElementById('quizProgressText').textContent  = 'Complete!';
  document.getElementById('quizProgressBar').style.width   = '100%';
  document.getElementById('quizNextBtn').style.display     = 'none';
  document.getElementById('quizResultScreen').style.display = 'block';
  document.getElementById('quizResultScore').textContent    = `${quizScore} / ${tot}`;
  document.getElementById('quizResultAccuracy').textContent =
    `Accuracy: ${acc}% · ${acc>=70 ? 'Great job! 🌟' : 'Keep practising! 💪'}`;

  if (currentUser && currentQuiz) {
    try {
      const answers = {};
      quizAnswers.forEach(a => { answers[a.questionId] = a.sel; });
      await addDoc(collection(db,'dailyQuizAttempts'), {
        userId:currentUser.uid, quizId:currentQuiz.id,
        score:quizScore, totalQ:tot, accuracy:acc,
        answers, attemptedAt:serverTimestamp()
      });
      await updateDoc(doc(db,'dailyQuiz',currentQuiz.id), {
        totalParticipants: increment(1),
        totalScore:        increment(quizScore)
      });
      const pts = 20;
      await updateDoc(doc(db,'users',currentUser.uid), {
        totalPoints:increment(pts), weeklyPoints:increment(pts), monthlyPoints:increment(pts)
      });
      await addDoc(collection(db,'users',currentUser.uid,'pointsLog'), {
        type:'quiz', points:pts, date:todayStr(), createdAt:serverTimestamp()
      });
      document.getElementById('quizAttemptBtn').textContent = '✅ Already Completed';
      document.getElementById('quizAttemptBtn').disabled    = true;
      document.getElementById('quizBadge').textContent      = '✅ Done';
      document.getElementById('hubQuizStatus').textContent  = '✅ Completed';
      showToast('+20 points for completing quiz! 🎉', 'success');
    } catch(e) { console.error('Quiz save error:', e); }
  }
}

window.closeQuizModal = function() {
  document.getElementById('quizModal').style.display = 'none';
  document.body.style.overflow = '';
};
window.shareQuizResult = function() {
  const text = `I scored ${quizScore}/${quizQuestions.length} in today's Daily Quiz on Nishchay Academy! 🎯\n${window.location.origin}`;
  if (navigator.share) { navigator.share({ title:'Daily Quiz Result', text }); }
  else { navigator.clipboard?.writeText(text); showToast('Copied!', 'success'); }
};

// ============================================================
// TODAY IN HISTORY
// ============================================================
async function loadTodayInHistory() {
  const section = document.getElementById('historySection');
  try {
    const now   = new Date();
    const snap  = await getDocs(query(
      collection(db,'historyEvents'),
      where('month','==', now.getMonth()+1),
      where('day','==',   now.getDate()),
      where('isActive','==', true),
      limit(1)
    ));
    if (snap.empty) {
      document.getElementById('hubHistoryText').textContent = 'No event today';
      document.getElementById('hubHistoryYear').textContent = '';
      return;
    }
    const ev = snap.docs[0].data();
    document.getElementById('hubHistoryText').textContent =
      ev.title?.substring(0,65) + (ev.title?.length > 65 ? '...' : '');
    document.getElementById('hubHistoryYear').textContent =
      ev.year ? `Year ${ev.year}` : '';

    section.style.display = 'block';
    if (ev.imageUrl) {
      const img = document.getElementById('historyImage');
      img.src = ev.imageUrl; img.style.display = 'block';
    }
    document.getElementById('historyYear').textContent  = ev.year ? `Year ${ev.year}` : '';
    document.getElementById('historyTitle').textContent = ev.title;
    document.getElementById('historyDesc').textContent  = ev.description;
  } catch(e) {
    console.error('History error:', e);
    document.getElementById('hubHistoryText').textContent = 'Unavailable';
  }
}
window.shareHistory = function() {
  const t = document.getElementById('historyTitle').textContent;
  const d = document.getElementById('historyDesc').textContent;
  const text = `📅 Today in History\n\n${t}\n\n${d}\n\nNishchay Academy: ${window.location.origin}`;
  if (navigator.share) { navigator.share({ title:'Today in History', text }); }
  else { navigator.clipboard?.writeText(text); showToast('Copied!', 'success'); }
};

// ============================================================
// LEADERBOARD PREVIEW
// ============================================================
async function loadLeaderboardPreview() {
  const el = document.getElementById('hubLeaderPreview');
  try {
    const snap = await getDocs(query(
      collection(db,'leaderboard'),
      orderBy('weeklyPoints','desc'),
      limit(3)
    ));
    if (snap.empty) { el.textContent = 'No rankings yet'; return; }
    const medals = ['🥇','🥈','🥉'];
    let html = ''; let i = 0;
    snap.forEach(d => {
      const data = d.data();
      html += `<div>${medals[i]} ${(data.fullName||'Student').split(' ')[0]} — ${data.weeklyPoints||0} pts</div>`;
      i++;
    });
    el.innerHTML = html;
  } catch(e) { el.textContent = 'See rankings →'; }
}

// ── TOAST ──
window.showToast = function(msg, type='info') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`; t.textContent = msg;
  c.appendChild(t); setTimeout(() => t.remove(), 3000);
};
