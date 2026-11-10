/* ─────────────────────────────────────────────────────────────────────────────
   DalOS Workspace · Admin  (/workspace/#admin)  — phases 1+2 of the
   admin-in-workspace mockup. STAGING.

   Every Supabase read/write here is copied from Vision's AdminCenter
   (dalos-vision/vision.js → AdminCenter, AnalyticsAccessPanel, loadConfigFromDB,
   the App users loader). No new tables, RPCs or edge functions. The front-end
   admin gate is cosmetic; RLS / RPC checks on the server are the real gate.

   ADM_ROLES / ADM_PERM_LABELS / ADM_LC_ROWS mirror Vision's ROLES / PERM_LABELS /
   LC_ROWS constants (code, not DB). Keep them in sync when Vision's change.
   Depends on globals from index.html: sb, VISION_URL, WS_USER, wsBindAvatar,
   wsSignOut, wsGoHome.
   ───────────────────────────────────────────────────────────────────────────── */

var ADM_ROLES={
  admin:{label:'Admin',perms:{viewFG:1,createFG:1,editFG:1,approveFG:1,viewClientQC:1,createClientQC:1,viewExport:1,viewAnalytics:1,viewAdmin:1,viewConfig:1,viewEscalation:1,escalate:1,allPackhouses:1,viewShipments:1,viewCRM:1,editCRM:1,viewLeads:1,editLeadStatus:1,manageLeads:1}},
  power_user:{label:'Power User',perms:{viewFG:1,createFG:1,editFG:1,approveFG:1,viewClientQC:1,createClientQC:1,viewExport:1,viewAnalytics:1,viewAdmin:1,viewConfig:1,viewEscalation:1,escalate:1,allPackhouses:1,viewShipments:1,viewCRM:1,editCRM:1,viewLeads:1,editLeadStatus:1,manageLeads:1}},
  board:{label:'Senior Board',perms:{viewFG:1,editFG:1,viewClientQC:1,viewAnalytics:1,viewEscalation:1,allPackhouses:1,viewShipments:1}},
  qc_manager:{label:'QC Manager',perms:{viewFG:1,createFG:1,editFG:1,approveFG:1,viewClientQC:1,createClientQC:1,viewExport:1,viewAnalytics:1,escalate:1,allPackhouses:1,viewShipments:1}},
  ph_manager:{label:'Packhouse Manager',perms:{viewFG:1,createFG:1,editFG:1,approveFG:1,viewClientQC:1,createClientQC:1,viewExport:1,viewAnalytics:1,viewShipments:1}},
  qc_supervisor:{label:'QC Supervisor',perms:{viewFG:1,createFG:1,editFG:1,approveFG:1,viewClientQC:1,viewAnalytics:1,escalate:1}},
  inspector:{label:'Inspector',perms:{viewFG:1,createFG:1,editFG:1}},
  commercial:{label:'Commercial / Export',perms:{viewFG:1,editFG:1,viewClientQC:1,createClientQC:1,viewExport:1,viewAnalytics:1,allPackhouses:1,viewShipments:1,viewCRM:1,editCRM:1,viewLeads:1,editLeadStatus:1}},
  marketing:{label:'Marketing',perms:{viewCRM:1,viewLeads:1,editLeadStatus:1,manageLeads:1}},
  client_qc:{label:'Client QC Management',perms:{viewFG:1,editFG:1,viewClientQC:1,createClientQC:1,allPackhouses:1,viewShipments:1}},
  executive:{label:'Executive',perms:{viewExport:1,viewAnalytics:1,allPackhouses:1,viewShipments:1}},
  agronomy_admin:{label:'Agronomy Admin (Land Cloud)',perms:{}},
  agronomy_viewer:{label:'Agronomy Viewer (Land Cloud)',perms:{}}
};
var ADM_PERM_LABELS={viewFG:'View inspections',createFG:'Create inspections',editFG:'Edit inspections',approveFG:'Approve / reject',viewClientQC:'View client reports',createClientQC:'Submit client reports',viewExport:'Export data',viewAnalytics:'Analytics dashboard',viewAdmin:'User management',viewConfig:'System configuration',viewEscalation:'Board review / escalation queue',escalate:'Escalate batches',allPackhouses:'All packhouses',viewShipments:'View shipments',viewCRM:'CRM — claims & regions (view)',editCRM:'CRM — raise/edit claims, grade, redirect',viewLeads:'Leads — view',editLeadStatus:'Leads — change status & add notes',manageLeads:'Leads — full management (create, import, assign, campaigns)'};
var ADM_CRM_SET={viewCRM:1,editCRM:1,viewLeads:1,editLeadStatus:1,manageLeads:1};
var ADM_LC_ROWS=[
  {label:'Land Cloud — view (structure & blocks)',roles:{admin:1,power_user:1,agronomy_admin:1,agronomy_viewer:1,commercial:1}},
  {label:'Land Cloud — edit (blocks, geometry, seasons)',roles:{admin:1,power_user:1,agronomy_admin:1}},
  {label:'Land Cloud — approve changes',roles:{admin:1,power_user:1}}
];
/* Vision: roles whose packhouse access is always "All" (users loader + togglePHForUser). */
var ADM_ALL_PH={admin:1,qc_manager:1,board:1,commercial:1,executive:1};
var ADM_ROLE_CLS={admin:'r-admin',power_user:'r-pu',board:'r-board',qc_manager:'r-qc',ph_manager:'r-qc',qc_supervisor:'r-qc',inspector:'r-qc',commercial:'r-com',marketing:'r-mkt',client_qc:'r-cqc',executive:'r-exec',agronomy_admin:'r-agro',agronomy_viewer:'r-agro'};
var ADM_VISION_KEYS=Object.keys(ADM_PERM_LABELS).filter(function(k){return !ADM_CRM_SET[k];});
var ADM_CRM_KEYS=Object.keys(ADM_PERM_LABELS).filter(function(k){return ADM_CRM_SET[k];});
var ADM_TEST_RE=/\b(test|testing|dummy|demo)\b|^test|test@|\+test/i;
var ADM_PAGE=20;
var ADM_ST_GROUPS=[
  {k:'sites',label:'Sites',items:[['packhouses','Packhouses'],['farms','Farms']]},
  {k:'catalogue',label:'Catalogue',items:[['products','Products'],['categories','Categories'],['varieties','Varieties'],['classes','Classes'],['cartonTypes','Carton types']]},
  {k:'clients',label:'Clients',items:[['clients','Clients'],['subClients','Sub-clients'],['countries','Countries']]},
  {k:'season',label:'Season & forms',items:[['seasons','Seasons'],['inspection','Inspection form'],['clientqc','Client QC form'],['grapes','Grapes options']]},
  {k:'tools',label:'Tools',items:[['schemadoc','Schema doc']]}
];
var ADM_LIST_TABLE={clients:'clients',countries:'countries',farms:'farms',classes:'classes',cartonTypes:'carton_types'};
var ADM_IN_VISION={}; /* every Vision settings editor now lives in Workspace */

var AD={
  me:null,built:false,sec:'users',
  users:null,usersErr:'',regions:[],regMem:{},regMgr:{},
  aa:null,aaErr:'',aaAcc:{},aaReq:{},aaBusy:'',
  cfg:null,cfgErr:'',
  f:{q:'',role:'',app:'',status:'active',test:false,page:0},
  rowMenu:null,drawer:null,dlg:null,
  mxApp:'all',aaQ:'',
  st:{sub:'packhouses',q:'',test:false,pend:{},pendVar:{},nv:{},busy:false}
};

/* ── helpers ───────────────────────────────────────────────────────────── */
function aEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function aIni(n){return (n||'?').split(' ').filter(Boolean).map(function(w){return w[0];}).slice(0,2).join('').toUpperCase()||'?';}
function aPerms(r){return (ADM_ROLES[r]||{}).perms||{};}
function aRoleLabel(r){return (ADM_ROLES[r]||{}).label||r||'—';}
function aRolePill(r){return '<span class="rp '+(ADM_ROLE_CLS[r]||'r-qc')+'">'+aEsc(aRoleLabel(r))+'</span>';}
function aHasVision(r){var p=aPerms(r);return ADM_VISION_KEYS.some(function(k){return p[k];});}
function aHasCom(r){return !!aPerms(r).viewCRM;}
function aLc(r){if(ADM_LC_ROWS[2].roles[r])return 'view, edit & approve';if(ADM_LC_ROWS[1].roles[r])return 'view & edit';if(ADM_LC_ROWS[0].roles[r])return 'view only';return '';}
function aIsTest(){for(var i=0;i<arguments.length;i++){if(ADM_TEST_RE.test(String(arguments[i]||'')))return true;}return false;}
function aDate(v,withTime){if(!v||v==='Never')return 'Never';var d=new Date(v);if(isNaN(d.getTime()))return String(v);
  try{return new Intl.DateTimeFormat('en-GB',withTime?{timeZone:'Africa/Cairo',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}:{timeZone:'Africa/Cairo',day:'numeric',month:'short',year:'numeric'}).format(d)+(withTime?' (Cairo)':'');}catch(e){return d.toISOString().slice(0,10);}}
function aToast(msg,bad){var t=document.createElement('div');t.className='toast'+(bad?' bad':'');t.setAttribute('role',bad?'alert':'status');t.textContent=msg;var host=document.getElementById('adminStage')||document.body;host.appendChild(t);setTimeout(function(){t.remove();},bad?6000:2600);}
function aPaint(el,html){if(!el)return;var ae=document.activeElement,fid=ae&&el.contains(ae)?ae.getAttribute('data-fid'):null,s=null,e=null;
  try{if(fid&&typeof ae.selectionStart==='number'){s=ae.selectionStart;e=ae.selectionEnd;}}catch(_){}
  var sk={};[].forEach.call(el.querySelectorAll('[data-sk]'),function(n){sk[n.getAttribute('data-sk')]=[n.scrollTop,n.scrollLeft];});
  el.innerHTML=html;
  [].forEach.call(el.querySelectorAll('[data-sk]'),function(n){var v=sk[n.getAttribute('data-sk')];if(v){n.scrollTop=v[0];n.scrollLeft=v[1];}});
  if(fid){var n=el.querySelector('[data-fid="'+fid+'"]');if(n){n.focus();if(s!==null)try{n.setSelectionRange(s,e);}catch(_){}}}}
function aSame(a,b){return (a||[]).slice().sort().join('|')===(b||[]).slice().sort().join('|');}
function aSel(name,label,opts,val,extra){return '<label class="fl'+(extra||'')+'"><span>'+label+'</span><select data-fid="'+name+'" data-ch="'+name+'">'+opts.map(function(o){return '<option value="'+aEsc(o[0])+'"'+(String(o[0])===String(val)?' selected':'')+'>'+aEsc(o[1])+'</option>';}).join('')+'</select></label>';}
function aSwitch(act,on,label){return '<button type="button" class="sw-row" role="switch" aria-checked="'+(on?'true':'false')+'" data-act="'+act+'" data-fid="'+act+'"><span class="sw"></span>'+label+'</button>';}
function aLoading(n,label){var h='<div class="card" aria-busy="true">';for(var i=0;i<(n||4);i++)h+='<div class="skrow"><span class="c"></span><div style="flex:1"><div class="sk" style="width:'+(45+i*7%30)+'%"></div><div class="sk" style="width:'+(70+i*5%20)+'%"></div></div></div>';return h+'<div class="tfoot" role="status">'+aEsc(label||'Loading…')+'</div></div>';}
/* Users loading state: skeleton rows shaped like the table (desktop) / cards (phone). */
function aUsersSkel(){var w=[[52,70,38,64],[44,62,46,58],[58,74,34,70],[40,56,42,52],[50,68,40,66],[46,60,36,60]],t='',m='';
  w.forEach(function(x){
    t+='<div class="skrow skt"><span class="c"></span><div style="flex:0 0 24%"><div class="sk" style="width:'+x[0]+'%"></div><div class="sk" style="width:'+x[1]+'%"></div></div><div style="flex:0 0 14%"><div class="sk pill"></div></div><div style="flex:1"><div class="sk" style="width:'+x[3]+'%"></div><div class="sk" style="width:'+x[2]+'%"></div></div><div style="flex:0 0 10%"><div class="sk" style="width:80%"></div></div></div>';
    m+='<div class="skrow skm"><span class="c"></span><div style="flex:1"><div class="sk" style="width:'+x[0]+'%"></div><div class="sk" style="width:'+x[1]+'%"></div><div class="sk pill"></div><div class="sk" style="width:'+x[3]+'%"></div></div></div>';});
  return '<div class="card uskel" aria-busy="true"><div class="utable">'+t+'</div><div class="ucards">'+m+'</div><div class="tfoot" role="status">Loading users…</div></div>';}
/* Every write ends in .select(): an error OR zero returned rows is a failure (RLS can
   silently match nothing and PostgREST still answers 200). Returns the rows or throws. */
function aChk(r,what){var pre=what?what+': ':'';
  if(r&&r.error)throw new Error(pre+(r.error.message||'error'));
  if(!r||!r.data||(Array.isArray(r.data)&&!r.data.length))throw new Error(pre+'nothing was changed (0 rows) — you may not have permission, or it was already changed. Reload and try again.');
  return r.data;}
function aEmpty(title,sub,btn){return '<div class="card empty"><div class="big" aria-hidden="true">⌕</div><b>'+aEsc(title)+'</b>'+(sub?'<p>'+aEsc(sub)+'</p>':'')+(btn||'')+'</div>';}
function aError(title,act){return '<div class="card empty err" role="alert"><div class="big" aria-hidden="true">⚠</div><b>'+aEsc(title)+'</b><p>Check your connection and try again. Nothing was changed.</p><button type="button" class="adm-btn pri" data-act="'+act+'">↻ Retry</button></div>';}

/* ── data (same reads as Vision) ───────────────────────────────────────── */
function admLoadUsers(){
  AD.usersErr='';
  /* Vision App(): users loader */
  return Promise.resolve(sb.from('users').select('*, user_packhouse_access(packhouse_id)').order('full_name')).then(function(res){
    if(res.error)throw res.error;
    AD.users=(res.data||[]).map(function(u){
      var isAll=!!ADM_ALL_PH[u.role];
      var phs=isAll?['All']:(u.user_packhouse_access&&u.user_packhouse_access.length?u.user_packhouse_access.map(function(p){return p.packhouse_id;}):['All']);
      return {id:u.id,name:u.full_name||'',email:u.email||'',role:u.role,packhouses:phs,phRows:(u.user_packhouse_access||[]).length,active:u.active,lastLogin:u.last_login||'Never'};
    });
  }).catch(function(e){AD.usersErr=(e&&e.message)||'Load failed';if(!AD.users)AD.users=null;}).then(admRender);
}
function admLoadRegions(){
  /* Vision AdminCenter: regions + region_members */
  return Promise.all([
    sb.from('regions').select('id,label,is_bucket').order('is_bucket').order('label'),
    sb.from('region_members').select('user_id,region_id,is_manager')
  ]).then(function(rs){
    if(rs[0].data)AD.regions=rs[0].data;
    if(rs[1].data){var m={},mg={};rs[1].data.forEach(function(x){(m[x.user_id]=m[x.user_id]||[]).push(x.region_id);if(x.is_manager)(mg[x.user_id]=mg[x.user_id]||[]).push(x.region_id);});AD.regMem=m;AD.regMgr=mg;}
  }).catch(function(){}).then(admRender);
}
function admLoadAA(){
  AD.aaErr='';
  /* Vision AnalyticsAccessPanel */
  return Promise.resolve(sb.rpc('list_analytics_access_admin')).then(function(r){
    if(r&&r.error)throw r.error;
    AD.aa=(r&&r.data)?r.data:{requests:[],access:[]};
    AD.aaAcc={};(AD.aa.access||[]).forEach(function(a){AD.aaAcc[a.user_id]=a;});
    AD.aaReq={};(AD.aa.requests||[]).forEach(function(q){if(q.user_id)AD.aaReq['id:'+q.user_id]=q;if(q.email)AD.aaReq[String(q.email).toLowerCase()]=q;});
  }).catch(function(e){AD.aaErr=(e&&e.message)||'Load failed';}).then(admRender);
}
function admLoadCfg(){
  AD.cfgErr='';
  /* Vision loadConfigFromDB — the lookup lists the settings screens need */
  return Promise.all([
    sb.from('packhouses').select('*').eq('active',true).order('name'),
    sb.from('products').select('*').eq('active',true).order('name'),
    sb.from('varieties').select('*').order('name'),
    sb.from('clients').select('*').order('name'),
    sb.from('sub_clients').select('*').eq('active',true).order('name'),
    sb.from('countries').select('*').order('name'),
    sb.from('farms').select('*').order('name'),
    sb.from('classes').select('*').order('name'),
    sb.from('carton_types').select('*').order('name'),
    sb.from('seasons').select('*').order('name'),
    sb.from('categories').select('*').eq('active',true).order('name')
  ]).then(function(rs){
    var bad=rs.filter(function(r){return r.error;})[0];if(bad)throw bad.error;
    var phs=rs[0].data||[],prods=rs[1].data||[],vars=rs[2].data||[],clients=rs[3].data||[],subs=rs[4].data||[];
    var cats={};(rs[10].data||[]).forEach(function(c){(cats[c.product_id]=cats[c.product_id]||[]).push({id:c.id,name:c.name});});
    var vf={};vars.forEach(function(v){if(v.active===false)return;(vf[v.product_id]=vf[v.product_id]||[]).push({id:v.id,name:v.name,categoryId:v.category_id||null});});
    var cIdMap={},cIdToName={};clients.forEach(function(c){cIdMap[c.name]=c.id;cIdToName[c.id]=c.name;});
    function act(list){return list.filter(function(x){return x.active!==false;}).map(function(x){return x.name;});}
    AD.cfg={
      packhouses:phs.map(function(p){return {id:p.id,name:p.name,color:p.color||'#2b5c3f',initials:p.initials||String(p.id).slice(0,2).toUpperCase(),palletPrefix:p.pallet_prefix||'',crops:(p.product_ids&&p.product_ids.length)?p.product_ids:prods.map(function(x){return x.id;}),active:p.active};}),
      products:prods.map(function(p){return {id:p.id,dbId:p.id,name:p.name,prefix:p.inspection_prefix||String(p.id).slice(0,2).toUpperCase(),color:p.color||'#3a7a4a',active:p.active};}),
      categories:cats,varietiesFull:vf,
      clients:act(clients),clientsIdMap:cIdMap,clientsIdToName:cIdToName,
      subClients:subs.map(function(s){return {id:s.id,name:s.name,clientId:s.client_id};}),
      countries:act(rs[5].data||[]),farms:act(rs[6].data||[]),classes:act(rs[7].data||[]),cartonTypes:act(rs[8].data||[]),
      seasons:(rs[9].data||[]).map(function(s){return {id:s.id,name:s.name,active:s.active};})
    };
  }).catch(function(e){AD.cfgErr=(e&&e.message)||'Load failed';}).then(admRender);
}
function admSubParents(){var c=AD.cfg,seen={},l=[];(c.subClients||[]).forEach(function(s){var n=c.clientsIdToName[s.clientId];if(n&&!seen[n]){seen[n]=1;l.push(n);}});(c.clients||[]).forEach(function(n){if(!seen[n]){seen[n]=1;l.push(n);}});return l.sort(function(a,b){return a.localeCompare(b);});}

/* ── access in plain words ─────────────────────────────────────────────── */
function aAnalytics(u){if(u.role==='admin')return 'auto';if(!AD.aa)return '';if(AD.aaAcc[u.id])return 'yes';if(AD.aaReq['id:'+u.id]||AD.aaReq[String(u.email).toLowerCase()])return 'pending';return 'no';}
function aActivePH(){return AD.cfg?AD.cfg.packhouses.filter(function(p){return p.active!==false;}):[];}
function aPhName(id){var p=AD.cfg&&AD.cfg.packhouses.filter(function(x){return x.id===id;})[0];return p?p.name:id;}
function aPhWords(role,phs){
  if(ADM_ALL_PH[role]||!phs||phs[0]==='All')return 'all packhouses';
  var all=aActivePH().map(function(p){return p.id;});
  if(all.length&&all.every(function(id){return phs.indexOf(id)>=0;}))return 'all packhouses';
  if(phs.length<=2)return phs.map(aPhName).join(', ');
  return phs.length+' packhouses';
}
function aRegLabel(id){var r=AD.regions.filter(function(x){return x.id===id;})[0];return r?r.label:id;}
function aRegWords(role,mem){
  if(role==='admin'||role==='power_user')return 'all regions';
  mem=mem||[];if(!mem.length)return 'no regions yet';
  if(AD.regions.length&&mem.length>=AD.regions.length)return 'all regions';
  if(mem.length<=2)return mem.map(aRegLabel).join(', ');
  return mem.length+' regions';
}
function aAppsOf(u){var a=aAnalytics(u);return {vision:aHasVision(u.role),analytics:a==='auto'||a==='yes',commercial:aHasCom(u.role),landcloud:!!aLc(u.role)};}
function aAccessWords(u){
  var on=[],off=[];
  if(aHasVision(u.role))on.push('<b>Vision:</b> '+aEsc(aPhWords(u.role,u.packhouses)));else off.push('Vision');
  var a=aAnalytics(u);
  if(a==='auto')on.push('<b>Analytics:</b> yes (admin)');else if(a==='yes')on.push('<b>Analytics:</b> yes');else if(a==='pending')on.push('<b>Analytics:</b> requested');else if(a==='no')off.push('Analytics');
  if(aHasCom(u.role))on.push('<b>Commercial:</b> '+aEsc(aRegWords(u.role,AD.regMem[u.id])));else off.push('Commercial');
  var lc=aLc(u.role);if(lc)on.push('<b>Land Cloud:</b> '+lc);else off.push('Land Cloud');
  return (on.join(' · ')||'<span class="na">No app access</span>')+(off.length&&on.length?'<span class="na"> · No access: '+off.join(', ')+'</span>':'');
}

/* ── filters ───────────────────────────────────────────────────────────── */
function aVisibleUsers(){
  var f=AD.f,q=f.q.trim().toLowerCase();
  return (AD.users||[]).filter(function(u){
    if(!f.test&&aIsTest(u.name,u.email))return false;
    if(f.status==='active'&&!u.active)return false;
    if(f.status==='inactive'&&u.active)return false;
    if(f.role&&u.role!==f.role)return false;
    if(f.app){var ap=aAppsOf(u);if(f.app==='none'){if(ap.vision||ap.analytics||ap.commercial||ap.landcloud)return false;}else if(!ap[f.app])return false;}
    if(q){var rl=aRoleLabel(u.role).toLowerCase();if(u.name.toLowerCase().indexOf(q)<0&&u.email.toLowerCase().indexOf(q)<0&&rl.indexOf(q)<0)return false;}
    return true;
  });
}

