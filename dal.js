/* Dal — the DalOS assistant (Workspace). Loaded before the main script; uses its globals
   (sb, $, openProduct, requestAnalyticsAccess, COMMERCIAL_ROLES, FARM_ROLES) only at call time. */
/* ── Dal — DalOS assistant, phase 1 (scripted help + role nudges, no AI) ──
   Every count below is a head-only query made with the signed-in user's own session,
   so row-level security decides what Dal can see — it never shows more than the apps do.
   Kill switch: DAL_ENABLED. Hidden for roles in DAL_OFF_ROLES. */
var DAL_ENABLED=true;
var DAL_OFF_ROLES={client_qc:1};
var dalState={u:null,role:'',el:null,nudge:null,booted:false};
function dalSvg(expr){
  var d='#2e6446',m='#74c795',lid='#6cbb8c',ink='#10160f',ch='#f39a8b';
  var FR=[[70,50,15],[92,50,15],[57,74,16],[80,72,16.5],[103,74,16],[68,98,15],[92,98,15],[80,120,13]],BK=[[60,40,12],[102,40,12],[46,92,12],[114,92,12],[80,108,13]];
  var b='<g>';BK.forEach(function(c){b+='<circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+c[2]+'" fill="#1f4a33"/>';});
  FR.forEach(function(c){var hx=c[0]-c[2]*.38,hy=c[1]-c[2]*.42;b+='<circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+c[2]+'" fill="url(#dalg)"/><circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+(c[2]-.6)+'" fill="none" stroke="'+d+'" stroke-width="1.1" opacity=".35"/><ellipse cx="'+hx+'" cy="'+hy+'" rx="'+(c[2]*.26)+'" ry="'+(c[2]*.16)+'" transform="rotate(-30 '+hx+' '+hy+')" fill="#fff" opacity=".55"/>';});b+='</g>';
  function eyes(dx,dy,r,pr){r=r||9.5;pr=pr||4.2;dx=dx||0;dy=dy||0;return [[70,70],[92,70]].map(function(c){return '<circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+r+'" fill="#fff"/><g class="dal-pupil" data-cx="'+c[0]+'" data-cy="'+c[1]+'"><circle cx="'+(c[0]+dx)+'" cy="'+(c[1]+dy)+'" r="'+pr+'" fill="'+ink+'"/><circle cx="'+(c[0]+dx+1.6)+'" cy="'+(c[1]+dy-1.7)+'" r="1.4" fill="#fff"/></g><rect class="dal-lid" x="'+(c[0]-r-1)+'" y="'+(c[1]-r-1)+'" width="'+(2*r+2)+'" height="'+(2*r+2)+'" rx="'+(r+1)+'" fill="'+lid+'"/>';}).join('');}
  function brows(a,c){return '<path d="'+a+'" stroke="'+ink+'" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="'+c+'" stroke="'+ink+'" stroke-width="2.6" fill="none" stroke-linecap="round"/>';}
  function arm(p){
    if(p==='point')return '<g class="dal-arm-point"><path d="M48 84 C34 82 24 72 18 60" stroke="'+d+'" stroke-width="4.2" fill="none" stroke-linecap="round"/><circle cx="16" cy="58" r="4.6" fill="'+m+'" stroke="'+d+'" stroke-width="1.4"/></g>';
    if(p==='wave')return '<g class="dal-arm-wave"><path d="M48 82 C38 78 32 66 34 54" stroke="'+d+'" stroke-width="4.2" fill="none" stroke-linecap="round"/><circle cx="34" cy="51" r="4.6" fill="'+m+'" stroke="'+d+'" stroke-width="1.4"/></g>';
    if(p==='up')return '<g class="dal-arm-wave"><path d="M48 80 C36 72 32 58 36 46" stroke="'+d+'" stroke-width="4.2" fill="none" stroke-linecap="round"/><circle cx="37" cy="43" r="4.6" fill="'+m+'" stroke="'+d+'" stroke-width="1.4"/></g>';
    if(p==='chin')return '<path d="M50 96 C44 100 50 106 60 98" stroke="'+d+'" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="62" cy="96" r="4.2" fill="'+m+'" stroke="'+d+'" stroke-width="1.4"/>';
    return '<path d="M46 90 C38 94 36 102 40 108 C43 112 48 110 46 106" stroke="'+d+'" stroke-width="3.4" fill="none" stroke-linecap="round"/>';
  }
  var face,pose='rest',extra='';
  if(expr==='happy'){pose='wave';face='<path d="M62 72 Q70 61 78 72" stroke="'+ink+'" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M84 72 Q92 61 100 72" stroke="'+ink+'" stroke-width="3.4" fill="none" stroke-linecap="round"/><ellipse cx="59" cy="84" rx="5.5" ry="3.2" fill="'+ch+'" opacity=".6"/><ellipse cx="103" cy="84" rx="5.5" ry="3.2" fill="'+ch+'" opacity=".6"/><path d="M70 86 Q81 101 92 86 Z" fill="'+ink+'"/>';}
  else if(expr==='alert'){pose='up';face=eyes(0,0,10.5,3.8)+brows('M60 55 Q69 49 78 54','M84 54 Q93 49 102 55')+'<ellipse cx="81" cy="90" rx="4.5" ry="5.5" fill="'+ink+'"/>';extra='<g class="dal-bang"><circle cx="130" cy="30" r="13" fill="#e0bd7a"/><rect x="128" y="21" width="4" height="11" rx="2" fill="'+ink+'"/><circle cx="130" cy="37" r="2.3" fill="'+ink+'"/></g>';}
  else if(expr==='pointup'){pose='up';face=eyes(0,-3.6)+brows('M61 57 Q69 52 77 55','M85 55 Q93 52 101 57')+'<path d="M72 87 Q80 94 90 86" stroke="'+ink+'" stroke-width="3" fill="none" stroke-linecap="round"/>';}
  else if(expr==='pointing'){pose='point';face=eyes(-3,-2.5)+brows('M61 57 Q69 53 77 56','M85 56 Q93 53 101 57')+'<path d="M72 87 Q80 94 90 86" stroke="'+ink+'" stroke-width="3" fill="none" stroke-linecap="round"/>';}
  else if(expr==='thinking'){pose='chin';face=eyes(2.8,-3.4)+brows('M62 58 Q70 56 78 58','M84 55 Q93 49 101 54')+'<path d="M74 90 L88 88" stroke="'+ink+'" stroke-width="3" stroke-linecap="round"/>';extra='<g class="dal-dots"><circle cx="122" cy="44" r="4" fill="#8fe0ad"/><circle cx="134" cy="32" r="5" fill="#8fe0ad"/><circle cx="146" cy="18" r="6.5" fill="#8fe0ad"/></g>';}
  else if(expr==='sleepy'){face='<path d="M61 71 Q70 76 79 71" stroke="'+ink+'" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M83 71 Q92 76 101 71" stroke="'+ink+'" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="81" cy="90" rx="3.2" ry="2.4" fill="'+ink+'"/>';extra='<g class="dal-z" fill="#bcd6c4" font-family="DM Serif Display,Georgia,serif"><text x="118" y="46" font-size="17">z</text><text x="132" y="30" font-size="23">z</text></g>';}
  else if(expr==='puzzled'){pose='chin';face='<circle cx="70" cy="70" r="8.5" fill="#fff"/><circle cx="92" cy="70" r="11" fill="#fff"/><circle cx="71" cy="71" r="4" fill="'+ink+'"/><circle cx="91" cy="69" r="4.8" fill="'+ink+'"/>'+brows('M60 57 L78 60','M84 53 Q93 48 102 54')+'<path d="M72 90 q4 -4 8 0 t8 0" stroke="'+ink+'" stroke-width="3" fill="none" stroke-linecap="round"/>';extra='<text class="dal-q" x="122" y="44" font-size="32" fill="#e0bd7a" font-family="DM Serif Display,Georgia,serif">?</text>';}
  else {face=eyes()+'<path d="M72 88 Q81 95 90 88" stroke="'+ink+'" stroke-width="3" fill="none" stroke-linecap="round"/>';}
  return '<svg class="dal-svg" viewBox="0 0 160 150" aria-hidden="true"><defs><radialGradient id="dalg" cx="34%" cy="28%" r="78%"><stop offset="0" stop-color="#d6f7df"/><stop offset=".55" stop-color="'+m+'"/><stop offset="1" stop-color="'+d+'"/></radialGradient></defs>'+
    '<ellipse class="dal-shadow" cx="80" cy="142" rx="30" ry="4.5" fill="#000" opacity=".35"/><g class="dal-body">'+
    '<path d="M79 30 C68 24 60 30 64 36 C67 40 72 36 69 33" stroke="#4f8a5e" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M80 38 C80 30 82 24 86 18" stroke="#3d6b4a" stroke-width="4" fill="none" stroke-linecap="round"/>'+
    '<g class="dal-leaf"><path d="M86 20 C92 8 108 4 122 10 C118 14 120 18 126 20 C116 26 110 22 108 26 C100 30 92 28 86 20Z" fill="#8fe0ad"/><path d="M86 20 C98 16 110 14 122 12 M100 17 L104 24 M110 15 L114 21" stroke="#4f8a5e" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>'+
    b+arm(pose)+face+'</g>'+extra+'</svg>';
}
/* Help catalog — researched from the staging code of every app (Sep 2026). app = which tile opens it. */
var DAL_HELP=[
 {app:'vision',q:'How do I start a new inspection?',a:'Open Export Inspection, pick the product, then + New inspection. The button only appears while you’re viewing the active season.',k:'inspection new create start add'},
 {app:'vision',q:'How does accepting or rejecting a batch work?',a:'The inspector sets A — Accept or R — Reject in the Decision card of the form. A rejected batch can be sent up with Escalate to board; the board decides in Escalation Review.',k:'accept reject decision escalate board approve'},
 {app:'vision',q:'How do I switch season?',a:'Use the Season dropdown at the top of the Vision sidebar. The active season is tagged “— Active”.',k:'season switch change year'},
 {app:'vision',q:'How do I add a client QC report?',a:'Open Client QC, pick the product, then + New client report. Upload the client’s PDF or photos and the fields fill in for you. Emailed reports also wait in the Intake panel.',k:'client qc cqc report upload intake'},
 {app:'vision',q:'A client changed their score — how do I record it?',a:'Open the client QC report and use ↑ Upgrade or ↓ Downgrade, then Record. Revised reports show under the Revised filter.',k:'score upgrade downgrade revise cqc'},
 {app:'vision',q:'Where do I find a container?',a:'In Vision, open Shipments, pick the product and search by container, client or variety. Export Inspection also searches by LOT or container.',k:'container find search shipment lot'},
 {app:'vision',q:'Can I export inspection data?',a:'Yes: Export CSV in Inspections Analytics, and Client PDF / Internal PDF on a saved inspection. There’s no Excel export in Vision.',k:'export csv pdf download excel'},
 {app:'commercial',q:'How do I raise a claim?',a:'In DalOS Commercial, click Raise claim on a container row or in its drawer. Choose Whole container or Part of load, add the value and save — evidence upload unlocks after the first save.',k:'claim raise complaint'},
 {app:'commercial',q:'How does claim approval work?',a:'Open the claim and use Record settlement & submit for approval. At or below the threshold it closes on its own; above it an approver decides in Claim Approvals. You can’t approve your own settlement.',k:'claim approve approval settlement threshold'},
 {app:'commercial',q:'How do I grade a container with no client QC?',a:'In DalOS Commercial open Grading — it lists containers without a client QC — click Grade, choose the grade and QC State, then Save grading.',k:'grade grading qc state'},
 {app:'commercial',q:'How do I redirect goods to another client?',a:'From the container drawer in DalOS Commercial click Redirect, choose whole container, selected rows or a percentage, and the new client. Cancel from the Redirects tab.',k:'redirect return client'},
 {app:'commercial',q:'How do I capture a lead at a stand?',a:'Use Show Mode in DalOS Commercial: scan a card or QR and Save & capture next. Or use + New lead on the Leads page.',k:'lead capture show mode stand card'},
 {app:'commercial',q:'Can I import many leads at once?',a:'Leads → Import CSV → download the template, paste or upload, run the check, then Import ready rows. Only Company is required.',k:'import csv bulk leads'},
 {app:'analytics',q:'How do I get access to Analytics?',a:'Click Request access on the Analytics tile here in Workspace. An admin approves it in Vision → Admin → Analytics access, and the tile unlocks. Access to individual dashboards is managed separately, in Analytics → Manage access.',k:'access analytics request permission locked'},
 {app:'analytics',q:'How do I find a dashboard?',a:'In Analytics press ⌘K (Ctrl K on Windows) or click Search Dashboards — it only shows dashboards you can open.',k:'dashboard find search report'},
 {app:'analytics',q:'Which product dashboards exist?',a:'Grapes, Citrus, Mango and Pomegranate hubs, plus Finance and Project Management.',k:'dashboards hubs products list'},
 {app:'landcloud',q:'How do I find a block?',a:'In Land Cloud open Block Register and search by block ID or Aydi, then click the row. You can also click a plot on Farm Map.',k:'block find farm plot aydi'},
 {app:'landcloud',q:'How do I draw a block boundary?',a:'Open the block in Land Cloud, click the boundary tile in the Area section (+ Add boundary), draw on the map and Save boundary.',k:'boundary draw map polygon block'},
 {app:'landcloud',q:'Where is the Harvest Planner?',a:'In Land Cloud under Manage → Harvest Planner.',k:'harvest planner plan'},
 {app:'',q:'I forgot my password.',a:'Sign out, then on the sign-in screen click Forgot password?, enter your email and Send reset link.',k:'password forgot reset login'},
 {app:'',q:'Why was I signed out?',a:'DalOS signs you out after 60 minutes with no activity in any tab. Signing out in one app signs you out of all of them.',k:'signed out logout session timeout'}
];
var DAL_SUGGEST={admin:[1,8,13],power_user:[8,9,5],board:[1,15,5],qc_manager:[3,4,6],ph_manager:[0,3,5],qc_supervisor:[0,1,2],inspector:[0,1,2],commercial:[7,9,11],marketing:[11,12,14],executive:[14,15,5],agronomy_admin:[16,17,18],agronomy_viewer:[16,18,15]};
function dalAppLabel(a){return {vision:'Vision',analytics:'Analytics',commercial:'Commercial',landcloud:'Land Cloud'}[a]||'';}
function dalCanOpen(a){
  if(a==='vision')return true;
  if(a==='analytics')return $('tileAnalytics')&&$('tileAnalytics').getAttribute('data-state')==='granted';
  if(a==='commercial')return !!COMMERCIAL_ROLES[dalState.role];
  if(a==='landcloud')return !!FARM_ROLES[dalState.role];
  return false;
}
function dalKey(k){var d=new Date();return 'dal_'+k+'_'+(dalState.u&&dalState.u.id)+'_'+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function dalGet(k){try{return localStorage.getItem(dalKey(k));}catch(e){return null;}}
function dalSet(k){try{localStorage.setItem(dalKey(k),'1');}catch(e){}}
function dalQuiet(){try{var h=+new Intl.DateTimeFormat('en-GB',{hour:'numeric',hour12:false,timeZone:'Africa/Cairo'}).format(new Date());return h<7||h>=20;}catch(e){return false;}}
function dalCount(q){return q.then(function(r){return (r&&!r.error&&typeof r.count==='number')?r.count:0;},function(){return 0;});}
/* Nudges in priority order — first one above zero wins. roles = who gets asked (RLS still scopes the count). */
function dalNudges(){
  var role=dalState.role,since=new Date(Date.now()-7*864e5).toISOString(),N=[];
  function has(list){return list.indexOf(role)>=0;}
  if(has(['board','admin','power_user']))N.push(dalCount(sb.from('inspections').select('id',{count:'exact',head:true}).eq('status','Escalated')).then(function(n){return n&&{expr:'alert',html:'<b>'+n+' rejected '+(n===1?'batch is':'batches are')+'</b> waiting for the board’s decision in Escalation Review.',app:'vision',cta:'Open Vision'};}));
  if(has(['admin','power_user']))N.push(dalCount(sb.from('crm_claims').select('id',{count:'exact',head:true}).eq('status','pending')).then(function(n){return n&&{expr:'alert',html:'<b>'+n+' claim '+(n===1?'settlement is':'settlements are')+'</b> waiting in Claim Approvals.',app:'commercial',cta:'Open Commercial'};}));
  if(role==='admin')N.push(Promise.all([dalCount(sb.from('dal_access_requests').select('id',{count:'exact',head:true}).eq('status','pending')),dalCount(sb.from('analytics_access_requests').select('id',{count:'exact',head:true}).eq('status','pending'))]).then(function(c){
    /* two separate queues: app access (Workspace tile → Vision → Admin → Analytics access)
       and dashboard access (Analytics → Manage access) */
    if(c[1])return {expr:'alert',html:'<b>'+c[1]+' '+(c[1]===1?'person is':'people are')+'</b> waiting for access to the Analytics app. Approve in Vision → Admin → Analytics access.',app:'vision',cta:'Open Vision'};
    if(c[0])return {expr:'alert',html:'<b>'+c[0]+' dashboard access '+(c[0]===1?'request is':'requests are')+'</b> waiting. Approve in Analytics → Manage access.',app:'analytics',cta:'Open Analytics'};
    return 0;}));
  if(has(['admin','power_user','qc_manager','ph_manager','qc_supervisor','commercial']))N.push(dalCount(sb.from('cqc_intake').select('id',{count:'exact',head:true}).neq('status','completed')).then(function(n){return n&&{expr:'alert',html:'<b>'+n+' client QC '+(n===1?'email is':'emails are')+'</b> waiting in the Client QC intake.',app:'vision',cta:'Open Vision'};}));
  if(has(['agronomy_admin','admin','power_user']))N.push(Promise.all([dalCount(sb.from('farm_blocks').select('id',{count:'exact',head:true}).in('lifecycle',['EXP','WIP'])),dalCount(sb.from('v_farm_block_geom').select('id',{count:'exact',head:true}).in('lifecycle',['EXP','WIP']))]).then(function(c){var n=c[0]-c[1];return n>0&&{expr:'pointing',html:'<b>'+n+' producing or young '+(n===1?'block has':'blocks have')+'</b> no boundary drawn yet. Land Cloud → Block Register.',app:'landcloud',cta:'Open Land Cloud'};}));
  if(has(['admin','power_user','commercial','marketing']))N.push(dalCount(sb.from('crm_leads').select('id',{count:'exact',head:true}).gte('created_at',since)).then(function(n){return n&&{expr:'happy',html:'<b>'+n+' new '+(n===1?'lead was':'leads were')+'</b> captured in the last 7 days.',app:'commercial',cta:'Open Commercial'};}));
  return Promise.all(N).then(function(r){dalState.pending=r.filter(Boolean);for(var i=0;i<r.length;i++)if(r[i])return r[i];
    /* last resort: offer Analytics access — ask the server, the tile may not have loaded yet */
    return sb.rpc('my_analytics_state').then(function(s){return (s&&!s.error&&s.data==='none')?{expr:'pointing',html:'You don’t have Analytics yet. Want me to request access for you?',app:'',cta:'Request access',act:'request'}:null;},function(){return null;});});
}
function dalGreeting(){var h=new Date().getHours(),g=h<12?'Good morning':h<17?'Good afternoon':'Good evening';var f=((dalState.u.name||'').trim().split(' ')[0])||'';return g+(f?', '+f:'')+'.';}
function dalFace(expr){var c=dalState.el.querySelector('.dal-char-svg');c.innerHTML=dalSvg(expr);}
/* ── Dal movement: walk to the answer and point, then hop home. Drag to move. ──
   Only the character travels; the speech bubble stays where the person is reading.
   Reduced motion or narrow screens: no walking — the target tile just glows. */
var DAL_TILE={vision:'tileVision',analytics:'tileAnalytics',commercial:'tileCommercial',landcloud:'tileLandCloud'};
function dalStill(){return (window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)||window.innerWidth<760;}
function dalGlow(tile,on){if(tile)tile.classList.toggle('dal-target',!!on);}
function dalPointTo(app){
  var tile=$(DAL_TILE[app]);if(!tile||!dalState.el||dalState.dragging)return;
  clearTimeout(dalState.homeT);[].forEach.call(document.querySelectorAll('.dal-target'),function(x){if(x!==tile)dalGlow(x,false);});
  dalGlow(tile,true);
  dalState.homeT=setTimeout(function(){dalGoHome();},4800);
  if(dalStill()||dalState.el.classList.contains('is-min'))return;
  var ch=dalState.el.querySelector('.dal-char'),c=ch.getBoundingClientRect(),t=tile.getBoundingClientRect(),o=dalState.off||{x:0,y:0};
  var homeL=c.left-o.x,homeT=c.top-o.y;
  /* land just below the tile, a little right of centre (never on it); above it if there's no room */
  var lx=t.left+t.width*0.62-c.width/2,ly=t.bottom+8,below=ly+c.height<=window.innerHeight-56;if(!below)ly=t.top-c.height-8;
  dalState.away={tile:tile};
  dalTravel(Math.round(lx-homeL),Math.round(ly-homeT),function(){dalFace(below?'pointup':'pointing');dalState.lookAt=null;});
}
function dalGoHome(instant){
  clearTimeout(dalState.homeT);
  [].forEach.call(document.querySelectorAll('.dal-target'),function(x){dalGlow(x,false);});
  if(!dalState.el)return;var was=dalState.away;dalState.away=null;
  if(instant||dalStill()){cancelAnimationFrame(dalState.raf);dalState.raf=0;dalState.off={x:0,y:0};dalState.lookAt=null;dalState.el.classList.remove('is-moving');dalSetPose({x:0,y:0});return;}
  if(!was&&!dalState.raf)return;
  dalTravel(0,0,function(){dalState.lookAt=null;var m=dalState.el.querySelector('.dal-msg');if(!m.querySelector('.dal-typing'))dalFace('neutral');});
}
/* ── physics: anticipation → gravity arcs (1–4 hops) → squash on impact → damped settle ──
   Only transforms are animated (compositor-friendly). The body leans into the direction of
   travel, the leaf follows through, the ground shadow stays on the ground, dust on landing. */
function dalSetPose(o){
  var ch=dalState.el.querySelector('.dal-char'),sv=ch.querySelector('.dal-char-svg'),g=ch.querySelector('.dal-ground');
  ch.style.transform=(o.x||o.y)?'translate('+o.x.toFixed(1)+'px,'+o.y.toFixed(1)+'px)':'';
  sv.style.transform=(o.sx||o.sy||o.rot)?'rotate('+(o.rot||0).toFixed(2)+'deg) scale('+(o.sx||1).toFixed(3)+','+(o.sy||1).toFixed(3)+')':'';
  if(g){var l=o.lift||0;g.style.transform=l?'translateY('+l.toFixed(1)+'px) scale('+Math.max(.4,1-l/130).toFixed(3)+')':'';g.style.opacity=l?Math.max(.2,1-l/150).toFixed(2):'';}
  var leaf=sv.querySelector('.dal-leaf');if(leaf)leaf.style.transform=o.leaf?'rotate('+o.leaf.toFixed(1)+'deg)':'';
  if(dalState.lookAt){var L=dalState.lookAt;[].forEach.call(sv.querySelectorAll('.dal-pupil'),function(p){p.setAttribute('transform','translate('+(L.x*3.4).toFixed(2)+' '+(L.y*3.4).toFixed(2)+')');});}
}
function dalPuff(){
  var ch=dalState.el.querySelector('.dal-char');
  for(var i=0;i<7;i++){(function(i){var s=document.createElement('span');s.className='dal-dust';ch.appendChild(s);
    var side=i%2?1:-1,dx=side*(10+Math.random()*26),dy=-(3+Math.random()*10),sc=.6+Math.random()*.8;
    var a=s.animate([{transform:'translate(0,0) scale(.3)',opacity:.75},{transform:'translate('+dx+'px,'+dy+'px) scale('+sc+')',opacity:0}],{duration:420+Math.random()*180,easing:'cubic-bezier(.2,.7,.3,1)'});
    a.onfinish=function(){s.remove();};})(i);}
}
function dalTravel(tx,ty,done){
  var el=dalState.el;cancelAnimationFrame(dalState.raf);
  var o=dalState.off||{x:0,y:0},sx=o.x,sy=o.y,dx=tx-sx,dy=ty-sy,dist=Math.hypot(dx,dy);
  if(dist<2){dalState.off={x:tx,y:ty};dalSetPose({x:tx,y:ty});done&&done();return;}
  el.classList.add('is-moving');
  var hops=Math.max(1,Math.min(4,Math.round(dist/300))),dir=dx>=0?1:-1,seg=dist/hops;
  var CROUCH=150,HOP=Math.min(560,320+seg*0.35),GAP=70,SETTLE=520,AIR=hops*HOP+(hops-1)*GAP;
  var H=Math.min(95,30+seg*0.2),UP=dy<0?Math.min(50,-dy/hops*0.35):0;
  /* look where we're going first */
  dalState.lookAt={x:dx/dist,y:dy/dist};dalFace('neutral');
  var t0=performance.now(),landed=0;
  function frame(now){
    var t=now-t0,p={x:sx,y:sy,sx:1,sy:1,rot:0,lift:0,leaf:0};
    if(t<CROUCH){/* anticipation: crouch and lean */
      var c=Math.sin(t/CROUCH*Math.PI/2);p.sy=1-.15*c;p.sx=1+.11*c;p.rot=dir*5*c;p.leaf=dir*6*c;
    }else if(t<CROUCH+AIR){
      var u=t-CROUCH,i=Math.min(hops-1,Math.floor(u/(HOP+GAP))),v=u-i*(HOP+GAP),a=i/hops,b=(i+1)/hops;
      if(v>HOP){/* between hops: land, squash, push off again */
        if(landed<=i){landed=i+1;dalPuff();}
        var w=(v-HOP)/GAP,k=Math.sin(w*Math.PI);p.x=sx+dx*b;p.y=sy+dy*b;p.sy=1-.17*k;p.sx=1+.12*k;p.rot=dir*4;p.leaf=-dir*8*(1-w);
      }else{
        var s=v/HOP,e=s<.5?2*s*s:1-Math.pow(-2*s+2,2)/2,h=H+UP,lift=h*4*s*(1-s);
        p.x=sx+dx*(a+(b-a)*e);p.y=sy+dy*(a+(b-a)*e)-lift;p.lift=lift;
        var vel=1-2*s;/* +1 take-off … -1 landing */
        p.sy=1+.13*Math.abs(vel);p.sx=1-.09*Math.abs(vel);p.rot=dir*(7*vel*vel+2);
        p.leaf=-dir*16*vel+(vel<0?-dir*8:0);
        if(s>.93){var q=(s-.93)/.07;p.sy=1-.18*q;p.sx=1+.13*q;}
      }
    }else{
      if(landed<hops){landed=hops;dalPuff();}
      var w2=t-CROUCH-AIR,k2=w2/1000,osc=Math.exp(-k2/0.1)*Math.cos(2*Math.PI*k2/0.24);
      p.x=tx;p.y=ty;p.sy=1-.18*osc;p.sx=1+.13*osc;p.rot=dir*3*osc;p.leaf=-dir*18*osc;
      if(w2>=SETTLE){dalState.off={x:tx,y:ty};dalSetPose({x:tx,y:ty});el.classList.remove('is-moving');dalState.raf=0;done&&done();return;}
    }
    dalState.off={x:p.x,y:p.y};dalSetPose(p);dalState.raf=requestAnimationFrame(frame);
  }
  dalState.raf=requestAnimationFrame(frame);
}
/* drag to move (desktop). Position is remembered on this computer; double-click Dal to send it home. */
function dalPlace(pos){var el=dalState.el;if(!el)return;
  if(pos){el.style.right=pos.r+'px';el.style.bottom=pos.b+'px';}else{el.style.right='';el.style.bottom='';}
  var ch=el.querySelector('.dal-char').getBoundingClientRect();
  el.classList.toggle('is-left',ch.left+ch.width/2<window.innerWidth/2);
  el.classList.toggle('is-top',ch.top<window.innerHeight*0.45);}
function dalDragInit(){
  var el=dalState.el,ch=el.querySelector('.dal-char'),st=null;
  try{var p=JSON.parse(localStorage.getItem('dal_pos')||'null');if(p&&window.innerWidth>=760)dalPlace({r:Math.min(p.r,window.innerWidth-120),b:Math.min(p.b,window.innerHeight-100)});}catch(e){}
  ch.addEventListener('pointerdown',function(e){if(window.innerWidth<760||e.button!==0)return;var cs=getComputedStyle(el);st={x:e.clientX,y:e.clientY,r:parseFloat(cs.right),b:parseFloat(cs.bottom),moved:false};});
  window.addEventListener('pointermove',function(e){if(!st)return;var dx=e.clientX-st.x,dy=e.clientY-st.y;
    if(!st.moved&&Math.hypot(dx,dy)<6)return;if(!st.moved){st.moved=true;dalState.dragging=true;dalGoHome(true);el.classList.add('is-drag');}
    dalPlace({r:Math.max(8,Math.min(window.innerWidth-110,st.r-dx)),b:Math.max(8,Math.min(window.innerHeight-100,st.b-dy))});});
  window.addEventListener('pointerup',function(){if(!st)return;var moved=st.moved;st=null;el.classList.remove('is-drag');
    if(moved){dalState.dragging=false;dalState.justDragged=true;setTimeout(function(){dalState.justDragged=false;},50);
      try{localStorage.setItem('dal_pos',JSON.stringify({r:parseFloat(el.style.right),b:parseFloat(el.style.bottom)}));}catch(e){}}});
  ch.addEventListener('dblclick',function(){try{localStorage.removeItem('dal_pos');}catch(e){}dalPlace(null);});
  document.addEventListener('pointerdown',function(e){if(dalState.away&&!el.contains(e.target))dalGoHome();});
  window.addEventListener('resize',function(){if(el.style.right)dalPlace({r:Math.min(parseFloat(el.style.right),window.innerWidth-110),b:Math.min(parseFloat(el.style.bottom),window.innerHeight-100)});});
}
function dalSay(html,o){
  o=o||{};var el=dalState.el,msg=el.querySelector('.dal-msg'),act=el.querySelector('.dal-act');
  dalGoHome();dalFace('thinking');msg.innerHTML='<span class="dal-typing"><i></i><i></i><i></i></span>';act.innerHTML='';
  setTimeout(function(){dalFace(o.expr||'neutral');msg.innerHTML=html;
    if(o.choices)o.choices.forEach(function(c){var b=document.createElement('button');b.type='button';b.className='dal-choice';b.textContent=c.label;b.onclick=c.fn;act.appendChild(b);});
    if(o.cta){var b=document.createElement('button');b.type='button';b.className='dal-pri';b.textContent=o.cta;b.onclick=function(){if(o.act==='request'){dalMin(true);requestAnalyticsAccess();return;}if(o.app&&dalCanOpen(o.app))openProduct(o.app);};act.appendChild(b);}
    /* show the way: hop to the app tile this answer is about */
    var to=o.act==='request'?'analytics':o.app;if(to&&!el.classList.contains('is-min'))setTimeout(function(){dalPointTo(to);},250);
  },o.fast?0:650);
}
function dalAnswer(i){var h=DAL_HELP[i];if(!h)return;var can=h.app&&dalCanOpen(h.app);dalState.last={type:'help',i:i,app:h.app};
  dalSay(dalEsc(h.a)+(h.app&&!can?' <span class="dal-dim">You don’t have '+dalAppLabel(h.app)+' access yet.</span>':''),{expr:h.app?'pointing':'neutral',app:h.app,cta:can?'Open '+dalAppLabel(h.app):''});}
function dalEsc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function dalRenderSugg(list){var box=dalState.el.querySelector('.dal-sugg-list');box.innerHTML='';
  list.forEach(function(i){var b=document.createElement('button');b.type='button';
    if(typeof i==='number'){b.textContent=DAL_HELP[i].q;b.onclick=function(){dalAnswer(i);};}
    else if(i&&i.q){b.textContent=i.label;b.onclick=function(){dalAsk(i.q);};}
    else{var p=String(i).split(':'),op=DAL_OPS[p[0]];if(!op)return;b.textContent=p[1]&&p[0]==='farm'?'Farm summary: '+dalFarmName(p[1]):op.label;b.onclick=function(){dalRunOp(p[0],p[1]);};}
    box.appendChild(b);});}
function dalDefaultSugg(){var s=(DAL_OPS_SUGGEST[dalState.role]||[13,19,20]).slice();if(dalState.latestBox)s.unshift({label:'What happened with '+dalState.latestBox+'?',q:dalState.latestBox});return s;}
/* ── Dal understanding (level 1 — in the browser, no AI) ──
   Normalises English / Arabic / Franco-Arabic, maps words to topics, forgives typos,
   spots container numbers and inspection IDs and looks them up live (with the user's
   own session, so RLS decides what comes back). */
var DAL_TAGS=[['inspection','create'],['decide','reject','inspection','escalate'],['season'],['cqc','create'],['score','cqc','change'],['container','find'],['export'],['claim','create'],['claim','decide'],['grade','container'],['redirect'],['lead','create','stand'],['lead','import'],['access','analytics'],['dashboard','find'],['dashboard','list'],['block','find'],['boundary','block'],['harvest'],['password'],['signout']];
var DAL_WHO=['admin, power_user, qc_manager, ph_manager, qc_supervisor and inspectors.','Anyone who can create or edit inspections sets Accept / Reject. Escalating: admin, power_user, qc_manager, qc_supervisor. Deciding escalations: the board, admin, power_user.','Everyone in Vision.','admin, power_user, qc_manager, ph_manager, commercial and client_qc.','admin, power_user, qc_manager, ph_manager, commercial and client_qc.','Most roles — not inspectors, qc_supervisor or marketing.','Roles with Inspections Analytics.','admin, power_user and commercial.','Claim approvers: admin, power_user and anyone granted approval.','admin, power_user and commercial.','admin, power_user and commercial.','Roles that manage leads: admin, power_user, commercial, marketing.','Roles that manage leads: admin, power_user, commercial, marketing.','Anyone can request; admins approve.','Anyone with Analytics access.','Depends on your Analytics access.','Anyone with Land Cloud.','admin, power_user and agronomy_admin.','Viewing: Land Cloud users. Editing: planners.','Anyone.','Everyone.'];
DAL_HELP.forEach(function(h,i){h.t=DAL_TAGS[i]||[];h.w=DAL_WHO[i]||'';});
/* word → topic. Arabic is matched after normalisation (no diacritics, أإآ→ا, ى→ي, ة→ه). */
var DAL_SYN={
 claim:'claim claims complaint complaints complain shakwa shakwah shekaya shakawa kleem claym rotten rot decay decayed mould mold moldy damaged damage spoiled spoilt bruised compensation refund شكوي شكاوي شكوه كليم مطالبه تعويض عفن معفن تالف خربان بايظ ممعفن',
 create:'raise new create add make start submit record open file a3mel a3ml 3amel e3mel اعمل عمل اعملها اضيف اضافه جديد جديده ابدا سجل اسجل',
 decide:'approve approval approved accept accepted decide decision sign موافقه اوافق اعتماد يعتمد اعتمد قبول قرار',
 reject:'reject rejected rejection refuse refused رفض مرفوض مرفوضه',
 escalate:'escalate escalation board تصعيد مجلس',
 inspection:'inspection inspections inspect batch session pallet pallets fahs فحص تفتيش معاينه باتش بالته',
 container:'container containers cont konteiner kontainer shipment shipments كونتينر حاويه حاويات شحنه شحنات',
 find:'find search where locate look see show feen fein fen فين اين الاقي القي ابحث دور اشوف',
 season:'season seasons year mawsem mosem موسم الموسم سنه',
 cqc:'cqc qc client_qc clientqc report reports تقرير تقارير جوده',
 score:'score scores rating points mark درجه درجات سكور',
 change:'change changed update revise revised upgrade downgrade fix edit تغيير غير تعديل عدل رفع خفض',
 grade:'grade grades grading graded جريد تقييم قيم',
 export:'export download excel csv pdf print extract تصدير نزل تنزيل اكسل طباعه استخراج',
 redirect:'redirect redirection reroute divert returned return تحويل حول مرتجع رجوع',
 lead:'lead leads prospect prospects contact contacts buyer ليد ليدز عميل عملاء محتمل',
 stand:'stand booth fair exhibition expo show card scan معرض ستاند كارت',
 import:'import bulk upload many sheet list استيراد رفع ملف كتير',
 access:'access permission permissions locked lock allowed unlock صلاحيه صلاحيات اكسس دخول مقفول',
 analytics:'analytics analysis انالتكس تحليلات',
 dashboard:'dashboard dashboards chart charts داشبورد لوحه',
 list:'which list all available ايه ايش كل',
 block:'block blocks plot plots farm farms aydi بلوك بلوكات قطعه مزرعه مزارع حوشه',
 boundary:'boundary boundaries border map polygon draw shape حدود خريطه ارسم رسم',
 harvest:'harvest planner plan planning picking حصاد خطه تخطيط قطف جمع',
 password:'password pass pwd passcode باسورد باسوورد كلمه سر المرور',
 signout:'signed logout logged kicked timeout expired session out خروج طلعني خرجني'
};
var DAL_WORD={},DAL_VOCAB=[];
function dalNorm(s){return String(s||'').toLowerCase().replace(/[ً-ْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u060C\u061B\u061F\u066A-\u066D\u06D4]/g,' ').replace(/[^a-z0-9؀-ۿ\s\/-]/g,' ').replace(/\s+/g,' ').trim();}
Object.keys(DAL_SYN).forEach(function(t){dalNorm(DAL_SYN[t]).split(' ').forEach(function(w){if(w){DAL_WORD[w]=t;DAL_VOCAB.push(w);}});});
function dalLev(a,b){if(Math.abs(a.length-b.length)>2)return 9;var p=[],i,j;for(j=0;j<=b.length;j++)p[j]=j;
  for(i=1;i<=a.length;i++){var prev=p[0];p[0]=i;for(j=1;j<=b.length;j++){var tmp=p[j];p[j]=Math.min(p[j]+1,p[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=tmp;}}return p[b.length];}
function dalTopics(q){var words=dalNorm(q).split(' '),t={};
  words.forEach(function(w){if(w.length<2)return;var hit=DAL_WORD[w];
    if(!hit&&w.length>=4){/* strip Arabic al- prefix, then forgive typos */
      if(w.indexOf('ال')===0&&DAL_WORD[w.slice(2)])hit=DAL_WORD[w.slice(2)];
      else{var best=9,bw='';DAL_VOCAB.forEach(function(v){if(v.length<4)return;var d=dalLev(w,v);if(d<best){best=d;bw=v;}});if(best<=(w.length>=7?2:1))hit=DAL_WORD[bw];}}
    if(hit)t[hit]=1;});
  return Object.keys(t);}
/* generic topics count less than specific ones, so “rotten container” means a claim, not a search */
var DAL_GENERIC={container:1,find:1,create:1,list:1,change:1,decide:2,report:1};
function dalRank(q){var tp=dalTopics(q),nq=dalNorm(q),hits=[];if(!nq)return hits;
  DAL_HELP.forEach(function(h,i){var s=0;h.t.forEach(function(t){if(tp.indexOf(t)>=0)s+=(DAL_GENERIC[t]||3);});
    nq.split(' ').forEach(function(w){if(w.length>3&&dalNorm(h.q+' '+h.k).indexOf(w)>=0)s+=1;});if(s)hits.push([s,i]);});
  hits.sort(function(a,b){return b[0]-a[0];});return hits;}
function dalSearch(q){if(!q.trim()){dalRenderSugg(dalDefaultSugg());return [];}
  var hits=dalRank(q);if(hits.length)dalRenderSugg(hits.slice(0,4).map(function(x){return x[1];}));return hits;}
/* entities */
var DAL_RX_BOX=/\b([a-z]{4})\s*(\d{6,7})\b/i,DAL_RX_SLASH=/\b(\d{3,5})\s*\/\s*(\d{3,5})\b/,DAL_RX_INSP=/\b(gr|ct|mn|pm)\s*-\s*(\d{4})\s*-\s*(\d{1,4})\b/i;
function dalFmtDate(d){if(!d)return '';var x=new Date(d);return isNaN(x)?String(d):x.getDate()+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getMonth()]+' '+x.getFullYear();}
function dalCap(s){s=String(s||'');return s.charAt(0).toUpperCase()+s.slice(1);}
function dalSafe(p){return p.then(function(r){return (r&&!r.error&&r.data)||[];},function(){return [];});}
/* Container lookup — by VOYAGE (container + loading date), the same grain as Commercial.
   A container number can be reused, so each voyage is shown on its own, newest first:
   claims match by voyage_key, inspections by the shipment's matched_inspection_id (else the
   nearest earlier inspection within 60 days), client QC by load date or inspection. */
function dalLookupContainer(label,likePat,exact){
  function q(tbl,cols){var b=sb.from(tbl).select(cols);return exact?b.eq('container_number',exact):b.ilike('container_number',likePat);}
  function day(d){return d?String(d).slice(0,10):'';}
  return Promise.all([
    dalSafe(q('shipments','loading_date,client,product_id,variety,receiving_country,shipping_status,matched_inspection_id').order('loading_date',{ascending:false}).limit(80)),
    dalSafe(q('inspections','id,status,date').order('date',{ascending:false}).limit(20)),
    dalSafe(q('client_qc_reports','score,qc_report_number,load_date,inspection_id').is('superseded_by',null).limit(20)),
    dalSafe(q('crm_claims','claim_ref,status,claimed_value,claimed_currency,voyage_key').limit(20))
  ]).then(function(r){var sh=r[0],ins=r[1],cq=r[2],cl=r[3];
    if(!sh.length&&!ins.length&&!cq.length&&!cl.length)return dalSay('I couldn’t find <b>'+dalEsc(label)+'</b> in anything you have access to. Check the number, or it may belong to a product you can’t see.',{expr:'puzzled'});
    /* 1. voyages from shipment lines */
    var V={},order=[];
    sh.forEach(function(s){var k=day(s.loading_date);if(!V[k]){V[k]={d:k,s:s,vars:{},insp:{},cqc:[],claims:[]};order.push(k);}if(s.variety)V[k].vars[s.variety]=1;if(s.matched_inspection_id)V[k].insp[s.matched_inspection_id]=1;});
    order.sort().reverse();
    var byId={};ins.forEach(function(x){byId[x.id]=x;});
    /* 2. inspections: matched id first, else nearest earlier inspection within 60 days */
    var usedI={};order.forEach(function(k){Object.keys(V[k].insp).forEach(function(id){usedI[id]=1;});});
    ins.forEach(function(x){if(usedI[x.id])return;var best=null,gap=1e9;order.forEach(function(k){var g=(new Date(k)-new Date(day(x.date)))/864e5;if(g>=0&&g<=60&&g<gap){gap=g;best=k;}});if(best){V[best].insp[x.id]=1;usedI[x.id]=1;}});
    /* 3. client QC: same load date, or linked to one of the voyage's inspections */
    var looseQ=[];cq.forEach(function(c){var k=day(c.load_date);if(!V[k]){order.forEach(function(kk){if(c.inspection_id&&V[kk].insp[c.inspection_id])k=kk;});}if(V[k])V[k].cqc.push(c);else looseQ.push(c);});
    /* 4. claims by voyage_key "CONTAINER|YYYY-MM-DD" */
    var looseC=[];cl.forEach(function(c){var k=c.voyage_key?String(c.voyage_key).split('|')[1]:'';if(V[k])V[k].claims.push(c);else looseC.push(c);});
    function voyageLines(v){var s=v.s,out=[],vs=Object.keys(v.vars);
      out.push('Loaded <b>'+dalFmtDate(v.d)+'</b> — '+dalEsc(dalCap(s.product_id))+(vs.length?' ('+dalEsc(vs.slice(0,3).join(', '))+(vs.length>3?' +'+(vs.length-3):'')+')':'')+' to <b>'+dalEsc(s.client||'—')+'</b>'+(s.receiving_country?', '+dalEsc(s.receiving_country):'')+(s.shipping_status?'. '+dalEsc(s.shipping_status):'')+'.');
      var ii=Object.keys(v.insp).map(function(id){return byId[id]||{id:id};});
      out.push(ii.length?ii.map(function(x){return 'Inspection <b>'+dalEsc(x.id)+'</b>'+(x.status?': '+dalEsc(x.status):'');}).join(' · ')+'.':'No inspection linked.');
      if(v.cqc.length)out.push('Client QC score <b>'+dalEsc(v.cqc[0].score==null?'—':v.cqc[0].score)+'</b>'+(v.cqc[0].qc_report_number?' (report '+dalEsc(v.cqc[0].qc_report_number)+')':'')+'.');
      out.push(v.claims.length?v.claims.map(function(c){return 'Claim <b>'+dalEsc(c.claim_ref)+'</b>: '+dalEsc(c.status)+(c.claimed_value?', '+dalEsc(c.claimed_value)+' '+dalEsc(c.claimed_currency||''):'');}).join(' · ')+'.':'No claim.');
      return out.join('<br>');}
    var html='<b>'+dalEsc(label)+'</b>';
    if(order.length>1)html+=' — <b>'+order.length+' voyages</b> on this number, newest first:';
    order.slice(0,3).forEach(function(k,i){html+=(order.length>1?'<div class="dal-voy"><span>Voyage '+(i+1)+'</span>':'<div>')+voyageLines(V[k])+'</div>';});
    if(order.length>3)html+='<div class="dal-dim">…and '+(order.length-3)+' older voyage'+(order.length-3>1?'s':'')+' — see Shipments.</div>';
    if(!order.length&&ins.length)html+='<br>No shipment found. Inspection <b>'+dalEsc(ins[0].id)+'</b>: '+dalEsc(ins[0].status||'—')+'.';
    if(looseC.length)html+='<div class="dal-dim">Claim '+looseC.map(function(c){return dalEsc(c.claim_ref)+' ('+dalEsc(c.status)+')';}).join(', ')+' isn’t tied to a voyage above.</div>';
    if(looseQ.length&&order.length)html+='<div class="dal-dim">'+looseQ.length+' client QC report'+(looseQ.length>1?'s':'')+' couldn’t be matched to a voyage.</div>';
    var anyClaim=cl.length>0;
    dalState.last={type:'container',app:anyClaim&&dalCanOpen('commercial')?'commercial':'vision'};
    dalSay(html,{expr:'pointing',app:dalState.last.app,cta:'Open '+dalAppLabel(dalState.last.app)});});
}
function dalLookupInspection(id){
  dalSafe(sb.from('inspections').select('id,status,date,product_id,container_number,packhouse_id,lot_number').eq('id',id).limit(1)).then(function(r){
    if(!r.length)return dalSay('I couldn’t find inspection <b>'+dalEsc(id)+'</b> — it may be at a packhouse you don’t have access to.',{expr:'puzzled'});
    var x=r[0];return dalSafe(sb.from('packhouses').select('name').eq('id',x.packhouse_id).limit(1)).then(function(p){
      dalState.last={type:'inspection',app:'vision'};
      dalSay('<b>'+dalEsc(x.id)+'</b> — '+dalEsc(dalCap(x.product_id))+(p.length?' at '+dalEsc(p[0].name):'')+', '+dalFmtDate(x.date)+'.<br>Decision: <b>'+dalEsc(x.status||'—')+'</b>.'+(x.container_number?'<br>Container '+dalEsc(x.container_number)+'.':'')+(x.lot_number?' Lot '+dalEsc(x.lot_number)+'.':''),{expr:'pointing',app:'vision',cta:'Open Vision'});});});
}
/* ── Dal operational questions — fixed live queries (no AI) ──
   Each one runs with the user's own session, so RLS scopes every answer (commercial sees
   their regions, inspectors their packhouses, agronomy the farms they can read).
   "This week" = the last 7 days. Containers are counted by VOYAGE (container + loading date). */
var DAL_DUMMY_SEASON='e07c8879-dd77-413b-8d11-f6065fafc070'; /* test season — never in operational answers */
function dalDay(off){var d=new Date();d.setDate(d.getDate()+(off||0));return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}
function dalCKey(c){return String(c||'').toUpperCase().replace(/\s+/g,' ').trim();}
function dalVoyages(rows){var seen={},out=[];rows.forEach(function(s){var k=dalCKey(s.container_number)+'|'+String(s.loading_date||'').slice(0,10);if(!seen[k]){seen[k]=1;out.push(s);}});return out;}
function dalLink(c){return '<button type="button" class="dal-link" data-q="'+dalEsc(c)+'">'+dalEsc(c)+'</button>';}
function dalList(items,fmt,max){max=max||5;var h=items.slice(0,max).map(fmt).join('<br>');if(items.length>max)h+='<br><span class="dal-dim">…and '+(items.length-max)+' more.</span>';return h;}
function dalCapNote(rows){return rows.length>=1000?' <span class="dal-dim">(first 1,000 lines only)</span>':'';}
function dalOpSay(html,app,expr){dalState.last={type:'op',app:app};dalSay(html,{expr:expr||'pointing',app:app,cta:app&&dalCanOpen(app)?'Open '+dalAppLabel(app):''});}
var DAL_FARMS=[['BD','badr','بدر'],['HA','hana','هنا'],['KH','el khair','khair','الخير'],['NO','nour','نور'],['SA','salma','سلمي'],['ME','menia','menya','minya','المنيا','منيا'],['LA','layla','ليلي'],['BA','elbaraka','baraka','البركه','بركه']];
function dalFarmIn(n){for(var i=0;i<DAL_FARMS.length;i++){var f=DAL_FARMS[i];for(var j=1;j<f.length;j++){if((' '+n+' ').indexOf(' '+dalNorm(f[j])+' ')>=0)return f[0];}if(new RegExp('\\b'+f[0].toLowerCase()+'\\b').test(n)&&/farm|مزرعه/.test(n))return f[0];}return null;}
var DAL_OPS={
 waiting:{label:'What’s waiting for me?',run:function(){dalNudges().then(function(){var p=dalState.pending||[];
   if(!p.length)return dalSay('Nothing is waiting for you right now.',{expr:'happy'});
   dalOpSay('<b>'+p.length+' thing'+(p.length>1?'s':'')+' waiting for you:</b><br>'+p.map(function(x){return '• '+x.html;}).join('<br>'),p[0].app,'alert');});}},
 at_sea:{label:'Containers at sea right now',run:function(){
   dalSafe(sb.from('shipments').select('container_number,loading_date,client,eta,receiving_country').eq('shipping_status','Shipped').order('eta',{ascending:true}).limit(1000)).then(function(r){var v=dalVoyages(r),today=dalDay(0);
     if(!v.length)return dalSay('No containers are marked as shipped right now.',{expr:'happy'});
     /* many rows stay "Shipped" after arrival (status not synced) — split them out honestly */
     var ahead=v.filter(function(s){return s.eta&&String(s.eta).slice(0,10)>=today;}),stale=v.filter(function(s){return !s.eta||String(s.eta).slice(0,10)<today;});
     var h=ahead.length?'<b>'+ahead.length+' container'+(ahead.length>1?'s':'')+' on the way</b>, arriving soonest:<br>'+dalList(ahead,function(s){return dalLink(s.container_number)+' — '+dalEsc(s.client||'—')+', ETA '+dalFmtDate(s.eta);}):'No containers with an ETA still ahead.';
     if(stale.length)h+='<br><span class="dal-dim"><b>'+stale.length+'</b> more are still marked “Shipped” but their ETA has passed — their status probably wasn’t updated to Delivered. Oldest: '+stale.slice(0,2).map(function(s){return dalLink(s.container_number)+' (ETA '+dalFmtDate(s.eta)+')';}).join(', ')+'.</span>';
     dalOpSay(h+dalCapNote(r),'vision');});}},
 arriving:{label:'Containers arriving in the next 7 days',run:function(){
   dalSafe(sb.from('shipments').select('container_number,loading_date,client,eta,receiving_country').eq('shipping_status','Shipped').gte('eta',dalDay(0)).lte('eta',dalDay(7)).order('eta',{ascending:true}).limit(1000)).then(function(r){var v=dalVoyages(r);
     if(!v.length)return dalSay('No containers are due to arrive in the next 7 days.',{expr:'neutral'});
     dalOpSay('<b>'+v.length+' container'+(v.length>1?'s':'')+' arriving in the next 7 days:</b><br>'+dalList(v,function(s){return dalLink(s.container_number)+' — '+dalEsc(s.client||'—')+(s.receiving_country?', '+dalEsc(s.receiving_country):'')+', ETA '+dalFmtDate(s.eta);}),'vision');});}},
 loaded_week:{label:'Containers loaded in the last 7 days',run:function(){
   dalSafe(sb.from('shipments').select('container_number,loading_date,client,product_id,pack_house').gte('loading_date',dalDay(-7)).order('loading_date',{ascending:false}).limit(1000)).then(function(r){var v=dalVoyages(r);
     if(!v.length)return dalSay('No containers were loaded in the last 7 days.',{expr:'neutral'});
     dalOpSay('<b>'+v.length+' container'+(v.length>1?'s':'')+' loaded in the last 7 days:</b><br>'+dalList(v,function(s){return dalLink(s.container_number)+' — '+dalEsc(dalCap(s.product_id))+' to '+dalEsc(s.client||'—')+', '+dalFmtDate(s.loading_date)+(s.pack_house?' ('+dalEsc(s.pack_house)+')':'');}),'vision');});}},
 no_cqc:{label:'Delivered but no client QC yet',run:function(){
   Promise.all([dalSafe(sb.from('shipments').select('container_number,loading_date,client').eq('shipping_status','Delivered').gte('loading_date',dalDay(-60)).lte('loading_date',dalDay(-7)).order('loading_date',{ascending:false}).limit(1000)),
     dalSafe(sb.from('client_qc_reports').select('container_number,load_date').gte('created_at',dalDay(-150)).limit(1000))]).then(function(r){
     var have={};r[1].forEach(function(c){have[dalCKey(c.container_number)]=(have[dalCKey(c.container_number)]||[]).concat([c.load_date?String(c.load_date).slice(0,10):'']);});
     var v=dalVoyages(r[0]).filter(function(s){var ds=have[dalCKey(s.container_number)];if(!ds)return true;var ld=new Date(String(s.loading_date).slice(0,10));return !ds.some(function(d){return !d||Math.abs((new Date(d)-ld)/864e5)<=3;});});
     if(!v.length)return dalSay('Every container delivered in the last 60 days has a client QC report.',{expr:'happy'});
     dalOpSay('<b>'+v.length+' delivered container'+(v.length>1?'s have':' has')+' no client QC yet</b> <span class="dal-dim">(loaded 7–60 days ago)</span>:<br>'+dalList(v,function(s){return dalLink(s.container_number)+' — '+dalEsc(s.client||'—')+', loaded '+dalFmtDate(s.loading_date);}),'commercial');});}},
 open_claims:{label:'Containers with open claims',run:function(){
   Promise.all([dalCount(sb.from('crm_claims').select('id',{count:'exact',head:true}).in('status',['open','pending'])),
     dalSafe(sb.from('crm_claims').select('claim_ref,container_number,client,status,claimed_value,claimed_currency,raised_at').in('status',['open','pending']).order('raised_at',{ascending:false}).limit(5))]).then(function(r){
     if(!r[0])return dalSay('No open claims that you can see.',{expr:'happy'});
     dalOpSay('<b>'+r[0]+' open claim'+(r[0]>1?'s':'')+'.</b> Most recent:<br>'+dalList(r[1],function(c){return dalLink(c.container_number)+' — '+dalEsc(c.claim_ref)+', '+dalEsc(c.client||'—')+(c.claimed_value?', '+dalEsc(c.claimed_value)+' '+dalEsc(c.claimed_currency||''):'')+(c.status==='pending'?' <span class="dal-dim">(awaiting approval)</span>':'');}),'commercial');});}},
 returned:{label:'Returned containers',run:function(){
   dalSafe(sb.from('shipments').select('container_number,loading_date,client').eq('shipping_status','Returned').order('loading_date',{ascending:false}).limit(200)).then(function(r){var v=dalVoyages(r);
     if(!v.length)return dalSay('No returned containers.',{expr:'happy'});
     dalOpSay('<b>'+v.length+' returned container'+(v.length>1?'s':'')+':</b><br>'+dalList(v,function(s){return dalLink(s.container_number)+' — '+dalEsc(s.client||'—')+', loaded '+dalFmtDate(s.loading_date);}),'commercial');});}},
 special:{label:'Rejected batches that still shipped (special accept)',run:function(){
   dalSafe(sb.from('inspections').select('id,date,container_number,product_id').eq('status','Special Accept').neq('season_id',DAL_DUMMY_SEASON).order('date',{ascending:false}).limit(50)).then(function(r){
     if(!r.length)return dalSay('No special-accepted batches.',{expr:'neutral'});
     dalOpSay('<b>'+r.length+' batch'+(r.length>1?'es were':' was')+' rejected and then special-accepted by the board:</b><br>'+dalList(r,function(x){return dalLink(x.id)+(x.container_number?' — '+dalLink(x.container_number):'')+', '+dalEsc(dalCap(x.product_id))+', '+dalFmtDate(x.date);}),'vision');});}},
 no_insp:{label:'Containers loaded without an inspection',run:function(){
   /* not linked in Shipments AND no inspection on that container in the 60 days before loading */
   Promise.all([dalSafe(sb.from('shipments').select('container_number,loading_date,client,pack_house').is('matched_inspection_id',null).gte('loading_date',dalDay(-30)).order('loading_date',{ascending:false}).limit(1000)),
     dalSafe(sb.from('inspections').select('container_number,date').neq('season_id',DAL_DUMMY_SEASON).gte('date',dalDay(-100)).not('container_number','is',null).limit(1000))]).then(function(r){
     var have={};r[1].forEach(function(x){var k=dalCKey(x.container_number);(have[k]=have[k]||[]).push(String(x.date).slice(0,10));});
     var v=dalVoyages(r[0]).filter(function(s){var ds=have[dalCKey(s.container_number)];if(!ds)return true;var ld=new Date(String(s.loading_date).slice(0,10));return !ds.some(function(d){var g=(ld-new Date(d))/864e5;return g>=-1&&g<=60;});});
     if(!v.length)return dalSay('Every container loaded in the last 30 days has an inspection.',{expr:'happy'});
     dalOpSay('<b>'+v.length+' container'+(v.length>1?'s':'')+' loaded in the last 30 days with no inspection found</b>'+dalCapNote(r[0])+':<br>'+dalList(v,function(s){return dalLink(s.container_number)+' — '+dalEsc(s.client||'—')+', '+dalFmtDate(s.loading_date)+(s.pack_house?' ('+dalEsc(s.pack_house)+')':'');})+'<br><span class="dal-dim">Checked by container number at the packhouses you can see.</span>','vision');});}},
 cqc_red:{label:'Containers the client scored RED (last 30 days)',run:function(){
   dalSafe(sb.from('client_qc_reports').select('container_number,score,load_date,created_at').ilike('score','red%').is('superseded_by',null).gte('created_at',dalDay(-30)).order('created_at',{ascending:false}).limit(200)).then(function(r){
     if(!r.length)return dalSay('No containers scored RED by a client in the last 30 days.',{expr:'happy'});
     dalOpSay('<b>'+r.length+' container'+(r.length>1?'s':'')+' scored RED in the last 30 days:</b><br>'+dalList(r,function(c){return dalLink(c.container_number)+(c.load_date?' — loaded '+dalFmtDate(c.load_date):'');}),'vision','alert');});}},
 insp_week:{label:'Inspections in the last 7 days',run:function(){
   dalSafe(sb.from('inspections').select('id,date,status,container_number,product_id').neq('season_id',DAL_DUMMY_SEASON).gte('date',dalDay(-7)).order('date',{ascending:false}).limit(500)).then(function(r){
     if(!r.length)return dalSay('No inspections in the last 7 days at the packhouses you can see.',{expr:'neutral'});
     var st={};r.forEach(function(x){st[x.status||'—']=(st[x.status||'—']||0)+1;});
     dalOpSay('<b>'+r.length+' inspection'+(r.length>1?'s':'')+' in the last 7 days</b> ('+Object.keys(st).map(function(k){return st[k]+' '+dalEsc(k);}).join(', ')+'). Latest:<br>'+dalList(r,function(x){return dalLink(x.id)+(x.container_number?' — '+dalLink(x.container_number):'')+', '+dalEsc(x.status||'—')+', '+dalFmtDate(x.date);}),'vision');});}},
 rejected_week:{label:'Rejected batches in the last 7 days',run:function(){
   dalSafe(sb.from('inspections').select('id,date,status,container_number,product_id').in('status',['Rejected','Escalated','Special Reject']).neq('season_id',DAL_DUMMY_SEASON).gte('date',dalDay(-7)).order('date',{ascending:false}).limit(200)).then(function(r){
     if(!r.length)return dalSay('No rejected batches in the last 7 days.',{expr:'happy'});
     dalOpSay('<b>'+r.length+' rejected batch'+(r.length>1?'es':'')+' in the last 7 days:</b><br>'+dalList(r,function(x){return dalLink(x.id)+' — '+dalEsc(dalCap(x.product_id))+', '+dalEsc(x.status)+', '+dalFmtDate(x.date);}),'vision','alert');});}},
 to_country:{label:'Containers to a country (last 12 months)',needs:'country',run:function(arg){
   dalSafe(sb.from('shipments').select('container_number,loading_date,client,product_id,receiving_country').ilike('receiving_country','%'+arg+'%').gte('loading_date',dalDay(-365)).order('loading_date',{ascending:false}).limit(1000)).then(function(r){var v=dalVoyages(r);
     if(!v.length)return dalSay('I found no containers to <b>'+dalEsc(arg)+'</b> in the last 12 months that you can see.',{expr:'puzzled'});
     var cl={};v.forEach(function(s){cl[s.client||'—']=(cl[s.client||'—']||0)+1;});var top=Object.keys(cl).sort(function(a,b){return cl[b]-cl[a];}).slice(0,3);
     dalOpSay('<b>'+v.length+' container'+(v.length>1?'s':'')+' to '+dalEsc(v[0].receiving_country||arg)+'</b> in the last 12 months'+dalCapNote(r)+'. Top clients: '+top.map(function(k){return dalEsc(k)+' ('+cl[k]+')';}).join(', ')+'. Latest:<br>'+dalList(v,function(s){return dalLink(s.container_number)+' — '+dalEsc(s.client||'—')+', '+dalFmtDate(s.loading_date);},3),'vision');});}},
 for_client:{label:'Containers for a client (last 12 months)',needs:'client',run:function(arg){
   dalSafe(sb.from('shipments').select('container_number,loading_date,client,shipping_status,receiving_country').ilike('client','%'+arg+'%').gte('loading_date',dalDay(-365)).order('loading_date',{ascending:false}).limit(1000)).then(function(r){var v=dalVoyages(r);
     if(!v.length)return dalSay('I found no containers for a client matching <b>'+dalEsc(arg)+'</b> in the last 12 months that you can see.',{expr:'puzzled'});
     var st={};v.forEach(function(s){st[s.shipping_status||'—']=(st[s.shipping_status||'—']||0)+1;});
     dalOpSay('<b>'+v.length+' container'+(v.length>1?'s':'')+' for '+dalEsc(v[0].client)+'</b> in the last 12 months ('+Object.keys(st).map(function(k){return st[k]+' '+dalEsc(k.toLowerCase());}).join(', ')+'). Latest:<br>'+dalList(v,function(s){return dalLink(s.container_number)+' — '+dalFmtDate(s.loading_date)+', '+dalEsc(s.shipping_status||'—');},3),'vision');});}},
 /* ── Land Cloud ── */
 no_boundary:{label:'Blocks with no boundary drawn, by farm',run:function(){
   dalSafe(sb.from('farm_blocks').select('farm_code,aydi_block_number').in('lifecycle',['EXP','WIP']).is('geom',null).limit(1000)).then(function(r){
     if(!r.length)return dalSay('Every producing and young block has a boundary.',{expr:'celebrate'});
     var f={};r.forEach(function(b){f[b.farm_code||'—']=(f[b.farm_code||'—']||0)+1;});
     dalOpSay('<b>'+r.length+' producing or young block'+(r.length>1?'s have':' has')+' no boundary:</b><br>'+Object.keys(f).sort(function(a,b){return f[b]-f[a];}).map(function(k){return '• '+dalEsc(dalFarmName(k))+': '+f[k];}).join('<br>'),'landcloud');});}},
 wip:{label:'Young (WIP) blocks by farm',run:function(){
   dalSafe(sb.from('farm_blocks').select('farm_code,product_id,planted_area_fed').eq('lifecycle','WIP').limit(1000)).then(function(r){
     if(!r.length)return dalSay('No young (WIP) blocks.',{expr:'neutral'});
     var f={};r.forEach(function(b){var k=b.farm_code||'—';f[k]=f[k]||{n:0,a:0};f[k].n++;f[k].a+=+b.planted_area_fed||0;});
     dalOpSay('<b>'+r.length+' young (WIP) block'+(r.length>1?'s':'')+':</b><br>'+Object.keys(f).sort(function(a,b){return f[b].n-f[a].n;}).map(function(k){return '• '+dalEsc(dalFarmName(k))+': '+f[k].n+' blocks, '+Math.round(f[k].a)+' fed planted';}).join('<br>'),'landcloud');});}},
 farm:{label:'Farm summary',needs:'farm',run:function(code){
   dalSafe(sb.from('farm_blocks').select('lifecycle,product_id,planted_area_fed,geom_source').eq('farm_code',code).limit(1000)).then(function(r){
     if(!r.length)return dalSay('I can’t see any blocks for '+dalEsc(dalFarmName(code))+'.',{expr:'puzzled'});
     var c={},prods={},area=0,nog=0;r.forEach(function(b){c[b.lifecycle]=(c[b.lifecycle]||0)+1;prods[b.product_id]=1;if(b.lifecycle==='EXP'||b.lifecycle==='WIP'){area+=+b.planted_area_fed||0;if(!b.geom_source)nog++;}});
     dalOpSay('<b>'+dalEsc(dalFarmName(code))+'</b> — '+r.length+' blocks ('+Object.keys(prods).map(dalCap).join(', ')+').<br>Producing (EXP): <b>'+(c.EXP||0)+'</b> · Young (WIP): <b>'+(c.WIP||0)+'</b> · Retired: '+(c.retired||0)+(c.planned?' · Planned: '+c.planned:'')+'.<br>Planted area (EXP + WIP): <b>'+Math.round(area)+' fed</b>.','landcloud');});}},
 block:{label:'Show me a block',needs:'block',run:function(id){
   var q=sb.from('farm_blocks').select('operational_block_id,aydi_block_number,farm_code,product_id,variety_code,rootstock_code,planting_year,lifecycle,planted_area_fed,total_area_fed,last_producing_season,geom_source');
   q=/^\d{2}-\d{2}/.test(id)?q.ilike('aydi_block_number',id):q.ilike('operational_block_id',id);
   dalSafe(q.limit(6)).then(function(r){
     if(!r.length)return dalSay('I couldn’t find block <b>'+dalEsc(id)+'</b> in the farms you can see.',{expr:'puzzled'});
     dalOpSay((r.length>1?'<b>'+r.length+' blocks</b> use '+dalEsc(id)+' — Aydi numbers repeat across farms and crops:<br>':'')+r.map(function(b){return '<b>'+dalEsc(b.aydi_block_number||b.operational_block_id)+'</b> — '+dalEsc(dalFarmName(b.farm_code))+', '+dalEsc(dalCap(b.product_id))+(b.variety_code?' ('+dalEsc(b.variety_code)+(b.rootstock_code?' on '+dalEsc(b.rootstock_code):'')+')':'')+(b.planting_year?', planted '+dalEsc(b.planting_year):'')+'. '+dalEsc(b.lifecycle||'—')+(b.planted_area_fed?', '+dalEsc(b.planted_area_fed)+' fed planted':'')+(b.last_producing_season?', last producing '+dalEsc(b.last_producing_season):'')+'.'+(b.geom_source?'':' <span class="dal-dim">No boundary.</span>');}).join('<br>'),'landcloud');});}}
};
function dalFarmName(code){var m={BD:'Badr',HA:'Hana',KH:'El Khair',NO:'Nour',SA:'Salma',ME:'Menia',LA:'Layla',BA:'ELBaraka'};return m[code]||code||'—';}
/* role → suggested live questions (agronomy = Land Cloud; everyone else = containers) */
var DAL_OPS_SUGGEST={admin:['at_sea','no_cqc','open_claims'],power_user:['at_sea','no_cqc','open_claims'],board:['special','returned','open_claims'],
 qc_manager:['no_insp','cqc_red','no_cqc'],ph_manager:['no_insp','cqc_red','no_cqc'],qc_supervisor:['insp_week','rejected_week','no_insp'],inspector:['insp_week','rejected_week','no_insp'],
 commercial:['arriving','no_cqc','open_claims'],marketing:['arriving','open_claims','loaded_week'],executive:['at_sea','loaded_week','returned'],
 agronomy_admin:['no_boundary','wip','farm:BD'],agronomy_viewer:['farm:NO','wip','no_boundary']};
/* typed questions → operational intents (English, Arabic, Franco). Checked before the help list. */
function dalOpMatch(n,raw){
  var box=/(container|containers|shipment|shipments|كونتينر|كونتينرات|حاويه|حاويات|شحنه|شحنات)/.test(n);
  var m;
  if(/(waiting for me|pending for me|my tasks|to ?do list|what do i have|ايه المطلوب|مستنيني|مطلوب مني)/.test(n))return ['waiting'];
  if(/(no boundar|without (a )?boundar|missing boundar|boundar(y|ies) missing|not drawn|بدون حدود|مفيش حدود)/.test(n))return ['no_boundary'];
  if(/(young|wip|pre ?bearing|not producing yet|تحت الانتاج|صغيره)/.test(n)&&/(block|blocks|بلوك|farm|مزرعه)/.test(n))return ['wip'];
  if((m=raw.match(/\b(\d{2}-\d{2}[a-z]?)\b/i)))return ['block',m[1].toUpperCase()];
  if((m=raw.match(/\b([A-Z]{2}\d{4}[A-Z0-9]{4,10})\b/)))return ['block',m[1]];
  var farm=dalFarmIn(n);if(farm&&!box)return ['farm',farm];
  if(/(at sea|in transit|on the water|sailing|في البحر|في الطريق|بتبحر)/.test(n))return ['at_sea'];
  if(/(arriv|eta|due to arrive|coming in|هيوصل|هتوصل|توصل|وصول|واصله)/.test(n)&&(box||/(week|اسبوع|soon|قريب)/.test(n)))return ['arriving'];
  if(/(no|without|missing|not yet|pending) (client )?(qc|cqc|report)|بدون (تقرير|qc)|مفيش تقرير/.test(n))return ['no_cqc'];
  if(/(open|pending|outstanding|active) claims?|claims? (open|pending)|containers? with claims?|شكاوي مفتوحه|كليمات مفتوحه/.test(n))return ['open_claims'];
  if(/(returned containers?|containers? (were )?returned|which (were )?returned|مرتجع|رجعت)/.test(n)&&!/(redirect|another client|عميل تاني)/.test(n))return ['returned'];
  if(/(special accept|shipped anyway|still shipped|rejected but shipped|اتشحن رغم)/.test(n))return ['special'];
  if(/(without (an )?inspection|no inspection|not inspected|uninspected|بدون فحص|مفيش فحص)/.test(n))return ['no_insp'];
  if(/\b(red|احمر)\b/.test(n)&&(box||/(score|client|scored|عميل|درجه)/.test(n)))return ['cqc_red'];
  var recent=/(this week|last (7|seven) days|recent|latest|الاسبوع|اخر اسبوع|اخر ٧|اخيره)/.test(n);
  if(/(reject|rejection|مرفوض|رفض)/.test(n)&&(recent||/(which|list|show|كام|ايه)/.test(n)))return ['rejected_week'];
  if(/(inspections?|فحص|فحوصات)/.test(n)&&(recent||/^my inspections|فحوصاتي/.test(n))&&!/(new|start|create|جديد|اعمل)/.test(n))return ['insp_week'];
  if(/(loaded|loading|تحميل|اتحمل|شحنا)/.test(n)&&recent)return ['loaded_week'];
  if(box&&(m=n.match(/\b(?:to|going to|ل|الي|علي) ([a-z\u0600-\u06FF][a-z\u0600-\u06FF ]{2,20}?)(?: this| last| in|$)/)))return ['to_country',m[1].trim()];
  if(box&&(m=n.match(/\b(?:for|client|customer|عميل) ([a-z0-9\u0600-\u06FF][a-z0-9\u0600-\u06FF &]{1,24}?)(?: this| last| in|$)/)))return ['for_client',m[1].trim()];
  return null;
}
function dalRunOp(id,arg){var op=DAL_OPS[id];if(!op)return;dalBusy();op.run(arg);}
var DAL_HELLO=/^(hi|hey|hello|hola|salam|salamo|السلام|سلام|اهلا|مرحبا|صباح|مساء|good (morning|afternoon|evening))\b/;
var DAL_THANKS=/\b(thanks|thank you|thx|merci|shokran|شكرا|متشكر|تسلم)\b/;
/* a follow-up only when it's short and points back ("who can do that?", "مين يقدر يعمل ده؟") — not "who signs off on settlements" */
var DAL_WHOQ=/^(who( can)?( do)?( (that|it|this))?|who is allowed|min|meen|مين|مين يقدر( يعمل)?( ده| دي| كده)?)$/;
var DAL_OPENQ=/^(open( it)?|take me( there)?|go|افتح|افتحها|وديني|روح)\b/;
function dalBusy(){dalFace('thinking');dalState.el.querySelector('.dal-msg').innerHTML='<span class="dal-typing"><i></i><i></i><i></i></span>';dalState.el.querySelector('.dal-act').innerHTML='';}
function dalAsk(q){
  var n=dalNorm(q),raw=String(q);
  var m=raw.match(DAL_RX_INSP);if(m){dalBusy();return dalLookupInspection(m[1].toUpperCase()+'-'+m[2]+'-'+('0000'+m[3]).slice(-4));}
  m=raw.match(DAL_RX_BOX);if(m){dalBusy();return dalLookupContainer(m[1].toUpperCase()+' '+m[2],m[1]+'%'+m[2],null);}
  m=raw.match(DAL_RX_SLASH);if(m){dalBusy();return dalLookupContainer(m[1]+'/'+m[2],null,m[1]+'/'+m[2]);}
  if(DAL_HELLO.test(n))return dalSay(dalGreeting()+' Ask me where something is, or paste a container number or inspection ID.',{expr:'happy'});
  if(DAL_THANKS.test(n))return dalSay('Anytime.',{expr:'happy'});
  var last=dalState.last;
  if(last&&DAL_OPENQ.test(n)&&last.app){if(dalCanOpen(last.app))return openProduct(last.app);return dalSay('You don’t have '+dalAppLabel(last.app)+' access yet.',{expr:'neutral'});}
  if(last&&last.type==='help'&&DAL_WHOQ.test(n))return dalSay('<b>Who can:</b> '+dalEsc(DAL_HELP[last.i].w),{expr:'neutral'});
  var op=dalOpMatch(n,raw);if(op)return dalRunOp(op[0],op[1]);
  /* numbers, trends and "why" need real analysis — say so honestly and log it */
  if(DAL_DATAQ.test(n)){dalMiss(q);return dalSay('I can’t count or compare things yet — that’s coming. For now, <b>Inspections Analytics</b> in Vision and the Analytics dashboards show those numbers.',{expr:'puzzled',app:'vision',cta:'Open Vision'});}
  var kw=dalRank(q);
  if(/[\u0600-\u06FF]/.test(raw))return dalDecideKw(q,kw);   /* the meaning model is English-only */
  dalBusy();
  dalSemantic(q).then(function(sem){
    if(sem&&sem.length>1){var a=sem[0],b=sem[1];
      if(a[1]>=0.86&&a[1]-b[1]>=0.02)return dalAnswer(a[0]);
      if(a[1]>=0.82)return dalClarify(a[0],b[0]);}
    dalDecideKw(q,kw);
  });
}
var DAL_DATAQ=/^(how many|how much|how often|count|total|compare|why|what percent|كام|عدد|ليه|قارن|نسبه)\b/;
function dalMiss(q){try{sb.from('dal_misses').insert({question:String(q).slice(0,300),role:dalState.role||null}).then(function(){},function(){});}catch(e){}}
function dalClarify(a,b){return dalSay('Did you mean one of these?',{expr:'thinking',choices:[{label:DAL_HELP[a].q,fn:function(){dalAnswer(a);}},{label:DAL_HELP[b].q,fn:function(){dalAnswer(b);}}]});}
function dalDecideKw(q,hits){
  if(!hits.length){dalMiss(q);return dalSay('I don’t know that one yet — I’ve noted the question so it can be added. Try other words, paste a container number, or ask Tarek or Ramy.',{expr:'puzzled'});}
  if(hits.length>1&&hits[1][0]>=hits[0][0]&&hits[0][0]<6)return dalClarify(hits[0][1],hits[1][1]);
  dalAnswer(hits[0][1]);
}
/* Meaning search (level 1.5): the dal-search edge function fingerprints the question with
   Supabase's built-in gte-small model; this page compares it with dal-vectors.json
   (4–5 example phrasings per help answer). Falls back to word matching on any failure. */
var dalVecP=null;
function dalVectors(){
  if(!dalVecP)dalVecP=fetch('dal-vectors.json',{cache:'force-cache'}).then(function(r){return r.ok?r.json():null;}).then(function(d){
    if(!d||!d.b64)return null;
    /* guard: the file must describe this exact help list */
    var ok=d.qs&&d.qs.length===DAL_HELP.length&&d.qs.every(function(q,i){return dalNorm(q)===dalNorm(DAL_HELP[i].q);});
    if(!ok)return null;
    var raw=atob(d.b64),vecs=[],dim=d.dim||384;
    for(var i=0;i<raw.length;i+=dim){var v=new Float32Array(dim);for(var k=0;k<dim;k++){var c=raw.charCodeAt(i+k);v[k]=(c>127?c-256:c)/d.scale;}vecs.push(v);}
    return {idx:d.idx,vecs:vecs};
  }).catch(function(){return null;});
  return dalVecP;
}
function dalSemantic(q){
  var timeout=new Promise(function(res){setTimeout(function(){res(null);},4500);});
  var work=Promise.all([dalVectors(),sb.functions.invoke('dal-search',{body:{q:String(q).slice(0,300)}})]).then(function(r){
    var V=r[0],e=r[1]&&!r[1].error&&r[1].data&&r[1].data.e;if(!V||!e)return null;
    var best={};V.vecs.forEach(function(v,j){var s=0;for(var k=0;k<v.length;k++)s+=v[k]*e[k];var i=V.idx[j];if(!(i in best)||s>best[i])best[i]=s;});
    return Object.keys(best).map(function(i){return [+i,best[i]];}).sort(function(a,b){return b[1]-a[1];});
  }).catch(function(){return null;});
  return Promise.race([work,timeout]);
}
function dalMin(on){if(on)dalGoHome();dalState.el.classList.toggle('is-min',on);if(on)dalSet('min');var c=dalState.el.querySelector('.dal-char');c.setAttribute('aria-expanded',on?'false':'true');}
function dalBoot(u,animate){
  if(!DAL_ENABLED||!u||DAL_OFF_ROLES[u.role]||dalState.booted)return;
  dalState.booted=true;dalState.u=u;dalState.role=u.role||'';
  var el=document.createElement('div');el.className='dal is-min is-hidden';el.id='dal';
  el.innerHTML='<div class="dal-bubble" role="dialog" aria-label="Dal, the DalOS assistant">'+
    '<div class="dal-head"><div><b>Dal</b><span>DalOS assistant</span></div><button type="button" class="dal-x" aria-label="Hide Dal">×</button></div>'+
    '<div class="dal-msg" aria-live="polite"></div><div class="dal-act"></div>'+
    '<div class="dal-sugg"><span>Try asking</span><div class="dal-sugg-list"></div></div>'+
    '<form class="dal-ask" autocomplete="off"><input type="search" class="dal-in" placeholder="Ask in English or Arabic, or paste a container / inspection ID" aria-label="Ask Dal"><button type="submit" aria-label="Ask">↵</button></form>'+
    '<div class="dal-foot">Dal understands your question, answers from its help list and looks up containers and inspections — only what you can see.</div></div>'+
    '<button type="button" class="dal-char" aria-label="Open Dal, the DalOS assistant" aria-expanded="false"><span class="dal-ground"></span><span class="dal-char-svg"></span><span class="dal-tag">Ask Dal</span></button>';
  document.body.appendChild(el);dalState.el=el;dalFace(dalQuiet()?'sleepy':'neutral');
  el.querySelector('.dal-x').onclick=function(){dalMin(true);};
  el.querySelector('.dal-char').onclick=function(){if(dalState.justDragged)return;var open=el.classList.contains('is-min');dalMin(!open);if(open&&!el.querySelector('.dal-msg').innerHTML)dalSay(dalGreeting()+' What are you looking for?',{expr:'happy',fast:true});};
  el.addEventListener('keydown',function(e){if(e.key==='Escape')dalMin(true);});
  var inp=el.querySelector('.dal-in');inp.addEventListener('input',function(){dalSearch(inp.value);});
  el.querySelector('.dal-ask').onsubmit=function(e){e.preventDefault();var q=inp.value.trim();if(!q)return;inp.value='';dalAsk(q);};
  dalDragInit();
  dalRenderSugg(dalDefaultSugg());
  /* live example: the newest container this user can see (skipped for Land Cloud roles) */
  if(!/^agronomy/.test(dalState.role))dalSafe(sb.from('shipments').select('container_number').order('loading_date',{ascending:false}).limit(1)).then(function(r){if(r.length&&r[0].container_number){dalState.latestBox=dalCKey(r[0].container_number);dalRenderSugg(dalDefaultSugg());}});
  /* containers and IDs inside answers are clickable */
  el.querySelector('.dal-msg').addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.dal-link');if(b)dalAsk(b.getAttribute('data-q'));});
  /* pupils follow the pointer */
  if(!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))document.addEventListener('mousemove',function(ev){if(dalState.lookAt)return;
    [].forEach.call(el.querySelectorAll('.dal-pupil'),function(p){var sv=p.ownerSVGElement,r=sv.getBoundingClientRect();if(!r.width)return;
      var px=r.left+(+p.getAttribute('data-cx'))/160*r.width,py=r.top+(+p.getAttribute('data-cy'))/150*r.height,dx=ev.clientX-px,dy=ev.clientY-py,dd=Math.hypot(dx,dy)||1,mm=Math.min(3.6,dd/40);
      p.setAttribute('transform','translate('+(dx/dd*mm).toFixed(2)+' '+(dy/dd*mm).toFixed(2)+')');});});
  /* nudge counts load in the background; Dal appears once the chooser is on screen */
  var quiet=dalQuiet(),seen=dalGet('seen'),nudgeP=(quiet||seen)?Promise.resolve(null):dalNudges().catch(function(){return null;});
  setTimeout(function(){
    /* entrance: hop up from below the screen edge, land with a squash + ripple, wave, then speak */
    var still=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    dalFace(quiet?'sleepy':'happy');
    el.classList.remove('is-hidden');el.classList.add('is-enter');
    setTimeout(function(){el.classList.remove('is-enter');},1700);
    nudgeP.then(function(n){
      setTimeout(function(){
        if(quiet)return;
        if(n&&!seen){dalSet('seen');dalMin(false);dalSay(n.html,{expr:n.expr,app:n.app,cta:n.cta,act:n.act});}
        else dalFace('neutral');
      },still?0:1500);
    });
  },animate?2600:1200);
}
