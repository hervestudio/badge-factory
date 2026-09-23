import { createRenderSettings } from './render-settings.js?v=68';
import { PARTS, createPartsInfo } from './parts-info.js?v=68';
import { FirmwareDisplay } from './emulator-display.js?v=68';
import { createCables } from './cables.js?v=68';
import * as THREE from 'three';
import * as CANNON from './vendor/cannon-es.js';
import {material, mat, mesh, box, cyl, texture, decal, wire, label, buildDisplay, buildESP, buildBattery, buildCharger, buildStrip, buildSwitch, buildSpool, buildStrapBar} from './parts.js?v=68';
import { STLLoader } from './vendor/STLLoader.js';
import { loadGLB } from './glb.js?v=68';
import { detectPerformance, createAdaptiveRatio } from './perf.js?v=68';
import { OrbitControls } from './vendor/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const $=s=>document.querySelector(s),canvas=$('#scene'),stage=$('#stage');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const chapters=[...document.querySelectorAll('.chapter')],copies=[...document.querySelectorAll('.chapter .copy')];
// #debug in the url brings back the render settings and the frame counter.
if(/(^|[#?&])debug\b/.test(location.hash+location.search))document.body.classList.add('debug');
const names=['THE MAKER’S WORKBENCH','PREPARE THE SHELLS','FIT THE SWITCHES','SEAT THE DISPLAY','INSTALL THE CHARGER','PLACE THE BATTERY','CONNECT THE ESP32','WIRE THE CONNECTIONS','TEST IT OPEN','CLOSE THE ENCLOSURE','READY FOR THREE CONF'];
let current=0,target=0,active=-1,inspect=false,renderer,screenTexture,screenCtx,screenMesh,hoveredName=null;
const animated=[],clickables=[];
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const smooth=(v,a,b)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
// Opening: the cover runs before the 3D is ready, then reveals itself once the fonts and the scene are in.
const easeIntro=t=>t<.5?16*t*t*t*t*t:1-Math.pow(-2*t+2,5)/2,easeBack=t=>{const c=1.70158;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
// Cover screen: scrolling through #cover-space drives coverT from the intro (0) down to the workbench (1). The centre cap rides along.
const benchCopy=$('.bench-copy'),bomCta=$('.bom-cta');
// On phones the step detail starts folded, so the badge keeps the screen.
const stepDetails=[...document.querySelectorAll('details.instruction,details.emu-help')];
// The phone's bottom bar steps through the story; the desktop keeps its dot rail.
const drawer=$('#step-drawer'),stepOpen=$('.step-open');
const stepTop=i=>i<=0?coverEnd()+4:chapters[Math.min(i,chapters.length-1)].offsetTop+innerHeight*.075;
drawer.innerHTML=names.map((n,i)=>`<button type="button" data-step-go="${i}"><b>${String(i).padStart(2,'0')}</b>${n}</button>`).join('');
const closeDrawer=()=>{drawer.hidden=true;stepOpen.setAttribute('aria-expanded','false');document.body.classList.remove('drawer-open');};
stepOpen.addEventListener('click',()=>{if(innerWidth>760)return;const open=drawer.hidden;drawer.hidden=!open;stepOpen.setAttribute('aria-expanded',String(open));document.body.classList.toggle('drawer-open',open);
 if(open)for(const b of drawer.children)b.classList.toggle('now',+b.dataset.stepGo===Math.round(target));});
drawer.addEventListener('click',e=>{const b=e.target.closest('[data-step-go]');if(!b)return;scrollTo({top:stepTop(+b.dataset.stepGo),behavior:'smooth'});closeDrawer();});
document.addEventListener('pointerdown',e=>{if(!drawer.hidden&&!e.target.closest('#step-drawer,.step-open'))closeDrawer();},true);
addEventListener('resize',()=>{if(innerWidth>760)closeDrawer();});
for(const b of document.querySelectorAll('[data-step-jump]'))b.addEventListener('click',()=>{closeDrawer();
 const dir=+b.dataset.stepJump,i=Math.round(target)+dir;
 scrollTo({top:i<=0&&dir<0&&target<.3?0:stepTop(i),behavior:'smooth'});});
const foldDetails=()=>{const wide=innerWidth>760;for(const d of stepDetails)d.open=wide;};foldDetails();addEventListener('resize',foldDetails);
const coverEl=$('#cover'),coverBg=$('#cover-bg'),coverInner=$('.cover-inner'),coverActions=$('.cover-actions'),coverSpace=$('#cover-space'),capSlot=$('#cap-slot');
const COVER_DONE=.86;let coverT=0;const coverEnd=()=>Math.max(1,coverSpace.offsetHeight-innerHeight*.18);
function updateCover(){coverT=clamp(scrollY/coverEnd(),0,1);const out=smooth(coverT,0,.4);coverEl.style.opacity=1-out;coverInner.style.setProperty('--cover-y',(-90*out)+'px');coverActions.style.setProperty('--cover-y',(60*out)+'px');coverBg.style.opacity=1-smooth(coverT,.3,.85);document.documentElement.style.setProperty('--chrome-ink',smooth(coverT,.42,.78));coverEl.classList.toggle('gone',coverT>.3);document.body.classList.toggle('on-cover',coverT<COVER_DONE);}
addEventListener('scroll',updateCover,{passive:true});addEventListener('resize',updateCover);updateCover();
$('#cover-cta').addEventListener('click',e=>{e.preventDefault();const from=scrollY,to=coverEnd()+2,t0=performance.now(),D=reduced?1:1900;const step=now=>{const t=clamp((now-t0)/D,0,1);scrollTo({top:lerp(from,to,easeIntro(t)),behavior:'instant'});if(t<1)requestAnimationFrame(step);};requestAnimationFrame(step);});
const capState={hx:0,hy:0,tx:0,ty:0,press:0,spinAt:-1e9,bornAt:-1};
capSlot.addEventListener('pointermove',e=>{const r=capSlot.getBoundingClientRect();capState.tx=clamp((e.clientX-r.left)/r.width*2-1,-1,1);capState.ty=clamp((e.clientY-r.top)/r.height*2-1,-1,1);});
capSlot.addEventListener('pointerleave',()=>{capState.tx=0;capState.ty=0;});
capSlot.addEventListener('pointerdown',()=>{capState.press=1;capState.spinAt=performance.now();});
$('#cover-cta').addEventListener('pointerenter',()=>{capState.spinAt=performance.now();});
const STICK=88; // matches the mobile `.chapter .copy` sticky top in style.css
let bandTop=-1,bandBottom=-1,pressedOnce=false,capHandedOver=false,frameDist=400;const capV=new THREE.Vector3(),capP=new THREE.Vector3(),capU=new THREE.Vector3(),capA=new THREE.Vector3(),capB=new THREE.Vector3(),capLocal=new THREE.Vector3(),capQ=new THREE.Quaternion(),capQ2=new THREE.Quaternion(),benchQ=new THREE.Quaternion(),capE=new THREE.Euler();

let markSceneReady;const sceneReady=new Promise(r=>{markSceneReady=r});
let coverRevealed=false;
function revealCover(){if(coverRevealed)return;coverRevealed=true;document.body.classList.remove('cover-pending');capState.bornAt=-1;if(document.body.classList.contains('intro'))requestAnimationFrame(()=>requestAnimationFrame(()=>document.body.classList.add('intro-in')));}
const capped=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(r,ms))]);
Promise.all([capped(sceneReady,3500),capped(document.fonts?document.fonts.ready:Promise.resolve(),1500)]).then(revealCover);
if(!reduced&&scrollY<10){document.body.classList.add('intro');const cta=$('.cta-wrap'),credit=$('.cover-credit');cta.classList.add('w');cta.style.setProperty('--i',26);credit.classList.add('w');credit.style.setProperty('--i',30);for(const el of document.querySelectorAll('#cover .cover-eyebrow,#cover .cover-title,#cover .cover-lede')){let i=0;const walk=n=>{for(const c of [...n.childNodes]){if(c.nodeType===3){const frag=document.createDocumentFragment();for(const w of c.textContent.split(/(\s+)/)){if(!w)continue;if(/^\s+$/.test(w)){frag.append(w);continue;}const s=document.createElement('span');s.className='w';s.style.setProperty('--i',i++);s.textContent=w;frag.append(s);}c.replaceWith(frag);}else if(c.nodeType===1&&c.tagName!=='BR')walk(c);}};walk(el);}}

const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,5,1500);
const badge=new THREE.Group(),front=new THREE.Group(),back=new THREE.Group();badge.add(front,back);scene.add(badge);
function part(parent,name,pos,offset,phase){const g=new THREE.Group();g.position.fromArray(pos);g.userData={name,home:new THREE.Vector3(...pos),offset:new THREE.Vector3(...offset),phase};parent.add(g);animated.push(g);return g}