/* ── render: shell ─────────────────────────────────────────────────────── */
function admBuild(){
  var st=document.getElementById('adminStage');
  st.innerHTML=
    '<header class="adm-hdr">'+
      '<div class="adm-word desk">Dal<i>OS</i> <small>Workspace</small></div>'+
      '<div class="adm-word mob" aria-hidden="true">Dal<i>OS</i></div>'+
      '<span class="staging-badge"><span class="staging-dot"></span>Staging</span>'+
      '<a class="adm-back" href="./" data-act="home">← Workspace</a>'+
      '<div class="hsp"></div>'+
      '<button type="button" class="adm-btn so" data-act="signout">⏻ Sign out</button>'+
      '<div class="ws-avwrap"><button type="button" class="adm-av" id="admAv"></button></div>'+
    '</header>'+
    '<div class="adm-shell"><nav class="adm-side" id="admSide" aria-label="Admin sections"></nav>'+
    '<main class="adm-main" id="admMain" tabindex="-1"></main></div>'+
    '<div id="admLayer"></div>';
  st.addEventListener('click',admClick);
  st.addEventListener('change',admChange);
  st.addEventListener('input',admInput);
  st.addEventListener('keydown',admKey);
  st.addEventListener('dragstart',admDragStart);
  st.addEventListener('dragover',admDragOver);
  st.addEventListener('drop',admDrop);
  st.addEventListener('dragend',function(){AD._drag=null;});
  document.addEventListener('mousedown',function(e){if(AD.rowMenu&&!e.target.closest('.kw')){AD.rowMenu=null;admRender();}},true);
  /* staged settings / drawer edits: warn before the tab is closed or reloaded */
  window.addEventListener('beforeunload',function(e){if(aStPendCount()||admChanges().length||feChanges('insp').length||feChanges('cqc').length||grCount()){e.preventDefault();e.returnValue='';}});
  var av=document.getElementById('admAv');
  try{wsBindAvatar(av);}catch(e){}
  AD.built=true;
}
function admSecFromHash(){var m=/^#admin(?:\/([a-z]+))?/.exec(location.hash||'');var s=m&&m[1];return {users:1,perms:1,access:1,activity:1,settings:1}[s]?s:'users';}
/* Called by index.html wsRoute() whenever #admin is shown for an admin. */
function adminShow(user){
  AD.me=user;
  if(!AD.built)admBuild();
  var av=document.getElementById('admAv');if(av){av.textContent=aIni(user.name);av.setAttribute('aria-label','Account menu for '+(user.name||'you'));}
  var prev=AD.sec;AD.sec=admSecFromHash();
  if(AD.users===null&&!AD._usersStarted){AD._usersStarted=1;admLoadUsers();admLoadRegions();admLoadAA();admLoadCfg();}
  AD.rowMenu=null;
  if(AD.sec!=='activity')AD.act.sheet=false;
  if(AD.sec==='activity'&&!AD.act.loaded)actReset();
  admRender();
  if(prev!==AD.sec){var mm=document.getElementById('admMain');if(mm)mm.focus({preventScroll:true});window.scrollTo(0,0);}
}
function admRender(){
  if(!AD.built||document.getElementById('adminStage').style.display==='none')return;
  var pend=AD.aa?(AD.aa.requests||[]).length:0;
  var nUsers=AD.users?AD.users.filter(function(u){return u.active&&!aIsTest(u.name,u.email);}).length:'';
  function L(s,ic,label,extra){return '<a href="#admin/'+s+'"'+(AD.sec===s?' aria-current="page"':'')+'><span aria-hidden="true">'+ic+'</span> '+label+(extra||'')+'</a>';}
  aPaint(document.getElementById('admSide'),
    '<h2>Workspace-wide</h2>'+
    L('users','👤','Users','<span class="n">'+nUsers+'</span>')+
    L('perms','▦','Roles &amp; permissions','<span class="n">'+Object.keys(ADM_ROLES).length+'</span>')+
    L('access','🔑','App access',pend?'<span class="badge" style="margin-left:auto" aria-label="'+pend+' waiting">'+pend+'</span>':'')+
    L('activity','🕘','Activity log')+
    '<h2>App settings</h2>'+
    L('settings','❦','Vision','<span class="n">'+ADM_ST_GROUPS.reduce(function(a,g){return a+g.items.length;},0)+'</span>'));
  var h='';
  if(AD.sec==='users')h=admUsersHTML();
  else if(AD.sec==='perms')h=admPermsHTML();
  else if(AD.sec==='access')h=admAccessHTML();
  else if(AD.sec==='activity')h=admActivityHTML();
  else h=admSettingsHTML();
  aPaint(document.getElementById('admMain'),h);
  aPaint(document.getElementById('admLayer'),admLayerHTML());
  var mx=document.querySelector('#admMain .mx');
  if(mx){var sc=mx.querySelector('.mxs');var upd=function(){mx.classList.toggle('atend',sc.scrollLeft+sc.clientWidth>=sc.scrollWidth-4);};sc.addEventListener('scroll',upd,{passive:true});upd();}
  var rm=document.querySelector('#admMain .rmenu');if(rm&&AD._focusMenu){AD._focusMenu=0;var b=rm.querySelector('button');if(b)b.focus();}
  if(AD._focusAct){AD._focusAct=0;var af=document.querySelector('#admMain .act-f.open [data-autofocus]');if(af&&af.offsetParent)af.focus();}
  if(AD._focusLayer){AD._focusLayer=0;var lf=document.querySelector('#admLayer [data-autofocus]');if(lf)lf.focus();}
}

/* ── Users ─────────────────────────────────────────────────────────────── */
function admUsersHTML(){
  var f=AD.f,h='<div class="crumb">Workspace / Admin</div>'+
    '<div class="ptrow"><div><h1 class="pt">Users</h1><p class="sub">Who can sign in to DalOS, their role, and which apps and sites they can see.</p></div><div class="hsp"></div><button type="button" class="adm-btn pri" data-act="adduser">+ Add user</button></div>';
  if(AD.users===null&&AD.usersErr)return h+aError("Couldn't load users",'retry-users');
  if(AD.users===null)return h+aUsersSkel();
  var base=AD.users.filter(function(u){return f.test||!aIsTest(u.name,u.email);});
  var act=base.filter(function(u){return u.active;}),inact=base.length-act.length;
  h+='<div class="chiprow" data-sk="chips" role="group" aria-label="Filter by role">';
  h+='<button type="button" class="chip" aria-pressed="'+(!f.role&&f.status!=='inactive')+'" data-act="chip" data-arg="">All <span class="c">'+act.length+'</span></button>';
  Object.keys(ADM_ROLES).forEach(function(rk){var n=act.filter(function(u){return u.role===rk;}).length;if(n)h+='<button type="button" class="chip" aria-pressed="'+(f.role===rk)+'" data-act="chip" data-arg="'+rk+'">'+aEsc(ADM_ROLES[rk].label)+' <span class="c">'+n+'</span></button>';});
  h+='<button type="button" class="chip inact" aria-pressed="'+(!f.role&&f.status==='inactive')+'" data-act="chip" data-arg="__inactive">Inactive <span class="c">'+inact+'</span></button></div>';
  h+='<div class="toolbar"><label class="fl search"><span>Search</span><input class="inp" type="search" data-fid="uq" data-in="uq" value="'+aEsc(f.q)+'" placeholder="Name, email or role" autocomplete="off"></label>'+
    aSel('urole','Role',[['','Any']].concat(Object.keys(ADM_ROLES).map(function(k){return [k,ADM_ROLES[k].label];})),f.role)+
    aSel('uapp','App',[['','Any'],['vision','Vision'],['analytics','Analytics'],['commercial','Commercial'],['landcloud','Land Cloud'],['none','No app access']],f.app)+
    aSel('ustatus','Status',[['active','Active'],['inactive','Inactive'],['any','Any']],f.status)+
    aSwitch('utest',f.test,'Show test data')+'</div>';
  if(AD.usersErr)h+='<div class="ferr" role="alert">Couldn’t refresh users: '+aEsc(AD.usersErr)+' <button type="button" class="adm-btn" data-act="retry-users">↻ Retry</button></div>';
  var list=aVisibleUsers(),hiddenTest=f.test?0:AD.users.filter(function(u){return aIsTest(u.name,u.email);}).length;
  if(!list.length){
    var parts=[];if(f.q)parts.push('Search: “'+f.q+'”');if(f.role)parts.push('Role: '+aRoleLabel(f.role));if(f.app)parts.push('App: '+f.app);parts.push('Status: '+f.status);
    return h+aEmpty('No users match these filters',parts.join(' · '),'<button type="button" class="adm-btn" data-act="clearf">Clear filters</button>');
  }
  var pages=Math.max(1,Math.ceil(list.length/ADM_PAGE));if(f.page>=pages)f.page=pages-1;
  var slice=list.slice(f.page*ADM_PAGE,(f.page+1)*ADM_PAGE),selId=AD.drawer&&AD.drawer.uid;
  h+='<div class="card utable"><table class="tbl"><caption class="sr">Users</caption><thead><tr><th scope="col" style="width:26%">Name</th><th scope="col" style="width:17%">Role</th><th scope="col">Access</th><th scope="col" style="width:12%">Last login</th><th scope="col" style="width:9%">Status</th><th scope="col" style="width:62px"><span class="sr">Actions</span></th></tr></thead><tbody>';
  slice.forEach(function(u){
    h+='<tr data-act="edit" data-arg="'+u.id+'"'+(selId===u.id?' class="rsel"':'')+'><td><div class="u"><span class="av" aria-hidden="true">'+aEsc(aIni(u.name))+'</span><div><b>'+aEsc(u.name||'—')+(aIsTest(u.name,u.email)?'<span class="testtag">test</span>':'')+'</b><small>'+aEsc(u.email)+'</small></div></div></td>'+
      '<td>'+aRolePill(u.role)+'</td><td class="acc">'+aAccessWords(u)+'</td>'+
      '<td style="color:var(--mu)" title="'+aEsc(aDate(u.lastLogin,true))+'">'+aEsc(aDate(u.lastLogin))+'</td>'+
      '<td><span class="st'+(u.active?'':' off')+'">'+(u.active?'Active':'Inactive')+'</span></td>'+
      '<td>'+admKebab(u)+'</td></tr>';
  });
  h+='</tbody></table>'+admPager(list.length,pages,hiddenTest)+'</div>';
  h+='<div class="card ucards">';
  slice.forEach(function(u){
    h+='<div class="ucard" role="button" tabindex="0" aria-label="Edit '+aEsc(u.name)+'" data-act="edit" data-arg="'+u.id+'"><span class="av" aria-hidden="true">'+aEsc(aIni(u.name))+'</span><div class="bd"><b>'+aEsc(u.name||'—')+(aIsTest(u.name,u.email)?'<span class="testtag">test</span>':'')+'</b><small class="small">'+aEsc(u.email)+'</small>'+
      '<div class="ln">'+aRolePill(u.role)+'<span class="st'+(u.active?'':' off')+'">'+(u.active?'Active':'Inactive')+'</span>'+admLastLogin(u)+'</div><div class="acc">'+aAccessWords(u)+'</div></div>'+admKebab(u,'m')+'</div>';
  });
  h+=admPager(list.length,pages,hiddenTest)+'</div>';
  return h;
}
/* Phone card: a labelled item (no leading "·" — it wrapped to a new line and read as "· 23 Sept 2026"). */
function admLastLogin(u){var d=aDate(u.lastLogin);return '<span class="ll">'+(d==='Never'?'Never logged in':'Last login '+aEsc(d))+'</span>';}
function admPager(n,pages,hid){var f=AD.f,from=f.page*ADM_PAGE+1,to=Math.min(n,(f.page+1)*ADM_PAGE);
  return '<div class="tfoot"><span>Showing '+from+'–'+to+' of '+n+(hid?' · '+hid+' test account'+(hid===1?'':'s')+' hidden':'')+'</span>'+(pages>1?'<span class="pager"><button type="button" class="adm-btn" data-act="pg" data-arg="-1"'+(f.page===0?' disabled':'')+'>← Prev</button>Page '+(f.page+1)+' of '+pages+'<button type="button" class="adm-btn" data-act="pg" data-arg="1"'+(f.page>=pages-1?' disabled':'')+'>Next →</button></span>':'')+'</div>';}
function admKebab(u,sfx){
  var id=u.id+(sfx||''),open=AD.rowMenu===id,self=AD.me&&u.id===AD.me.id;
  var h='<div class="kw"><button type="button" class="keb" aria-haspopup="menu" aria-expanded="'+open+'" aria-label="Actions for '+aEsc(u.name)+'" data-act="kebab" data-arg="'+id+'" data-fid="keb-'+id+'">⋯</button>';
  if(open){h+='<div class="rmenu" role="menu" aria-label="Actions for '+aEsc(u.name)+'">'+
    '<button type="button" role="menuitem" data-act="edit" data-arg="'+u.id+'">✎ Edit user</button>'+
    '<button type="button" role="menuitem" data-act="resetpw" data-arg="'+u.id+'">🔒 Reset password</button><hr>'+
    (self?'<button type="button" role="menuitem" disabled>⊘ You can’t deactivate yourself</button>':
      u.active?'<button type="button" role="menuitem" class="red" data-act="deact" data-arg="'+u.id+'">⊘ Deactivate…</button>':'<button type="button" role="menuitem" data-act="react" data-arg="'+u.id+'">↺ Reactivate</button>')+
    '</div>';}
  return h+'</div>';
}
function aUser(id){return (AD.users||[]).filter(function(u){return u.id===id;})[0];}

/* drawer (edit / add) */
function admOpenEdit(uid){
  var u=aUser(uid);if(!u)return;
  var o={role:u.role,phs:(u.packhouses||['All']).slice(),regs:(AD.regMem[uid]||[]).slice(),mgrs:(AD.regMgr[uid]||[]).slice()};
  AD.drawer={mode:'edit',uid:uid,orig:o,d:JSON.parse(JSON.stringify(o)),err:'',busy:false,ret:document.activeElement};
  AD.rowMenu=null;AD._focusLayer=1;admRender();
}
function admChanges(){var D=AD.drawer;if(!D||D.mode!=='edit')return [];var o=D.orig,d=D.d,c=[];
  if(o.role!==d.role)c.push('Role: '+aRoleLabel(o.role)+' → '+aRoleLabel(d.role));
  if(!aSame(o.phs,d.phs)||D.forcePh)c.push('Vision packhouses');
  if(!aSame(o.regs,d.regs))c.push('Commercial regions');
  var mo=o.mgrs.filter(function(x){return d.regs.indexOf(x)>=0;}),md=d.mgrs.filter(function(x){return d.regs.indexOf(x)>=0;});
  if(!aSame(mo,md))c.push('Region managers');
  return c;}
function admDrawerHTML(){
  var D=AD.drawer;if(!D)return '';
  if(D.mode==='add')return admAddHTML();
  var u=aUser(D.uid);if(!u)return '';
  var d=D.d,self=AD.me&&u.id===AD.me.id,ch=admChanges();
  var h='<div class="scrim" data-act="dclose"></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drwT">'+
    '<div class="dh"><span class="av" aria-hidden="true">'+aEsc(aIni(u.name))+'</span><div style="min-width:0"><h2 id="drwT">'+aEsc(u.name||'—')+'</h2><small>'+aEsc(u.email)+' · last login '+aEsc(aDate(u.lastLogin))+'</small></div><div class="hsp"></div><button type="button" class="keb" aria-label="Close" data-act="dclose" data-fid="dclose" data-autofocus>✕</button></div><div class="db" data-sk="drw">';
  if(D.err)h+='<div class="ferr" role="alert">'+aEsc(D.err)+'</div>';
  h+='<div class="fld"><span class="lbl">Full name</span><div class="ro">'+aEsc(u.name||'—')+'</div></div>';
  h+='<div class="fld"><label for="drRole">Role</label><select id="drRole" data-fid="drRole" data-ch="drRole"'+(self?' disabled':'')+'>'+Object.keys(ADM_ROLES).map(function(k){return '<option value="'+k+'"'+(k===d.role?' selected':'')+'>'+aEsc(ADM_ROLES[k].label)+'</option>';}).join('')+'</select>'+
    '<div class="hint">'+(self?'You can’t change your own role here.':'Role sets what they can do in each app. <a href="#admin/perms">See permissions</a>')+'</div></div>';
  h+='<div class="fld"><span class="lbl">App access</span>';
  /* Vision */
  h+='<div class="appacc"><div class="ah"><span class="dot" style="background:var(--gr)"></span><b>Vision</b><span class="val">'+(aHasVision(d.role)?aEsc(aPhWords(d.role,d.phs)):'No access (role)')+'</span></div>';
  if(aHasVision(d.role)){
    if(ADM_ALL_PH[d.role])h+='<div class="ab"><span class="hint" style="margin:0">All packhouses — set by the '+aEsc(aRoleLabel(d.role))+' role.</span></div>';
    else{
      var hasAll=d.phs[0]==='All';
      h+='<div class="ab" role="group" aria-label="Vision packhouses"><button type="button" class="pc'+((d.phs[0]==='All')!==(D.orig.phs[0]==='All')?' chg':'')+'" aria-pressed="'+hasAll+'" data-act="dph" data-arg="All" data-fid="dph-All">All</button>';
      aActivePH().forEach(function(p){var on=!hasAll&&d.phs.indexOf(p.id)>=0,was=D.orig.phs[0]!=='All'&&D.orig.phs.indexOf(p.id)>=0;
        h+='<button type="button" class="pc'+(on!==was?' chg':'')+'" aria-pressed="'+on+'" data-act="dph" data-arg="'+aEsc(p.id)+'" data-fid="dph-'+aEsc(p.id)+'">'+aEsc(p.name)+'</button>';});
      h+='</div>';
    }
  }
  h+='</div>';
  /* Analytics */
  var a=aAnalytics({id:u.id,email:u.email,role:d.role}),acc=AD.aaAcc[u.id];
  h+='<div class="appacc"><div class="ah"><span class="dot" style="background:var(--bl)"></span><b>Analytics</b><span class="val">'+
    (a==='auto'?'Automatic · Admin role':a==='yes'?'Has access'+(acc&&acc.granted_at?' · since '+aEsc(aDate(acc.granted_at)):''):a==='pending'?'Requested · waiting for approval':a==='no'?'No access':'Loading…')+'</span></div>';
  if(a==='yes'&&u.role!=='admin')h+='<div class="ab"><button type="button" class="adm-btn red" data-act="aarevoke" data-arg="'+u.id+'">Remove access…</button></div>';
  else if(a==='pending')h+='<div class="ab"><a class="adm-btn" href="#admin/access" data-act="dgo">Review in App access</a></div>';
  else if(a==='no')h+='<div class="ab"><span class="hint" style="margin:0">People ask for Analytics from its Workspace tile; requests show up in App access.</span></div>';
  h+='</div>';
  /* Commercial */
  h+='<div class="appacc"><div class="ah"><span class="dot" style="background:var(--pu)"></span><b>Commercial</b><span class="val">'+(aHasCom(d.role)?aEsc(aRegWords(d.role,d.regs)):'No access (role)')+'</span></div>';
  if(aHasCom(d.role)&&d.role!=='admin'&&d.role!=='power_user'){
    var allIds=AD.regions.map(function(r){return r.id;}),hasAllR=allIds.length>0&&d.regs.length>=allIds.length;
    h+='<div class="ab" role="group" aria-label="Commercial regions"><button type="button" class="pc" aria-pressed="'+hasAllR+'" data-act="dreg" data-arg="__all" data-fid="dreg-all">All</button>';
    AD.regions.forEach(function(r){var on=d.regs.indexOf(r.id)>=0,was=D.orig.regs.indexOf(r.id)>=0;h+='<button type="button" class="pc'+(on!==was?' chg':'')+'" aria-pressed="'+on+'" data-act="dreg" data-arg="'+aEsc(r.id)+'" data-fid="dreg-'+aEsc(r.id)+'">'+aEsc(r.label)+'</button>';});
    if(!AD.regions.length)h+='<span class="hint" style="margin:0">Loading regions…</span>';
    h+='</div>';
    if(d.regs.length){h+='<div class="ab" role="group" aria-label="Region manager of"><span class="lbl">Manager of (★)</span>';
      d.regs.forEach(function(rid){var on=d.mgrs.indexOf(rid)>=0;h+='<button type="button" class="pc mgr" aria-pressed="'+on+'" data-act="dmgr" data-arg="'+aEsc(rid)+'" data-fid="dmgr-'+aEsc(rid)+'">'+aEsc(aRegLabel(rid))+'</button>';});
      h+='</div>';}
    else h+='<div class="ab"><span class="hint" style="margin:0;color:var(--go)">No regions — they see nothing in Commercial.</span></div>';
  }
  h+='</div>';
  /* Land Cloud */
  var lc=aLc(d.role);
  h+='<div class="appacc"><div class="ah"><span class="dot" style="background:var(--te)"></span><b>Land Cloud</b><span class="val">'+(lc?lc[0].toUpperCase()+lc.slice(1)+' (role)':'No access (role)')+'</span></div></div>';
  h+='</div>';
  h+='<div class="fld"><span class="lbl">Status</span><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><span class="st'+(u.active?'':' off')+'">'+(u.active?'Active':'Inactive')+'</span>'+
    (self?'':u.active?'<button type="button" class="adm-btn red" data-act="deact" data-arg="'+u.id+'">⊘ Deactivate…</button>':'<button type="button" class="adm-btn" data-act="react" data-arg="'+u.id+'">↺ Reactivate</button>')+
    '<button type="button" class="adm-btn ghost" data-act="resetpw" data-arg="'+u.id+'">🔒 Reset password</button></div></div>';
  h+='<div class="fld"><button type="button" class="act-lnk" data-act="actuser" data-arg="'+aEsc(u.id)+'">🕘 Recent activity →</button><div class="hint" style="margin-top:0">Changes made by or to '+aEsc((u.name||'').split(' ')[0]||'this user')+'.</div></div>';
  h+='</div><div class="df"><span class="msg" role="status">'+(ch.length?ch.length+' unsaved change'+(ch.length===1?'':'s'):'No changes')+'</span>'+
    '<button type="button" class="adm-btn" data-act="ddiscard" data-fid="ddiscard"'+(ch.length&&!D.busy?'':' disabled')+'>Discard</button>'+
    '<button type="button" class="adm-btn pri" data-act="dsave" data-fid="dsave"'+(ch.length&&!D.busy?'':' disabled')+'>'+(D.busy?'Saving…':'Save')+'</button></div></aside>';
  return h;
}
function admAddHTML(){
  var D=AD.drawer,v=D.v;
  var phOpts=[['All','All packhouses']].concat(aActivePH().map(function(p){return [p.id,p.name];}));
  var h='<div class="scrim" data-act="dclose"></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drwT">'+
    '<div class="dh"><span class="av" aria-hidden="true">+</span><div><h2 id="drwT">Add user</h2><small>Creates a DalOS account (same as Vision Admin).</small></div><div class="hsp"></div><button type="button" class="keb" aria-label="Close" data-act="dclose" data-autofocus>✕</button></div><div class="db">';
  if(D.err)h+='<div class="ferr" role="alert">'+aEsc(D.err)+'</div>';
  h+='<div class="fld"><span class="lbl">How they get in</span><div class="chips" role="radiogroup" aria-label="How they get in">'+
    '<button type="button" class="pc" role="radio" aria-checked="'+(v.method==='direct')+'" aria-pressed="'+(v.method==='direct')+'" data-act="addm" data-arg="direct">Set password directly</button>'+
    '<button type="button" class="pc" role="radio" aria-checked="'+(v.method==='invite')+'" aria-pressed="'+(v.method==='invite')+'" data-act="addm" data-arg="invite">Send invite email</button></div></div>';
  h+='<div class="fld"><label for="adN">Full name</label><input id="adN" class="inp" data-fid="adN" data-in="add-name" value="'+aEsc(v.name)+'" autocomplete="off"></div>';
  h+='<div class="fld"><label for="adE">Email</label><input id="adE" class="inp" type="email" data-fid="adE" data-in="add-email" value="'+aEsc(v.email)+'" placeholder="name@daltexcorp.com" autocomplete="off"></div>';
  if(v.method==='direct')h+='<div class="fld"><label for="adP">Temporary password</label><input id="adP" class="inp" type="text" data-fid="adP" data-in="add-pw" value="'+aEsc(v.pw)+'" autocomplete="off"></div>';
  h+='<div class="fld"><label for="adR">Role</label><select id="adR" data-fid="adR" data-ch="add-role">'+Object.keys(ADM_ROLES).map(function(k){return '<option value="'+k+'"'+(k===v.role?' selected':'')+'>'+aEsc(ADM_ROLES[k].label)+'</option>';}).join('')+'</select></div>';
  h+='<div class="fld"><label for="adPh">Packhouse</label><select id="adPh" data-fid="adPh" data-ch="add-ph">'+phOpts.map(function(o){return '<option value="'+aEsc(o[0])+'"'+(o[0]===v.ph?' selected':'')+'>'+aEsc(o[1])+'</option>';}).join('')+'</select></div>';
  if(v.method==='invite')h+='<p class="hint">An invite link is sent from vision@daltexcorp.com. They set their own password.</p>';
  var ok=v.name.trim()&&v.email.trim()&&(v.method==='invite'||v.pw);
  h+='</div><div class="df"><span class="msg"></span><button type="button" class="adm-btn" data-act="dclose">Cancel</button><button type="button" class="adm-btn pri" data-act="addsave"'+(ok&&!D.busy?'':' disabled')+'>'+(D.busy?'Saving…':'Create user')+'</button></div></aside>';
  return h;
}
function admCloseDrawer(force){
  var D=AD.drawer;if(!D)return;
  if(!force&&D.mode==='edit'&&admChanges().length){
    admConfirm({title:'Discard changes?',text:'Your unsaved changes to '+((aUser(D.uid)||{}).name||'this user')+' will be lost.',ok:'Discard',danger:true,run:function(){admCloseDrawer(true);return Promise.resolve();}});return;
  }
  var ret=D.ret;AD.drawer=null;admRender();if(ret&&document.body.contains(ret))try{ret.focus();}catch(e){}
}
/* Vision togglePHForUser — applied to the draft */
function admDraftPH(ph){var d=AD.drawer.d,phs=d.phs.slice(),n;
  if(ph==='All')n=['All'];else{var w=phs.filter(function(p){return p!=='All';}),i=w.indexOf(ph);n=i>=0?w.filter(function(p){return p!==ph;}):w.concat([ph]);if(!n.length)n=['All'];}
  d.phs=n;}
function admDraftReg(rid){var d=AD.drawer.d,cur=d.regs.slice(),all=AD.regions.map(function(r){return r.id;});
  if(rid==='__all')d.regs=(all.length&&cur.length>=all.length)?[]:all.slice();
  else d.regs=cur.indexOf(rid)>=0?cur.filter(function(x){return x!==rid;}):cur.concat([rid]);
  d.mgrs=d.mgrs.filter(function(x){return d.regs.indexOf(x)>=0;});}
function admSaveDrawer(){
  var D=AD.drawer,uid=D.uid,o=D.orig,d=D.d,errs=[],phLost=false,u0=aUser(uid)||{};
  D.busy=true;D.err='';admRender();
  /* one write; resolves rows, or null after recording the failure (error or < min rows) */
  function step(what,q,min){return Promise.resolve(q).then(function(r){
      if(r&&r.error){errs.push(what+': '+r.error.message);return null;}
      var n=r&&Array.isArray(r.data)?r.data.length:0;if(min==null)min=1;
      if(n<min){errs.push(what+': nothing was changed ('+n+' row'+(n===1?'':'s')+' returned — you may not have permission)');return null;}
      return r.data||[];
    },function(e){errs.push(what+': '+((e&&e.message)||'network error'));return null;});}
  var p=Promise.resolve();
  if(o.role!==d.role)p=p.then(function(){return step('Role',sb.from('users').update({role:d.role}).eq('id',uid).select('id'));});
  if(!aSame(o.phs,d.phs)||D.forcePh)p=p.then(function(){
    var newPhs=d.phs,isAll=!!ADM_ALL_PH[d.role],had=u0.phRows||0;
    /* Vision's delete-then-insert. A user with no rows legitimately deletes 0. */
    return step('Packhouses',sb.from('user_packhouse_access').delete().eq('user_id',uid).select('packhouse_id'),had?1:0).then(function(del){
      if(del===null)return; /* nothing deleted → old list still in place */
      var ins=null,want=0;
      if(newPhs[0]==='All'&&!isAll){
        ins=sb.from('packhouses').select('id').eq('active',true).then(function(pr){
          if(pr.error||!pr.data||!pr.data.length)return {error:{message:pr.error?pr.error.message:'no active packhouses found'}};
          want=pr.data.length;
          return sb.from('user_packhouse_access').insert(pr.data.map(function(x){return {user_id:uid,packhouse_id:x.id};})).select('packhouse_id');
        });
      }else if(newPhs[0]!=='All'){
        want=newPhs.length;
        ins=sb.from('user_packhouse_access').insert(newPhs.map(function(x){return {user_id:uid,packhouse_id:x};})).select('packhouse_id');
      }
      if(!ins)return;
      return step('Packhouses',ins,1).then(function(rows){if(rows===null||rows.length<want)phLost=true;});
    });
  });
  var toAdd=d.regs.filter(function(x){return o.regs.indexOf(x)<0;}),toDel=o.regs.filter(function(x){return d.regs.indexOf(x)<0;});
  if(toAdd.length)p=p.then(function(){return step('Regions',sb.from('region_members').upsert(toAdd.map(function(rid){return {user_id:uid,region_id:rid,is_manager:false};}),{onConflict:'user_id,region_id'}).select('region_id'),toAdd.length);});
  if(toDel.length)p=p.then(function(){return Promise.all(toDel.map(function(rid){return step('Regions',sb.from('region_members').delete().eq('user_id',uid).eq('region_id',rid).select('region_id'));}));});
  var mgrUpd=d.regs.filter(function(rid){var want=d.mgrs.indexOf(rid)>=0,had=o.regs.indexOf(rid)>=0&&o.mgrs.indexOf(rid)>=0;return want!==had;});
  if(mgrUpd.length)p=p.then(function(){return Promise.all(mgrUpd.map(function(rid){return step('Region manager',sb.from('region_members').update({is_manager:d.mgrs.indexOf(rid)>=0}).eq('user_id',uid).eq('region_id',rid).select('region_id'));}));});
  p.catch(function(e){errs.push((e&&e.message)||'Network error');}).then(function(){
    return Promise.all([admLoadUsers(),admLoadRegions()]);
  }).then(function(){
    if(!AD.drawer||AD.drawer.uid!==uid)return;
    var D2=AD.drawer;
    if(errs.length){D2.busy=false;
      var nm=(aUser(uid)||u0).name||'This user';
      D2.err=(phLost?'⚠ '+nm+' now has NO Vision packhouses: the old list was removed but the new one did not save. Check the packhouses below and press Save again. ':'')+'Not saved: '+errs.join(' · ');
      D2.forcePh=phLost;
      var u=aUser(uid);if(u){D2.orig={role:u.role,phs:u.packhouses.slice(),regs:(AD.regMem[uid]||[]).slice(),mgrs:(AD.regMgr[uid]||[]).slice()};}
      admRender();
      aToast(phLost?nm+' has no packhouses now. Re-save their packhouses.':'Some changes were not saved.',true);}
    else{D2.forcePh=false;admCloseDrawer(true);aToast('Saved');}
  });
}
/* Vision addUser — create-user edge function */
function admAddSave(){
  var D=AD.drawer,v=D.v;D.busy=true;D.err='';admRender();
  sb.auth.getSession().then(function(s){
    var tok=s&&s.data&&s.data.session&&s.data.session.access_token;
    if(!tok)throw new Error('Not authenticated.');
    var body={email:v.email.trim(),full_name:v.name.trim(),role:v.role,packhouse_id:v.ph,send_invite:v.method==='invite'};
    if(v.method==='direct')body.password=v.pw;
    return fetch(DALOS_SUPABASE_URL+'/functions/v1/create-user',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify(body)})
      .then(function(r){return r.json().then(function(dd){return {ok:r.ok,data:dd};});});
  }).then(function(res){
    if(!res.ok)throw new Error('Error: '+((res.data&&res.data.error)||'Unknown error'));
    var snap={name:v.name.trim(),email:v.email.trim(),role:aRoleLabel(v.role),pw:v.pw,method:v.method};
    AD.drawer=null;var ld=admLoadUsers();
    if(snap.method==='direct'){
      ld.then(function(){var em=snap.email.toLowerCase(),nu=(AD.users||[]).filter(function(x){return String(x.email).toLowerCase()===em;})[0];if(nu)actLog('user.invite_email_prepared',nu.id,{method:'prepared_email'});});
      admEmailDlg('invite',snap);}else aToast('Invite sent to '+snap.email);
  }).catch(function(e){if(AD.drawer){AD.drawer.busy=false;AD.drawer.err=(e&&e.message)||'Failed';admRender();}});
}

