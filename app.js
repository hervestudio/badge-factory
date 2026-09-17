import { createRenderSettings } from './render-settings.js';
import { createPartsInfo } from './parts-info.js';
import { FirmwareDisplay } from './emulator-display.js';
import { createCables } from './cables.js';
import * as THREE from 'three';
import * as CANNON from './vendor/cannon-es.js';
import { STLLoader } from './vendor/STLLoader.js';
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
const chapters=[...document.querySelectorAll('.chapter')];
const names=['THE MAKER’S WORKBENCH','PREPARE THE SHELLS','FIT THE SWITCHES','SEAT THE DISPLAY','INSTALL THE CHARGER','PLACE THE BATTERY','CONNECT THE ESP32','WIRE THE CONNECTIONS','TEST IT OPEN','CLOSE THE ENCLOSURE','READY FOR THREE CONF'];
let current=0,target=0,active=-1,inspect=false,renderer,screenTexture,screenCtx,screenMesh,hoveredName=null;
const animated=[],clickables=[];
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const smooth=(v,a,b)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,5,1500);
const badge=new THREE.Group(),front=new THREE.Group(),back=new THREE.Group();badge.add(front,back);scene.add(badge);
const material=(color,roughness=.5,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const mat={shell:material('#ad91e0',.72),yellow:material('#f2d22f',.55),pcb:material('#163c33',.66),blue:material('#1d4474',.6),chip:material('#1a1b23',.65),silver:material('#bdc3cc',.3,.72),gold:material('#d2aa55',.36,.7),white:material('#f1ede5'),black:material('#151321',.65)};
function mesh(parent,geometry,m,pos=[0,0,0]){const o=new THREE.Mesh(geometry,m);o.castShadow=!m.transparent;o.receiveShadow=true;o.position.fromArray(pos);parent.add(o);return o}
function box(parent,w,h,d,m,pos){return mesh(parent,(Math.min(w,h,d)>=1?new RoundedBoxGeometry(w,h,d,2,Math.min(.55,Math.min(w,h,d)*.16)):new THREE.BoxGeometry(w,h,d)),m,pos)}
function cyl(parent,r,h,m,pos){const g=new THREE.CylinderGeometry(r,r,h,48);g.rotateX(Math.PI/2);return mesh(parent,g,m,pos)}
function part(parent,name,pos,offset,phase){const g=new THREE.Group();g.position.fromArray(pos);g.userData={name,home:new THREE.Vector3(...pos),offset:new THREE.Vector3(...offset),phase};parent.add(g);animated.push(g);return g}
function texture(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
function decal(parent,w,h,pos,paint,res=512){const t=texture(res,Math.round(res*h/w),paint);const o=mesh(parent,new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,transparent:true,depthWrite:false,roughness:.64,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),pos);o.position.z+=Math.sign(o.position.z||1)*.12;return o}
function wire(parent,points,color,r=.37){return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),32,r,6,false),material(color,.62))}
function label(parent,text,w,h,pos,bg='#edf0e3',fg='#24252a'){return decal(parent,w,h,pos,(c,W,H)=>{c.fillStyle=bg;c.fillRect(0,0,W,H);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font=`bold ${H*.32}px monospace`;text.split('\n').forEach((s,i,a)=>c.fillText(s,W/2,H*(i+1)/(a.length+1),W*.93))})}

