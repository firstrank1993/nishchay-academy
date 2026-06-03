// ============================================
// NISHCHAY ACADEMY — Admin: Daily Quiz
// ============================================
import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, addDoc, deleteDoc, updateDoc,
  doc, serverTimestamp, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let subjectsCache = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  document.getElementById('adminEmail').textContent = user.email;
  await loadSubjects();
  await loadQuizzes();
});

async function loadSubjects() {
  const snap = await getDocs(collection(db, 'subjects'));
  subjectsCache = [];
  snap.forEach(d => subjectsCache.push({ id: d.id, ...d.data() }));
  subjectsCache.sort((a, b) => (a.order || 0) - (b.order || 0));
  const sel = document.getElementById('quizSubject');
  subjectsCache.forEach(s => {
    sel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
}

async function loadQuizzes() {
  const loader = document.getElementById('quizLoader');
  const list   = document.getElementById('quizList');
  const empty  = document.getElementById('quizEmpty');
  try {
    const snap = await getDocs(query(collection(db, 'dailyQuiz'), orderBy('startDate', 'desc')));
    loader.style.display = 'none';
    if (snap.empty) { empty.style.display = 'block'; return; }

    list.innerHTML = '';
    snap.forEach(d => {
      const q    = { id: d.id, ...d.data() };
      const subj = subjectsCache.find(s => s.id === q.subject)?.name || q.subject || 'All Subjects';
      const participants = q.totalParticipants || 0;
      const avgScore = participants > 0 ? Math.round((q.totalScore || 0) / participants) : 0;

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">
          <p style="font-size:15px;font-weight:700;">${q.title}</p>
          <span style="font-size:11px;padding:3px 8px;border-radius:99px;font-weight:700;flex-shrink:0;
            background:${q.isActive !== false ? '#dcfce7' : '#fee2e2'};
            color:${q.isActive !== false ? '#15803d' : '#dc2626'};">
            ${q.isActive !== false ? '✅ Active' : '❌ Inactive'}
          </span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
          <span style="font-size:11px;padding:3px 8px;border-radius:99px;
            background:#e0f2fe;color:#0369a1;font-weight:600;">📅 ${q.startDate} → ${q.endDate}</span>
          <span style="font-size:11px;padding:3px 8px;border-radius:99px;
            background:#f3e8ff;color:#7c3aed;font-weight:600;">📚 ${subj}</span>
          <span style="font-size:11px;padding:3px 8px;border-radius:99px;
            background:#fef9c3;color:#854d0e;font-weight:600;">
            ${q.difficulty || 'medium'} · ${q.questionCount} Qs</span>
        </div>
        <div style="display:flex;gap:16px;padding:10px;background:var(--bg);
                    border-radius:var(--radius-sm);margin-bottom:12px;">
          <div style="text-align:center;flex:1;">
            <div style="font-size:18px;font-weight:800;color:var(--primary);">${participants}</div>
            <div style="font-size:10px;color:var(--text-secondary);">Participants</div>
          </div>
          <div style="text-align:center;flex:1;">
            <div style="font-size:18px;font-weight:800;color:var(--success);">${avgScore}</div>
            <div style="font-size:10px;color:var(--text-secondary);">Avg Score</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="toggleQuiz('${q.id}', ${q.isActive !== false})"
            class="btn btn-sm" style="flex:1;
              background:${q.isActive !== false ? '#fee2e2' : '#dcfce7'};
              color:${q.isActive !== false ? '#dc2626' : '#15803d'};border:none;">
            ${q.isActive !== false ? '⏸ Deactivate' : '▶ Activate'}
          </button>
          <button onclick="deleteQuiz('${q.id}')"
            class="btn btn-sm" style="background:#fee2e2;color:#dc2626;border:none;">
            🗑 Delete
          </button>
        </div>
      `;
      list.appendChild(card);
    });
    list.style.display = 'flex';
  } catch(e) {
    console.error(e);
    loader.style.display = 'none';
    showToast('Error loading quizzes', 'error');
  }
}

window.createQuiz = async function() {
  const title      = document.getElementById('quizTitle').value.trim();
  const startDate  = document.getElementById('quizStart').value;
  const endDate    = document.getElementById('quizEnd').value;
  const subjectId  = document.getElementById('quizSubject').value;
  const difficulty = document.getElementById('quizDifficulty').value;
  const count      = parseInt(document.getElementById('quizCount').value) || 10;

  if (!title)     { showToast('Please enter a title', 'error'); return; }
  if (!startDate) { showToast('Please select a start date', 'error'); return; }
  if (!endDate)   { showToast('Please select an end date', 'error'); return; }
  if (endDate < startDate) { showToast('End date must be after start date', 'error'); return; }

  const btn = document.querySelector('button[onclick="createQuiz()"]');
  btn.textContent = 'Creating...'; btn.disabled = true;

  try {
    // Pull random questions from question bank
    let qQuery;
    if (subjectId) {
      qQuery = query(collection(db, 'questions'), where('subjectId', '==', subjectId));
    } else {
      qQuery = query(collection(db, 'questions'));
    }
    const qSnap = await getDocs(qQuery);
    const allIds = [];
    qSnap.forEach(d => allIds.push(d.id));

    if (allIds.length === 0) {
      showToast('No questions found for the selected subject', 'error');
      btn.textContent = 'Create Daily Quiz'; btn.disabled = false;
      return;
    }

    // Shuffle and pick
    const shuffled = allIds.sort(() => Math.random() - 0.5);
    const questionIds = shuffled.slice(0, Math.min(count, shuffled.length));

    await addDoc(collection(db, 'dailyQuiz'), {
      title, startDate, endDate, difficulty,
      subject: subjectId || null,
      questionIds,
      questionCount: questionIds.length,
      isActive: true,
      totalParticipants: 0,
      totalScore: 0,
      createdAt: serverTimestamp()
    });

    ['quizTitle','quizStart','quizEnd'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('quizSubject').value     = '';
    document.getElementById('quizDifficulty').value  = 'medium';
    document.getElementById('quizCount').value       = '10';

    showToast(`Quiz created with ${questionIds.length} questions! ✅`, 'success');
    document.getElementById('quizList').style.display   = 'none';
    document.getElementById('quizLoader').style.display = 'block';
    await loadQuizzes();
  } catch(e) {
    console.error(e); showToast('Error creating quiz', 'error');
  } finally {
    btn.textContent = 'Create Daily Quiz'; btn.disabled = false;
  }
};

window.toggleQuiz = async function(id, current) {
  try {
    await updateDoc(doc(db, 'dailyQuiz', id), { isActive: !current });
    showToast(current ? 'Deactivated' : 'Activated ✅', current ? 'info' : 'success');
    document.getElementById('quizList').style.display   = 'none';
    document.getElementById('quizLoader').style.display = 'block';
    await loadQuizzes();
  } catch(e) { showToast('Error', 'error'); }
};

window.deleteQuiz = async function(id) {
  if (!confirm('Delete this quiz? Student attempt records will remain.')) return;
  try {
    await deleteDoc(doc(db, 'dailyQuiz', id));
    showToast('Deleted', 'info');
    document.getElementById('quizList').style.display   = 'none';
    document.getElementById('quizLoader').style.display = 'block';
    await loadQuizzes();
  } catch(e) { showToast('Error deleting', 'error'); }
};

window.showToast = function(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`; t.textContent = msg;
  c.appendChild(t); setTimeout(() => t.remove(), 3000);
};