/* ── dialogs ───────────────────────────────────────────────────────────── */
function admConfirm(o){o.ret=document.activeElement;o.kind='confirm';AD.dlg=o;AD._focusLayer=1;admRender();}
function admCloseDlg(){var r=AD.dlg&&AD.dlg.ret;AD.dlg=null;admRender();if(r&&document.body.contains(r))try{r.focus();}catch(e){}}
function admEmailDlg(type,o){
  var url=location.origin+location.pathname;
  var subj=type==='invite'?'Welcome to DalOS — your account is ready':'DalOS — your password has been reset';
  var body=type==='invite'
    ?'Hi '+o.name+',\n\nYour DalOS account has been created.\n\nEmail: '+o.email+'\nTemporary password: '+o.pw+'\nRole: '+o.role+'\n\nSign in at:\n'+url+'\n\nDalOS — Daltex Agricultural Operations'
    :'Hi '+o.name+',\n\nYour password has been reset by an administrator.\n\nNew password: '+o.pw+'\n\nSign in at:\n'+url+'\n\nDalOS — Daltex Agricultural Operations';
  AD.dlg={kind:'email',title:type==='invite'?'User created — email to send':'Password reset email',to:o.name+' <'+o.email+'>',subj:subj,body:body,note:type==='invite'?'Copy this and send it to them. The password is not emailed automatically.':'This only prepares the email, exactly like Vision Admin today. It does not change the password in DalOS — set it in Supabase Auth first.',ret:document.activeElement};
  AD._focusLayer=1;admRender();
}
function admLayerHTML(){
  var h=admDrawerHTML(),g=AD.dlg;
  if(!g)return h;
  h+='<div class="scrim dlg-scrim" data-act="dlgx"></div>';
  if(g.kind==='confirm'){
    h+='<div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlgT" aria-describedby="dlgD">'+(g.danger?'<div class="warnic" aria-hidden="true">⊘</div>':'')+
      '<h2 id="dlgT">'+aEsc(g.title)+'</h2><p id="dlgD">'+aEsc(g.text||'')+'</p>'+(g.list?'<ul>'+g.list.map(function(x){return '<li>'+aEsc(x)+'</li>';}).join('')+'</ul>':'')+
      (g.err?'<div class="ferr" role="alert">'+aEsc(g.err)+'</div>':'')+
      '<div class="acts"><button type="button" class="adm-btn" data-act="dlgx" data-fid="dlgx" data-autofocus>Cancel</button><button type="button" class="adm-btn '+(g.danger?'dng':'pri')+'" data-act="dlgok" data-fid="dlgok"'+(g.busy?' disabled':'')+'>'+aEsc(g.busy?'Working…':g.ok)+'</button></div></div>';
  }else if(g.kind==='resetpw'){
    var u=aUser(g.uid)||{};
    h+='<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h2 id="dlgT">Reset password</h2><p>'+aEsc(u.name)+' · '+aEsc(u.email)+'</p>'+
      '<div class="fld"><label for="rpw">New password</label><input id="rpw" class="inp" type="text" data-fid="rpw" data-in="rpw" value="'+aEsc(g.pw||'')+'" autocomplete="off" data-autofocus></div>'+
      '<p class="hint">Same as Vision Admin: this prepares the email with the new password for you to send. It does not change the password in DalOS.</p>'+
      '<div class="acts"><button type="button" class="adm-btn" data-act="dlgx">Cancel</button><button type="button" class="adm-btn pri" data-act="rpwgo"'+((g.pw||'').trim()?'':' disabled')+'>Prepare email</button></div></div>';
  }else if(g.kind==='email'){
    h+='<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlgT"><h2 id="dlgT">'+aEsc(g.title)+'</h2>'+
      '<p><b style="color:var(--tx)">To:</b> '+aEsc(g.to)+'<br><b style="color:var(--tx)">Subject:</b> '+aEsc(g.subj)+'</p><pre>'+aEsc(g.body)+'</pre><p class="hint" style="color:var(--go)">'+aEsc(g.note)+'</p>'+
      '<div class="acts"><button type="button" class="adm-btn" data-act="copymail">Copy email</button><button type="button" class="adm-btn pri" data-act="dlgx" data-autofocus>Done</button></div></div>';
  }
  return h;
}

/* ── Roles & permissions ───────────────────────────────────────────────── */
function admPermsHTML(){
  var roles=Object.keys(ADM_ROLES),app=AD.mxApp;
  var groups=[
    {k:'vision',title:'Vision · Operations & QC',rows:ADM_VISION_KEYS.map(function(k){return {label:ADM_PERM_LABELS[k],has:function(r){return !!aPerms(r)[k];}};})},
    {k:'commercial',title:'Commercial · CRM & Leads',rows:ADM_CRM_KEYS.map(function(k){return {label:ADM_PERM_LABELS[k],has:function(r){return !!aPerms(r)[k];}};})},
    {k:'landcloud',title:'Land Cloud · Agronomy (app-enforced)',rows:ADM_LC_ROWS.map(function(x){return {label:x.label,has:function(r){return !!x.roles[r];}};})}
  ];
  var h='<div class="crumb">Workspace / Admin</div><div class="ptrow"><div><h1 class="pt">Roles &amp; permissions</h1><p class="sub">What each role can do in each app. Read-only: roles are defined in Vision’s code, so changing one needs a Vision release.</p></div><div class="hsp"></div><button type="button" class="adm-btn" disabled aria-describedby="cmpLater">⇆ Compare 2 roles</button><span id="cmpLater" class="later" style="align-self:center">coming later</span></div>';
  h+='<div class="toolbar" style="justify-content:space-between;align-items:center"><div class="tabs" role="tablist" aria-label="Filter by app">'+
    [['all','All apps',groups.reduce(function(a,g){return a+g.rows.length;},0)]].concat(groups.map(function(g){return [g.k,{vision:'Vision',commercial:'Commercial',landcloud:'Land Cloud'}[g.k],g.rows.length];})).map(function(t){
      return '<button type="button" role="tab" aria-selected="'+(app===t[0])+'" data-act="mxapp" data-arg="'+t[0]+'" data-fid="mx-'+t[0]+'">'+t[1]+' · '+t[2]+'</button>';}).join('')+
    '</div><div class="legend"><span><span class="yes" aria-hidden="true">✓</span> Allowed</span><span><span class="no" aria-hidden="true">–</span> Not allowed</span></div></div>';
  h+='<div class="card mx"><div class="mxs" data-sk="mx" tabindex="0" role="region" aria-label="Permissions by role, scrolls sideways"><table class="mxt"><caption class="sr">Permissions by role</caption><thead><tr><th scope="col" class="rh">Permission</th>'+roles.map(function(r){return '<th scope="col">'+aEsc(ADM_ROLES[r].label)+'</th>';}).join('')+'</tr></thead><tbody>';
  groups.forEach(function(g){
    if(app!=='all'&&app!==g.k)return;
    h+='<tr class="grp"><td class="rh">'+aEsc(g.title)+' · '+g.rows.length+'</td><td colspan="'+roles.length+'"></td></tr>';
    g.rows.forEach(function(row){
      h+='<tr><th scope="row" class="rh" style="font-weight:500;color:var(--tx)">'+aEsc(row.label)+'</th>'+roles.map(function(r){var y=row.has(r);return '<td>'+(y?'<span class="yes" role="img" aria-label="Allowed">✓</span>':'<span class="no" role="img" aria-label="Not allowed">–</span>')+'</td>';}).join('')+'</tr>';
    });
  });
  h+='</tbody></table></div></div><p class="scrollhint">↔ Scroll sideways for more roles. The permission column stays fixed. “Edit inspections” is display-only: everyone who can view inspections can edit them.</p>';
  return h;
}

/* ── App access (Analytics) ────────────────────────────────────────────── */
function admAccessHTML(){
  var h='<div class="crumb">Workspace / Admin</div><h1 class="pt">App access</h1><p class="sub">Requests and grants for each DalOS app. Admins get every app automatically.</p>';
  var pend=AD.aa?(AD.aa.requests||[]).length:0;
  h+='<div class="acctabs" role="tablist" aria-label="App">'+
    '<button type="button" class="apptab" role="tab" aria-selected="false" disabled><span class="dot" style="background:var(--gr)"></span>Vision <span class="badge g">by role</span></button>'+
    '<button type="button" class="apptab" role="tab" aria-selected="true"><span class="dot" style="background:var(--bl)"></span>Analytics <span class="badge'+(pend?'':' g')+'">'+pend+'</span></button>'+
    '<button type="button" class="apptab" role="tab" aria-selected="false" disabled><span class="dot" style="background:var(--pu)"></span>Commercial <span class="later">coming later</span></button>'+
    '<button type="button" class="apptab" role="tab" aria-selected="false" disabled><span class="dot" style="background:var(--te)"></span>Land Cloud <span class="later">coming later</span></button></div>';
  if(!AD.aa&&AD.aaErr)return h+aError("Couldn't load Analytics access",'retry-aa');
  if(!AD.aa)return h+aLoading(3,'Loading access…');
  if(AD.aaErr)h+='<div class="ferr" role="alert">Couldn’t refresh: '+aEsc(AD.aaErr)+'</div>';
  var reqs=AD.aa.requests||[],acc=AD.aa.access||[],q=AD.aaQ.trim().toLowerCase();
  h+='<div class="sech"><h2>Waiting for you</h2><span class="badge'+(reqs.length?'':' g')+'">'+reqs.length+'</span></div>';
  if(!reqs.length)h+='<div class="card empty" style="padding:22px"><p style="margin:0">No pending requests right now.</p></div>';
  else{h+='<div class="card list">';reqs.forEach(function(r){var ka=r.id+'approve',kd=r.id+'deny',busy=AD.aaBusy===ka||AD.aaBusy===kd;
    h+='<div class="li"><span class="av" aria-hidden="true">'+aEsc(aIni(r.name))+'</span><div class="grow"><b>'+aEsc(r.name||'—')+'</b><div class="reason">'+aEsc(r.email)+' · asked '+aEsc(aDate(r.requested_at))+'</div>'+(r.reason?'<div class="reason">“'+aEsc(r.reason)+'”</div>':'')+'</div>'+
      '<div class="acts"><button type="button" class="adm-btn" data-act="aadeny" data-arg="'+aEsc(r.id)+'"'+(busy?' disabled':'')+'>'+(AD.aaBusy===kd?'Declining…':'Decline')+'</button><button type="button" class="adm-btn pri" data-act="aaok" data-arg="'+aEsc(r.id)+'"'+(busy?' disabled':'')+'>'+(AD.aaBusy===ka?'Approving…':'Approve')+'</button></div></div>';});
    h+='</div>';}
  var shown=acc.filter(function(a){return !q||String(a.name||'').toLowerCase().indexOf(q)>=0||String(a.email||'').toLowerCase().indexOf(q)>=0;});
  h+='<div class="sech"><h2>Has access</h2><span class="badge g">'+acc.length+'</span><div class="hsp"></div><label class="fl" style="flex:0 1 280px;min-width:180px"><span class="sr">Search people with access</span><input class="inp" type="search" placeholder="Search name or email" data-fid="aaq" data-in="aaq" value="'+aEsc(AD.aaQ)+'"></label></div>';
  if(!shown.length)h+=aEmpty(acc.length?'Nobody matches “'+AD.aaQ+'”':'No one has access yet','',acc.length?'<button type="button" class="adm-btn" data-act="aaclear">Clear search</button>':'');
  else{h+='<div class="card list">';shown.forEach(function(a){var isA=a.source==='admin',u=aUser(a.user_id),kr=a.user_id+'rev';
    h+='<div class="li"><span class="av" aria-hidden="true">'+aEsc(aIni(a.name))+'</span><div class="grow"><b>'+aEsc(a.name||'—')+'</b> '+(u?aRolePill(u.role):isA?aRolePill('admin'):'')+'<div class="reason">'+aEsc(a.email)+'</div></div>'+
      '<div class="meta">'+(isA?'Automatic · Admin role':'Granted '+aEsc(aDate(a.granted_at)))+'</div>'+
      (isA?'':'<button type="button" class="adm-btn red" data-act="aarevoke" data-arg="'+aEsc(a.user_id)+'"'+(AD.aaBusy===kr?' disabled':'')+'>'+(AD.aaBusy===kr?'Removing…':'Remove access…')+'</button>')+'</div>';});
    h+='</div>';}
  h+='<p class="hint">Vision access comes from the user’s role, so there are no Vision requests.</p>';
  return h;
}
/* Vision AnalyticsAccessPanel.decide / revoke */
function admAADecide(id,action){AD.aaBusy=id+action;admRender();
  sb.functions.invoke('analytics-access-decide',{body:{request_id:id,action:action}}).then(function(r){AD.aaBusy='';if(r&&r.error)aToast('Could not '+(action==='approve'?'approve':'decline')+': '+(r.error.message||'error'),true);else aToast(action==='approve'?'Approved':'Declined');return admLoadAA();})
    .catch(function(){AD.aaBusy='';aToast('Network error — nothing changed.',true);admLoadAA();});}
function admAARevoke(uid){
  var a=AD.aaAcc[uid]||{},u=aUser(uid)||{};var nm=a.name||u.name||'this user';
  admConfirm({title:'Remove Analytics access for '+nm+'?',text:'They will lose access to DalOS Analytics straight away.',list:['They can ask again from the Analytics tile in Workspace.','Their other apps are not affected.'],ok:'Remove access',danger:true,
    run:function(){return Promise.resolve(sb.rpc('revoke_analytics_access',{p_user_id:uid})).then(function(r){if(r&&r.error)throw r.error;return admLoadAA();}).then(function(){aToast('Analytics access removed');});}});
}

/* ── Vision settings ───────────────────────────────────────────────────── */
function aGroupOf(sub){for(var i=0;i<ADM_ST_GROUPS.length;i++){if(ADM_ST_GROUPS[i].items.some(function(x){return x[0]===sub;}))return ADM_ST_GROUPS[i];}return ADM_ST_GROUPS[0];}
function aSubCount(k){var c=AD.cfg;if(!c)return '';
  if(k==='packhouses')return c.packhouses.length;if(k==='products')return c.products.length;
  if(k==='categories')return Object.keys(c.categories).reduce(function(a,p){return a+c.categories[p].length;},0);
  if(k==='varieties')return Object.keys(c.varietiesFull).reduce(function(a,p){return a+c.varietiesFull[p].length;},0);
  if(k==='subClients')return c.subClients.length;if(k==='seasons')return c.seasons.length;
  if(c[k]&&c[k].length!=null)return c[k].length;return '';}
