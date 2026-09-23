// The Three.js Conf afterparty block: the event photos, and the badge's own disco ball
// drawn live — the animation from the disco-ball tool, dropping in on its string.
const FRAME_W=1028,FRAME_H=990;              // the Figma frame this is composed from
const BALL={cx:509,cy:517.6,r:112.2,pivotX:509}; // measured off the ball export in that frame, then 20% up
const DISCO_PALS=[[158,197,240],[255,167,254],[255,203,138],[159,146,243],[128,219,188]];
// Mouth / snout vector from the badge firmware's Mouth.svg (viewBox 71 × 73).
const SNOUT_BLOB=new Path2D("M12.8717 29.0658C0.183031 19.6626 6.83373 -0.481934 22.6268 -0.481934H51.1003C66.7113 -0.481934 73.4774 19.2799 61.1424 28.8482L48.6013 38.5763C45.7282 40.805 42.1954 42.0146 38.5592 42.0146H35.7539C32.241 42.0146 28.8211 40.8855 25.9988 38.7939L12.8717 29.0658Z");
const SNOUT_L=new Path2D("M32.1099 34.3398C37.0394 44.1075 36.3352 71.3541 7.81445 65.1851");
const SNOUT_R=new Path2D("M38.8256 34.3398C33.8961 44.1075 34.6003 71.3541 63.1211 65.1851");
const SNOUT_VW=71,SNOUT_VH=73,FACE_INK='#272727',MAX_ROT_DEG=30;

const options=new URLSearchParams(location.search);
const number=(name,fallback)=>{const v=Number.parseFloat(options.get(name));return Number.isFinite(v)?v:fallback};
const poster=document.querySelector('#poster'),canvas=document.querySelector('#ball'),c=canvas.getContext('2d');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const state={spin:number('spin',.6),loopDur:6,pixelCount:16,introStart:null,introDur:1.15};
let LP_T=0,LP_U=0,scale=1,lastT=0;

// Seamless-loop time: snap each speed to a whole number of cycles per loop.
const cyc=w=>w<=0?0:2*Math.PI*Math.max(1,Math.round(w*state.loopDur/(2*Math.PI)))*LP_U;
const ballRotation=()=>state.spin<=0?0:2*Math.PI*Math.max(1,Math.round(state.spin*state.loopDur/(2*Math.PI)))*LP_U;

const face={_x:0,_y:0,openness:1};
function updateFace(){
 face._x=.35*Math.sin(cyc(.8));face._y=.22*Math.sin(cyc(.8)+1.7);
 let op=1;                                   // two deterministic blinks per loop
 for(const bc of [.28,.72]){let d=Math.abs(LP_U-bc);d=Math.min(d,1-d);const hw=.04;
  if(d<hw)op=Math.min(op,Math.abs(Math.sin((d/hw)*Math.PI/2)));}
 face.openness=op;
}
function drawEye(x,y,r,scaleX){c.save();c.translate(x,y);c.scale(scaleX,1);c.fillStyle=FACE_INK;c.beginPath();
 if(face.openness<1)c.ellipse(0,0,r,r*face.openness,0,0,Math.PI*2);else c.arc(0,0,r,0,Math.PI*2);c.fill();c.restore();}
function drawSnout(x,y,w,h){c.save();c.translate(x-w/2,y-h/2);c.scale(w/SNOUT_VW,h/SNOUT_VH);
 c.fillStyle=FACE_INK;c.strokeStyle=FACE_INK;c.lineCap='round';c.fill(SNOUT_BLOB);c.lineWidth=12.2881;c.stroke(SNOUT_L);c.stroke(SNOUT_R);c.restore();}
