import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

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
  subjectsCache.forEach(s => { sel.innerHTML += `<option value="${s.id}">${s.name}</option>`; });
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
      const q = { id: d.id, ...d.data() };
      const subj = subjectsCache.find(s => s.id === q.subject)?.name || q.subject || 'All Subjects';
      const isActive = q.isActive !== false;
      const p   = q.totalParticipants || 0;
      const avg = p > 0 ? Math.round((q.totalScore || 0) / p) : 0;
      const card = document.createElement('div'); card.className = 'card';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:10px;">
          <p style="font-size:15px;font-weight:700;">${q.title}</p>
          <span style="font-size:11px;padding:3px 8px;border-radius:99px;font-weight:700;flex-shrink:0;background:${isActive?'#dcfce7':'#fee2e2'};color:${isActive?'#15803d':'#dc2626'};">${isActive?'✅ Active':'❌ Inactive'}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
          <span style="font-size:11px;padding:3px 8px;border-radius:99px;background:#e0f2fe;color:#0369a1;font-weight:600;">📅 ${q.startDate} → ${q.endDate}</span>
          <span style="font-size:11px;padding:3px 8px;border-radius:99px;background:#f3e8ff;color:#7c3aed;font-weight:600;">📚 ${subj}</span>
          <span style="font-size:11px;padding:3px 8px;border-radius:99px;background:#fef9c3;color:#854d0e;font-weight:600;">${q.difficulty||'medium'} · ${q.questionCount} Qs</span>
        </div>
        <div style="display:flex;gap:0;margin-bottom:12px;background:var(--bg);border-radius:8px;overflow:hidden;">
          <div style="flex:1;text-align:center;padding:8px;border-right:1px solid var(--border);">
            <div style="font-size:18px;font-weight:800;color:var(--primary);">${p}</div>
            <div style="font-size:10px;color:var(--text-secondary);">Participants</div>
          </div>
          <div style="flex:1;text-align:center;padding:8px;">
            <div style="font-size:18px;font-weight:800;color:var(--success);">${avg}</div>
            <div style="font-size:10px;color:var(--text-secondary);">Avg Score</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="toggleQuiz('${q.id}',${isActive})" class="btn btn-sm" style="flex:1;border:none;background:${isActive?'#fee2e2':'#dcfce7'};color:${isActive?'#dc2626':'#15803d'};">${isActive?'⏸ Deactivate':'▶ Activate'}</button>
          <button onclick="deleteQuiz('${q.id}')" class="btn btn-sm" style="background:#fee2e2;color:#dc2626;border:none;">🗑 Delete</button>
        </div>`;
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
  if (!startDate) { showToast('Please select start date', 'error'); return; }
  if (!endDate)   { showToast('Please select end date', 'error'); return; }
  if (endDate < startDate) { showToast('End date must be after start date', 'error'); return; }
  const btn = document.querySelector('button[onclick="createQuiz()"]');
  btn.textContent = 'Creating...'; btn.disabled = true;
  try {
    const qQuery = subjectId
      ? query(collection(db,'questions'), where('subjectId','==',subjectId))
      : query(collection(db,'questions'));
    const qSnap = await getDocs(qQuery);
    const allIds = [];
    qSnap.forEach(d => allIds.push(d.id));
    if (!allIds.length) { showToast('No questions found for selected subject', 'error'); btn.textContent='Create Quiz'; btn.disabled=false; return; }
    const shuffled    = allIds.sort(() => Math.random() - 0.5);
    const questionIds = shuffled.slice(0, Math.min(count, shuffled.length));
    await addDoc(collection(db,'dailyQuiz'), {
      title, startDate, endDate, difficulty,
      subject: subjectId || null,
      questionIds, questionCount: questionIds.length,
      isActive: true, totalParticipants: 0, totalScore: 0,
      createdAt: serverTimestamp()
    });
    ['quizTitle','quizStart','quizEnd'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('quizSubject').value    = '';
    document.getElementById('quizDifficulty').value = 'medium';
    document.getElementById('quizCount').value      = '10';
    showToast(`Quiz created with ${questionIds.length} questions! ✅`, 'success');
    document.getElementById('quizList').style.display   = 'none';
    document.getElementById('quizLoader').style.display = 'block';
    await loadQuizzes();
  } catch(e) { console.error(e); showToast('Error creating quiz', 'error'); }
  finally { btn.textContent = 'Create Quiz'; btn.disabled = false; }
};

// ── EXCEL BULK UPLOAD ──
window.downloadQuizTemplate = function() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['Question Text','Option A','Option B','Option C','Option D','Correct Option (0=A,1=B,2=C,3=D)','Subject ID (optional)','Difficulty (easy/medium/hard)'],
    ['What is the capital of Gujarat?','Surat','Ahmedabad','Gandhinagar','Vadodara',2,'','medium']
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Quiz Questions');
  XLSX.writeFile(wb, 'quiz-questions-template.xlsx');
};

window.bulkUploadQuiz = async function(event) {
  const file = event.target.files[0]; if (!file) return;
  const title     = document.getElementById('quizTitle').value.trim();
  const startDate = document.getElementById('quizStart').value;
  const endDate   = document.getElementById('quizEnd').value;
  if (!title || !startDate || !endDate) { showToast('Fill title, start date and end date before uploading', 'error'); event.target.value=''; return; }

  const status = document.getElementById('bulkQuizStatus');
  status.style.display = 'block'; status.style.background = '#fef9c3'; status.style.color = '#854d0e';
  status.textContent = 'Reading file...';
  try {
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    const questionIds = [];
    let success = 0, failed = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]; if (!row || row.length < 6) continue;
      try {
        const questionText   = String(row[0]||'').trim();
        const options        = [String(row[1]||''), String(row[2]||''), String(row[3]||''), String(row[4]||'')];
        const correctOption  = parseInt(row[5]) || 0;
        const subjectId      = String(row[6]||'').trim() || null;
        const difficulty     = String(row[7]||'medium').trim();
        if (!questionText || options.filter(o=>o).length < 2) { failed++; continue; }
        const ref = await addDoc(collection(db,'questions'), {
          questionText, options, correctOption,
          subjectId, difficulty, type: 'PRACTICE',
          isActive: true, createdAt: serverTimestamp()
        });
        questionIds.push(ref.id);
        success++;
        if (success % 5 === 0) status.textContent = `Uploading... ${success} questions done`;
      } catch(e) { failed++; }
    }
    if (!questionIds.length) { status.style.background='#fee2e2'; status.style.color='#dc2626'; status.textContent='No valid questions found in file.'; event.target.value=''; return; }
    const diff = document.getElementById('quizDifficulty').value;
    await addDoc(collection(db,'dailyQuiz'), {
      title, startDate, endDate, difficulty: diff,
      subject: null, questionIds,
      questionCount: questionIds.length,
      isActive: true, totalParticipants: 0, totalScore: 0,
      createdAt: serverTimestamp()
    });
    status.style.background = '#dcfce7'; status.style.color = '#15803d';
    status.textContent = `✅ Quiz created with ${questionIds.length} questions!${failed>0?' '+failed+' rows failed.':''}`;
    ['quizTitle','quizStart','quizEnd'].forEach(id => { document.getElementById(id).value=''; });
    document.getElementById('quizList').style.display   = 'none';
    document.getElementById('quizLoader').style.display = 'block';
    await loadQuizzes();
  } catch(e) { status.style.background='#fee2e2'; status.style.color='#dc2626'; status.textContent='Error reading file.'; console.error(e); }
  event.target.value = '';
};

window.toggleQuiz = async function(id, current) {
  try { await updateDoc(doc(db,'dailyQuiz',id),{isActive:!current}); showToast(current?'Deactivated':'Activated ✅',current?'info':'success'); document.getElementById('quizList').style.display='none'; document.getElementById('quizLoader').style.display='block'; await loadQuizzes(); } catch(e) { showToast('Error','error'); }
};
window.deleteQuiz = async function(id) {
  if (!confirm('Delete quiz? Attempt records remain.')) return;
  try { await deleteDoc(doc(db,'dailyQuiz',id)); showToast('Deleted','info'); document.getElementById('quizList').style.display='none'; document.getElementById('quizLoader').style.display='block'; await loadQuizzes(); } catch(e) { showToast('Error','error'); }
};
window.showToast = function(msg, type='info') { const c=document.getElementById('toastContainer'); const t=document.createElement('div'); t.className=`toast toast-${type}`; t.textContent=msg; c.appendChild(t); setTimeout(()=>t.remove(),3000); };
