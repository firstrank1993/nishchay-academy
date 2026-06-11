// ============================================
// NISHCHAY ACADEMY — Home Page v2
// Field names: questionText, options[], correctOption (0-based)
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
let currentQuiz   = null;
let quizQuestions = [];
let quizIndex     = 0;
let quizAnswers   = [];
let quizScore     = 0;

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
// EXAM BODIES — unchanged
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
      const initials = data.name.length <= 5 ? data.name.toUpperCase() : data.name.substring(0,4).toUpperCase();
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
  }
}

// ============================================================
// STREAK & POINTS
// ============================================================
async function updateStreakAndPoints(user) {
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap    = await getDoc(userRef);
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

    if ((data.weekKey||'') !== weekKey)   { updates.weeklyPoints=0;  updates.weekKey=weekKey;   weekly=0;  }
    if ((data.monthKey||'') !== monthKey) { updates.monthlyPoints=0; updates.monthKey=monthKey; monthly=0; }

    if (lastDay === today) {
      // already counted
    } else if (lastDay === yesterday) {
      streak++;
      updates.currentStreak = streak;
      updates.lastActiveDate = today;
    } else {
      streak = 1;
      updates.currentStreak = 1;
      updates.lastActiveDate = today;
    }
    if (streak > longest) { updates.longestStreak = streak; }

    if (lastDay !== today) {
      updates.totalPoints   = increment(5);
      updates.weeklyPoints  = increment(5);
      updates.monthlyPoints = increment(5);
      total += 5; weekly += 5; monthly += 5;
      await addDoc(collection(db,'users',user.uid,'pointsLog'), {
        type:'login', points:5, date:today, createdAt:serverTimestamp()
      });
    }

    if (Object.keys(updates).length) await updateDoc(userRef, updates);

    await setDoc(doc(db,'leaderboard',user.uid), {
      userId:user.uid, fullName:data.fullName||'Student',
      district:data.district||'', photoUrl:data.photoUrl||'',
      totalPoints:total, weeklyPoints:weekly, monthlyPoints:monthly,
      currentStreak:streak, updatedAt:serverTimestamp()
    }, { merge:true });

    if (streak > 0) {
      document.getElementById('streakBadge').style.display = 'block';
      document.getElementById('streakCount').textContent   = streak;
    }
    const pr = document.getElementById('pointsRow');
    if (pr) { pr.style.display='flex'; }
    const tpEl = document.getElementById('totalPointsEl');
    const wpEl = document.getElementById('weeklyPointsEl');
    if (tpEl) tpEl.textContent = total;
    if (wpEl) wpEl.textContent = weekly;
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
    const scheduled = await getDocs(query(
      collection(db,'dailyQuotes'),
      where('scheduledDate','==',today),
      where('isActive','==',true),
      limit(1)
    ));
    let quote = null;
    if (!scheduled.empty) {
      quote = scheduled.docs[0].data();
    } else {
      const all = await getDocs(query(collection(db,'dailyQuotes'), where('isActive','==',true)));
      if (!all.empty) {
        const list = [];
        all.forEach(d => { if (!d.data().scheduledDate) list.push(d.data()); });
        if (list.length) {
          list.sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0));
          quote = list[dayOfYear() % list.length];
        }
      }
    }
    if (!quote) { if(textEl) textEl.textContent='No quote added yet'; return; }
    if(textEl) textEl.textContent = '\u201C'+quote.text+'\u201D';
    if(authEl) authEl.textContent = '\u2014 '+quote.author;
  } catch(e) {
    if(textEl) textEl.textContent = 'Quote unavailable';
    console.error('Quote error:',e);
  }
}

