// The finished badge on its own: the same scene, materials and firmware the assembly page
// ends on, with no story around it — made to be dropped into an <iframe> on another site.
import * as THREE from 'three';
import { mat, mesh, cyl, texture, decal, planarUVs, buildDisplay, buildStrapBar } from './parts.js?v=72';
import { FirmwareDisplay } from './emulator-display.js?v=72';
import { loadGLB } from './glb.js?v=72';
import { detectPerformance, createAdaptiveRatio } from './perf.js?v=72';
import { DEFAULTS, applyRenderSettings } from './render-state.js?v=72';
import { STLLoader } from './vendor/STLLoader.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const options=new URLSearchParams(location.search);
const flag=(name,fallback)=>options.has(name)?!/^(0|false|no|off)$/i.test(options.get(name)):fallback;
const number=(name,fallback)=>{const v=Number.parseFloat(options.get(name));return Number.isFinite(v)?v:fallback};
// Lilac backdrop by default; the host page can ask for another colour, or ?bg=transparent.
if(options.get('bg'))document.body.style.background=options.get('bg');
const canvas=document.querySelector('#scene'),loading=document.querySelector('#loading'),hint=document.querySelector('#hint');
// The hand invites the first gesture, then gets out of the way for good.
if(!flag('hint',true))hint.remove();
const dropHint=()=>{if(hint.isConnected){document.body.classList.remove('hinting');setTimeout(()=>hint.remove(),600)}};
for(const ev of ['pointerdown','keydown','wheel'])canvas.addEventListener(ev,dropHint,{passive:true});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),lerp=(a,b,t)=>a+(b-a)*t;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,innerWidth/innerHeight,1,4000);
const badge=new THREE.Group();scene.add(badge);
const front=new THREE.Group(),back=new THREE.Group();badge.add(front,back);
const clickables=[],capParts=[];let screenMesh=null,renderer,controls;

