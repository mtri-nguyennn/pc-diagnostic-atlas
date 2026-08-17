const state={db:null,activeSession:null,selectedSession:null};
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const enc=s=>encodeURIComponent(s);
async function api(url,opts={}){const r=await fetch(url,{headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});const j=await r.json();if(!r.ok)throw new Error(j.error||'Request failed');return j}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function route(hash){location.hash=hash}
document.addEventListener('click',e=>{const b=e.target.closest('[data-route]');if(b)route(b.dataset.route)});

function sidebar(){
  const h=location.hash||'#/';
  $('#sidebar').innerHTML=`<div class="side-title">6-Layer Diagnostic Map</div>${state.db.layers.map(l=>`<button class="layer-link ${h.startsWith('#/layer/'+l.id)?'active':''}" data-route="#/layer/${l.id}"><span class="layer-num">${l.id}</span><span><b>${esc(l.short)}</b><br><small>${l.symptomCount} symptoms</small></span></button>`).join('')}<div class="side-stats"><b>${state.db.symptoms.length}</b> symptoms · <b>${state.db.flows.filter(f=>f.status!=='catalog-only').length}</b> diagnostic flows<br>Source: six uploaded layer documents</div>`;
}
function breadcrumb(items){return `<div class="breadcrumb">${items.map((x,i)=>i===items.length-1?esc(x.label):`<a data-route="${x.route}">${esc(x.label)}</a>`).join(' / ')}</div>`}
function flowForSymptom(s){return state.db.flows.find(f=>f.id===s.flowId)}
function layer(id){return state.db.layers.find(x=>x.id===Number(id))}

