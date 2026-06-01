// ============================================
// NISHCHAY ACADEMY — Home Page JS
// ============================================
// NOTE: showToast is defined in auth.js which
// loads before this file. Do NOT redefine it here.
// ============================================

import { db } from './firebase-config.js';
import {
  collection, getDocs, query, where,
  limit, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── STATE ──
let currentLang  = localStorage.getItem('na_lang') || 'en';
let qotdData     = null;
let qotdAnswered = false;
let dquizConfig  = null;
let motivationData = null;
let caArticles   = [];
let histItems    = [];

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  setHeaderDate();
  applyLang(currentLang);
  setGreeting();
  loadAll();
});

// ── DATE ──
function setHeaderDate() {
  const el = document.getElementById('headerDate');
  if (!el) return;
  const opts = { weekday:'short', day:'numeric', month:'short', year:'numeric' };
  el.textContent = new Date().toLocaleDateString('en-IN', opts);
}

// ── GREETING ──
function setGreeting() {
  const el = document.getElementById('xpGreeting');
  if (!el) return;
  const h = new Date().getHours();
  el.textContent = h < 12 ? 'Good Morning 👋'
                 : h < 17 ? 'Good Afternoon 👋'
                 : 'Good Evening 👋';
}

// ── LANG TOGGLE ──
window.setLang = function(lang) {
  currentLang = lang;
  localStorage.setItem('na_lang', lang);
  applyLang(lang);
  if (qotdData)       renderQOTD();
  if (motivationData) renderMotivation();
  if (caArticles.length) renderCA();
  if (histItems.length)  renderHistory();
};

function applyLang(lang) {
  const en = document.getElementById('langBtnEn');
  const gu = document.getElementById('langBtnGu');
  if (en) en.className = 'lang-toggle-btn' + (lang === 'en' ? ' active' : '');
  if (gu) gu.className = 'lang-toggle-btn' + (lang === 'gu' ? ' active' : '');
}