function drawFace(cx,cy,R){
 const eyeSpacing=R*.337,eyeY=R*-.2,eyeRadius=R*.115,mouthW=R*.302,mouthH=R*.327,mouthY=R*.141;
 const theta=face._x*MAX_ROT_DEG*Math.PI/180,cosT=Math.cos(theta),sinT=Math.sin(theta),yShift=face._y*R*.18;
 const project=(nx,ny)=>{const nz2=1-nx*nx-ny*ny,nz=nz2>0?Math.sqrt(nz2):.1;
  return {x:nx*cosT+nz*sinT,y:ny,z:-nx*sinT+nz*cosT,scaleX:Math.max(.3,-nx*sinT+nz*cosT)}};
 const pL=project(-eyeSpacing/R,eyeY/R),pR=project(eyeSpacing/R,eyeY/R),pM=project(0,mouthY/R);
 if(pL.z>0)drawEye(cx+pL.x*R,cy+pL.y*R+yShift,eyeRadius,pL.scaleX);
 if(pR.z>0)drawEye(cx+pR.x*R,cy+pR.y*R+yShift,eyeRadius,pR.scaleX);
 drawSnout(cx+pM.x*R,cy+pM.y*R+yShift,mouthW*pM.scaleX,mouthH);
}
// Faceted lat/long sphere with light shading and glints, from the badge's drawDisco().
function drawDiscoBall(cx,cy,Rb){
 const NLAT=15,NLON=26,rot=ballRotation(),Lx=-.45,Ly=-.52,Lz=.72;
 const halo=c.createRadialGradient(cx,cy,Rb*.3,cx,cy,Rb*1.7);
 halo.addColorStop(0,'rgba(210,215,255,0.18)');halo.addColorStop(1,'rgba(0,0,0,0)');
 c.fillStyle=halo;c.beginPath();c.arc(cx,cy,Rb*1.7,0,Math.PI*2);c.fill();
 c.lineWidth=Math.max(1,Rb*.004);
 for(let i=0;i<NLAT;i++){
  const f0=-Math.PI/2+(i/NLAT)*Math.PI,f1=-Math.PI/2+((i+1)/NLAT)*Math.PI,fc=(f0+f1)/2;
  for(let j=0;j<NLON;j++){
   const l0=(j/NLON)*2*Math.PI+rot,l1=((j+1)/NLON)*2*Math.PI+rot,lc=(l0+l1)/2;
   const nx=Math.cos(fc)*Math.sin(lc),ny=Math.sin(fc),nz=Math.cos(fc)*Math.cos(lc);
   if(nz<=.04)continue;                                  // back face hidden
   let b=nx*Lx+ny*Ly+nz*Lz;if(b<0)b=0;                   // illumination
   const seed=i*131+j*57,tw=.5+.5*Math.sin(cyc(3)+seed); // twinkle
   const base=DISCO_PALS[(i*7+j*3)%DISCO_PALS.length],sf=.28+b*1.05,gm=(b>.55&&tw>.8)?.82:0;
   const rr=base[0]*sf,gg=base[1]*sf,bb=base[2]*sf;
   c.fillStyle=`rgb(${Math.min(255,rr+(255-rr)*gm)|0}, ${Math.min(255,gg+(255-gg)*gm)|0}, ${Math.min(255,bb+(255-bb)*gm)|0})`;
   const P=[[f0,l0],[f0,l1],[f1,l1],[f1,l0]];
   c.beginPath();
   for(let k=0;k<4;k++){const x=Math.cos(P[k][0])*Math.sin(P[k][1]),y=Math.sin(P[k][0]);
    if(k===0)c.moveTo(cx+x*Rb,cy-y*Rb);else c.lineTo(cx+x*Rb,cy-y*Rb);}
   c.closePath();c.fill();c.strokeStyle='rgba(0,0,0,0.30)';c.stroke();
  }
 }
 drawFace(cx,cy,Rb);
}
// Light rays, cast from the ball's own centre so they always line up with it.
function drawRays(cx,cy,Rb,t){
 const N=14,L=Math.hypot(FRAME_W,FRAME_H);
 c.save();c.globalCompositeOperation='lighter';c.translate(cx,cy);c.rotate(cyc(.22)+ballRotation()*.08);
 for(let i=0;i<N;i++){
  const tw=.45+.55*Math.sin(cyc(2)+i*1.7);if(tw<.28)continue;
  const col=DISCO_PALS[(i*3)%DISCO_PALS.length];
  const spread=.045+.03*(.5+.5*Math.sin(cyc(1.3)+i));
  c.save();c.rotate((i/N)*Math.PI*2);
  const g=c.createLinearGradient(Rb*.6,0,L,0);
  g.addColorStop(0,`rgba(${col[0]},${col[1]},${col[2]},0)`);
  g.addColorStop(.05,`rgba(${col[0]},${col[1]},${col[2]},${.26*tw})`);
  g.addColorStop(1,`rgba(${col[0]},${col[1]},${col[2]},0)`);
  c.fillStyle=g;
  const w=Math.tan(spread)*L;
  c.beginPath();c.moveTo(Rb*.6,0);c.lineTo(L,w);c.lineTo(L,-w);c.closePath();c.fill();
  c.restore();
 }
 c.restore();
}
// Pastel squares breathing around the ball.
let pixels=[];
function initPixels(){pixels=[];for(let i=0;i<state.pixelCount;i++)pixels.push({
 ang:Math.random()*Math.PI*2,dist:1.05+Math.random()*.95,drift:.05+Math.random()*.18,
 bob:.04+Math.random()*.08,bobW:.5+Math.random()*1.2,size:.012+Math.random()*.02,
 col:DISCO_PALS[(Math.random()*DISCO_PALS.length)|0],ph:Math.random()*Math.PI*2,spd:1.5+Math.random()*3});}