function updateTarget(){const y=scrollY+innerHeight*.18;let i=0;while(i<chapters.length-1&&y>=chapters[i+1].offsetTop)i++;const start=chapters[i].offsetTop;const next=chapters[i+1]?.offsetTop??start+chapters[i].offsetHeight;target=i===10?10:clamp(i+(y-start)/(next-start),0,10);if(scrollY<10)target=0;
 const a=clamp(Math.floor(target+.15),0,10);if(active!==a){active=a;$('#step-label').textContent=names[a];$('#step-count').textContent=String(a).padStart(2,'0')+' / 10';document.querySelectorAll('.step-nav a').forEach((el,j)=>{el.classList.toggle('active',j===a);if(j===a)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current')});$('#view-label').textContent=a===0?'ON THE CUTTING MAT':a===10?'ASSEMBLED / DRAG TO EXPLORE':a===9?'CLOSING THE ENCLOSURE':'OPEN ASSEMBLY / '+String(a).padStart(2,'0');if(a!==10&&inspect)setInspect(false)}$('#progress').style.width=(target*10)+'%';}
addEventListener('scroll',updateTarget,{passive:true});

let controls;
// Explore in 3D frames the assembled badge itself, so it fills whatever screen it is on.
const inspectBox=new THREE.Box3(),inspectSize=new THREE.Vector3(),inspectMid=new THREE.Vector3(),badgeShells=[];
// Entering and leaving Explore in 3D is a blend between the story framing and the fitted view.
const inspectPos=new THREE.Vector3(),inspectTarget=new THREE.Vector3(),storyLook=new THREE.Vector3(),blendLook=new THREE.Vector3();
let inspectT=0,inspectE=0;const easeInOut=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function fitInspect(){inspectBox.makeEmpty();for(const g of badgeShells)inspectBox.expandByObject(g);
 inspectBox.getSize(inspectSize);inspectBox.getCenter(inspectMid);
 const vFov=THREE.MathUtils.degToRad(camera.fov),aspect=(stage.clientWidth||1)/(stage.clientHeight||1);
 const hFov=2*Math.atan(Math.tan(vFov/2)*aspect);
 const d=Math.max(inspectSize.y/2/Math.tan(vFov/2),inspectSize.x/2/Math.tan(hFov/2))*1.42+inspectSize.z/2;
 inspectTarget.copy(inspectMid);inspectPos.set(inspectMid.x+d*.16,inspectMid.y+d*.07,inspectMid.z+d*.98);controls.target.copy(inspectMid);}
function setInspect(value){inspect=value;document.body.classList.toggle('inspecting',value);$('#inspect').innerHTML=value?'<span>Close</span> ✕':'Explore in 3D';
 const help=$('details.emu-help');if(help&&innerWidth<=760)help.open=false;
 if(controls){controls.enabled=false;if(value)fitInspect();}}
$('#inspect').onclick=()=>setInspect(!inspect);
$('#replay').onclick=()=>{setInspect(false);scrollTo({top:0,behavior:reduced?'instant':'smooth'})};

try {
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});const perf=detectPerformance(renderer.getContext());renderer.setPixelRatio(perf.dpr);console.info(`[badge] ${perf.gpu||'renderer hidden'} → tier ${perf.tier}, pixel ratio ${perf.dpr} (${perf.reason}) · ${perf.cores||'?'} cores, ${perf.memory||'?'} GB, dpr ${devicePixelRatio}`);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 const hemisphere=new THREE.HemisphereLight(0xe8edff,0x574339,.22);scene.add(hemisphere);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
 scene.environment=pmrem.fromScene(room,.04).texture;scene.environmentIntensity=.32;room.dispose();pmrem.dispose();
 const key=new THREE.DirectionalLight(0xffefd9,2.9);key.position.set(-130,160,220);key.castShadow=true;
 key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-180,right:180,top:180,bottom:-180,near:5,far:700});key.shadow.bias=-.0002;key.shadow.normalBias=.4;key.shadow.radius=3;scene.add(key);
 const fill=new THREE.DirectionalLight(0xdcdfff,.42);fill.position.set(170,30,110);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xcbb7ff,1.15);rim.position.set(30,100,-150);scene.add(rim);
 mat.shell=new THREE.MeshPhysicalMaterial({color:'#9465d3',roughness:.56,metalness:0,clearcoat:.14,clearcoatRoughness:.5});
 mat.yellow.roughness=.66;mat.silver.roughness=.29;mat.silver.metalness=.92;
 const grain=texture(256,256,(c,w,h)=>{const a=c.createImageData(w,h);let seed=742;for(let i=0;i<a.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=110+(seed%44);a.data[i]=a.data[i+1]=a.data[i+2]=v;a.data[i+3]=255}c.putImageData(a,0,0)});
 grain.colorSpace=THREE.NoColorSpace;grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(1,1);
 mat.shell.bumpMap=grain;mat.shell.bumpScale=.055;mat.rear=mat.shell.clone();mat.rear.color.copy(mat.yellow.color);
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const ao=new GTAOPass(scene,camera,512,512);ao.updateGtaoMaterial({radius:5,thickness:2,distanceExponent:1.8,distanceFallOff:1,samples:8,screenSpaceRadius:false});ao.updatePdMaterial({radius:4,depthPhi:2,normalPhi:4});ao.blendIntensity=.85;
 const originalVisibility=ao._overrideVisibility.bind(ao);ao._overrideVisibility=()=>{originalVisibility();scene.traverseVisible(o=>{if(o.isMesh&&o.material.transparent){ao._visibilityCache.push(o);o.visible=false}})};
 composer.addPass(ao);composer.addPass(new OutputPass());
 const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},contrast:{value:1},saturation:{value:1}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D tDiffuse; uniform float contrast; uniform float saturation; varying vec2 vUv; void main(){vec4 c=texture2D(tDiffuse,vUv);float l=dot(c.rgb,vec3(.2126,.7152,.0722));c.rgb=mix(vec3(l),c.rgb,saturation);c.rgb=(c.rgb-.5)*contrast+.5;gl_FragColor=vec4(clamp(c.rgb,0.,1.),c.a);}'});composer.addPass(grade);
 const fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);
 camera.position.set(100,45,390);camera.lookAt(0,8,0);
 controls=new OrbitControls(camera,canvas);controls.enabled=false;controls.enableDamping=true;controls.enableZoom=false;controls.enablePan=false;controls.target.set(0,7,0);controls.minPolarAngle=.22;controls.maxPolarAngle=Math.PI-.22;
 await document.fonts.load('16px Dingos');
 const loader=new STLLoader();
 const [geos,menuCap,arrowCap]=await Promise.all([Promise.all(['shell-0','shell-1',...Array.from({length:7},(_,i)=>`cap-${i}`)].map(n=>loader.loadAsync(`assets/${n}.stl`))),loadGLB('assets/menu-cap.glb'),loadGLB('assets/arrow-cap.glb')]);
 // The centre cap is a modelled part: unit radius, face at y=0 looking down -y, inlay recessed into it. Re-seat it face-up at z=0, 6.75 mm radius like the printed caps.
 for(const {geometry} of menuCap){geometry.rotateX(-Math.PI/2);geometry.rotateZ(Math.PI);geometry.scale(6.75,6.75,6.75);}
 // The arrow cap is modelled pointing up; the next button reuses it turned over.
 for(const {geometry} of arrowCap){geometry.rotateX(-Math.PI/2);geometry.scale(6.75,6.75,6.75);}
 geos[0].rotateY(Math.PI);geos[1].translate(-80,0,0);
 for(const g of geos){const a=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(a.count*2);for(let i=0;i<a.count;i++){const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));uv[i*2]=(x>z?a.getY(i):a.getX(i))/10;uv[i*2+1]=(z>=x&&z>=y?a.getY(i):a.getZ(i))/10}g.setAttribute('uv',new THREE.BufferAttribute(uv,2))}
 const face=part(front,'Front enclosure',[0,0,0],[0,0,10],1);mesh(face,geos[0],mat.shell);badgeShells.push(face);
 const rear=part(back,'Rear enclosure',[0,0,-16],[0,0,-8],1);mesh(rear,geos[1],mat.rear);badgeShells.push(rear);
 // The two shells and all seven finish caps are tessellated from the supplied CAD.
 decal(face,53,23,[0,44,.08],(c,w,h)=>{const pad=h*.035,size=h*.5;c.fillStyle='#f2eddd';c.font=`${size}px Dingos,Arial Black`;c.textBaseline='top';const y1=pad+c.measureText('THREE').actualBoundingBoxAscent,lh=size*.9;c.fillText('THREE',0,y1,w*.9);c.fillText('CONF',0,y1+lh,w*.8);const r=h*.29,cx=w-pad-r,cy=h-pad-r;c.fillStyle='#f1d128';c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fill();c.save();c.translate(cx,cy);c.rotate(-.15);c.fillStyle='#171220';c.textAlign='center';c.textBaseline='middle';c.font=`${h*.26}px Dingos`;c.fillText('.JS',0,0);c.restore();},900);
 decal(face,39,14,[0,-53.7,.09],(c,w,h)=>{c.fillStyle='#f1d12c';c.beginPath();c.roundRect(0,0,w,h,22);c.fill();c.fillStyle='#221a2d';c.textAlign='center';c.font=`${h*.29}px Dingos`;c.fillText('BRUNO SIMON',w/2,h*.47,w*.87);c.font=`bold ${h*.17}px Arial`;c.fillText('THREE.JS JOURNEY',w/2,h*.74)});
 // Display module, modeled to the measured CAD footprint.
 const display=part(front,'GC9B72 display',[0,3,-3.64],[4,4,-38],3);
 const screenCv=document.createElement('canvas');screenCv.width=screenCv.height=360;screenCtx=screenCv.getContext('2d');screenTexture=new THREE.CanvasTexture(screenCv);screenTexture.colorSpace=THREE.SRGBColorSpace;
 screenMesh=buildDisplay(display,new THREE.MeshBasicMaterial({map:screenTexture,toneMapped:false}));
 // The screen is a display, not a surface: it is drawn again after the composer so neither the tone
 // mapping nor the colour grade touches the emulator's pixels (layer 1 is that second, exact pass).
 screenMesh.layers.enable(1);
 const tapHint=mesh(front,new THREE.RingGeometry(7.4,8.8,56),new THREE.MeshBasicMaterial({color:'#f4d13a',transparent:true,opacity:0,depthWrite:false,toneMapped:false}),[0,-38.5,3.9]);tapHint.castShadow=tapHint.receiveShadow=false;tapHint.visible=false;
 const firmware=new FirmwareDisplay(screenCtx,screenTexture);

 const keys={ArrowLeft:1,ArrowUp:1,ArrowRight:2,ArrowDown:2,' ':4,Enter:4};
 canvas.addEventListener('keydown',e=>{if(active===10&&keys[e.key]){e.preventDefault();firmware.hold(keys[e.key],true)}});canvas.addEventListener('keyup',e=>{if(keys[e.key]){e.preventDefault();firmware.hold(keys[e.key],false)}});addEventListener('blur',()=>firmware.release());
 // DevKit with RF can, antenna, headers, USB connectors and surface components.
 const esp=part(back,'ESP32-S3 N16R8',[0,27.3,-12.5],[-11,22,38],6);
 buildESP(esp);
 // Landscape foil pouch on the rear shelf.
 const battery=part(back,'LiPo 505060',[0,-32.2,-11],[-8,-7,43],5);
 buildBattery(battery);

 // USB-C charger and boost board; no SD module or power switch in this revision.
 const charger=part(front,'TP4056 + boost',[5.5,-55.9,-4.05],[15,-16,-33],4);
 buildCharger(charger);
 // Stripboard and the four flat 100 kOhm resistors.
 const strip=part(front,'Ground bus + dividers',[-16.4,-51.5,-2.5],[ -15,-7,-44],6.8);
 buildStrip(strip);
 // Three actual tactile switches behind the separate print caps.
 const switches=[];
 const buttonPositions=[[-19.802,-33.471],[0,-38.5],[19.802,-33.471]];
 buttonPositions.forEach(([x,y],i)=>{const sw=part(front,'Tactile switch '+(i+1),[x,y,-3],[i===0?-4:i===2?4:0,-3,26],2);sw.userData.dropIn=true;switches.push(sw);buildSwitch(sw);});
 // Two spools of silicone hook-up wire sit on the bench; runs are cut from them.
 for(const [name,color,spin] of [['Wire spool 1','#d5312b',.45],['Wire spool 2','#23262d',-2.3]]){
  const sp=part(front,name,[0,0,-30],[0,0,-20],5);sp.userData.benchOnly=true;
  buildSpool(sp,color,spin);
 }
 // Finish caps use connected components from small_parts.stl, preserving engravings.
 let menuCapPart=null;const capParts=[];
 buttonPositions.forEach(([x,y],i)=>{const cap=part(front,['Previous button','Menu button','Next button'][i],[x,y,1.5],[0,0,44],10);cap.userData.dropIn=true;capParts[i]=cap;if(i===1){menuCapPart=cap;menuCap.forEach(({geometry,material},k)=>{const m=mesh(cap,geometry,k===0?mat.rear:material);m.userData.button=i;clickables.push(m);});return;}
 arrowCap.forEach(({geometry,material},k)=>{const g=i===2?geometry.clone().rotateZ(Math.PI):geometry;const m=mesh(cap,g,k===0?mat.shell:material);m.userData.button=i;clickables.push(m);});return;
 });
 for(const x of [-26,26])for(const y of [-60,60]){
 const insert=part(back,'M2 brass insert',[x,y,-10.8],[0,0,18],1);cyl(insert,1.75,4,mat.gold,[0,0,0]);cyl(insert,.8,4.05,mat.black,[0,0,0]);
 const screw=part(front,'M2×12 screw',[x,y,-5.4],[0,0,52],9.1);screw.userData.dropIn=true;cyl(screw,1,10,mat.silver,[0,0,0]);const cone=new THREE.CylinderGeometry(1.9,1,1.8,24);cone.rotateX(Math.PI/2);mesh(screw,cone,mat.silver,[0,0,5]);box(screw,2,.4,.12,mat.black,[0,0,5.95]);
 const cap=part(front,'Screw cap',[x,y,-.3],[0,0,44],10);cap.userData.dropIn=true;mesh(cap,geos[5],mat.shell);
 }
 const bar=part(back,'Strap bar',[0,63.8,-8],[0,20,25],9);buildStrapBar(bar);
 const mobileBench=innerWidth<=760;
 const cables=createCables(badge,{display,esp,battery,charger,strip,switches,shellFront:face,shellRear:rear,ribbonAt:mobileBench?[-20,166]:[-4,99]});
 // The opening is a real, lit cutting mat with a metric grid and laid-out parts.
 const workbench=new THREE.Group();badge.add(workbench);
 const matW=mobileBench?260:420,matH=mobileBench?360:250;
 const matTexture=texture(mobileBench?1300:2048,mobileBench?1800:1280,(c,w,h)=>{
 c.fillStyle='#174b43';c.fillRect(0,0,w,h);const sx=w/matW,sy=h/matH;
 c.strokeStyle='#71998c';c.lineWidth=1;
 for(let x=10;x<matW;x+=5){c.globalAlpha=x%10===0?.5:.22;c.beginPath();c.moveTo(x*sx,12*sy);c.lineTo(x*sx,(matH-14)*sy);c.stroke()}
 for(let y=12;y<matH-12;y+=5){c.globalAlpha=(y-12)%10===0?.5:.22;c.beginPath();c.moveTo(10*sx,y*sy);c.lineTo((matW-10)*sx,y*sy);c.stroke()}
 c.globalAlpha=.75;c.strokeStyle='#a5bca6';c.lineWidth=2;c.strokeRect(10*sx,12*sy,(matW-20)*sx,(matH-25)*sy);
 c.font='16px monospace';c.fillStyle='#bdd0b9';c.textAlign='center';
 for(let x=20;x<=matW-20;x+=10)c.fillText(String(x),x*sx,9*sy);
 for(let y=22;y<=matH-20;y+=10)c.fillText(String(y-12),5*sx,y*sy);
 c.textAlign='left';c.font='bold 20px monospace';c.fillText('THREE CONF / MAKER WORKBENCH',13*sx,(matH-5)*sy);c.font='15px monospace';c.textAlign='right';c.fillText('SELF-HEALING · mm',(matW-13)*sx,(matH-5)*sy);
 c.globalAlpha=.3;c.lineWidth=1;c.beginPath();c.moveTo(10*sx,(matH-20)*sy);c.lineTo(matW*.54*sx,15*sy);c.stroke();
 });
 const shape=new THREE.Shape();const w=matW,h=matH,r=6;shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
 const cutting=mesh(workbench,new THREE.ExtrudeGeometry(shape,{depth:1.7,bevelEnabled:true,bevelThickness:.2,bevelSize:.2,bevelSegments:2,steps:1}),material('#163f38',.92),[0,0,-2]);
 const topGeo=new THREE.ShapeGeometry(shape,12),uv=topGeo.attributes.uv,positions=topGeo.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,(positions.getX(i)+w/2)/w,(positions.getY(i)+h/2)/h);
 const top=mesh(workbench,topGeo,new THREE.MeshStandardMaterial({map:matTexture,roughness:.94,bumpMap:grain,bumpScale:.025}),[0,0,-.09]);top.castShadow=false;
 for(const m of [cutting.material,top.material]){m.transparent=true;m.depthWrite=false;}
 const benchPos=mobileBench?{
 'Front enclosure':[44,-95,10.7,0], 'Rear enclosure':[-44,-95,2,0],
 'GC9B72 display':[-72,120,7,0], 'ESP32-S3 N16R8':[78,72,4,0],
 'LiPo 505060':[-66,60,4,0], 'TP4056 + boost':[10,72,5,Math.PI],
 'Ground bus + dividers':[10,44,4,Math.PI],
 'Tactile switch 1':[-50,8,4,0], 'Tactile switch 2':[-30,8,4,0], 'Tactile switch 3':[-10,8,4,0],
 'Previous button':[18,8,2.5,0], 'Menu button':[38,8,2.5,0], 'Next button':[58,8,2.5,0],
 'Strap bar':[98,8,2,0], 'Wire spool 1':[84,140,7.5,0], 'Wire spool 2':[40,140,7.5,0]
 }:{
 'Front enclosure':[131,28,10.7,0], 'Rear enclosure':[57,28,2,0],
 'GC9B72 display':[-155,36,7,0], 'ESP32-S3 N16R8':[-26,36,4,0],
 'LiPo 505060':[-31,-41,4,0], 'TP4056 + boost':[-108,-28,5,Math.PI],
 'Ground bus + dividers':[-177,-42,4,Math.PI],
 'Tactile switch 1':[-141,-71,4,0], 'Tactile switch 2':[-121,-70,4,0], 'Tactile switch 3':[-101,-70,4,0],
 'Previous button':[-10,-100,2.5,0], 'Menu button':[14,-100,2.5,0], 'Next button':[38,-100,2.5,0],
 'Strap bar':[64,112,2,0], 'Wire spool 1':[-65,55,7.5,0], 'Wire spool 2':[-96,70,7.5,0]
 };
 let insertIndex=0,screwIndex=0,capIndex=0;
 for(const p of animated){let a=benchPos[p.userData.name];if(p.userData.name==='M2 brass insert')a=mobileBench?[-114+insertIndex++*14,8,2.5,0]:[-88+insertIndex++*20,-97,2.5,0];if(p.userData.name==='M2×12 screw')a=mobileBench?[-100+screwIndex++*20,-172,1.2,0]:[148+screwIndex++*18,-90,1.2,0];if(p.userData.name==='Screw cap')a=mobileBench?[10+capIndex++*24,-172,.1,0]:[62+capIndex++*25,-92,.1,0];p.userData.bench=new THREE.Vector3(...a.slice(0,3));p.userData.bench0=[a[0],a[1]];p.userData.z0=a[2];p.userData.benchRotation=a[3];}
 // Clay focus: while a part's card is open, everything else drops its materials.
 const clayMat=new THREE.MeshStandardMaterial({color:'#d6d1da',roughness:.92});
 $('#tidy-up').addEventListener('click',()=>{for(const p of physParts){const b=p.userData.body,[x,y]=p.userData.bench0;b.position.set(x,y,b.shapes[0].halfExtents.z);b.quaternion.set(0,0,0,1);b.velocity.setZero();b.angularVelocity.setZero();b.wakeUp();}dirty=true;});
 const partCard=document.querySelector('#part-detail'),partSelect=document.querySelector('#part-select'),partsPicker=document.querySelector('.parts-picker');
 let clayActive=null;
 function setClay(name){
  if(clayActive===name)return;
  const restore=m=>{if(m.isMesh){if(m.userData.__om){m.material=m.userData.__om;delete m.userData.__om;}if(m.userData.__hid){m.visible=true;delete m.userData.__hid;}}};
  for(const p of animated)p.traverse(restore);workbench.traverse(restore);cables.group.traverse(restore);
  clayActive=name;
  if(!name)return;
  for(const p of animated){if(p.userData.name===name)continue;p.traverse(m=>{if(m.isMesh){if(m.material.transparent){m.userData.__hid=1;m.visible=false;}else{m.userData.__om=m.material;m.material=clayMat;}}});}
  workbench.traverse(m=>{if(m.isMesh){m.userData.__om=m.material;m.material=clayMat;}});
  cables.group.traverse(m=>{if(m.isMesh){m.userData.__om=m.material;m.material=clayMat;}});
 }
 // Hover glow on the exact part under the pointer (materials are shared, so clone per mesh).
 let glowPart=null;
 function setGlow(p){
  if(glowPart===p)return;
  if(glowPart)glowPart.traverse(m=>{if(m.isMesh&&m.userData.__hm){m.material.dispose();m.material=m.userData.__hm;delete m.userData.__hm;}});
  glowPart=p;
  if(p)p.traverse(m=>{const mt=m.material;if(!m.isMesh||!mt||Array.isArray(mt)||mt.isShaderMaterial||!mt.emissive||mt.transparent||m.userData.__om)return;try{const c=mt.clone();c.emissive=new THREE.Color('#fff2dc');c.emissiveIntensity=.16;m.userData.__hm=mt;m.material=c;}catch(err){}});
 }
 const parallax={x:0,y:0,tx:0,ty:0};
 addEventListener('pointermove',e=>{parallax.tx=e.clientX/innerWidth*2-1;parallax.ty=e.clientY/innerHeight*2-1;},{passive:true});
 const renderSettings=createRenderSettings({renderer,scene,camera,key,fill,rim,hemisphere,ao,mat,grade});
 const partsInfo=createPartsInfo();
 const adaptive=createAdaptiveRatio(perf.dpr,(dpr,median)=>{renderer.setPixelRatio(dpr);resize();console.info(`[badge] frames at ${median.toFixed(1)} ms, pixel ratio lowered to ${dpr}`);});
 function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);composer.setSize(w,h);const ratio=renderer.getPixelRatio();fxaa.uniforms.resolution.value.set(1/(w*ratio),1/(h*ratio));updateTarget()};resize();addEventListener('resize',resize);
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down,capDown=false;
 const atPointer=(e,objects)=>{const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(objects,true)[0];};
 const badgeAt=e=>atPointer(e,screenMesh?[...badgeShells,screenMesh]:badgeShells);
 // Parts can be picked up and rearranged on the cutting mat.
 let dragPart=null,partDragging=false,dragStart=null;
 const dragPlane=new THREE.Plane(),dragPoint=new THREE.Vector3(),dragLocal=new THREE.Vector3(),dragNormal=new THREE.Vector3(),dragQuat=new THREE.Quaternion(),dragOff={x:0,y:0};
 // Half-extents of each part's footprint on the mat, for drag collisions.
 const FOOT={'Front enclosure':[35,69],'Rear enclosure':[35,69],'GC9B72 display':[32,38],'ESP32-S3 N16R8':[16,34],'LiPo 505060':[32,27],'TP4056 + boost':[14,11],'Ground bus + dividers':[9,12],'Tactile switch 1':[5,5],'Tactile switch 2':[5,5],'Tactile switch 3':[5,5],'Previous button':[6.5,6.5],'Menu button':[6.5,6.5],'Next button':[6.5,6.5],'M2 brass insert':[3,3],'M2×12 screw':[3,8],'Screw cap':[4.5,4.5],'Strap bar':[17,3.5],'Wire spool 1':[15.5,15.5],'Wire spool 2':[15.5,15.5]};
 const TOPH={'Front enclosure':9,'Rear enclosure':9,'GC9B72 display':8,'ESP32-S3 N16R8':7,'LiPo 505060':7.5,'TP4056 + boost':6,'Ground bus + dividers':4,'Tactile switch 1':6,'Tactile switch 2':6,'Tactile switch 3':6,'Previous button':3.5,'Menu button':3.5,'Next button':3.5,'M2 brass insert':5,'M2×12 screw':2.4,'Screw cap':2.5,'Strap bar':5,'Wire spool 1':15.5,'Wire spool 2':15.5};
 // Rigid-body workbench: every part is a box on the mat (mm units), with walls at the mat edges.
 const physWorld=new CANNON.World({gravity:new CANNON.Vec3(0,0,-2600)});physWorld.allowSleep=true;physWorld.solver.iterations=28;physWorld.solver.tolerance=.0005;
 physWorld.defaultContactMaterial.friction=.4;physWorld.defaultContactMaterial.restitution=0;physWorld.defaultContactMaterial.contactEquationStiffness=4e7;physWorld.defaultContactMaterial.contactEquationRelaxation=5;physWorld.defaultContactMaterial.frictionEquationStiffness=2e7;physWorld.defaultContactMaterial.frictionEquationRelaxation=5;
 physWorld.addBody(new CANNON.Body({mass:0,shape:new CANNON.Plane()}));
 for(const [x,y,hx,hy] of [[0,matH/2-3,matW/2+20,6],[0,-(matH/2-3),matW/2+20,6],[matW/2+4,0,6,matH/2+15],[-(matW/2+4),0,6,matH/2+15]]){const w=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(hx,hy,60))});w.position.set(x,y,60);physWorld.addBody(w);}
 const physParts=[];
 for(const p of animated){const nm=p.userData.name,f=FOOT[nm];if(!p.userData.bench||!f)continue;const h=TOPH[nm];
  const body=new CANNON.Body({mass:nm.includes('enclosure')?4:Math.max(.3,f[0]*f[1]*h/800),shape:new CANNON.Box(new CANNON.Vec3(f[0],f[1],h/2)),linearDamping:.55,angularDamping:.75,allowSleep:true,sleepSpeedLimit:22,sleepTimeLimit:.35});
  body.position.set(p.userData.bench.x,p.userData.bench.y,h/2);physWorld.addBody(body);
  p.userData.body=body;p.userData.originOffset=new CANNON.Vec3(0,0,p.userData.z0-h/2);p.userData.benchQuat=new THREE.Quaternion();physParts.push(p);}
 function syncPhysics(){for(const p of physParts){const b=p.userData.body,w=b.quaternion.vmult(p.userData.originOffset);p.userData.bench.set(b.position.x+w.x,b.position.y+w.y,b.position.z+w.z);p.userData.benchQuat.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);}}
 syncPhysics();
 const dragTarget=new THREE.Vector2(),brushPlane=new THREE.Plane(),brushPrev={part:null,x:0,y:0},hoveredHit=new THREE.Vector3();
 function benchPartAt(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);for(const h of ray.intersectObjects(animated,true)){let p=h.object;while(p&&!p.userData.name)p=p.parent;if(p&&p.userData.bench)return {p,point:h.point};}return null;}
 canvas.addEventListener('pointerdown',e=>{if(current<.35){inspectPart(e);const hit=benchPartAt(e);if(hit){dragPart=hit.p;partDragging=false;dragStart=[e.clientX,e.clientY];dragPlane.setFromNormalAndCoplanarPoint(dragNormal.set(0,0,1).applyQuaternion(badge.getWorldQuaternion(dragQuat)),hit.point);badge.worldToLocal(dragLocal.copy(hit.point));dragOff.x=dragLocal.x-dragPart.userData.bench.x;dragOff.y=dragLocal.y-dragPart.userData.bench.y;dragTarget.set(dragPart.userData.bench.x,dragPart.userData.bench.y);if(dragPart.userData.body)dragPart.userData.body.wakeUp();brushPrev.part=null;if(e.pointerType!=='touch')canvas.setPointerCapture(e.pointerId);}}down=[e.clientX,e.clientY];if((active===7||active===8)&&cables.startDrag(e,camera,canvas)){canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';}if(active!==10)return;const hit=atPointer(e,clickables);capDown=!!hit;if(hit){firmware.hold([1,4,2][hit.object.userData.button],true);canvas.setPointerCapture(e.pointerId);}});
 canvas.addEventListener('pointerup',e=>{
 if(e.pointerType==='touch'&&dragPart&&!partDragging&&current<.35){partsInfo.show(dragPart.userData.name,innerWidth/2-145,innerHeight-300,true);}
 if(e.pointerType==='touch'){hoveredName=null;hoveredPartRef=null;peek.hidden=true;}
 // A tap on the finished badge — anywhere but a button cap — is the way into Explore.
 if(active===10&&!inspect&&!capDown&&down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<10&&badgeAt(e))setInspect(true);
 capDown=false;
 dragPart=null;partDragging=false;canvas.style.cursor='';firmware.release();cables.endDrag();if((active===7||active===8)&&down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<10)cables.pick(e,camera,canvas)});
 canvas.addEventListener('pointercancel',()=>{dragPart=null;partDragging=false;firmware.release();cables.endDrag();});canvas.addEventListener('lostpointercapture',()=>firmware.release());
 const peek=document.querySelector('#peek');let hoveredAnchor=new THREE.Vector3(),hoveredIsPart=false,hoveredPartRef=null;
 function inspectPart(e,pin=false){if(current>.35)return;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects([...animated,cables.group],true);if(hits.length){let p=hits[0].object;while(p&&!p.userData.name)p=p.parent;if(p){hoveredName=p.userData.name;hoveredIsPart=!!p.userData.bench;hoveredPartRef=hoveredIsPart?p:null;hoveredHit.copy(hits[0].point);if(!hoveredIsPart)hoveredAnchor.copy(hits[0].point);canvas.style.cursor=hoveredIsPart?'grab':'';return;}}if(!peek.hidden){const pb=peek.getBoundingClientRect();if(e.clientX>pb.left-24&&e.clientX<pb.right+24&&e.clientY>pb.top-20&&e.clientY<pb.bottom+44){canvas.style.cursor='';return;}}hoveredName=null;hoveredPartRef=null;if(!partsInfo.pinned)partsInfo.hide();canvas.style.cursor='';}
 let peekSticky=false;
 peek.addEventListener('pointerenter',()=>peekSticky=true);
 document.addEventListener('pointerdown',e=>{if(partCard.hidden)return;const t=e.target;if(t.closest&&(t.closest('#part-detail')||t.closest('#peek')||t.closest('.parts-picker')))return;partsInfo.hide(true);},true);
 peek.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();const n=peek.dataset.name;if(n)partsInfo.show(n,e.clientX,e.clientY+18,true);});
 canvas.addEventListener('pointermove',e=>{
 if(dragPart&&current<.35){
  if(!partDragging){const dx=e.clientX-dragStart[0],dy=e.clientY-dragStart[1];
   if(e.pointerType==='touch'){if(Math.abs(dy)>6&&Math.abs(dy)>=Math.abs(dx)){dragPart=null;return;}
    if(Math.abs(dx)<10)return;
    canvas.setPointerCapture(e.pointerId);}
   if(Math.hypot(dx,dy)>4){partDragging=true;partsInfo.hide(true);}}
  if(partDragging){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);
   if(ray.ray.intersectPlane(dragPlane,dragPoint)){badge.worldToLocal(dragLocal.copy(dragPoint));dragTarget.set(clamp(dragLocal.x-dragOff.x,-(matW/2-14),matW/2-14),clamp(dragLocal.y-dragOff.y,-(matH/2-17),matH/2-17));}
   hoveredName=dragPart.userData.name;canvas.style.cursor='grabbing';e.preventDefault();return;}}
 if(!partsInfo.pinned)inspectPart(e);
 if(active===10&&!inspect&&e.pointerType!=='touch')canvas.style.cursor=(atPointer(e,clickables)||badgeAt(e))?'pointer':'';
 // Brushing: sliding the pointer across a part nudges it, as if grazed by a hand.
 if(current<.35&&!dragPart&&hoveredPartRef&&hoveredPartRef.userData.body){
  brushPlane.setFromNormalAndCoplanarPoint(dragNormal.set(0,0,1).applyQuaternion(badge.getWorldQuaternion(dragQuat)),hoveredHit);
  const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);
  if(ray.ray.intersectPlane(brushPlane,dragPoint)){badge.worldToLocal(dragLocal.copy(dragPoint));
   if(brushPrev.part===hoveredPartRef){const b=hoveredPartRef.userData.body,m=b.mass;const push=renderSettings.settings.hoverPush;let ix=(dragLocal.x-brushPrev.x)*m*16*push,iy=(dragLocal.y-brushPrev.y)*m*16*push;const L=Math.hypot(ix,iy),cap=m*180*push;if(L>cap){ix*=cap/L;iy*=cap/L;}
    badge.worldToLocal(shellA.copy(hoveredHit));b.wakeUp();b.applyImpulse(new CANNON.Vec3(ix,iy,0),new CANNON.Vec3(shellA.x-b.position.x,shellA.y-b.position.y,Math.min(shellA.z-b.position.z,b.shapes[0].halfExtents.z)));}
   brushPrev.part=hoveredPartRef;brushPrev.x=dragLocal.x;brushPrev.y=dragLocal.y;}
 }else brushPrev.part=null;
 if(active===7||active===8){cables.moveDrag(e,camera,canvas);const near=cables.hover(e,camera,canvas);canvas.style.cursor=cables.dragging?'grabbing':near?'grab':'';}});canvas.addEventListener('pointerleave',e=>{const t=e.relatedTarget;if(t&&(t.id==='peek'||t.closest&&t.closest('#peek')))return;hoveredName=null;hoveredPartRef=null;partsInfo.hide();});peek.addEventListener('pointerleave',e=>{peekSticky=false;if(e.relatedTarget===canvas)return;hoveredName=null;hoveredPartRef=null;});
 const YAXIS=new THREE.Vector3(0,1,0),XAXIS=new THREE.Vector3(1,0,0),shellA=new THREE.Vector3(),shellB=new THREE.Vector3(),qTmp=new THREE.Quaternion(),qFlip=new THREE.Quaternion(),qA=new THREE.Quaternion(),qB=new THREE.Quaternion();
 let stageBlend=-1;
 let lastTime=performance.now();
 const fpsEl=document.querySelector('#fps');let fpsTicks=0,fpsRenders=0,fpsAt=performance.now(),lastRender=0,dirty=true,inputAt=0;
 const touch=()=>{dirty=true;inputAt=performance.now();};for(const ev of ['pointermove','pointerdown','pointerup','wheel','touchmove','keydown'])addEventListener(ev,touch,{passive:true});addEventListener('resize',touch);addEventListener('scroll',touch,{passive:true});
 const depthOnly=new THREE.MeshBasicMaterial({colorWrite:false});
 function drawScreenExact(){if(!screenMesh)return;
  const auto=renderer.autoClear;renderer.autoClear=false;
  scene.overrideMaterial=depthOnly;camera.layers.enableAll();renderer.clearDepth();renderer.render(scene,camera);
  scene.overrideMaterial=null;camera.layers.set(1);renderer.render(scene,camera);
  camera.layers.set(0);renderer.autoClear=auto;}
 function frame(time){requestAnimationFrame(frame);if(document.hidden)return;const dt=Math.min((time-lastTime)/1000,.05);lastTime=time;if(capState.bornAt<0)capState.bornAt=coverRevealed?time+120:time+1e5;current=reduced?target:lerp(current,target,1-Math.exp(-dt*8));
 fpsTicks++;if(time-fpsAt>500){const f=Math.round(fpsTicks*1000/(time-fpsAt));if(fpsEl)fpsEl.textContent=(fpsRenders<fpsTicks*.6?`${f} fps · idle`:`${f} fps`)+` · ×${renderer.getPixelRatio()}`;fpsTicks=0;fpsRenders=0;fpsAt=time;}
 const leaveBench=smooth(current,.12,1.15),opened=leaveBench*(1-smooth(current,8.45,9.2));
 const shellFlip=1-smooth(current,2.25,2.62),frontYaw=2.88-Math.PI*shellFlip;
 const swing=Math.sin(Math.PI*Math.min(1,opened))*smooth(current,1.2,10);front.position.set(47*opened,0,26*swing);front.rotation.y=frontYaw*opened;back.position.set(-47*opened,0,-6*swing);back.rotation.y=-.13*opened;
 document.body.classList.toggle('on-bench',current<.35&&coverT>=COVER_DONE);document.body.classList.toggle('at-finale',active===10);if(current>=.35)partsInfo.hide(true);setClay(current<.35&&partsInfo.pinned&&!partCard.hidden&&partSelect.value?partSelect.value:null);setGlow(current<.35&&!clayActive?(partDragging?dragPart:hoveredPartRef):null);if(current<.35){
 if(partDragging&&dragPart&&dragPart.userData.body){const b=dragPart.userData.body,tz=TOPH[dragPart.userData.name]/2+26;b.wakeUp();let vx=(dragTarget.x-b.position.x)*14,vy=(dragTarget.y-b.position.y)*14;const L=Math.hypot(vx,vy),cap=900;if(L>cap){vx*=cap/L;vy*=cap/L;}b.velocity.set(vx,vy,(tz-b.position.z)*14);b.angularVelocity.set(0,0,0);b.quaternion.set(0,0,0,1);}
 physWorld.step(1/120,Math.min(dt,.05),8);syncPhysics();}
 workbench.visible=current<1.12;cutting.material.opacity=1;top.material.opacity=1;workbench.position.set(0,-260*leaveBench,0);workbench.rotation.x=-.85*leaveBench;const matC=Math.cos(workbench.rotation.x),matS=Math.sin(workbench.rotation.x);
 const stageClose=smooth(current,8.7,10),stageKey=leaveBench+stageClose;if(hoveredName&&current<.35&&!partDragging&&!inspect){peek.dataset.name=hoveredName;if(hoveredPartRef){shellB.set(hoveredPartRef.userData.bench.x,hoveredPartRef.userData.bench.y,hoveredPartRef.userData.bench.z+(TOPH[hoveredName]||6)+4);badge.localToWorld(shellB);}else shellB.copy(hoveredAnchor);shellB.project(camera);const r2=canvas.getBoundingClientRect();peek.style.left=(r2.left+(shellB.x+1)*r2.width/2)+'px';peek.style.top=(r2.top+(1-shellB.y)*r2.height/2-34)+'px';peek.hidden=false;}else if(!peekSticky||current>=.35)peek.hidden=true;
 {// The canvas always fills the window; the framing rectangle is applied as a camera view offset, so nothing is ever cropped.
 const mobile=innerWidth<=760,W=stage.clientWidth,H=stage.clientHeight;
 const l=lerp(mobile?0:4,mobile?0:38,leaveBench),r=lerp(mobile?0:4,mobile?0:1,leaveBench);
 let benchTop=13,benchH=81;{const cb=benchCopy.getBoundingClientRect(),bb=bomCta.getBoundingClientRect();
  const floor=mobile?Math.min(bb.top-10,H-34-(partsPicker.offsetHeight||56)-8):bb.top-18;
  const t0=clamp(cb.bottom+(mobile?10:22),70,H*.5),b0=clamp(floor,H*.5,H-16);
  benchTop=t0/H*100;benchH=Math.max(b0-t0,H*.32)/H*100;}
 let stepTopPct=58,stepHPct=36;
 if(mobile){const ci=clamp(Math.round(current)-1,0,copies.length-1),cc=copies[ci];
  // Aim at where the copy will sit once stuck (STICK + its height), not at where it is
  // mid-slide: the band keeps one steady home per step instead of being pushed down.
  const cb=Math.min(cc.getBoundingClientRect().bottom,STICK+cc.offsetHeight);
  const t0=clamp(cb+14,H*.28,H*(ci===copies.length-1?.66:.58)),floor=H-72,k=bandTop<0?1:Math.min(1,dt*6);
  bandTop=bandTop<0?t0:lerp(bandTop,t0,k);bandBottom=bandBottom<0?floor:lerp(bandBottom,floor,k);
  stepTopPct=bandTop/H*100;stepHPct=Math.max(bandBottom-bandTop,H*.3)/H*100;}
 const top0=lerp(benchTop,mobile?stepTopPct:6,leaveBench),h0=lerp(benchH,mobile?stepHPct:89,leaveBench);
 const t=lerp(top0,mobile?stepTopPct:1,stageClose),hh=lerp(h0,mobile?stepHPct:99,stageClose);
 let vx=W*l/100,vw=W*(100-l-r)/100,vy=H*t/100,vh=H*hh/100;
 if(inspectE>0){vx=lerp(vx,0,inspectE);vy=lerp(vy,0,inspectE);vw=lerp(vw,W,inspectE);vh=lerp(vh,H,inspectE);}
 camera.aspect=vw/vh;camera.setViewOffset(vw,vh,-vx,-vy,W,H);camera.updateProjectionMatrix();
 if(mobile&&inspectE<.5){for(let i=0;i<copies.length;i++){const c=copies[i],rc=c.getBoundingClientRect();if(rc.bottom<0||rc.top>H)continue;
  // A chapter only reads once it has climbed to its sticky spot; on the way up it stays
  // fully out of the way, so no ghost text ever crosses the badge between steps.
  c.style.opacity=c.parentNode.classList.contains('finale')?clamp((vy-rc.bottom)/90+1,.12,1)
   :Math.min(clamp((vy-rc.bottom)/70+1,0,1),clamp((H*.4-rc.top)/(H*.18),0,1));}}else if(copies[1].style.opacity!==''){for(const c of copies)c.style.opacity='';}}

 for(const p of animated){const {home,offset,phase,bench,benchRotation,name}=p.userData;
 p.userData.lift=0;
 if(p.userData.benchOnly){p.visible=current<1.05;p.scale.setScalar(1);shellA.copy(bench);shellA.z=bench.z+p.userData.lift;const sy=shellA.y,sz=shellA.z;shellA.y=sy*matC-sz*matS-260*leaveBench;shellA.z=sy*matS+sz*matC;shellA.sub(p.parent.position).applyAxisAngle(YAXIS,-p.parent.rotation.y);p.position.copy(shellA);p.quaternion.setFromAxisAngle(XAXIS,workbench.rotation.x).multiply(qTmp.setFromAxisAngle(YAXIS,-p.parent.rotation.y)).multiply(p.userData.benchQuat).multiply(qFlip.setFromAxisAngle(YAXIS,benchRotation));continue;}
 const entryStart=phase<=1?.3:phase-.6,entryEnd=Math.min(phase+.2,10),entry=smooth(current,entryStart,entryEnd);
 const isShell=phase===1;
 p.visible=current<1.05||entry>0||isShell;
 const size=isShell||current<1.05?1:entry;
 p.scale.setScalar(Math.max(.001,size));
 const destination=home.clone().addScaledVector(offset,(1-entry)*.42);
 if(isShell){const g=p.parent,tShell=name==='Front enclosure'?smooth(leaveBench,.3,1):smooth(leaveBench,0,.7);shellB.copy(destination).applyAxisAngle(YAXIS,g.rotation.y).add(g.position);shellA.copy(bench).lerp(shellB,tShell);const arcT=Math.sin(Math.PI*tShell);shellA.y+=42*arcT;shellA.z+=34*arcT;shellA.sub(g.position).applyAxisAngle(YAXIS,-g.rotation.y);p.position.copy(shellA);if(tShell>=1)p.rotation.set(0,0,0);else{qA.setFromAxisAngle(YAXIS,-g.rotation.y).multiply(p.userData.benchQuat).multiply(qFlip.setFromAxisAngle(YAXIS,benchRotation));qB.setFromAxisAngle(YAXIS,lerp(benchRotation,name==='Front enclosure'?frontYaw:-.13,tShell)-g.rotation.y);p.quaternion.slerpQuaternions(qA,qB,smooth(tShell,0,.35));}}else if(entry>0){p.position.copy(destination);if(p.userData.dropIn)p.position.z+=44*(1-entry)**1.6;else p.position.y-=55*(1-entry);}else{shellA.copy(bench);const by=shellA.y,bz=shellA.z;shellA.y=by*matC-bz*matS-260*leaveBench;shellA.z=by*matS+bz*matC;shellA.sub(p.parent.position).applyAxisAngle(YAXIS,-p.parent.rotation.y);p.position.copy(shellA);}if(p.userData.lift>.01)p.position.z+=p.userData.lift*(1-leaveBench);if(!isShell){if(entry>0)p.rotation.set(0,lerp(benchRotation,0,entry),0);else p.quaternion.setFromAxisAngle(XAXIS,workbench.rotation.x).multiply(qTmp.setFromAxisAngle(YAXIS,-p.parent.rotation.y)).multiply(p.userData.benchQuat||qA.identity()).multiply(qFlip.setFromAxisAngle(YAXIS,benchRotation)).multiply(qB.setFromAxisAngle(XAXIS,name==='M2×12 screw'?Math.PI/2:0));}
 }
 inspectT=clamp(inspectT+(inspect?dt/.85:-dt/.6),0,1);inspectE=easeInOut(inspectT);if(controls)controls.enabled=inspect&&inspectT>=1;
 if(!(inspect&&inspectT>=1)){const close=smooth(current,8.7,10);badge.rotation.set(lerp(-.96,lerp(-.11,.025,close),leaveBench),lerp(0,lerp(-.05,-.2,close),leaveBench),lerp(0,lerp(-.04,-.06,close),leaveBench));
 const widthNeeded=lerp(mobileBench?300:540,lerp(mobileBench?186:214,mobileBench?104:120,close),leaveBench),heightNeeded=lerp(mobileBench?300:242,lerp(mobileBench?162:200,mobileBench?176:221,close),leaveBench);
 const dist=Math.max(heightNeeded,widthNeeded/camera.aspect)/(2*Math.tan(THREE.MathUtils.degToRad(16)));frameDist=dist;
 parallax.x=lerp(parallax.x,parallax.tx,Math.min(1,dt*3.5));parallax.y=lerp(parallax.y,parallax.ty,Math.min(1,dt*3.5));const px=reduced?0:parallax.x,py=reduced?0:parallax.y;camera.position.set(lerp(0,lerp(85,24,close),leaveBench)+px*lerp(14,9,leaveBench),lerp(0,lerp(38,12,close),leaveBench)-py*lerp(9,6,leaveBench),dist);storyLook.set(lerp(0,lerp(6,0,close),leaveBench)+px*lerp(4,2,leaveBench),lerp(0,lerp(-1,2,close),leaveBench)-py*lerp(3,2,leaveBench),0);camera.lookAt(storyLook);
 if(coverT<1){const e=easeIntro(coverT),eL=easeIntro(clamp(coverT/.8,0,1)),tx=lerp(0,lerp(6,0,close),leaveBench)+px*lerp(4,2,leaveBench),ty=lerp(0,lerp(-1,2,close),leaveBench)-py*lerp(3,2,leaveBench);
  // Start high above and ahead of the bench, looking at the horizon; descend and tilt down until the mat fills the frame.
  camera.position.set(lerp(tx,camera.position.x,e),lerp(ty+dist*.95,camera.position.y,e)+Math.sin(Math.PI*e)*dist*.06,lerp(dist*.5,camera.position.z,e));camera.lookAt(tx,lerp(ty+dist*.95,ty,eL),lerp(-dist,0,eL));storyLook.set(tx,lerp(ty+dist*.95,ty,eL),lerp(-dist,0,eL));}
  if(inspectE>0){camera.position.lerp(inspectPos,inspectE);camera.lookAt(blendLook.lerpVectors(storyLook,inspectTarget,inspectE));}
 }else controls.update();
 if(menuCapPart&&coverT<1){camera.updateMatrixWorld();const cap=menuCapPart,rc=capSlot.getBoundingClientRect(),capT=easeIntro(clamp((coverT-.45)/.55,0,1));
  capState.hx=lerp(capState.hx,capState.tx,Math.min(1,dt*7));capState.hy=lerp(capState.hy,capState.ty,Math.min(1,dt*7));capState.press=lerp(capState.press,0,Math.min(1,dt*5));
  const spin=easeBack(clamp((time-capState.spinAt)/850,0,1))*Math.PI*2,born=reduced?1:easeBack(clamp((time-capState.bornAt)/900,0,1));
  capV.set((rc.left+rc.width/2)/innerWidth*2-1,-(rc.top+rc.height/2)/innerHeight*2+1,.5).unproject(camera).sub(camera.position).normalize();capP.copy(camera.position).addScaledVector(capV,frameDist*.32);
  capU.set(0,1,0).applyQuaternion(camera.quaternion);capA.copy(capP).project(camera);capB.copy(capP).addScaledVector(capU,1).project(camera);const pxPerMm=Math.hypot((capB.x-capA.x)*innerWidth/2,(capB.y-capA.y)*innerHeight/2);
  const titleScale=Math.max(.05,rc.width*.96/(13.5*pxPerMm))*born*(1-capState.press*.16);
  capE.set(Math.sin(time*.0007+1)*.1+capState.hy*.38,Math.sin(time*.0011)*.26+capState.hx*.45+spin+capT*Math.PI*2.5,capT*Math.PI*.6);capQ.copy(camera.quaternion).multiply(capQ2.setFromEuler(capE));
  front.updateWorldMatrix(true,false);capLocal.copy(capP);front.worldToLocal(capLocal);front.getWorldQuaternion(capQ2).invert().multiply(capQ);
  benchQ.copy(cap.quaternion);capB.copy(cap.position);cap.position.lerpVectors(capLocal,capB,capT);cap.position.z+=Math.sin(Math.PI*capT)*40;cap.quaternion.slerpQuaternions(capQ2,benchQ,capT);cap.scale.setScalar(lerp(titleScale,1,capT));}
 else if(menuCapPart&&!capHandedOver){capHandedOver=true;menuCapPart.scale.setScalar(1);}
 {const live=current>9.9||inspect;if(firmware.mask)pressedOnce=true;
  for(let i=0;i<3;i++){const c=capParts[i];if(!c)continue;const want=live&&(firmware.mask&[1,4,2][i])?1:0;c.userData.press=lerp(c.userData.press||0,want,Math.min(1,dt*20));if(c.userData.press>.002)c.position.z-=c.userData.press*1.2;}
  const hint=live&&!pressedOnce;tapHint.visible=hint;
  if(hint){const t=(time%2400)/2400,k=1-Math.pow(1-Math.min(t*1.6,1),3);tapHint.scale.setScalar(lerp(.55,1.45,k));tapHint.material.opacity=.6*(1-k)*smooth(current,9.9,9.98);}}
 cables.update(current,dt);firmware.tick(dt,current>9.98);
 // Render on demand: when nothing moves, drop to a slow idle cadence to keep the GPU cool.
 const physicsAwake=current<.35&&(partDragging||physParts.some(p=>p.userData.body.sleepState!==2));
 const busy=dirty||time-inputAt<700||inspect||inspectT>0||partDragging||physicsAwake||Math.abs(current-target)>5e-4||Math.abs(parallax.x-parallax.tx)+Math.abs(parallax.y-parallax.ty)>2e-3||(current>6.7&&current<9.7)||current>9.9;
 if(busy||time-lastRender>(coverT<1?32:250)){composer.render();if(current>9.5||inspect)drawScreenExact();if(busy)adaptive.frame(time);else adaptive.reset();lastRender=time;fpsRenders++;dirty=false;}
 }
 $('#loading').classList.add('hidden');updateTarget();requestAnimationFrame(frame);markSceneReady();
} catch(error){console.error(error);$('#loading').textContent='The 3D view could not load. Reload the page to try again; the assembly guide is available below.';$('#loading').classList.add('error');revealCover()}

