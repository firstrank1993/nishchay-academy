import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
const MONTHS=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
onAuthStateChanged(auth, async (user) => { if (!user) { window.location.href='index.html'; return; } document.getElementById('adminEmail').textContent=user.email; await loadEvents(); });
async function loadEvents() {
  const loader=document.getElementById('histLoader'), list=document.getElementById('histList'), empty=document.getElementById('histEmpty'), count=document.getElementById('eventCount');
  try {
    const snap=await getDocs(query(collection(db,'historyEvents'),orderBy('month'),orderBy('day')));
    loader.style.display='none';
    if (snap.empty) { empty.style.display='block'; return; }
    const events=[]; snap.forEach(d=>events.push({id:d.id,...d.data()}));
    count.textContent=`${events.length} event${events.length!==1?'s':''}`;
    list.innerHTML='';
    events.forEach(e => {
      const isActive=e.isActive!==false; const card=document.createElement('div'); card.className='card';
      card.innerHTML=`
        <div style="display:flex;gap:10px;align-items:flex-start;">
          ${e.imageUrl?`<img src="${e.imageUrl}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;flex-shrink:0;"/>`:''}
          <div style="flex:1;">
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
              <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;background:#fef3c7;color:#d97706;">${MONTHS[e.month]} ${e.day}, ${e.year}</span>
              <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:99px;background:${isActive?'#dcfce7':'#fee2e2'};color:${isActive?'#15803d':'#dc2626'};">${isActive?'✅ Active':'❌ Inactive'}</span>
            </div>
            <p style="font-size:14px;font-weight:700;margin-bottom:4px;">${e.title}</p>
            <p style="font-size:12px;color:var(--text-secondary);">${(e.description||'').substring(0,80)}${(e.description||'').length>80?'...':''}</p>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
          <button onclick="toggleEvent('${e.id}',${isActive})" class="btn btn-sm" style="flex:1;border:none;background:${isActive?'#fee2e2':'#dcfce7'};color:${isActive?'#dc2626':'#15803d'};">${isActive?'⏸ Deactivate':'▶ Activate'}</button>
          <button onclick="deleteEvent('${e.id}')" class="btn btn-sm" style="background:#fee2e2;color:#dc2626;border:none;">🗑 Delete</button>
        </div>`;
      list.appendChild(card);
    });
    list.style.display='flex';
  } catch(e) { console.error(e); loader.style.display='none'; showToast('Error loading','error'); }
}
window.addHistoryEvent = async function() {
  const day=parseInt(document.getElementById('histDay').value), month=parseInt(document.getElementById('histMonth').value), year=parseInt(document.getElementById('histYear').value), title=document.getElementById('histTitle').value.trim(), desc=document.getElementById('histDesc').value.trim(), image=document.getElementById('histImage').value.trim();
  if (!day||!month) { showToast('Please enter day and month','error'); return; }
  if (!year)        { showToast('Please enter year','error'); return; }
  if (!title)       { showToast('Please enter title','error'); return; }
  if (!desc)        { showToast('Please enter description','error'); return; }
  const btn=document.querySelector('button[onclick="addHistoryEvent()"]'); btn.textContent='Saving...'; btn.disabled=true;
  try {
    await addDoc(collection(db,'historyEvents'),{day,month,year,title,description:desc,imageUrl:image||null,isActive:true,createdAt:serverTimestamp()});
    ['histDay','histMonth','histYear','histTitle','histDesc','histImage'].forEach(id=>{ document.getElementById(id).value=''; });
    showToast('Event saved! ✅','success');
    document.getElementById('histList').style.display='none'; document.getElementById('histLoader').style.display='block'; await loadEvents();
  } catch(e) { console.error(e); showToast('Error saving','error'); }
  finally { btn.textContent='Save Event'; btn.disabled=false; }
};
window.toggleEvent = async function(id,current) { try { await updateDoc(doc(db,'historyEvents',id),{isActive:!current}); showToast(current?'Deactivated':'Activated ✅',current?'info':'success'); document.getElementById('histList').style.display='none'; document.getElementById('histLoader').style.display='block'; await loadEvents(); } catch(e) { showToast('Error','error'); } };
window.deleteEvent = async function(id) { if (!confirm('Delete?')) return; try { await deleteDoc(doc(db,'historyEvents',id)); showToast('Deleted','info'); document.getElementById('histList').style.display='none'; document.getElementById('histLoader').style.display='block'; await loadEvents(); } catch(e) { showToast('Error','error'); } };
window.showToast = function(msg,type='info') { const c=document.getElementById('toastContainer'); const t=document.createElement('div'); t.className=`toast toast-${type}`; t.textContent=msg; c.appendChild(t); setTimeout(()=>t.remove(),3000); };
