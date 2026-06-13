// ============================================
// NISHCHAY ACADEMY — Home Page v4
// Added: respects loginRequired toggle from settings/appConfig
// ============================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, getDoc, addDoc, updateDoc, setDoc,
  doc, query, where, orderBy, limit,
  serverTimestamp, increment, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser   = null;
let loginRequired = true; // default safe value until loaded
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
function getQText(q) { return q.questionText || q.question || ''; }
function getOpts(q) {
  if (q.options && q.options.length) return q.options;
  const opts = [];
  if (q.option1) opts.push(q.option1);
  if (q.option2) opts.push(q.option2);
  if (q.option3) opts.push(q.option3);
  if (q.option4) opts.push(q.option4);
  return opts;
}
function getCorrect(q) {
  const c = q.correctOption;
  if (typeof c === 'number') return c;
  if (typeof c === 'string') {
    const map = {'A':0,'B':1,'C':2,'D':3};
    return map[c.toUpperCase()] ?? 0;
  }
  return 0;
}

// ── LOGIN SETTING ──
async function loadLoginSetting() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'appConfig'));
    loginRequired = snap.exists() ? (snap.data().loginRequired !== false) : true;
  } catch(e) { loginRequired = true; }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Load the login setting FIRST so all features know whether
  // to require login for interactive actions
  await loadLoginSetting();

  loadDailyQuote();
  loadTodayInHistory();
  loadLeaderboardPreview();
  loadExamBodies();

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      updateStreakAndPoints(user);
    }
    // Load QOD and Quiz regardless of login state — content is visible to all,
    // but attempting requires login only if loginRequired is true
    loadQOD(user);
    loadDailyQuiz(user);
  });
});

// ============================================================
// EXAM BODIES
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
    if(skeletonLoader) skeletonLoader.style.display = 'none';
    if(emptyState) emptyState.style.display = 'block';
  }
}

// ============================================================
// STREAK & POINTS — only runs for logged-in users (points need a user account)
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
    let streak  = data.currentStreak || 0;
    let longest = data.longestStreak || 0;
    let total   = data.totalPoints   || 0;
    let weekly  = data.weeklyPoints  || 0;
    let monthly = data.monthlyPoints || 0;
    let updates = {};
    if ((data.weekKey||'') !== weekKey)   { updates.weeklyPoints=0;  updates.weekKey=weekKey;   weekly=0;  }
    if ((data.monthKey||'') !== monthKey) { updates.monthlyPoints=0; updates.monthKey=monthKey; monthly=0; }
    if (lastDay === today) {
      // already counted today
    } else if (lastDay === yesterday) {
      streak++; updates.currentStreak=streak; updates.lastActiveDate=today;
    } else {
      streak=1; updates.currentStreak=1; updates.lastActiveDate=today;
    }
    if (streak > longest) { updates.longestStreak=streak; }
    if (lastDay !== today) {
      updates.totalPoints=increment(5); updates.weeklyPoints=increment(5); updates.monthlyPoints=increment(5);
      total+=5; weekly+=5; monthly+=5;
      await addDoc(collection(db,'users',user.uid,'pointsLog'), { type:'login',points:5,date:today,createdAt:serverTimestamp() });
    }
    if (Object.keys(updates).length) await updateDoc(userRef, updates);
    await setDoc(doc(db,'leaderboard',user.uid), {
      userId:user.uid, fullName:data.fullName||'Student', district:data.district||'',
      photoUrl:data.photoUrl||'', totalPoints:total, weeklyPoints:weekly,
      monthlyPoints:monthly, currentStreak:streak, updatedAt:serverTimestamp()
    }, { merge:true });
    const sb = document.getElementById('streakBadge');
    const sc = document.getElementById('streakCount');
    const pr = document.getElementById('pointsRow');
    const tp = document.getElementById('totalPointsEl');
    const wp = document.getElementById('weeklyPointsEl');
    if (streak > 0 && sb) { sb.style.display='block'; if(sc) sc.textContent=streak; }
    if (pr) pr.style.display='flex';
    if (tp) tp.textContent=total;
    if (wp) wp.textContent=weekly;
  } catch(e) { console.error('Streak error:',e); }
}