function renderHome(){
  const verified=state.db.flows.filter(f=>f.status!=='catalog-only').length;
  $('#main').innerHTML=`
  <section class="hero">
    <div>
      <div class="eyebrow">Technician troubleshooting knowledge base</div>
      <h1>Diagnose by evidence,<br>not by guesswork.</h1>
      <p>Navigate six PC layers, isolate one hypothesis at a time, record one test and its result, then preserve the evidence inside a repair session.</p>
      <div class="metric-row"><div class="metric"><b>${state.db.layers.length}</b><span>Diagnostic layers</span></div><div class="metric"><b>${state.db.symptoms.length}</b><span>Indexed symptoms</span></div><div class="metric"><b>${verified}</b><span>Source-derived flows</span></div></div>
    </div>
    <div class="hero-panel">
      <div class="eyebrow">Core diagnostic loop</div>
      <div class="flow-timeline" style="margin-top:18px">
        ${['Symptom','Form hypothesis','Perform ONE test','Observe result','Narrow down / New hypothesis','Repair','Verify'].map((x,i)=>`<div class="flow-step" style="padding-bottom:${i===6?0:16}px"><span class="step-dot">${i+1}</span><p>${x}</p></div>`).join('')}
      </div>
    </div>
  </section>
  <div class="section-head"><div><div class="eyebrow">Family-tree navigation</div><h2>Six diagnostic layers</h2></div><p>Start from the last stage known to work.</p></div>
  <div class="layer-grid">${state.db.layers.map(l=>`<article class="layer-card" data-route="#/layer/${l.id}"><div class="n">LAYER ${l.id}</div><h3>${esc(l.name)}</h3><p>${esc(l.description)}</p><div class="card-meta"><span>${l.componentCount} components</span><span>${l.symptomCount} symptoms</span><span>${l.flowCount} flows</span></div></article>`).join('')}</div>`;
}
function renderLayer(id){
  const l=layer(id); if(!l)return render404();
  const comps=state.db.components.filter(c=>c.layerId===l.id);
  const syms=state.db.symptoms.filter(s=>s.layerId===l.id);
  $('#main').innerHTML=`${breadcrumb([{label:'Home',route:'#/'},{label:`Layer ${l.id}`}])}
  <div class="page-title"><div><div class="eyebrow">Layer ${l.id}</div><h1>${esc(l.name)}</h1><p>${esc(l.description)}</p></div><span class="badge">${syms.length} symptoms</span></div>
  <div class="warning-box" style="margin:18px 0">Boundary: ${esc(l.boundary)}</div>
  <div class="two-col">
    <section class="tree-panel"><div class="section-head" style="margin-top:0"><h2>Components</h2></div><ul class="component-tree">${comps.map(c=>`<li><button class="comp-btn depth-${Math.min(c.depth,2)}" data-route="#/component/${l.id}/${enc(c.id)}">${c.depth?'↳ ':'◆ '}${esc(c.name)}</button></li>`).join('')}</ul></section>
    <section class="list-panel"><div class="section-head" style="margin-top:0"><div><h2>Symptom database</h2><p>Indexed from the uploaded Layer ${l.id} source.</p></div></div><div class="symptom-list">${syms.map(symRow).join('')}</div></section>
  </div>`;
}
function symRow(s){const f=flowForSymptom(s);return `<div class="symptom-row"><div class="sym-code">${esc(s.code)}</div><div><div class="sym-title">${esc(s.title)}</div><div class="sym-sub">${esc(s.componentPath)} ${f?.status==='catalog-only'?'· taxonomy only':''}</div></div><button data-route="#/diagnose/${enc(s.id)}">Diagnose →</button></div>`}
function renderComponent(layerId,cid){
  const c=state.db.components.find(x=>x.id===decodeURIComponent(cid)); if(!c)return render404();
  const l=layer(layerId); const syms=state.db.symptoms.filter(s=>s.layerId===c.layerId && (s.componentPath===c.path || s.componentPath.startsWith(c.path+' > ')));
  $('#main').innerHTML=`${breadcrumb([{label:'Home',route:'#/'},{label:`Layer ${l.id}`,route:`#/layer/${l.id}`},{label:c.path}])}
  <div class="page-title"><div><div class="eyebrow">Component page</div><h1>${esc(c.name)}</h1><p>${esc(c.path)}</p></div><span class="badge">${syms.length} symptoms</span></div>
  <div class="section-head"><div><h2>Related symptoms</h2><p>Use a symptom to enter the diagnostic tree.</p></div></div>
  <div class="symptom-list">${syms.length?syms.map(symRow).join(''):'<div class="empty">No symptom is directly indexed under this component node.</div>'}</div>`;
}
function renderDiagnose(symId){
  const s=state.db.symptoms.find(x=>x.id===decodeURIComponent(symId)); if(!s)return render404();
  const l=layer(s.layerId), f=flowForSymptom(s);
  if(!f)return render404();
  const isCatalog=f.status==='catalog-only';
  const refs=(f.references||[]).map(x=>`<li>${esc(x)}</li>`).join('');
  $('#main').innerHTML=`${breadcrumb([{label:'Home',route:'#/'},{label:`Layer ${l.id}`,route:`#/layer/${l.id}`},{label:s.code+' '+s.title}])}
  <div class="page-title"><div><div class="eyebrow">${esc(s.componentPath)}</div><h1>${esc(s.code)} · ${esc(s.title)}</h1><p>${esc(f.symptomDescription||f.symptom)}</p></div><span class="badge ${isCatalog?'warn':'ok'}">${isCatalog?'Taxonomy only':'Source-derived flow'}</span></div>
  ${isCatalog?`<div class="warning-box" style="margin:18px 0">The uploaded source lists this symptom but does not provide a standalone structured flow. The system intentionally does not invent one. You can add a technician-verified flow in Admin.</div>`:''}
  <div class="flow-shell">
    <section class="detail-card">
      <div class="flow-timeline">
        ${step(1,'Symptom',f.symptom||s.title)}
        ${step(2,'Form hypothesis',f.hypothesis||'Not provided in source')}
        ${step(3,'Perform ONE test',f.test||'Not provided in source',true)}
        <div class="flow-step"><span class="step-dot">4</span><h4>Observe result</h4><p>${esc(f.observe||'Not provided in source')}</p>${!isCatalog?`<div class="decision"><button class="yes" onclick="recordDecision('${esc(s.id)}','${esc(f.id)}','YES')">YES</button><button class="no" onclick="recordDecision('${esc(s.id)}','${esc(f.id)}','NO')">NO</button></div><div id="decisionOutcome"></div>`:''}</div>
      </div>
    </section>
    <aside class="side-actions" style="position:static;height:auto;border:0;padding:0;background:none;overflow:visible">
      <div class="detail-card"><div class="eyebrow">Repair session</div><p class="source-note">${state.activeSession?`Active case: <b>${esc(state.activeSession.id)}</b>`:'No active case. Start a session to save each test result.'}</p><button class="primary-btn" style="width:100%" onclick="startSessionFor('${esc(s.id)}')">${state.activeSession?'Use active session':'Start repair session'}</button><button class="secondary-btn" style="width:100%;margin-top:8px" data-route="#/sessions">View test history</button></div>
      <div class="detail-card"><div class="eyebrow">Provenance</div><p class="source-note"><b>${esc(f.sourceDocument)}</b><br>${esc(f.sourceSection)}</p>${f.notes?`<p class="source-note">${esc(f.notes)}</p>`:''}${refs?`<ul class="reference-list">${refs}</ul>`:''}</div>
      <div class="detail-card"><div class="eyebrow">Metadata</div><p class="source-note">Difficulty: ${esc(f.difficulty)}<br>Status: ${esc(f.status)}<br>Codes: ${esc((f.codes||[]).join(', '))}</p></div>
    </aside>
  </div>`;
}
function step(n,label,text,test=false){return `<div class="flow-step"><span class="step-dot">${n}</span><h4>${label}</h4>${test?`<div class="test-box"><p>${esc(text)}</p></div>`:`<p>${esc(text)}</p>`}</div>`}
window.recordDecision=async function(symId,flowId,result){
  const f=state.db.flows.find(x=>x.id===flowId); const outcome=result==='YES'?f.yesOutcome:f.noOutcome;
  $('#decisionOutcome').innerHTML=`<div class="outcome"><h4>${result==='YES'?'Narrow down':'New hypothesis / next branch'}</h4><p>${esc(outcome||'The source flow does not provide a clean standalone branch text. Review the raw source flow in Admin.')}</p>${f.repair?`<p class="source-note"><b>Repair:</b> ${esc(f.repair)}</p>`:''}${f.verify?`<p class="source-note"><b>Verify:</b> ${esc(f.verify)}</p>`:''}</div>`;
  if(state.activeSession){
    const s=state.db.symptoms.find(x=>x.id===symId);
    await api(`/api/sessions/${state.activeSession.id}/events`,{method:'POST',body:JSON.stringify({type:'Diagnostic test',symptomId:symId,flowId,test:f.test,observe:f.observe,result,outcome})});
    toast('Test result saved to repair session'); await refreshDB();
  }
}
window.startSessionFor=async function(symId){
  const s=state.db.symptoms.find(x=>x.id===symId); const f=flowForSymptom(s);
  const device=prompt('Device / asset name (optional):',''); if(device===null)return;
  const sess=await api('/api/sessions',{method:'POST',body:JSON.stringify({device,symptomId:s.id,flowId:f.id})});
  state.activeSession=sess; toast('Repair session started'); renderCurrent();
}

function renderSessions(){
  const sessions=state.db.sessions||[]; if(!state.selectedSession && sessions[0])state.selectedSession=sessions[0].id;
  const current=sessions.find(s=>s.id===state.selectedSession)||sessions[0];
  $('#main').innerHTML=`${breadcrumb([{label:'Home',route:'#/'},{label:'Repair Sessions'}])}<div class="page-title"><div><div class="eyebrow">Case tracking</div><h1>Repair sessions + test history</h1><p>Every diagnostic result can be attached to a case so the reasoning trail remains auditable.</p></div><button class="primary-btn" onclick="newSession()">+ New session</button></div>
  <div class="session-grid" style="margin-top:20px"><section class="session-card"><div class="section-head" style="margin-top:0"><h2>Cases</h2></div><div class="session-list">${sessions.length?sessions.map(s=>`<div class="session-item ${current?.id===s.id?'active':''}" onclick="selectSession('${s.id}')"><b>${esc(s.device||s.id)}</b><br><small>${esc(s.status)} · ${new Date(s.createdAt).toLocaleString()}</small></div>`).join(''):'<div class="empty">No repair sessions yet.</div>'}</div></section>
  <section class="session-card">${current?renderSessionDetail(current):'<div class="empty">Create a session, then run a diagnostic test.</div>'}</section></div>`;
}
function renderSessionDetail(s){
  const sym=state.db.symptoms.find(x=>x.id===s.symptomId);
  return `<div class="section-head" style="margin-top:0"><div><div class="eyebrow">${esc(s.id)}</div><h2>${esc(s.device||'Unnamed device')}</h2><p>${esc([s.brand,s.model].filter(Boolean).join(' ')||'')}</p></div><select onchange="setSessionStatus('${s.id}',this.value)"><option ${s.status==='Open'?'selected':''}>Open</option><option ${s.status==='Resolved'?'selected':''}>Resolved</option><option ${s.status==='On Hold'?'selected':''}>On Hold</option></select></div>${sym?`<div class="warning-box">Primary symptom: <b>${esc(sym.code)} ${esc(sym.title)}</b> <button class="ghost-btn" data-route="#/diagnose/${enc(sym.id)}">Open diagnostic flow →</button></div>`:''}<div class="section-head"><h2>Test history</h2><p>${(s.events||[]).length} events</p></div><div class="event-list">${(s.events||[]).length?s.events.slice().reverse().map(e=>`<div class="event"><b>${esc(e.type||'Event')} · ${esc(e.result||'')}</b><p>${esc(e.test||e.outcome||'')}</p>${e.outcome?`<p class="source-note">Outcome: ${esc(e.outcome)}</p>`:''}<time>${new Date(e.createdAt).toLocaleString()}</time></div>`).join(''):'<div class="empty">No diagnostic tests recorded yet.</div>'}</div>`
}
window.newSession=async function(){
  const device=prompt('Device / asset name:',''); if(device===null)return;
  const sess=await api('/api/sessions',{method:'POST',body:JSON.stringify({device})}); state.selectedSession=sess.id; state.activeSession=sess; await refreshDB(); route('#/sessions');
}
window.selectSession=function(id){state.selectedSession=id;state.activeSession=state.db.sessions.find(s=>s.id===id)||null;renderSessions()}
window.setSessionStatus=async function(id,status){await api(`/api/sessions/${id}`,{method:'PATCH',body:JSON.stringify({status})});toast('Session updated');await refreshDB();renderSessions()}

function renderAdmin(){
  const flows=state.db.flows; const selected=flows.find(f=>f.id===window.adminSelected)||flows[0]; if(selected)window.adminSelected=selected.id;
  $('#main').innerHTML=`${breadcrumb([{label:'Home',route:'#/'},{label:'Admin'}])}<div class="page-title"><div><div class="eyebrow">Local MVP administration</div><h1>Diagnostic flow editor</h1><p>Add or edit troubleshooting flows. Authentication is intentionally not implemented in this local prototype.</p></div><button class="primary-btn" onclick="adminNew()">+ Add flow</button></div>
  <div class="warning-box" style="margin:18px 0">Before public deployment, add authentication, roles, moderation/review states, audit logs and server-side validation.</div>
  <div class="admin-layout"><section class="admin-card"><div class="field"><label>Filter flows</label><input id="adminFilter" placeholder="Code, title, layer…" oninput="filterAdmin(this.value)"></div><div id="adminList" class="admin-list" style="margin-top:12px">${flows.map(adminRow).join('')}</div></section><section class="admin-card" id="adminEditor">${selected?adminForm(selected):'<div class="empty">Select or add a flow.</div>'}</section></div>`;
}
function adminRow(f){return `<div class="admin-flow ${window.adminSelected===f.id?'active':''}" data-admin-text="${esc((f.code+' '+f.title+' '+f.component+' layer '+f.layerId).toLowerCase())}" onclick="adminSelect('${f.id}')"><b>L${f.layerId} · ${esc(f.code)}</b> ${esc(f.title)}<small>${esc(f.component)} · ${esc(f.status)}</small></div>`}
function adminForm(f,isNew=false){return `<form onsubmit="saveAdmin(event,'${isNew?'NEW':f.id}')"><div class="section-head" style="margin-top:0"><div><div class="eyebrow">${isNew?'New flow':'Edit flow'}</div><h2>${isNew?'Create diagnostic flow':esc(f.code+' · '+f.title)}</h2></div></div><div class="form-grid">
  ${fieldInput('layerId','Layer',f.layerId,'number')}${fieldInput('code','Code',f.code)}${fieldInput('title','Title',f.title)}${fieldInput('component','Component',f.component)}
  ${fieldArea('symptom','Symptom',f.symptom)}${fieldArea('hypothesis','Hypothesis',f.hypothesis)}${fieldArea('test','ONE test',f.test)}${fieldArea('observe','Observe question/result',f.observe)}${fieldArea('yesOutcome','YES outcome',f.yesOutcome)}${fieldArea('noOutcome','NO outcome',f.noOutcome)}${fieldArea('repair','Repair',f.repair)}${fieldArea('verify','Verify',f.verify)}${fieldArea('notes','Notes',f.notes,'full')}
  <div class="field"><label>Difficulty</label><select name="difficulty"><option ${f.difficulty==='Standard'?'selected':''}>Standard</option><option ${f.difficulty==='Advanced'?'selected':''}>Advanced</option><option ${f.difficulty==='Beginner'?'selected':''}>Beginner</option></select></div>
  <div class="field"><label>Status</label><input name="status" value="${esc(f.status||'admin-created')}"></div>
  <div class="field full"><button class="primary-btn" type="submit">Save diagnostic flow</button></div></div></form>`}
function fieldInput(n,l,v,t='text'){return `<div class="field"><label>${l}</label><input name="${n}" type="${t}" value="${esc(v)}" required></div>`}
function fieldArea(n,l,v,cls=''){return `<div class="field ${cls}"><label>${l}</label><textarea name="${n}" ${['symptom','hypothesis','test','observe'].includes(n)?'required':''}>${esc(v)}</textarea></div>`}
window.adminSelect=function(id){window.adminSelected=id;renderAdmin()}
window.adminNew=function(){window.adminSelected='NEW';$('#adminEditor').innerHTML=adminForm({layerId:1,code:'',title:'',component:'',symptom:'',hypothesis:'',test:'',observe:'',yesOutcome:'',noOutcome:'',repair:'',verify:'',notes:'',difficulty:'Standard',status:'admin-created'},true)}
window.filterAdmin=function(q){q=q.toLowerCase();document.querySelectorAll('.admin-flow').forEach(x=>x.style.display=x.dataset.adminText.includes(q)?'block':'none')}
window.saveAdmin=async function(e,id){e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());data.layerId=Number(data.layerId);try{const saved=id==='NEW'?await api('/api/flows',{method:'POST',body:JSON.stringify(data)}):await api(`/api/flows/${id}`,{method:'PUT',body:JSON.stringify(data)});window.adminSelected=saved.id;toast('Diagnostic flow saved');await refreshDB();renderAdmin()}catch(err){alert(err.message)}}

function render404(){ $('#main').innerHTML='<div class="empty">Page or diagnostic record not found.</div>' }
function renderCurrent(){
  sidebar(); const h=(location.hash||'#/').replace(/^#/,''); const parts=h.split('/').filter(Boolean);
  if(!parts.length)return renderHome();
  if(parts[0]==='layer')return renderLayer(parts[1]);
  if(parts[0]==='component')return renderComponent(parts[1],parts[2]);
  if(parts[0]==='diagnose')return renderDiagnose(parts[1]);
  if(parts[0]==='sessions')return renderSessions();
  if(parts[0]==='admin')return renderAdmin();
  render404();
}
async function refreshDB(){state.db=await api('/api/db'); if(state.activeSession){state.activeSession=(state.db.sessions||[]).find(s=>s.id===state.activeSession.id)||null}}
async function init(){
  await refreshDB();
  window.addEventListener('hashchange',renderCurrent); renderCurrent();
  const input=$('#globalSearch'), pop=$('#searchPopover'); let timer;
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(async()=>{const q=input.value.trim();if(!q){pop.classList.add('hidden');return}const results=await api('/api/search?q='+encodeURIComponent(q));pop.innerHTML=results.length?results.map(r=>`<button class="search-item" data-route="${r.type==='component'?`#/component/${r.layerId}/${enc(r.id)}`:`#/diagnose/${enc(r.id)}`}"><b>${r.type==='symptom'?esc(r.code)+' · ':''}${esc(r.title||r.name)}</b><small>Layer ${r.layerId} · ${esc(r.componentPath||r.path||'')}</small></button>`).join(''):'<div class="empty">No match</div>';pop.classList.remove('hidden')},120)});
  input.addEventListener('keydown',e=>{if(e.key==='Escape')pop.classList.add('hidden')});
  document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))pop.classList.add('hidden')});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();input.focus()}});
}
init().catch(err=>{$('#main').innerHTML=`<div class="warning-box">Failed to load: ${esc(err.message)}</div>`});
