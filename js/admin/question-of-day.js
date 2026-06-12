import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, where, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  document.getElementById('adminEmail').textContent = user.email;
  // Set today as default date for both tabs
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('qodDate').value    = today;
  document.getElementById('manualDate').value = today;
  await loadAutoRotateStatus();
  await loadQODs();
});

// ── TAB SWITCHER ──
window.showTab = function(tab) {
  const bankBtn  = document.getElementById('tabBankBtn');
  const writeBtn = document.getElementById('tabWriteBtn');
  const bankDiv  = document.getElementById('tabBank');
  const writeDiv = document.getElementById('tabWrite');
  const ON  = 'background:var(--primary);color:white;font-weight:700;';
  const OFF = 'background:transparent;color:var(--text-secondary);font-weight:600;';
  const BASE = 'flex:1;padding:8px 4px;border:none;border-radius:var(--radius-sm);font-size:13px;cursor:pointer;font-family:Inter,sans-serif;';

  if (tab === 'bank') {
    bankBtn.style.cssText  = BASE + ON;
    writeBtn.style.cssText = BASE + OFF;
    bankDiv.style.display  = 'block';
    writeDiv.style.display = 'none';
  } else {
    writeBtn.style.cssText = BASE + ON;
    bankBtn.style.cssText  = BASE + OFF;
    writeDiv.style.display = 'block';
    bankDiv.style.display  = 'none';
  }
};

// ── AUTO ROTATE ──
async function loadAutoRotateStatus() {
  try {
    const snap = await getDocs(query(
      collection(db,'questionOfDay'),
      where('activeDate','==','auto'),
      limit(1)
    ));
    const enabled = !snap.empty && snap.docs[0].data().isActive !== false;
    setToggleUI(enabled);
  } catch(e) { setToggleUI(false); }
}

function setToggleUI(enabled) {
  const track = document.getElementById('autoRotateTrack');
  const dot   = document.getElementById('autoRotateDot');
  const label = document.getElementById('autoRotateLabel');
  if(track) track.style.background = enabled ? 'var(--primary)' : '#CBD5E1';
  if(dot)   dot.style.left         = enabled ? '27px' : '3px';
  if(label) label.textContent      = enabled
    ? '✅ Auto-Rotate is ON — random question shown daily'
    : '❌ Auto-Rotate is OFF';
}

window.toggleAutoRotate = async function() {
  try {
    const snap = await getDocs(query(
      collection(db,'questionOfDay'),
      where('activeDate','==','auto')
    ));
    if (snap.empty) {
      await addDoc(collection(db,'questionOfDay'), {
        activeDate: 'auto', isActive: true, createdAt: serverTimestamp()
      });
      setToggleUI(true);
      showToast('Auto-Rotate enabled ✅', 'success');
    } else {
      const current = snap.docs[0].data().isActive !== false;
      await updateDoc(snap.docs[0].ref, { isActive: !current });
      setToggleUI(!current);
      showToast(current ? 'Auto-Rotate disabled' : 'Auto-Rotate enabled ✅', current ? 'info' : 'success');
    }
  } catch(e) { console.error(e); showToast('Error', 'error'); }
};

