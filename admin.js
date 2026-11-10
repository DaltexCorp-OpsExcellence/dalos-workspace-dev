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
  {k:'season',label:'Season & forms',items:[['seasons','Seasons'],['inspection','Inspection form'],['clientqc','Client QC form'],['schemadoc','Schema doc'],['specifics','Specifics']]}
];
var ADM_LIST_TABLE={clients:'clients',countries:'countries',farms:'farms',classes:'classes',cartonTypes:'carton_types'};
var ADM_IN_VISION={inspection:'Inspection form',clientqc:'Client QC form',schemadoc:'Schema doc',specifics:'Specifics'};

var AD={
  me:null,built:false,sec:'users',
  users:null,usersErr:'',regions:[],regMem:{},regMgr:{},
  aa:null,aaErr:'',aaAcc:{},aaReq:{},aaBusy:'',
  cfg:null,cfgErr:'',
  f:{q:'',role:'',app:'',status:'active',test:false,page:0},
  rowMenu:null,drawer:null,dlg:null,
  mxApp:'all',aaQ:'',
  st:{sub:'packhouses',q:'',test:false,pend:{},nv:{},busy:false}
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
      return {id:u.id,name:u.full_name||'',email:u.email||'',role:u.role,packhouses:phs,active:u.active,lastLogin:u.last_login||'Never'};
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
  document.addEventListener('mousedown',function(e){if(AD.rowMenu&&!e.target.closest('.kw')){AD.rowMenu=null;admRender();}},true);
  var av=document.getElementById('admAv');
  try{wsBindAvatar(av);}catch(e){}
  AD.built=true;
}
function admSecFromHash(){var m=/^#admin(?:\/([a-z]+))?/.exec(location.hash||'');var s=m&&m[1];return {users:1,perms:1,access:1,settings:1}[s]?s:'users';}
/* Called by index.html wsRoute() whenever #admin is shown for an admin. */
function adminShow(user){
  AD.me=user;
  if(!AD.built)admBuild();
  var av=document.getElementById('admAv');if(av){av.textContent=aIni(user.name);av.setAttribute('aria-label','Account menu for '+(user.name||'you'));}
  var prev=AD.sec;AD.sec=admSecFromHash();
  if(AD.users===null&&!AD._usersStarted){AD._usersStarted=1;admLoadUsers();admLoadRegions();admLoadAA();admLoadCfg();}
  AD.rowMenu=null;
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
    '<span class="dis" aria-disabled="true"><span aria-hidden="true">🕘</span> Activity log <span class="later">coming later</span></span>'+
    '<h2>App settings</h2>'+
    L('settings','❦','Vision','<span class="n">15</span>'));
  var h='';
  if(AD.sec==='users')h=admUsersHTML();
  else if(AD.sec==='perms')h=admPermsHTML();
  else if(AD.sec==='access')h=admAccessHTML();
  else h=admSettingsHTML();
  aPaint(document.getElementById('admMain'),h);
  aPaint(document.getElementById('admLayer'),admLayerHTML());
  var mx=document.querySelector('#admMain .mx');
  if(mx){var sc=mx.querySelector('.mxs');var upd=function(){mx.classList.toggle('atend',sc.scrollLeft+sc.clientWidth>=sc.scrollWidth-4);};sc.addEventListener('scroll',upd,{passive:true});upd();}
  var rm=document.querySelector('#admMain .rmenu');if(rm&&AD._focusMenu){AD._focusMenu=0;var b=rm.querySelector('button');if(b)b.focus();}
  if(AD._focusLayer){AD._focusLayer=0;var lf=document.querySelector('#admLayer [data-autofocus]');if(lf)lf.focus();}
}