try {
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
 const perf=detectPerformance(renderer.getContext());renderer.setPixelRatio(perf.dpr);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 const hemisphere=new THREE.HemisphereLight(0xe8edff,0x574339,.22);scene.add(hemisphere);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
 scene.environment=pmrem.fromScene(room,.04).texture;scene.environmentIntensity=.32;room.dispose();pmrem.dispose();
 const key=new THREE.DirectionalLight(0xffefd9,2.9);key.position.set(-130,160,220);key.castShadow=true;
 key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-180,right:180,top:180,bottom:-180,near:5,far:700});
 key.shadow.bias=-.0002;key.shadow.normalBias=.4;key.shadow.radius=3;scene.add(key,key.target);
 const fill=new THREE.DirectionalLight(0xdcdfff,.42);fill.position.set(170,30,110);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xcbb7ff,1.15);rim.position.set(30,100,-150);scene.add(rim);
 mat.shell=new THREE.MeshPhysicalMaterial({color:'#9465d3',roughness:.56,metalness:0,clearcoat:.14,clearcoatRoughness:.5});
 mat.yellow.roughness=.66;mat.silver.roughness=.29;mat.silver.metalness=.92;
 const grain=texture(256,256,(c,w,h)=>{const a=c.createImageData(w,h);let seed=742;for(let i=0;i<a.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=110+(seed%44);a.data[i]=a.data[i+1]=a.data[i+2]=v;a.data[i+3]=255}c.putImageData(a,0,0)});
 grain.colorSpace=THREE.NoColorSpace;grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(1,1);
 mat.shell.bumpMap=grain;mat.shell.bumpScale=.055;mat.rear=mat.shell.clone();mat.rear.color.copy(mat.yellow.color);

 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
 const ao=new GTAOPass(scene,camera,512,512);ao.updateGtaoMaterial({radius:5,thickness:2,distanceExponent:1.8,distanceFallOff:1,samples:8,screenSpaceRadius:false});
 ao.updatePdMaterial({radius:4,depthPhi:2,normalPhi:4});ao.blendIntensity=.85;
 const originalVisibility=ao._overrideVisibility.bind(ao);ao._overrideVisibility=()=>{originalVisibility();scene.traverseVisible(o=>{if(o.isMesh&&o.material.transparent){ao._visibilityCache.push(o);o.visible=false}})};
 composer.addPass(ao);composer.addPass(new OutputPass());
 const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},contrast:{value:1},saturation:{value:1}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D tDiffuse; uniform float contrast; uniform float saturation; varying vec2 vUv; void main(){vec4 c=texture2D(tDiffuse,vUv);float l=dot(c.rgb,vec3(.2126,.7152,.0722));c.rgb=mix(vec3(l),c.rgb,saturation);c.rgb=(c.rgb-.5)*contrast+.5;gl_FragColor=vec4(clamp(c.rgb,0.,1.),c.a);}'});
 composer.addPass(grade);
 const fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);

 controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.enableZoom=flag('zoom',false);controls.enablePan=false;
 controls.minPolarAngle=.22;controls.maxPolarAngle=Math.PI-.22;
 // One finger turns the badge. ?drag=two leaves single-finger swipes to the host page.
 if(options.get('drag')==='two'){controls.touches={ONE:THREE.TOUCH.NONE,TWO:THREE.TOUCH.DOLLY_ROTATE};canvas.style.touchAction='pan-y';}
 controls.autoRotate=flag('spin',true)&&!reduced;controls.autoRotateSpeed=number('spinspeed',.55);

 await document.fonts.load('16px Dingos');
 const loader=new STLLoader();
 const [geos,menuCap,arrowCap]=await Promise.all([
  Promise.all(['shell-0','shell-1','cap-3'].map(n=>loader.loadAsync(`assets/${n}.stl`))),
  loadGLB('assets/menu-cap.glb'),loadGLB('assets/arrow-cap.glb')]);
 for(const {geometry} of menuCap){geometry.rotateX(-Math.PI/2);geometry.rotateZ(Math.PI);geometry.scale(6.75,6.75,6.75);}
 for(const {geometry} of arrowCap){geometry.rotateX(-Math.PI/2);geometry.scale(6.75,6.75,6.75);}
 geos[0].rotateY(Math.PI);geos[1].translate(-80,0,0);
 for(const g of geos)planarUVs(g);

 const shells=[];
 const shell=(parent,geometry,material,pos)=>{const g=new THREE.Group();g.position.fromArray(pos);parent.add(g);mesh(g,geometry,material);shells.push(g);return g};
 const face=shell(front,geos[0],mat.shell,[0,0,0]);
 const rear=shell(back,geos[1],mat.rear,[0,0,-16]);
 decal(face,53,23,[0,44,.08],(c,w,h)=>{const pad=h*.035,size=h*.5;c.fillStyle='#f2eddd';c.font=`${size}px Dingos,Arial Black`;c.textBaseline='top';const y1=pad+c.measureText('THREE').actualBoundingBoxAscent,lh=size*.9;c.fillText('THREE',0,y1,w*.9);c.fillText('CONF',0,y1+lh,w*.8);const r=h*.29,cx=w-pad-r,cy=h-pad-r;c.fillStyle='#f1d128';c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fill();c.save();c.translate(cx,cy);c.rotate(-.15);c.fillStyle='#171220';c.textAlign='center';c.textBaseline='middle';c.font=`${h*.26}px Dingos`;c.fillText('.JS',0,0);c.restore();},900);
 const name=options.get('name')||'BRUNO SIMON',role=options.get('role')||'THREE.JS JOURNEY';
 decal(face,39,14,[0,-53.7,.09],(c,w,h)=>{c.fillStyle='#f1d12c';c.beginPath();c.roundRect(0,0,w,h,22);c.fill();c.fillStyle='#221a2d';c.textAlign='center';c.font=`${h*.29}px Dingos`;c.fillText(name,w/2,h*.47,w*.87);c.font=`bold ${h*.17}px Arial`;c.fillText(role,w/2,h*.74,w*.87)});

 // The display, with the firmware drawing into its canvas texture.
 const display=new THREE.Group();display.position.set(0,3,-3.64);front.add(display);
 const screenCv=document.createElement('canvas');screenCv.width=screenCv.height=360;
 const screenCtx=screenCv.getContext('2d'),screenTexture=new THREE.CanvasTexture(screenCv);screenTexture.colorSpace=THREE.SRGBColorSpace;
 screenMesh=buildDisplay(display,new THREE.MeshBasicMaterial({map:screenTexture,toneMapped:false}));
 // The screen is a display, not a surface: it is drawn again after the composer so neither the
 // tone mapping nor the colour grade touches the emulator's pixels (layer 1 is that second pass).
 screenMesh.layers.enable(1);
 const tapHint=mesh(front,new THREE.RingGeometry(7.4,8.8,56),new THREE.MeshBasicMaterial({color:'#f4d13a',transparent:true,opacity:0,depthWrite:false,toneMapped:false}),[0,-38.5,3.9]);
 tapHint.castShadow=tapHint.receiveShadow=false;tapHint.visible=false;
 const firmware=new FirmwareDisplay(screenCtx,screenTexture);

 // The three printed caps, seated over the switches, and the four screw caps.
 const buttonPositions=[[-19.802,-33.471],[0,-38.5],[19.802,-33.471]];
 buttonPositions.forEach(([x,y],i)=>{
  const cap=new THREE.Group();cap.position.set(x,y,1.5);front.add(cap);capParts[i]=cap;cap.userData.press=0;
  const parts=i===1?menuCap:arrowCap;
  parts.forEach(({geometry,material},k)=>{const g=i===2?geometry.clone().rotateZ(Math.PI):geometry;
   const m=mesh(cap,g,k===0?(i===1?mat.rear:mat.shell):material);m.userData.button=i;clickables.push(m);});
 });
 for(const x of [-26,26])for(const y of [-60,60]){const cap=new THREE.Group();cap.position.set(x,y,-.3);front.add(cap);mesh(cap,geos[2],mat.shell);}
 const bar=new THREE.Group();bar.position.set(0,63.8,-8);back.add(bar);buildStrapBar(bar);

 applyRenderSettings({renderer,scene,camera,key,fill,rim,hemisphere,ao,mat,grade},DEFAULTS);

 // Framing: fit the two shells, the way the assembly page frames Explore in 3D.
 const box=new THREE.Box3(),size=new THREE.Vector3(),mid=new THREE.Vector3(),margin=number('margin',1.232);
 function fit(){
  box.makeEmpty();for(const g of shells)box.expandByObject(g);box.getSize(size);box.getCenter(mid);
  // The view zoom narrows the frustum, so the fit has to divide it out or the badge overflows.
  const vTan=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/camera.zoom,hTan=vTan*camera.aspect;
  const d=Math.max(size.y/2/vTan,size.x/2/hTan)*margin+size.z/2;
  controls.target.copy(mid);camera.position.set(mid.x+d*.16,mid.y+d*.07,mid.z+d*.98);controls.update();
 }
 function resize(){const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);composer.setSize(w,h);
  const r=renderer.getPixelRatio();fxaa.material.uniforms.resolution.value.set(1/(w*r),1/(h*r));fit();}
 addEventListener('resize',resize);resize();
 const adaptive=createAdaptiveRatio(perf.dpr,dpr=>{renderer.setPixelRatio(dpr);resize()});

 // Pressing a cap presses the real button, exactly as on the assembly page.
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let pressedOnce=false,idleAt=0;
 const atPointer=e=>{const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(clickables,true)[0]};
 canvas.addEventListener('pointerdown',e=>{controls.autoRotate=false;idleAt=performance.now();
  const hit=atPointer(e);if(hit){firmware.hold([1,4,2][hit.object.userData.button],true);canvas.setPointerCapture(e.pointerId);}});
 const letGo=()=>{firmware.release();idleAt=performance.now()};
 canvas.addEventListener('pointerup',letGo);canvas.addEventListener('pointercancel',letGo);canvas.addEventListener('lostpointercapture',()=>firmware.release());
 canvas.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')canvas.style.cursor=atPointer(e)?'pointer':'grab'});
 const keys={ArrowLeft:1,ArrowUp:1,ArrowRight:2,ArrowDown:2,' ':4,Enter:4};
 canvas.addEventListener('keydown',e=>{if(keys[e.key]){e.preventDefault();firmware.hold(keys[e.key],true)}});
 canvas.addEventListener('keyup',e=>{if(keys[e.key]){e.preventDefault();firmware.hold(keys[e.key],false)}});
 addEventListener('blur',()=>firmware.release());

 // Nothing renders while the iframe is off-screen or the tab is hidden.
 let onScreen=true;
 if('IntersectionObserver' in window){new IntersectionObserver(([entry])=>{onScreen=entry.isIntersecting},{threshold:.01}).observe(document.body);}

 const depthOnly=new THREE.MeshBasicMaterial({colorWrite:false});
 function drawScreenExact(){const auto=renderer.autoClear;renderer.autoClear=false;
  scene.overrideMaterial=depthOnly;camera.layers.enableAll();renderer.clearDepth();renderer.render(scene,camera);
  scene.overrideMaterial=null;camera.layers.set(1);renderer.render(scene,camera);
  camera.layers.set(0);renderer.autoClear=auto;}


 // The chip rides the badge: project its box each frame and hug the top-left corner it presents.
 const corner=new THREE.Vector3();let hintX=-1,hintY=-1;
 function placeHint(){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let i=0;i<8;i++){
   corner.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).project(camera);
   const sx=(corner.x*.5+.5)*innerWidth,sy=(1-(corner.y*.5+.5))*innerHeight;
   minX=Math.min(minX,sx);maxX=Math.max(maxX,sx);minY=Math.min(minY,sy);maxY=Math.max(maxY,sy);
  }
  // sit on the shoulder, not beside it: a share of the badge's own size inwards
  const x=minX+(maxX-minX)*.14,y=minY+(maxY-minY)*.075;
  const k=hintX<0?1:.12;                                    // settle, never jitter
  hintX=hintX<0?x:hintX+(x-hintX)*k;hintY=hintY<0?y:hintY+(y-hintY)*k;
  hint.style.setProperty('--x',Math.round(hintX)+'px');
  hint.style.setProperty('--y',Math.round(hintY)+'px');
  document.body.classList.add('hinting');
 }

 const spinWanted=flag('spin',true)&&!reduced;let last=performance.now();
 function frame(time){requestAnimationFrame(frame);
  if(document.hidden||!onScreen){last=time;return}
  const dt=Math.min((time-last)/1000,.05);last=time;
  if(spinWanted&&!controls.autoRotate&&time-idleAt>2600)controls.autoRotate=true;
  controls.update(dt);
  if(firmware.mask)pressedOnce=true;
  for(let i=0;i<3;i++){const c=capParts[i],want=(firmware.mask&[1,4,2][i])?1:0;
   c.userData.press=lerp(c.userData.press,want,Math.min(1,dt*20));c.position.z=1.5-c.userData.press*1.2;}
  tapHint.visible=!pressedOnce;
  if(!pressedOnce){const t=(time%2400)/2400,k=1-Math.pow(1-Math.min(t*1.6,1),3);tapHint.scale.setScalar(lerp(.55,1.45,k));tapHint.material.opacity=.6*(1-k);}
  firmware.tick(dt,true);
  composer.render();drawScreenExact();adaptive.frame(time);
 if(hint.isConnected)placeHint();
 }
 loading.classList.add('hidden');requestAnimationFrame(frame);
} catch(error){console.error(error);loading.textContent='The 3D badge could not load.';loading.classList.add('error');}