function updateTarget(){const y=scrollY+innerHeight*.18;let i=0;while(i<chapters.length-1&&y>=chapters[i+1].offsetTop)i++;const start=chapters[i].offsetTop;const next=chapters[i+1]?.offsetTop??start+chapters[i].offsetHeight;target=i===10?10:clamp(i+(y-start)/(next-start),0,10);if(scrollY<10)target=0;
 const a=clamp(Math.floor(target+.15),0,10);if(active!==a){active=a;$('#step-label').textContent=names[a];$('#step-count').textContent=String(a).padStart(2,'0')+' / 10';document.querySelectorAll('.step-nav a').forEach((el,j)=>{el.classList.toggle('active',j===a);if(j===a)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current')});$('#view-label').textContent=a===0?'ON THE CUTTING MAT':a===10?'ASSEMBLED / DRAG TO EXPLORE':a===9?'CLOSING THE ENCLOSURE':'OPEN ASSEMBLY / '+String(a).padStart(2,'0');if(a!==10&&inspect)setInspect(false)}$('#progress').style.width=(target*10)+'%';}
addEventListener('scroll',updateTarget,{passive:true});

let controls;
function setInspect(value){inspect=value;document.body.classList.toggle('inspecting',value);$('#inspect').textContent=value?'Reset view ↺':'Explore in 3D ↗';if(controls){controls.enabled=value;if(!value){camera.position.set(55,24,350);controls.target.set(0,7,0);controls.update()}}}
$('#inspect').onclick=()=>setInspect(!inspect);
$('#replay').onclick=()=>{setInspect(false);scrollTo({top:0,behavior:reduced?'instant':'smooth'})};

try {
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
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
 const ao=new GTAOPass(scene,camera,512,512);ao.updateGtaoMaterial({radius:5,thickness:2,distanceExponent:1.8,distanceFallOff:1,samples:12,screenSpaceRadius:false});ao.updatePdMaterial({radius:4,depthPhi:2,normalPhi:4});ao.blendIntensity=.85;
 const originalVisibility=ao._overrideVisibility.bind(ao);ao._overrideVisibility=()=>{originalVisibility();scene.traverseVisible(o=>{if(o.isMesh&&o.material.transparent){ao._visibilityCache.push(o);o.visible=false}})};
 composer.addPass(ao);composer.addPass(new OutputPass());
 const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},contrast:{value:1},saturation:{value:1}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D tDiffuse; uniform float contrast; uniform float saturation; varying vec2 vUv; void main(){vec4 c=texture2D(tDiffuse,vUv);float l=dot(c.rgb,vec3(.2126,.7152,.0722));c.rgb=mix(vec3(l),c.rgb,saturation);c.rgb=(c.rgb-.5)*contrast+.5;gl_FragColor=vec4(clamp(c.rgb,0.,1.),c.a);}'});composer.addPass(grade);
 const fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);
 camera.position.set(100,45,390);camera.lookAt(0,8,0);
 controls=new OrbitControls(camera,canvas);controls.enabled=false;controls.enableDamping=true;controls.enableZoom=false;controls.enablePan=false;controls.target.set(0,7,0);controls.minPolarAngle=.22;controls.maxPolarAngle=Math.PI-.22;
 await document.fonts.load('16px Dingos');
 const loader=new STLLoader();
 const geos=await Promise.all(['shell-0','shell-1',...Array.from({length:7},(_,i)=>`cap-${i}`)].map(n=>loader.loadAsync(`assets/${n}.stl`)));
 geos[0].rotateY(Math.PI);geos[1].translate(-80,0,0);
 for(const g of geos){const a=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(a.count*2);for(let i=0;i<a.count;i++){const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));uv[i*2]=(x>z?a.getY(i):a.getX(i))/10;uv[i*2+1]=(z>=x&&z>=y?a.getY(i):a.getZ(i))/10}g.setAttribute('uv',new THREE.BufferAttribute(uv,2))}
 const face=part(front,'Front enclosure',[0,0,0],[0,0,10],1);mesh(face,geos[0],mat.shell);
 const rear=part(back,'Rear enclosure',[0,0,-16],[0,0,-8],1);mesh(rear,geos[1],mat.rear);
 // The two shells and all seven finish caps are tessellated from the supplied CAD.
 decal(face,53,23,[0,44,.08],(c,w,h)=>{c.fillStyle='#f2eddd';c.font=`${h*.51}px Dingos,Arial Black`;c.textBaseline='top';c.fillText('THREE',0,-h*.02,w*.9);c.fillText('CONF',0,h*.46,w*.8);c.fillStyle='#f1d128';c.beginPath();c.arc(w*.88,h*.67,h*.30,0,Math.PI*2);c.fill();c.save();c.translate(w*.88,h*.67);c.rotate(-.15);c.fillStyle='#171220';c.textAlign='center';c.textBaseline='middle';c.font=`${h*.26}px Dingos`;c.fillText('.JS',0,0);c.restore()});
 decal(face,39,14,[0,-53.7,.09],(c,w,h)=>{c.fillStyle='#f1d12c';c.beginPath();c.roundRect(0,0,w,h,22);c.fill();c.fillStyle='#221a2d';c.textAlign='center';c.font=`${h*.29}px Dingos`;c.fillText('BRUNO SIMON',w/2,h*.47,w*.87);c.font=`bold ${h*.17}px Arial`;c.fillText('THREE.JS JOURNEY',w/2,h*.74)});
 // Display module, modeled to the measured CAD footprint.
 const display=part(front,'GC9B72 display',[0,3,-3.64],[4,4,-38],3);
 cyl(display,29.62,1.6,mat.blue,[0,0,-1.4]);box(display,30.5,13,1.6,mat.blue,[0,-30.7,-1.4]);
 cyl(display,27.96,2.5,material('#0c0c18',.2,.12),[0,0,.4]);
 const screenCv=document.createElement('canvas');screenCv.width=screenCv.height=360;screenCtx=screenCv.getContext('2d');screenTexture=new THREE.CanvasTexture(screenCv);screenTexture.colorSpace=THREE.SRGBColorSpace;
 screenMesh=mesh(display,new THREE.CircleGeometry(26.8,96),new THREE.MeshBasicMaterial({map:screenTexture,toneMapped:false}),[0,0,1.82]);
 for(let i=0;i<10;i++){cyl(display,.7,.3,mat.gold,[-11.43+i*2.54,-33, -.45]);box(display,.65,3,.65,mat.gold,[-11.43+i*2.54,-34.5,-2.6])}
 const firmware=new FirmwareDisplay(screenCtx,screenTexture);
 firmware.bind($('#prev-screen'),1);firmware.bind($('#next-screen'),2);firmware.bind($('#menu-screen'),4);
 const keys={ArrowLeft:1,ArrowUp:1,ArrowRight:2,ArrowDown:2,' ':4,Enter:4};
 canvas.addEventListener('keydown',e=>{if(active===10&&keys[e.key]){e.preventDefault();firmware.hold(keys[e.key],true)}});canvas.addEventListener('keyup',e=>{if(keys[e.key]){e.preventDefault();firmware.hold(keys[e.key],false)}});addEventListener('blur',()=>firmware.release());
 // Silkscreen and components on the display PCB's reverse side.
 const displaySilk=label(display,'TFT 2.1 0_10\nGC9B72   360×360',36,10,[0,13,-2.24],'#204d75','#cad4df');displaySilk.rotation.y=Math.PI;
 box(display,8,6,1,mat.chip,[0,-14,-2.6]);
 for(let i=0;i<6;i++){box(display,1.2,2,.65,i%2?mat.silver:mat.chip,[-12+i*4,-20,-2.6]);wire(display,[[-11+i*4,-30,-2.25],[-11+i*4,-25,-2.25],[-8+i*3,-18,-2.25]],'#63899a',.12)}
 // DevKit with RF can, antenna, headers, USB connectors and surface components.
 const esp=part(back,'ESP32-S3 N16R8',[0,27.3,-12.5],[-11,22,38],6);
 box(esp,28.2,64.4,1.6,material('#16181c',.5),[0,0,0]);box(esp,18,20,2.6,mat.silver,[0,12,2.1]);label(esp,'ESPRESSIF\nESP32-S3\nN16R8',10,7.5,[0,12,3.43],'#c8cbd0','#43484e');
 box(esp,16,10,.2,mat.black,[0,26.3,.94]);
 for(let i=0;i<5;i++){box(esp,1,6,.12,mat.gold,[-6+i*3,27,1.1]);if(i<4)box(esp,3,1,.12,mat.gold,[-4.5+i*3,i%2?24.5:29.5,1.1])}
 for(let side of [-1,1])for(let i=0;i<22;i++){const x=side*12,y=27-i*2.54;cyl(esp,.82,.16,mat.gold,[x,y,1]);box(esp,.55,.55,3,mat.gold,[x,y,-1.7]);}
 box(esp,8,8,1.4,mat.chip,[0,-9,1.5]);for(let i=0;i<14;i++)box(esp,1.2,2,.8,i%3?mat.chip:mat.silver,[-8+(i%4)*5,-19+Math.floor(i/4)*6,1.1]);
 for(const x of [-6,6]){box(esp,8.2,6.4,2.5,mat.silver,[x,-28.8,2]);box(esp,6.7,.2,1.3,mat.black,[x,-32.1,2]);box(esp,3,4,1,mat.silver,[x,-20,1.5]);box(esp,1.5,2,1,mat.black,[x,-20,2.3])}
 label(esp,'ESP32-S3',15,3,[0,-3,1],'#16181c','#c9ced6');
 // Landscape foil pouch on the rear shelf.
 const battery=part(back,'LiPo 505060',[0,-32.2,-11],[-8,-7,43],5);
 box(battery,60,50,4.8,mat.silver,[0,0,0]);box(battery,60.8,4.6,5.4,mat.yellow,[0,23.1,0]);box(battery,60.8,2.6,5.4,mat.yellow,[0,-24.1,0]);
 for(const x of [-29.9,29.9])box(battery,1.4,50.6,5.4,mat.yellow,[x,0,0]);
 decal(battery,47,29,[0,0,2.43],(c,w,h)=>{c.fillStyle='#c7c9cd';c.fillRect(0,0,w,h);c.fillStyle='#42464c';c.font=`${h*.12}px monospace`;c.textAlign='center';['Li-ion POLYMER','505060   3.7 V','2000 mAh   7.4 Wh','+                  −'].forEach((t,i)=>c.fillText(t,w/2,h*(.25+i*.16)));});

 // USB-C charger and boost board; no SD module or power switch in this revision.
 const charger=part(front,'TP4056 + boost',[5.5,-55.9,-5.2],[15,-16,-33],4);
 box(charger,24,18,1.1,material('#16181c',.5),[0,0,0]);box(charger,7,7,3,mat.chip,[-5,1,-2]);box(charger,5,4,1.1,mat.chip,[5,2,-1.3]);box(charger,1.3,1.1,.5,material('#e04338',.35),[1.8,-6.5,-1.4]);box(charger,1.3,1.1,.5,material('#3f7de0',.35),[4,-6.5,-1.4]);
 const usb=box(charger,8.5,6,3.1,mat.silver,[-5.5,-8,-2]);box(charger,6.9,.2,1.8,mat.black,[-5.5,-11.1,-2]);
 for(let i=0;i<4;i++){cyl(charger,1,.2,mat.gold,[-9+i*6,7,-.65]);box(charger,1.3,2,.8,mat.silver,[-8+i*5,-3,-1])}
 const powerText=label(charger,'TP4056  5V',17,3,[0,0,-3.6],'#16181c','#c9ced6');powerText.rotation.y=Math.PI;
 // Stripboard and the four flat 100 kOhm resistors.
 const strip=part(front,'Ground bus + dividers',[-16.4,-51.5,-2.5],[ -15,-7,-44],6.8);
 box(strip,12.7,20.3,1.2,material('#94713c'),[0,0,0]);
 for(let i=0;i<5;i++){box(strip,1.4,19,.1,mat.gold,[-5.08+i*2.54,0,-.66]);for(let j=0;j<8;j++){const hole=cyl(strip,.43,.15,mat.black,[-5.08+i*2.54,-8.89+j*2.54,-.76]);}}
 for(let i=0;i<4;i++){const x=-5.08+i*2.54,y=-6+i*4;box(strip,1.8,1.5,1.4,material('#acd4df'),[x+1.27,y,-1.5]);wire(strip,[[x,y,-.8],[x+.5,y,-1.5],[x+2,y,-1.5],[x+2.54,y,-.8]],'#c0c4c6',.13)}
 // Three actual tactile switches behind the separate print caps.
 const switches=[];
 const buttonPositions=[[-19.802,-33.471],[0,-38.5],[19.802,-33.471]];
 buttonPositions.forEach(([x,y],i)=>{const sw=part(front,'Tactile switch '+(i+1),[x,y,-3],[i===0?-18:i===2?18:0,-8,-24],2);switches.push(sw);box(sw,6,6,3.5,mat.black,[0,0,-1.8]);box(sw,5.8,5.8,.5,mat.silver,[0,0,.2]);cyl(sw,1.7,1.3,mat.black,[0,0,1]);for(const sx of [-1,1])for(const sy of [-1,1])box(sw,.55,2.8,.45,mat.silver,[sx*3.2,sy*3.3,-1]);});
 // Two spools of silicone hook-up wire sit on the bench; runs are cut from them.
 for(const [name,color,spin] of [['Wire spool 1','#d5312b',.45],['Wire spool 2','#23262d',-2.3]]){
  const sp=part(front,name,[0,0,-30],[0,0,-20],5);sp.userData.benchOnly=true;
  const roll=new THREE.Group();sp.add(roll);roll.rotation.z=spin;
  for(const z of [-6.6,6.6])cyl(roll,14,1.8,mat.white,[0,0,z]);
  cyl(roll,11.6,11,material(color,.6),[0,0,0]);
  cyl(roll,4.4,15.4,mat.white,[0,0,0]);
  for(const z of [-2.8,.4,3.1])mesh(roll,new THREE.TorusGeometry(11.6,.5,10,48),material(color,.5),[0,0,z]);
  wire(roll,[[11.4,0,3],[16.5,3.5,-.5],[21.5,8,-4],[26,13,-6.7]],color,.6);
 }
 // Finish caps use connected components from small_parts.stl, preserving engravings.
 buttonPositions.forEach(([x,y],i)=>{const cap=part(front,['Previous button','Menu button','Next button'][i],[x,y,1.5],[i===0?-14:i===2?14:0,-8,92],10);const g=geos[i===1?2:i===0?3:4].clone();g.rotateY(Math.PI);const m=mesh(cap,g,i===1?mat.yellow:mat.shell);m.userData.button=i;clickables.push(m);
 decal(cap,10,10,[0,0,.02],(c,w,h)=>{c.strokeStyle='#21192b';c.lineWidth=w*.10;c.lineCap='round';c.lineJoin='round';if(i===1){c.lineWidth=w*.055;c.beginPath();c.arc(w/2,h/2,w*.40,0,Math.PI*2);c.stroke();c.beginPath();c.arc(w/2,h*.49,w*.26,.15,Math.PI-.15);c.stroke();c.fillStyle='#21192b';for(let q of [.35,.65]){c.beginPath();c.arc(w*q,h*.36,w*.045,0,Math.PI*2);c.fill()}}else{c.beginPath();c.moveTo(w*.3,h*(i===0?.58:.42));c.lineTo(w*.5,h*(i===0?.38:.62));c.lineTo(w*.7,h*(i===0?.58:.42));c.stroke()}});
 });
 for(const x of [-26,26])for(const y of [-60,60]){
 const insert=part(back,'M2 brass insert',[x,y,-10.8],[0,0,18],1);cyl(insert,1.75,4,mat.gold,[0,0,0]);cyl(insert,.8,4.05,mat.black,[0,0,0]);
 const screw=part(front,'M2×12 screw',[x,y,-5.4],[0,0,60],9.3);cyl(screw,1,10,mat.silver,[0,0,0]);const cone=new THREE.CylinderGeometry(1.9,1,1.8,24);cone.rotateX(Math.PI/2);mesh(screw,cone,mat.silver,[0,0,5]);box(screw,2,.4,.12,mat.black,[0,0,5.95]);
 const cap=part(front,'Screw cap',[x,y,1.1],[x*.3,y*.14,92],10);const g=geos[5].clone();g.rotateY(Math.PI);mesh(cap,g,mat.shell);
 }
 const bar=part(back,'Strap bar',[0,63.8,-8],[0,20,25],9);const bg=new THREE.CylinderGeometry(1.5,1.5,29.4,24);bg.rotateZ(Math.PI/2);mesh(bar,bg,mat.silver);
 const cables=createCables(badge,{display,esp,battery,charger,strip,switches,shellFront:face,shellRear:rear});
 // The opening is a real, lit cutting mat with a metric grid and laid-out parts.
 const workbench=new THREE.Group();badge.add(workbench);
 const matTexture=texture(2048,1280,(c,w,h)=>{
 c.fillStyle='#174b43';c.fillRect(0,0,w,h);const sx=w/420,sy=h/250;
 c.strokeStyle='#71998c';c.lineWidth=1;
 for(let x=10;x<420;x+=5){c.globalAlpha=x%10===0?.5:.22;c.beginPath();c.moveTo(x*sx,12*sy);c.lineTo(x*sx,236*sy);c.stroke()}
 for(let y=12;y<238;y+=5){c.globalAlpha=(y-12)%10===0?.5:.22;c.beginPath();c.moveTo(10*sx,y*sy);c.lineTo(410*sx,y*sy);c.stroke()}
 c.globalAlpha=.75;c.strokeStyle='#a5bca6';c.lineWidth=2;c.strokeRect(10*sx,12*sy,400*sx,225*sy);
 c.font='16px monospace';c.fillStyle='#bdd0b9';c.textAlign='center';
 for(let x=20;x<=400;x+=10)c.fillText(String(x),x*sx,9*sy);
 for(let y=22;y<=230;y+=10)c.fillText(String(y-12),5*sx,y*sy);
 c.textAlign='left';c.font='bold 20px monospace';c.fillText('THREE CONF / MAKER WORKBENCH',13*sx,245*sy);c.font='15px monospace';c.textAlign='right';c.fillText('SELF-HEALING · mm',407*sx,245*sy);
 c.globalAlpha=.3;c.lineWidth=1;c.beginPath();c.moveTo(10*sx,230*sy);c.lineTo(225*sx,15*sy);c.stroke();
 });
 const shape=new THREE.Shape();const w=420,h=250,r=6;shape.moveTo(-w/2+r,-h/2);shape.lineTo(w/2-r,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);shape.lineTo(w/2,h/2-r);shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);shape.lineTo(-w/2+r,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);shape.lineTo(-w/2,-h/2+r);shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
 const cutting=mesh(workbench,new THREE.ExtrudeGeometry(shape,{depth:1.7,bevelEnabled:true,bevelThickness:.2,bevelSize:.2,bevelSegments:2,steps:1}),material('#163f38',.92),[0,0,-2]);
 const topGeo=new THREE.ShapeGeometry(shape,12),uv=topGeo.attributes.uv,positions=topGeo.attributes.position;for(let i=0;i<uv.count;i++)uv.setXY(i,(positions.getX(i)+w/2)/w,(positions.getY(i)+h/2)/h);
 const top=mesh(workbench,topGeo,new THREE.MeshStandardMaterial({map:matTexture,roughness:.94,bumpMap:grain,bumpScale:.025}),[0,0,-.09]);top.castShadow=false;
 for(const m of [cutting.material,top.material]){m.transparent=true;m.depthWrite=false;}
 const benchPos={
 'Front enclosure':[131,28,2,Math.PI], 'Rear enclosure':[57,28,2,0],
 'GC9B72 display':[-155,36,7,0], 'ESP32-S3 N16R8':[-26,36,4,0],
 'LiPo 505060':[-31,-41,4,0], 'TP4056 + boost':[-108,-28,5,Math.PI],
 'Ground bus + dividers':[-177,-42,4,Math.PI],
 'Tactile switch 1':[-141,-71,4,0], 'Tactile switch 2':[-121,-70,4,0], 'Tactile switch 3':[-101,-70,4,0],
 'Previous button':[-191,-103,2.5,0], 'Menu button':[-163,-101,2.5,0], 'Next button':[-128,-100,2.5,0],
 'Strap bar':[64,112,2,0], 'Wire spool 1':[-65,55,7.5,0], 'Wire spool 2':[-96,70,7.5,0]
 };
 let insertIndex=0,screwIndex=0,capIndex=0;
 for(const p of animated){let a=benchPos[p.userData.name];if(p.userData.name==='M2 brass insert')a=[-65+insertIndex++*20,-97,2.5,0];if(p.userData.name==='M2×12 screw')a=[122+screwIndex++*20,-90,1.2,0];if(p.userData.name==='Screw cap')a=[32+capIndex++*25,-92,2.2,0];p.userData.bench=new THREE.Vector3(...a.slice(0,3));p.userData.z0=a[2];p.userData.benchRotation=a[3];}
 // Clay focus: while a part's card is open, everything else drops its materials.
 const clayMat=new THREE.MeshStandardMaterial({color:'#d6d1da',roughness:.92});
 const partCard=document.querySelector('#part-detail'),partSelect=document.querySelector('#part-select');
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
 function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);composer.setSize(w,h);const ratio=renderer.getPixelRatio();fxaa.uniforms.resolution.value.set(1/(w*ratio),1/(h*ratio));updateTarget()};resize();addEventListener('resize',resize);
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
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
 for(const [x,y,hx,hy] of [[0,122,230,6],[0,-122,230,6],[214,0,6,140],[-214,0,6,140]]){const w=new CANNON.Body({mass:0,shape:new CANNON.Box(new CANNON.Vec3(hx,hy,60))});w.position.set(x,y,60);physWorld.addBody(w);}
 const physParts=[];
 for(const p of animated){const nm=p.userData.name,f=FOOT[nm];if(!p.userData.bench||!f)continue;const h=TOPH[nm];
  const body=new CANNON.Body({mass:nm.includes('enclosure')?4:Math.max(.3,f[0]*f[1]*h/800),shape:new CANNON.Box(new CANNON.Vec3(f[0],f[1],h/2)),linearDamping:.55,angularDamping:.75,allowSleep:true,sleepSpeedLimit:22,sleepTimeLimit:.35});
  body.position.set(p.userData.bench.x,p.userData.bench.y,h/2);physWorld.addBody(body);
  p.userData.body=body;p.userData.originOffset=new CANNON.Vec3(0,0,p.userData.z0-h/2);p.userData.benchQuat=new THREE.Quaternion();physParts.push(p);}
 function syncPhysics(){for(const p of physParts){const b=p.userData.body,w=b.quaternion.vmult(p.userData.originOffset);p.userData.bench.set(b.position.x+w.x,b.position.y+w.y,b.position.z+w.z);p.userData.benchQuat.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);}}
 syncPhysics();
 const dragTarget=new THREE.Vector2(),brushPlane=new THREE.Plane(),brushPrev={part:null,x:0,y:0},hoveredHit=new THREE.Vector3();
 function benchPartAt(e){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);for(const h of ray.intersectObjects(animated,true)){let p=h.object;while(p&&!p.userData.name)p=p.parent;if(p&&p.userData.bench)return {p,point:h.point};}return null;}
 canvas.addEventListener('pointerdown',e=>{if(current<.35){inspectPart(e);const hit=benchPartAt(e);if(hit){dragPart=hit.p;partDragging=false;dragStart=[e.clientX,e.clientY];dragPlane.setFromNormalAndCoplanarPoint(dragNormal.set(0,0,1).applyQuaternion(badge.getWorldQuaternion(dragQuat)),hit.point);badge.worldToLocal(dragLocal.copy(hit.point));dragOff.x=dragLocal.x-dragPart.userData.bench.x;dragOff.y=dragLocal.y-dragPart.userData.bench.y;dragTarget.set(dragPart.userData.bench.x,dragPart.userData.bench.y);if(dragPart.userData.body)dragPart.userData.body.wakeUp();brushPrev.part=null;canvas.setPointerCapture(e.pointerId);}}down=[e.clientX,e.clientY];if((active===7||active===8)&&cables.startDrag(e,camera,canvas)){canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';}if(active!==10)return;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(clickables)[0];if(hit){firmware.hold([1,4,2][hit.object.userData.button],true);canvas.setPointerCapture(e.pointerId);}});
 canvas.addEventListener('pointerup',e=>{
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
  if(!partDragging&&Math.hypot(e.clientX-dragStart[0],e.clientY-dragStart[1])>4){partDragging=true;partsInfo.hide(true);}
  if(partDragging){const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);
   if(ray.ray.intersectPlane(dragPlane,dragPoint)){badge.worldToLocal(dragLocal.copy(dragPoint));dragTarget.set(clamp(dragLocal.x-dragOff.x,-196,196),clamp(dragLocal.y-dragOff.y,-108,108));}
   hoveredName=dragPart.userData.name;canvas.style.cursor='grabbing';e.preventDefault();return;}}
 if(!partsInfo.pinned)inspectPart(e);
 // Brushing: sliding the pointer across a part nudges it, as if grazed by a hand.
 if(current<.35&&!dragPart&&hoveredPartRef&&hoveredPartRef.userData.body){
  brushPlane.setFromNormalAndCoplanarPoint(dragNormal.set(0,0,1).applyQuaternion(badge.getWorldQuaternion(dragQuat)),hoveredHit);
  const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);
  if(ray.ray.intersectPlane(brushPlane,dragPoint)){badge.worldToLocal(dragLocal.copy(dragPoint));
   if(brushPrev.part===hoveredPartRef){const b=hoveredPartRef.userData.body,m=b.mass;let ix=(dragLocal.x-brushPrev.x)*m*16,iy=(dragLocal.y-brushPrev.y)*m*16;const L=Math.hypot(ix,iy),cap=m*180;if(L>cap){ix*=cap/L;iy*=cap/L;}
    badge.worldToLocal(shellA.copy(hoveredHit));b.wakeUp();b.applyImpulse(new CANNON.Vec3(ix,iy,0),new CANNON.Vec3(shellA.x-b.position.x,shellA.y-b.position.y,Math.min(shellA.z-b.position.z,b.shapes[0].halfExtents.z)));}
   brushPrev.part=hoveredPartRef;brushPrev.x=dragLocal.x;brushPrev.y=dragLocal.y;}
 }else brushPrev.part=null;
 if(active===7||active===8){cables.moveDrag(e,camera,canvas);const near=cables.hover(e,camera,canvas);canvas.style.cursor=cables.dragging?'grabbing':near?'grab':'';}});canvas.addEventListener('pointerleave',e=>{const t=e.relatedTarget;if(t&&(t.id==='peek'||t.closest&&t.closest('#peek')))return;hoveredName=null;hoveredPartRef=null;partsInfo.hide();});peek.addEventListener('pointerleave',e=>{peekSticky=false;if(e.relatedTarget===canvas)return;hoveredName=null;hoveredPartRef=null;});
 const YAXIS=new THREE.Vector3(0,1,0),XAXIS=new THREE.Vector3(1,0,0),shellA=new THREE.Vector3(),shellB=new THREE.Vector3(),qTmp=new THREE.Quaternion(),qFlip=new THREE.Quaternion(),qA=new THREE.Quaternion(),qB=new THREE.Quaternion();
 let stageBlend=-1;
 let lastTime=performance.now();
 function frame(time){requestAnimationFrame(frame);if(document.hidden)return;const dt=Math.min((time-lastTime)/1000,.05);lastTime=time;current=reduced?target:lerp(current,target,1-Math.exp(-dt*8));
 const leaveBench=smooth(current,.12,1.15),opened=leaveBench*(1-smooth(current,8.6,9.6));
 const swing=Math.sin(Math.PI*Math.min(1,opened))*smooth(current,1.2,10);front.position.set(47*opened,0,26*swing);front.rotation.y=2.88*opened;back.position.set(-47*opened,0,-6*swing);back.rotation.y=-.13*opened;
 document.body.classList.toggle('on-bench',current<.35);if(current>=.35)partsInfo.hide(true);setClay(current<.35&&partsInfo.pinned&&!partCard.hidden&&partSelect.value?partSelect.value:null);setGlow(current<.35&&!clayActive?(partDragging?dragPart:hoveredPartRef):null);if(current<.35){
 if(partDragging&&dragPart&&dragPart.userData.body){const b=dragPart.userData.body,tz=TOPH[dragPart.userData.name]/2+26;b.wakeUp();let vx=(dragTarget.x-b.position.x)*14,vy=(dragTarget.y-b.position.y)*14;const L=Math.hypot(vx,vy),cap=900;if(L>cap){vx*=cap/L;vy*=cap/L;}b.velocity.set(vx,vy,(tz-b.position.z)*14);b.angularVelocity.set(0,0,0);b.quaternion.set(0,0,0,1);}
 physWorld.step(1/120,Math.min(dt,.05),8);syncPhysics();}
 workbench.visible=current<1.12;cutting.material.opacity=1;top.material.opacity=1;workbench.position.set(0,-260*leaveBench,0);workbench.rotation.x=-.85*leaveBench;const matC=Math.cos(workbench.rotation.x),matS=Math.sin(workbench.rotation.x);
 const stageClose=smooth(current,8.7,10),stageKey=leaveBench+stageClose;if(hoveredName&&current<.35&&!partDragging&&!inspect){peek.dataset.name=hoveredName;if(hoveredPartRef){shellB.set(hoveredPartRef.userData.bench.x,hoveredPartRef.userData.bench.y,hoveredPartRef.userData.bench.z+(TOPH[hoveredName]||6)+4);badge.localToWorld(shellB);}else shellB.copy(hoveredAnchor);shellB.project(camera);const r2=canvas.getBoundingClientRect();peek.style.left=(r2.left+(shellB.x+1)*r2.width/2)+'px';peek.style.top=(r2.top+(1-shellB.y)*r2.height/2-34)+'px';peek.hidden=false;}else if(!peekSticky||current>=.35)peek.hidden=true;
 {// The canvas always fills the window; the framing rectangle is applied as a camera view offset, so nothing is ever cropped.
 const mobile=innerWidth<=760,W=stage.clientWidth,H=stage.clientHeight;
 const l=lerp(mobile?0:4,mobile?0:38,leaveBench),r=lerp(mobile?0:4,mobile?0:1,leaveBench);
 const top0=lerp(mobile?39:37,mobile?55:6,leaveBench),h0=lerp(mobile?53:57,mobile?42:89,leaveBench);
 const t=lerp(top0,mobile?56:1,stageClose),hh=lerp(h0,mobile?42:99,stageClose);
 const vx=W*l/100,vw=W*(100-l-r)/100,vy=H*t/100,vh=H*hh/100;
 camera.aspect=vw/vh;camera.setViewOffset(vw,vh,-vx,-vy,W,H);camera.updateProjectionMatrix();}

 for(const p of animated){const {home,offset,phase,bench,benchRotation,name}=p.userData;
 p.userData.lift=0;
 if(p.userData.benchOnly){p.visible=current<1.05;p.scale.setScalar(1);shellA.copy(bench);shellA.z=bench.z+p.userData.lift;const sy=shellA.y,sz=shellA.z;shellA.y=sy*matC-sz*matS-260*leaveBench;shellA.z=sy*matS+sz*matC;shellA.sub(p.parent.position).applyAxisAngle(YAXIS,-p.parent.rotation.y);p.position.copy(shellA);p.quaternion.setFromAxisAngle(XAXIS,workbench.rotation.x).multiply(qTmp.setFromAxisAngle(YAXIS,-p.parent.rotation.y)).multiply(p.userData.benchQuat).multiply(qFlip.setFromAxisAngle(YAXIS,benchRotation));continue;}
 const entryStart=phase<=1?.3:phase-.18,entryEnd=Math.min(phase+.38,10),entry=smooth(current,entryStart,entryEnd);
 const isShell=phase===1;
 p.visible=current<1.05||entry>0||isShell;
 const size=isShell||current<1.05?1:entry;
 p.scale.setScalar(Math.max(.001,size));
 const destination=home.clone().addScaledVector(offset,(1-entry)*.42);
 if(isShell){const g=p.parent,tShell=name==='Front enclosure'?smooth(leaveBench,.3,1):smooth(leaveBench,0,.7);shellB.copy(destination).applyAxisAngle(YAXIS,g.rotation.y).add(g.position);shellA.copy(bench).lerp(shellB,tShell);const arcT=Math.sin(Math.PI*tShell);shellA.y+=42*arcT;shellA.z+=34*arcT;shellA.sub(g.position).applyAxisAngle(YAXIS,-g.rotation.y);p.position.copy(shellA);if(tShell>=1)p.rotation.set(0,0,0);else{qA.setFromAxisAngle(YAXIS,-g.rotation.y).multiply(p.userData.benchQuat).multiply(qFlip.setFromAxisAngle(YAXIS,benchRotation));qB.setFromAxisAngle(YAXIS,lerp(benchRotation,name==='Front enclosure'?2.88:-.13,tShell)-g.rotation.y);p.quaternion.slerpQuaternions(qA,qB,smooth(tShell,0,.35));}}else if(entry>0){p.position.copy(destination);p.position.y-=55*(1-entry);}else{shellA.copy(bench);const by=shellA.y,bz=shellA.z;shellA.y=by*matC-bz*matS-260*leaveBench;shellA.z=by*matS+bz*matC;shellA.sub(p.parent.position).applyAxisAngle(YAXIS,-p.parent.rotation.y);p.position.copy(shellA);}if(p.userData.lift>.01)p.position.z+=p.userData.lift*(1-leaveBench);if(!isShell){if(entry>0)p.rotation.set(name==='M2×12 screw'?lerp(Math.PI/2,0,entry):0,lerp(benchRotation,0,entry),0);else p.quaternion.setFromAxisAngle(XAXIS,workbench.rotation.x).multiply(qTmp.setFromAxisAngle(YAXIS,-p.parent.rotation.y)).multiply(p.userData.benchQuat||qA.identity()).multiply(qFlip.setFromAxisAngle(YAXIS,benchRotation)).multiply(qB.setFromAxisAngle(XAXIS,name==='M2×12 screw'?Math.PI/2:0));}
 }
 if(!inspect){const close=smooth(current,8.7,10);badge.rotation.set(lerp(-.96,lerp(-.11,.025,close),leaveBench),lerp(0,lerp(-.05,-.2,close),leaveBench),lerp(0,lerp(-.04,-.06,close),leaveBench));
 const widthNeeded=lerp(540,lerp(214,120,close),leaveBench),heightNeeded=lerp(245,lerp(200,221,close),leaveBench);
 const dist=Math.max(heightNeeded,widthNeeded/camera.aspect)/(2*Math.tan(THREE.MathUtils.degToRad(16)));
 parallax.x=lerp(parallax.x,parallax.tx,Math.min(1,dt*3.5));parallax.y=lerp(parallax.y,parallax.ty,Math.min(1,dt*3.5));const px=reduced?0:parallax.x,py=reduced?0:parallax.y;camera.position.set(lerp(0,lerp(85,24,close),leaveBench)+px*lerp(14,9,leaveBench),lerp(0,lerp(38,12,close),leaveBench)-py*lerp(9,6,leaveBench),dist);camera.lookAt(lerp(0,lerp(6,0,close),leaveBench)+px*lerp(4,2,leaveBench),lerp(0,lerp(-1,2,close),leaveBench)-py*lerp(3,2,leaveBench),0);
 }else controls.update();
 cables.update(current,dt);firmware.tick(dt,current>9.98);composer.render();
 }
 $('#loading').classList.add('hidden');updateTarget();requestAnimationFrame(frame);
} catch(error){console.error(error);$('#loading').textContent='The 3D view could not load. Reload the page to try again; the assembly guide is available below.';$('#loading').classList.add('error')}