// ============================================================
// DAILY QUOTE — always visible to everyone
// ============================================================
async function loadDailyQuote() {
  const textEl = document.getElementById('hubQuoteText');
  const authEl = document.getElementById('hubQuoteAuthor');
  try {
    const today = todayStr();
    const scheduled = await getDocs(query(collection(db,'dailyQuotes'), where('scheduledDate','==',today), where('isActive','==',true), limit(1)));
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
    if(textEl) textEl.textContent='\u201C'+quote.text+'\u201D';
    if(authEl) authEl.textContent='\u2014 '+quote.author;
  } catch(e) { if(textEl) textEl.textContent='Quote unavailable'; }
}

// ============================================================
// QUESTION OF THE DAY
// FIX: Question and options always VISIBLE to everyone.
//      Only the ATTEMPT (submit) requires login if loginRequired is true.
// ============================================================
async function loadQOD(user) {
  const section   = document.getElementById('qodSection');
  const hubText   = document.getElementById('hubQodText');
  const hubStatus = document.getElementById('hubQodStatus');
  try {
    const today = todayStr();

    const qodSnap = await getDocs(query(
      collection(db,'questionOfDay'),
      where('activeDate','==',today),
      where('isActive','==',true),
      limit(1)
    ));

    let qodDocId   = null;
    let qodData    = null;
    let questionId = null;

    if (!qodSnap.empty) {
      qodDocId   = qodSnap.docs[0].id;
      qodData    = qodSnap.docs[0].data();
      questionId = qodData.questionId;
    } else {
      const allQ = await getDocs(query(collection(db,'questions'), limit(200)));
      if (!allQ.empty) {
        const ids = [];
        allQ.forEach(d => ids.push(d.id));
        if (ids.length) {
          ids.sort();
          questionId = ids[dayOfYear() % ids.length];
          qodDocId = `auto_${today}`;
          qodData  = { explanation: null };
        }
      }
    }

    if (!questionId) {
      if(hubText) hubText.textContent='No questions in bank yet';
      return;
    }

    const qSnap = await getDoc(doc(db,'questions',questionId));
    if (!qSnap.exists()) {
      if(hubText) hubText.textContent='Question unavailable';
      return;
    }
    const q = { id:qSnap.id, ...qSnap.data() };
    const qText = getQText(q);
    const opts  = getOpts(q);
    const correct = getCorrect(q);

    if(hubText) hubText.textContent = qText.substring(0,70)+(qText.length>70?'...':'');

    // Check attempt status only if user is logged in
    let attempted = false;
    if (user && qodDocId) {
      try {
        const attSnap = await getDoc(doc(db,'users',user.uid,'qodAttempts',qodDocId));
        attempted = attSnap.exists();
      } catch(e) {}
    }

    if(hubStatus) {
      if (attempted) hubStatus.textContent = '✅ Done';
      else if (!user && loginRequired) hubStatus.textContent = '🔒 Login to attempt';
      else hubStatus.textContent = '👆 Tap to attempt';
    }

    // ALWAYS show the question and options — visible to everyone
    if(section) section.style.display='block';
    const qEl = document.getElementById('qodQuestion');
    if(qEl) qEl.textContent = qText;

    const tagEl = document.getElementById('qodTag');
    if (tagEl && q.subjectId) {
      try {
        const subSnap = await getDoc(doc(db,'subjects',q.subjectId));
        if (subSnap.exists()) {
          tagEl.textContent = '📚 '+subSnap.data().name;
          tagEl.style.display = 'inline-block';
        }
      } catch(e) {}
    }

    const optDiv = document.getElementById('qodOptions');
    if(!optDiv) return;
    optDiv.innerHTML = '';
    opts.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.textContent = String.fromCharCode(65+i)+'. '+opt;
      btn.style.cssText = `
        width:100%;padding:12px 14px;border-radius:10px;
        border:1.5px solid #e2e8f0;background:white;
        font-size:13px;font-weight:500;text-align:left;
        cursor:pointer;font-family:Inter,sans-serif;color:#1e293b;
        transition:all 0.2s;
      `;
      if (attempted) {
        btn.disabled=true; btn.style.opacity='0.65';
      } else {
        // Allow click for everyone — gate the LOGIN check inside submitQOD
        btn.onclick = () => {
          if (loginRequired && !user) {
            showToast('Please login to submit your answer 🔒', 'info');
            return;
          }
          submitQOD(i, correct, qodDocId, qodData, qText, opts, user);
        };
      }
      optDiv.appendChild(btn);
    });

    if (attempted) {
      const res = document.getElementById('qodResult');
      if(res) { res.style.display='block'; res.style.background='#f0fdf4'; res.innerHTML='<p style="color:#15803d;font-weight:600;">✅ Already attempted today!</p>'; }
      if (qodData?.explanation) {
        const expDiv=document.getElementById('qodExplanation'); const expTxt=document.getElementById('qodExplanationText');
        if(expDiv) expDiv.style.display='block'; if(expTxt) expTxt.textContent=qodData.explanation;
      }
    }

    // Show a login hint banner if anonymous + login required
    if (!user && loginRequired) {
      const hint = document.getElementById('qodLoginHint');
      if (hint) hint.style.display = 'block';
    }
  } catch(e) {
    console.error('QOD error:',e);
    if(hubText) hubText.textContent='Unavailable';
  }
}