/* Staged (not yet saved) settings edits: S.pend[packhouseId]={crops,prefix}, S.pendVar[varietyId]=categoryId|'' */
function aStPendCount(){var n=0;Object.keys(AD.st.pend).forEach(function(id){var p=AD.st.pend[id];if(p.crops)n++;if(p.prefix!=null)n++;});return n+Object.keys(AD.st.pendVar).length;}
function aVarById(id){var vf=AD.cfg?AD.cfg.varietiesFull:{},r=null;Object.keys(vf).some(function(p){return vf[p].some(function(v){if(v.id===id){r=v;return true;}return false;});});return r;}
/* products shown as chips/sections: active, and test products only with "Show test data" */
function aStProds(){var S=AD.st,hid=0;var out=AD.cfg.products.filter(function(p){if(p.active===false)return false;if(!S.test&&aIsTest(p.name)){hid++;return false;}return true;});out.hidden=hid;return out;}
function admSettingsHTML(){
  var S=AD.st,sub=S.sub,grp=aGroupOf(sub),label=(grp.items.filter(function(x){return x[0]===sub;})[0]||[])[1];
  var h='<div class="crumb">Workspace / Admin / App settings</div><h1 class="pt">Vision settings</h1><p class="sub">Vision master data: sites, catalogue, clients, seasons and forms. Packhouse products, pallet prefixes and variety categories are kept as unsaved changes until you press Save. Adding or removing an item is saved when you confirm it.</p>';
  var jump='<label class="fl"><span>Jump to section</span><select data-fid="stjump" data-ch="stjump">'+ADM_ST_GROUPS.map(function(g){return '<optgroup label="'+aEsc(g.label)+'">'+g.items.map(function(it){return '<option value="'+it[0]+'"'+(it[0]===sub?' selected':'')+'>'+aEsc(g.label+' › '+it[1])+'</option>';}).join('')+'</optgroup>';}).join('')+'</select></label>';
  h+='<div class="desk-only" style="margin-bottom:16px"><div class="tabs" role="tablist" aria-label="Vision settings group">'+ADM_ST_GROUPS.map(function(g){return (g.k==='tools'?'<span class="tdiv" aria-hidden="true"></span>':'')+'<button type="button" role="tab" aria-selected="'+(g===grp)+'" data-act="stgrp" data-arg="'+g.k+'" data-fid="stg-'+g.k+'">'+aEsc(g.label)+' · '+g.items.length+'</button>';}).join('')+'</div>'+
    '<div class="subtabs" role="tablist" aria-label="'+aEsc(grp.label)+'">'+grp.items.map(function(it){var n=aSubCount(it[0]);return '<button type="button" role="tab" aria-selected="'+(it[0]===sub)+'" data-act="stsub" data-arg="'+it[0]+'" data-fid="sts-'+it[0]+'">'+aEsc(it[1])+(n!==''?' <span>'+n+'</span>':'')+(it[0]==='grapes'?'<span class="hintag">Grapes only</span>':'')+'</button>';}).join('')+'<span class="jump">'+jump+'</span></div></div>';
  h+='<div class="mobile-only" style="margin-bottom:14px">'+jump.replace('data-fid="stjump"','data-fid="stjump-m"')+'</div>';
  if(ADM_IN_VISION[sub])return h+admStInVision(sub);
  if(sub==='schemadoc')return h+admSchemaHTML();
  if(sub==='grapes')return h+grHTML();
  if(!AD.cfg&&AD.cfgErr)return h+aError("Couldn't load Vision settings",'retry-cfg');
  if(!AD.cfg)return h+aLoading(4,'Loading Vision settings…');
  if(AD.cfgErr)h+='<div class="ferr" role="alert">Couldn’t refresh: '+aEsc(AD.cfgErr)+'</div>';
  if(sub==='inspection')return h+feHTML('insp');
  if(sub==='clientqc')return h+feHTML('cqc');
  h+='<div class="toolbar"><label class="fl search"><span>Search '+aEsc(label.toLowerCase())+'</span><input class="inp" type="search" data-fid="stq" data-in="stq" value="'+aEsc(S.q)+'" autocomplete="off"></label>'+aSwitch('sttest',S.test,'Show test data')+'</div>';
  var body=admStBody(sub);
  h+=body;
  var pc=aStPendCount();
  if(pc){var desc=[];Object.keys(S.pend).forEach(function(id){var p=S.pend[id],ph=AD.cfg.packhouses.filter(function(x){return x.id===id;})[0];if(!ph)return;var bits=[];
      if(p.crops){var on=p.crops.filter(function(c){return ph.crops.indexOf(c)<0;}),off=ph.crops.filter(function(c){return p.crops.indexOf(c)<0;});on.forEach(function(c){bits.push(aProdName(c)+' on');});off.forEach(function(c){bits.push(aProdName(c)+' off');});}
      if(p.prefix!=null)bits.push('prefix “'+p.prefix+'”');desc.push(ph.name+': '+bits.join(', '));});
    Object.keys(S.pendVar).forEach(function(vid){var v=aVarById(vid);desc.push((v?v.name:vid)+': category changed');});
    h+='<div class="savebar" role="region" aria-label="Unsaved changes"><span class="msg" role="status"><b>'+pc+' unsaved change'+(pc===1?'':'s')+'</b><small>'+aEsc(desc.join(' · '))+'</small></span><button type="button" class="adm-btn" data-act="stdiscard"'+(S.busy?' disabled':'')+'>Discard</button><button type="button" class="adm-btn pri" data-act="stsave"'+(S.busy?' disabled':'')+'>'+(S.busy?'Saving…':'Save')+'</button></div>';}
  return h;
}
function aProdName(id){var p=AD.cfg.products.filter(function(x){return x.id===id;})[0];return p?p.name:id;}
function aStFilter(names){var S=AD.st,q=S.q.trim().toLowerCase(),hid=0;var out=names.filter(function(n){var nm=typeof n==='string'?n:n.name;if(!S.test&&aIsTest(nm)){hid++;return false;}return !q||String(nm).toLowerCase().indexOf(q)>=0;});out.hidden=hid;return out;}
function aHidHint(n){return n&&!AD.st.test?'<p class="hint">'+n+' test item'+(n===1?' is':'s are')+' hidden. Turn on “Show test data” to see '+(n===1?'it':'them')+'.</p>':'';}
function aNv(k){return AD.st.nv[k]||'';}
function admStInVision(sub){
  return '<div class="card empty"><div class="big" aria-hidden="true">🔧</div><b>'+aEsc(ADM_IN_VISION[sub])+' is still edited in Vision</b><p>This editor hasn’t moved to Workspace yet. Open Vision → Admin → System config → '+aEsc(ADM_IN_VISION[sub])+'.</p><a class="adm-btn pri" href="'+aEsc(VISION_URL)+'">Open Vision</a></div>';
}
function admStBody(sub){
  var c=AD.cfg,S=AD.st,h='';
  function tag(name,act,arg,extra){return '<span class="tagx">'+aEsc(name)+(extra||'')+'<button type="button" aria-label="Remove '+aEsc(name)+'" data-act="'+act+'" data-arg="'+aEsc(arg)+'">×</button></span>';}
  if(sub==='packhouses'){
    var np=S.nv.phProds||[],col=S.nv.phCol||'#2b5c3f';
    h+='<details class="card" style="margin-bottom:12px"'+(S.nv.phOpen?' open':'')+'><summary style="min-height:44px;display:flex;align-items:center;padding:0 16px;cursor:pointer;font-weight:600" data-act="phopen">+ Add packhouse</summary><div style="padding:0 16px 16px">'+
      '<div class="fld"><label for="nPh">Packhouse name</label><input id="nPh" class="inp" data-fid="nPh" data-in="nv:ph" value="'+aEsc(aNv('ph'))+'" placeholder="e.g. Nour Packhouse"></div>'+
      '<div class="fld"><span class="lbl">Colour</span><div role="group" aria-label="Colour">'+['#2b5c3f','#5a3a8a','#8a3a1a','#1a4a7a','#7a5010','#8a1a1a','#2a5a8a','#4a7a2a'].map(function(x,i){return '<button type="button" class="swatch" style="background:'+x+'" aria-pressed="'+(col===x)+'" aria-label="Colour '+(i+1)+'" data-act="phcol" data-arg="'+x+'"></button>';}).join('')+'</div></div>'+
      '<div class="fld"><span class="lbl">Products handled</span><div class="chips">'+aStProds().map(function(p){var on=np.indexOf(p.id)>=0;return '<button type="button" class="pc" aria-pressed="'+on+'" data-act="phnewprod" data-arg="'+aEsc(p.id)+'">'+aEsc(p.name)+'</button>';}).join('')+'</div>'+(np.length?'':'<p class="hint" style="color:var(--go)">Select at least one product.</p>')+'</div>'+
      '<button type="button" class="adm-btn pri" data-act="phadd"'+(aNv('ph').trim()&&np.length?'':' disabled')+'>+ Add packhouse</button></div></details>';
    var phs=aStFilter(c.packhouses);
    if(!phs.length)h+=aEmpty('No packhouses match','');
    phs.forEach(function(ph){
      var pend=S.pend[ph.id]||{},crops=pend.crops||ph.crops,pfx=pend.prefix!=null?pend.prefix:ph.palletPrefix;
      h+='<div class="card ph"><div class="phh"><span class="sq" style="background:'+aEsc(ph.color)+'" aria-hidden="true">'+aEsc(ph.initials)+'</span><div><b>'+aEsc(ph.name)+'</b><small class="small">code '+aEsc(ph.id)+'</small></div><div class="hsp"></div><span class="st">Active</span>'+
        '<button type="button" class="adm-btn red" data-act="phdeact" data-arg="'+aEsc(ph.id)+'">Deactivate…</button></div>'+
        '<div class="row"><div><label class="lab" for="pfx-'+aEsc(ph.id)+'" style="display:block">Pallet prefix (grapes)</label><input id="pfx-'+aEsc(ph.id)+'" class="inp pfx'+(pend.prefix!=null?' chg':'')+'" data-fid="pfx-'+aEsc(ph.id)+'" data-in="pfx" data-arg="'+aEsc(ph.id)+'" value="'+aEsc(pfx)+'" placeholder="e.g. NK-"></div>'+
        '<div style="flex:1 1 240px;min-width:0"><div class="lab">Products handled · tap to change, then Save</div><div class="chips" role="group" aria-label="Products at '+aEsc(ph.name)+'">'+
        aStProds().map(function(p){var on=crops.indexOf(p.id)>=0,was=ph.crops.indexOf(p.id)>=0;return '<button type="button" class="pc'+(on!==was?' chg':'')+'" aria-pressed="'+on+'" data-act="phprod" data-arg="'+aEsc(ph.id)+'|'+aEsc(p.id)+'" data-fid="pp-'+aEsc(ph.id)+'-'+aEsc(p.id)+'">'+aEsc(p.name)+'</button>';}).join('')+
        '</div></div></div></div>';
    });
    var hp=aStProds().hidden;
    h+=aHidHint(phs.hidden)+(hp&&!S.test?'<p class="hint">'+hp+' test product'+(hp===1?' is':'s are')+' hidden from the product chips. Turn on “Show test data” to see '+(hp===1?'it':'them')+'.</p>':'')+'<p class="hint">Inactive packhouses are not listed here (same as Vision Admin). Reactivate them in Vision for now.</p>';
    return h;
  }
  if(ADM_LIST_TABLE[sub]){
    var items=aStFilter(c[sub]||[]);
    h+='<div class="card addrow"><label class="fl"><span>Add '+aEsc({clients:'client',countries:'country',farms:'farm',classes:'class',cartonTypes:'carton type'}[sub])+'</span><input class="inp" data-fid="nv-'+sub+'" data-in="nv:'+sub+'" value="'+aEsc(aNv(sub))+'" data-enter="listadd"></label><button type="button" class="adm-btn pri" data-act="listadd"'+(aNv(sub).trim()?'':' disabled')+'>+ Add</button></div>';
    h+=items.length?'<div class="card ph"><div class="chips">'+items.map(function(n){return tag(n,'listrm',n);}).join('')+'</div></div>':aEmpty('Nothing matches','');
    return h+aHidHint(items.hidden);
  }
  if(sub==='products'){
    h+='<div class="card addrow"><label class="fl"><span>Product name</span><input class="inp" data-fid="nv-prod" data-in="nv:prod" value="'+aEsc(aNv('prod'))+'" placeholder="e.g. Berries"></label><label class="fl" style="flex:0 0 140px"><span>ID prefix</span><input class="inp" data-fid="nv-pfx" data-in="nv:prodpfx" value="'+aEsc(aNv('prodpfx'))+'" maxlength="3" placeholder="BR" style="font-family:var(--font-mono);text-transform:uppercase"></label><button type="button" class="adm-btn pri" data-act="prodadd"'+(aNv('prod').trim()&&aNv('prodpfx').trim()?'':' disabled')+'>+ Add</button></div>';
    var ps=aStFilter(c.products);
    h+='<div class="card list">'+ps.map(function(p){return '<div class="li"><span class="dot" style="background:'+aEsc(p.color)+';width:14px;height:14px;border-radius:50%"></span><div class="grow"><b>'+aEsc(p.name)+'</b></div><span style="font-family:var(--font-mono)">'+aEsc(p.prefix)+'</span><span class="st">Active</span></div>';}).join('')+'</div>';
    return h+aHidHint(ps.hidden);
  }
  var sp=aStProds(),prodOpts=sp.map(function(p){return [p.id,p.name];}),selP=(S.nv.selProd&&sp.some(function(p){return p.id===S.nv.selProd;}))?S.nv.selProd:((sp[0]&&sp[0].id)||'');
  var hidProdHint=sp.hidden&&!S.test?'<p class="hint">'+sp.hidden+' test product'+(sp.hidden===1?' is':'s are')+' hidden. Turn on “Show test data” to see '+(sp.hidden===1?'it':'them')+'.</p>':'';
  if(sub==='categories'){
    h+='<div class="card addrow">'+aSel('selProd','Product',prodOpts,selP)+'<label class="fl"><span>Category name</span><input class="inp" data-fid="nv-cat" data-in="nv:cat" value="'+aEsc(aNv('cat'))+'" placeholder="e.g. Orange, Lemon" data-enter="catadd"></label><button type="button" class="adm-btn pri" data-act="catadd"'+(aNv('cat').trim()&&selP?'':' disabled')+'>+ Add</button></div>';
    var hid=0;
    sp.forEach(function(p){var cats=aStFilter(c.categories[p.id]||[]);hid+=cats.hidden;
      h+='<div class="card ph"><div class="grph">'+aEsc(p.name)+' · '+cats.length+'</div>'+(cats.length?'<div class="chips">'+cats.map(function(ct){return tag(ct.name,'catrm',ct.id);}).join('')+'</div>':'<p class="hint">No categories yet.</p>')+'</div>';});
    return h+aHidHint(hid)+hidProdHint;
  }
  if(sub==='varieties'){
    var cOpts=[['','— None —']].concat((c.categories[selP]||[]).map(function(x){return [x.id,x.name];}));
    h+='<div class="card addrow">'+aSel('selProd','Product',prodOpts,selP)+aSel('selCat','Category (optional)',cOpts,S.nv.selCat||'')+'<label class="fl"><span>Variety name</span><input class="inp" data-fid="nv-var" data-in="nv:var" value="'+aEsc(aNv('var'))+'" placeholder="e.g. Navel" data-enter="varadd"></label><button type="button" class="adm-btn pri" data-act="varadd"'+(aNv('var').trim()&&selP?'':' disabled')+'>+ Add</button></div>';
    var hidV=0;
    sp.forEach(function(p){
      var vs=aStFilter(c.varietiesFull[p.id]||[]),cats=c.categories[p.id]||[];hidV+=vs.hidden;
      h+='<div class="card ph"><div class="grph">'+aEsc(p.name)+' · '+vs.length+'</div>';
      if(!vs.length){h+='<p class="hint">No varieties.</p></div>';return;}
      h+='<div class="chips">'+vs.map(function(v){
        var pv=S.pendVar.hasOwnProperty(v.id),cur=pv?S.pendVar[v.id]:(v.categoryId||'');
        var sel=cats.length?'<label class="sr" for="vc-'+aEsc(v.id)+'">Category for '+aEsc(v.name)+'</label><select id="vc-'+aEsc(v.id)+'"'+(pv?' class="chg"':'')+' data-fid="vc-'+aEsc(v.id)+'" data-ch="varcat" data-arg="'+aEsc(v.id)+'"><option value="">— no category —</option>'+cats.map(function(ct){return '<option value="'+aEsc(ct.id)+'"'+(ct.id===cur?' selected':'')+'>'+aEsc(ct.name)+'</option>';}).join('')+'</select>':'';
        return tag(v.name,'varrm',v.id,sel);}).join('')+'</div></div>';
    });
    return h+aHidHint(hidV)+hidProdHint;
  }
  if(sub==='subClients'){
    var parents=admSubParents(),pc=S.nv.subParent||'';
    h+='<div class="card addrow">'+aSel('subParent','Client',[['','— Select client —']].concat(parents.map(function(n){return [n,n];})),pc)+'<label class="fl"><span>Sub-client / retailer</span><input class="inp" data-fid="nv-sub" data-in="nv:sub" value="'+aEsc(aNv('sub'))+'" placeholder="e.g. Lidl" data-enter="subadd"></label><button type="button" class="adm-btn pri" data-act="subadd"'+(aNv('sub').trim()&&pc?'':' disabled')+'>+ Add</button></div>';
    var hidS=0,any=false;
    parents.forEach(function(cn){var cid=c.clientsIdMap[cn];var subs=aStFilter(c.subClients.filter(function(s){return s.clientId===cid;}));hidS+=subs.hidden;if(!subs.length)return;any=true;
      h+='<div class="card ph"><div class="grph">'+aEsc(cn)+'</div><div class="chips">'+subs.map(function(s){return tag(s.name,'subrm',s.id);}).join('')+'</div></div>';});
    if(!any)h+=aEmpty('No sub-clients match','');
    return h+aHidHint(hidS);
  }
  if(sub==='seasons'){
    h+='<div class="card addrow"><label class="fl"><span>New season</span><input class="inp" data-fid="nv-season" data-in="nv:season" value="'+aEsc(aNv('season'))+'" placeholder="e.g. 2026/27" data-enter="seasonadd"></label><button type="button" class="adm-btn pri" data-act="seasonadd"'+(aNv('season').trim()?'':' disabled')+'>+ Add season</button></div>';
    var ss=aStFilter(c.seasons);
    h+='<div class="card list">'+ss.map(function(s){return '<div class="li"><div class="grow"><b>'+aEsc(s.name)+'</b><div class="reason">'+(s.active?'Current active season':'Inactive')+'</div></div>'+(s.active?'<span class="st">Active</span>':'<button type="button" class="adm-btn" data-act="seasonact" data-arg="'+aEsc(s.name)+'">Set as active…</button>')+'</div>';}).join('')+'</div>';
    return h+aHidHint(ss.hidden);
  }
  return h;
}
/* Vision AdminCenter writes for settings */
/* r = response of a write that ended in .select(); error or 0 rows → red toast, no reload */
function aStDone(r,msg){try{aChk(r);}catch(e){aToast('Save failed: '+e.message,true);return false;}aToast(msg||'Saved');admLoadCfg();return true;}
function aStFail(e){aToast('Save failed: '+((e&&e.message)||'network error'),true);}
function aSelProd(){var sp=aStProds(),s=AD.st.nv.selProd;return (s&&sp.some(function(p){return p.id===s;}))?s:((sp[0]&&sp[0].id)||'');}
function admListAdd(field){
  var val=aNv(field).trim(),table=ADM_LIST_TABLE[field];if(!val||!table)return;
  AD.st.nv[field]='';admRender();
  Promise.resolve(sb.from(table).select('id,active').eq('name',val).limit(1)).then(function(ex){
    if(ex.error)throw ex.error;
    if(ex.data&&ex.data.length>0)return sb.from(table).update({active:true}).eq('id',ex.data[0].id).select('id').then(function(r){aStDone(r,'Reactivated “'+val+'”');});
    return sb.from(table).insert([{name:val,active:true}]).select('id').then(function(r){aStDone(r,'Added “'+val+'”');});
  }).catch(aStFail);
}
/* Save bar: one update per staged packhouse / variety. Successful ones leave the
   staged list; failed ones stay staged so Save can be pressed again. */
function admStSave(){
  var S=AD.st,jobs=[];S.busy=true;admRender();
  Object.keys(S.pend).forEach(function(id){var p=S.pend[id],upd={};
    if(p.prefix!=null)upd.pallet_prefix=p.prefix||null;
    if(p.crops)upd.product_ids=p.crops;
    jobs.push(Promise.resolve(sb.from('packhouses').update(upd).eq('id',id).select('id')).then(function(r){aChk(r,id);delete S.pend[id];return null;}).catch(function(e){return (e&&e.message)||id+': network error';}));
  });
  Object.keys(S.pendVar).forEach(function(vid){var v=aVarById(vid),nm=v?v.name:vid;
    jobs.push(Promise.resolve(sb.from('varieties').update({category_id:S.pendVar[vid]||null}).eq('id',vid).select('id')).then(function(r){aChk(r,nm);delete S.pendVar[vid];return null;}).catch(function(e){return (e&&e.message)||nm+': network error';}));
  });
  Promise.all(jobs).then(function(res){var errs=res.filter(Boolean);S.busy=false;
    if(errs.length)aToast('Not saved: '+errs.join(' · ')+(aStPendCount()?' — still listed as unsaved.':''),true);else aToast('Saved');
    return admLoadCfg();});
}
/* Make one season active in ONE statement: a single bulk upsert (INSERT … ON CONFLICT (id)
   DO UPDATE) over every season row, active = (name === chosen). Postgres applies it
   atomically, so there is never a moment with zero (or two) active seasons. Reads the
   current list first so a season added meanwhile is included. */
function admSetSeason(name){
  return Promise.resolve(sb.from('seasons').select('id,name,active')).then(function(rs){
    if(rs.error)throw rs.error;var all=rs.data||[];
    var hits=all.filter(function(s){return s.name===name;}).length;
    if(hits!==1)throw new Error(hits?'There are '+hits+' seasons named “'+name+'”. Fix that in Vision first — nothing was changed.':'Season “'+name+'” no longer exists. Reload.');
    var rows=all.filter(function(s){return s.name!==name;}).map(function(s){return {id:s.id,name:s.name,active:false};})
      .concat(all.filter(function(s){return s.name===name;}).map(function(s){return {id:s.id,name:s.name,active:true};}));
    return sb.from('seasons').upsert(rows,{onConflict:'id'}).select('id,name,active');
  }).then(function(r){var out=aChk(r,'Season');
    var on=out.filter(function(s){return s.active;});
    if(on.length!==1||on[0].name!==name)throw new Error('Season: the database did not confirm '+name+' as the only active season. Reload and check.');
    aToast(name+' is now the active season');return admLoadCfg();});
}

/* ── Season & forms: Inspection / Client QC form editors ───────────────────
   Same tables Vision's System config writes (vision.js ~9480-9750), but every edit
   is staged in a Save bar. Sections, names, severity and threshold are stored on
   each row, so they are PER PRODUCT. Delete = archive (active=false), never a hard
   delete. Client QC: cqc_defect_sections has only `name` (no Arabic), cqc_defects
   has no threshold, and its order is cqc_defect_sections.display_order.
   Staged ids for not-yet-saved rows start with "~" (never a uuid).            */
var FE_T={
  insp:{label:'Inspection form',secT:'defect_sections',defT:'defects',rel:'defects',secName:'name_en',secAr:true,thr:true,
    desc:'Used by inspectors at the packhouse. Sections and defects appear on the inspection screen in this order.',past:'inspections',
    /* Vision addDefectToSection */
    key:function(en){return en.trim().toLowerCase().replace(/[\s\/\(\)]+/g,'_').replace(/[^a-z0-9_]/g,'');}},
  cqc:{label:'Client QC form',secT:'cqc_defect_sections',defT:'cqc_defects',rel:'cqc_defects',secName:'name',secAr:false,thr:false,
    desc:'Used for client QC reports. Sections and defects appear on the Client QC report in this order.',past:'client QC reports',
    /* Vision cqcAddDef */
    key:function(en){return en.trim().toLowerCase().replace(/[^a-z0-9]/g,'_').replace(/__+/g,'_');}}
};
var FE_SEV=['Minor','Major','Critical'];
function feNew(){return {prod:'',data:{},load:{},err:{},se:{},de:{},ord:{},ns:[],nd:[],errs:{},sel:{},open:{},arch:false,miss:false,nv:{},busy:false,seq:0};}
AD.fe={insp:feNew(),cqc:feNew()};
function feTmp(id){return String(id).charAt(0)==='~';}
function feCmp(a,b){var x=typeof a.order==='number'?a.order:1e9,y=typeof b.order==='number'?b.order:1e9;return x-y||String(a.en).localeCompare(String(b.en));}
function feLoad(kind,pid){
  var E=AD.fe[kind],T=FE_T[kind];if(!pid)return Promise.resolve();
  E.load[pid]=true;E.err[pid]='';
  var cols='id,product_id,'+T.secName+(T.secAr?',name_ar':'')+',color,display_order,active,'+T.rel+'(id,section_id,key,name_en,name_ar,severity,'+(T.thr?'default_threshold,':'')+'display_order,active)';
  /* archived rows included on purpose (Show archived / Restore) */
  return Promise.resolve(sb.from(T.secT).select(cols).eq('product_id',pid)).then(function(r){
    if(r.error)throw r.error;
    E.data[pid]=(r.data||[]).map(function(s){
      return {id:s.id,pid:pid,en:s[T.secName]||'',ar:T.secAr?(s.name_ar||''):'',order:s.display_order,active:s.active!==false,
        defs:(s[T.rel]||[]).map(function(d){return {id:d.id,pid:pid,secId:s.id,key:d.key,en:d.name_en||'',ar:d.name_ar||'',sev:d.severity||'',
          thr:T.thr?(d.default_threshold==null?'':String(d.default_threshold)):'',order:d.display_order,active:d.active!==false};}).sort(feCmp)};
    }).sort(feCmp);
    fePrune(kind);
  }).catch(function(e){E.err[pid]=(e&&e.message)||'Load failed';}).then(function(){E.load[pid]=false;admRender();});
}
function feSec(kind,id){var D=AD.fe[kind].data;for(var p in D){for(var i=0;i<D[p].length;i++)if(D[p][i].id===id)return D[p][i];}return null;}
function feDef(kind,id){var D=AD.fe[kind].data;for(var p in D){for(var i=0;i<D[p].length;i++){var ds=D[p][i].defs;for(var j=0;j<ds.length;j++)if(ds[j].id===id)return ds[j];}}return null;}
function feV(kind,w,o,f){var e=AD.fe[kind][w][o.id];return e&&e.hasOwnProperty(f)?e[f]:o[f];}
/* live typing: raw string compare (so "8." isn't snapped back to "8") */
function feSame(o,f,v,numeric){
  if(f==='active')return o.active===v;
  if(f==='thr'&&numeric){var a=parseFloat(o.thr),b=parseFloat(v);if(!isNaN(a)&&!isNaN(b)&&String(v).trim()!=='')return a===b;}
  return String(o[f]==null?'':o[f])===String(v==null?'':v);}