// ============================================================
// QUESTION OF THE DAY
// FIXED: uses questionText, options[], correctOption (0-based)
// ============================================================
async function loadQOD(user) {
  const section = document.getElementById('qodSection');
  try {
    // First check if admin set a specific question for today
    const today = todayStr();
    const qodSnap = await getDocs(query(
      collection(db,'questionOfDay'),
      where('activeDate','==',today),
      where('isActive','==',true),
      limit(1)
    ));

    let qodDocId = null;
    let qodData  = null;
    let questionId = null;

    if (!qodSnap.empty) {
      // Admin-set question for today
      qodDocId  = qodSnap.docs[0].id;
      qodData   = qodSnap.docs[0].data();
      questionId = qodData.questionId;
    } else {
      // Auto-rotate: pick from all questions by day of year
      // Check if there's an auto-rotate setting
      const autoSnap = await getDocs(query(
        collection(db,'questionOfDay'),
        where('activeDate','==','auto'),
        where('isActive','==',true),
        limit(1)
      ));
      if (!autoSnap.empty) {
        qodDocId = autoSnap.docs[0].id;
        qodData  = autoSnap.docs[0].data();
        // Rotate through all questions
        const allQ = await getDocs(collection(db,'questions'));
        const ids  = [];
        allQ.forEach(d => ids.push(d.id));
        if (ids.length) questionId = ids[dayOfYear() % ids.length];
      }
    }

    if (!questionId) {
      const hubText = document.getElementById('hubQodText');
      if(hubText) hubText.textContent = 'No question set for today';
      return;
    }

    const qSnap = await getDoc(doc(db,'questions',questionId));
    if (!qSnap.exists()) return;
    const q = { id:qSnap.id, ...qSnap.data() };

    // Hub preview — FIXED field name
    const hubText   = document.getElementById('hubQodText');
    const hubStatus = document.getElementById('hubQodStatus');
    if(hubText) hubText.textContent = (q.questionText||'').substring(0,70) + ((q.questionText||'').length>70?'...':'');

    let attempted = false;
    if (user && qodDocId) {
      const attSnap = await getDoc(doc(db,'users',user.uid,'qodAttempts',qodDocId));
      attempted = attSnap.exists();
    }
    if(hubStatus) hubStatus.textContent = attempted ? '✅ Done' : '👆 Tap to attempt';

    // Render full QOD section
    if(section) section.style.display = 'block';
    const qEl = document.getElementById('qodQuestion');
    if(qEl) qEl.textContent = q.questionText || '';

    // Subject/Topic tag
    const tagEl = document.getElementById('qodTag');
    if (tagEl && q.subjectId) {
      try {
        const subSnap = await getDoc(doc(db,'subjects',q.subjectId));
        if (subSnap.exists()) {
          tagEl.textContent = '📚 ' + subSnap.data().name;
          tagEl.style.display = 'inline-block';
        }
      } catch(e) {}
    }

    // Options — FIXED: uses options[] array, correctOption is 0-based
    const optDiv = document.getElementById('qodOptions');
    if(!optDiv) return;
    optDiv.innerHTML = '';
    const opts = q.options || [];
    opts.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.textContent = String.fromCharCode(65+i) + '. ' + opt;
      btn.style.cssText = `
        width:100%;padding:12px 14px;border-radius:10px;
        border:1.5px solid #e2e8f0;background:white;
        font-size:13px;font-weight:500;text-align:left;
        cursor:pointer;font-family:Inter,sans-serif;color:#1e293b;
        transition:all 0.2s;
      `;
      if (attempted) {
        btn.disabled = true; btn.style.opacity = '0.65';
      } else {
        btn.onclick = () => submitQOD(i, q.correctOption, qodDocId, qodData, q, opts, user);
      }
      optDiv.appendChild(btn);
    });

    if (attempted) {
      const res = document.getElementById('qodResult');
      if(res) {
        res.style.display = 'block';
        res.style.background = '#f0fdf4';
        res.innerHTML = '<p style="color:#15803d;font-weight:600;">✅ Already attempted today!</p>';
      }
      if (qodData?.explanation) {
        const expDiv = document.getElementById('qodExplanation');
        const expTxt = document.getElementById('qodExplanationText');
        if(expDiv) expDiv.style.display = 'block';
        if(expTxt) expTxt.textContent = qodData.explanation;
      }
    }
  } catch(e) {
    console.error('QOD error:',e);
    const hubText = document.getElementById('hubQodText');
    if(hubText) hubText.textContent = 'Unavailable';
  }
}