async function submitQOD(selected, correct, qodDocId, qodData, qText, opts, user) {
  const isCorrect = selected === correct;
  const btns = document.getElementById('qodOptions').querySelectorAll('button');
  btns.forEach((b,i) => {
    b.disabled=true;
    if(i===correct) { b.style.background='#dcfce7'; b.style.borderColor='#16a34a'; b.style.fontWeight='700'; }
    else if(i===selected&&!isCorrect) { b.style.background='#fee2e2'; b.style.borderColor='#dc2626'; }
  });
  const res=document.getElementById('qodResult');
  if(res) {
    res.style.display='block'; res.style.background=isCorrect?'#f0fdf4':'#fef2f2';
    res.innerHTML=isCorrect
      ?'<p style="color:#15803d;font-weight:700;font-size:14px;">🎉 Correct! Well done!</p>'
      :`<p style="color:#dc2626;font-weight:700;font-size:14px;">❌ Wrong. Correct: ${String.fromCharCode(65+correct)}. ${opts[correct]}</p>`;
  }
  if(qodData?.explanation) {
    const expDiv=document.getElementById('qodExplanation'); const expTxt=document.getElementById('qodExplanationText');
    if(expDiv) expDiv.style.display='block'; if(expTxt) expTxt.textContent=qodData.explanation;
  }
  const shareBtn=document.getElementById('qodShareBtn');
  if(shareBtn) shareBtn.style.display='block';
  const hubStatus=document.getElementById('hubQodStatus');
  if(hubStatus) hubStatus.textContent='✅ Done';

  // If no user (anonymous access allowed), skip saving attempt/points
  if (!user || !qodDocId) return;
  try {
    await setDoc(doc(db,'users',user.uid,'qodAttempts',qodDocId), {
      qodId:qodDocId, selectedOption:selected, isCorrect, attemptedAt:serverTimestamp()
    });
    if (!qodDocId.startsWith('auto_') && qodDocId) {
      await runTransaction(db, async tx => {
        const ref=doc(db,'questionOfDay',qodDocId); const snap=await tx.get(ref);
        if(snap.exists()) { const d=snap.data(); tx.update(ref,{totalAttempts:(d.totalAttempts||0)+1,correctCount:(d.correctCount||0)+(isCorrect?1:0)}); }
      });
    }
    if (isCorrect) {
      await updateDoc(doc(db,'users',user.uid),{totalPoints:increment(10),weeklyPoints:increment(10),monthlyPoints:increment(10)});
      await addDoc(collection(db,'users',user.uid,'pointsLog'),{type:'qod',points:10,date:todayStr(),createdAt:serverTimestamp()});
      showToast('+10 points! 🎉','success');
    }
  } catch(e) { console.error('QOD save error:',e); }
}

window.shareQOD = function() {
  const qText=document.getElementById('qodQuestion')?.textContent||'';
  const text=`🧠 Question of the Day — Nishchay Academy\n\n${qText}\n\nAttempt at: ${window.location.href}`;
  if(navigator.share) { navigator.share({title:'QOD — Nishchay Academy',text,url:window.location.href}); }
  else { navigator.clipboard?.writeText(text); showToast('Copied!','success'); }
};