function feSet(kind,w,id,f,v){
  var E=AD.fe[kind],o=w==='se'?feSec(kind,id):feDef(kind,id);if(!o)return;
  var e=E[w][id]||{};if(feSame(o,f,v))delete e[f];else e[f]=v;
  if(Object.keys(e).length)E[w][id]=e;else delete E[w][id];
  delete E.errs[w+':'+id];}
function fePrune(kind){var E=AD.fe[kind];
  ['se','de'].forEach(function(w){Object.keys(E[w]).forEach(function(id){var o=w==='se'?feSec(kind,id):feDef(kind,id);
    if(!o){delete E[w][id];return;}var e=E[w][id];
    Object.keys(e).forEach(function(f){if(feSame(o,f,e[f],true))delete e[f];});
    if(!Object.keys(e).length)delete E[w][id];});});}
function feInput(arg,v){var a=arg.split('|'),kind=a[0],w=a[1],id=a[2],f=a[3],E=AD.fe[kind];
  if(w==='se'||w==='de'){feSet(kind,w,id,f,v);return;}
  var list=w==='ns'?E.ns:E.nd;list.forEach(function(n){if(n.tmp===id){n[f]=v;delete E.errs[w+':'+id];}});}
function feProdId(kind){var E=AD.fe[kind],sp=aStProds();if(E.prod&&sp.some(function(p){return p.id===E.prod;}))return E.prod;return (sp[0]&&sp[0].id)||'';}
/* section order: staged list (ids + "~" ids of new sections) or the DB order */
function feOrderBase(kind,pid){var E=AD.fe[kind];return (E.data[pid]||[]).map(function(s){return s.id;}).concat(E.ns.filter(function(n){return n.pid===pid;}).map(function(n){return n.tmp;}));}
function feOrder(kind,pid){var base=feOrderBase(kind,pid),o=AD.fe[kind].ord[pid];if(!o)return base;
  var out=o.filter(function(id){return base.indexOf(id)>=0;});base.forEach(function(id){if(out.indexOf(id)<0)out.push(id);});return out;}
function feSetOrder(kind,pid,list){var E=AD.fe[kind];if(list.join('|')===feOrderBase(kind,pid).join('|'))delete E.ord[pid];else E.ord[pid]=list;delete E.errs['ord:'+pid];}
function feRows(kind,pid){var E=AD.fe[kind],D=E.data[pid]||[];
  return feOrder(kind,pid).map(function(id){
    var s=D.filter(function(x){return x.id===id;})[0];
    if(s){var act=feV(kind,'se',s,'active');return {id:id,isNew:false,s:s,pid:pid,en:feV(kind,'se',s,'en'),ar:feV(kind,'se',s,'ar'),active:act,gone:s.active&&!act};}
    var n=E.ns.filter(function(x){return x.tmp===id;})[0];
    return n?{id:id,isNew:true,n:n,pid:pid,en:n.en,ar:n.ar,active:true,gone:false}:null;
  }).filter(Boolean);}
function feDefRows(kind,r){var E=AD.fe[kind],out=[];
  if(!r.isNew)r.s.defs.forEach(function(d){var act=feV(kind,'de',d,'active');out.push({id:d.id,isNew:false,d:d,en:feV(kind,'de',d,'en'),ar:feV(kind,'de',d,'ar'),sev:feV(kind,'de',d,'sev'),thr:feV(kind,'de',d,'thr'),active:act,gone:d.active&&!act});});
  E.nd.forEach(function(n){if(n.secId===r.id)out.push({id:n.tmp,isNew:true,n:n,en:n.en,ar:n.ar,sev:'Minor',thr:'0',active:true,gone:false});});
  return out;}
function feNoAr(x){return !String(x.ar||'').trim();}
function feSecMiss(kind,r){return (FE_T[kind].secAr&&feNoAr(r))||feDefRows(kind,r).some(function(d){return d.active&&feNoAr(d);});}
function feSecDirty(kind,r){var E=AD.fe[kind];if(r.isNew||E.se[r.id])return true;return feDefRows(kind,r).some(function(d){return d.isNew||E.de[d.id];});}
function feStats(kind,pid){var T=FE_T[kind],st={defs:0,miss:0,arch:0};
  feRows(kind,pid).forEach(function(r){if(!r.active){st.arch++;return;} /* chip counts defects only; sections missing AR keep their dot */
    feDefRows(kind,r).forEach(function(d){if(!d.active){st.arch++;return;}st.defs++;if(feNoAr(d))st.miss++;});});return st;}
function feVisSec(kind){var E=AD.fe[kind];return function(r){return r.active||r.gone||E.arch;};}
function fePlDef(n){return n+' defect'+(n===1?'':'s');}
function feVisDef(kind){var E=AD.fe[kind];return function(d){if(E.miss)return d.active&&feNoAr(d);return d.active||d.gone||E.arch;};}
function feSelId(kind,pid,vis){var s=AD.fe[kind].sel[pid];if(vis.some(function(r){return r.id===s;}))return s;var a=vis.filter(function(r){return r.active;})[0]||vis[0];return a?a.id:'';}
function feOpenId(kind,pid){var E=AD.fe[kind];if(E.open.hasOwnProperty(pid))return E.open[pid];var vis=feRows(kind,pid).filter(feVisSec(kind));return feSelId(kind,pid,vis);}
function feProdDirty(kind,pid){var E=AD.fe[kind];
  if(E.ord[pid]||E.ns.some(function(n){return n.pid===pid;})||E.nd.some(function(n){return n.pid===pid;}))return true;
  return Object.keys(E.se).some(function(id){var s=feSec(kind,id);return s&&s.pid===pid;})||Object.keys(E.de).some(function(id){var d=feDef(kind,id);return d&&d.pid===pid;});}
function feDesc(o,e){var b=[];
  if(e.active===false)return '“'+o.en+'” deleted';
  if(e.active===true)b.push('restored');
  if(e.hasOwnProperty('en'))b.push('renamed to “'+e.en+'”');
  if(e.hasOwnProperty('ar'))b.push(String(e.ar).trim()?'Arabic name changed':'Arabic name cleared');
  if(e.hasOwnProperty('sev'))b.push('severity '+(o.sev||'—')+' → '+e.sev);
  if(e.hasOwnProperty('thr'))b.push('threshold '+(o.thr===''?'—':o.thr)+'% → '+e.thr+'%');
  return '“'+o.en+'”: '+b.join(', ');}
function feChanges(kind){var E=AD.fe[kind],out=[];
  E.ns.forEach(function(n){out.push({k:'ns:'+n.tmp,t:'New section “'+(n.en||'…')+'” ('+aProdName(n.pid)+')'});});
  E.nd.forEach(function(n){out.push({k:'nd:'+n.tmp,t:'New defect “'+(n.en||'…')+'” ('+aProdName(n.pid)+')'});});
  Object.keys(E.se).forEach(function(id){var s=feSec(kind,id);if(s)out.push({k:'se:'+id,t:'Section '+feDesc(s,E.se[id])+' ('+aProdName(s.pid)+')'});});
  Object.keys(E.de).forEach(function(id){var d=feDef(kind,id);if(d)out.push({k:'de:'+id,t:feDesc(d,E.de[id])+' ('+aProdName(d.pid)+')'});});
  Object.keys(E.ord).forEach(function(pid){out.push({k:'ord:'+pid,t:'Section order ('+aProdName(pid)+')'});});
  return out;}
function feMove(kind,id,dir){var pid=feProdId(kind),list=feOrder(kind,pid),act=feRows(kind,pid).filter(function(r){return r.active;}).map(function(r){return r.id;});
  var i=act.indexOf(id),j=i+dir;if(i<0||j<0||j>=act.length)return;
  var a=list.indexOf(id),b=list.indexOf(act[j]);list[a]=act[j];list[b]=id;feSetOrder(kind,pid,list);}
function feMoveTo(src,dst){var s=src.split('|'),d=dst.split('|');if(s[0]!==d[0]||s[1]===d[1])return;var kind=s[0],pid=feProdId(kind),list=feOrder(kind,pid);
  var from=list.indexOf(s[1]),to=list.indexOf(d[1]);if(from<0||to<0)return;list.splice(from,1);list.splice(to,0,s[1]);feSetOrder(kind,pid,list);admRender();}