async function submitQOD(selected, correct, qodDocId, qodData, q, opts, user) {
  const isCorrect = selected === correct;
  const btns = document.getElementById('qodOptions').querySelectorAll('button');
  btns.forEach((b,i) => {
    b.disabled = true;
    if (i===correct)               { b.style.background='#dcfce7'; b.style.borderColor='#16a34a'; b.style.fontWeight='700'; }
    else if (i===selected&&!isCorrect) { b.style.background='#fee2e2'; b.style.borderColor='#dc2626'; }
  });
  const res = document.getElementById('qodResult');
  if(res) {
    res.style.display = 'block';
    res.style.background = isCorrect ? '#f0fdf4' : '#fef2f2';
    res.innerHTML = isCorrect
      ? '<p style="color:#15803d;font-weight:700;font-size:14px;">🎉 Correct! Well done!</p>'
      : `<p style="color:#dc2626;font-weight:700;font-size:14px;">❌ Wrong. Correct: ${String.fromCharCode(65+correct)}. ${opts[correct]}</p>`;
  }
  if (qodData?.explanation) {
    const expDiv = document.getElementById('qodExplanation');
    const expTxt = document.getElementById('qodExplanationText');
    if(expDiv) expDiv.style.display = 'block';
    if(expTxt) expTxt.textContent = qodData.explanation;
  }
  const shareBtn = document.getElementById('qodShareBtn');
  if(shareBtn) shareBtn.style.display = 'block';
  const hubStatus = document.getElementById('hubQodStatus');
  if(hubStatus) hubStatus.textContent = '✅ Done';

  if (!user || !qodDocId) return;
  try {
    await setDoc(doc(db,'users',user.uid,'qodAttempts',qodDocId), {
      qodId:qodDocId, selectedOption:selected, isCorrect, attemptedAt:serverTimestamp()
    });
    if (qodDocId !== 'auto') {
      await runTransaction(db, async tx => {
        const ref  = doc(db,'questionOfDay',qodDocId);
        const snap = await tx.get(ref);
        if(snap.exists()) {
          const d = snap.data();
          tx.update(ref, { totalAttempts:(d.totalAttempts||0)+1, correctCount:(d.correctCount||0)+(isCorrect?1:0) });
        }
      });
    }
    if (isCorrect) {
      await updateDoc(doc(db,'users',user.uid), { totalPoints:increment(10), weeklyPoints:increment(10), monthlyPoints:increment(10) });
      await addDoc(collection(db,'users',user.uid,'pointsLog'), { type:'qod', points:10, date:todayStr(), createdAt:serverTimestamp() });
      showToast('+10 points! 🎉','success');
    }
  } catch(e) { console.error('QOD save error:',e); }
}

window.shareQOD = function() {
  const qText = document.getElementById('qodQuestion')?.textContent || '';
  const text  = `🧠 Question of the Day — Nishchay Academy\n\n${qText}\n\nAttempt at: ${window.location.href}`;
  if (navigator.share) { navigator.share({ title:'QOD — Nishchay Academy', text, url:window.location.href }); }
  else { navigator.clipboard?.writeText(text); showToast('Copied to clipboard!','success'); }
};

