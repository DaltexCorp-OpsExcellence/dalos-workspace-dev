/* ── Workspace celebrations: date-gated (Cairo), switch themselves off at midnight ──
   One entry per occasion. Preview any day with ?celebrate=<id>. Hook: celebrateBoot() from showChooser. */
var CEL_DAYS=[
 {id:'oct6',from:'2026-10-06',to:'2026-10-06',years:53,
  en:'Happy <em>6th of October</em> — Armed Forces Day',ar:'كل سنة وانتم طيبين بمناسبة ذكرى انتصارات أكتوبر',sub:'6 October 1973 · from all of us at Daltex'}
];
var CEL_COLS=['#ce1126','#ffffff','#e9c37a','#ce1126','#f6dca0'];
function celCairoYmd(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}catch(e){return new Date().toISOString().slice(0,10);}}
function celToday(){var q=null;try{q=new URLSearchParams(location.search).get('celebrate');}catch(e){}
  for(var i=0;i<CEL_DAYS.length;i++){var c=CEL_DAYS[i];if(q?q===c.id:(celCairoYmd()>=c.from&&celCairoYmd()<=c.to))return c;}return null;}
function celStill(){return !!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);}
function celGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function celSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
var CEL_CSS=
 '.cel-bunting{position:absolute;left:0;right:0;top:100%;height:44px;pointer-events:none;z-index:1}'+
 '.cel-bunting svg{display:block;width:100%;height:100%;overflow:visible}'+
 '.cel-pen{transform-box:fill-box;transform-origin:50% 0;animation:cel-sway 3s ease-in-out infinite}'+
 '@keyframes cel-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}'+
 '.cel-banner{position:relative;margin-top:18px;max-width:980px;border-radius:16px;overflow:hidden;padding:16px 20px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:18px;align-items:center;'+
  'background:linear-gradient(110deg,rgba(206,17,38,.34),rgba(10,18,12,.62) 38%,rgba(10,18,12,.62) 62%,rgba(20,20,20,.55));border:1px solid rgba(233,195,122,.45);box-shadow:0 18px 40px rgba(0,0,0,.35);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:cel-in .7s cubic-bezier(.2,.8,.2,1) .2s both}'+
 '.cel-banner::before{content:"";position:absolute;left:0;right:0;top:0;height:5px;background:linear-gradient(90deg,#ce1126 0 33.33%,#fff 33.33% 66.66%,#111 66.66%)}'+
 '.cel-shine{position:absolute;inset:0;pointer-events:none;background:linear-gradient(100deg,transparent 35%,rgba(233,195,122,.22) 48%,rgba(255,255,255,.1) 52%,transparent 64%);transform:translateX(-100%);animation:cel-sh 4.5s ease-in-out infinite}'+
 '@keyframes cel-sh{0%{transform:translateX(-100%)}60%,100%{transform:translateX(100%)}}'+
 '@keyframes cel-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'+
 '.cel-seal{position:relative;width:66px;height:66px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 35% 30%,#f6dca0,#c99a3e 60%,#8a6420);color:#2a1d05;box-shadow:0 0 22px rgba(233,195,122,.45),inset 0 0 0 3px rgba(255,255,255,.35)}'+
 '.cel-seal b{font-family:var(--font-display),Georgia,serif;font-size:25px;line-height:1;font-weight:400}'+
 '.cel-seal small{font-size:8.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}'+
 '.cel-text{position:relative;min-width:0}'+
 '.cel-en{font-family:var(--font-display),Georgia,serif;font-size:24px;line-height:1.15;color:#f4f1e8}.cel-en em{font-style:normal;color:#e9c37a}'+
 '.cel-ar{font-family:"Amiri","Noto Naskh Arabic","Geeza Pro",serif;font-size:20px;line-height:1.5;color:#fff;font-weight:700;text-align:left}'+
 '.cel-sub{font-size:12px;color:#d9c9a8;letter-spacing:.04em}'+
 '.cel-x{position:relative;width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#f4f1e8;font-size:17px;line-height:1;cursor:pointer;pointer-events:auto}'+
 '.cel-x:hover{background:rgba(255,255,255,.16)}.cel-x:focus-visible{outline:2px solid #e9c37a;outline-offset:2px}'+
 '.cel-fw{position:absolute;inset:0;width:100%;height:100%;display:block}'+
 '@media(max-width:760px){.cel-banner{grid-template-columns:auto minmax(0,1fr);gap:12px;padding:16px 14px 14px}.cel-x{position:absolute;top:10px;right:10px;width:26px;height:26px}.cel-seal{width:46px;height:46px;align-self:start;margin-top:2px}.cel-seal b{font-size:18px}.cel-seal small{font-size:7px}.cel-en{font-size:19px;padding-right:22px}.cel-ar{font-size:14.5px;white-space:nowrap}.cel-bunting{height:30px}.cel-on .dh-body{padding-top:40px}}'+
 '@media(prefers-reduced-motion:reduce){.cel-pen,.cel-shine,.cel-banner{animation:none}}';