function admDragStart(e){var r=e.target&&e.target.closest&&e.target.closest('[data-drag]');if(!r)return;AD._drag=r.getAttribute('data-drag');try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',AD._drag);}catch(_){}}
function admDragOver(e){if(!AD._drag)return;var r=e.target.closest&&e.target.closest('[data-drag]');if(r)e.preventDefault();}
function admDrop(e){var src=AD._drag;AD._drag=null;if(!src)return;var r=e.target.closest&&e.target.closest('[data-drag]');if(!r)return;e.preventDefault();feMoveTo(src,r.getAttribute('data-drag'));}
function feDelete(kind,w,id){
  var E=AD.fe[kind],T=FE_T[kind];AD.rowMenu=null;
  if(w==='ns'){E.ns=E.ns.filter(function(n){return n.tmp!==id;});E.nd=E.nd.filter(function(n){return n.secId!==id;});delete E.errs['ns:'+id];admRender();return;}
  if(w==='nd'){E.nd=E.nd.filter(function(n){return n.tmp!==id;});delete E.errs['nd:'+id];admRender();return;}
  var o=w==='se'?feSec(kind,id):feDef(kind,id);if(!o)return;
  var nm=feV(kind,w,o,'en')||o.en,pn=aProdName(o.pid);
  admConfirm({title:'Delete “'+nm+'”?',text:'Past inspections keep their records.',
    list:[(w==='se'?'The section and its defects won’t appear on new ':'It won’t appear on new ')+T.past+' for '+pn+'.',
      'It is archived, not erased: turn on “Show archived” to restore it.',
      'This is added to your unsaved changes. Nothing is deleted until you press Save.'],
    ok:'Delete',danger:true,run:function(){feSet(kind,w,id,'active',false);return Promise.resolve();}});
}
function feAddSec(kind){
  var E=AD.fe[kind],T=FE_T[kind],pid=feProdId(kind),en=String(E.nv.secEn||'').trim(),ar=String(E.nv.secAr||'').trim();if(!en||!pid)return;
  if(feRows(kind,pid).some(function(r){return r.active&&String(r.en).trim().toLowerCase()===en.toLowerCase();})){aToast('“'+en+'” is already a section for '+aProdName(pid)+'.',true);return;}
  var tmp='~s'+(++E.seq);E.ns.push({tmp:tmp,pid:pid,en:en,ar:T.secAr?ar:''});E.nv.secEn='';E.nv.secAr='';E.sel[pid]=tmp;E.open[pid]=tmp;E.miss=false;
}
function feAddDef(kind,secId){
  var E=AD.fe[kind],pid=feProdId(kind),en=String(E.nv.defEn||'').trim(),ar=String(E.nv.defAr||'').trim();if(!en||!pid)return;
  var r=feRows(kind,pid).filter(function(x){return x.id===secId;})[0];if(!r)return;
  if(feDefRows(kind,r).some(function(d){return d.active&&String(d.en).trim().toLowerCase()===en.toLowerCase();})){aToast('“'+en+'” is already in '+r.en+'.',true);return;}
  E.nd.push({tmp:'~d'+(++E.seq),pid:pid,secId:secId,en:en,ar:ar});E.nv.defEn='';E.nv.defAr='';E.miss=false;
}
/* Save: new sections → new defects → edits → order. Each write ends in .select()
   and 0 rows is an error (aChk). Failed items stay staged with their error. */
function feSave(kind){
  var E=AD.fe[kind],T=FE_T[kind];if(E.busy)return;
  E.busy=true;E.errs={};AD.rowMenu=null;admRender();
  var map={},pids={},ordSnap={},nsOrd={},ndOrd={},mx={},dmx={};
  Object.keys(E.ord).forEach(function(pid){ordSnap[pid]=feOrder(kind,pid);pids[pid]=1;});
  E.ns.forEach(function(n){pids[n.pid]=1;
    if(ordSnap[n.pid]){nsOrd[n.tmp]=ordSnap[n.pid].indexOf(n.tmp);return;}
    if(mx[n.pid]==null){mx[n.pid]=-1;(E.data[n.pid]||[]).forEach(function(s){if(typeof s.order==='number'&&s.order>mx[n.pid])mx[n.pid]=s.order;});}
    nsOrd[n.tmp]=++mx[n.pid];});
  E.nd.forEach(function(n){pids[n.pid]=1;
    if(dmx[n.secId]==null){dmx[n.secId]=-1;var s=feSec(kind,n.secId);(s?s.defs:[]).forEach(function(d){if(typeof d.order==='number'&&d.order>dmx[n.secId])dmx[n.secId]=d.order;});}
    ndOrd[n.tmp]=++dmx[n.secId];});
  function rd(q){return Promise.resolve(q).then(function(r){if(r.error)throw r.error;return r.data||[];});}
  function wr(q,what){return Promise.resolve(q).then(function(r){return aChk(r,what);});}
  function fail(k){return function(e){E.errs[k]=(e&&e.message)||'Failed';};}
  var p=Promise.resolve();
  /* new sections — Vision addSection: restore an archived one with the same name, else insert */
  E.ns.slice().forEach(function(n){p=p.then(function(){
    var en=String(n.en).trim(),ar=String(n.ar||'').trim();
    if(!en)throw new Error('Section name (EN) is empty.');
    return rd(sb.from(T.secT).select('id,active').eq(T.secName,en).eq('product_id',n.pid)).then(function(rows){
      if(rows.some(function(x){return x.active;}))throw new Error('A section named “'+en+'” already exists for '+aProdName(n.pid)+'.');
      if(rows[0]){var u={active:true,display_order:nsOrd[n.tmp]};if(T.secAr&&ar)u.name_ar=ar;
        return wr(sb.from(T.secT).update(u).eq('id',rows[0].id).select('id'),'Section “'+en+'”');}
      var row={product_id:n.pid,color:'#3a7a4a',active:true,display_order:nsOrd[n.tmp]};row[T.secName]=en;if(T.secAr)row.name_ar=ar||null;
      return wr(sb.from(T.secT).insert([row]).select('id'),'Section “'+en+'”');
    }).then(function(rows){map[n.tmp]=rows[0].id;E.ns=E.ns.filter(function(x){return x.tmp!==n.tmp;});
      E.nd.forEach(function(d){if(d.secId===n.tmp)d.secId=rows[0].id;});
      if(E.sel[n.pid]===n.tmp)E.sel[n.pid]=rows[0].id;if(E.open[n.pid]===n.tmp)E.open[n.pid]=rows[0].id;});
  }).catch(fail('ns:'+n.tmp));});
  /* new defects — Vision addDefectToSection: restore by key+section_id, else insert (Minor, threshold 0).
     The new key is also kept unique across the whole table: Vision maps defect key → id globally on save. */
  p=p.then(function(){var q=Promise.resolve();
    E.nd.slice().forEach(function(n){q=q.then(function(){
      if(feTmp(n.secId))throw new Error('Its new section wasn’t saved, so this defect wasn’t either.');
      var en=String(n.en).trim(),ar=String(n.ar||'').trim();if(!en)throw new Error('Defect name (EN) is empty.');
      var base=T.key(en)||'defect',sid=n.secId;
      return rd(sb.from(T.defT).select('id,active').eq('key',base).eq('section_id',sid)).then(function(rows){
        if(rows.some(function(x){return x.active;}))throw new Error('“'+en+'” already exists in this section.');
        if(rows[0])return wr(sb.from(T.defT).update({active:true,name_en:en,name_ar:ar||null}).eq('id',rows[0].id).select('id'),'Defect “'+en+'”');
        return rd(sb.from(T.defT).select('key').like('key',base+'%')).then(function(ks){
          var used={};ks.forEach(function(k){used[k.key]=1;});var fk=base,i=2;while(used[fk]){fk=base+'_'+i;i++;}
          var row={section_id:sid,key:fk,name_en:en,name_ar:ar||null,severity:'Minor',active:true,display_order:ndOrd[n.tmp]};if(T.thr)row.default_threshold=0;
          return wr(sb.from(T.defT).insert([row]).select('id'),'Defect “'+en+'”');});
      }).then(function(){E.nd=E.nd.filter(function(x){return x.tmp!==n.tmp;});});
    }).catch(fail('nd:'+n.tmp));});
    return q;});
  /* edits to existing rows: one update per row */
  p=p.then(function(){var jobs=[];
    Object.keys(E.se).forEach(function(id){var s=feSec(kind,id),e=E.se[id];if(!s)return;pids[s.pid]=1;var u={};
      if(e.hasOwnProperty('en')){var v=String(e.en).trim();if(!v){E.errs['se:'+id]='Section name (EN) can’t be empty.';return;}u[T.secName]=v;}
      if(T.secAr&&e.hasOwnProperty('ar'))u.name_ar=String(e.ar).trim()||null;
      if(e.hasOwnProperty('active'))u.active=e.active;
      jobs.push(wr(sb.from(T.secT).update(u).eq('id',id).select('id'),'Section “'+s.en+'”').then(function(){delete E.se[id];}).catch(fail('se:'+id)));});
    Object.keys(E.de).forEach(function(id){var d=feDef(kind,id),e=E.de[id];if(!d)return;pids[d.pid]=1;var u={};
      if(e.hasOwnProperty('en')){var v=String(e.en).trim();if(!v){E.errs['de:'+id]='Defect name (EN) can’t be empty.';return;}u.name_en=v;}
      if(e.hasOwnProperty('ar'))u.name_ar=String(e.ar).trim()||null;
      if(e.hasOwnProperty('sev')){if(FE_SEV.indexOf(e.sev)<0&&kind==='insp'){E.errs['de:'+id]='Severity must be Minor, Major or Critical.';return;}u.severity=e.sev;}
      if(T.thr&&e.hasOwnProperty('thr')){var t=String(e.thr).trim(),x=Number(t);if(t===''||!isFinite(x)||x<0){E.errs['de:'+id]='Threshold must be a number, 0 or more.';return;}u.default_threshold=x;}
      if(e.hasOwnProperty('active'))u.active=e.active;
      jobs.push(wr(sb.from(T.defT).update(u).eq('id',id).select('id'),'Defect “'+d.en+'”').then(function(){delete E.de[id];}).catch(fail('de:'+id)));});
    return Promise.all(jobs);});
  /* section order → <section table>.display_order (Client QC: cqc_defect_sections, never defect_sections) */
  p=p.then(function(){return Promise.all(Object.keys(ordSnap).map(function(pid){
    var list=ordSnap[pid].map(function(id){return feTmp(id)?(map[id]||null):id;});
    var ups=list.map(function(id,i){if(!id)return null;var s=feSec(kind,id);if(!s||s.order===i)return null;
      return wr(sb.from(T.secT).update({display_order:i}).eq('id',id).select('id'),'Order of “'+s.en+'”');}).filter(Boolean);
    return Promise.all(ups).then(function(){delete E.ord[pid];},function(e){E.errs['ord:'+pid]=(e&&e.message)||'Failed';
      E.ord[pid]=list.map(function(id,i){return id||ordSnap[pid][i];});});
  }));});
  p.catch(function(e){E.errs._=(e&&e.message)||'Network error';}).then(function(){
    return Promise.all(Object.keys(pids).map(function(pid){return feLoad(kind,pid);}));
  }).then(function(){E.busy=false;var n=Object.keys(E.errs).length;
    if(n)aToast(n+' change'+(n===1?' was':'s were')+' not saved. '+(n===1?'It is':'They are')+' still listed as unsaved.',true);else aToast('Saved');
    admRender();});
}
/* ── form editor: render ── */
function feKeb(key,label,items){var open=AD.rowMenu===key;
  var h='<div class="kw"><button type="button" class="keb" aria-haspopup="menu" aria-expanded="'+open+'" aria-label="'+aEsc(label)+'" data-act="kebab" data-arg="'+aEsc(key)+'" data-fid="keb-'+aEsc(key)+'">⋯</button>';
  if(open)h+='<div class="rmenu" role="menu" aria-label="'+aEsc(label)+'">'+items+'</div>';return h+'</div>';}
function feSevCls(v){return v==='Critical'?'s-cri':v==='Major'?'s-maj':'s-min';}
function feErrLine(kind,k){var m=AD.fe[kind].errs[k];return m?'<div class="fe-rerr" role="alert">⚠ Not saved: '+aEsc(m)+'</div>':'';}
function feArrows(kind,r,act,m){var i=act.indexOf(r.id),nm=aEsc(r.en||'section');
  return '<button type="button" class="ib" aria-label="Move '+nm+' up" data-act="feup" data-arg="'+kind+'|'+aEsc(r.id)+'" data-fid="'+m+'feu-'+aEsc(r.id)+'"'+(i<=0?' disabled':'')+'>▲</button>'+
    '<button type="button" class="ib" aria-label="Move '+nm+' down" data-act="fedn" data-arg="'+kind+'|'+aEsc(r.id)+'" data-fid="'+m+'fed-'+aEsc(r.id)+'"'+(i<0||i>=act.length-1?' disabled':'')+'>▼</button>';}
function feSecFields(kind,r,m){
  var E=AD.fe[kind],T=FE_T[kind],w=r.isNew?'ns':'se',dis=!r.active||E.busy,base=kind+'|'+w+'|'+aEsc(r.id),ed=E.se[r.id]||{};
  var h='<div class="fe-shead"><label class="fl"><span>Section name (EN)</span><input class="inp'+(ed.hasOwnProperty('en')?' chg':'')+'" data-fid="'+m+'fe-'+aEsc(r.id)+'-en" data-in="fe" data-arg="'+base+'|en" value="'+aEsc(r.en)+'" autocomplete="off"'+(dis?' disabled':'')+'></label>';
  if(T.secAr)h+='<label class="fl"><span>Arabic name <small class="optl">(optional)</small></span><input class="inp'+(ed.hasOwnProperty('ar')?' chg':'')+(feNoAr(r)?' miss':'')+'" dir="rtl" lang="ar" placeholder="الاسم بالعربية" data-fid="'+m+'fe-'+aEsc(r.id)+'-ar" data-in="fe" data-arg="'+base+'|ar" value="'+aEsc(r.ar)+'" autocomplete="off"'+(dis?' disabled':'')+'></label>';
  if(r.gone)h+='<div class="fe-sact"><span class="atag">Will be deleted on Save</span><button type="button" class="adm-btn" data-act="ferest" data-arg="'+kind+'|se|'+aEsc(r.id)+'">Undo</button></div>';
  else if(!r.active)h+='<div class="fe-sact"><span class="atag">Archived</span><button type="button" class="adm-btn" data-act="ferest" data-arg="'+kind+'|se|'+aEsc(r.id)+'"'+(E.busy?' disabled':'')+'>Restore</button></div>';
  else h+=feKeb(m+'fes|'+kind+'|'+r.id,'Actions for section '+(r.en||''),r.isNew?
    '<button type="button" role="menuitem" class="red" data-act="fedel" data-arg="'+kind+'|ns|'+aEsc(r.id)+'">🗑 Remove new section</button>':
    '<button type="button" role="menuitem" class="red" data-act="fedel" data-arg="'+kind+'|se|'+aEsc(r.id)+'">🗑 Delete section…</button>');
  h+='</div>';
  if(r.isNew)h+='<div class="fe-note acc">New section · not saved yet</div>';
  if(!r.active&&!r.gone)h+='<p class="hint">This section is archived, so it isn’t on new '+T.past+'. Restore it to edit.</p>';
  return h+feErrLine(kind,(r.isNew?'ns:':'se:')+r.id);}
/* one defect → its controls (shared by the desktop table and phone cards) */
function feDefCtl(kind,d,m){
  var E=AD.fe[kind],T=FE_T[kind],w=d.isNew?'nd':'de',dis=!d.active||E.busy,base=kind+'|'+w+'|'+aEsc(d.id),ed=E.de[d.id]||{},nm=aEsc(d.en||'defect'),fid=m+'fe-'+aEsc(d.id);
  var c={};
  c.en='<input class="inp'+(ed.hasOwnProperty('en')?' chg':'')+'" aria-label="Defect name (EN)" data-fid="'+fid+'-en" data-in="fe" data-arg="'+base+'|en" value="'+aEsc(d.en)+'" autocomplete="off"'+(dis?' disabled':'')+'>';
  c.ar='<input class="inp'+(ed.hasOwnProperty('ar')?' chg':'')+(feNoAr(d)?' miss':'')+'" dir="rtl" lang="ar" aria-label="Arabic name for '+nm+'" placeholder="الاسم بالعربية" data-fid="'+fid+'-ar" data-in="fe" data-arg="'+base+'|ar" value="'+aEsc(d.ar)+'" autocomplete="off"'+(dis?' disabled':'')+'>';
  var opts=FE_SEV.slice();if(d.sev&&opts.indexOf(d.sev)<0)opts.push(d.sev);
  c.sev='<select class="sev '+feSevCls(d.sev)+(ed.hasOwnProperty('sev')?' chg':'')+'" aria-label="Severity for '+nm+'" data-fid="'+fid+'-sev" data-ch="fe" data-arg="'+base+'|sev"'+(dis||d.isNew?' disabled':'')+'>'+opts.map(function(o){return '<option value="'+aEsc(o)+'"'+(o===d.sev?' selected':'')+'>'+aEsc(o)+'</option>';}).join('')+'</select>';
  if(T.thr){var bad=String(d.thr).trim()===''||!isFinite(Number(d.thr))||Number(d.thr)<0;
    c.thr='<span class="thr"><input class="inp'+(ed.hasOwnProperty('thr')?' chg':'')+(bad&&!d.isNew?' bad':'')+'" inputmode="decimal" aria-label="Threshold percent for '+nm+'" data-fid="'+fid+'-thr" data-in="fe" data-arg="'+base+'|thr" value="'+aEsc(d.thr)+'" autocomplete="off"'+(dis||d.isNew?' disabled':'')+'><span aria-hidden="true">%</span></span>';}
  else c.thr='<span class="thr"><input class="inp" disabled value="—" aria-label="No threshold: Client QC has no thresholds today"><span aria-hidden="true">%</span></span>';
  if(d.gone)c.act='<button type="button" class="adm-btn" aria-label="Undo delete of '+nm+'" data-act="ferest" data-arg="'+kind+'|de|'+aEsc(d.id)+'">Undo</button>';
  else if(!d.active)c.act='<button type="button" class="adm-btn" aria-label="Restore '+nm+'" data-act="ferest" data-arg="'+kind+'|de|'+aEsc(d.id)+'"'+(E.busy?' disabled':'')+'>Restore</button>';
  else c.act=feKeb(m+'fed|'+kind+'|'+d.id,'Actions for '+(d.en||'defect'),d.isNew?
    '<button type="button" role="menuitem" class="red" data-act="fedel" data-arg="'+kind+'|nd|'+aEsc(d.id)+'">🗑 Remove new defect</button>':
    '<button type="button" role="menuitem" class="red" data-act="fedel" data-arg="'+kind+'|de|'+aEsc(d.id)+'">🗑 Delete…</button>');
  c.note=d.isNew?'<div class="fe-note acc">New · not saved yet. Severity and threshold can be set after saving.</div>':d.gone?'<div class="fe-note acc">Will be deleted on Save</div>':!d.active?'<div class="fe-note">Archived</div>':'';
  c.err=feErrLine(kind,w+':'+d.id);
  c.cls=(d.isNew?' new':'')+(d.gone||!d.active?' arch':'')+(ed&&Object.keys(ed).length?' chg':'');
  return c;}
function feAddDefHTML(kind,r,m){var E=AD.fe[kind],ok=String(E.nv.defEn||'').trim()&&!E.busy,arg=kind+'|'+aEsc(r.id);
  return '<div class="fe-adddef"><label class="fl"><span>Add a defect to '+aEsc(r.en||'this section')+'</span><input class="inp" placeholder="Defect name (EN)" data-fid="'+m+'fe-nv-den" data-in="fenv" data-arg="'+kind+'|defEn" value="'+aEsc(E.nv.defEn||'')+'" data-enter="feadddef" data-enter-arg="'+arg+'" autocomplete="off"></label>'+
    '<label class="fl"><span>Arabic <small class="optl">(optional)</small></span><input class="inp" dir="rtl" lang="ar" placeholder="الاسم بالعربية" data-fid="'+m+'fe-nv-dar" data-in="fenv" data-arg="'+kind+'|defAr" value="'+aEsc(E.nv.defAr||'')+'" data-enter="feadddef" data-enter-arg="'+arg+'" autocomplete="off"></label>'+
    '<button type="button" class="adm-btn" data-act="feadddef" data-arg="'+arg+'"'+(ok?'':' disabled')+'>+ Add defect</button></div>';}
function feAddSecHTML(kind,m){var E=AD.fe[kind],T=FE_T[kind],ok=String(E.nv.secEn||'').trim()&&!E.busy;
  return '<div class="fe-addsec"><label class="fl"><span>New section name (EN)</span><input class="inp" placeholder="e.g. Storage" data-fid="'+m+'fe-nv-sen" data-in="fenv" data-arg="'+kind+'|secEn" value="'+aEsc(E.nv.secEn||'')+'" data-enter="feaddsec" data-enter-arg="'+kind+'" autocomplete="off"></label>'+
    (T.secAr?'<label class="fl"><span>Arabic <small class="optl">(optional)</small></span><input class="inp" dir="rtl" lang="ar" placeholder="الاسم بالعربية" data-fid="'+m+'fe-nv-sar" data-in="fenv" data-arg="'+kind+'|secAr" value="'+aEsc(E.nv.secAr||'')+'" data-enter="feaddsec" data-enter-arg="'+kind+'" autocomplete="off"></label>':'')+
    '<button type="button" class="adm-btn" data-act="feaddsec" data-arg="'+kind+'"'+(ok?'':' disabled')+'>+ Add section</button></div>';}
function feSecLabel(kind,r){var n=feDefRows(kind,r).filter(function(d){return d.active;}).length;
  return '<b><span class="fe-nmt" title="'+aEsc(r.en||'(no name)')+'">'+aEsc(r.en||'(no name)')+'</span>'+(feSecMiss(kind,r)&&r.active?' <span class="mdot" role="img" aria-label="Missing Arabic"></span>':'')+(r.isNew?' <span class="ntag">new</span>':'')+(r.gone?' <span class="atag">deleting</span>':!r.active?' <span class="atag">Archived</span>':'')+'</b>';}
function feHTML(kind){
  var E=AD.fe[kind],T=FE_T[kind],S=AD.st,sp=aStProds(),pid=feProdId(kind),pn=pid?aProdName(pid):'';
  var h='<div class="fe-head"><div class="grow"><h2 class="fe-t">'+aEsc(T.label)+'</h2><p class="fe-d">'+aEsc(T.desc)+'</p></div><div class="fe-prod"><div class="lbl" id="fepl-'+kind+'">Product</div>';
  h+='<div class="seg desk-only" role="radiogroup" aria-labelledby="fepl-'+kind+'">'+sp.map(function(p){var on=p.id===pid;
    return '<button type="button" role="radio" aria-checked="'+on+'" data-act="feprod" data-arg="'+kind+'|'+aEsc(p.id)+'" data-fid="fep-'+kind+'-'+aEsc(p.id)+'">'+aEsc(p.name)+(feProdDirty(kind,p.id)?' <span class="mdot" role="img" aria-label="unsaved changes"></span>':'')+'</button>';}).join('')+'</div>';
  h+='<div class="mobile-only"><select aria-labelledby="fepl-'+kind+'" data-fid="fepm-'+kind+'" data-ch="feprod" data-arg="'+kind+'">'+sp.map(function(p){return '<option value="'+aEsc(p.id)+'"'+(p.id===pid?' selected':'')+'>'+aEsc(p.name)+(feProdDirty(kind,p.id)?' • unsaved':'')+'</option>';}).join('')+'</select></div>';
  h+='<div class="fe-test">'+(sp.hidden&&!S.test?'<span class="hint" style="margin:0">'+sp.hidden+' test product'+(sp.hidden===1?'':'s')+' hidden</span>':'')+aSwitch('sttest',S.test,'Show test data')+'</div></div></div>';
  if(!pid)return h+aEmpty('No products','Add a product under Catalogue first.');
  if(!E.data[pid]&&E.err[pid])return h+'<div class="card empty err" role="alert"><div class="big" aria-hidden="true">⚠</div><b>Couldn’t load the '+aEsc(T.label.toLowerCase())+' for '+aEsc(pn)+'</b><p>'+aEsc(E.err[pid])+'. Nothing was changed.</p><button type="button" class="adm-btn pri" data-act="feretry" data-arg="'+kind+'|'+aEsc(pid)+'">↻ Retry</button></div>';
  if(!E.data[pid]){if(!E.load[pid])feLoad(kind,pid);return h+aLoading(5,'Loading '+T.label.toLowerCase()+'…');}
  h+='<div class="banner" role="note"><span aria-hidden="true">ⓘ</span><div>Changes apply to <b>'+aEsc(pn)+'</b> only.</div></div>';
  if(kind==='cqc')h+='<div class="banner warn" role="note"><span aria-hidden="true">⚠</span><div>Client QC section names have no Arabic field, and Client QC has no thresholds today. Vision’s Client QC form doesn’t hide deleted (archived) defects yet, so they keep showing there until Vision is fixed.</div></div>';
  if(E.err[pid])h+='<div class="ferr" role="alert">Couldn’t refresh: '+aEsc(E.err[pid])+'</div>';
  var st=feStats(kind,pid);
  h+='<div class="chiprow" role="group" aria-label="Filter defects"><button type="button" class="chip" aria-pressed="'+(!E.miss)+'" data-act="feall" data-arg="'+kind+'" data-fid="fem0-'+kind+'">All defects <span class="c">'+st.defs+'</span></button>'+
    '<button type="button" class="chip warn" aria-pressed="'+E.miss+'" data-act="femiss" data-arg="'+kind+'" data-fid="fem-'+kind+'"><span class="mdot" aria-hidden="true"></span>Missing Arabic ('+st.miss+')</button>'+
    '<button type="button" class="sw-row" role="switch" aria-checked="'+E.arch+'" data-act="fearch" data-arg="'+kind+'" data-fid="fea-'+kind+'"><span class="sw"></span><span class="fe-arl">Show archived</span><span class="fe-ars" aria-hidden="true">Archived</span> ('+st.arch+')</button></div>';
  var errKeys=Object.keys(E.errs);
  if(errKeys.length){var ch=feChanges(kind);
    h+='<div class="ferr" role="alert"><b>Not saved — still listed as unsaved:</b><ul>'+errKeys.map(function(k){var c=ch.filter(function(x){return x.k===k;})[0];return '<li>'+aEsc((c?c.t+': ':'')+E.errs[k])+'</li>';}).join('')+'</ul></div>';}
  var rows=feRows(kind,pid),vis=rows.filter(feVisSec(kind)),act=vis.filter(function(r){return r.active;}),selId=feSelId(kind,pid,vis),sel=vis.filter(function(r){return r.id===selId;})[0];
  var visDef=feVisDef(kind);
  /* desktop: two panes */
  var L='<div class="card fe-secs"><h3 class="fe-h">Sections · '+act.length+'</h3>'+feErrLine(kind,'ord:'+pid)+'<div role="list" aria-label="Sections in form order">';
  vis.forEach(function(r){var on=r.id===selId;
    L+='<div class="fe-sec'+(on?' on':'')+(r.active?'':' arch')+(feSecDirty(kind,r)?' dirty':'')+'" role="listitem"'+(r.active&&!E.busy?' draggable="true" data-drag="'+kind+'|'+aEsc(r.id)+'"':'')+'>'+
      (r.active?'<span class="fe-hd" aria-hidden="true" title="Drag to reorder">⋮⋮</span>':'<span class="fe-hd" aria-hidden="true"></span>')+
      '<button type="button" class="fe-nm" aria-pressed="'+on+'" data-act="fesel" data-arg="'+kind+'|'+aEsc(r.id)+'" data-fid="fes-'+aEsc(r.id)+'">'+feSecLabel(kind,r)+
      (FE_T[kind].secAr?'<small'+(r.ar?' dir="rtl" lang="ar"':'')+'>'+(r.ar?aEsc(r.ar):'<span class="warnt">No Arabic</span>')+'</small>':'')+
      '<small>'+fePlDef(feDefRows(kind,r).filter(function(d){return d.active;}).length)+'</small></button>'+
      (r.active&&!E.busy?feArrows(kind,r,act.map(function(x){return x.id;}),''):'')+'</div>';});
  if(!vis.length)L+='<p class="hint" style="margin:8px">No sections yet. Add one below.</p>';
  L+='</div>'+feAddSecHTML(kind,'')+'<p class="hint">The order here is the order on the form. Use ▲ ▼ or drag.</p></div>';
  var R='<div class="card fe-right">';
  if(!sel)R+='<p class="hint">Pick a section on the left, or add one.</p>';
  else{
    R+=feSecFields(kind,sel,'');
    var defs=feDefRows(kind,sel).filter(visDef);
    R+='<div class="fe-tw"><table class="fe-tbl"><caption class="sr">Defects in '+aEsc(sel.en)+'</caption><thead><tr><th scope="col">Defect (EN)</th><th scope="col" style="width:24%">Arabic</th><th scope="col" style="width:150px">Severity</th><th scope="col" style="width:132px">Threshold %'+(FE_T[kind].thr?'':'<small>Client QC has no thresholds today</small>')+'</th><th scope="col" style="width:64px"><span class="sr">Actions</span></th></tr></thead><tbody>';
    defs.forEach(function(d){var c=feDefCtl(kind,d,'');
      R+='<tr class="'+c.cls+'"><td>'+c.en+c.note+c.err+'</td><td>'+c.ar+'</td><td>'+c.sev+'</td><td>'+c.thr+'</td><td>'+c.act+'</td></tr>';});
    if(!defs.length)R+='<tr><td colspan="5" class="hint" style="padding:14px 8px">'+(E.miss?'No defects missing Arabic in this section.':'No defects in this section yet.')+'</td></tr>';
    R+='</tbody></table></div>';
    if(sel.active&&!sel.gone)R+=feAddDefHTML(kind,sel,'');
  }
  R+='</div>';
  h+='<div class="fe-panes desk-only fe-wide">'+L+R+'</div>';
  /* phone: accordion */
  var openId=feOpenId(kind,pid),A='';
  vis.forEach(function(r){var open=r.id===openId,n=feDefRows(kind,r).filter(function(d){return d.active;}).length;
    A+='<div class="card fe-acc'+(feSecDirty(kind,r)?' dirty':'')+'"><button type="button" class="fe-acch" aria-expanded="'+open+'" data-act="feopen" data-arg="'+kind+'|'+aEsc(r.id)+'" data-fid="mfeo-'+aEsc(r.id)+'"><span class="nm">'+feSecLabel(kind,r)+
      '<small>'+fePlDef(n)+(FE_T[kind].secAr&&r.ar?' · <span dir="rtl" lang="ar">'+aEsc(r.ar)+'</span>':'')+'</small></span><span class="chev" aria-hidden="true">'+(open?'▲':'▼')+'</span></button>';
    if(open){A+='<div class="fe-accb">'+feSecFields(kind,r,'m');
      if(r.active&&!E.busy){var ids=act.map(function(x){return x.id;});A+='<div class="fe-reorder"><span class="grow">Section order: '+(ids.indexOf(r.id)+1)+' of '+ids.length+'</span>'+feArrows(kind,r,ids,'m')+'</div>';}
      var defs=feDefRows(kind,r).filter(visDef);
      defs.forEach(function(d){var c=feDefCtl(kind,d,'m');
        A+='<div class="dcard'+c.cls+'"><div class="dtop"><div class="fl"><span aria-hidden="true">Defect (EN)</span>'+c.en+'</div>'+c.act+'</div>'+c.note+
          '<div class="fl"><span aria-hidden="true">Arabic</span>'+c.ar+'</div><div class="dgrid"><div class="fl"><span aria-hidden="true">Severity</span>'+c.sev+'</div><div class="fl"><span aria-hidden="true">Threshold %</span>'+c.thr+'</div></div>'+c.err+'</div>';});
      if(!defs.length)A+='<p class="hint">'+(E.miss?'No defects missing Arabic in this section.':'No defects in this section yet.')+'</p>';
      if(r.active&&!r.gone)A+=feAddDefHTML(kind,r,'m');
      A+='</div>';}
    A+='</div>';});
  A+='<div class="card fe-acc" style="padding:12px">'+feAddSecHTML(kind,'m')+'</div>';
  h+='<div class="mobile-only fe-narrow">'+A+'</div>';
  /* save bar */
  var chs=feChanges(kind);
  if(chs.length){var shown=chs.slice(0,3).map(function(x){return x.t;});if(chs.length>3)shown.push('+'+(chs.length-3)+' more');
    h+='<div class="savebar" role="region" aria-label="Unsaved changes"><span class="msg" role="status"><b>'+chs.length+' unsaved change'+(chs.length===1?'':'s')+'</b><small>'+aEsc(shown.join(' · '))+'</small></span>'+
      '<button type="button" class="adm-btn" data-act="fediscard" data-arg="'+kind+'"'+(E.busy?' disabled':'')+'>Discard</button><button type="button" class="adm-btn pri" data-act="fesave" data-arg="'+kind+'"'+(E.busy?' disabled':'')+'>'+(E.busy?'Saving…':'Save')+'</button></div>';}
  return h;
}

/* ── Grapes options (products.specifics where id='grapes') ─────────────────
   Staged adds/removes. Save re-reads the row and merges only this user's adds
   and removes, so a concurrent edit to other values isn't overwritten.       */
var GR_KEYS=[['so2','SO2','SO2 pad options on the grapes inspection.'],['jiffy_pad','Jiffy Pad','Jiffy pad options on the grapes inspection.'],['punnet_type','Punnet Type','Punnet options on the grapes inspection.'],['package_type','Package Type','Package options on the grapes inspection.']];
AD.gr={row:null,err:'',loading:false,adds:{},rms:{},nv:{},saveErr:'',busy:false};
function grLoad(){var G=AD.gr;G.loading=true;G.err='';admRender();
  return Promise.resolve(sb.from('products').select('id,specifics').eq('id','grapes')).then(function(r){
    if(r.error)throw r.error;if(!r.data||!r.data.length)throw new Error('The grapes product was not found');
    G.row=r.data[0].specifics||{};
  }).catch(function(e){G.err=(e&&e.message)||'Load failed';}).then(function(){G.loading=false;admRender();});}
function grList(k){var r=AD.gr.row;return r&&Array.isArray(r[k])?r[k].map(String):[];}
function grCount(){var G=AD.gr,n=0;GR_KEYS.forEach(function(x){n+=(G.adds[x[0]]||[]).length+(G.rms[x[0]]||[]).length;});return n;}
function grToggle(act,k,v){var G=AD.gr,ad=G.adds[k]||[],rm=G.rms[k]||[];
  if(act==='grundo')G.rms[k]=rm.filter(function(x){return x!==v;});
  else if(ad.indexOf(v)>=0)G.adds[k]=ad.filter(function(x){return x!==v;});
  else if(rm.indexOf(v)<0)G.rms[k]=rm.concat([v]);
  G.saveErr='';}
function grAdd(k){var G=AD.gr,v=String(G.nv[k]||'').trim();if(!v)return;var lab=GR_KEYS.filter(function(x){return x[0]===k;})[0][1];
  var rm=G.rms[k]||[],ad=G.adds[k]||[],cur=grList(k);
  if(rm.indexOf(v)>=0){G.rms[k]=rm.filter(function(x){return x!==v;});G.nv[k]='';return;}
  var low=v.toLowerCase();
  if(cur.concat(ad).some(function(x){return x.toLowerCase()===low;})){aToast('“'+v+'” is already a '+lab+' option.',true);return;}
  G.adds[k]=ad.concat([v]);G.nv[k]='';G.saveErr='';}
function grSave(){var G=AD.gr;if(G.busy)return;G.busy=true;G.saveErr='';admRender();
  Promise.resolve(sb.from('products').select('id,specifics').eq('id','grapes')).then(function(r){
    if(r.error)throw r.error;if(!r.data||!r.data.length)throw new Error('The grapes product was not found');
    var cur=r.data[0].specifics||{},next={};Object.keys(cur).forEach(function(k){next[k]=cur[k];});
    GR_KEYS.forEach(function(x){var k=x[0],rm=G.rms[k]||[],ad=G.adds[k]||[];if(!rm.length&&!ad.length)return;
      var list=(Array.isArray(cur[k])?cur[k]:[]).filter(function(v){return rm.indexOf(String(v))<0;});
      ad.forEach(function(v){if(!list.some(function(y){return String(y)===v;}))list.push(v);});
      next[k]=list;});
    return sb.from('products').update({specifics:next}).eq('id','grapes').select('id,specifics');
  }).then(function(r){var rows=aChk(r,'Grapes options');G.row=rows[0].specifics||{};G.adds={};G.rms={};aToast('Saved');})
  .catch(function(e){G.saveErr=(e&&e.message)||'Network error';aToast('Not saved: '+G.saveErr+' Your changes are still listed as unsaved.',true);})
  .then(function(){G.busy=false;admRender();});}
function grHTML(){var G=AD.gr;
  var h='<div class="fe-head"><div class="grow"><h2 class="fe-t">Grapes options <span class="hintag">Grapes only</span></h2><p class="fe-d">Drop-down options inspectors pick on grapes inspections (was “Specifics” in Vision). Removing an option doesn’t change past inspections: each sample keeps its own copy.</p></div></div>';
  if(!G.row&&G.err)return h+'<div class="card empty err" role="alert"><div class="big" aria-hidden="true">⚠</div><b>Couldn’t load the grapes options</b><p>'+aEsc(G.err)+'. Nothing was changed.</p><button type="button" class="adm-btn pri" data-act="grretry">↻ Retry</button></div>';
  if(!G.row){if(!G.loading){G.loading=true;setTimeout(grLoad,0);}return h+aLoading(4,'Loading grapes options…');}
  if(G.saveErr)h+='<div class="ferr" role="alert">Not saved: '+aEsc(G.saveErr)+' Your changes are still listed below.</div>';
  h+='<div class="ggrid">';
  GR_KEYS.forEach(function(x){var k=x[0],cur=grList(k),ad=G.adds[k]||[],rm=G.rms[k]||[],n=cur.length-rm.length+ad.length,ok=String(G.nv[k]||'').trim()&&!G.busy;
    h+='<div class="card gcard"><h3>'+aEsc(x[1])+' <span class="cnt">'+n+'</span></h3><p>'+aEsc(x[2])+'</p><ul class="gopts" aria-label="'+aEsc(x[1])+' options">';
    cur.forEach(function(v){var gone=rm.indexOf(v)>=0,arg=aEsc(k+'|'+v);
      h+='<li class="gopt'+(gone?' rm':'')+'"><span class="t"><span>'+aEsc(v)+'</span>'+(gone?'<span class="atag">removed on Save</span>':'')+'</span>'+
        (gone?'<button type="button" class="adm-btn" aria-label="Undo removing '+aEsc(v)+'" data-act="grundo" data-arg="'+arg+'"'+(G.busy?' disabled':'')+'>Undo</button>':
          '<button type="button" class="adm-btn red" aria-label="Remove '+aEsc(v)+' from '+aEsc(x[1])+'" data-act="grrm" data-arg="'+arg+'"'+(G.busy?' disabled':'')+'>Remove</button>')+'</li>';});
    ad.forEach(function(v){h+='<li class="gopt new"><span class="t"><span>'+aEsc(v)+'</span><span class="ntag">new</span></span><button type="button" class="adm-btn" aria-label="Remove new option '+aEsc(v)+'" data-act="grrm" data-arg="'+aEsc(k+'|'+v)+'"'+(G.busy?' disabled':'')+'>Remove</button></li>';});
    if(!cur.length&&!ad.length)h+='<li class="hint">No options yet.</li>';
    h+='</ul><div class="gadd"><label class="fl"><span>Add '+aEsc(x[1])+' option</span><input class="inp" data-fid="gr-'+k+'" data-in="grnv" data-arg="'+k+'" value="'+aEsc(G.nv[k]||'')+'" data-enter="gradd" data-enter-arg="'+k+'" autocomplete="off"></label><button type="button" class="adm-btn" data-act="gradd" data-arg="'+k+'"'+(ok?'':' disabled')+'>+ Add</button></div></div>';});
  h+='</div>';
  var n=grCount();
  if(n){var bits=[];GR_KEYS.forEach(function(x){(G.adds[x[0]]||[]).forEach(function(v){bits.push(x[1]+': added “'+v+'”');});(G.rms[x[0]]||[]).forEach(function(v){bits.push(x[1]+': removed “'+v+'”');});});
    var shown=bits.slice(0,3);if(bits.length>3)shown.push('+'+(bits.length-3)+' more');
    h+='<div class="savebar" role="region" aria-label="Unsaved changes"><span class="msg" role="status"><b>'+n+' unsaved change'+(n===1?'':'s')+'</b><small>'+aEsc(shown.join(' · '))+'</small></span><button type="button" class="adm-btn" data-act="grdiscard"'+(G.busy?' disabled':'')+'>Discard</button><button type="button" class="adm-btn pri" data-act="grsave"'+(G.busy?' disabled':'')+'>'+(G.busy?'Saving…':'Save')+'</button></div>';}
  return h;}

/* ── Tools › Schema doc (read-only; Vision cfgTab 'schemadoc' → rpc get_schema_columns) ── */
function admSchemaHTML(){
  return '<div class="card fe-tool"><h2 class="fe-t">Schema doc</h2><p class="fe-d">A live HTML document of every DalOS database table, generated from the current database. Useful for audits and for developers.</p>'+
    '<div class="fe-toolrow"><button type="button" class="adm-btn pri" data-act="schemagen"'+(AD.schemaBusy?' disabled':'')+'>'+(AD.schemaBusy?'Generating…':'Generate schema doc ↗')+'</button><span class="hint" style="margin:0">Opens in a new tab · print to PDF</span></div>'+
    '<div class="fe-inc"><b>What’s included</b><ul><li>All tables with every column, type, nullable and default</li><li>Live: always reflects the database at the time you generate it</li><li>Opens as HTML: use your browser’s Print to save it as a PDF</li></ul></div></div>'+
    '<p class="hint">Read-only tool. It doesn’t change any data, so there’s no Save bar here.</p>';}
function admSchemaDoc(data){
  var tbls={};data.forEach(function(c){(tbls[c.table_name]=tbls[c.table_name]||[]).push(c);});
  var now=new Date(),tn=Object.keys(tbls).sort(),ds;
  try{ds=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',day:'2-digit',month:'long',year:'numeric'}).format(now);}catch(_){ds=now.toISOString().slice(0,10);}
  var h='<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>DalOS Schema</title><style>'+
    '*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;padding:40px 48px}'+
    'h1{font-size:26px;color:#2e5d3a;margin-bottom:4px}.sub{font-size:13px;color:#666;margin-bottom:24px}'+
    'h2{font-size:15px;color:#2e5d3a;margin:24px 0 4px;border-bottom:2px solid #2e5d3a;padding-bottom:3px}'+
    'table{width:100%;border-collapse:collapse;margin-bottom:4px;font-size:12px}th{background:#2e5d3a;color:#fff;text-align:left;padding:5px 10px;font-weight:600}'+
    'td{padding:4px 10px;border-bottom:1px solid #eee}tr:nth-child(even) td{background:#f9f9f9}'+
    '.cn{font-family:Courier New,monospace;font-weight:600}.ct{font-family:Courier New,monospace;color:#7d3c98}.nn{color:#aaa}'+
    '.meta{display:flex;gap:24px;margin-bottom:24px;padding:12px 16px;background:#f0f5f1;border-radius:8px;border-left:4px solid #2e5d3a}'+
    '.ml{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.08em}.mv{font-size:14px;font-weight:700;color:#2e5d3a}@media print{.np{display:none}}'+
    '</style></head><body><h1>DalOS Vision</h1><div class="sub">Database Schema · Generated '+aEsc(ds)+' · Live from Supabase · <em>Confidential — DaltexCorp Internal</em></div>'+
    '<div class="meta"><div><div class="ml">Tables</div><div class="mv">'+tn.length+'</div></div><div><div class="ml">Project</div><div class="mv">DalOS Vision</div></div><div><div class="ml">Database</div><div class="mv">Supabase PostgreSQL</div></div></div>'+
    '<button class="np" onclick="window.print()" style="margin-bottom:20px;padding:7px 18px;background:#2e5d3a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">Print / Save as PDF</button>';
  tn.forEach(function(t){h+='<h2>'+aEsc(t)+'</h2><table><thead><tr><th style="width:26%">Column</th><th style="width:18%">Type</th><th style="width:11%">Nullable</th><th>Default</th></tr></thead><tbody>';
    tbls[t].forEach(function(c){var nul=c.is_nullable==='YES';h+='<tr><td><span class="cn">'+aEsc(c.column_name)+'</span></td><td><span class="ct">'+aEsc(c.data_type)+'</span></td><td><span class="'+(nul?'nn':'')+'">'+(nul?'nullable':'NOT NULL')+'</span></td><td style="color:#888;font-size:11px">'+(c.column_default!=null?aEsc(c.column_default):'—')+'</td></tr>';});
    h+='</tbody></table>';});
  return h+'</body></html>';}
function admSchemaGen(){
  if(AD.schemaBusy)return;var w=null;try{w=window.open('','_blank');if(w)w.document.write('<p style="font-family:sans-serif;padding:24px">Generating schema doc…</p>');}catch(_){}
  AD.schemaBusy=true;admRender();
  Promise.resolve(sb.rpc('get_schema_columns')).then(function(res){
    if(res.error)throw res.error;if(!res.data||!res.data.length)throw new Error('No data returned');
    var url=URL.createObjectURL(new Blob([admSchemaDoc(res.data)],{type:'text/html'}));
    if(w&&!w.closed)w.location.href=url;
    else{var a=document.createElement('a'),d=new Date();a.href=url;a.download='DalOS_Schema_'+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'.html';document.body.appendChild(a);a.click();a.remove();}
    setTimeout(function(){URL.revokeObjectURL(url);},60000);aToast('Schema doc ready');
  }).catch(function(e){if(w&&!w.closed)w.close();aToast('Could not load schema: '+((e&&e.message)||'error'),true);})
  .then(function(){AD.schemaBusy=false;admRender();});}

/* ── Activity log (read-only) ──────────────────────────────────────────────
   Source: admin-only RPC list_admin_activity(p_from,p_to,p_actor,p_target_type,
   p_target_id,p_action_prefix,p_q,p_limit,p_offset) → newest first. The table
   itself has no client access. SECURITY: every value from a row (names, labels,
   app, details JSON) is rendered through aEsc(); `app` is a display label only. */
var ACT_PAGE=50;
var ACT_TYPE={user:'user',packhouse:'packhouse',product:'product',category:'category',variety:'variety',sub_client:'sub-client',season:'season',client:'client',country:'country',farm:'farm',class:'class',carton_type:'carton type',defect:'defect',defect_section:'defect section',cqc_defect:'Client QC defect',cqc_defect_section:'Client QC defect section'};
var ACT_APPS={workspace:'Workspace',vision:'Vision',analytics:'Analytics',commercial:'Commercial',land:'Land Cloud'};
var ACT_ACTIONS=[
  ['People',[['user.','All user changes'],['user.added','User added'],['user.role_changed','Role changed'],['user.deactivated','Deactivated'],['user.reactivated','Reactivated'],['user.edited','Details edited'],['user.deleted','User deleted'],['user.packhouses','Vision packhouses'],['user.region','Commercial regions'],['user.password_reset_prepared','Password reset email'],['user.invite_email_prepared','Welcome email']]],
  ['Analytics access',[['analytics.','All Analytics access'],['analytics.granted','Granted'],['analytics.revoked','Removed'],['analytics.request','Access requests']]],
  ['Vision settings',[['packhouse.','Packhouses'],['farm.','Farms'],['product.','Products'],['category.','Categories'],['variety.','Varieties'],['class.','Classes'],['carton_type.','Carton types'],['client.','Clients'],['sub_client.','Sub-clients'],['country.','Countries'],['season.','Seasons']]],
  ['Forms',[['defect.','Defects'],['defect_section.','Defect sections'],['cqc_defect.','Client QC defects'],['cqc_defect_section.','Client QC defect sections']]]
];
function actDefF(){return {q:'',action:'',actor:'',app:'',range:'all',from:'',to:'',user:''};}
AD.act={rows:null,err:'',busy:false,loaded:0,f:actDefF(),streams:[],open:{},seq:0,sheet:false};

/* Cairo calendar helpers (DST-safe: the offset is read back from Intl) */
function actParts(d){var p={};try{new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d).forEach(function(x){p[x.type]=x.value;});}catch(e){return null;}if(p.hour==='24')p.hour='00';return p;}
function actDayKey(d){var p=actParts(d);return p?p.year+'-'+p.month+'-'+p.day:d.toISOString().slice(0,10);}
function actAddDays(key,n){var a=key.split('-').map(Number);return new Date(Date.UTC(a[0],a[1]-1,a[2]+n)).toISOString().slice(0,10);}
function actMidnight(key){var a=key.split('-').map(Number),want=Date.UTC(a[0],a[1]-1,a[2]),g=want;
  for(var i=0;i<2;i++){var p=actParts(new Date(g));if(!p)break;g-=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute)-want;}return new Date(g);}