// ── HELPERS ──
function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function safeSet(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function safeHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

// ── LOAD ALL IN PARALLEL ──
function loadAll() {
  Promise.allSettled([
    loadXPStats(),
    loadQOTD(),
    loadCurrentAffairs(),
    loadHistory(),
    loadDailyQuizConfig(),
    loadMotivation(),
    loadExamBodies()
  ]);
}

// ════════════════════════════════════════════
// 1. XP STATS — localStorage only, zero Firestore cost
// ════════════════════════════════════════════
function loadXPStats() {
  const solved   = parseInt(localStorage.getItem('na_solved')  || '0');
  const correct  = parseInt(localStorage.getItem('na_correct') || '0');
  const streak   = parseInt(localStorage.getItem('na_streak')  || '0');
  const xp       = solved * 10 + correct * 5;
  const accuracy = solved > 0 ? Math.round((correct / solved) * 100) + '%' : '—';

  const level   = Math.floor(xp / 500) + 1;
  const levelXP = xp % 500;
  const pct     = Math.min((levelXP / 500) * 100, 100);
  const levels  = ['Beginner','Learner','Challenger','Expert','Master','Champion'];
  const lName   = levels[Math.min(level - 1, levels.length - 1)];

  const lvlEl = document.querySelector('.xp-level');
  if (lvlEl) lvlEl.textContent = `Level ${level} — ${lName} ⚡`;

  const xpPts = document.getElementById('xpPoints');
  if (xpPts) xpPts.textContent = xp.toLocaleString();

  const bar = document.getElementById('xpBar');
  if (bar) bar.style.width = pct + '%';

  safeSet('statSolved',   solved   || '—');
  safeSet('statAccuracy', accuracy);
  safeSet('statStreak',   streak   || '—');
  safeSet('statRank',     '#—');

  const badge = document.getElementById('streakBadge');
  if (badge) badge.textContent = `🔥 ${streak || 0}`;
}

// ════════════════════════════════════════════
// 2. QOTD
// ════════════════════════════════════════════
async function loadQOTD() {
  try {
    const snap = await getDocs(query(
      collection(db, 'questionOfTheDay'),
      where('date', '==', getTodayStr()),
      limit(1)
    ));

    if (snap.empty) {
      safeSet('qotdQuestion', 'No question set for today. Check back later!');
      safeHtml('qotdOptions', '');
      const badge = document.getElementById('qotdBadge');
      if (badge) badge.style.display = 'none';
      return;
    }

    snap.forEach(d => { qotdData = { id: d.id, ...d.data() }; });
    renderQOTD();
  } catch(e) {
    safeSet('qotdQuestion', 'Could not load. Please refresh.');
    console.error('QOTD error:', e);
  }
}

function renderQOTD() {
  if (!qotdData) return;
  const q    = qotdData;
  const lang = currentLang;
  const question    = (lang === 'gu' && q.questionGu) ? q.questionGu : (q.questionEn || '');
  const explanation = (lang === 'gu' && q.explanationGu) ? q.explanationGu : (q.explanationEn || '');
  const enKeys = ['optA_en','optB_en','optC_en','optD_en'];
  const guKeys = ['optA_gu','optB_gu','optC_gu','optD_gu'];
  const labels = ['A','B','C','D'];

  safeSet('qotdQuestion', question);
  safeSet('qotdSubLabel', (q.subject || 'General Knowledge') + ' · Today');

  const saved = localStorage.getItem('qotd_' + getTodayStr());
  qotdAnswered = saved !== null;

  const optContainer = document.getElementById('qotdOptions');
  if (optContainer) {
    optContainer.innerHTML = enKeys.map((key, i) => {
      const enVal = q[key] || '';
      const guVal = q[guKeys[i]] || '';
      const text  = (lang === 'gu' && guVal) ? guVal : enVal;
      if (!text) return '';
      let cls = 'quiz-opt-btn';
      if (qotdAnswered) {
        cls += ' revealed';
        if (i === q.correctIndex)       cls += ' correct';
        else if (parseInt(saved) === i) cls += ' wrong';
      }
      return `<button class="${cls}" onclick="answerQOTD(${i})">
        <span class="opt-circle">${labels[i]}</span>${text}
      </button>`;
    }).join('');
  }

  if (qotdAnswered) {
    const badge = document.getElementById('qotdBadge');
    if (badge) { badge.textContent = '✓ Answered'; badge.style.cursor = 'default'; }
    if (explanation) {
      const explain = document.getElementById('qotdExplain');
      const text    = document.getElementById('qotdExplainText');
      if (explain) explain.style.display = 'block';
      if (text)    text.textContent = explanation;
    }
  }
}

window.revealQOTD = function() {
  if (qotdAnswered) return;
  document.querySelectorAll('.quiz-opt-btn').forEach(b => {
    b.style.borderColor = 'var(--primary)';
    setTimeout(() => { b.style.borderColor = ''; }, 600);
  });
};

window.answerQOTD = function(idx) {
  if (qotdAnswered || !qotdData) return;
  qotdAnswered = true;
  localStorage.setItem('qotd_' + getTodayStr(), idx.toString());

  // Update XP
  const solved  = parseInt(localStorage.getItem('na_solved')  || '0') + 1;
  const correct = parseInt(localStorage.getItem('na_correct') || '0')
                + (idx === qotdData.correctIndex ? 1 : 0);
  localStorage.setItem('na_solved',  solved);
  localStorage.setItem('na_correct', correct);
  loadXPStats();
  renderQOTD();

  const ok = idx === qotdData.correctIndex;
  // Use auth.js showToast — it's already on window
  if (typeof window.showToast === 'function') {
    window.showToast(
      ok ? '✅ Correct! Well done!' : '❌ Wrong! See the explanation.',
      ok ? 'success' : 'error'
    );
  }
};

// ════════════════════════════════════════════
// 3. CURRENT AFFAIRS
// — No orderBy on 'category' to avoid needing
//   a composite Firestore index
// ════════════════════════════════════════════
const catInfo = {
  polity:        { label:'Polity',        color:'#1E40AF', bg:'#EFF6FF' },
  economy:       { label:'Economy',       color:'#15803d', bg:'#F0FDF4' },
  environment:   { label:'Environment',   color:'#166534', bg:'#DCFCE7' },
  science:       { label:'Science',       color:'#6D28D9', bg:'#F5F3FF' },
  international: { label:'International', color:'#0891B2', bg:'#E0F2FE' },
  schemes:       { label:'Schemes',       color:'#D97706', bg:'#FEF3C7' },
  geography:     { label:'Geography',     color:'#DC2626', bg:'#FEE2E2' },
  sports:        { label:'Sports',        color:'#DB2777', bg:'#FCE7F3' },
  gujarat:       { label:'Gujarat',       color:'#EA580C', bg:'#FFF7ED' },
  awards:        { label:'Awards',        color:'#CA8A04', bg:'#FEFCE8' },
  general:       { label:'General',       color:'#64748B', bg:'#F1F5F9' }
};

async function loadCurrentAffairs() {
  try {
    // Simple query — only where clause, no orderBy → no composite index needed
    const snap = await getDocs(query(
      collection(db, 'dailyCurrentAffairs'),
      where('date', '==', getTodayStr()),
      limit(10)
    ));
    caArticles = [];
    snap.forEach(d => caArticles.push({ id: d.id, ...d.data() }));
    renderCA();
  } catch(e) {
    safeHtml('caList',
      '<p style="font-size:12px;color:var(--text-secondary);padding:6px 0;">Could not load.</p>');
    console.error('CA error:', e);
  }
}

function renderCA() {
  const list = document.getElementById('caList');
  if (!list) return;
  const lang = currentLang;

  if (!caArticles.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--text-secondary);padding:6px 0;">No articles today. Check back later.</p>';
    safeSet('caSubLabel', 'No articles today');
    return;
  }

  safeSet('caSubLabel',
    `${caArticles.length} article${caArticles.length !== 1 ? 's' : ''} · Today`);

  list.innerHTML = caArticles.slice(0, 3).map((a, i) => {
    const title = (lang === 'gu' && a.titleGu) ? a.titleGu : (a.titleEn || '');
    const cat   = catInfo[a.category] || catInfo.general;
    return `<div class="ca-item">
      <span class="ca-cat-pill" style="background:${cat.bg};color:${cat.color};">${cat.label}</span>
      <span class="ca-title">${title}</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="2.5"
        style="flex-shrink:0;margin-top:2px;"><polyline points="9,18 15,12 9,6"/></svg>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════
// 4. TODAY IN HISTORY
// — Two where clauses on same collection is fine,
//   no orderBy so no composite index needed
// ════════════════════════════════════════════
async function loadHistory() {
  try {
    const now   = new Date();
    const month = now.getMonth() + 1;
    const day   = now.getDate();

    const snap = await getDocs(query(
      collection(db, 'todayInHistory'),
      where('month', '==', month),
      where('day',   '==', day),
      limit(5)
    ));
    histItems = [];
    snap.forEach(d => histItems.push({ id: d.id, ...d.data() }));
    // Sort by year descending client-side — avoids needing a composite index
    histItems.sort((a, b) => (b.year || 0) - (a.year || 0));
    renderHistory();
  } catch(e) {
    safeHtml('histList',
      '<p style="font-size:12px;color:var(--text-secondary);padding:6px 0;">Could not load.</p>');
    console.error('History error:', e);
  }
}

function renderHistory() {
  const list = document.getElementById('histList');
  if (!list) return;
  const lang = currentLang;
  const now  = new Date();
  safeSet('histSubLabel',
    `On this day — ${now.getDate()} ${now.toLocaleString('en-IN', { month:'long' })}`);

  if (!histItems.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--text-secondary);padding:6px 0;">No events found for today.</p>';
    return;
  }

  list.innerHTML = histItems.slice(0, 3).map(h => {
    const title = (lang === 'gu' && h.titleGu) ? h.titleGu : (h.titleEn || '');
    return `<div class="hist-item">
      <span class="hist-year">${h.year || '?'}</span>
      <span class="hist-text">${title}</span>
      ${h.category ? `<span class="hist-tag">${h.category}</span>` : ''}
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════
// 5. DAILY QUIZ CONFIG
// ════════════════════════════════════════════
async function loadDailyQuizConfig() {
  try {
    const snap = await getDocs(query(
      collection(db, 'dailyQuiz'),
      where('date', '==', getTodayStr()),
      limit(1)
    ));

    if (snap.empty) {
      safeSet('dquizSubLabel', 'Auto-picked · Tap Start');
      safeSet('dquizPreviewQ',
        "Today's quiz is auto-picked from the question bank. Tap Start to begin!");
      dquizConfig = { mode: 'auto', date: getTodayStr() };
      return;
    }

    snap.forEach(d => { dquizConfig = { id: d.id, ...d.data() }; });
    const c = dquizConfig;

    // Get subject name
    let subjectLabel = c.subjectName || 'Mixed';
    if (c.subjectId && !c.subjectName) {
      try {
        const sDoc = await getDoc(doc(db, 'subjects', c.subjectId));
        if (sDoc.exists()) subjectLabel = sDoc.data().name || subjectLabel;
      } catch(_) {}
    }

    const qCount = c.questionIds?.length || c.questionCount || '—';
    safeSet('dquizSubLabel', `${subjectLabel} · ${qCount} Questions`);
    safeSet('dquizPreviewQ',
      c.description ||
      `Today's quiz: ${qCount} questions from ${subjectLabel}. Tap Start when ready!`);
  } catch(e) {
    safeSet('dquizSubLabel', 'Tap Start to begin');
    console.error('Quiz config error:', e);
  }
}

// FIX: points to daily-updates.html until daily-quiz.html is built
window.startDailyQuiz = function() {
  window.location.href = 'daily-updates.html?sec=dailyQuiz';
};

// ════════════════════════════════════════════
// 6. MOTIVATION QUOTE
// ════════════════════════════════════════════
async function loadMotivation() {
  try {
    const today = getTodayStr();

    // 1. Try exact date match first
    let snap = await getDocs(query(
      collection(db, 'motivationQuotes'),
      where('date', '==', today),
      limit(1)
    ));

    if (!snap.empty) {
      snap.forEach(d => { motivationData = { id: d.id, ...d.data() }; });
    } else {
      // 2. Fallback: load pool (no date set), pick by day of year
      const poolSnap = await getDocs(query(
        collection(db, 'motivationQuotes'),
        limit(100)
      ));
      const pool = [];
      poolSnap.forEach(d => {
        const data = d.data();
        if (!data.date) pool.push({ id: d.id, ...data });
      });
      if (pool.length) {
        const doy = Math.floor(
          (new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
        );
        motivationData = pool[doy % pool.length];
      }
    }

    renderMotivation();
  } catch(e) {
    safeSet('motivationQuote', '"Believe in yourself. Keep going. 💪"');
    console.error('Motivation error:', e);
  }
}

function renderMotivation() {
  const m    = motivationData;
  const lang = currentLang;
  if (!m) {
    safeSet('motivationQuote', '"Believe in yourself. Keep going. 💪"');
    return;
  }
  const quote  = (lang === 'gu' && m.quoteGu)  ? m.quoteGu  : (m.quoteEn  || '');
  const author = (lang === 'gu' && m.authorGu) ? m.authorGu : (m.authorEn || '');
  safeSet('motivationQuote',  `"${quote}"`);
  safeSet('motivationAuthor', author ? `— ${author}` : '');
}

// ════════════════════════════════════════════
// 7. EXAM BODIES — identical logic to original
// ════════════════════════════════════════════
async function loadExamBodies() {
  const skeletonLoader = document.getElementById('skeletonLoader');
  const examBodiesList = document.getElementById('examBodiesList');
  const emptyState     = document.getElementById('emptyState');

  try {
    const snapshot = await getDocs(collection(db, 'examBodies'));

    if (skeletonLoader) skeletonLoader.style.display = 'none';

    if (snapshot.empty) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    const examBodies = [];
    snapshot.forEach(d => examBodies.push({ id: d.id, ...d.data() }));
    examBodies.sort((a, b) => (a.order || 0) - (b.order || 0));

    let html = '';
    examBodies.forEach(data => {
      if (data.isActive === false) return;
      const initials = data.name.length <= 5
        ? data.name.toUpperCase()
        : data.name.substring(0, 4).toUpperCase();
      html += `
        <div class="exam-body-card card-clickable"
          onclick="window.location.href='exam.html?bodyId=${data.id}&bodyName=${encodeURIComponent(data.name)}'">
          <div class="exam-body-icon">${initials}</div>
          <div class="exam-body-info">
            <h3>${data.name}</h3>
            <p>${data.description || 'Click to see exams'}</p>
          </div>
          <svg class="exam-body-arrow" width="20" height="20" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </div>`;
    });

    if (!html) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (examBodiesList) {
      examBodiesList.innerHTML = html;
      examBodiesList.style.display = 'flex';
    }
  } catch(e) {
    if (skeletonLoader) skeletonLoader.style.display = 'none';
    if (emptyState)     emptyState.style.display = 'block';
    console.error('Exam bodies error:', e);
  }
}