function celBunting(host){var W=Math.max(320,host.clientWidth||window.innerWidth),ph=W<760,n=Math.max(10,Math.round(W/(ph?30:46))),hw=ph?7:11,len=ph?15:24,sag=ph?6:14,cols=['#ce1126','#ffffff','#1a1a1a','#e9c37a'],p='';
  for(var i=0;i<n;i++){var x=(i+.5)*W/n,t=(x-W/2)/(W/2),y=6+sag*(1-t*t);
    p+='<path class="cel-pen" style="animation-delay:-'+((i*.37)%3).toFixed(2)+'s" d="M'+(x-hw).toFixed(1)+' '+y.toFixed(1)+' L'+(x+hw).toFixed(1)+' '+y.toFixed(1)+' L'+x.toFixed(1)+' '+(y+len).toFixed(1)+' Z" fill="'+cols[i%4]+'" stroke="rgba(0,0,0,.25)" stroke-width=".6"/>';}
  host.innerHTML='<svg viewBox="0 0 '+W+' '+(ph?30:44)+'" aria-hidden="true"><path d="M0 6 Q'+(W/2)+' '+(6+sag*2)+' '+W+' 6" stroke="#caa86a" stroke-width="1.4" fill="none"/>'+p+'</svg>';}

/* fireworks on one canvas in the fixed background layer: a gold trail rises, bursts in flag colours; paused when hidden */
function celFireworks(layer){if(celStill())return;
  var cv=document.createElement('canvas');cv.className='cel-fw';var vig=layer.querySelector('.dbd-vignette');layer.insertBefore(cv,vig||null);
  var cx=cv.getContext('2d'),dpr=Math.min(2,window.devicePixelRatio||1),W=0,H=0,parts=[],rockets=[],next=600,last=0,k=0;
  function size(){W=layer.clientWidth;H=layer.clientHeight;cv.width=W*dpr;cv.height=H*dpr;cx.setTransform(dpr,0,0,dpr,0,0);}size();window.addEventListener('resize',size);
  function live(){var cs=document.getElementById('chooserStage');return !document.hidden&&cs&&cs.style.display!=='none';}
  function launch(){var x=W*(.08+.84*Math.random()),ty=H*(.1+.3*Math.random());rockets.push({x:x,y:H+4,vy:-(H-ty)/42,ty:ty});}
  function burst(r){var n=30+Math.floor(Math.random()*14),off=k++;for(var i=0;i<n;i++){var a=Math.PI*2*i/n+Math.random()*.2,s=2+Math.random()*2.4;
    parts.push({x:r.x,y:r.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:.011+Math.random()*.008,c:CEL_COLS[(i+off)%CEL_COLS.length]});}}
  function frame(t){requestAnimationFrame(frame);if(!live()){if(parts.length||rockets.length){parts=[];rockets=[];cx.clearRect(0,0,W,H);}last=t;return;}
    if(!W||cv.width!==Math.round(layer.clientWidth*dpr))size();var dt=Math.min(50,t-(last||t));last=t;next-=dt;if(next<=0){launch();if(Math.random()<.3)setTimeout(launch,350);next=1200+Math.random()*900;}
    cx.clearRect(0,0,W,H);cx.globalCompositeOperation='lighter';
    for(var i=rockets.length-1;i>=0;i--){var r=rockets[i];r.y+=r.vy;cx.fillStyle='rgba(246,220,160,.9)';cx.beginPath();cx.arc(r.x,r.y,2,0,6.283);cx.fill();if(r.y<=r.ty){burst(r);rockets.splice(i,1);}}
    for(var j=parts.length-1;j>=0;j--){var p=parts[j];p.vx*=.975;p.vy=p.vy*.975+.035;p.x+=p.vx;p.y+=p.vy;p.life-=p.decay;if(p.life<=0){parts.splice(j,1);continue;}
      cx.globalAlpha=p.life;cx.shadowBlur=8;cx.shadowColor=p.c;cx.fillStyle=p.c;cx.beginPath();cx.arc(p.x,p.y,2.6*p.life+.7,0,6.283);cx.fill();}
    cx.globalAlpha=1;cx.shadowBlur=0;cx.globalCompositeOperation='source-over';}
  requestAnimationFrame(frame);}

function celebrateBoot(){if(document.querySelector('.cel-banner,.cel-bunting'))return;var c=celToday();if(!c)return;
  var st=document.createElement('style');st.textContent=CEL_CSS;document.head.appendChild(st);
  /* warm the aurora with a hint of red */
  var aur=document.querySelector('.dbd-aur');if(aur){var b=document.createElement('b');b.style.cssText='width:360px;height:360px;background:#8a1a26;top:22%;right:4%;opacity:.5';aur.appendChild(b);}
  var cs=document.getElementById('chooserStage');if(cs)cs.classList.add('cel-on');var tb=document.querySelector('#chooserStage .dh-tb');if(tb){var bu=document.createElement('div');bu.className='cel-bunting';tb.appendChild(bu);celBunting(bu);
    var rt;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(function(){celBunting(bu);},150);});}
  var hero=document.querySelector('#chooserStage .dh-hero'),key='cel_closed_'+c.id;
  if(hero&&!celGet(key)){var bn=document.createElement('div');bn.className='cel-banner';bn.setAttribute('role','note');
    bn.innerHTML='<div class="cel-shine"></div><div class="cel-seal"><b>'+c.years+'</b><small>years</small></div><div class="cel-text"><div class="cel-en">'+c.en+'</div><div class="cel-ar" dir="rtl" lang="ar">'+c.ar+'</div><div class="cel-sub">'+c.sub+'</div></div><button type="button" class="cel-x" aria-label="Close">×</button>';
    hero.appendChild(bn);bn.querySelector('.cel-x').onclick=function(){celSet(key,'1');bn.remove();};}
  var layer=document.querySelector('.dbd');if(layer)celFireworks(layer);}