function actWhen(iso){var d=new Date(iso);if(isNaN(d.getTime()))return String(iso||'');var p=actParts(d);if(!p)return aDate(iso,true);
  var k=p.year+'-'+p.month+'-'+p.day,today=actDayKey(new Date()),hm=p.hour+':'+p.minute;
  if(k===today)return 'Today '+hm;if(k===actAddDays(today,-1))return 'Yesterday '+hm;return aDate(iso)+', '+hm;}
function actRange(){var f=AD.act.f,t=actDayKey(new Date()),r={};
  if(f.range==='today')r.from=actMidnight(t);
  else if(f.range==='7')r.from=actMidnight(actAddDays(t,-6));
  else if(f.range==='30')r.from=actMidnight(actAddDays(t,-29));
  else if(f.range==='custom'){if(f.from)r.from=actMidnight(f.from);if(f.to)r.to=actMidnight(actAddDays(f.to,1));}
  return r;}

/* "By or about a user" can't be one RPC call (actor OR target), so it runs two
   streams and merges them; rows are only shown down to the point both streams
   have loaded, so Load more never inserts older-looking rows above newer ones. */
function actStreams(){var f=AD.act.f,r=actRange();
  var base={p_from:r.from?r.from.toISOString():null,p_to:r.to?r.to.toISOString():null,p_action_prefix:f.action||null,p_q:f.q.trim()||null,p_actor:f.actor||null};
  if(!f.user)return [base];
  var s=[];
  if(!f.actor||f.actor===f.user)s.push(Object.assign({},base,{p_actor:f.user}));
  s.push(Object.assign({},base,{p_target_type:'user',p_target_id:f.user}));
  return s;}
function actReset(){var A=AD.act;clearTimeout(A._qt);A.seq++;A.loaded=1;A.rows=null;A.err='';A.open={};
  A.streams=actStreams().map(function(p){return {p:p,off:0,more:true,rows:[],total:null};});actFetch();}
function actFetch(){var A=AD.act,seq=A.seq,todo=A.streams.filter(function(s){return s.more;});
  A.busy=true;A.err='';admRender();
  Promise.all(todo.map(function(s){
    return Promise.resolve(sb.rpc('list_admin_activity',Object.assign({},s.p,{p_limit:ACT_PAGE,p_offset:s.off}))).then(function(r){if(r&&r.error)throw r.error;return [s,(r&&r.data)||[]];});
  })).then(function(res){if(seq!==A.seq)return;
    res.forEach(function(x){var s=x[0],d=x[1];s.rows=s.rows.concat(d);s.off+=d.length;if(d.length&&d[0].total_count!=null)s.total=Number(d[0].total_count);s.more=d.length===ACT_PAGE&&(s.total==null||s.off<s.total);});
    A.rows=actMerge();
  }).catch(function(e){if(seq!==A.seq)return;A.err=(e&&e.message)||'Load failed';})
  .then(function(){if(seq!==A.seq)return;A.busy=false;admRender();});}
function actTs(r){return new Date(r.occurred_at).getTime();}
function actMerge(){var A=AD.act,seen={},all=[],cut=-Infinity;
  A.streams.forEach(function(s){s.rows.forEach(function(r){if(!seen[r.id]){seen[r.id]=1;all.push(r);}});if(s.more&&s.rows.length)cut=Math.max(cut,actTs(s.rows[s.rows.length-1]));});
  all.sort(function(a,b){return actTs(b)-actTs(a)||Number(b.id)-Number(a.id);});
  return all.filter(function(r){return actTs(r)>=cut;});}
function actCloseSheet(){AD.act.sheet=false;admRender();var b=document.querySelector('#admMain [data-fid="actsheet"]');if(b&&b.offsetParent)b.focus();}
function actMore(){return AD.act.streams.some(function(s){return s.more;});}
/* App isn't an RPC parameter → filtered client-side within the loaded rows. Display only. */
function actVisible(){var f=AD.act.f;return (AD.act.rows||[]).filter(function(r){return !f.app||(f.app==='none'?!r.app:r.app===f.app);});}
function actFilterCount(){var f=AD.act.f;return (f.q.trim()?1:0)+(f.action?1:0)+(f.actor?1:0)+(f.app?1:0)+(f.range!=='all'?1:0)+(f.user?1:0);}
/* Fire-and-forget client event. Whitelisted scalar keys only (method / email_to) — never a password. */
function actLog(action,uid,det){try{Promise.resolve(sb.rpc('log_admin_event',{p_action:action,p_target_type:'user',p_target_id:String(uid),p_details:det||{}})).then(function(r){if(r&&r.error&&window.console)console.warn('log_admin_event:',r.error.message);},function(){});}catch(e){}}

/* ── sentences ── */
function actActor(r){if(r.actor_name)return r.actor_name;if(!r.actor_id)return 'System';var u=aUser(r.actor_id);return (u&&u.name)||'Unknown user';}
function actKeyLabel(k){return String(k).replace(/_/g,' ');}
function actFmt(k,v){if(v==null||v==='')return 'empty';if(v===true)return 'yes';if(v===false)return 'no';
  if(k==='role'&&typeof v==='string')return aRoleLabel(v);
  if(Array.isArray(v)&&v.every(function(x){return x==null||typeof x!=='object';}))return v.length?v.join(', '):'none';
  if(typeof v==='object')return JSON.stringify(v);return String(v);}
function actKeys(ch){var k=Object.keys(ch||{});if(!k.length)return '';return ' ('+aEsc(k.slice(0,3).map(actKeyLabel).join(', ')+(k.length>3?' +'+(k.length-3)+' more':''))+')';}
function actSentence(r){
  var B=function(x){return '<b>'+aEsc(x)+'</b>';},a=B(actActor(r)),t=B(r.target_label||r.target_id||'—');
  var d=(r.details&&typeof r.details==='object')?r.details:{},ch=(d.changes&&typeof d.changes==='object')?d.changes:{};
  var act=String(r.action||''),kind=act.split('.')[0],verb=act.split('.')[1]||'';
  var self=!!r.actor_id&&r.target_type==='user'&&String(r.actor_id)===String(r.target_id);
  var reg=B(d.region_name||d.region_id||'?');
  var phs=Array.isArray(d.packhouses)?d.packhouses.map(function(p){return p&&(p.name||p.id);}).filter(Boolean):[];
  var phw=phs.length>3?B(phs.length+' packhouses'):phs.length?phs.map(B).join(', '):'packhouses';
  switch(act){
    case 'user.added':return a+' added '+t+(d.new&&d.new.role?' as '+B(aRoleLabel(d.new.role)):'');
    case 'user.deleted':return a+' deleted '+t;
    case 'user.deactivated':return a+' deactivated '+t;
    case 'user.reactivated':return a+' reactivated '+t;
    case 'user.role_changed':return a+' changed '+t+'’s role'+(ch.role?' from '+B(actFmt('role',ch.role.from))+' to '+B(actFmt('role',ch.role.to)):'');
    case 'user.edited':return a+' edited '+t+actKeys(ch);
    case 'user.region_added':return a+' added '+t+' to the '+reg+' region';
    case 'user.region_removed':return a+' removed '+t+' from the '+reg+' region';
    case 'user.region_manager_set':return a+' made '+t+' a manager of the '+reg+' region';
    case 'user.region_manager_unset':return a+' removed '+t+' as manager of the '+reg+' region';
    case 'user.region_edited':return a+' changed '+t+'’s '+reg+' region membership';
    case 'user.packhouses_added':return a+' gave '+t+' Vision access to '+phw;
    case 'user.packhouses_removed':return a+' removed '+t+'’s Vision access to '+phw;
    case 'user.password_reset_prepared':return a+' prepared a password-reset email for '+t;
    case 'user.invite_email_prepared':return a+' prepared a welcome email for '+t;
    case 'analytics.granted':return a+' granted Analytics access to '+t;
    case 'analytics.revoked':return a+' removed '+t+'’s Analytics access';
    case 'analytics.access_edited':return a+' changed '+t+'’s Analytics access'+actKeys(ch);
    case 'analytics.requested':return self||!r.actor_id?t+' asked for Analytics access':a+' requested Analytics access for '+t;
    case 'analytics.request_approved':return a+' approved '+t+'’s Analytics request';
    case 'analytics.request_declined':return a+' declined '+t+'’s Analytics request';
    case 'analytics.request_deleted':return self?t+' withdrew their Analytics request':a+' deleted '+t+'’s Analytics request';
    case 'analytics.request_edited':return a+' updated '+t+'’s Analytics request';
  }
  if(kind!=='user'&&ACT_TYPE.hasOwnProperty(kind)){var ty=aEsc(ACT_TYPE[kind]);
    var nm=(ch.name&&ch.name.from!=null)?ch.name:(ch.name_en&&ch.name_en.from!=null)?ch.name_en:null;
    if(verb==='edited'&&nm)return a+' renamed the '+ty+' '+B(actFmt('name',nm.from))+' to '+B(actFmt('name',nm.to))+(Object.keys(ch).length>1?actKeys(ch):'');
    var vb={added:'added',deleted:'deleted',edited:'edited',removed:'removed',restored:'restored',activated:'activated',deactivated:'deactivated'};
    if(vb.hasOwnProperty(verb))return a+' '+vb[verb]+' the '+ty+' '+t+(verb==='edited'?actKeys(ch):'');
  }
  return a+' · '+aEsc(act)+' · '+t;
}
function actDl(obj,fmt){var h='<dl class="act-ch">';Object.keys(obj).forEach(function(k){h+='<dt>'+aEsc(actKeyLabel(k))+'</dt><dd>'+fmt(k,obj[k])+'</dd>';});return h+'</dl>';}
function actDetailHTML(r){
  var d=(r.details&&typeof r.details==='object'&&!Array.isArray(r.details))?r.details:{},h='',done={changes:1,new:1,old:1,packhouses:1,actor_inferred:1};
  if(d.changes&&typeof d.changes==='object'){
    h+='<div class="act-sh">What changed</div>'+actDl(d.changes,function(k,c){
      if(c&&typeof c==='object'&&c.changed===true&&!('from' in c))return '<span class="act-hid">changed (value not recorded)</span>';
      c=(c&&typeof c==='object')?c:{};
      return '<span class="act-from">'+aEsc(actFmt(k,c.from))+'</span> <span aria-hidden="true">→</span><span class="sr"> to </span> <span class="act-to">'+aEsc(actFmt(k,c.to))+'</span>';});
  }
  var snap=d.new||d.old;
  if(snap&&typeof snap==='object')h+='<div class="act-sh">'+(d.new?'Created with':'Record before it was deleted')+'</div>'+actDl(snap,function(k,v){return aEsc(actFmt(k,v));});
  if(Array.isArray(d.packhouses))h+='<div class="act-sh">Packhouses</div><p class="act-p">'+aEsc(d.packhouses.map(function(p){return p&&typeof p==='object'?(p.name||p.id):p;}).join(', ')||'none')+'</p>';
  var rest={};Object.keys(d).forEach(function(k){if(!done[k])rest[k]=d[k];});
  if(Object.keys(rest).length)h+='<div class="act-sh">Other details</div>'+actDl(rest,function(k,v){return aEsc(actFmt(k,v));});
  if(!h)h='<p class="act-p">No further details were recorded.</p>';
  h+='<p class="act-meta">'+aEsc(aDate(r.occurred_at,true))+' · '+aEsc(r.action)+' · source '+aEsc(r.source||'—')+(r.app?' · app '+aEsc(r.app):'')+(d.actor_inferred===true?' · actor inferred':'')+'</p>';
  return h;
}
function actRowHTML(r){
  var id=String(r.id),open=!!AD.act.open[id],nm=actActor(r),inf=!!(r.details&&r.details.actor_inferred===true),app=r.app?String(r.app):'';
  var cls=ACT_APPS.hasOwnProperty(app)?app:'x';
  return '<li class="act-row'+(open?' open':'')+'"><button type="button" class="act-btn" aria-expanded="'+open+'"'+(open?' aria-controls="actd-'+aEsc(id)+'"':'')+' data-act="actrow" data-arg="'+aEsc(id)+'" data-fid="actrow-'+aEsc(id)+'">'+
    '<span class="av'+(r.actor_id?'':' sys')+'" aria-hidden="true">'+(r.actor_id?aEsc(aIni(nm)):'⚙')+'</span>'+
    '<span class="act-bd"><span class="act-s">'+actSentence(r)+'</span><span class="act-m"><time datetime="'+aEsc(r.occurred_at)+'" title="'+aEsc(aDate(r.occurred_at,true))+'">'+aEsc(actWhen(r.occurred_at))+'</time>'+
      (app?'<span class="act-app a-'+cls+'">'+aEsc(cls==='x'?app:ACT_APPS[app])+'</span>':'')+
      (inf?'<span class="act-inf" title="The person was worked out from the record, not from their sign-in.">actor inferred</span>':'')+'</span></span>'+
    '<span class="act-chev" aria-hidden="true">'+(open?'▴':'▾')+'</span></button>'+
    (open?'<div class="act-det" id="actd-'+aEsc(id)+'">'+actDetailHTML(r)+'</div>':'')+'</li>';
}
function admActivityHTML(){
  var A=AD.act,f=A.f,nf=actFilterCount();
  var h='<div class="crumb">Workspace / Admin</div><div class="ptrow"><div><h1 class="pt">Activity log</h1><p class="sub">Who changed users, roles, access and settings, and when. Read-only.</p></div><div class="hsp"></div>'+
    '<button type="button" class="adm-btn" data-act="actreload"'+(A.busy?' disabled':'')+'>↻ Refresh</button></div>';
  /* filters: inline toolbar on desktop, a bottom sheet on phone (same fields) */
  h+='<div class="act-fbar"><button type="button" class="adm-btn" data-act="actsheet" data-fid="actsheet" aria-expanded="'+A.sheet+'" aria-controls="actF">Filters'+(nf?' <span class="badge">'+nf+'</span>':'')+'</button>'+(nf?'<button type="button" class="adm-btn ghost" data-act="actclear">Clear</button>':'')+'</div>';
  if(A.sheet)h+='<div class="scrim act-scrim" data-act="actsheetx"></div>';
  /* Who mirrors the "by or about" banner when opened from a user's Recent activity */
  var who=[['','Anyone']].concat((AD.users||[]).slice().sort(function(x,y){return (x.name||x.email).localeCompare(y.name||y.email);}).map(function(u){return [u.id,(u.name||u.email)+(u.active?'':' (inactive)')+(f.user&&String(u.id)===String(f.user)?' · by or about':'')];}));
  if(f.user&&!aUser(f.user))who.push([f.user,'This user · by or about']);
  var appHint='App filter applies to loaded entries only.';
  var actSel='<label class="fl"><span>Action</span><select data-fid="actaction" data-ch="actaction"><option value="">Any action</option>'+ACT_ACTIONS.map(function(g){return '<optgroup label="'+aEsc(g[0])+'">'+g[1].map(function(o){return '<option value="'+aEsc(o[0])+'"'+(o[0]===f.action?' selected':'')+'>'+aEsc(o[1])+'</option>';}).join('')+'</optgroup>';}).join('')+'</select></label>';
  h+='<div class="act-f'+(A.sheet?' open':'')+'" id="actF" role="group" aria-label="Filter activity">'+
    '<div class="act-fh"><h2>Filters</h2><button type="button" class="keb" data-act="actsheetx" aria-label="Close filters" data-autofocus>✕</button></div>'+
    '<label class="fl search"><span>Search</span><input class="inp" type="search" data-fid="actq" data-in="actq" value="'+aEsc(f.q)+'" placeholder="Person or what was changed" autocomplete="off"></label>'+
    actSel+aSel('actactor','Who',who,f.user||f.actor)+
    aSel('actapp','App',[['','Any app']].concat(Object.keys(ACT_APPS).map(function(k){return [k,ACT_APPS[k]];})).concat([['none','Not recorded']]),f.app,' apph').replace(/<\/label>$/,'<span class="act-fhint">'+aEsc(appHint)+'</span></label>')+
    aSel('actrange','When',[['all','Any time'],['today','Today'],['7','Last 7 days'],['30','Last 30 days'],['custom','Custom dates…']],f.range);
  if(f.range==='custom')h+='<label class="fl"><span>From</span><input class="inp" type="date" data-fid="actfrom" data-ch="actfrom" value="'+aEsc(f.from)+'"></label><label class="fl"><span>To</span><input class="inp" type="date" data-fid="actto" data-ch="actto" value="'+aEsc(f.to)+'"></label>';
  h+='<div class="act-fa"><button type="button" class="adm-btn" data-act="actclear"'+(nf?'':' disabled')+'>Clear filters</button><button type="button" class="adm-btn pri act-done" data-act="actsheetx">Show results</button></div></div>';
  if(f.user){var fu=aUser(f.user);h+='<div class="act-uchip" role="status"><span>Showing activity by or about <b>'+aEsc(fu?(fu.name||fu.email):'this user')+'</b></span><button type="button" class="adm-btn ghost" data-act="actuserx">✕ Show everyone</button></div>';}
  var note='<p class="hint act-note">Activity is recorded from 10 Nov 2026.</p>';
  if(A.rows===null&&A.err)return h+aError("Couldn't load activity",'actreload')+note;
  if(A.rows===null)return h+aLoading(6,'Loading activity…')+note;
  var vis=actVisible(),more=actMore();
  if(!vis.length&&!(more&&f.app)){
    if(!nf)return h+aEmpty('No activity yet','Changes to users, access and Vision settings will show up here.')+note;
    return h+aEmpty('No activity matches these filters','Try a wider date range or clear the filters.','<button type="button" class="adm-btn" data-act="actclear">Clear filters</button>')+note;
  }
  var one=A.streams.length===1?A.streams[0]:null;
  var foot=f.app?vis.length+' of '+A.rows.length+' loaded entries match the App filter'+(more?' · load more to search further':'')+' · '+appHint
    :'Showing '+A.rows.length+(one&&one.total!=null?' of '+one.total:'');
  h+='<div class="card">';
  if(vis.length)h+='<ol class="act-list" aria-label="Activity, newest first">'+vis.map(actRowHTML).join('')+'</ol>';
  else h+='<div class="empty" style="padding:24px"><p style="margin:0">None of the '+A.rows.length+' loaded entries match the App filter.</p></div>';
  if(A.err)h+='<div class="ferr" role="alert" style="margin:10px 14px">Couldn’t load more: '+aEsc(A.err)+'</div>';
  h+='<div class="tfoot"><span role="status">'+aEsc(foot)+'</span>'+(more?'<button type="button" class="adm-btn" data-act="actmore" data-fid="actmore"'+(A.busy?' disabled':'')+'>'+(A.busy?'Loading…':A.err?'↻ Retry':'Load more')+'</button>':'')+'</div></div>';
  return h+note;
}