// ── LOAD QOD LIST ──
async function loadQODs() {
  const loader = document.getElementById('qodLoader');
  const list   = document.getElementById('qodList');
  const empty  = document.getElementById('qodEmpty');
  try {
    const snap = await getDocs(collection(db, 'questionOfDay'));
    loader.style.display = 'none';
    // Filter out the auto entry and sort by date
    const entries = [];
    snap.forEach(d => { if (d.data().activeDate !== 'auto') entries.push({ id: d.id, ...d.data() }); });
    entries.sort((a, b) => (b.activeDate || '').localeCompare(a.activeDate || ''));

    if (!entries.length) { empty.style.display = 'block'; return; }
    list.innerHTML = '';
    entries.forEach(q => {
      const isActive = q.isActive !== false;
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div style="margin-bottom:10px;">
          <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;
            background:${isActive ? '#dcfce7' : '#fee2e2'};
            color:${isActive ? '#15803d' : '#dc2626'};">
            ${isActive ? '✅ Active' : '❌ Inactive'}
          </span>
          <p style="font-size:15px;font-weight:700;margin:8px 0 4px;">📅 ${q.activeDate}</p>
          ${q.questionId
            ? `<p style="font-size:12px;color:var(--text-secondary);">
                From bank — ID: <code style="background:#f1f5f9;padding:2px 6px;
                border-radius:4px;">${q.questionId}</code></p>`
            : `<p style="font-size:12px;color:var(--text-secondary);">
                ✏️ Manually written question</p>`}
          ${q.questionText ? `<p style="font-size:13px;font-weight:600;margin-top:6px;
            padding:8px;background:#f8fafc;border-radius:8px;">${q.questionText}</p>` : ''}
          <p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">
            Attempts: ${q.totalAttempts||0} · Correct: ${q.correctCount||0}
          </p>
          ${q.explanation ? `<p style="font-size:12px;margin-top:6px;padding:8px;
            background:#f0f9ff;border-radius:8px;">
            💡 ${q.explanation.substring(0,100)}${q.explanation.length > 100 ? '...' : ''}
            </p>` : ''}
        </div>
        <div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--border);">
          <button onclick="toggleQOD('${q.id}',${isActive})" class="btn btn-sm"
            style="flex:1;border:none;background:${isActive ? '#fee2e2' : '#dcfce7'};
                   color:${isActive ? '#dc2626' : '#15803d'};">
            ${isActive ? '⏸ Deactivate' : '▶ Activate'}
          </button>
          <button onclick="deleteQOD('${q.id}')" class="btn btn-sm"
            style="background:#fee2e2;color:#dc2626;border:none;">🗑 Delete</button>
        </div>`;
      list.appendChild(card);
    });
    list.style.display = 'flex';
  } catch(e) {
    console.error(e);
    loader.style.display = 'none';
    showToast('Error loading', 'error');
  }
}

// ── ADD QOD FROM BANK ──
window.addQOD = async function() {
  const date        = document.getElementById('qodDate').value;
  const questionId  = document.getElementById('qodQuestionId').value.trim();
  const explanation = document.getElementById('qodExplanation').value.trim();
  if (!date)       { showToast('Please select a date', 'error'); return; }
  if (!questionId) { showToast('Please enter a Question ID', 'error'); return; }

  const btn = document.querySelector('button[onclick="addQOD()"]');
  btn.textContent = 'Saving...'; btn.disabled = true;
  try {
    await addDoc(collection(db,'questionOfDay'), {
      activeDate: date, questionId, explanation,
      isActive: true, totalAttempts: 0, correctCount: 0,
      createdAt: serverTimestamp()
    });
    document.getElementById('qodDate').value        = '';
    document.getElementById('qodQuestionId').value  = '';
    document.getElementById('qodExplanation').value = '';
    showToast('QOD saved! ✅', 'success');
    document.getElementById('qodList').style.display   = 'none';
    document.getElementById('qodLoader').style.display = 'block';
    document.getElementById('qodEmpty').style.display  = 'none';
    await loadQODs();
  } catch(e) {
    console.error(e);
    showToast('Error saving', 'error');
  } finally {
    btn.textContent = 'Save QOD from Bank'; btn.disabled = false;
  }
};

// ── ADD MANUALLY WRITTEN QOD ──
window.addManualQOD = async function() {
  const date     = document.getElementById('manualDate').value;
  const qText    = document.getElementById('manualQuestion').value.trim();
  const optA     = document.getElementById('manualA').value.trim();
  const optB     = document.getElementById('manualB').value.trim();
  const optC     = document.getElementById('manualC').value.trim();
  const optD     = document.getElementById('manualD').value.trim();
  const correct  = parseInt(document.getElementById('manualCorrect').value);
  const explanation = document.getElementById('manualExplanation').value.trim();

  if (!date)  { showToast('Please select a date', 'error'); return; }
  if (!qText) { showToast('Please enter the question', 'error'); return; }
  if (!optA)  { showToast('Please enter Option A', 'error'); return; }
  if (!optB)  { showToast('Please enter Option B', 'error'); return; }

  const options = [optA, optB];
  if (optC) options.push(optC);
  if (optD) options.push(optD);

  // Validate correct answer index exists
  if (correct >= options.length) {
    showToast('Correct answer option does not exist', 'error'); return;
  }

  const btn = document.querySelector('button[onclick="addManualQOD()"]');
  btn.textContent = 'Saving...'; btn.disabled = true;
  try {
    // Save question to question bank first
    const qRef = await addDoc(collection(db,'questions'), {
      questionText: qText,
      options: options,
      correctOption: correct,
      type: 'PRACTICE',
      isActive: true,
      createdAt: serverTimestamp()
    });

    // Then save as QOD entry with the new question ID
    await addDoc(collection(db,'questionOfDay'), {
      activeDate:   date,
      questionId:   qRef.id,
      questionText: qText, // stored for display in admin list
      explanation,
      isActive:     true,
      totalAttempts: 0,
      correctCount:  0,
      createdAt: serverTimestamp()
    });

    // Clear form
    ['manualDate','manualQuestion','manualA','manualB','manualC','manualD','manualExplanation']
      .forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('manualCorrect').value = '0';
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('manualDate').value = today;

    showToast('Question saved to bank and set as QOD! ✅', 'success');
    document.getElementById('qodList').style.display   = 'none';
    document.getElementById('qodLoader').style.display = 'block';
    document.getElementById('qodEmpty').style.display  = 'none';
    await loadQODs();
  } catch(e) {
    console.error(e);
    showToast('Error saving', 'error');
  } finally {
    btn.textContent = 'Save Manual Question as QOD'; btn.disabled = false;
  }
};

window.toggleQOD = async function(id, current) {
  try {
    await updateDoc(doc(db,'questionOfDay',id), { isActive: !current });
    showToast(current ? 'Deactivated' : 'Activated ✅', current ? 'info' : 'success');
    document.getElementById('qodList').style.display   = 'none';
    document.getElementById('qodLoader').style.display = 'block';
    await loadQODs();
  } catch(e) { showToast('Error', 'error'); }
};

window.deleteQOD = async function(id) {
  if (!confirm('Delete this QOD entry?')) return;
  try {
    await deleteDoc(doc(db,'questionOfDay',id));
    showToast('Deleted', 'info');
    document.getElementById('qodList').style.display   = 'none';
    document.getElementById('qodLoader').style.display = 'block';
    await loadQODs();
  } catch(e) { showToast('Error', 'error'); }
};

window.showToast = function(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`; t.textContent = msg;
  c.appendChild(t); setTimeout(() => t.remove(), 3000);
};