// ============================================================
// DAILY QUIZ
// FIX: Quiz info ALWAYS visible. Starting the quiz requires
//      login only if loginRequired is true.
// ============================================================
async function loadDailyQuiz(user) {
  const section=document.getElementById('quizSection');
  const hubText=document.getElementById('hubQuizText');
  const hubStatus=document.getElementById('hubQuizStatus');
  try {
    const today=todayStr();
    const snap=await getDocs(query(collection(db,'dailyQuiz'),where('isActive','==',true),limit(10)));
    if(snap.empty) { if(hubText) hubText.textContent='No quiz today'; return; }
    let quiz=null;
    snap.forEach(d => { const data=d.data(); if(!quiz&&data.startDate<=today&&data.endDate>=today) quiz={id:d.id,...data}; });
    if(!quiz) { if(hubText) hubText.textContent='No quiz today'; return; }
    currentQuiz=quiz;

    let attempted=false;
    if(user) {
      const attSnap=await getDocs(query(collection(db,'dailyQuizAttempts'),where('userId','==',user.uid),where('quizId','==',quiz.id),limit(1)));
      attempted=!attSnap.empty;
    }

    if(hubText) hubText.textContent=(quiz.title||'Daily Quiz').substring(0,60);
    if(hubStatus) {
      if (attempted) hubStatus.textContent='✅ Completed';
      else if (!user && loginRequired) hubStatus.textContent='🔒 Login to attempt';
      else hubStatus.textContent=`${quiz.questionCount||0} Qs`;
    }

    if(section) section.style.display='block';
    const titleEl=document.getElementById('quizTitle'); const metaEl=document.getElementById('quizMeta'); const badgeEl=document.getElementById('quizBadge');
    if(titleEl) titleEl.textContent=quiz.title;
    if(metaEl)  metaEl.textContent=`${quiz.questionCount} Questions · ${quiz.difficulty||'Medium'}`;
    if(badgeEl) badgeEl.textContent=attempted?'✅ Done':'🟢 Active';

    const p=quiz.totalParticipants||0;
    const avg=p>0?Math.round((quiz.totalScore||0)/p):'-';
    const pEl=document.getElementById('quizParticipants'); const aEl=document.getElementById('quizAvgScore'); const dEl=document.getElementById('quizDifficulty');
    if(pEl) pEl.textContent=p; if(aEl) aEl.textContent=avg;
    if(dEl) dEl.textContent=(quiz.difficulty||'Medium')[0].toUpperCase()+(quiz.difficulty||'medium').slice(1);

    const btn = document.getElementById('quizAttemptBtn');
    if(attempted) {
      if(btn){btn.textContent='✅ Already Completed';btn.disabled=true;btn.style.opacity='0.6';}
    } else if (!user && loginRequired) {
      if(btn){btn.textContent='🔒 Login to Start Quiz';btn.disabled=false;btn.style.opacity='1';}
    }
  } catch(e) { console.error('Quiz load error:',e); if(hubText) hubText.textContent='Unavailable'; }
}

window.startDailyQuiz = async function() {
  // FIX: only block if loginRequired is true AND user is not logged in
  if (loginRequired && !currentUser) {
    showToast('Please login to attempt the quiz 🔒', 'info');
    return;
  }
  if(!currentQuiz) return;
  const ids=(currentQuiz.questionIds||[]).slice(0,20);
  if(!ids.length) { showToast('Quiz has no questions','info'); return; }

  quizQuestions=[]; quizIndex=0; quizAnswers=[]; quizScore=0;
  for(const id of ids) {
    const s=await getDoc(doc(db,'questions',id));
    if(s.exists()) quizQuestions.push({id:s.id,...s.data()});
  }
  if(!quizQuestions.length) { showToast('Could not load questions','error'); return; }

  const mt=document.getElementById('quizModalTitle'); const rs=document.getElementById('quizResultScreen'); const md=document.getElementById('quizModal');
  if(mt) mt.textContent=currentQuiz.title; if(rs) rs.style.display='none'; if(md) md.style.display='block';
  document.body.style.overflow='hidden';
  renderQuizQuestion();
};

function renderQuizQuestion() {
  const q=quizQuestions[quizIndex]; const tot=quizQuestions.length;
  const pt=document.getElementById('quizProgressText'); const pb=document.getElementById('quizProgressBar');
  const qEl=document.getElementById('quizModalQuestion'); const nb=document.getElementById('quizNextBtn');
  if(pt) pt.textContent=`Question ${quizIndex+1} of ${tot}`;
  if(pb) pb.style.width=`${(quizIndex/tot)*100}%`;
  if(qEl) qEl.textContent=getQText(q);
  if(nb) nb.style.display='none';

  const opts=getOpts(q);
  const correct=getCorrect(q);
  const el=document.getElementById('quizModalOptions');
  if(!el) return;
  el.innerHTML='';
  opts.forEach((opt,i) => {
    const btn=document.createElement('button');
    btn.textContent=String.fromCharCode(65+i)+'. '+opt;
    btn.style.cssText=`width:100%;padding:12px 14px;border-radius:10px;border:1.5px solid #e2e8f0;background:white;font-size:14px;font-weight:500;text-align:left;cursor:pointer;font-family:Inter,sans-serif;color:#1e293b;`;
    btn.onclick=()=>pickQuizAnswer(i,correct,el.querySelectorAll('button'));
    el.appendChild(btn);
  });
}