/* ── events ────────────────────────────────────────────────────────────── */
function admClick(e){
  var t=e.target.closest('[data-act]');if(!t||t.disabled)return;
  var act=t.getAttribute('data-act'),arg=t.getAttribute('data-arg');
  if(act==='phopen'){AD.st.nv.phOpen=!t.parentNode.open;return;}
  if(t.tagName==='A'&&act!=='home'&&act!=='dgo')return;
  var f=AD.f,S=AD.st,c=AD.cfg;
  switch(act){
    case 'home':e.preventDefault();wsGoHome();return;
    case 'signout':wsSignOut();return;
    case 'retry-users':AD.usersErr='';admRender();admLoadUsers();return;
    case 'retry-aa':AD.aaErr='';admRender();admLoadAA();return;
    case 'retry-cfg':AD.cfgErr='';admRender();admLoadCfg();return;
    case 'chip':if(arg==='__inactive'){f.role='';f.status='inactive';}else{f.role=arg;if(f.status==='inactive')f.status='active';}f.page=0;break;
    case 'utest':f.test=!f.test;f.page=0;break;
    case 'clearf':AD.f={q:'',role:'',app:'',status:'active',test:f.test,page:0};break;
    case 'pg':f.page+=parseInt(arg,10);window.scrollTo(0,0);break;
    case 'kebab':e.stopPropagation();AD.rowMenu=AD.rowMenu===arg?null:arg;AD._focusMenu=!!AD.rowMenu;break;
    case 'edit':if(e.target.closest('.kw')&&!e.target.closest('.rmenu'))return;admOpenEdit(arg);return;
    case 'adduser':AD.drawer={mode:'add',v:{name:'',email:'',pw:'',role:'inspector',ph:aActivePH().some(function(p){return p.id==='KZ';})?'KZ':'All',method:'direct'},err:'',busy:false,ret:t};AD._focusLayer=1;break;
    case 'addm':AD.drawer.v.method=arg;break;
    case 'addsave':admAddSave();return;
    case 'dclose':admCloseDrawer(false);return;
    case 'ddiscard':var D=AD.drawer;D.d=JSON.parse(JSON.stringify(D.orig));break;
    case 'dsave':admSaveDrawer();return;
    case 'dgo':AD.drawer=null;return; /* follow the link */
    case 'dph':admDraftPH(arg);break;
    case 'dreg':admDraftReg(arg);break;
    case 'dmgr':var d=AD.drawer.d;d.mgrs=d.mgrs.indexOf(arg)>=0?d.mgrs.filter(function(x){return x!==arg;}):d.mgrs.concat([arg]);break;
    case 'deact':var u=aUser(arg);if(!u)return;AD.rowMenu=null;
      admConfirm({title:'Deactivate '+(u.name.split(' ')[0]||'user')+'?',text:'They won’t be able to sign in to any DalOS app.',list:['They can’t sign in until an admin reactivates them.','Their inspections and records stay as they are.','Their Analytics access is kept but unused while inactive.'],ok:'Deactivate',danger:true,
        run:function(){return Promise.resolve(sb.from('users').update({active:false}).eq('id',arg).select('id,active')).then(function(r){var rows=aChk(r);if(rows[0].active!==false)throw new Error('The database did not confirm the change. Reload and check.');return admLoadUsers();}).then(function(){aToast(u.name+' deactivated');});}});return;
    case 'react':AD.rowMenu=null;Promise.resolve(sb.from('users').update({active:true}).eq('id',arg).select('id,active')).then(function(r){aChk(r);aToast('Reactivated');}).catch(function(e){aToast('Could not reactivate: '+((e&&e.message)||'network error'),true);}).then(admLoadUsers);break;
    case 'resetpw':AD.rowMenu=null;AD.dlg={kind:'resetpw',uid:arg,pw:'',ret:document.activeElement};AD._focusLayer=1;break;
    case 'rpwgo':var ru=aUser(AD.dlg.uid)||{};if(ru.id)actLog('user.password_reset_prepared',ru.id,{method:'prepared_email'});admEmailDlg('reset',{name:ru.name,email:ru.email,pw:AD.dlg.pw});return;
    case 'copymail':var g=AD.dlg;try{navigator.clipboard.writeText('To: '+g.to+'\nSubject: '+g.subj+'\n\n'+g.body).then(function(){aToast('Copied');},function(){aToast('Copy failed — select the text instead.',true);});}catch(_){aToast('Copy failed — select the text instead.',true);}return;
    case 'dlgx':admCloseDlg();return;
    case 'dlgok':var G=AD.dlg;G.busy=true;G.err='';admRender();Promise.resolve().then(G.run).then(function(){if(AD.dlg===G)admCloseDlg();},function(err){G.busy=false;G.err=(err&&err.message)||'Failed — nothing changed.';admRender();});return;
    case 'mxapp':AD.mxApp=arg;break;
    case 'aaok':admAADecide(arg,'approve');return;
    case 'aadeny':admAADecide(arg,'deny');return;
    case 'aarevoke':admAARevoke(arg);return;
    case 'aaclear':AD.aaQ='';break;
    case 'stgrp':var gg=ADM_ST_GROUPS.filter(function(x){return x.k===arg;})[0];S.sub=gg.items[0][0];S.q='';break;
    case 'stsub':S.sub=arg;S.q='';break;
    case 'sttest':S.test=!S.test;break;
    case 'phcol':S.nv.phCol=arg;break;
    case 'phnewprod':var np=(S.nv.phProds||[]).slice(),ni=np.indexOf(arg);if(ni>=0)np.splice(ni,1);else np.push(arg);S.nv.phProds=np;break;
    case 'phadd':(function(){var name=aNv('ph').trim(),prods=(S.nv.phProds||[]).slice();if(!name||!prods.length)return;
      var base=name.replace(/\s+/g,'_'),ex=c.packhouses.map(function(p){return p.id;}),id=base,n2=2;while(ex.indexOf(id)>=0){id=base+'_'+n2;n2++;}
      var col=S.nv.phCol||'#2b5c3f',ini=name.split(' ').map(function(w){return w[0]||'';}).slice(0,2).join('').toUpperCase()||name.slice(0,2).toUpperCase();
      S.nv.ph='';S.nv.phProds=[];S.nv.phCol='#2b5c3f';
      Promise.resolve(sb.from('packhouses').insert([{id:id,name:name,color:col,initials:ini,active:true,product_ids:prods}]).select('id')).then(function(r){aStDone(r,'Packhouse added');}).catch(aStFail);})();break;
    case 'phprod':(function(){var bits=arg.split('|'),id=bits[0],pid=bits[1],ph=c.packhouses.filter(function(x){return x.id===id;})[0];if(!ph)return;
      var p=S.pend[id]||{},cr=(p.crops||ph.crops).slice(),i=cr.indexOf(pid);if(i>=0)cr.splice(i,1);else cr.push(pid);
      if(aSame(cr,ph.crops))delete p.crops;else p.crops=cr;if(p.crops||p.prefix!=null)S.pend[id]=p;else delete S.pend[id];})();break;
    case 'stdiscard':S.pend={};S.pendVar={};break;
    case 'stsave':admStSave();return;
    case 'phdeact':var dph=c.packhouses.filter(function(x){return x.id===arg;})[0];if(!dph)return;
      admConfirm({title:'Deactivate '+dph.name+'?',text:'It will disappear from Vision forms and from this list.',list:['Existing inspections keep it.','You can reactivate it from Vision Admin.'],ok:'Deactivate',danger:true,
        run:function(){return Promise.resolve(sb.from('packhouses').update({active:false}).eq('id',arg).select('id')).then(function(r){aChk(r);delete S.pend[arg];aToast(dph.name+' deactivated');return admLoadCfg();});}});return;
    case 'listadd':admListAdd(S.sub);return;
    case 'listrm':var table=ADM_LIST_TABLE[S.sub];
      admConfirm({title:'Remove “'+arg+'”?',text:'It will no longer be offered in Vision forms. Existing records keep it.',ok:'Remove',danger:true,
        run:function(){return Promise.resolve(sb.from(table).update({active:false}).eq('name',arg).select('id')).then(function(r){aChk(r);aStDone(r,'Removed');});}});return;
    case 'prodadd':(function(){var nm=aNv('prod').trim(),pfx=aNv('prodpfx').trim().toUpperCase();if(!nm)return;
      if(pfx.length<2||pfx.length>3){aToast('Prefix must be 2–3 letters',true);return;}
      if(c.products.some(function(p){return String(p.prefix).toUpperCase()===pfx;})){aToast('Prefix “'+pfx+'” is already in use',true);return;}
      S.nv.prod='';S.nv.prodpfx='';
      Promise.resolve(sb.from('products').insert([{name:nm,inspection_prefix:pfx,color:'#2b5c3f',active:true}]).select('id')).then(function(r){aStDone(r,'Product added');}).catch(aStFail);})();break;
    case 'catadd':(function(){var nm=aNv('cat').trim(),pid=aSelProd();if(!nm||!pid)return;S.nv.cat='';
      Promise.resolve(sb.from('categories').insert([{product_id:pid,name:nm,active:true}]).select('id')).then(function(r){aStDone(r,'Category added');}).catch(aStFail);})();break;
    case 'catrm':admConfirm({title:'Remove this category?',text:'Varieties in it become uncategorised.',ok:'Remove',danger:true,
      run:function(){return Promise.resolve(sb.from('categories').update({active:false}).eq('id',arg).select('id')).then(function(r){aChk(r);aStDone(r,'Removed');});}});return;
    case 'varadd':(function(){var nm=aNv('var').trim(),pid=aSelProd(),cat=S.nv.selCat||null;if(!nm||!pid)return;S.nv.var='';
      Promise.resolve(sb.auth.getUser()).then(function(ur){var row={name:nm,product_id:pid,active:true};if(cat)row.category_id=cat;if(ur.data&&ur.data.user)row.created_by=ur.data.user.id;return sb.from('varieties').insert([row]).select('id');}).then(function(r){aStDone(r,'Variety added');}).catch(aStFail);})();break;
    case 'varrm':admConfirm({title:'Remove this variety?',text:'It will no longer be offered in Vision forms. Existing inspections keep it.',ok:'Remove',danger:true,
      run:function(){return Promise.resolve(sb.from('varieties').update({active:false}).eq('id',arg).select('id')).then(function(r){aChk(r);delete S.pendVar[arg];aStDone(r,'Removed');});}});return;
    case 'subadd':(function(){var nm=aNv('sub').trim(),cid=c.clientsIdMap[S.nv.subParent];if(!nm)return;if(!cid){aToast('Select a client first',true);return;}S.nv.sub='';
      Promise.resolve(sb.from('sub_clients').insert([{name:nm,client_id:cid,active:true}]).select('id')).then(function(r){aStDone(r,'Sub-client added');}).catch(aStFail);})();break;
    case 'subrm':admConfirm({title:'Remove this sub-client?',text:'It will no longer be offered in Vision forms.',ok:'Remove',danger:true,
      run:function(){return Promise.resolve(sb.from('sub_clients').update({active:false}).eq('id',arg).select('id')).then(function(r){aChk(r);aStDone(r,'Removed');});}});return;
    case 'seasonadd':(function(){var nm=aNv('season').trim();if(!nm)return;S.nv.season='';
      Promise.resolve(sb.from('seasons').insert([{name:nm,active:false}]).select('id')).then(function(r){aStDone(r,'Season added');}).catch(aStFail);})();break;
    case 'feprod':var fa=arg.split('|');AD.fe[fa[0]].prod=fa[1];AD.rowMenu=null;break;
    case 'fesel':case 'feopen':(function(){var a=arg.split('|'),E=AD.fe[a[0]],pid=feProdId(a[0]);
      if(act==='feopen')E.open[pid]=(feOpenId(a[0],pid)===a[1])?'':a[1];else E.open[pid]=a[1];E.sel[pid]=a[1];})();break;
    case 'feup':case 'fedn':var fu=arg.split('|');feMove(fu[0],fu[1],act==='feup'?-1:1);break;
    case 'femiss':AD.fe[arg].miss=!AD.fe[arg].miss;break;
    case 'feall':AD.fe[arg].miss=false;break;
    case 'fearch':AD.fe[arg].arch=!AD.fe[arg].arch;break;
    case 'fedel':var fd=arg.split('|');feDelete(fd[0],fd[1],fd[2]);return;
    case 'ferest':var fr=arg.split('|');AD.rowMenu=null;feSet(fr[0],fr[1],fr[2],'active',true);break;
    case 'feaddsec':feAddSec(arg);break;
    case 'feadddef':var fn=arg.split('|');feAddDef(fn[0],fn[1]);break;
    case 'fesave':feSave(arg);return;
    case 'fediscard':(function(){var k=arg,n=feChanges(k).length;
      admConfirm({title:'Discard '+n+' unsaved change'+(n===1?'':'s')+'?',text:'Your edits to the '+FE_T[k].label.toLowerCase()+' will be lost. Nothing has been saved.',ok:'Discard',danger:true,
        run:function(){var E=AD.fe[k];E.se={};E.de={};E.ord={};E.ns=[];E.nd=[];E.errs={};return Promise.resolve();}});})();return;
    case 'feretry':var ft=arg.split('|');AD.fe[ft[0]].err[ft[1]]='';feLoad(ft[0],ft[1]);break;
    case 'grrm':case 'grundo':(function(){var i=arg.indexOf('|');grToggle(act,arg.slice(0,i),arg.slice(i+1));})();break;
    case 'gradd':grAdd(arg);break;
    case 'grsave':grSave();return;
    case 'grdiscard':(function(){var n=grCount();admConfirm({title:'Discard '+n+' unsaved change'+(n===1?'':'s')+'?',text:'Your edits to the grapes options will be lost. Nothing has been saved.',ok:'Discard',danger:true,
        run:function(){AD.gr.adds={};AD.gr.rms={};AD.gr.saveErr='';return Promise.resolve();}});})();return;
    case 'grretry':grLoad();break;
    case 'schemagen':admSchemaGen();return;
    case 'actrow':if(AD.act.open[arg])delete AD.act.open[arg];else AD.act.open[arg]=1;break;
    case 'actmore':actFetch();return;
    case 'actreload':actReset();return;
    case 'actclear':AD.act.f=actDefF();actReset();return;
    case 'actsheet':AD.act.sheet=!AD.act.sheet;if(AD.act.sheet)AD._focusAct=1;break;
    case 'actsheetx':actCloseSheet();return;
    case 'actuserx':AD.act.f.user='';AD.act.f.actor='';actReset();return;
    case 'actuser':if(admChanges().length){aToast('Save or discard your changes first.',true);return;}
      AD.drawer=null;AD.dlg=null;AD.act.f=actDefF();AD.act.f.user=arg;AD.act.sheet=false;
      if(location.hash!=='#admin/activity')location.hash='admin/activity';
      actReset();return;
    case 'seasonact':admConfirm({title:'Make '+arg+' the active season?',text:'This switches the active season for every Vision user.',list:['New inspections are saved to this season.','Vision users see it after their next reload.'],ok:'Set as active',danger:true,
      run:function(){return admSetSeason(arg);}});return;
    default:return;
  }
  admRender();
}
function admChange(e){
  var t=e.target,k=t.getAttribute('data-ch');if(!k)return;var v=t.value,S=AD.st;
  if(k==='urole'){AD.f.role=v;AD.f.page=0;}
  else if(k==='uapp'){AD.f.app=v;AD.f.page=0;}
  else if(k==='ustatus'){AD.f.status=v;AD.f.page=0;}
  else if(k==='actapp')AD.act.f.app=v;
  else if(k==='actactor'){AD.act.f.actor=v;AD.act.f.user='';actReset();return;}
  else if(k==='actaction'||k==='actrange'||k==='actfrom'||k==='actto'){AD.act.f[{actaction:'action',actactor:'actor',actrange:'range',actfrom:'from',actto:'to'}[k]]=v;actReset();return;}
  else if(k==='drRole'){AD.drawer.d.role=v;/* region/packhouse rows untouched on role change — same as Vision */}
  else if(k==='add-role')AD.drawer.v.role=v;
  else if(k==='add-ph')AD.drawer.v.ph=v;
  else if(k==='stjump'){S.sub=v;S.q='';}
  else if(k==='selProd'){S.nv.selProd=v;S.nv.selCat='';}
  else if(k==='selCat')S.nv.selCat=v;
  else if(k==='subParent')S.nv.subParent=v;
  else if(k==='fe')feInput(t.getAttribute('data-arg'),v);
  else if(k==='feprod'){AD.fe[t.getAttribute('data-arg')].prod=v;AD.rowMenu=null;}
  else if(k==='varcat'){var vid=t.getAttribute('data-arg'),vv=aVarById(vid);/* staged; saved from the Save bar */
    if(vv&&(vv.categoryId||'')===v)delete S.pendVar[vid];else S.pendVar[vid]=v;}
  admRender();
}
function admInput(e){
  var t=e.target,k=t.getAttribute('data-in');if(!k)return;var v=t.value,S=AD.st;
  if(k==='uq'){AD.f.q=v;AD.f.page=0;}
  else if(k==='aaq')AD.aaQ=v;
  else if(k==='actq'){AD.act.f.q=v;clearTimeout(AD.act._qt);AD.act._qt=setTimeout(actReset,350);}
  else if(k==='stq')S.q=v;
  else if(k==='rpw'){AD.dlg.pw=v;}
  else if(k==='fe')feInput(t.getAttribute('data-arg'),v);
  else if(k==='fenv'){var na=t.getAttribute('data-arg').split('|');AD.fe[na[0]].nv[na[1]]=v;}
  else if(k==='grnv')AD.gr.nv[t.getAttribute('data-arg')]=v;
  else if(k==='add-name')AD.drawer.v.name=v;
  else if(k==='add-email')AD.drawer.v.email=v;
  else if(k==='add-pw')AD.drawer.v.pw=v;
  else if(k.indexOf('nv:')===0){var key=k.slice(3);S.nv[key]=key==='prodpfx'?v.toUpperCase().slice(0,3):v;}
  else if(k==='pfx'){var id=t.getAttribute('data-arg'),ph=AD.cfg.packhouses.filter(function(x){return x.id===id;})[0];if(!ph)return;var p=S.pend[id]||{};
    if(v===ph.palletPrefix)delete p.prefix;else p.prefix=v;if(p.crops||p.prefix!=null)S.pend[id]=p;else delete S.pend[id];}
  admRender();
}
function admKey(e){
  if(e.key==='Escape'){
    if(AD.dlg){e.preventDefault();admCloseDlg();return;}
    if(AD.act.sheet&&AD.sec==='activity'){e.preventDefault();actCloseSheet();return;}
    if(AD.rowMenu){var id=AD.rowMenu;AD.rowMenu=null;admRender();var b=document.querySelector('[data-fid="keb-'+id+'"]');if(b)b.focus();return;}
    if(AD.drawer){e.preventDefault();admCloseDrawer(false);return;}
  }
  if(e.key==='Enter'&&e.target.getAttribute('data-enter')){e.preventDefault();var ea=e.target.getAttribute('data-enter-arg'),b2=document.querySelector('#admMain [data-act="'+e.target.getAttribute('data-enter')+'"]'+(ea!=null?'[data-arg="'+(window.CSS&&CSS.escape?CSS.escape(ea):ea)+'"]':''));if(b2&&!b2.disabled)b2.click();return;}
  if(e.key==='Enter'&&e.target.classList.contains('ucard')){admOpenEdit(e.target.getAttribute('data-arg'));return;}
  var rm=e.target.closest('.rmenu');
  if(rm&&(e.key==='ArrowDown'||e.key==='ArrowUp'||e.key==='Home'||e.key==='End')){e.preventDefault();var it=[].slice.call(rm.querySelectorAll('button:not(:disabled)')),i=it.indexOf(e.target);
    i=e.key==='Home'?0:e.key==='End'?it.length-1:(i+(e.key==='ArrowDown'?1:-1)+it.length)%it.length;it[i].focus();return;}
  if(rm&&e.key==='Tab'){AD.rowMenu=null;setTimeout(admRender,0);return;}
  /* keep Tab inside an open dialog/drawer */
  if(e.key==='Tab'&&(AD.dlg||AD.drawer)){
    var box=document.querySelector('#admLayer '+(AD.dlg?'.dlg':'.drawer'));if(!box)return;
    var fs=[].slice.call(box.querySelectorAll('button:not(:disabled),input,select,a[href],[tabindex="0"]'));if(!fs.length)return;
    if(!box.contains(document.activeElement)){e.preventDefault();fs[0].focus();return;}
    if(e.shiftKey&&document.activeElement===fs[0]){e.preventDefault();fs[fs.length-1].focus();}
    else if(!e.shiftKey&&document.activeElement===fs[fs.length-1]){e.preventDefault();fs[0].focus();}
  }
}

/* Chooser tile counts (admins only) — same reads as above. */
function admTileInfo(cb){
  Promise.all([
    sb.from('users').select('id',{count:'exact',head:true}).eq('active',true),
    sb.rpc('list_analytics_access_admin')
  ]).then(function(rs){cb({users:rs[0]&&!rs[0].error?rs[0].count:null,requests:rs[1]&&!rs[1].error&&rs[1].data?(rs[1].data.requests||[]).length:null});}).catch(function(){cb({});});
}
