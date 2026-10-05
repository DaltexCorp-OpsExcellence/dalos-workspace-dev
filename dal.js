/* Dal — the DalOS assistant (Workspace). v3.
   Loaded before the main script; uses its globals (sb, $, openProduct, requestAnalyticsAccess,
   COMMERCIAL_ROLES, FARM_ROLES) only at call time.
   Principles: every number comes from a live query run with the user's own session (RLS decides
   what Dal can see); no generative AI; Dal speaks first at most once a day and never during quiet
   hours; everything fun can be switched off. Kill switch: DAL_ENABLED. */
var DAL_ENABLED=true;
var DAL_OFF_ROLES={client_qc:1};
var dalState={u:null,role:'',el:null,booted:false,hist:[],qerr:false,lang:'en',clicks:[]};

/* ── time: Cairo for everything (greetings, quiet hours, recaps, holidays) ── */
function dalCairo(){try{var p={};new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hour12:false,weekday:'short'}).formatToParts(new Date()).forEach(function(x){p[x.type]=x.value;});
  return {h:+p.hour%24,ymd:p.year+'-'+p.month+'-'+p.day,wd:p.weekday,m:+p.month};}catch(e){var d=new Date();return {h:d.getHours(),ymd:d.toISOString().slice(0,10),wd:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],m:d.getMonth()+1};}}
function dalQuiet(){var h=dalCairo().h;return h<7||h>=20;}
function dalDay(off){var d=new Date();d.setDate(d.getDate()+(off||0));return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);}

/* ── storage: per user (+ per day). Browser-only conveniences; failures are harmless ── */
function dalUKey(k){return 'dal_'+k+'_'+(dalState.u&&dalState.u.id);}
function dalKey(k){return dalUKey(k)+'_'+dalCairo().ymd;}
function dalGet(k){try{return localStorage.getItem(dalKey(k));}catch(e){return null;}}
function dalSet(k,v){try{localStorage.setItem(dalKey(k),v||'1');}catch(e){}}
function dalPGet(k){try{return localStorage.getItem(dalUKey(k));}catch(e){return null;}}
function dalPSet(k,v){try{if(v==null)localStorage.removeItem(dalUKey(k));else localStorage.setItem(dalUKey(k),v);}catch(e){}}
function dalPref(k){return dalPGet('pref_'+k)==='1';}

/* ── small helpers ── */
function dalEsc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function dalCap(s){s=String(s||'');return s.charAt(0).toUpperCase()+s.slice(1);}
function dalFmtDate(d){if(!d)return '';var x=new Date(d);return isNaN(x)?String(d):x.getDate()+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getMonth()]+' '+x.getFullYear();}
function dalFirst(){return ((dalState.u&&dalState.u.name||'').trim().split(' ')[0])||'';}
function dalAppLabel(a){return {vision:'Vision',analytics:'Analytics',commercial:'Commercial',landcloud:'Land Cloud'}[a]||'';}
function dalCanOpen(a){
  if(a==='vision')return true;
  if(a==='analytics')return $('tileAnalytics')&&$('tileAnalytics').getAttribute('data-state')==='granted';
  if(a==='commercial')return !!COMMERCIAL_ROLES[dalState.role];
  if(a==='landcloud')return !!FARM_ROLES[dalState.role];
  return false;
}
/* query wrappers: an error is remembered so Dal can say "I couldn't reach the data" instead of
   pretending nothing exists */
function dalSafe(p){return p.then(function(r){if(r&&r.error){dalState.qerr=true;return [];}return (r&&r.data)||[];},function(){dalState.qerr=true;return [];});}
function dalCount(q){return q.then(function(r){if(r&&r.error){dalState.qerr=true;return 0;}return (r&&typeof r.count==='number')?r.count:0;},function(){dalState.qerr=true;return 0;});}
function dalMiss(q){try{sb.from('dal_misses').insert({question:String(q).slice(0,300),role:dalState.role||null}).then(function(){},function(){});}catch(e){}}

/* ── voice: varied, warm, brief. English + Egyptian Arabic. Picks never repeat back-to-back ── */
var DAL_VOICE={
 morning:{en:['Good morning{, name}. What are you after?','Morning{, name}. Ask away, or paste a container number.','Good morning{, name}. Where should we start?'],ar:['صباح الخير{ يا name}. بتدور على إيه؟','صباح النور{ يا name}. قولّي محتاج إيه، أو ابعتلي رقم كونتينر.']},
 afternoon:{en:['Good afternoon{, name}. What do you need?','Afternoon{, name}. A container, an inspection, or a how-to?','Hi{ name}. What can I find for you?'],ar:['أهلاً{ يا name}. أقدر أساعد في إيه؟','نهارك سعيد{ يا name}. محتاج إيه؟']},
 evening:{en:['Good evening{, name}. What can I look up?','Evening{, name}. Ask me anything about DalOS.'],ar:['مساء الخير{ يا name}. محتاج حاجة؟','مساء النور{ يا name}. قولّي بتدور على إيه.']},
 late:{en:['Working late{, name}? I’m here.','Quiet hours, but I’m still on shift. What do you need?'],ar:['لسه شغّال{ يا name}؟ أنا موجود.','الوقت متأخر، بس أنا صاحي. محتاج إيه؟']},
 thanks:{en:['Anytime.','Happy to help.','Any time{, name}.','Glad that worked.'],ar:['العفو.','ولا يهمك.','تحت أمرك في أي وقت.']},
 unknown:{en:['I don’t know that one yet. I’ve noted it so it can be added. Try other words, or paste a container number.','That’s outside what I know so far. It’s logged. Rephrase it, or ask Tarek or Ramy.','No answer for that yet. I’ve written it down. Try a shorter question, or a container or inspection ID.'],ar:['لسه معرفش الإجابة دي، بس سجلت السؤال عشان يتضاف. جرّب كلام تاني أو ابعت رقم كونتينر.','دي مش عندي لسه. اتسجلت. ممكن تسأل طارق أو رامي.']},
 did_you_mean:{en:['Did you mean one of these?','Two things fit that. Which one?','Which of these did you mean?'],ar:['قصدك واحدة من دول؟','فيه حاجتين قريبين، أنهي واحدة؟']},
 data_q:{en:['I can’t count or compare yet. For now, <b>Inspections Analytics</b> in Vision and the Analytics dashboards have those numbers.','Numbers and trends need the dashboards for now. Try <b>Inspections Analytics</b> in Vision.'],ar:['لسه مبعرفش أحسب أو أقارن. الأرقام دي في <b>Inspections Analytics</b> وفي داشبوردات Analytics.']},
 error:{en:['I couldn’t reach the data just now — this isn’t a “not found”. Try again in a moment.','The database didn’t answer in time. One more try?'],ar:['مقدرتش أوصل للداتا دلوقتي — ده مش معناه إنها مش موجودة. جرّب تاني كمان شوية.']},
 how_are_you:{en:['Doing well, thanks. What do you need?','All good on my side. You?','Ripe and ready. What can I do for you?'],ar:['الحمد لله تمام. إنت عامل إيه؟','كويس والحمد لله. محتاج حاجة؟']},
 who_are_you:{en:['I’m Dal, the DalOS assistant. I point you to the right place and look up containers, inspections and blocks.','Dal. The name means “the one who points the way” — دالّ. I know where things are in DalOS.'],ar:['أنا دالّ، مساعد DalOS. بدلّك على المكان الصح وبدوّر على الكونتينرات والفحوصات والبلوكات.','اسمي دالّ، يعني اللي بيدلّ على الطريق.']},
 robot:{en:['Software, yes. I don’t make things up: I answer from a help list and live lookups, and if I don’t know, I say so.','Think of me as a very organised signpost with a grape for a face.'],ar:['أيوه برنامج. مبألفش حاجة: بجاوب من قايمة مساعدة وبحث مباشر في الداتا، ولو معرفش بقول.']},
 joke:{en:['I’d tell you a grape joke, but you’d just wine about it.','QC humour: I’d rate that question a firm A — Accept.','Why did the container stay calm? It had a good seal.'],ar:['نكتة؟ أنا شغلتي QC — بفحص النكتة الأول وبعدين أقرر أقبلها ولا أرفضها.']},
 good_job:{en:['Thanks — I’ll pass that on to the cluster.','Appreciated.','Glad it helped. Anything else?'],ar:['تسلم، ده من ذوقك.','شكراً. محتاج حاجة تانية؟']},
 wrong:{en:['Sorry about that — I’ve logged it so it gets fixed. Try rephrasing and I’ll take another look.','Fair, I may have misread you. Noted. What did you mean?'],ar:['معلش، سجلت الغلطة عشان تتصلح. قولها بشكل تاني؟']},
 weekend:{en:['It’s the weekend{, name} — nothing urgent from me.','Weekend mode. I’m here if you need anything.'],ar:['إجازة سعيدة{ يا name}. لو احتجت حاجة أنا هنا.']}
};
var dalLastPick={};
function dalV(key,lang,vars){vars=vars||{};var node=DAL_VOICE[key];if(!node)return '';
  var list=node[lang]||node.en,i=Math.floor(Math.random()*list.length);if(list.length>1&&i===dalLastPick[key])i=(i+1)%list.length;dalLastPick[key]=i;
  if(vars.name===undefined)vars.name=dalFirst();
  return list[i].replace(/\{([^{}]*?)name\}/g,function(_,p){return vars.name?p+dalEsc(vars.name):'';});}
/* short lead-ins, used on about one answer in three, never twice in a row */
var DAL_ACK={help:{en:['Sure.','Here’s how.','Easy one.'],ar:['أكيد.','بص يا سيدي:','سهلة.']},lookup:{en:['Here’s what I found.','Found it.'],ar:['لقيته:','اتفضل:']},list:{en:['Here’s the list.','Pulled these up.'],ar:['دي القايمة:','اتفضل:']}};
function dalAck(kind,lang){if(lang!=='ar'&&(Math.random()>0.34||dalState.ackLast))  {dalState.ackLast=false;return '';}
  var n=DAL_ACK[kind];if(!n)return '';var l=n[lang]||n.en;dalState.ackLast=true;return '<span class="dal-ack">'+l[Math.floor(Math.random()*l.length)]+'</span> ';}
/* Arabic script → Arabic small talk/lead-ins; Franco-Arabic markers too. Help answers stay English (UI labels are English). */
function dalLangOf(raw){if(/[؀-ۿ]/.test(raw))return 'ar';if(/\b(ezay|ezzay|feen|fen|3amel|3ayez|2ool|ana|enta|inta|shokran|ya3ni|keda|7aga|kwayes|tamam)\b/i.test(raw)||/\b\w*[2357]\w*[a-z]\w*\b/i.test(raw)&&/[a-z]/i.test(raw)&&!/\d{3}/.test(raw))return 'ar';return 'en';}
function dalGreeting(lang){var h=dalCairo().h;return dalV(dalQuiet()?'late':h<12?'morning':h<17?'afternoon':'evening',lang||'en');}

/* ── knowledge ── */
/* Facts from DalOS's own data (read-only analysis, 5 Oct 2026; voyages = container + loading date).
   season_months: when the fact is relevant ([] = any time). */