function drawPixels(cx,cy,Rb){
 for(const p of pixels){
  const a=p.ang+cyc(p.drift),d=Rb*(p.dist+p.bob*Math.sin(cyc(p.bobW)+p.ph));
  const tw=.5+.5*Math.sin(cyc(p.spd)+p.ph);if(tw<.35)continue;
  const s=Rb*p.size*(.6+tw*.7);
  c.fillStyle=`rgba(${p.col[0]},${p.col[1]},${p.col[2]},${tw})`;
  c.fillRect(cx+Math.cos(a)*d-s/2,cy+Math.sin(a)*d-s/2,s,s);
 }
}
// The rope hangs from a fixed pivot at the top edge to the attach point on the ball.
function drawString(pivotX,cx,cy,Rb,theta){
 const ax=cx-Math.sin(theta)*Rb,ay=cy-Math.cos(theta)*Rb;
 c.save();
 c.strokeStyle='rgba(255,255,255,0.5)';c.lineWidth=Math.max(1.5,FRAME_W*.0035*scale);
 c.beginPath();c.moveTo(pivotX,0);c.lineTo(ax,ay);c.stroke();
 c.lineWidth=Math.max(2,FRAME_W*.004*scale);c.strokeStyle='rgba(255,255,255,0.45)';
 c.translate(ax,ay);c.rotate(theta);
 c.beginPath();c.arc(0,Rb*.02,Rb*.05,Math.PI,Math.PI*2);c.stroke();
 c.restore();
}
// The rope is real: after the drop the ball is a damped pendulum you can shove or drag.
const ROPE=BALL.cy;                        // pivot sits at y = 0, so the rope is that long
const pend={th:0,w:0,drag:false,lastTh:0,lastAt:0};
const W0=2*Math.PI/1.9;                    // ~1.9 s for a full swing
function stepPendulum(dt){
 if(pend.drag)return;
 const breeze=.045*Math.sin(LP_T*.55)+.03*Math.sin(LP_T*.23+1.7);   // never completely still
 pend.w+=(-W0*W0*Math.sin(pend.th)-.55*pend.w+breeze)*dt;
 pend.th+=pend.w*dt;
}
// Intro: the ball falls from above the top edge, overshoots, then swings itself still.
const easeOutBack=(p,s=1.3)=>{const c3=s+1,x=p-1;return 1+c3*x*x*x+s*x*x};
function introTransform(baseCx,baseCy,Rb,t){
 if(state.introStart===null)return {x:baseCx,y:-Rb*1.3,theta:0};
 const tt=t-state.introStart;
 if(tt>4.5||reduced)return {x:baseCx,y:baseCy,theta:0};
 const e=easeOutBack(Math.min(1,tt/state.introDur),1.35);
 const yStart=-Rb*1.3,y=yStart+(baseCy-yStart)*e;
 const theta=.12*Math.exp(-1.25*tt)*Math.sin(7*tt);
 return {x:baseCx+Math.sin(theta)*Math.max(y,Rb*.5),y,theta};
}

// Pointer: a shove when it crosses the ball, a drag when it grabs it — and a little
// parallax on the photos so the whole block breathes with the cursor.
const photos=[...document.querySelectorAll('.ph')];
const DEPTH={rooftop:1,sign:.62,bar:.8,crew:.5};
const toFrame=e=>{const r=poster.getBoundingClientRect();return [(e.clientX-r.left)/r.width*FRAME_W,(e.clientY-r.top)/r.height*FRAME_H]};
const ballAt=()=>[BALL.pivotX+ROPE*Math.sin(pend.th),ROPE*Math.cos(pend.th)];
let prevPx=null;
function onPointer(e){
 const [px,py]=toFrame(e);
 for(const el of photos){
  const d=DEPTH[[...el.classList].find(k=>k in DEPTH)]||.6;
  el.style.translate=`${(px/FRAME_W-.5)*-14*d}px ${(py/FRAME_H-.5)*-9*d}px`;
 }
 const [bx,by]=ballAt(),dist=Math.hypot(px-bx,py-by);
 canvas.style.cursor=dist<BALL.r?(pend.drag?'grabbing':'grab'):'';
 if(pend.drag){
  pend.th=Math.max(-.7,Math.min(.7,Math.atan2(px-BALL.pivotX,Math.max(py,BALL.r))));
  const now=performance.now()/1000,dt=now-pend.lastAt;
  if(dt>0.004){pend.w=(pend.th-pend.lastTh)/dt;pend.lastTh=pend.th;pend.lastAt=now;}
  return;
 }
 if(prevPx!==null&&dist<BALL.r*1.15){
  const vx=px-prevPx;                                  // the cursor pushes it along
  pend.w+=Math.max(-3,Math.min(3,vx*.02/ROPE*60))+(bx-px)/BALL.r*.06;
 }
 prevPx=px;
}
poster.addEventListener('pointermove',onPointer);
poster.addEventListener('pointerleave',()=>{prevPx=null;for(const el of photos)el.style.translate='';});
canvas.addEventListener('pointerdown',e=>{
 const [px,py]=toFrame(e),[bx,by]=ballAt();
 if(Math.hypot(px-bx,py-by)>BALL.r)return;
 pend.drag=true;pend.lastTh=pend.th;pend.lastAt=performance.now()/1000;pend.w=0;
 canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';
});
const letGo=()=>{if(pend.drag){pend.drag=false;pend.w=Math.max(-4,Math.min(4,pend.w));}};
canvas.addEventListener('pointerup',letGo);canvas.addEventListener('pointercancel',letGo);

