// ============================================
// NISHCHAY ACADEMY — Admin: Question of Day
// ============================================
import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, addDoc, deleteDoc, updateDoc,
  doc, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = 'index.html'; return; }
  document.getElementById('adminEmail').textContent = user.email;
  await loadQODs();
});

async function loadQODs() {
  const loader = document.getElementById('qodLoader');
  const list   = document.getElementById('qodList');
  const empty  = document.getElementById('qodEmpty');
  try {
    const snap = await getDocs(query(collection(db, 'questionOfDay'), orderBy('activeDate', 'desc')));
    loader.style.display = 'none';
    if (snap.empty) { empty.style.display = 'block'; return; }

    list.innerHTML = '';
    snap.forEach(d => {
      const q = { id: d.id, ...d.data() };
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
          <div style="flex:1;">
            <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;
              background:${q.isActive !== false ? '#dcfce7' : '#fee2e2'};
              color:${q.isActive !== false ? '#15803d' : '#dc2626'};">
              ${q.isActive !== false ? '✅ Active' : '❌ Inactive'}
            </span>
            <p style="font-size:14px;font-weight:700;margin:8px 0 4px;">📅 ${q.activeDate}</p>
            <p style="font-size:12px;color:var(--text-secondary);">
              Question ID: <code>${q.questionId}</code>
            </p>
            <p style="font-size:12px;color:var(--text-secondary);margin-top:4px;">
              Attempts: ${q.totalAttempts || 0} · Correct: ${q.correctCount || 0}
            </p>
            ${q.explanation ? `<p style="font-size:12px;margin-top:6px;color:var(--text-primary);">
              💡 ${q.explanation.substring(0,80)}...</p>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;
                    border-top:1px solid var(--border);">
          <button onclick="toggleQOD('${q.id}', ${q.isActive !== false})"
            class="btn btn-sm" style="flex:1;
              background:${q.isActive !== false ? '#fee2e2' : '#dcfce7'};
              color:${q.isActive !== false ? '#dc2626' : '#15803d'};border:none;">
            ${q.isActive !== false ? '⏸ Deactivate' : '▶ Activate'}
          </button>
          <button onclick="deleteQOD('${q.id}')"
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
    showToast('Error loading QOD entries', 'error');
  }
}

window.addQOD = async function() {
  const date       = document.getElementById('qodDate').value;
  const questionId = document.getElementById('qodQuestionId').value.trim();
  const explanation = document.getElementById('qodExplanation').value.trim();
  if (!date)       { showToast('Please select a date', 'error'); return; }
  if (!questionId) { showToast('Please enter a Question ID', 'error'); return; }

  const btn = document.querySelector('button[onclick="addQOD()"]');
  btn.textContent = 'Saving...'; btn.disabled = true;
  try {
    await addDoc(collection(db, 'questionOfDay'), {
      activeDate: date, questionId, explanation,
      isActive: true, totalAttempts: 0, correctCount: 0,
      createdAt: serverTimestamp()
    });
    document.getElementById('qodDate').value        = '';
    document.getElementById('qodQuestionId').value  = '';
    document.getElementById('qodExplanation').value = '';
    showToast('QOD added! ✅', 'success');
    document.getElementById('qodList').style.display   = 'none';
    document.getElementById('qodLoader').style.display = 'block';
    await loadQODs();
  } catch(e) {
    console.error(e); showToast('Error saving', 'error');
  } finally {
    btn.textContent = 'Save QOD'; btn.disabled = false;
  }
};

window.toggleQOD = async function(id, current) {
  try {
    await updateDoc(doc(db, 'questionOfDay', id), { isActive: !current });
    showToast(current ? 'Deactivated' : 'Activated ✅', current ? 'info' : 'success');
    document.getElementById('qodList').style.display   = 'none';
    document.getElementById('qodLoader').style.display = 'block';
    await loadQODs();
  } catch(e) { showToast('Error', 'error'); }
};

window.deleteQOD = async function(id) {
  if (!confirm('Delete this QOD entry?')) return;
  try {
    await deleteDoc(doc(db, 'questionOfDay', id));
    showToast('Deleted', 'info');
    document.getElementById('qodList').style.display   = 'none';
    document.getElementById('qodLoader').style.display = 'block';
    await loadQODs();
  } catch(e) { showToast('Error deleting', 'error'); }
};

window.showToast = function(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`; t.textContent = msg;
  c.appendChild(t); setTimeout(() => t.remove(), 3000);
};