var DAL_FACTS=[
 {t:'DalOS holds about 2,878 container voyages — some 57,800 tonnes shipped since May 2025.',m:[]},
 {t:'The 1,000th container voyage in DalOS loaded on 26 Jan 2026 — a citrus container.',m:[]},
 {t:'The busiest loading day on record: 9 May 2026, with 39 citrus containers.',m:[3,4,5,6]},
 {t:'April 2026 was the record month: 420 containers, just ahead of January’s 418.',m:[1,2,3,4,5]},
 {t:'Citrus 2025/26 shipped 2,000 containers — about 45,800 tonnes.',m:[11,12,1,2,3,4,5,6]},
 {t:'Almost half of citrus tonnage last season was Olinda (Valencia).',m:[11,12,1,2,3,4,5,6]},
 {t:'Russia took the most citrus tonnes last season, but the UK received the most containers (405).',m:[11,12,1,2,3,4,5,6]},
 {t:'Daltex citrus reached New Zealand, Australia, Argentina, Japan and Brazil — Brazil alone took 59 containers.',m:[11,12,1,2,3,4,5,6]},
 {t:'A citrus container carries about 23 tonnes on average; a grapes container about 13.6.',m:[]},
 {t:'Average sea transit: citrus about 19 days, grapes about 13, pomegranate about 12.',m:[]},
 {t:'Grapes 2025/26: 413 containers and about 5,600 tonnes — around 4% up on 2024/25.',m:[5,6,7,8,9]},
 {t:'Flame led grapes in 2025/26: about 2,000 tonnes shipped and 167 inspections.',m:[5,6,7,8,9]},
 {t:'603 of 604 grapes inspections in 2025/26 were accepted.',m:[5,6,7,8,9,10]},
 {t:'A grapes inspection takes about 12 minutes (median).',m:[5,6,7,8]},
 {t:'Grapes inspections in 2025/26 covered 27 varieties.',m:[5,6,7,8,9]},
 {t:'Mango tonnes grew about 77% year on year — from 218 to 385 tonnes.',m:[7,8,9,10]},
 {t:'Keitt is the top mango, both shipped and planted.',m:[7,8,9,10]},
 {t:'Pomegranate “116” is the main pomegranate variety, both shipped and planted.',m:[8,9,10,11]},
 {t:'Citrus is Daltex’s largest orchard crop: about 2,900 feddan producing.',m:[]},
 {t:'The oldest active orchard blocks were planted in 2004.',m:[]},
 {t:'Own-farm grapes exports more than doubled from 2019 to 2025.',m:[]},
 {t:'Citrus season usually loads from November to June, peaking in January and April.',m:[10,11,12]}
];
/* About Daltex — public sources only (daltexcorp.com history/products pages; Daily News Egypt 2021, 2025, 2026). */
var DAL_ABOUT='<b>Daltex</b> is an Egyptian agribusiness founded in <b>1964</b> by Dr. Samir El Naggar. It began as an export trader shipping potatoes to the UK and the Netherlands and grew into a fully integrated group: land reclamation, farming, packing, cold storage and export. Today it grows potatoes, citrus, grapes, pomegranates, mango and more, and exports to markets worldwide. Its line: <i>“Capturing Nature at its finest.”</i>';
var DAL_HISTORY=['The first Daltex packhouse opened in <b>Kafr El Zayat in 1968</b>.','In <b>1994</b> Daltex became the first company in Egypt allowed to import seed potatoes.','In <b>2021</b> Daltex became the first Egyptian exporter to ship oranges to Japan.','Daltex’s Farafra farms run partly on a solar grid built with KarmSolar (expanded in 2025).','In <b>2026</b> Daltex became the exclusive seller of Irritech pivot irrigation in Egypt, Algeria and Libya.'];
var DAL_TIPS=['Paste any container number and I’ll trace every voyage on it.','Ask in Arabic or Franco — “ezay a3mel shakwa” works.','Drag me anywhere on the screen. Double-click me to send me home.','Press <b>/</b> anywhere on this page to ask me something.','Click a container or ID in my answers to look it up.','Ask “what’s waiting for me?” any time — I’ll list everything, not just the daily heads-up.','In Analytics, press ⌘K (Ctrl K) to jump to any dashboard.'];
/* Holidays — dates for Hijri-calendar holidays are approximate (moon sighting); confirm each year. */
var DAL_DAYS=[
 {from:'2026-10-06',to:'2026-10-06',en:'Happy Armed Forces Day.',ar:'كل سنة وانتم طيبين بمناسبة عيد القوات المسلحة.'},
 {from:'2027-01-07',to:'2027-01-07',en:'Merry Christmas to everyone celebrating today.',ar:'عيد ميلاد مجيد.'},
 {from:'2027-02-08',to:'2027-03-09',en:'Ramadan Kareem.',ar:'رمضان كريم.',acc:'crescent'},
 {from:'2027-03-10',to:'2027-03-12',en:'Eid Mubarak.',ar:'عيد مبارك، كل سنة وانتم طيبين.',acc:'lantern'},
 {from:'2027-05-03',to:'2027-05-03',en:'Happy Sham El-Nessim.',ar:'شم نسيم سعيد.'},
 {from:'2027-05-16',to:'2027-05-19',en:'Eid Mubarak.',ar:'عيد أضحى مبارك.',acc:'lantern'}
];
function dalHoliday(){var d=dalCairo().ymd;for(var i=0;i<DAL_DAYS.length;i++)if(d>=DAL_DAYS[i].from&&d<=DAL_DAYS[i].to)return DAL_DAYS[i];return null;}
function dalDayIndex(){return Math.floor(Date.now()/864e5);}
function dalFactOfDay(){var m=dalCairo().m,pool=DAL_FACTS.filter(function(f){return !f.m.length||f.m.indexOf(m)>=0;});return pool[dalDayIndex()%pool.length].t;}
/* ── character rig: drawn once; only face, arms, mouth and extras swap, so breathing, the leaf
   sway, blinks and pupil tracking never restart. ── */