// ============================================================
// DAILY QUIZ
// FIXED: uses questionText, options[], correctOption (0-based)
// ============================================================
async function loadDailyQuiz(user) {
  const section = document.getElementById('quizSection');
  try {
    const today = todayStr();
    const snap  = await getDocs(query(collection(db,'dailyQuiz'), where('isActive','==',true), limit(10)));
    if (snap.empty) {
      const hubText = document.getElementById('hubQuizText');
      if(hubText) hubText.textContent = 'No quiz today';
      return;
    }
    let quiz = null;
    snap.forEach(d => {
      const data = d.data();
      if (!quiz && data.startDate <= today && data.endDate >= today) quiz = { id:d.id,...data };
    });
    if (!quiz) {
      const hubText = document.getElementById('hubQuizText');
      if(hubText) hubText.textContent = 'No quiz today';
      return;
    }
    currentQuiz = quiz;

    let attempted = false;
    if (user) {
      const attSnap = await getDocs(query(collection(db,'dailyQuizAttempts'), where('userId','==',user.uid), where('quizId','==',quiz.id), limit(1)));
      attempted = !attSnap.empty;
    }

    const hubText   = document.getElementById('hubQuizText');
    const hubStatus = document.getElementById('hubQuizStatus');
    if(hubText)   hubText.textContent   = (quiz.title||'Daily Quiz').substring(0,60);
    if(hubStatus) hubStatus.textContent = attempted ? '✅ Completed' : `${quiz.questionCount||0} Qs`;

    if(section) section.style.display = 'block';
    const titleEl = document.getElementById('quizTitle');
    const metaEl  = document.getElementById('quizMeta');
    const badgeEl = document.getElementById('quizBadge');
    if(titleEl) titleEl.textContent = quiz.title;
    if(metaEl)  metaEl.textContent  = `${quiz.questionCount} Questions · ${quiz.difficulty||'Medium'}`;
    if(badgeEl) badgeEl.textContent = attempted ? '✅ Done' : '🟢 Active';

    const p   = quiz.totalParticipants || 0;
    const avg = p > 0 ? Math.round((quiz.totalScore||0)/p) : '-';
    const pEl = document.getElementById('quizParticipants');
    const aEl = document.getElementById('quizAvgScore');
    const dEl = document.getElementById('quizDifficulty');
    if(pEl) pEl.textContent = p;
    if(aEl) aEl.textContent = avg;
    if(dEl) dEl.textContent = (quiz.difficulty||'Medium')[0].toUpperCase()+(quiz.difficulty||'medium').slice(1);

    if (attempted) {
      const btn = document.getElementById('quizAttemptBtn');
      if(btn) { btn.textContent='✅ Already Completed'; btn.disabled=true; btn.style.opacity='0.6'; }
    }
  } catch(e) {
    console.error('Quiz load error:',e);
    const hubText = document.getElementById('hubQuizText');
    if(hubText) hubText.textContent = 'Unavailable';
  }
}

window.startDailyQuiz = async function() {
  if (!currentUser) { showToast('Please login to attempt','info'); return; }
  if (!currentQuiz) return;
  const ids = (currentQuiz.questionIds||[]).slice(0,20);
  if (!ids.length) { showToast('Quiz has no questions','info'); return; }

  quizQuestions=[]; quizIndex=0; quizAnswers=[]; quizScore=0;

  // FIXED: fetch questions and use correct field names
  for (const id of ids) {
    const s = await getDoc(doc(db,'questions',id));
    if (s.exists()) quizQuestions.push({ id:s.id,...s.data() });
  }
  if (!quizQuestions.length) { showToast('Could not load questions','error'); return; }

  const modalTitle = document.getElementById('quizModalTitle');
  const resultScr  = document.getElementById('quizResultScreen');
  const modal      = document.getElementById('quizModal');
  if(modalTitle) modalTitle.textContent = currentQuiz.title;
  if(resultScr)  resultScr.style.display = 'none';
  if(modal)      modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
  renderQuizQuestion();
};

function renderQuizQuestion() {
  const q   = quizQuestions[quizIndex];
  const tot = quizQuestions.length;
  const ptEl = document.getElementById('quizProgressText');
  const pbEl = document.getElementById('quizProgressBar');
  const qEl  = document.getElementById('quizModalQuestion');
  const nbEl = document.getElementById('quizNextBtn');
  if(ptEl) ptEl.textContent = `Question ${quizIndex+1} of ${tot}`;
  if(pbEl) pbEl.style.width = `${(quizIndex/tot)*100}%`;
  // FIXED: use questionText not question
  if(qEl)  qEl.textContent = q.questionText || '';
  if(nbEl) nbEl.style.display = 'none';

  // FIXED: use options[] array
  const opts = q.options || [];
  const el   = document.getElementById('quizModalOptions');
  if(!el) return;
  el.innerHTML = '';
  opts.forEach((opt,i) => {
    const btn = document.createElement('button');
    btn.textContent = String.fromCharCode(65+i)+'. '+opt;
    btn.style.cssText = `
      width:100%;padding:12px 14px;border-radius:10px;
      border:1.5px solid #e2e8f0;background:white;
      font-size:14px;font-weight:500;text-align:left;
      cursor:pointer;font-family:Inter,sans-serif;color:#1e293b;
    `;
    // FIXED: correctOption is already 0-based
    btn.onclick = () => pickQuizAnswer(i, q.correctOption, el.querySelectorAll('button'));
    el.appendChild(btn);
  });
}