function pickQuizAnswer(sel,correct,btns) {
  const ok=sel===correct; if(ok) quizScore++;
  quizAnswers.push({questionId:quizQuestions[quizIndex].id,sel,correct,ok});
  btns.forEach((b,i)=>{b.disabled=true;if(i===correct){b.style.background='#dcfce7';b.style.borderColor='#16a34a';}else if(i===sel&&!ok){b.style.background='#fee2e2';b.style.borderColor='#dc2626';}});
  const nb=document.getElementById('quizNextBtn');
  if(nb){nb.style.display='block';nb.textContent=quizIndex<quizQuestions.length-1?'Next →':'Finish Quiz';}
}

window.nextQuizQuestion=function(){quizIndex++;if(quizIndex<quizQuestions.length)renderQuizQuestion();else finishQuiz();};

async function finishQuiz() {
  const tot=quizQuestions.length; const acc=Math.round((quizScore/tot)*100);
  const el1=document.getElementById('quizModalOptions'); const el2=document.getElementById('quizModalQuestion');
  const el3=document.getElementById('quizProgressText'); const el4=document.getElementById('quizProgressBar');
  const el5=document.getElementById('quizNextBtn'); const el6=document.getElementById('quizResultScreen');
  const el7=document.getElementById('quizResultScore'); const el8=document.getElementById('quizResultAccuracy');
  if(el1) el1.innerHTML=''; if(el2) el2.textContent=''; if(el3) el3.textContent='Complete!';
  if(el4) el4.style.width='100%'; if(el5) el5.style.display='none'; if(el6) el6.style.display='block';
  if(el7) el7.textContent=`${quizScore} / ${tot}`;
  if(el8) el8.textContent=`Accuracy: ${acc}% · ${acc>=70?'Great job! 🌟':'Keep practising! 💪'}`;

  // FIX: only save attempt/award points if user is actually logged in.
  // If loginRequired is OFF and user attempted without logging in,
  // they still see their result, but it's not saved to leaderboard.
  if(currentUser&&currentQuiz) {
    try {
      const answers={}; quizAnswers.forEach(a=>{answers[a.questionId]=a.sel;});
      await addDoc(collection(db,'dailyQuizAttempts'),{userId:currentUser.uid,quizId:currentQuiz.id,score:quizScore,totalQ:tot,accuracy:acc,answers,attemptedAt:serverTimestamp()});
      await updateDoc(doc(db,'dailyQuiz',currentQuiz.id),{totalParticipants:increment(1),totalScore:increment(quizScore)});
      await updateDoc(doc(db,'users',currentUser.uid),{totalPoints:increment(20),weeklyPoints:increment(20),monthlyPoints:increment(20)});
      await addDoc(collection(db,'users',currentUser.uid,'pointsLog'),{type:'quiz',points:20,date:todayStr(),createdAt:serverTimestamp()});
      const btn=document.getElementById('quizAttemptBtn'); const badge=document.getElementById('quizBadge'); const hs=document.getElementById('hubQuizStatus');
      if(btn){btn.textContent='✅ Already Completed';btn.disabled=true;btn.style.opacity='0.6';}
      if(badge) badge.textContent='✅ Done'; if(hs) hs.textContent='✅ Completed';
      showToast('+20 points for completing quiz! 🎉','success');
    } catch(e){console.error('Quiz save error:',e);}
  } else if (!currentUser) {
    // Anonymous attempt — show a gentle prompt to log in for points
    showToast('Login to save your score and earn points! 💡','info');
  }
}