/* ── Users ─────────────────────────────────────────────────────────────── */
function admUsersHTML(){
  var f=AD.f,h='<div class="crumb">Workspace / Admin</div>'+
    '<div class="ptrow"><div><h1 class="pt">Users</h1><p class="sub">Who can sign in to DalOS, their role, and which apps and sites they can see.</p></div><div class="hsp"></div><button type="button" class="adm-btn pri" data-act="adduser">+ Add user</button></div>';
  if(AD.users===null&&AD.usersErr)return h+aError("Couldn't load users",'retry-users');
  if(AD.users===null)return h+aLoading(5,'Loading users…');
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
      '<div class="ln">'+aRolePill(u.role)+'<span class="st'+(u.active?'':' off')+'">'+(u.active?'Active':'Inactive')+'</span><span style="color:var(--mu);font-size:14px">· '+aEsc(aDate(u.lastLogin))+'</span></div><div class="acc">'+aAccessWords(u)+'</div></div>'+admKebab(u,'m')+'</div>';
  });
  h+=admPager(list.length,pages,hiddenTest)+'</div>';
  return h;
}
function admPager(n,pages,hid){var f=AD.f,from=f.page*ADM_PAGE+1,to=Math.min(n,(f.page+1)*ADM_PAGE);
  return '<div class="tfoot"><span>Showing '+from+'–'+to+' of '+n+(hid?' · '+hid+' test account'+(hid===1?'':'s')+' hidden':'')+'</span>'+(pages>1?'<span style="display:flex;gap:8px;align-items:center"><button type="button" class="adm-btn" data-act="pg" data-arg="-1"'+(f.page===0?' disabled':'')+'>← Prev</button>Page '+(f.page+1)+' of '+pages+'<button type="button" class="adm-btn" data-act="pg" data-arg="1"'+(f.page>=pages-1?' disabled':'')+'>Next →</button></span>':'')+'</div>';}
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
  if(!aSame(o.phs,d.phs))c.push('Vision packhouses');
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
  var D=AD.drawer,uid=D.uid,o=D.orig,d=D.d,errs=[];
  D.busy=true;D.err='';admRender();
  var p=Promise.resolve();
  if(o.role!==d.role)p=p.then(function(){return sb.from('users').update({role:d.role}).eq('id',uid).then(function(r){if(r.error)errs.push('Role: '+r.error.message);});});
  if(!aSame(o.phs,d.phs))p=p.then(function(){
    var newPhs=d.phs,isAll=!!ADM_ALL_PH[d.role];
    return sb.from('user_packhouse_access').delete().eq('user_id',uid).then(function(dr){
      if(dr.error){errs.push('Packhouses: '+dr.error.message);return;}
      if(newPhs[0]==='All'&&!isAll){
        return sb.from('packhouses').select('id').eq('active',true).then(function(pr){
          if(pr.error||!pr.data){errs.push('Packhouses: '+(pr.error?pr.error.message:'no packhouses'));return;}
          return sb.from('user_packhouse_access').insert(pr.data.map(function(x){return {user_id:uid,packhouse_id:x.id};})).then(function(r){if(r.error)errs.push('Packhouses: '+r.error.message);});
        });
      }else if(newPhs[0]!=='All'){
        return sb.from('user_packhouse_access').insert(newPhs.map(function(x){return {user_id:uid,packhouse_id:x};})).then(function(r){if(r.error)errs.push('Packhouses: '+r.error.message);});
      }
    });
  });
  var toAdd=d.regs.filter(function(x){return o.regs.indexOf(x)<0;}),toDel=o.regs.filter(function(x){return d.regs.indexOf(x)<0;});
  if(toAdd.length)p=p.then(function(){return sb.from('region_members').upsert(toAdd.map(function(rid){return {user_id:uid,region_id:rid,is_manager:false};}),{onConflict:'user_id,region_id'}).then(function(r){if(r.error)errs.push('Regions: '+r.error.message);});});
  if(toDel.length)p=p.then(function(){return Promise.all(toDel.map(function(rid){return sb.from('region_members').delete().eq('user_id',uid).eq('region_id',rid).then(function(r){if(r&&r.error)errs.push('Regions: '+r.error.message);});}));});
  var mgrUpd=d.regs.filter(function(rid){var want=d.mgrs.indexOf(rid)>=0,had=o.regs.indexOf(rid)>=0&&o.mgrs.indexOf(rid)>=0;return want!==had;});
  if(mgrUpd.length)p=p.then(function(){return Promise.all(mgrUpd.map(function(rid){return sb.from('region_members').update({is_manager:d.mgrs.indexOf(rid)>=0}).eq('user_id',uid).eq('region_id',rid).then(function(r){if(r&&r.error)errs.push('Manager: '+r.error.message);});}));});
  p.catch(function(e){errs.push((e&&e.message)||'Network error');}).then(function(){
    return Promise.all([admLoadUsers(),admLoadRegions()]);
  }).then(function(){
    if(!AD.drawer)return;
    if(errs.length){AD.drawer.busy=false;AD.drawer.err='Some changes were not saved: '+errs.join(' · ');
      var u=aUser(uid);if(u){AD.drawer.orig={role:u.role,phs:u.packhouses.slice(),regs:(AD.regMem[uid]||[]).slice(),mgrs:(AD.regMgr[uid]||[]).slice()};}
      admRender();}
    else{admCloseDrawer(true);aToast('Saved');}
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
    AD.drawer=null;admLoadUsers();
    if(snap.method==='direct')admEmailDlg('invite',snap);else aToast('Invite sent to '+snap.email);
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
function aStPendCount(){var n=0;Object.keys(AD.st.pend).forEach(function(id){var p=AD.st.pend[id];if(p.crops)n++;if(p.prefix!=null)n++;});return n;}
function admSettingsHTML(){
  var S=AD.st,sub=S.sub,grp=aGroupOf(sub),label=(grp.items.filter(function(x){return x[0]===sub;})[0]||[])[1];
  var h='<div class="crumb">Workspace / Admin / App settings</div><h1 class="pt">Vision settings</h1><p class="sub">Vision master data: sites, catalogue, clients, seasons and forms. Changes apply to Vision straight away.</p>';
  var jump='<label class="fl"><span>Jump to section</span><select data-fid="stjump" data-ch="stjump">'+ADM_ST_GROUPS.map(function(g){return '<optgroup label="'+aEsc(g.label)+'">'+g.items.map(function(it){return '<option value="'+it[0]+'"'+(it[0]===sub?' selected':'')+'>'+aEsc(g.label+' › '+it[1])+'</option>';}).join('')+'</optgroup>';}).join('')+'</select></label>';
  h+='<div class="desk-only" style="margin-bottom:16px"><div class="tabs" role="tablist" aria-label="Vision settings group">'+ADM_ST_GROUPS.map(function(g){return '<button type="button" role="tab" aria-selected="'+(g===grp)+'" data-act="stgrp" data-arg="'+g.k+'" data-fid="stg-'+g.k+'">'+aEsc(g.label)+' · '+g.items.length+'</button>';}).join('')+'</div>'+
    '<div class="subtabs" role="tablist" aria-label="'+aEsc(grp.label)+'">'+grp.items.map(function(it){var n=aSubCount(it[0]);return '<button type="button" role="tab" aria-selected="'+(it[0]===sub)+'" data-act="stsub" data-arg="'+it[0]+'" data-fid="sts-'+it[0]+'">'+aEsc(it[1])+(n!==''?' <span>'+n+'</span>':'')+'</button>';}).join('')+'<span class="jump">'+jump+'</span></div></div>';
  h+='<div class="mobile-only" style="margin-bottom:14px">'+jump.replace('data-fid="stjump"','data-fid="stjump-m"')+'</div>';
  if(ADM_IN_VISION[sub])return h+admStInVision(sub);
  if(!AD.cfg&&AD.cfgErr)return h+aError("Couldn't load Vision settings",'retry-cfg');
  if(!AD.cfg)return h+aLoading(4,'Loading Vision settings…');
  if(AD.cfgErr)h+='<div class="ferr" role="alert">Couldn’t refresh: '+aEsc(AD.cfgErr)+'</div>';
  h+='<div class="toolbar"><label class="fl search"><span>Search '+aEsc(label.toLowerCase())+'</span><input class="inp" type="search" data-fid="stq" data-in="stq" value="'+aEsc(S.q)+'" autocomplete="off"></label>'+aSwitch('sttest',S.test,'Show test data')+'</div>';
  var body=admStBody(sub);
  h+=body;
  var pc=aStPendCount();
  if(pc){var desc=[];Object.keys(S.pend).forEach(function(id){var p=S.pend[id],ph=AD.cfg.packhouses.filter(function(x){return x.id===id;})[0];if(!ph)return;var bits=[];
      if(p.crops){var on=p.crops.filter(function(c){return ph.crops.indexOf(c)<0;}),off=ph.crops.filter(function(c){return p.crops.indexOf(c)<0;});on.forEach(function(c){bits.push(aProdName(c)+' on');});off.forEach(function(c){bits.push(aProdName(c)+' off');});}
      if(p.prefix!=null)bits.push('prefix “'+p.prefix+'”');desc.push(ph.name+': '+bits.join(', '));});
    h+='<div class="savebar" role="region" aria-label="Unsaved changes"><span class="msg" role="status"><b>'+pc+' unsaved change'+(pc===1?'':'s')+'</b> · '+aEsc(desc.join(' · '))+'</span><button type="button" class="adm-btn" data-act="stdiscard"'+(S.busy?' disabled':'')+'>Discard</button><button type="button" class="adm-btn pri" data-act="stsave"'+(S.busy?' disabled':'')+'>'+(S.busy?'Saving…':'Save')+'</button></div>';}
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
      '<div class="fld"><span class="lbl">Products handled</span><div class="chips">'+c.products.filter(function(p){return p.active!==false;}).map(function(p){var on=np.indexOf(p.id)>=0;return '<button type="button" class="pc" aria-pressed="'+on+'" data-act="phnewprod" data-arg="'+aEsc(p.id)+'">'+aEsc(p.name)+'</button>';}).join('')+'</div>'+(np.length?'':'<p class="hint" style="color:var(--go)">Select at least one product.</p>')+'</div>'+
      '<button type="button" class="adm-btn pri" data-act="phadd"'+(aNv('ph').trim()&&np.length?'':' disabled')+'>+ Add packhouse</button></div></details>';
    var phs=aStFilter(c.packhouses);
    if(!phs.length)h+=aEmpty('No packhouses match','');
    phs.forEach(function(ph){
      var pend=S.pend[ph.id]||{},crops=pend.crops||ph.crops,pfx=pend.prefix!=null?pend.prefix:ph.palletPrefix;
      h+='<div class="card ph"><div class="phh"><span class="sq" style="background:'+aEsc(ph.color)+'" aria-hidden="true">'+aEsc(ph.initials)+'</span><div><b>'+aEsc(ph.name)+'</b><small class="small">code '+aEsc(ph.id)+'</small></div><div class="hsp"></div><span class="st">Active</span>'+
        '<button type="button" class="adm-btn red" data-act="phdeact" data-arg="'+aEsc(ph.id)+'">Deactivate…</button></div>'+
        '<div class="row"><div><label class="lab" for="pfx-'+aEsc(ph.id)+'" style="display:block">Pallet prefix (grapes)</label><input id="pfx-'+aEsc(ph.id)+'" class="inp pfx'+(pend.prefix!=null?' chg':'')+'" data-fid="pfx-'+aEsc(ph.id)+'" data-in="pfx" data-arg="'+aEsc(ph.id)+'" value="'+aEsc(pfx)+'" placeholder="e.g. NK-"></div>'+
        '<div style="flex:1;min-width:240px"><div class="lab">Products handled · tap to turn on or off</div><div class="chips" role="group" aria-label="Products at '+aEsc(ph.name)+'">'+
        c.products.filter(function(p){return p.active!==false;}).map(function(p){var on=crops.indexOf(p.id)>=0,was=ph.crops.indexOf(p.id)>=0;return '<button type="button" class="pc'+(on!==was?' chg':'')+'" aria-pressed="'+on+'" data-act="phprod" data-arg="'+aEsc(ph.id)+'|'+aEsc(p.id)+'" data-fid="pp-'+aEsc(ph.id)+'-'+aEsc(p.id)+'">'+aEsc(p.name)+'</button>';}).join('')+
        '</div></div></div></div>';
    });
    h+=aHidHint(phs.hidden)+'<p class="hint">Inactive packhouses are not listed here (same as Vision Admin). Reactivate them in Vision for now.</p>';
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
  var prodOpts=c.products.map(function(p){return [p.id,p.name];}),selP=S.nv.selProd||(c.products[0]&&c.products[0].id)||'';
  if(sub==='categories'){
    h+='<div class="card addrow">'+aSel('selProd','Product',prodOpts,selP)+'<label class="fl"><span>Category name</span><input class="inp" data-fid="nv-cat" data-in="nv:cat" value="'+aEsc(aNv('cat'))+'" placeholder="e.g. Orange, Lemon" data-enter="catadd"></label><button type="button" class="adm-btn pri" data-act="catadd"'+(aNv('cat').trim()&&selP?'':' disabled')+'>+ Add</button></div>';
    var hid=0;
    c.products.forEach(function(p){var cats=aStFilter(c.categories[p.id]||[]);hid+=cats.hidden;
      h+='<div class="card ph"><div class="grph">'+aEsc(p.name)+' · '+cats.length+'</div>'+(cats.length?'<div class="chips">'+cats.map(function(ct){return tag(ct.name,'catrm',ct.id);}).join('')+'</div>':'<p class="hint">No categories yet.</p>')+'</div>';});
    return h+aHidHint(hid);
  }
  if(sub==='varieties'){
    var cOpts=[['','— None —']].concat((c.categories[selP]||[]).map(function(x){return [x.id,x.name];}));
    h+='<div class="card addrow">'+aSel('selProd','Product',prodOpts,selP)+aSel('selCat','Category (optional)',cOpts,S.nv.selCat||'')+'<label class="fl"><span>Variety name</span><input class="inp" data-fid="nv-var" data-in="nv:var" value="'+aEsc(aNv('var'))+'" placeholder="e.g. Navel" data-enter="varadd"></label><button type="button" class="adm-btn pri" data-act="varadd"'+(aNv('var').trim()&&selP?'':' disabled')+'>+ Add</button></div>';
    var hidV=0;
    c.products.forEach(function(p){
      var vs=aStFilter(c.varietiesFull[p.id]||[]),cats=c.categories[p.id]||[];hidV+=vs.hidden;
      h+='<div class="card ph"><div class="grph">'+aEsc(p.name)+' · '+vs.length+'</div>';
      if(!vs.length){h+='<p class="hint">No varieties.</p></div>';return;}
      h+='<div class="chips">'+vs.map(function(v){
        var sel=cats.length?'<label class="sr" for="vc-'+aEsc(v.id)+'">Category for '+aEsc(v.name)+'</label><select id="vc-'+aEsc(v.id)+'" data-fid="vc-'+aEsc(v.id)+'" data-ch="varcat" data-arg="'+aEsc(v.id)+'"><option value="">— no category —</option>'+cats.map(function(ct){return '<option value="'+aEsc(ct.id)+'"'+(ct.id===v.categoryId?' selected':'')+'>'+aEsc(ct.name)+'</option>';}).join('')+'</select>':'';
        return tag(v.name,'varrm',v.id,sel);}).join('')+'</div></div>';
    });
    return h+aHidHint(hidV);
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
function aStDone(r,msg){if(r&&r.error){aToast('Save failed: '+r.error.message,true);return false;}aToast(msg||'Saved');admLoadCfg();return true;}
function admListAdd(field){
  var val=aNv(field).trim(),table=ADM_LIST_TABLE[field];if(!val||!table)return;
  AD.st.nv[field]='';admRender();
  sb.from(table).select('id,active').eq('name',val).limit(1).then(function(ex){
    if(ex.data&&ex.data.length>0)return sb.from(table).update({active:true}).eq('id',ex.data[0].id).then(function(r){aStDone(r,'Reactivated “'+val+'”');});
    return sb.from(table).insert([{name:val,active:true}]).then(function(r){aStDone(r,'Added “'+val+'”');});
  });
}
function admStSave(){
  var S=AD.st,jobs=[];S.busy=true;admRender();
  Object.keys(S.pend).forEach(function(id){var p=S.pend[id];
    if(p.prefix!=null)jobs.push(sb.from('packhouses').update({pallet_prefix:p.prefix||null}).eq('id',id).then(function(r){return r.error?id+': '+r.error.message:null;}));
    if(p.crops)jobs.push(sb.from('packhouses').update({product_ids:p.crops}).eq('id',id).then(function(r){return r.error?id+': '+r.error.message:null;}));
  });
  Promise.all(jobs).then(function(res){var errs=res.filter(Boolean);S.busy=false;
    if(errs.length)aToast('Some changes failed: '+errs.join(' · '),true);else{S.pend={};aToast('Saved');}
    admLoadCfg();}).catch(function(){S.busy=false;aToast('Network error — not saved.',true);admRender();});
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
        run:function(){return Promise.resolve(sb.from('users').update({active:false}).eq('id',arg)).then(function(r){if(r.error)throw r.error;return admLoadUsers();}).then(function(){aToast(u.name+' deactivated');});}});return;
    case 'react':AD.rowMenu=null;Promise.resolve(sb.from('users').update({active:true}).eq('id',arg)).then(function(r){if(r.error)aToast('Could not reactivate: '+r.error.message,true);else aToast('Reactivated');admLoadUsers();});break;
    case 'resetpw':AD.rowMenu=null;AD.dlg={kind:'resetpw',uid:arg,pw:'',ret:document.activeElement};AD._focusLayer=1;break;
    case 'rpwgo':var ru=aUser(AD.dlg.uid)||{};admEmailDlg('reset',{name:ru.name,email:ru.email,pw:AD.dlg.pw});return;
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
      sb.from('packhouses').insert([{id:id,name:name,color:col,initials:ini,active:true,product_ids:prods}]).then(function(r){aStDone(r,'Packhouse added');});})();break;
    case 'phprod':(function(){var bits=arg.split('|'),id=bits[0],pid=bits[1],ph=c.packhouses.filter(function(x){return x.id===id;})[0];if(!ph)return;
      var p=S.pend[id]||{},cr=(p.crops||ph.crops).slice(),i=cr.indexOf(pid);if(i>=0)cr.splice(i,1);else cr.push(pid);
      if(aSame(cr,ph.crops))delete p.crops;else p.crops=cr;if(p.crops||p.prefix!=null)S.pend[id]=p;else delete S.pend[id];})();break;
    case 'stdiscard':S.pend={};break;
    case 'stsave':admStSave();return;
    case 'phdeact':var dph=c.packhouses.filter(function(x){return x.id===arg;})[0];if(!dph)return;
      admConfirm({title:'Deactivate '+dph.name+'?',text:'It will disappear from Vision forms and from this list.',list:['Existing inspections keep it.','You can reactivate it from Vision Admin.'],ok:'Deactivate',danger:true,
        run:function(){return Promise.resolve(sb.from('packhouses').update({active:false}).eq('id',arg)).then(function(r){if(r.error)throw r.error;delete S.pend[arg];aToast(dph.name+' deactivated');return admLoadCfg();});}});return;
    case 'listadd':admListAdd(S.sub);return;
    case 'listrm':var table=ADM_LIST_TABLE[S.sub];
      admConfirm({title:'Remove “'+arg+'”?',text:'It will no longer be offered in Vision forms. Existing records keep it.',ok:'Remove',danger:true,
        run:function(){return Promise.resolve(sb.from(table).update({active:false}).eq('name',arg)).then(function(r){if(r.error)throw r.error;aStDone(r,'Removed');});}});return;
    case 'prodadd':(function(){var nm=aNv('prod').trim(),pfx=aNv('prodpfx').trim().toUpperCase();if(!nm)return;
      if(pfx.length<2||pfx.length>3){aToast('Prefix must be 2–3 letters',true);return;}
      if(c.products.some(function(p){return String(p.prefix).toUpperCase()===pfx;})){aToast('Prefix “'+pfx+'” is already in use',true);return;}
      S.nv.prod='';S.nv.prodpfx='';
      sb.from('products').insert([{name:nm,inspection_prefix:pfx,color:'#2b5c3f',active:true}]).then(function(r){aStDone(r,'Product added');});})();break;
    case 'catadd':(function(){var nm=aNv('cat').trim(),pid=S.nv.selProd||(c.products[0]&&c.products[0].id);if(!nm||!pid)return;S.nv.cat='';
      sb.from('categories').insert([{product_id:pid,name:nm,active:true}]).select().then(function(r){aStDone(r,'Category added');});})();break;
    case 'catrm':admConfirm({title:'Remove this category?',text:'Varieties in it become uncategorised.',ok:'Remove',danger:true,
      run:function(){return Promise.resolve(sb.from('categories').update({active:false}).eq('id',arg)).then(function(r){if(r.error)throw r.error;aStDone(r,'Removed');});}});return;
    case 'varadd':(function(){var nm=aNv('var').trim(),pid=S.nv.selProd||(c.products[0]&&c.products[0].id),cat=S.nv.selCat||null;if(!nm||!pid)return;S.nv.var='';
      sb.auth.getUser().then(function(ur){var row={name:nm,product_id:pid,active:true};if(cat)row.category_id=cat;if(ur.data&&ur.data.user)row.created_by=ur.data.user.id;return sb.from('varieties').insert([row]);}).then(function(r){aStDone(r,'Variety added');});})();break;
    case 'varrm':admConfirm({title:'Remove this variety?',text:'It will no longer be offered in Vision forms. Existing inspections keep it.',ok:'Remove',danger:true,
      run:function(){return Promise.resolve(sb.from('varieties').update({active:false}).eq('id',arg)).then(function(r){if(r.error)throw r.error;aStDone(r,'Removed');});}});return;
    case 'subadd':(function(){var nm=aNv('sub').trim(),cid=c.clientsIdMap[S.nv.subParent];if(!nm)return;if(!cid){aToast('Select a client first',true);return;}S.nv.sub='';
      sb.from('sub_clients').insert([{name:nm,client_id:cid,active:true}]).select().single().then(function(r){aStDone(r,'Sub-client added');});})();break;
    case 'subrm':admConfirm({title:'Remove this sub-client?',text:'It will no longer be offered in Vision forms.',ok:'Remove',danger:true,
      run:function(){return Promise.resolve(sb.from('sub_clients').update({active:false}).eq('id',arg)).then(function(r){if(r.error)throw r.error;aStDone(r,'Removed');});}});return;
    case 'seasonadd':(function(){var nm=aNv('season').trim();if(!nm)return;S.nv.season='';
      sb.from('seasons').insert([{name:nm,active:false}]).then(function(r){aStDone(r,'Season added');});})();break;
    case 'seasonact':admConfirm({title:'Make '+arg+' the active season?',text:'This switches the active season for every Vision user.',list:['New inspections are saved to this season.','Vision users see it after their next reload.'],ok:'Set as active',danger:true,
      run:function(){return Promise.resolve(sb.from('seasons').update({active:false}).neq('name',arg)).then(function(){return sb.from('seasons').update({active:true}).eq('name',arg);}).then(function(r){if(r.error)throw r.error;aStDone(r,arg+' is now the active season');});}});return;
    default:return;
  }
  admRender();
}
function admChange(e){
  var t=e.target,k=t.getAttribute('data-ch');if(!k)return;var v=t.value,S=AD.st;
  if(k==='urole'){AD.f.role=v;AD.f.page=0;}
  else if(k==='uapp'){AD.f.app=v;AD.f.page=0;}
  else if(k==='ustatus'){AD.f.status=v;AD.f.page=0;}
  else if(k==='drRole'){AD.drawer.d.role=v;/* region/packhouse rows untouched on role change — same as Vision */}
  else if(k==='add-role')AD.drawer.v.role=v;
  else if(k==='add-ph')AD.drawer.v.ph=v;
  else if(k==='stjump'){S.sub=v;S.q='';}
  else if(k==='selProd'){S.nv.selProd=v;S.nv.selCat='';}
  else if(k==='selCat')S.nv.selCat=v;
  else if(k==='subParent')S.nv.subParent=v;
  else if(k==='varcat'){var vid=t.getAttribute('data-arg');sb.from('varieties').update({category_id:v||null}).eq('id',vid).then(function(r){aStDone(r,'Category updated');});return;}
  admRender();
}
function admInput(e){
  var t=e.target,k=t.getAttribute('data-in');if(!k)return;var v=t.value,S=AD.st;
  if(k==='uq'){AD.f.q=v;AD.f.page=0;}
  else if(k==='aaq')AD.aaQ=v;
  else if(k==='stq')S.q=v;
  else if(k==='rpw'){AD.dlg.pw=v;}
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
    if(AD.rowMenu){var id=AD.rowMenu;AD.rowMenu=null;admRender();var b=document.querySelector('[data-fid="keb-'+id+'"]');if(b)b.focus();return;}
    if(AD.drawer){e.preventDefault();admCloseDrawer(false);return;}
  }
  if(e.key==='Enter'&&e.target.getAttribute('data-enter')){e.preventDefault();var b2=document.querySelector('#admMain [data-act="'+e.target.getAttribute('data-enter')+'"]');if(b2&&!b2.disabled)b2.click();return;}
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