function pickQuizAnswer(sel, correct, btns) {
  const ok = sel === correct;
  if (ok) quizScore++;
  quizAnswers.push({ questionId:quizQuestions[quizIndex].id, sel, correct, ok });
  btns.forEach((b,i) => {
    b.disabled = true;
    if (i===correct)       { b.style.background='#dcfce7'; b.style.borderColor='#16a34a'; }
    else if (i===sel&&!ok) { b.style.background='#fee2e2'; b.style.borderColor='#dc2626'; }
  });
  const nb = document.getElementById('quizNextBtn');
  if(nb) { nb.style.display='block'; nb.textContent = quizIndex<quizQuestions.length-1?'Next →':'Finish Quiz'; }
}

window.nextQuizQuestion = function() {
  quizIndex++;
  if (quizIndex < quizQuestions.length) { renderQuizQuestion(); }
  else { finishQuiz(); }
};

async function finishQuiz() {
  const tot = quizQuestions.length;
  const acc = Math.round((quizScore/tot)*100);
  const el1 = document.getElementById('quizModalOptions');
  const el2 = document.getElementById('quizModalQuestion');
  const el3 = document.getElementById('quizProgressText');
  const el4 = document.getElementById('quizProgressBar');
  const el5 = document.getElementById('quizNextBtn');
  const el6 = document.getElementById('quizResultScreen');
  const el7 = document.getElementById('quizResultScore');
  const el8 = document.getElementById('quizResultAccuracy');
  if(el1) el1.innerHTML='';
  if(el2) el2.textContent='';
  if(el3) el3.textContent='Complete!';
  if(el4) el4.style.width='100%';
  if(el5) el5.style.display='none';
  if(el6) el6.style.display='block';
  if(el7) el7.textContent=`${quizScore} / ${tot}`;
  if(el8) el8.textContent=`Accuracy: ${acc}% · ${acc>=70?'Great job! 🌟':'Keep practising! 💪'}`;

  if (currentUser && currentQuiz) {
    try {
      const answers = {};
      quizAnswers.forEach(a => { answers[a.questionId]=a.sel; });
      await addDoc(collection(db,'dailyQuizAttempts'), {
        userId:currentUser.uid, quizId:currentQuiz.id,
        score:quizScore, totalQ:tot, accuracy:acc,
        answers, attemptedAt:serverTimestamp()
      });
      await updateDoc(doc(db,'dailyQuiz',currentQuiz.id), { totalParticipants:increment(1), totalScore:increment(quizScore) });
      await updateDoc(doc(db,'users',currentUser.uid), { totalPoints:increment(20), weeklyPoints:increment(20), monthlyPoints:increment(20) });
      await addDoc(collection(db,'users',currentUser.uid,'pointsLog'), { type:'quiz', points:20, date:todayStr(), createdAt:serverTimestamp() });
      const btn = document.getElementById('quizAttemptBtn');
      const badge = document.getElementById('quizBadge');
      const hubStatus = document.getElementById('hubQuizStatus');
      if(btn)       { btn.textContent='✅ Already Completed'; btn.disabled=true; btn.style.opacity='0.6'; }
      if(badge)     badge.textContent='✅ Done';
      if(hubStatus) hubStatus.textContent='✅ Completed';
      showToast('+20 points for completing quiz! 🎉','success');
    } catch(e) { console.error('Quiz save error:',e); }
  }
}

window.closeQuizModal = function() {
  const modal = document.getElementById('quizModal');
  if(modal) modal.style.display='none';
  document.body.style.overflow='';
};

window.shareQuizResult = function() {
  const tot  = quizQuestions.length;
  const acc  = Math.round((quizScore/tot)*100);
  const text = `📝 Daily Quiz Result — Nishchay Academy\n\nScore: ${quizScore}/${tot} (${acc}%)\n${acc>=70?'🌟 Great job!':'💪 Keep practising!'}\n\nJoin at: ${window.location.origin}`;
  if (navigator.share) { navigator.share({ title:'Daily Quiz Result', text, url:window.location.origin }); }
  else { navigator.clipboard?.writeText(text); showToast('Copied!','success'); }
};