var DAL_INK='#10160f',DAL_D='#2e6446',DAL_M='#74c795',DAL_LID='#6cbb8c',DAL_CH='#f39a8b';
function dalRigSvg(){
  var FR=[[70,50,15],[92,50,15],[57,74,16],[80,72,16.5],[103,74,16],[68,98,15],[92,98,15],[80,120,13]],BK=[[60,40,12],[102,40,12],[46,92,12],[114,92,12],[80,108,13]];
  var SHINE={'70,50':.5,'57,74':.5,'80,72':.45};
  var b='<g class="dal-berries">';BK.forEach(function(c){b+='<circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+c[2]+'" fill="#1f4a33"/>';});
  FR.forEach(function(c){var hx=c[0]-c[2]*.38,hy=c[1]-c[2]*.42,o=SHINE[c[0]+','+c[1]]||.16;
    b+='<g class="dal-berry" style="--bd:'+Math.round((c[1]-50)*4)+'ms"><circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+c[2]+'" fill="url(#dalg)"/><circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+(c[2]-.6)+'" fill="none" stroke="'+DAL_D+'" stroke-width="1.1" opacity=".3"/><ellipse cx="'+hx+'" cy="'+hy+'" rx="'+(c[2]*.26)+'" ry="'+(c[2]*.16)+'" transform="rotate(-30 '+hx+' '+hy+')" fill="#fff" opacity="'+o+'"/></g>';});
  b+='</g>';
  return '<svg class="dal-svg" viewBox="0 0 160 150" aria-hidden="true"><defs><radialGradient id="dalg" cx="34%" cy="28%" r="78%"><stop offset="0" stop-color="#d6f7df"/><stop offset=".55" stop-color="'+DAL_M+'"/><stop offset="1" stop-color="'+DAL_D+'"/></radialGradient></defs>'+
   '<g class="dal-body">'+
   '<path d="M79 30 C68 24 60 30 64 36 C67 40 72 36 69 33" stroke="#4f8a5e" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M80 38 C80 30 82 24 86 18" stroke="#3d6b4a" stroke-width="4" fill="none" stroke-linecap="round"/>'+
   '<g class="dal-leaf"><path d="M86 20 C92 8 108 4 122 10 C118 14 120 18 126 20 C116 26 110 22 108 26 C100 30 92 28 86 20Z" fill="#8fe0ad"/><path d="M86 20 C98 16 110 14 122 12 M100 17 L104 24 M110 15 L114 21" stroke="#4f8a5e" stroke-width="1.4" fill="none" stroke-linecap="round"/><g class="dal-acc"></g></g>'+
   b+'<g class="dal-arms"></g><g class="dal-face"></g><g class="dal-mouth"></g></g><g class="dal-extra"></g></svg>';
}
function dalEyes(o){o=o||{};var r=o.r||9.5,pr=o.pr||4.2,dx=o.dx||0,dy=o.dy||0,lid=o.lid||[0,0];
  return [[70,70],[92,70]].map(function(c,i){var rr=(o.rs&&o.rs[i])||r,L=rr+1;
    return '<circle cx="'+c[0]+'" cy="'+c[1]+'" r="'+rr+'" fill="#fff"/><g class="dal-pupil" style="transform:translate('+((dalState.pupil&&dalState.pupil.x)||0).toFixed(2)+'px,'+((dalState.pupil&&dalState.pupil.y)||0).toFixed(2)+'px)"><circle cx="'+(c[0]+dx)+'" cy="'+(c[1]+dy)+'" r="'+pr+'" fill="'+DAL_INK+'"/><circle cx="'+(c[0]+dx+1.6)+'" cy="'+(c[1]+dy-1.7)+'" r="1.4" fill="#fff"/></g>'+
      /* eyelid: skin-coloured cap with a lash line, closes from the top */
      '<g class="dal-lid" data-base="'+lid[i]+'" style="transform:scaleY('+lid[i]+')"><path d="M'+(c[0]-L)+' '+(c[1]-L)+' H'+(c[0]+L)+' V'+c[1]+' A'+L+' '+L+' 0 0 1 '+(c[0]-L)+' '+c[1]+' Z" fill="'+DAL_LID+'"/><path d="M'+(c[0]-L+1)+' '+(c[1]+L-1.5)+' Q'+c[0]+' '+(c[1]+L+1.5)+' '+(c[0]+L-1)+' '+(c[1]+L-1.5)+'" stroke="'+DAL_INK+'" stroke-width="2" fill="none" stroke-linecap="round"/></g>';}).join('');}
function dalBrows(a,c){return '<path d="'+a+'" stroke="'+DAL_INK+'" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="'+c+'" stroke="'+DAL_INK+'" stroke-width="2.6" fill="none" stroke-linecap="round"/>';}
function dalHappyEyes(){return '<path d="M62 72 Q70 61 78 72" stroke="'+DAL_INK+'" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M84 72 Q92 61 100 72" stroke="'+DAL_INK+'" stroke-width="3.4" fill="none" stroke-linecap="round"/>';}
function dalCheeks(){return '<ellipse cx="59" cy="84" rx="5.5" ry="3.2" fill="'+DAL_CH+'" opacity=".6"/><ellipse cx="103" cy="84" rx="5.5" ry="3.2" fill="'+DAL_CH+'" opacity=".6"/>';}
function dalArm(p){var d=DAL_D,m=DAL_M,rest='<path d="M114 90 C122 94 124 102 120 108 C117 112 112 110 114 106" stroke="'+d+'" stroke-width="3.4" fill="none" stroke-linecap="round"/>';
  if(p==='point')return '<g class="dal-arm-point"><path d="M48 84 C34 82 24 72 18 60" stroke="'+d+'" stroke-width="4.2" fill="none" stroke-linecap="round"/><circle cx="16" cy="58" r="4.6" fill="'+m+'" stroke="'+d+'" stroke-width="1.4"/></g>'+rest;
  if(p==='down')return '<g class="dal-arm-point"><path d="M48 92 C36 100 30 112 30 124" stroke="'+d+'" stroke-width="4.2" fill="none" stroke-linecap="round"/><circle cx="30" cy="127" r="4.6" fill="'+m+'" stroke="'+d+'" stroke-width="1.4"/></g>'+rest;
  if(p==='wave')return '<g class="dal-arm-wave"><path d="M48 82 C38 78 32 66 34 54" stroke="'+d+'" stroke-width="4.2" fill="none" stroke-linecap="round"/><circle cx="34" cy="51" r="4.6" fill="'+m+'" stroke="'+d+'" stroke-width="1.4"/></g>'+rest;
  if(p==='up')return '<g class="dal-arm-wave"><path d="M48 80 C36 72 32 58 36 46" stroke="'+d+'" stroke-width="4.2" fill="none" stroke-linecap="round"/><circle cx="37" cy="43" r="4.6" fill="'+m+'" stroke="'+d+'" stroke-width="1.4"/></g>'+rest;
  if(p==='both')return '<g class="dal-arm-wave"><path d="M48 80 C36 72 32 58 36 46" stroke="'+d+'" stroke-width="4.2" fill="none" stroke-linecap="round"/><circle cx="37" cy="43" r="4.6" fill="'+m+'" stroke="'+d+'" stroke-width="1.4"/></g><g class="dal-arm-wave2"><path d="M112 80 C124 72 128 58 124 46" stroke="'+d+'" stroke-width="4.2" fill="none" stroke-linecap="round"/><circle cx="123" cy="43" r="4.6" fill="'+m+'" stroke="'+d+'" stroke-width="1.4"/></g>';
  if(p==='chin')return '<path d="M50 96 C44 100 50 106 60 98" stroke="'+d+'" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="62" cy="96" r="4.2" fill="'+m+'" stroke="'+d+'" stroke-width="1.4"/>'+rest;
  return '<path d="M46 90 C38 94 36 102 40 108 C43 112 48 110 46 106" stroke="'+d+'" stroke-width="3.4" fill="none" stroke-linecap="round"/>'+rest;}
var DAL_MOUTH={smile:'<path d="M72 88 Q81 95 90 88" stroke="'+DAL_INK+'" stroke-width="3" fill="none" stroke-linecap="round"/>',
 soft:'<path d="M72 87 Q80 94 90 86" stroke="'+DAL_INK+'" stroke-width="3" fill="none" stroke-linecap="round"/>',
 open:'<path d="M70 86 Q81 101 92 86 Z" fill="'+DAL_INK+'"/><path d="M75 92 Q81 97 87 92" fill="'+DAL_CH+'"/>',
 big:'<path d="M68 85 Q81 105 94 85 Z" fill="'+DAL_INK+'"/><path d="M74 93 Q81 99 88 93" fill="'+DAL_CH+'"/>',
 flat:'<path d="M74 90 L88 88" stroke="'+DAL_INK+'" stroke-width="3" stroke-linecap="round"/>',
 o:'<ellipse cx="81" cy="90" rx="4.5" ry="5.5" fill="'+DAL_INK+'"/>',
 tiny:'<ellipse cx="81" cy="90" rx="3.2" ry="2.4" fill="'+DAL_INK+'"/>',
 wavy:'<path d="M72 90 q4 -4 8 0 t8 0" stroke="'+DAL_INK+'" stroke-width="3" fill="none" stroke-linecap="round"/>',
 yawn:'<ellipse cx="81" cy="91" rx="5" ry="7" fill="'+DAL_INK+'"/>',
 t1:'<path d="M73 87 Q81 96 89 87 Q81 91 73 87Z" fill="'+DAL_INK+'"/>',
 t2:'<ellipse cx="81" cy="90" rx="5" ry="4.5" fill="'+DAL_INK+'"/>'};
/* expression → parts */
function dalExpr(e){
  switch(e){
   case 'happy':return {arm:'wave',face:dalHappyEyes()+dalCheeks(),mouth:'open'};
   case 'celebrate':return {arm:'both',face:dalHappyEyes()+dalCheeks(),mouth:'big'};
   case 'alert':return {arm:'up',face:dalEyes({r:10.5,pr:3.8})+dalBrows('M60 55 Q69 49 78 54','M84 54 Q93 49 102 55'),mouth:'o',extra:'<g class="dal-bang"><circle cx="130" cy="30" r="13" fill="#e0bd7a"/><rect x="128" y="21" width="4" height="11" rx="2" fill="'+DAL_INK+'"/><circle cx="130" cy="37" r="2.3" fill="'+DAL_INK+'"/></g>'};
   case 'pointup':return {arm:'up',face:dalEyes({dx:0,dy:-3.6})+dalBrows('M61 57 Q69 52 77 55','M85 55 Q93 52 101 57'),mouth:'soft'};
   case 'pointdown':return {arm:'down',face:dalEyes({dx:-2,dy:3})+dalBrows('M61 58 Q69 55 77 57','M85 57 Q93 55 101 58'),mouth:'soft'};
   case 'pointing':return {arm:'point',face:dalEyes({dx:-3,dy:-2.5})+dalBrows('M61 57 Q69 53 77 56','M85 56 Q93 53 101 57'),mouth:'soft'};
   case 'thinking':return {arm:'chin',face:dalEyes({dx:2.8,dy:-3.4,lid:[.25,0]})+dalBrows('M62 58 Q70 56 78 58','M84 55 Q93 49 101 54'),mouth:'flat'};
   case 'sleepy':return {arm:'rest',face:'<path d="M61 71 Q70 76 79 71" stroke="'+DAL_INK+'" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M83 71 Q92 76 101 71" stroke="'+DAL_INK+'" stroke-width="3" fill="none" stroke-linecap="round"/>',mouth:'tiny',extra:'<g class="dal-z" fill="#bcd6c4" font-family="DM Serif Display,Georgia,serif"><text x="118" y="46" font-size="17">z</text><text x="132" y="30" font-size="23">z</text></g>'};
   case 'puzzled':return {arm:'chin',face:dalEyes({rs:[8.5,11],pr:4})+dalBrows('M60 57 L78 60','M84 53 Q93 48 102 54'),mouth:'wavy',extra:'<text class="dal-q" x="122" y="44" font-size="32" fill="#e0bd7a" font-family="DM Serif Display,Georgia,serif">?</text>'};
   case 'dizzy':return {arm:'rest',face:'<path d="M64 66 L76 76 M76 66 L64 76 M86 66 L98 76 M98 66 L86 76" stroke="'+DAL_INK+'" stroke-width="3" stroke-linecap="round"/>',mouth:'wavy'};
   case 'bow':return {arm:'wave',face:dalHappyEyes(),mouth:'smile'};
   default:return {arm:'rest',face:dalEyes(),mouth:'smile'};
  }
}
function dalRigInit(host){host.innerHTML=dalRigSvg();dalState.svg=host.querySelector('svg');dalState.expr='';}
function dalFace(e){var s=dalState.svg;if(!s)return;if(e===dalState.expr)return;dalState.expr=e;var p=dalExpr(e);
  var f=s.querySelector('.dal-face');f.style.opacity='0';
  s.querySelector('.dal-arms').innerHTML=dalArm(p.arm);f.innerHTML=p.face;s.querySelector('.dal-mouth').innerHTML=DAL_MOUTH[p.mouth]||'';s.querySelector('.dal-extra').innerHTML=p.extra||'';
  dalState.mouth=p.mouth;requestAnimationFrame(function(){f.style.opacity='';});
  if(e==='celebrate')dalSparks();if(e==='bow'&&!dalStill())dalState.svg.animate([{transform:'rotate(0)'},{transform:'rotate(-14deg)',offset:.4},{transform:'rotate(-14deg)',offset:.7},{transform:'rotate(0)'}],{duration:1100,easing:'ease-in-out'});}
function dalAccessory(kind){var a=dalState.svg&&dalState.svg.querySelector('.dal-acc');if(!a)return;
  a.innerHTML=kind==='crescent'?'<path d="M121 9 a7 7 0 1 0 6 11 a5.5 5.5 0 1 1 -6 -11Z" fill="#e0bd7a"/>':kind==='lantern'?'<g class="dal-lantern"><line x1="123" y1="16" x2="123" y2="22" stroke="#caa86a" stroke-width="1.2"/><path d="M119 22 h8 l2 4 v7 l-2 3 h-8 l-2 -3 v-7 Z" fill="#e0bd7a"/><rect x="120.5" y="26" width="5" height="7" rx="1.5" fill="#fff6d8" opacity=".85"/></g>':'';}
/* talking mouth while an answer appears */
function dalTalk(ms){if(dalStill())return;clearInterval(dalState.talkT);var m=dalState.svg&&dalState.svg.querySelector('.dal-mouth');if(!m)return;var end=Date.now()+ms,seq=['t1','t2','smile','t1','t2'],i=0,keep=dalState.mouth;
  dalState.talkT=setInterval(function(){if(Date.now()>end){clearInterval(dalState.talkT);m.innerHTML=DAL_MOUTH[keep]||'';return;}m.innerHTML=DAL_MOUTH[seq[i++%seq.length]];},95+Math.random()*40);}
/* natural blink: random gaps, sometimes a double blink, second eye a hair later */
function dalBlinkLoop(){clearTimeout(dalState.blinkT);dalState.blinkT=setTimeout(function(){if(!dalStill()){var lids=dalState.svg?dalState.svg.querySelectorAll('.dal-lid'):[];var twice=Math.random()<.18;
  [].forEach.call(lids,function(l,i){var b=+l.getAttribute('data-base')||0;function once(delay){l.animate([{transform:'scaleY('+b+')'},{transform:'scaleY(1)',offset:.36},{transform:'scaleY('+b+')'}],{duration:170,delay:delay+i*12,easing:'ease-in-out'});}once(0);if(twice)once(330);});}
  dalBlinkLoop();},2600+Math.random()*3800);}
/* pupils glide toward a target (CSS transition on the pupil transform) */
function dalLook(x,y){dalState.pupil={x:x,y:y};if(!dalState.svg)return;[].forEach.call(dalState.svg.querySelectorAll('.dal-pupil'),function(p){p.style.transform='translate('+x.toFixed(2)+'px,'+y.toFixed(2)+'px)';});}
function dalLookAtEl(el2){if(!el2||!dalState.svg)return;var r=dalState.svg.getBoundingClientRect(),t=el2.getBoundingClientRect(),dx=t.left+t.width/2-(r.left+r.width/2),dy=t.top+t.height/2-(r.top+r.height*.47),d=Math.hypot(dx,dy)||1;dalLook(dx/d*3.4,dy/d*3.4);}
function dalSparks(){if(dalStill()||!dalState.el)return;var ch=dalState.el.querySelector('.dal-char');
  for(var i=0;i<9;i++){(function(i){var s=document.createElement('span');s.className='dal-spark'+(i%3?'':' is-gold');ch.appendChild(s);var ang=-Math.PI*(.15+.7*Math.random()),dist=34+Math.random()*30;
    var a=s.animate([{transform:'translate(0,0) scale(.4)',opacity:1},{transform:'translate('+(Math.cos(ang)*dist)+'px,'+(Math.sin(ang)*dist)+'px) scale(1)',opacity:0}],{duration:650+Math.random()*250,easing:'cubic-bezier(.15,.7,.3,1)'});a.onfinish=function(){s.remove();};})(i);}}
function dalJiggle(){if(dalStill()||!dalState.svg)return;[].forEach.call(dalState.svg.querySelectorAll('.dal-berry'),function(g){var d=parseFloat(g.style.getPropertyValue('--bd'))||0;g.animate([{transform:'translateY(0)'},{transform:'translateY(-1.8px)',offset:.3},{transform:'translateY(.7px)',offset:.6},{transform:'translateY(0)'}],{duration:420,delay:d,easing:'ease-out'});});}
/* idle life: glance, weight shift, leaf flick; yawn after a long idle, nod off after five minutes */
function dalIdleLoop(){clearTimeout(dalState.idleT);dalState.idleT=setTimeout(function(){var el=dalState.el;
  if(el&&!dalStill()&&!dalState.raf&&!dalState.dragging&&!el.classList.contains('is-typing')&&!document.hidden){
   var idle=Date.now()-(dalState.lastInput||Date.now()),s=dalState.svg;
   if(idle>300000&&!dalQuiet()&&dalState.expr!=='sleepy'&&el.classList.contains('is-min')){dalState.dozing=true;dalFace('sleepy');}
   else if(idle>90000&&!dalState.dozing){var m=s.querySelector('.dal-mouth'),keep=dalState.mouth;m.innerHTML=DAL_MOUTH.yawn;[].forEach.call(s.querySelectorAll('.dal-lid'),function(l){l.animate([{transform:'scaleY(0)'},{transform:'scaleY(.6)',offset:.3},{transform:'scaleY(.6)',offset:.8},{transform:'scaleY(0)'}],{duration:1300});});s.querySelector('.dal-body').animate([{transform:'scale(1,1)'},{transform:'scale(.98,1.04)',offset:.4},{transform:'scale(1,1)'}],{duration:1300});setTimeout(function(){m.innerHTML=DAL_MOUTH[keep]||'';},1250);}
   else{var r=Math.random();
    if(r<.45){var tiles=document.querySelectorAll('.app-card');if(tiles.length){dalLookAtEl(tiles[Math.floor(Math.random()*tiles.length)]);setTimeout(function(){dalLook(0,0);},1000);}}
    else if(r<.75){s.querySelector('.dal-body').animate([{transform:'rotate(0)'},{transform:'rotate('+(Math.random()<.5?-2.5:2.5)+'deg)',offset:.3},{transform:'rotate(0)',offset:1}],{duration:2200,easing:'ease-in-out'});}
    else{s.querySelector('.dal-leaf').animate([{transform:'rotate(0)'},{transform:'rotate(-18deg)',offset:.15},{transform:'rotate(6deg)',offset:.45},{transform:'rotate(-2deg)',offset:.7},{transform:'rotate(0)'}],{duration:900,easing:'ease-out'});}}}
  dalIdleLoop();},7000+Math.random()*7000);}
function dalWake(){dalState.lastInput=Date.now();if(dalState.dozing){dalState.dozing=false;dalFace('neutral');if(!dalStill()&&dalState.svg)dalState.svg.animate([{transform:'scale(1,1)'},{transform:'scale(1.04,.94)',offset:.3},{transform:'scale(.98,1.03)',offset:.65},{transform:'scale(1,1)'}],{duration:360});}}

/* ── movement: walk to the answer, point, hop home ── */
var DAL_TILE={vision:'tileVision',analytics:'tileAnalytics',commercial:'tileCommercial',landcloud:'tileLandCloud'};
function dalStill(){return (window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)||window.innerWidth<760;}
function dalGlow(tile,on){if(tile){tile.classList.toggle('dal-target',!!on);if(on){clearTimeout(tile._dalGlowT);tile._dalGlowT=setTimeout(function(){tile.classList.add('dal-target-still');},2300);}else tile.classList.remove('dal-target-still');}}
function dalPointTo(app){
  var tile=$(DAL_TILE[app]);if(!tile||!dalState.el||dalState.dragging)return;
  clearTimeout(dalState.homeT);[].forEach.call(document.querySelectorAll('.dal-target'),function(x){if(x!==tile)dalGlow(x,false);});
  dalGlow(tile,true);dalState.homeT=setTimeout(function(){dalGoHome();},4800);
  if(dalStill()||dalState.el.classList.contains('is-min'))return;
  var ch=dalState.el.querySelector('.dal-char'),c=ch.getBoundingClientRect(),t=tile.getBoundingClientRect(),o=dalState.off||{x:0,y:0};
  var homeL=c.left-o.x,homeT=c.top-o.y,lx=t.left+t.width*0.62-c.width/2,ly=t.bottom+8,below=ly+c.height<=window.innerHeight-56;if(!below)ly=t.top-c.height-8;
  dalState.away={tile:tile};
  dalTravel(Math.round(lx-homeL),Math.round(ly-homeT),function(){dalFace(below?'pointup':'pointdown');dalState.lookAt=null;dalLookAtEl(tile);});
}
function dalGoHome(instant){
  clearTimeout(dalState.homeT);[].forEach.call(document.querySelectorAll('.dal-target'),function(x){dalGlow(x,false);});
  if(!dalState.el)return;var was=dalState.away;dalState.away=null;
  if(instant||dalStill()){cancelAnimationFrame(dalState.raf);dalState.raf=0;dalState.off={x:0,y:0};dalState.lookAt=null;dalState.el.classList.remove('is-moving');dalSetPose({x:0,y:0});return;}
  if(!was&&!dalState.raf)return;
  dalTravel(0,0,function(){dalState.lookAt=null;dalLook(0,0);var m=dalState.el.querySelector('.dal-msg');if(!m.querySelector('.dal-typing'))dalFace('neutral');});
}
function dalSetPose(o){
  var ch=dalState.el.querySelector('.dal-char'),sv=ch.querySelector('.dal-char-svg'),g=ch.querySelector('.dal-ground');
  ch.style.transform=(o.x||o.y)?'translate('+o.x.toFixed(1)+'px,'+o.y.toFixed(1)+'px)':'';
  sv.style.transform=(o.sx&&o.sx!==1||o.sy&&o.sy!==1||o.rot)?'rotate('+(o.rot||0).toFixed(2)+'deg) scale('+(o.sx||1).toFixed(3)+','+(o.sy||1).toFixed(3)+')':'';
  if(g){var l=o.lift||0;g.style.transform=l?'translateY('+l.toFixed(1)+'px) scale('+Math.max(.4,1-l/130).toFixed(3)+')':'';g.style.opacity=l?Math.max(.2,1-l/150).toFixed(2):'';}
  var leaf=sv.querySelector('.dal-leaf');if(leaf)leaf.style.transform=o.leaf?'rotate('+o.leaf.toFixed(1)+'deg)':'';
  if(dalState.lookAt)dalLook(dalState.lookAt.x*3.4,dalState.lookAt.y*3.4);
}
function dalPuff(){var ch=dalState.el.querySelector('.dal-char');
  for(var i=0;i<7;i++){(function(i){var s=document.createElement('span');s.className='dal-dust';ch.appendChild(s);var side=i%2?1:-1,dx=side*(10+Math.random()*26),dy=-(3+Math.random()*10),sc=.6+Math.random()*.8;
    var a=s.animate([{transform:'translate(0,0) scale(.3)',opacity:.7},{transform:'translate('+dx+'px,'+dy+'px) scale('+sc+')',opacity:0}],{duration:420+Math.random()*180,easing:'cubic-bezier(.2,.7,.3,1)'});a.onfinish=function(){s.remove();};})(i);}
  dalJiggle();}
/* ballistic hops: near-linear horizontal motion under a gravity parabola; impact squash starts on
   touch-down; every channel is smoothed so phases never snap */
function dalTravel(tx,ty,done){
  var el=dalState.el;cancelAnimationFrame(dalState.raf);
  var o=dalState.off||{x:0,y:0},sx=o.x,sy=o.y,dx=tx-sx,dy=ty-sy,dist=Math.hypot(dx,dy);
  if(dist<2){dalState.off={x:tx,y:ty};dalSetPose({x:tx,y:ty});done&&done();return;}
  el.classList.add('is-moving');
  var hops=Math.max(1,Math.min(4,Math.round(dist/300))),dir=dx>=0?1:-1,seg=dist/hops;
  var CROUCH=160,HOP=Math.min(540,330+seg*0.3),GAP=90,SETTLE=560,AIR=hops*HOP+(hops-1)*GAP;
  var H=Math.min(95,30+seg*0.2),UP=dy<0?Math.min(50,-dy/hops*0.35):0;
  dalState.lookAt={x:dx/dist,y:dy/dist};dalFace('neutral');
  var t0=performance.now(),last=t0,landed=0,prev={sx:1,sy:1,rot:0,leaf:0};
  function frame(now){
    var t=now-t0,dt=now-last;last=now;var p={x:sx,y:sy,sx:1,sy:1,rot:0,lift:0,leaf:0};
    if(t<CROUCH){var c=Math.sin(t/CROUCH*Math.PI/2);p.sy=1-.15*c;p.sx=1+.11*c;p.rot=dir*5*c;p.leaf=dir*6*c;}
    else if(t<CROUCH+AIR){
      var u=t-CROUCH,i=Math.min(hops-1,Math.floor(u/(HOP+GAP))),v=u-i*(HOP+GAP),a=i/hops,b=(i+1)/hops;
      if(v>HOP){if(landed<=i){landed=i+1;dalPuff();}var w=(v-HOP)/GAP,k=Math.sin(w*Math.PI);p.x=sx+dx*b;p.y=sy+dy*b;p.sy=1-.18*k;p.sx=1+.13*k;p.rot=dir*(5-3*w);p.leaf=dir*(6-14*w);}
      else{var s=v/HOP,e=s*0.85+0.15*(s<.5?2*s*s:1-Math.pow(-2*s+2,2)/2),h=H+UP,lift=h*4*s*(1-s);
        p.x=sx+dx*(a+(b-a)*e);p.y=sy+dy*(a+(b-a)*e)-lift;p.lift=lift;var vel=1-2*s;
        p.sy=1+.12*Math.abs(vel);p.sx=1-.08*Math.abs(vel);p.rot=dir*(6*vel*vel+2);p.leaf=-dir*14*vel;}
    }else{if(landed<hops){landed=hops;dalPuff();}
      var w2=t-CROUCH-AIR,k2=w2/1000,osc=Math.exp(-k2/0.11)*Math.cos(2*Math.PI*k2/0.26);
      p.x=tx;p.y=ty;p.sy=1-.17*osc;p.sx=1+.12*osc;p.rot=dir*3*osc;p.leaf=-dir*16*osc;
      if(w2>=SETTLE){dalState.off={x:tx,y:ty};dalSetPose({x:tx,y:ty});el.classList.remove('is-moving');dalState.raf=0;done&&done();return;}}
    var f=Math.min(1,dt/40);['sx','sy','rot','leaf'].forEach(function(k){p[k]=prev[k]+(p[k]-prev[k])*f;prev[k]=p[k];});
    dalState.off={x:p.x,y:p.y};dalSetPose(p);dalState.raf=requestAnimationFrame(frame);
  }
  dalState.raf=requestAnimationFrame(frame);
}
/* a little hop in place (nudge arriving, easter eggs) */
function dalHopInPlace(n){if(dalStill()||!dalState.el)return;var ch=dalState.el.querySelector('.dal-char'),k=[];for(var i=0;i<n;i++){k.push({transform:'translateY(0) scale(1.06,.92)',offset:i/n});k.push({transform:'translateY(-14px) scale(.96,1.05)',offset:(i+.45)/n});}k.push({transform:'translateY(0) scale(1,1)'});ch.animate(k,{duration:280*n,easing:'ease-out'});}
/* Help catalog — researched from the staging code of every app (Sep 2026). app = which tile opens it. */
var DAL_HELP=[
 {app:'vision',q:'How do I start a new inspection?',a:'Open Export Inspection, pick the product, then + New inspection. The button only appears while you’re viewing the active season.',k:'inspection new create start add'},
 {app:'vision',q:'How does accepting or rejecting a batch work?',a:'The inspector sets A — Accept or R — Reject in the Decision card of the form. A rejected batch can be sent up with Escalate to board; the board decides in Escalation Review.',k:'accept reject decision escalate board approve'},
 {app:'vision',q:'How do I switch season?',a:'Use the Season dropdown at the top of the Vision sidebar. The active season is tagged “— Active”.',k:'season switch change year'},
 {app:'vision',q:'How do I add a client QC report?',a:'Open Client QC, pick the product, then + New client report. Upload the client’s PDF or photos and the fields fill in for you. Emailed reports also wait in the Intake panel.',k:'client qc cqc report upload intake'},
 {app:'vision',q:'A client changed their score — how do I record it?',a:'Open the client QC report and use ↑ Upgrade or ↓ Downgrade, then Record. Revised reports show under the Revised filter.',k:'score upgrade downgrade revise cqc'},
 {app:'vision',q:'Where do I find a container?',a:'In Vision, open Shipments, pick the product and search by container, client or variety. Export Inspection also searches by LOT or container.',k:'container find search shipment lot'},
 {app:'vision',q:'Can I export inspection data?',a:'Yes: Export CSV in Inspections Analytics, and Client PDF / Internal PDF on a saved inspection. There’s no Excel export in Vision.',k:'export csv pdf download excel'},
 {app:'commercial',q:'How do I raise a claim?',a:'In DalOS Commercial, click Raise claim on a container row or in its drawer. Choose Whole container or Part of load, add the value and save — evidence upload unlocks after the first save.',k:'claim raise complaint complained rotten damaged shakwa shakawa شكوي شكوه عفنه عفن تالف'},
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
/* ── Dal understanding (level 1 — in the browser, no AI) ──
   Normalises English / Arabic / Franco-Arabic, maps words to topics, forgives typos,
   spots container numbers and inspection IDs and looks them up live (with the user's
   own session, so RLS decides what comes back). */
var DAL_TAGS=[['inspection','create'],['decide','reject','inspection','escalate'],['season'],['cqc','create'],['score','cqc','change'],['container','find'],['export'],['claim','create'],['claim','decide'],['grade','container'],['redirect'],['lead','create','stand'],['lead','import'],['access','analytics'],['dashboard','find'],['dashboard','list'],['block','find'],['boundary','block'],['harvest'],['password'],['signout']];
var DAL_WHO=['admin, power_user, qc_manager, ph_manager, qc_supervisor and inspectors.','Anyone who can create or edit inspections sets Accept / Reject. Escalating: admin, power_user, qc_manager, qc_supervisor. Deciding escalations: the board, admin, power_user.','Everyone in Vision.','admin, power_user, qc_manager, ph_manager, commercial and client_qc.','admin, power_user, qc_manager, ph_manager, commercial and client_qc.','Most roles — not inspectors, qc_supervisor or marketing.','Roles with Inspections Analytics.','admin, power_user and commercial.','Claim approvers: admin, power_user and anyone granted approval.','admin, power_user and commercial.','admin, power_user and commercial.','Roles that manage leads: admin, power_user, commercial, marketing.','Roles that manage leads: admin, power_user, commercial, marketing.','Anyone can request; admins approve.','Anyone with Analytics access.','Depends on your Analytics access.','Anyone with Land Cloud.','admin, power_user and agronomy_admin.','Viewing: Land Cloud users. Editing: planners.','Anyone.','Everyone.'];
DAL_HELP.forEach(function(h,i){h.t=DAL_TAGS[i]||[];h.w=DAL_WHO[i]||'';});
/* word → topic. Arabic is matched after normalisation (no diacritics, أإآ→ا, ى→ي, ة→ه). */
var DAL_SYN={
 claim:'claim claims settlement settle settled تسويه عفنه معفنه عفنت complaint complaints complain shakwa shakwah shekaya shakawa kleem claym rotten rot decay decayed mould mold moldy damaged damage spoiled spoilt bruised compensation refund شكوي شكاوي شكوه كليم مطالبه تعويض عفن معفن تالف خربان بايظ ممعفن',
 create:'raise new ارفع create add make start submit record open file a3mel a3ml 3amel e3mel اعمل عمل اعملها اضيف اضافه جديد جديده ابدا سجل اسجل',
 decide:'approve approval approved accept accepted decide decision sign موافقه اوافق اعتماد يعتمد اعتمد قبول قرار',
 reject:'reject rejected rejection refuse refused arfod arfud marfoud marfood ارفض نرفض يرفض اترفض رفض مرفوض مرفوضه',
 escalate:'escalate escalation board tas3eed asa3ed اصعد يصعد صعد صعدها تصعيد مجلس',
 inspection:'inspection inspections inspect batch session pallet pallets fahs فحص تفتيش معاينه باتش بالته',
 container:'container containers cont konteiner kontainer shipment shipments كونتينر حاويه حاويات شحنه شحنات',
 find:'find search where locate look see show feen fein fen فين اين الاقي القي ابحث دور اشوف',
 season:'season seasons year mawsem mosem موسم الموسم سنه',
 cqc:'cqc qc clientqc report reports تقرير تقارير جوده',
 score:'score scores rating points mark درجه درجات سكور',
 change:'change changed update revise revised upgrade downgrade fix edit تغيير اغير غيرت يغير بغير تعديل عدل رفع خفض',
 grade:'grade grades grading graded a2ayem اقيم يقيم قيمت جريد تقييم قيم',
 export:'export download excel csv pdf print extract تصدير نزل تنزيل اكسل طباعه استخراج',
 redirect:'redirect redirection reroute divert a7awel 7awel ha7awel a7wel tahwil احول يحول حولت returned return تحويل حول مرتجع رجوع',
 lead:'lead leads prospect prospects contact contacts buyer ليد ليدز محتمل محتملين',
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
 _x:'client clients customer customers 3amil 3ameel عميل عملاء tany tani taani تاني grapes grape citrus orange oranges mango mangoes pomegranate pom عنب موالح برتقال مانجو رمان',
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
      if(dalArStem(w))hit=dalArStem(w);
      else{var best=9,bw='';DAL_VOCAB.forEach(function(v){if(v.length<4)return;var d=dalLev(w,v);if(d<best){best=d;bw=v;}});if(best<=(w.length>=7?2:1))hit=DAL_WORD[bw];}}
    if(hit)t[hit]=1;});
  return Object.keys(t);}
/* generic topics count less than specific ones, so “rotten container” means a claim, not a search */
var DAL_GENERIC={container:1,find:1,create:1,list:1,change:1,decide:2,report:1};
function dalRank(q){var tp=dalTopics(q),nq=dalNorm(q),hits=[];if(!nq)return hits;
  DAL_HELP.forEach(function(h,i){var s=0;h.t.forEach(function(t){if(tp.indexOf(t)>=0)s+=(DAL_GENERIC[t]||3);});
    nq.split(' ').forEach(function(w){if(w.length>3&&dalNorm(h.q+' '+h.k).indexOf(w)>=0)s+=1;});if(s)hits.push([s,i]);});
  hits.sort(function(a,b){return b[0]-a[0];});return hits;}
/* entities */
var DAL_RX_BOX=/\b([a-z]{4})\s*(\d{6,7})\b/i,DAL_RX_SLASH=/\b(?!(?:19|20)\d\d\s*\/\s*(?:19|20)\d\d\b)(\d{3,5})\s*\/\s*(\d{3,5})\b/,DAL_RX_INSP=/\b(gr|ct|mn|pm)\s*[-\s]?\s*(20\d\d)\s*[-\s]\s*(\d{1,4})\b/i;
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
function dalCKey(c){return String(c||'').toUpperCase().replace(/\s+/g,' ').trim();}
function dalVoyages(rows){var seen={},out=[];rows.forEach(function(s){var k=dalCKey(s.container_number)+'|'+String(s.loading_date||'').slice(0,10);if(!seen[k]){seen[k]=1;out.push(s);}});return out;}
function dalLink(c){return '<button type="button" class="dal-link" data-q="'+dalEsc(c)+'">'+dalEsc(c)+'</button>';}
function dalList(items,fmt,max){max=max||5;var h=items.slice(0,max).map(fmt).join('<br>');if(items.length>max)h+='<br><span class="dal-dim">…and '+(items.length-max)+' more.</span>';return h;}
/* PostgREST caps a request at 1,000 rows — page through (up to 5,000) so voyage counts are real */
function dalPaged(make,pages){pages=pages||5;var out=[];function next(i){return dalSafe(make().range(i*1000,i*1000+999)).then(function(r){out=out.concat(r);return (r.length===1000&&i+1<pages)?next(i+1):out;});}return next(0);}
function dalCapNote(rows){return rows.length>=5000?' <span class="dal-dim">(first 5,000 lines only)</span>':'';}
var DAL_FARMS=[['BD','badr','بدر'],['HA','hana','مزرعه هنا'],['KH','el khair','khair','الخير'],['NO','nour','نور'],['SA','salma','سلمي'],['ME','menia','menya','minya','المنيا','منيا'],['LA','layla','ليلي'],['BA','elbaraka','baraka','البركه','بركه']];
function dalFarmIn(n){for(var i=0;i<DAL_FARMS.length;i++){var f=DAL_FARMS[i];for(var j=1;j<f.length;j++){if((' '+n+' ').indexOf(' '+dalNorm(f[j])+' ')>=0)return f[0];}if(new RegExp('\\b'+f[0].toLowerCase()+'\\b').test(n)&&/farm|مزرعه/.test(n))return f[0];}return null;}
var DAL_OPS={
 waiting:{label:'What’s waiting for me?',run:function(){dalNudges().then(function(){var p=dalState.pending||[];
   if(!p.length)return dalSay('Nothing is waiting for you right now.',{expr:'happy'});
   dalOpSay('<b>'+p.length+' thing'+(p.length>1?'s':'')+' waiting for you:</b><br>'+p.map(function(x){return '• '+x.html;}).join('<br>'),p[0].app,'alert');});}},
 at_sea:{label:'Containers at sea right now',run:function(){
   dalPaged(function(){return sb.from('shipments').select('container_number,loading_date,client,eta,receiving_country').eq('shipping_status','Shipped').order('eta',{ascending:true});}).then(function(r){var v=dalVoyages(r),today=dalDay(0);
     if(!v.length)return dalSay('No containers are marked as shipped right now.',{expr:'happy'});
     /* many rows stay "Shipped" after arrival (status not synced) — split them out honestly */
     var ahead=v.filter(function(s){return s.eta&&String(s.eta).slice(0,10)>=today;}),stale=v.filter(function(s){return !s.eta||String(s.eta).slice(0,10)<today;});
     var h=ahead.length?'<b>'+ahead.length+' container'+(ahead.length>1?'s':'')+' on the way</b>, arriving soonest:<br>'+dalList(ahead,function(s){return dalLink(s.container_number)+' — '+dalEsc(s.client||'—')+', ETA '+dalFmtDate(s.eta);}):'No containers with an ETA still ahead.';
     if(stale.length)h+='<br><span class="dal-dim"><b>'+stale.length+'</b> more are still marked “Shipped” but their ETA has passed — their status probably wasn’t updated to Delivered. Oldest: '+stale.slice(0,2).map(function(s){return dalLink(s.container_number)+' (ETA '+dalFmtDate(s.eta)+')';}).join(', ')+'.</span>';
     dalOpSay(h+dalCapNote(r),'vision');});}},
 arriving:{label:'Containers arriving in the next 7 days',run:function(){
   dalPaged(function(){return sb.from('shipments').select('container_number,loading_date,client,eta,receiving_country').eq('shipping_status','Shipped').gte('eta',dalDay(0)).lte('eta',dalDay(7)).order('eta',{ascending:true});}).then(function(r){var v=dalVoyages(r);
     if(!v.length)return dalSay('No containers are due to arrive in the next 7 days.',{expr:'neutral'});
     dalOpSay('<b>'+v.length+' container'+(v.length>1?'s':'')+' arriving in the next 7 days:</b><br>'+dalList(v,function(s){return dalLink(s.container_number)+' — '+dalEsc(s.client||'—')+(s.receiving_country?', '+dalEsc(s.receiving_country):'')+', ETA '+dalFmtDate(s.eta);}),'vision');});}},
 loaded_week:{label:'Containers loaded in the last 7 days',run:function(){
   dalPaged(function(){return sb.from('shipments').select('container_number,loading_date,client,product_id,pack_house').gte('loading_date',dalDay(-7)).order('loading_date',{ascending:false});}).then(function(r){var v=dalVoyages(r);
     if(!v.length)return dalSay('No containers were loaded in the last 7 days.',{expr:'neutral'});
     dalOpSay('<b>'+v.length+' container'+(v.length>1?'s':'')+' loaded in the last 7 days:</b><br>'+dalList(v,function(s){return dalLink(s.container_number)+' — '+dalEsc(dalCap(s.product_id))+' to '+dalEsc(s.client||'—')+', '+dalFmtDate(s.loading_date)+(s.pack_house?' ('+dalEsc(s.pack_house)+')':'');}),'vision');});}},
 no_cqc:{label:'Delivered but no client QC yet',run:function(){
   Promise.all([dalPaged(function(){return sb.from('shipments').select('container_number,loading_date,client').eq('shipping_status','Delivered').gte('loading_date',dalDay(-60)).lte('loading_date',dalDay(-7)).order('loading_date',{ascending:false});}),
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
   Promise.all([dalPaged(function(){return sb.from('shipments').select('container_number,loading_date,client,pack_house').is('matched_inspection_id',null).gte('loading_date',dalDay(-30)).order('loading_date',{ascending:false});}),
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
   /* citrus rows have no receiving_country — the sync keeps the country in raw_data.Region */
   var c=dalCountryEn(arg).replace(/[^a-z\u0600-\u06FF ]/gi,'').trim();if(!c){dalState.inOp=false;return dalSay('Which country?',{expr:'puzzled'});}
   dalPaged(function(){return sb.from('shipments').select('container_number,loading_date,client,product_id,receiving_country,region:raw_data->>Region').or('receiving_country.ilike.*'+c+'*,raw_data->>Region.ilike.*'+c+'*').gte('loading_date',dalDay(-365)).order('loading_date',{ascending:false});}).then(function(r){var v=dalVoyages(r);
     if(!v.length)return dalSay('I found no containers to <b>'+dalEsc(c)+'</b> in the last 12 months that you can see.',{expr:'puzzled'});
     var cl={};v.forEach(function(s){cl[s.client||'—']=(cl[s.client||'—']||0)+1;});var top=Object.keys(cl).sort(function(a,b){return cl[b]-cl[a];}).slice(0,3);
     var name=v[0].receiving_country||dalCap(String(v[0].region||c).toLowerCase());
     dalOpSay('<b>'+v.length+' container'+(v.length>1?'s':'')+' to '+dalEsc(name)+'</b> in the last 12 months'+dalCapNote(r)+'. Top clients: '+top.map(function(k){return dalEsc(k)+' ('+cl[k]+')';}).join(', ')+'. Latest:<br>'+dalList(v,function(s){return dalLink(s.container_number)+' — '+dalEsc(s.client||'—')+', '+dalFmtDate(s.loading_date);},3),'vision');});}},
 for_client:{label:'Containers for a client (last 12 months)',needs:'client',run:function(arg){
   dalPaged(function(){return sb.from('shipments').select('container_number,loading_date,client,shipping_status,receiving_country').ilike('client','%'+arg+'%').gte('loading_date',dalDay(-365)).order('loading_date',{ascending:false});}).then(function(r){var v=dalVoyages(r);
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
var DAL_COUNTRY_AR={'روسيا':'russia','انجلترا':'uk','بريطانيا':'uk','هولندا':'holland','الصين':'china','الهند':'india','الامارات':'uae','السعوديه':'saudi','اليابان':'japan','البرازيل':'brazil','سلوفينيا':'slovenia','لاتفيا':'latvia','المانيا':'germany','ايطاليا':'italy','اسبانيا':'spain','فرنسا':'france','ماليزيا':'malaysia','اندونيسيا':'indonesia','الكويت':'kuwait','قطر':'qatar','عمان':'oman','البحرين':'bahrain','المغرب':'morocco','جنوب افريقيا':'south africa','استراليا':'australia','نيوزيلندا':'new zealand'};
function dalCountryEn(a){var n=dalNorm(a).replace(/^(ل|ال)(?=\S)/,'');return DAL_COUNTRY_AR[n]||DAL_COUNTRY_AR['ال'+n]||String(a);}
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
  if(/(waiting for me|pending for me|my tasks|to ?do list|what do i have|ايه المطلوب|مستنيني|مطلوب مني|mestanini|mestaniny|matlob meni|matloob mni)/.test(n))return ['waiting'];
  if(/(no boundar|without (a )?boundar|missing boundar|boundar(y|ies) missing|not drawn|بدون حدود|من غير حدود|مفيش حدود|men gher 7dood|mafish 7dood)/.test(n))return ['no_boundary'];
  if(/(young|wip|pre ?bearing|not producing yet|تحت الانتاج|صغيره)/.test(n)&&/(block|blocks|بلوك|farm|مزرعه)/.test(n))return ['wip'];
  if((m=raw.match(/\b(\d{2}-\d{2}[a-z]?)\b/i)))return ['block',m[1].toUpperCase()];
  if((m=raw.match(/\b([A-Z]{2}\d{4}[A-Z0-9]{4,10})\b/)))return ['block',m[1]];
  var farm=dalFarmIn(n);if(farm&&!box&&!/(packhouse|pack house|inspection|فحص|محطه|مصنع)/.test(n))return ['farm',farm];
  if(/(at sea|in transit|on the water|sailing|في البحر|في الطريق|بتبحر|fel ba7r|fi el ba7r|f el ba7r|3al tare2)/.test(n))return ['at_sea'];
  if(/(arriv|eta|due to arrive|coming in|هيوصل|هتوصل|توصل|وصول|واصله|wasla|wasl|hatewsal|hayewsal|wosool)/.test(n)&&(box||/(week|اسبوع|esbo3|soon|قريب|2orayeb)/.test(n)))return ['arriving'];
  if(/(no|without|missing|not yet|pending) (client )?(qc|cqc|report)|بدون (تقرير|qc)|مفيش تقرير/.test(n))return ['no_cqc'];
  if(/(open|pending|outstanding|active) claims?|claims? (open|pending)|containers? with claims?|(شكاوي|كليمات|مطالبات) (ال)?مفتوحه|claims? (el )?(maftou?7a|maftoo7a|maftoha|maftu7a)/.test(n))return ['open_claims'];
  if(/(returned containers?|containers? (were )?returned|which (were )?returned|مرتجع|رجعت|rag3a|rag3et|rag3in|mortaga3)/.test(n)&&!/(redirect|another client|عميل تاني)/.test(n))return ['returned'];
  if(/(special accept|shipped anyway|still shipped|rejected but shipped|اتشحن رغم)/.test(n))return ['special'];
  if(/(without (an )?inspection|no inspection|not inspected|uninspected|بدون فحص|من غير فحص|مفيش فحص|men gher fa7s|mafish fa7s)/.test(n))return ['no_insp'];
  if(!/(^|\s)(how (do|can|to|should)|ezay|ازاي)(\s|$)/.test(n)&&/(^|\s)(red|احمر|a7mar)(?=\s|$)/.test(n)&&(box||/(score|client|scored|عميل|درجه)/.test(n)))return ['cqc_red'];
  var recent=/(this week|last (7|seven) days|recent|latest|الاسبوع|اخر اسبوع|اخر ٧|اخيره)/.test(n);
  if(/(reject|rejection|مرفوض|رفض)/.test(n)&&(recent||/(which|list|show|كام|ايه)/.test(n)))return ['rejected_week'];
  if(/(inspections?|فحص|فحوصات)/.test(n)&&(recent||/^my inspections|فحوصاتي/.test(n))&&!/(new|start|create|جديد|اعمل)/.test(n))return ['insp_week'];
  if(/(loaded|loading|تحميل|اتحمل|شحنا)/.test(n)&&recent)return ['loaded_week'];
  var howto=/(^|\s)(how (do|can|to|should)|ezay|ازاي|can i|where do i)(\s|$)/.test(n)||/(another|other|different|new) (client|customer)|عميل تاني|3amil tany/.test(n);
  /* Arabic country names, preposition attached or not (لروسيا، الى روسيا) */
  if(box&&!howto){var cw=n.split(' ');for(var ci=0;ci<cw.length;ci++){var w=cw[ci].replace(/^(لل|ل|ب)(?=\S{3})/,'');if(DAL_COUNTRY_AR[w]||DAL_COUNTRY_AR['ال'+w])return ['to_country',DAL_COUNTRY_AR[w]||DAL_COUNTRY_AR['ال'+w]];}}
  if(box&&!howto&&(m=n.match(/\b(?:to|going to|ل|الي|علي) ([a-z\u0600-\u06FF][a-z\u0600-\u06FF ]{2,20}?)(?: this| last| in|$)/)))return ['to_country',m[1].trim()];
  if(box&&!howto&&(m=n.match(/\b(?:for(?: (?:client|customer))?|client|customer|عميل) ([a-z0-9\u0600-\u06FF][a-z0-9\u0600-\u06FF &]{1,24}?)(?: this| last| in|$)/)))return ['for_client',m[1].trim()];
  return null;
}
var DAL_HELLO=/^(hi|hey|hello|hola|salam|salamo|ahlan|ahla|marhaba|sabah|masa2|السلام|سلام|اهلا|مرحبا|صباح|مساء|good (morning|afternoon|evening))(?=\s|$)/;
var DAL_THANKS=/(^|\s)(thanks|thank you|thx|merci|mersi|shokran|shukran|شكرا|متشكر|تسلم)(?=\s|$)/;
/* a follow-up only when it's short and points back ("who can do that?", "مين يقدر يعمل ده؟") — not "who signs off on settlements" */
var DAL_WHOQ=/^(who( can)?( do)?( (that|it|this))?|who is allowed|(min|meen|mn|men)( y2dar| ye2dar| yi2dar| ye2dr)?( ye3mel| y3ml| ya3mel| ye3melha)?( keda| da| di| dah)?|مين|مين يقدر( يعمل)?( ده| دي| كده)?)$/;
var DAL_OPENQ=/^(open( it)?|take me( there)?|go|افتح|افتحها|وديني|روح)\b/;
var DAL_DATAQ_RX=/^(how many|how much|how often|count|total|compare|why|what percent|kam|kaam|leh|كام|عدد|ليه|قارن|نسبه)(?=\s|$)/,DAL_WHY_RX=/^(why|leh|ليه)(?=\s|$)/;
var DAL_DATAQ={test:function(n){if(!DAL_DATAQ_RX.test(n))return false;if(DAL_WHY_RX.test(n)){var t=dalTopics(n);if(t.indexOf('signout')>=0||t.indexOf('access')>=0||t.indexOf('password')>=0||/(^|\s)(cant|can t|cannot|unable|locked|mesh 2ader|مش قادر|مش عارف)(\s|$)/.test(n))return false;}return true;}};
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
/* QA additions */
function dalArStem(w){if(!/[\u0600-\u06FF]/.test(w))return null;var P=['وال','بال','لل','ال','بي','هي','بت','هت','ب','ي','ت','ن','ا','ل','و'],S=['ها','هم','ني','ه','وا','ين','ات'],c=[w];
 S.forEach(function(s){if(w.length-s.length>=3&&w.slice(-s.length)===s)c.push(w.slice(0,-s.length));});
 c.slice().forEach(function(x){P.forEach(function(p){if(x.length-p.length>=3&&x.indexOf(p)===0)c.push(x.slice(p.length));});});
 for(var i=1;i<c.length;i++)if(DAL_WORD[c[i]])return DAL_WORD[c[i]];return null;}

/* extra synonyms (conversation review): added only where a word isn't already mapped, so the
   QA-tuned mappings always win */
(function(){var ADD={claim:'claimes cliam clam complian reclamation ad2ya shakwa2 kleemat klaim klemat ma3fen 3afan bayez talef fasid فاسد بوظ باظت قضيه كليمات اعتراض',
 create:'creat craete adding 3ayez 3awez 3ayz a3mil ne3mel nsagel sagel asagel ezawed zawed عايز عاوز نعمل نسجل ازود زود انشئ',
 decide:'aprove approv aprroval accpet a2bal ne3tmed e3temad yewafe2 signoff settle settlement يوافق وافق امضي',
 reject:'rejct refuze rafd marfoud marfood rafad رفضو رفضه',
 escalate:'escalte tas3eed tas3id majles magles',
 inspection:'inspction inspecton insp fa7s fo7osat paleta palet palettes بالتات باليته عينه عينات sample samples',
 container:'contaner contianer conteiner cntr carta booking vessel konteinar kontainar kontiner sha7na sh7na كرته كارته بوليصه مركب سفينه',
 find:'serch seach wher whre alaqi la2i ala2i dawar shoof shof',
 season:'seson seasn sezon mawasem مواسم',
 cqc:'cqcs qcreport ta2rir ta2arir taqrir',
 score:'scor scroe daraga darga',
 change:'chnage updte modify t3deel ta3deel 3adel ghayar ghayyar صلح عدلها غيرها',
 grade:'grde gradin ta2yeem ta2yim قيمه',
 export:'exprot dowload downlod xls xlsx tasdeer nazel nazzel tanzil',
 redirect:'redirct redierct resell resale ta7weel tahweel mortaga3',
 stand:'fruitlogistica logistica gulfood ma3rad businesscard qrcode',
 import:'imprt improt kteer keteer estirad',
 access:'acess acces permision permisson salahiya sala7eya mafool ma2fool مقفوله',
 analytics:'analitics analytcs anlytics ta7lilat تحليل',
 dashboard:'dashbord dashbaord dahsboard tableau',
 block:'blok blck ayadi 7osha hosha qet3a 2et3a',
 boundary:'boundry boundray bounday kml 7dod hodod 5areta khareta',
 harvest:'harvst harvset qataf 7asad hasad',
 password:'pasword passwrd passowrd baswerd basword',
 signout:'loggedout tala3ny tala3ni 5arragni kharagni فصل بيطلعني'};
 Object.keys(ADD).forEach(function(k){dalNorm(ADD[k]).split(' ').forEach(function(w){if(w.length>=3&&!/[0-9-]/.test(w.replace(/[2357]/g,'').replace(/^[0-9]+$/,'0'))&&!DAL_WORD[w]){DAL_WORD[w]=k;DAL_VOCAB.push(w);}});});})();
/* ── conversation UI ── */
var DAL_SRC_OF={at_sea:'Shipments',arriving:'Shipments',loaded_week:'Shipments',no_cqc:'Shipments · Client QC',open_claims:'Claims',returned:'Shipments',special:'Inspections',no_insp:'Shipments · Inspections',cqc_red:'Client QC',insp_week:'Inspections',rejected_week:'Inspections',to_country:'Shipments',for_client:'Shipments',no_boundary:'Land Cloud blocks',wip:'Land Cloud blocks',farm:'Land Cloud blocks',block:'Land Cloud blocks',waiting:'live checks across DalOS'};
function dalNow(){var d=new Date();return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2);}
function dalPlain(html){var t=document.createElement('div');t.innerHTML=html;return (t.textContent||'').replace(/\s+/g,' ').trim();}
function dalSay(html,o){
  o=o||{};var el=dalState.el,msg=el.querySelector('.dal-msg'),act=el.querySelector('.dal-act');
  /* a data answer that hit a failed query must not pretend nothing exists */
  var live=!!dalState.inOp;
  if(dalState.inOp&&dalState.qerr){var rq=dalState.curQ,ro=dalState.retry;html=dalV('error',dalState.lang);o={expr:'puzzled',choices:[{label:'Try again',fn:function(){ro?ro():rq&&dalAsk(rq);}}]};live=false;}
  var src=o.src||(live?dalState.curSrc:'');if(o.expr==='puzzled'&&!o.src)src='';dalState.inOp=false;dalState.qerr=false;
  dalGoHome();
  /* keep the conversation: the previous Q&A folds into history */
  if(dalState.shown&&dalState.shown.q&&dalState.shown.q!==dalState.curQ){dalState.hist.unshift(dalState.shown);dalState.hist=dalState.hist.slice(0,3);dalRenderHist();}
  var q=dalState.curQ;dalState.shown={q:q,html:html};
  el.querySelector('.dal-qecho').innerHTML=q?'<span dir="auto">'+dalEsc(q)+'</span>':'';
  function render(){
    dalFace(o.expr||'neutral');
    msg.innerHTML='<div dir="auto">'+html+'</div>'+(src?'<div class="dal-src'+(live?'':' is-static')+'">From '+dalEsc(src)+(live?' · live, '+dalNow()+' · only what you can see':'')+'</div>':'');
    act.innerHTML='';
    if(o.choices)o.choices.forEach(function(c){var b=document.createElement('button');b.type='button';b.className='dal-choice';b.textContent=c.label;b.onclick=c.fn;act.appendChild(b);});
    if(o.cta){var b=document.createElement('button');b.type='button';b.className='dal-pri';b.textContent=o.cta;b.onclick=function(){if(o.act==='request'){dalMin(true);requestAnalyticsAccess();return;}if(o.app&&dalCanOpen(o.app))openProduct(o.app);};act.appendChild(b);}
    if(o.fb&&q){var f=document.createElement('div');f.className='dal-fb';f.innerHTML='Helpful? <button type="button" data-v="y">Yes</button><button type="button" data-v="n">No</button>';
      f.onclick=function(e){var v=e.target.getAttribute&&e.target.getAttribute('data-v');if(!v)return;if(v==='n')dalMiss('[not helpful] '+q);f.textContent=v==='y'?'Thanks.':'Thanks — noted so it gets better.';};act.appendChild(f);}
    el.querySelector('.dal-live').textContent=dalPlain(html);
    dalRenderSugg(o.follow||dalFollowFor(),o.follow?'Next':'Try asking');
    var txt=dalPlain(html);if(o.expr!=='puzzled'&&o.expr!=='sleepy')dalTalk(Math.min(1400,txt.length*16));
    var to=o.act==='request'?'analytics':o.app;if(to&&!el.classList.contains('is-min'))setTimeout(function(){dalPointTo(to);},300);
    if(o.expr==='alert'&&!o.quietHop)dalHopInPlace(2);
  }
  if(o.fast){render();return;}
  dalFace('thinking');msg.innerHTML='<span class="dal-typing" role="status"><i></i><i></i><i></i><span class="dal-sr">Dal is thinking</span></span>';act.innerHTML='';
  setTimeout(render,dalState.waited?0:180);dalState.waited=false;
}
function dalRenderHist(){var box=dalState.el.querySelector('.dal-log');box.innerHTML=dalState.hist.slice().reverse().map(function(h){return '<details><summary><span dir="auto">'+dalEsc(h.q)+'</span></summary><div class="dal-hans" dir="auto">'+h.html+'</div></details>';}).join('');}
function dalBusy(){dalState.waited=true;dalFace('thinking');var m=dalState.el.querySelector('.dal-msg');m.innerHTML='<span class="dal-typing" role="status"><i></i><i></i><i></i><span class="dal-sr">Dal is checking</span></span>';dalState.el.querySelector('.dal-act').innerHTML='';
  clearTimeout(dalState.slowT);dalState.slowT=setTimeout(function(){var t=m.querySelector('.dal-typing');if(t&&dalState.curSrc)t.insertAdjacentHTML('beforeend','<span class="dal-slow">Checking '+dalEsc(dalState.curSrc)+'…</span>');},1500);}
function dalAnswer(i){var h=DAL_HELP[i];if(!h)return;var can=h.app&&dalCanOpen(h.app);dalState.last={type:'help',i:i,app:h.app};
  dalSay(dalAck('help',dalState.lang)+dalEsc(h.a)+(h.app&&!can?' <span class="dal-dim">You don’t have '+dalAppLabel(h.app)+' access yet.</span>':'')+(h.app?' <span class="dal-sr">(see the '+dalAppLabel(h.app)+' tile)</span>':''),{expr:h.app?'pointing':'neutral',app:h.app,cta:can?'Open '+dalAppLabel(h.app):'',fb:true,src:'the DalOS help guide',follow:[{label:'Who can do that?',q:'who can do that'}].concat(dalRoleChips().slice(0,2))});}
function dalOpSay(html,app,expr){dalState.last={type:'op',app:app};
  /* follow-ups: the first two containers / IDs in the answer */
  var links=[],re=/data-q="([^"]+)"/g,m;while((m=re.exec(html))&&links.length<2){var v=m[1].replace(/&amp;/g,'&');if(links.indexOf(v)<0)links.push(v);}
  dalSay(dalAck('list',dalState.lang)+html,{expr:expr||'pointing',app:app,cta:app&&dalCanOpen(app)?'Open '+dalAppLabel(app):'',fb:true,follow:links.map(function(v){return {label:'What happened with '+v+'?',q:v};}).concat(['waiting'])});}
function dalRunOp(id,arg){var op=DAL_OPS[id];if(!op)return;dalState.inOp=true;dalState.qerr=false;dalState.curSrc=DAL_SRC_OF[id]||'DalOS';dalState.retry=function(){dalRunOp(id,arg);};if(!dalState.curQ)dalState.curQ=op.label;dalBusy();op.run(arg);}
function dalClarify(a,b){return dalSay(dalV('did_you_mean',dalState.lang),{expr:'thinking',choices:[{label:DAL_HELP[a].q,fn:function(){dalState.curQ=DAL_HELP[a].q;dalAnswer(a);}},{label:DAL_HELP[b].q,fn:function(){dalState.curQ=DAL_HELP[b].q;dalAnswer(b);}}]});}
function dalDecideKw(q,hits){
  if(!hits.length){dalMiss(q);return dalSay(dalV('unknown',dalState.lang),{expr:'puzzled'});}
  if(hits.length>1&&hits[1][0]>=hits[0][0]&&hits[0][0]<6)return dalClarify(hits[0][1],hits[1][1]);
  dalAnswer(hits[0][1]);
}
function dalRoleChips(){var s=(DAL_OPS_SUGGEST[dalState.role]||[13,19,20]).slice();if(dalState.latestBox)s.unshift({label:'What happened with '+dalState.latestBox+'?',q:dalState.latestBox});return s;}
function dalFollowFor(){var p=dalState.pending&&dalState.pending.length;return ['waiting'].concat(dalRoleChips()).slice(0,4);}
function dalDefaultSugg(){return dalFollowFor();}
function dalRenderSugg(list,label){var box=dalState.el.querySelector('.dal-sugg-list');box.innerHTML='';dalState.el.querySelector('.dal-sugg-label').textContent=label||'Try asking';
  list.forEach(function(i){var b=document.createElement('button');b.type='button';
    if(typeof i==='number'){b.textContent=DAL_HELP[i].q;b.onclick=function(){dalState.curQ=DAL_HELP[i].q;dalAnswer(i);};}
    else if(i&&i.q){b.textContent=i.label;b.onclick=function(){dalAsk(i.q);};}
    else{var p=String(i).split(':'),op=DAL_OPS[p[0]];if(!op)return;var n=p[0]==='waiting'&&dalState.pending&&dalState.pending.length;b.textContent=p[1]&&p[0]==='farm'?'Farm summary: '+dalFarmName(p[1]):op.label+(n?' ('+n+')':'');b.onclick=function(){dalState.curQ=b.textContent;dalRunOp(p[0],p[1]);};}
    box.appendChild(b);});}
function dalSearch(q){if(!q.trim()){dalRenderSugg(dalDefaultSugg());return [];}
  var hits=dalRank(q);if(hits.length)dalRenderSugg(hits.slice(0,4).map(function(x){return x[1];}),'Suggestions');return hits;}
function dalMin(on){var el=dalState.el;if(on)dalGoHome();el.classList.toggle('is-min',on);var c=el.querySelector('.dal-char');c.setAttribute('aria-expanded',on?'false':'true');
  if(on){c.focus({preventScroll:true});}else{dalBadge(0);if(window.innerWidth>=760)setTimeout(function(){el.querySelector('.dal-in').focus({preventScroll:true});},60);}}
function dalBadge(n){var b=dalState.el.querySelector('.dal-badge');b.textContent=n?String(n):'';b.hidden=!n;}

/* ── small talk, company knowledge, easter eggs ── */
var DAL_SMALL=[
 ['how_are_you',/^(how are (you|u)|how r u|hows it going|3amel eh|3aml eh|ezayak|ezyak|izayak|عامل ايه|ازيك|اخبارك ايه|ايه الاخبار)(?=\s|$)/],
 ['who_are_you',/^(who are (you|u)|what are you|whats your name|what is your name|enta meen|inta min|انت مين|اسمك ايه)(?=\s|$)/],
 ['robot',/(are you (a )?(robot|bot|human|ai|real)|انت روبوت|انت بني ادم|enta robot)/],
 ['joke',/(^|\s)(joke|funny|nokta|نكته|ضحكني)(?=\s|$)/],
 ['good_job',/^(good job|well done|nice|great|perfect|brilliant|gamed|7elw|helw|جامد|حلو|برافو|عاش)(?=\s|$)/],
 ['wrong',/(you re wrong|youre wrong|wrong answer|not what i (asked|meant)|that s wrong|thats wrong|incorrect|ghalat|غلط|مش ده)/]];
var DAL_CAN=/^(what can you do|help|what do you know|te2dar te3mel eh|تقدر تعمل ايه|بتعمل ايه|مساعده|\?)$/;
var DAL_ABOUTQ=/(about daltex|what is daltex|who is daltex|who are we|tell me about (the )?company|عن دالتكس|دالتكس ايه|يعني ايه دالتكس)/;
var DAL_HISTQ=/(daltex history|history of daltex|when was daltex|founded|since when|تاريخ دالتكس|اتاسست امتي|اتأسست)/;
var DAL_FACTQ=/(did you know|fun fact|tell me something|surprise me|interesting fact|any fact|معلومه|قولي حاجه|حاجه حلوه)/;
var DAL_TIPQ=/^(tip|tips|any tips|a tip|نصيحه|تريكه)(?=\s|$)/;
function dalSmallTalk(n,raw){
  var L=dalState.lang;
  if(n==='dal'||n==='dal dal'||n==='دال'||n==='دالّ'){if(dalPref('nofun'))return dalSay(dalV('who_are_you',L),{expr:'happy',fast:true});return dalSay((L==='ar'?'تحت أمرك. ':'At your service. ')+'My name, دالّ, means “the one who points the way.”',{expr:'bow',fast:true});}
  if(/^(grape|grapes|عنب|3enab)$/.test(n))return dalSay(L==='ar'?'ده أنا.':'That’s me. A cluster, to be exact.',{expr:'happy',fast:true});
  if(DAL_CAN.test(n)){dalCard();return true;}
  /* just an app name (seen in the unanswered log: "vision") → what it is + open it */
  var APPS={vision:['vision','Quality control from packhouse to port — inspections, client QC, shipments and escalations.'],analytics:['analytics','Shipment and market dashboards for every product.'],commercial:['commercial','Claims, redirections, grading, regions and lead generation.'],landcloud:['landcloud','Every farm block, its seasons, boundaries and the Harvest Planner.']};
  var an=n.replace(/^(open|go to|افتح|dalos)\s+/,'').replace(/\s+/g,'').replace(/^(فيجن|فيچن)$/,'vision').replace(/^(انالتكس|اناليتكس)$/,'analytics').replace(/^(كوميرشال)$/,'commercial').replace(/^(lc|land)$/,'landcloud');
  if(APPS[an]){var A=APPS[an],can=dalCanOpen(A[0]);dalState.last={type:'app',app:A[0]};return dalSay('<b>DalOS '+dalAppLabel(A[0])+'</b> — '+A[1]+(can?'':' <span class="dal-dim">You don’t have access yet.</span>'),{expr:'pointing',app:A[0],cta:can?'Open '+dalAppLabel(A[0]):'',fast:true});}
  for(var i=0;i<DAL_SMALL.length;i++)if(DAL_SMALL[i][1].test(n)){var k=DAL_SMALL[i][0];if(k==='wrong'&&dalState.prevQ)dalMiss('[wrong] '+dalState.prevQ);if(k==='joke'&&dalPref('nofun'))k='who_are_you';
    return dalSay(dalV(k,L),{expr:k==='joke'||k==='good_job'||k==='how_are_you'?'happy':k==='wrong'?'puzzled':'neutral',fast:true});}
  if(DAL_ABOUTQ.test(n))return dalSay(DAL_ABOUT+'<br><span class="dal-dim">'+DAL_HISTORY[dalDayIndex()%DAL_HISTORY.length]+'</span>',{expr:'happy',src:'Daltex’s public website and press',follow:[{label:'Daltex history',q:'daltex history'},{label:'Tell me something interesting',q:'did you know'}]});
  if(DAL_HISTQ.test(n)&&/daltex|دالتكس|company|شركه|founded|اتاسست|اتأسست/.test(n))return dalSay('<b>Daltex, in a few milestones:</b><br>• Founded in <b>1964</b> by Dr. Samir El Naggar, exporting potatoes to the UK and the Netherlands.<br>• '+DAL_HISTORY.join('<br>• '),{expr:'happy',src:'Daltex’s public website and press'});
  if(DAL_FACTQ.test(n)){var f=DAL_FACTS[Math.floor(Math.random()*DAL_FACTS.length)].t;return dalSay('<span class="dal-ack">Did you know?</span> '+f,{expr:'happy',src:'DalOS records (Oct 2026)',follow:[{label:'Another one',q:'tell me something interesting'},{label:'About Daltex',q:'about daltex'}]});}
  if(DAL_TIPQ.test(n))return dalSay('<span class="dal-ack">Tip:</span> '+DAL_TIPS[Math.floor(Math.random()*DAL_TIPS.length)],{expr:'neutral',fast:true});
  return false;
}

/* ── capability card + settings ── */
function dalCard(){var r=dalState.role,help=(DAL_SUGGEST[r]||[13,19,20]).slice(0,2),ops=(DAL_OPS_SUGGEST[r]||['waiting']).slice(0,2);
  var ex=function(t,q){return '<button type="button" class="dal-link" data-q="'+dalEsc(q)+'">'+dalEsc(t)+'</button>';};
  var html='<b>Here’s what I can do:</b>'+
   '<div class="dal-cap"><span>Find things</span>Paste a container or inspection ID'+(dalState.latestBox?' — e.g. '+ex(dalState.latestBox,dalState.latestBox):'')+'. Block IDs work too.</div>'+
   '<div class="dal-cap"><span>Show what’s going on</span>'+ops.map(function(o){var p=o.split(':'),op=DAL_OPS[p[0]];return op?ex(p[0]==='farm'?'Farm summary: '+dalFarmName(p[1]):op.label,p[0]==='farm'?dalFarmName(p[1])+' farm':op.label):'';}).join(' · ')+' · '+ex('What’s waiting for me?','what is waiting for me')+'</div>'+
   '<div class="dal-cap"><span>How-to</span>'+help.map(function(i){return ex(DAL_HELP[i].q,DAL_HELP[i].q);}).join(' · ')+'</div>'+
   '<div class="dal-dim">I can’t calculate totals, trends or defect % yet — the Analytics dashboards do that. English, Arabic and Franco all work.</div>'+
   '<div class="dal-set"><label><input type="checkbox" class="dal-opt" data-k="quiet"'+(dalPref('quiet')?' checked':'')+'> Only speak when I ask (quiet mode)</label>'+
   '<label><input type="checkbox" class="dal-opt" data-k="nofun"'+(dalPref('nofun')?'':' checked')+'> Fun extras — holiday touches, celebrations, jokes</label>'+
   '<button type="button" class="dal-mini" data-a="home">Reset my position</button></div>'+
   '<div class="dal-dim dal-keys">Press <kbd>/</kbd> to ask · <kbd>Esc</kbd> to close · double-click me to send me home</div>';
  dalState.curQ=dalState.curQ||'What can you do?';
  dalSay(html,{expr:'happy',fast:true,follow:dalRoleChips().slice(0,3)});
  var m=dalState.el.querySelector('.dal-msg');
  [].forEach.call(m.querySelectorAll('.dal-opt'),function(c){c.onchange=function(){var k=c.getAttribute('data-k');dalPSet('pref_'+k,(k==='nofun'?!c.checked:c.checked)?'1':null);if(k==='nofun')dalAccessory(dalPref('nofun')?'':(dalHoliday()||{}).acc);};});
  var h=m.querySelector('[data-a="home"]');if(h)h.onclick=function(){try{localStorage.removeItem('dal_pos');}catch(e){}dalPlace(null);h.textContent='Done — I’m back in my corner.';};
}

/* ── the daily rhythm: Dal speaks first at most once a day; actionable things win over nice things ── */
function dalRecap(){var since=dalDay(-7),N=[dalPaged(function(){return sb.from('shipments').select('container_number,loading_date').gte('loading_date',since);}),dalCount(sb.from('inspections').select('id',{count:'exact',head:true}).neq('season_id',DAL_DUMMY_SEASON).gte('date',since))];
  if(COMMERCIAL_ROLES[dalState.role])N.push(dalCount(sb.from('crm_leads').select('id',{count:'exact',head:true}).gte('created_at',since)));
  return Promise.all(N).then(function(r){var c=dalVoyages(r[0]).length,i=r[1],l=r[2],parts=[];if(c)parts.push('<b>'+c+'</b> container'+(c>1?'s':'')+' loaded');if(i)parts.push('<b>'+i+'</b> inspection'+(i>1?'s':''));if(l)parts.push('<b>'+l+'</b> new lead'+(l>1?'s':''));
    return parts.length?'This week: '+parts.join(', ')+'. Have a good weekend'+(dalFirst()?', '+dalEsc(dalFirst()):'')+'.':null;});}
function dalDaily(nudgeP,quiet,animate){
  var el=dalState.el,cd=dalCairo(),seen=dalGet('seen'),hol=dalHoliday(),phone=window.innerWidth<760,firstEver=!dalPGet('intro');
  if(hol&&hol.acc&&!dalPref('nofun'))dalAccessory(hol.acc);
  setTimeout(function(){
    dalFace(quiet?'sleepy':'happy');el.classList.remove('is-hidden');el.classList.add('is-enter');setTimeout(function(){el.classList.remove('is-enter');},1700);
    Promise.resolve(nudgeP).then(function(n){
      setTimeout(function(){
        if(quiet){dalFace('sleepy');return;}
        dalFace('neutral');
        if(seen||dalPref('quiet'))return;
        var pick=null;
        if(firstEver){dalPSet('intro','1');pick={intro:true};}
        else if(n)pick={nudge:n};
        else if(hol)pick={html:(hol.en)+(dalFirst()?' '+dalEsc(dalFirst())+'.':'')+' <span dir="rtl" class="dal-ar">'+hol.ar+'</span>',expr:'happy'};
        else if(cd.wd==='Thu'&&cd.h>=14)pick={recap:true};
        if(!pick){/* nothing actionable: no pop-up. A fact waits inside, signalled by a small badge */
          dalState.daily='<span class="dal-ack">Did you know?</span> '+dalFactOfDay();dalBadge(1);dalSet('seen');return;}
        dalSet('seen');
        var show=function(){if(phone){dalBadge(1);dalState.pendingOpen=go;return;}go();};
        var go=function(){dalMin(false);
          if(pick.intro)return dalIntro();
          if(pick.nudge){var x=pick.nudge;dalState.curQ='';return dalSay(x.html,{expr:x.expr,app:x.app,cta:x.cta,act:x.act,src:'live checks across DalOS'});}
          if(pick.recap)return dalRecap().then(function(h){dalSay(h||'Quiet week. Have a good weekend.',{expr:'happy',src:'Shipments · Inspections'+(COMMERCIAL_ROLES[dalState.role]?' · Leads':'')});});
          dalSay(pick.html,{expr:pick.expr||'happy'});};
        show();
      },dalStill()?0:1500);
    });
  },animate?2600:1200);
}
function dalIntro(){var f=dalFirst(),L=dalState.lang;dalState.curQ='';
  dalSay((f?'Hi '+dalEsc(f)+', ':'Hi, ')+'I’m <b>Dal</b> — دالّ, “the one who points the way”. I can do three things:'+
   '<div class="dal-cap"><span>1 · Find things</span>Paste a container or inspection ID and I’ll trace it.</div>'+
   '<div class="dal-cap"><span>2 · Answer how-tos</span>Where things are in Vision, Commercial, Analytics and Land Cloud.</div>'+
   '<div class="dal-cap"><span>3 · Tell you what’s waiting</span>Approvals, reports and queues that need you.</div>'+
   '<div class="dal-dim">Ask in English, Arabic or Franco. Drag me anywhere; press <kbd>/</kbd> to ask.</div>',
   {expr:'happy',fast:true,choices:[{label:'What’s waiting for me?',fn:function(){dalState.curQ='What’s waiting for me?';dalRunOp('waiting');}}].concat(dalState.latestBox?[{label:'Try '+dalState.latestBox,fn:function(){dalAsk(dalState.latestBox);}}]:[]).concat([{label:'Got it',fn:function(){dalState.curQ='';dalSay(dalGreeting(L),{expr:'happy',fast:true});}}])});}

/* ── routing ── */
function dalAsk(q){
  var n=dalNorm(q),raw=String(q);dalState.prevQ=dalState.curQ;dalState.curQ=raw;dalState.lang=dalLangOf(raw);dalWake();
  var m=raw.match(DAL_RX_INSP);if(m){dalState.inOp=true;dalState.qerr=false;dalState.curSrc='Inspections';dalState.retry=function(){dalAsk(raw);};dalBusy();return dalLookupInspection(m[1].toUpperCase()+'-'+m[2]+'-'+('0000'+m[3]).slice(-4));}
  m=raw.match(DAL_RX_BOX);if(m){dalState.inOp=true;dalState.qerr=false;dalState.curSrc='Shipments · Inspections · Client QC · Claims';dalState.retry=function(){dalAsk(raw);};dalBusy();return dalLookupContainer(m[1].toUpperCase()+' '+m[2],m[1]+'%'+m[2],null);}
  m=raw.match(DAL_RX_SLASH);if(m){dalState.inOp=true;dalState.qerr=false;dalState.curSrc='Shipments · Inspections · Client QC · Claims';dalState.retry=function(){dalAsk(raw);};dalBusy();return dalLookupContainer(m[1]+'/'+m[2],null,m[1]+'/'+m[2]);}
  if(DAL_HELLO.test(n))return dalSay(dalGreeting(dalState.lang)+(dalState.daily?'<br>'+dalState.daily:''),{expr:'happy',fast:true});
  if(DAL_THANKS.test(n))return dalSay(dalV('thanks',dalState.lang),{expr:'happy',fast:true});
  var last=dalState.last;
  if(last&&DAL_OPENQ.test(n)&&last.app){if(dalCanOpen(last.app))return openProduct(last.app);return dalSay('You don’t have '+dalAppLabel(last.app)+' access yet.',{expr:'neutral'});}
  if(last&&last.type==='help'&&DAL_WHOQ.test(n))return dalSay('<b>Who can:</b> '+dalEsc(DAL_HELP[last.i].w),{expr:'neutral',fast:true,src:'the DalOS help guide'});
  if(dalSmallTalk(n,raw)!==false)return;
  var op=dalOpMatch(n,raw);if(op){dalState.curQ=raw;return dalRunOp(op[0],op[1]);}
  if(DAL_DATAQ.test(n)){dalMiss(q);return dalSay(dalV('data_q',dalState.lang),{expr:'puzzled',app:'vision',cta:'Open Vision'});}
  var kw=dalRank(q);
  if(/[؀-ۿ]/.test(raw))return dalDecideKw(q,kw);   /* the meaning model is English-only */
  dalBusy();
  dalSemantic(q).then(function(sem){
    if(sem&&sem.length>1){var a=sem[0],b=sem[1];
      if(a[1]>=0.86&&a[1]-b[1]>=0.02)return dalAnswer(a[0]);
      if(a[1]>=0.82)return dalClarify(a[0],b[0]);}
    dalDecideKw(q,kw);
  });
}

/* ── boot ── */
function dalBoot(u,animate){
  if(!DAL_ENABLED||!u||DAL_OFF_ROLES[u.role]||dalState.booted)return;
  dalState.booted=true;dalState.u=u;dalState.role=u.role||'';dalState.lastInput=Date.now();
  var el=document.createElement('div');el.className='dal is-min is-hidden';el.id='dal';
  el.innerHTML='<div class="dal-bubble" role="region" aria-label="Dal, the DalOS assistant">'+
    '<div class="dal-head"><div><b id="dalTitle">Dal</b><span>DalOS assistant</span></div><div class="dal-hbtns"><button type="button" class="dal-help" aria-label="What can Dal do?"><span aria-hidden="true">?</span></button><button type="button" class="dal-x" aria-label="Hide Dal"><span aria-hidden="true">×</span></button></div></div>'+
    '<div class="dal-log"></div><div class="dal-qecho"></div>'+
    '<div class="dal-msg"></div><div class="dal-act"></div><span class="dal-live dal-sr" aria-live="polite"></span>'+
    '<div class="dal-sugg"><span class="dal-sugg-label">Try asking</span><div class="dal-sugg-list"></div></div>'+
    '<form class="dal-ask" autocomplete="off"><input type="search" class="dal-in" dir="auto" enterkeyhint="send" placeholder="Ask, or paste a container / ID" aria-label="Ask Dal"><button type="submit" aria-label="Send question"><span aria-hidden="true">↵</span></button></form>'+
    '</div>'+
    '<button type="button" class="dal-char" aria-label="Open Dal, the DalOS assistant" aria-expanded="false"><span class="dal-ground"></span><span class="dal-char-svg"></span><span class="dal-tag">Ask Dal</span><span class="dal-badge" hidden></span></button>';
  document.body.appendChild(el);dalState.el=el;dalRigInit(el.querySelector('.dal-char-svg'));dalFace(dalQuiet()?'sleepy':'neutral');
  el.querySelector('.dal-x').onclick=function(){dalMin(true);};
  el.querySelector('.dal-help').onclick=function(){dalState.curQ='What can you do?';dalCard();};
  el.querySelector('.dal-char').onclick=function(){if(dalState.justDragged)return;dalWake();
    /* easter egg: five quick clicks */
    var now=Date.now();dalState.clicks=dalState.clicks.filter(function(t){return now-t<1600;});dalState.clicks.push(now);
    if(dalState.clicks.length>=5&&!dalPref('nofun')){dalState.clicks=[];dalMin(false);dalState.curQ='';dalFace('dizzy');if(!dalStill())el.querySelector('.dal-char-svg').animate([{transform:'rotate(0)'},{transform:'rotate(-12deg)'},{transform:'rotate(10deg)'},{transform:'rotate(-6deg)'},{transform:'rotate(0)'}],{duration:700});return dalSay(dalState.lang==='ar'?'خلاص صحيت!':'Okay, okay — I’m awake.',{expr:'dizzy',fast:true});}
    var open=el.classList.contains('is-min');
    if(open&&dalState.pendingOpen){var g=dalState.pendingOpen;dalState.pendingOpen=null;return g();}
    dalMin(!open);
    if(open&&!el.querySelector('.dal-msg').innerHTML){dalState.curQ='';dalSay(dalGreeting(dalState.lang)+(dalState.daily?'<br>'+dalState.daily:''),{expr:'happy',fast:true});dalState.daily='';}};
  el.addEventListener('keydown',function(e){if(e.key==='Escape')dalMin(true);});
  var inp=el.querySelector('.dal-in');
  inp.addEventListener('input',function(){dalWake();el.classList.toggle('is-typing',!!inp.value);dalSearch(inp.value);});
  inp.addEventListener('blur',function(){el.classList.remove('is-typing');});
  el.querySelector('.dal-ask').onsubmit=function(e){e.preventDefault();var q=inp.value.trim();if(!q)return;inp.value='';el.classList.remove('is-typing');dalAsk(q);};
  /* containers / IDs inside answers and history are clickable */
  el.querySelector('.dal-bubble').addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('.dal-link');if(b)dalAsk(b.getAttribute('data-q'));});
  /* "/" or Ctrl/⌘+J opens Dal from anywhere on the page */
  document.addEventListener('keydown',function(e){var t=e.target,typing=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable);
    if(e.isComposing)return;if((e.key==='/'&&!typing&&!e.metaKey&&!e.ctrlKey&&!e.altKey)||((e.metaKey||e.ctrlKey)&&(e.key==='j'||e.key==='J'))){e.preventDefault();if(el.classList.contains('is-min'))dalMin(false);else inp.focus();}});
  ['pointermove','keydown','pointerdown'].forEach(function(t){document.addEventListener(t,function(){if(Date.now()-dalState.lastInput>1000)dalWake();},{passive:true});});
  dalDragInit();dalBlinkLoop();dalIdleLoop();
  dalRenderSugg(dalDefaultSugg());
  if(!/^agronomy/.test(dalState.role))dalSafe(sb.from('shipments').select('container_number').order('loading_date',{ascending:false}).limit(1)).then(function(r){dalState.qerr=false;if(r.length&&r[0].container_number){dalState.latestBox=dalCKey(r[0].container_number);if(!el.querySelector('.dal-qecho').textContent)dalRenderSugg(dalDefaultSugg());}});
  /* pupils follow the pointer (smoothed by CSS) */
  if(!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))document.addEventListener('mousemove',function(ev){if(dalState.lookAt||!dalState.svg||window.innerWidth<760)return;
    var r=dalState.svg.getBoundingClientRect();if(!r.width)return;var dx=ev.clientX-(r.left+r.width*.5),dy=ev.clientY-(r.top+r.height*.47),dd=Math.hypot(dx,dy)||1,mm=Math.min(3.6,dd/40);dalLook(dx/dd*mm,dy/dd*mm);},{passive:true});
  var quiet=dalQuiet(),seen=dalGet('seen'),nudgeP=(quiet||seen||dalPref('quiet'))?Promise.resolve(null):dalNudges().catch(function(){return null;});
  nudgeP.then(function(){dalState.qerr=false;if(dalState.pending&&dalState.pending.length)dalRenderSugg(dalDefaultSugg());});
  dalDaily(nudgeP,quiet,animate);
}
