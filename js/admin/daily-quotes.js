import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href='index.html'; return; }
  document.getElementById('adminEmail').textContent = user.email;
  await loadQuotes();
});

async function loadQuotes() {
  const loader=document.getElementById('quotesLoader'), list=document.getElementById('quotesList'), empty=document.getElementById('quotesEmpty'), count=document.getElementById('quoteCount');
  try {
    const snap = await getDocs(query(collection(db,'dailyQuotes'), orderBy('createdAt','desc')));
    loader.style.display = 'none';
    if (snap.empty) { empty.style.display='block'; return; }
    const quotes=[]; snap.forEach(d=>quotes.push({id:d.id,...d.data()}));
    count.textContent = `${quotes.length} quote${quotes.length!==1?'s':''}`;
    list.innerHTML='';
    quotes.forEach(q => {
      const isActive=q.isActive!==false; const card=document.createElement('div'); card.className='card';
      card.innerHTML=`
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <div style="font-size:24px;flex-shrink:0;">💬</div>
          <div style="flex:1;min-width:0;">
            <p style="font-size:14px;font-weight:600;line-height:1.5;margin-bottom:4px;">"${q.text}"</p>
            <p style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">— ${q.author}</p>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              <span style="font-size:11px;padding:3px 8px;border-radius:99px;font-weight:600;background:${isActive?'#dcfce7':'#fee2e2'};color:${isActive?'#15803d':'#dc2626'};">${isActive?'✅ Active':'❌ Inactive'}</span>
              ${q.scheduledDate?`<span style="font-size:11px;padding:3px 8px;border-radius:99px;background:#e0f2fe;color:#0369a1;font-weight:600;">📅 ${q.scheduledDate}</span>`:''}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
          <button onclick="toggleQuote('${q.id}',${isActive})" class="btn btn-sm" style="flex:1;border:none;background:${isActive?'#fee2e2':'#dcfce7'};color:${isActive?'#dc2626':'#15803d'};">${isActive?'⏸ Deactivate':'▶ Activate'}</button>
          <button onclick="deleteQuote('${q.id}')" class="btn btn-sm" style="background:#fee2e2;color:#dc2626;border:none;">🗑 Delete</button>
        </div>`;
      list.appendChild(card);
    });
    list.style.display='flex';
  } catch(e) { console.error(e); loader.style.display='none'; showToast('Error loading','error'); }
}

window.addQuote = async function() {
  const text=document.getElementById('quoteText').value.trim(), author=document.getElementById('quoteAuthor').value.trim(), date=document.getElementById('quoteDate').value;
  if (!text)   { showToast('Please enter quote text','error'); return; }
  if (!author) { showToast('Please enter author name','error'); return; }
  const btn=document.querySelector('button[onclick="addQuote()"]'); btn.textContent='Saving...'; btn.disabled=true;
  try {
    await addDoc(collection(db,'dailyQuotes'),{text,author,isActive:true,scheduledDate:date||null,createdAt:serverTimestamp()});
    document.getElementById('quoteText').value=''; document.getElementById('quoteAuthor').value=''; document.getElementById('quoteDate').value='';
    showToast('Quote saved! ✅','success');
    document.getElementById('quotesList').style.display='none'; document.getElementById('quotesLoader').style.display='block'; document.getElementById('quotesEmpty').style.display='none';
    await loadQuotes();
  } catch(e) { console.error(e); showToast('Error saving','error'); }
  finally { btn.textContent='Save Quote'; btn.disabled=false; }
};
window.toggleQuote = async function(id,current) { try { await updateDoc(doc(db,'dailyQuotes',id),{isActive:!current}); showToast(current?'Deactivated':'Activated ✅',current?'info':'success'); document.getElementById('quotesList').style.display='none'; document.getElementById('quotesLoader').style.display='block'; await loadQuotes(); } catch(e) { showToast('Error','error'); } };
window.deleteQuote = async function(id) { if(!confirm('Delete this quote?')) return; try { await deleteDoc(doc(db,'dailyQuotes',id)); showToast('Deleted','info'); document.getElementById('quotesList').style.display='none'; document.getElementById('quotesLoader').style.display='block'; await loadQuotes(); } catch(e) { showToast('Error','error'); } };
window.showToast = function(msg,type='info') { const c=document.getElementById('toastContainer'); const t=document.createElement('div'); t.className=`toast toast-${type}`; t.textContent=msg; c.appendChild(t); setTimeout(()=>t.remove(),3000); };