// ============================================================
// TODAY IN HISTORY
// ============================================================
async function loadTodayInHistory() {
  const section = document.getElementById('historySection');
  const container = document.getElementById('historyContainer');
  try {
    const now   = new Date();
    const snap  = await getDocs(query(
      collection(db,'historyEvents'),
      where('month','==',now.getMonth()+1),
      where('day','==',now.getDate()),
      where('isActive','==',true)
    ));
    if (snap.empty) {
      const hubText = document.getElementById('hubHistoryText');
      if(hubText) hubText.textContent = 'No event today';
      return;
    }

    const events = [];
    snap.forEach(d => events.push({ id:d.id,...d.data() }));

    // Hub card shows first event
    const first = events[0];
    const hubText = document.getElementById('hubHistoryText');
    const hubYear = document.getElementById('hubHistoryYear');
    if(hubText) hubText.textContent = (first.title||'').substring(0,65)+((first.title||'').length>65?'...':'');
    if(hubYear) hubYear.textContent = first.year ? `Year ${first.year}` : '';

    if(section) section.style.display='block';
    if(!container) return;

    container.innerHTML = '';
    events.forEach((ev, idx) => {
      const card = document.createElement('div');
      card.style.cssText = `
        background:white;border-radius:14px;overflow:hidden;
        border:1px solid var(--border);
        ${idx > 0 ? 'margin-top:12px;' : ''}
      `;
      const subjectTag = ev.subject ? `<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;background:#f3e8ff;color:#7c3aed;margin-left:6px;">${ev.subject}</span>` : '';
      card.innerHTML = `
        ${ev.imageUrl ? `<img src="${ev.imageUrl}" style="width:100%;height:160px;object-fit:cover;"/>` : ''}
        <div style="padding:14px;">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;background:#fef3c7;color:#d97706;">
              📅 Year ${ev.year}
            </span>
            ${subjectTag}
          </div>
          <p style="font-size:15px;font-weight:700;margin-bottom:6px;">${ev.title}</p>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-bottom:12px;">${ev.description}</p>
          <button onclick="shareHistoryEvent('${ev.id}')"
            style="width:100%;padding:10px;border-radius:10px;
                   border:1.5px solid var(--border);background:white;
                   font-size:13px;font-weight:600;cursor:pointer;
                   font-family:Inter,sans-serif;">
            📤 Share This Event
          </button>
        </div>
      `;
      container.appendChild(card);
    });

    // Store events for sharing
    window._historyEvents = events;
  } catch(e) {
    console.error('History error:',e);
    const hubText = document.getElementById('hubHistoryText');
    if(hubText) hubText.textContent = 'Unavailable';
  }
}

window.shareHistoryEvent = function(eventId) {
  const events = window._historyEvents || [];
  const ev     = events.find(e => e.id === eventId);
  if (!ev) return;
  const text = `📅 Today in History — ${ev.year}\n\n${ev.title}\n\n${ev.description}\n\nLearn more at Nishchay Academy: ${window.location.origin}`;
  if (navigator.share) { navigator.share({ title:'Today in History', text, url:window.location.origin }); }
  else { navigator.clipboard?.writeText(text); showToast('Copied to clipboard!','success'); }
};

// ============================================================
// LEADERBOARD PREVIEW
// ============================================================
async function loadLeaderboardPreview() {
  const el = document.getElementById('hubLeaderPreview');
  try {
    const snap = await getDocs(query(collection(db,'leaderboard'), orderBy('weeklyPoints','desc'), limit(3)));
    if (snap.empty) { if(el) el.textContent='No rankings yet'; return; }
    const medals=['🥇','🥈','🥉']; let html=''; let i=0;
    snap.forEach(d => {
      const data=d.data();
      html += `<div>${medals[i]} ${(data.fullName||'Student').split(' ')[0]} — ${data.weeklyPoints||0} pts</div>`;
      i++;
    });
    if(el) el.innerHTML=html;
  } catch(e) { if(el) el.textContent='See rankings →'; }
}

// ── TOAST ──
window.showToast = function(msg, type='info') {
  const c = document.getElementById('toastContainer');
  if(!c) return;
  const t = document.createElement('div');
  t.className=`toast toast-${type}`; t.textContent=msg;
  c.appendChild(t); setTimeout(()=>t.remove(),3000);
};