window.closeQuizModal=function(){const md=document.getElementById('quizModal');if(md)md.style.display='none';document.body.style.overflow='';};
window.shareQuizResult=function(){const tot=quizQuestions.length;const acc=Math.round((quizScore/tot)*100);const text=`📝 Daily Quiz Result — Nishchay Academy\n\nScore: ${quizScore}/${tot} (${acc}%)\n${acc>=70?'🌟 Great job!':'💪 Keep practising!'}\n\nJoin at: ${window.location.origin}`;if(navigator.share){navigator.share({title:'Daily Quiz Result',text,url:window.location.origin});}else{navigator.clipboard?.writeText(text);showToast('Copied!','success');}};

// ============================================================
// TODAY IN HISTORY — always visible to everyone
// ============================================================
async function loadTodayInHistory() {
  const section=document.getElementById('historySection');
  const container=document.getElementById('historyContainer');
  const hubText=document.getElementById('hubHistoryText');
  const hubYear=document.getElementById('hubHistoryYear');
  try {
    const now=new Date();
    const snap=await getDocs(query(
      collection(db,'historyEvents'),
      where('month','==',now.getMonth()+1),
      where('day','==',now.getDate()),
      where('isActive','==',true)
    ));
    if(snap.empty) { if(hubText) hubText.textContent='No event today'; return; }

    const events=[];
    snap.forEach(d=>events.push({id:d.id,...d.data()}));
    events.sort((a,b)=>(a.year||0)-(b.year||0));

    const first=events[0];
    if(hubText) hubText.textContent=(first.title||'').substring(0,65)+((first.title||'').length>65?'...':'');
    if(hubYear) hubYear.textContent=first.year?`Year ${first.year}`:'';

    if(section) section.style.display='block';
    if(!container) return;

    container.innerHTML='';
    events.forEach((ev,idx)=>{
      const card=document.createElement('div');
      card.style.cssText=`background:white;border-radius:14px;overflow:hidden;border:1px solid var(--border);${idx>0?'margin-top:12px;':''}`;
      const subjectTag=ev.subject?`<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;background:#f3e8ff;color:#7c3aed;margin-left:6px;">${ev.subject}</span>`:'';
      const MONTHS=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const fullDate = `${ev.day} ${MONTHS[ev.month]} ${ev.year}`;
      card.innerHTML=`
        ${ev.imageUrl?`<img src="${ev.imageUrl}" style="width:100%;height:160px;object-fit:cover;"/>`:''}
        <div style="padding:14px;">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;background:#fef3c7;color:#d97706;">📅 ${fullDate}</span>
            ${subjectTag}
          </div>
          <p style="font-size:15px;font-weight:700;margin-bottom:6px;">${ev.title}</p>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-bottom:12px;">${ev.description}</p>
          <button onclick="shareHistoryEvent('${ev.id}')"
            style="width:100%;padding:10px;border-radius:10px;border:1.5px solid var(--border);background:white;font-size:13px;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;">
            📤 Share This Event
          </button>
        </div>`;
      container.appendChild(card);
    });
    window._historyEvents=events;
  } catch(e) {
    console.error('History error:',e);
    if(hubText) hubText.textContent='Unavailable';
  }
}

window.shareHistoryEvent=function(eventId){
  const ev=(window._historyEvents||[]).find(e=>e.id===eventId);
  if(!ev) return;
  const text=`📅 Today in History — ${ev.year}\n\n${ev.title}\n\n${ev.description}\n\nLearn more at Nishchay Academy: ${window.location.origin}`;
  if(navigator.share){navigator.share({title:'Today in History',text,url:window.location.origin});}
  else{navigator.clipboard?.writeText(text);showToast('Copied to clipboard!','success');}
};

// ============================================================
// LEADERBOARD PREVIEW — always visible to everyone
// ============================================================
async function loadLeaderboardPreview() {
  const el=document.getElementById('hubLeaderPreview');
  try {
    const snap=await getDocs(query(collection(db,'leaderboard'),orderBy('weeklyPoints','desc'),limit(3)));
    if(snap.empty){if(el)el.textContent='No rankings yet';return;}
    const medals=['🥇','🥈','🥉'];let html='';let i=0;
    snap.forEach(d=>{const data=d.data();html+=`<div>${medals[i]} ${(data.fullName||'Student').split(' ')[0]} — ${data.weeklyPoints||0} pts</div>`;i++;});
    if(el)el.innerHTML=html;
  }catch(e){if(el)el.textContent='See rankings →';}
}

window.showToast=function(msg,type='info'){const c=document.getElementById('toastContainer');if(!c)return;const t=document.createElement('div');t.className=`toast toast-${type}`;t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),3000);};