const BOM=[['Front enclosure',1],['Rear enclosure',1],['GC9B72 display',1],['ESP32-S3 N16R8',1],['LiPo 505060',1],['TP4056 + boost',1],['Ground bus + dividers',1],['Tactile switch 1',3,'Tactile switches','6 \u00d7 6 \u00d7 5 mm \u00b7 GPIO 20 (previous), 21 (centre) and 19 (next). Hold previous at boot for Wi-Fi OTA.'],['Previous button',1],['Menu button',1],['Next button',1],['M2 brass insert',4],['M2\u00d712 screw',4],['Screw cap',4],['Strap bar',1],['Wire kit',1],['Wire spool 1',1],['Wire spool 2',1]];
const bomRows=BOM.map(([key,qty,label,alt])=>{const [title,note0,href]=PARTS[key],note=alt||note0;return `<tr><td>${qty} \u00d7</td><td>${label||title}<p>${note}</p></td><td><a href="${href}" target="_blank" rel="noopener">reference \u2197</a></td></tr>`}).join('');
const details={
 wiring:`<p class="eyebrow">BENCH REFERENCE</p><h2>Make every connection count.</h2><h3>Display ribbon · 5–6 cm</h3><table><thead><tr><th>Display pad</th><th>ESP32-S3</th><th>Wire</th></tr></thead><tbody>${[['GND','GND','Brown'],['VCC','3V3','Red'],['SCL / SCLK','GPIO 14','Orange'],['SDA / MOSI','GPIO 13','Yellow'],['RST','GPIO 12','Green'],['DC','GPIO 11','Blue'],['CS','GPIO 10','Violet'],['BL','GPIO 9','Grey'],['SDO','Not connected','White — trim'],['TE','GPIO 3','Black']].map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')}</tbody></table><h3>Buttons & power</h3><p>Previous → GPIO 20 · Next → GPIO 19 · Centre → GPIO 21. Each switch returns to the ground bus. TP4056 OUT+ → DevKit 5V; OUT− → GND. Battery red → B+; black → B−.</p><h3>Five-strip sensing board</h3><p>1: B+ · 2: GPIO 1 midpoint · 3: common GND · 4: GPIO 2 midpoint · 5: TP4056 IN+ / VBUS. Four 100 kΩ resistors bridge strips 1–2, 2–3, 3–4 and 4–5. Lay the resistor bodies flat.</p><p>Never connect B+ directly to a GPIO. Sense charge from IN+ on the rear of the charging board, not the permanently powered boost output. Use Wi-Fi OTA; the native DevKit USB pins are assigned to buttons.</p><p><a target="_blank" rel="noopener" href="https://claude.ai/code/artifact/2f3f80b4-be6a-4256-8994-c7800f24ea67">Read the complete original assembly document ↗</a></p>`,
 bom:`<p class="eyebrow">BILL OF MATERIALS</p><h2>Everything it takes.</h2><p>One badge, eighteen line items. Quantities are per badge, and each link points at the part this build was sourced from.</p><p class="bom-sheet"><a href="https://docs.google.com/spreadsheets/d/1EfUPVHs7wSwlldLFNaDVboAn1Yhtki07MRFuqXJAVWQ/edit?gid=1969714195#gid=1969714195" target="_blank" rel="noopener">Open the purchase spreadsheet \u2197</a></p><table class="bom-list">${bomRows}</table><p class="small-note">Also on the bench: 4 \u00d7 100 k\u03a9 resistors, \u00d81.5\u20132 mm heat-shrink, thin double-sided tape for the battery, a dot of CA glue for the caps, kapton every 3 cm. Wire lengths are per route \u2014 see <a href="guide.html#tools" target="_blank" rel="noopener">Materials &amp; tools</a> in the full doc.</p>`,
 power:`<p class="eyebrow">FIELD FIX \u00b7 POWER</p><h2>It never really switched off.</h2><p><b>What happened.</b> Badges that came back from the event were flat, and some cells were below their protection threshold. Nothing on this build physically cuts the battery: the TP4056 + boost module stays wired to B+, and its 5 V boost keeps drawing around 0.3 mA even while the firmware sleeps. Left in a drawer, a 2000 mAh pouch is emptied in a few weeks \u2014 then it sits in deep discharge, which is what actually kills a LiPo.</p><p><b>The fix.</b> A slide switch in series on B+, between the cell and the module. Off means zero current, not standby current.</p><table><tbody><tr><td>Part</td><td>TRU <b>TC-R13-603C-05</b> \u00b7 SPDT, 3 A / 125 VAC</td></tr><tr><td>Body</td><td>Flange 19.5 \u00d7 8 mm \u00b7 5.8 mm deep under the flange \u00b7 lever slot 6 \u00d7 3.5 mm \u00b7 two \u00d82.6 holes, 14.3 mm apart</td></tr><tr><td>Where</td><td>Through the <b>rear</b> shell, in the clear band beside the ESP32 on the buttons side \u2014 only three wires run there, while the other side carries the 5 V feed and the display ribbon. Closed, it sits on the right-hand edge seen from the front.</td></tr><tr><td>Seat</td><td>0.5 mm counterbore so the flange is flush and the lever stands about 2.1 mm proud, a 0.6 mm dish around the slot for your finger, and two printed \u00d82 pins to melt over the flange holes with a soldering iron \u2014 the 1.3 mm of wall left is too thin to screw into, and the operating force is taken by the counterbore walls, not the pins.</td></tr><tr><td>Wiring</td><td>Cut the red B+ lead. Cell + \u2192 switch common; switch pole \u2192 TP4056 <b>B+</b>. Black B\u2212 stays direct to B\u2212. Check polarity before reconnecting.</td></tr></tbody></table><p class="small-note">The current CAD already carries the seat, the lever slot and the pins in the rear shell, so a freshly printed badge only needs the switch itself. A cell that has already sat below ~2.5 V should be replaced rather than coaxed back with the TP4056 \u2014 and until the switch is fitted, store the badge on charge or with the battery unplugged.</p>`,
};
for(const b of document.querySelectorAll('[data-detail]'))b.onclick=()=>{$('#detail-body').innerHTML=details[b.dataset.detail];$('#detail').showModal()};for(const b of document.querySelectorAll('.close-dialog'))b.onclick=()=>b.closest('dialog').close();$('#detail').addEventListener('click',e=>{if(e.target===$('#detail')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
