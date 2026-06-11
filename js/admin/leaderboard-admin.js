import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
const ON='background:var(--primary);color:white;font-weight:700;', OFF='background:transparent;color:var(--text-secondary);font-weight:600;';
const BASE='flex:1;padding:8px 4px;border:none;border-radius:var(--radius-sm);font-size:13px;cursor:pointer;font-family:Inter,sans-serif;';
onAuthStateChanged(auth, async (user) => { if (!user) { window.location.href='index.html'; return; } document.getElementById('adminEmail').textContent=user.email; loadLeaderboard('weeklyPoints'); });
window.switchTab = function(tab) {
  const map={weekly:'weeklyPoints',monthly:'monthlyPoints',alltime:'totalPoints'};
  ['weekly','monthly','alltime'].forEach(t=>{ document.getElementById(`tab-${t}`).style.cssText=BASE+(t===tab?ON:OFF); });
  loadLeaderboard(map[tab]);
};
async function loadLeaderboard(field) {
  const loader=document.getElementById('leaderLoader'),list=document.getElementById('leaderList'),empty=document.getElementById('leaderEmpty');
  loader.style.display='block'; list.style.display='none'; empty.style.display='none';
  try {
    const snap=await getDocs(query(collection(db,'leaderboard'),orderBy(field,'desc'),limit(100)));
    loader.style.display='none';
    if (snap.empty) { empty.style.display='block'; return; }
    const entries=[]; snap.forEach(d=>entries.push({id:d.id,...d.data()}));
    document.getElementById('totalStudents').textContent=entries.length;
    document.getElementById('topScore').textContent=entries[0]?.[field]||0;
    document.getElementById('topStreak').textContent=Math.max(...entries.map(e=>e.currentStreak||0));
    const medals=['🥇','🥈','🥉']; list.innerHTML='';
    entries.forEach((e,i)=>{ const card=document.createElement('div'); card.style.cssText='background:white;border:1.5px solid var(--border);border-radius:var(--radius-md);padding:12px 14px;display:flex;align-items:center;gap:12px;'; card.innerHTML=`<div style="font-size:${i<3?'20':'14'}px;font-weight:800;min-width:32px;text-align:center;color:${i<3?'inherit':'var(--text-secondary)'};">${i<3?medals[i]:`#${i+1}`}</div><div style="flex:1;min-width:0;"><p style="font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.fullName||'Student'}</p><p style="font-size:11px;color:var(--text-secondary);margin-top:1px;">${e.district||'Gujarat'} · 🔥 ${e.currentStreak||0} days</p></div><div style="text-align:right;"><p style="font-size:15px;font-weight:800;color:var(--primary);">${e[field]||0}</p><p style="font-size:10px;color:var(--text-secondary);">pts</p></div>`; list.appendChild(card); });
    list.style.display='flex';
  } catch(e) { console.error(e); loader.style.display='none'; empty.style.display='block'; }
}
window.showToast=function(msg,type='info'){const c=document.getElementById('toastContainer');const t=document.createElement('div');t.className=`toast toast-${type}`;t.textContent=msg;c.appendChild(t);setTimeout(()=>t.remove(),3000);};