const details={
 wiring:`<p class="eyebrow">BENCH REFERENCE</p><h2>Make every connection count.</h2><h3>Display ribbon · 5–6 cm</h3><table><thead><tr><th>Display pad</th><th>ESP32-S3</th><th>Wire</th></tr></thead><tbody>${[['GND','GND','Brown'],['VCC','3V3','Red'],['SCL / SCLK','GPIO 14','Orange'],['SDA / MOSI','GPIO 13','Yellow'],['RST','GPIO 12','Green'],['DC','GPIO 11','Blue'],['CS','GPIO 10','Violet'],['BL','GPIO 9','Grey'],['SDO','Not connected','White — trim'],['TE','GPIO 3','Black']].map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')}</tbody></table><h3>Buttons & power</h3><p>Previous → GPIO 20 · Next → GPIO 19 · Centre → GPIO 21. Each switch returns to the ground bus. TP4056 OUT+ → DevKit 5V; OUT− → GND. Battery red → B+; black → B−.</p><h3>Five-strip sensing board</h3><p>1: B+ · 2: GPIO 1 midpoint · 3: common GND · 4: GPIO 2 midpoint · 5: TP4056 IN+ / VBUS. Four 100 kΩ resistors bridge strips 1–2, 2–3, 3–4 and 4–5. Lay the resistor bodies flat.</p><p>Never connect B+ directly to a GPIO. Sense charge from IN+ on the rear of the charging board, not the permanently powered boost output. Use Wi-Fi OTA; the native DevKit USB pins are assigned to buttons.</p><p><a target="_blank" rel="noopener" href="https://claude.ai/code/artifact/2f3f80b4-be6a-4256-8994-c7800f24ea67">Read the complete original assembly document ↗</a></p>`,
 sources:`<p class="eyebrow">PARTS & REFERENCES</p><h2>Real parts. An open view.</h2><p>The enclosure is tessellated directly from <b>speaker_badge_medium_no_switch.step</b>. All three button caps and four screw caps come from <b>small_parts.stl</b>. Colours and face graphics follow the supplied badge emulator.</p><p>The electronics are simplified 3D recreations, sized to the enclosure’s component layout. Selectable cables follow the guide’s pin mapping and use a constrained rope simulation. The electronics remain simplified recreations; this view is not a manufacturing fit check. The screen runs the supplied, unmodified emulator firmware.</p><ul><li><a target="_blank" rel="noopener" href="https://documentation.espressif.com/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.0.html">Espressif ESP32-S3 DevKitC reference</a></li><li><a target="_blank" rel="noopener" href="https://goldenmorninglcd.com/tft-display/2.1-inch-360x360-gc9b72-t210b10-c12-04/">GoldenMorning GC9B72 display</a></li><li><a target="_blank" rel="noopener" href="https://www.tztstore.com/goods/223.html">TZT round display module</a></li><li><a target="_blank" rel="noopener" href="https://qbmindia.com/shop/batteries/battery-charging-power-bank-modules-batteries/3-7v-5v-2a-18650-battery-boost-chrg-c-type-modul-tp4056bc/">TP4056 + boost board reference</a></li><li><a target="_blank" rel="noopener" href="https://www.yilaipower.com/battery/fully-certified-505060-2000mah-3.7v-rechargeable-li-po-battery.html">Yilai 505060 LiPo reference</a></li></ul><p><a target="_blank" rel="noopener" href="https://claude.ai/code/artifact/2f3f80b4-be6a-4256-8994-c7800f24ea67">Original assembly & soldering guide</a>. This page uses the guide’s updated route-specific wire lengths and M2×12 fasteners, which supersede its older generic wire and screw notes.</p>`
};
for(const b of document.querySelectorAll('[data-detail]'))b.onclick=()=>{$('#detail-body').innerHTML=details[b.dataset.detail];$('#detail').showModal()};$('.close-dialog').onclick=()=>$('#detail').close();$('#detail').addEventListener('click',e=>{if(e.target===$('#detail')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