// PARTYYYY arrives one letter at a time: split the word, keeping the exact widths the
// stretched title has, so each glyph can be animated on its own.
async function splitTitle(){
 const svg=document.querySelector('.title'),text=svg.querySelector('text');
 if(!text)return;
 try{await document.fonts.load('122px Dingos');await document.fonts.ready}catch{}
 const word=text.textContent;
 try{
  const probe=text.cloneNode(true);probe.removeAttribute('textLength');probe.removeAttribute('lengthAdjust');
  probe.setAttribute('visibility','hidden');svg.append(probe);
  const natural=probe.getComputedTextLength();probe.remove();
  const k=natural>0?Number(text.getAttribute('textLength'))/natural:1;
  const xs=[...word].map((_,i)=>text.getStartPositionOfChar(i).x);
  const y=text.getAttribute('y'),size=text.getAttribute('font-size');
  const frag=document.createDocumentFragment();
  [...word].forEach((ch,i)=>{
   const g=document.createElementNS('http://www.w3.org/2000/svg','g');
   g.setAttribute('transform',`translate(${xs[i]},0) scale(${k},1)`);
   const t=document.createElementNS('http://www.w3.org/2000/svg','text');
   t.setAttribute('x',0);t.setAttribute('y',y);t.setAttribute('font-size',size);
   t.setAttribute('class','ltr');t.style.setProperty('--i',i);t.textContent=ch;
   g.append(t);frag.append(g);
  });
  text.replaceWith(frag);
 }catch(e){/* keep the one-piece title if the split is not possible */}
}
// The letters must exist before the block is told to appear, or they are born settled.
const titleReady=Promise.race([splitTitle(),new Promise(r=>setTimeout(r,1500))]);

function resize(){
 const r=poster.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
 scale=r.width/FRAME_W;
 canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);
 c.setTransform(dpr*scale,0,0,dpr*scale,0,0);   // draw in frame coordinates
}
addEventListener('resize',resize);
if('ResizeObserver' in window)new ResizeObserver(resize).observe(poster);
initPixels();resize();

// The block introduces itself the first time it is actually seen.
let onScreen=true,started=false;
const start=()=>{if(started)return;started=true;state.introStart=null;
 titleReady.then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{   // let the letters be painted first
  document.body.classList.add('in');armAt=performance.now()/1000+.35;})));};
let armAt=Infinity;
if('IntersectionObserver' in window){
 onScreen=false;
 // The implicit root is the top-level viewport, so this also waits when the iframe itself
 // is still below the host page's fold.
 new IntersectionObserver(es=>{const e=es[0];onScreen=e.isIntersecting;if(e.isIntersecting)start();},{threshold:.25}).observe(poster);
}else start();

function frame(ts){
 requestAnimationFrame(frame);
 if(document.hidden||!onScreen)return;
 const t=ts/1000,dt=Math.min(.05,t-(lastT||t));lastT=t;
 if(state.introStart===null&&t>=armAt)state.introStart=t;
 LP_T=t;LP_U=(t%state.loopDur)/state.loopDur;
 updateFace();
 c.clearRect(0,0,FRAME_W,FRAME_H);
 const settled=state.introStart!==null&&(t-state.introStart>1.6||reduced);
 let x,y,th;
 if(settled){stepPendulum(Math.min(dt,.04));th=pend.th;x=BALL.pivotX+ROPE*Math.sin(th);y=ROPE*Math.cos(th);}
 else{const intro=introTransform(BALL.cx,BALL.cy,BALL.r,t);x=intro.x;y=intro.y;th=intro.theta;pend.th=th;pend.w=0;}
 drawRays(x,y,BALL.r,t);
 drawString(BALL.pivotX,x,y,BALL.r,th);
 drawPixels(x,y,BALL.r);
 drawDiscoBall(x,y,BALL.r);
}
requestAnimationFrame(frame);
