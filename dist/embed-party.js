// The Three.js Conf afterparty block: the event photos, and the badge's own disco ball
// drawn live — the animation from the disco-ball tool, dropping in on its string.
const FRAME_W=1028,FRAME_H=990;              // the Figma frame this is composed from
const BALL={cx:509,cy:517.6,r:93.5,pivotX:509};   // measured off the ball export placed in that frame
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
let LP_T=0,LP_U=0,scale=1;

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
const start=()=>{if(started)return;started=true;document.body.classList.add('in');state.introStart=null;armAt=performance.now()/1000+.35;};
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
 const t=ts/1000;
 if(state.introStart===null&&t>=armAt)state.introStart=t;
 LP_T=t;LP_U=(t%state.loopDur)/state.loopDur;
 updateFace();
 c.clearRect(0,0,FRAME_W,FRAME_H);
 const intro=introTransform(BALL.cx,BALL.cy,BALL.r,t);
 drawString(BALL.pivotX,intro.x,intro.y,BALL.r,intro.theta);
 drawPixels(intro.x,intro.y,BALL.r);
 drawDiscoBall(intro.x,intro.y,BALL.r);
}
requestAnimationFrame(frame);
