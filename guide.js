import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { STLLoader } from './vendor/STLLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mat, material, mesh, wire, buildDisplay, buildESP, buildBattery, buildCharger, buildStrip, buildSwitch, planarUVs, PINS, RIBBON_COLORS } from './parts.js?v=53';
import { PARTS } from './parts-info.js';

// Each figure is a small orbitable scene built from the same parts as the interactive page.
const V=(...a)=>new THREE.Vector3(...a);
const UP=V(0,0,1);
const stlCache={};
async function stl(name){if(!stlCache[name]){const g=await new STLLoader().loadAsync(`assets/${name}.stl`);planarUVs(g);stlCache[name]=g;}return stlCache[name];}

class Figure{
 constructor(el){
  this.el=el;this.stage=el.querySelector('.fig-stage');this.canvas=el.querySelector('canvas');this.labelBox=el.querySelector('.fig-labels');this.tip=el.querySelector('.fig-tip');
  this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:true});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.toneMapping=THREE.NeutralToneMapping;this.renderer.toneMappingExposure=1.15;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.scene=new THREE.Scene();this.scene.environment=new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(),.04).texture;this.scene.environmentIntensity=.45;
  this.camera=new THREE.PerspectiveCamera(30,1,1,2000);this.camera.up.copy(UP);
  const key=new THREE.DirectionalLight('#fff4e4',2.4);key.position.set(-90,-70,220);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.normalBias=.4;key.shadow.bias=-.0002;Object.assign(key.shadow.camera,{left:-160,right:160,top:160,bottom:-160,near:5,far:700});
  this.scene.add(key,new THREE.HemisphereLight('#ffffff','#cfc7dc',.55));
  const ground=mesh(this.scene,new THREE.PlaneGeometry(900,900),new THREE.ShadowMaterial({opacity:.18}),[0,0,-.05]);ground.castShadow=false;this.ground=ground;
  this.controls=new OrbitControls(this.camera,this.canvas);this.controls.enableDamping=true;this.controls.enablePan=false;this.controls.minDistance=60;this.controls.maxDistance=600;this.controls.maxPolarAngle=Math.PI*.49;
  this.parts=[];this.labels=[];this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.hover=null;this.pinned=false;this.visible=false;
  this.canvas.addEventListener('pointermove',e=>this.onMove(e));this.canvas.addEventListener('pointerleave',()=>{if(!this.pinned)this.setHover(null);});
  this.canvas.addEventListener('click',e=>{if(this.moved)return;const p=this.pick(e);if(p){this.pinned=true;this.setHover(p,e);}else{this.pinned=false;this.setHover(null);}});
  this.canvas.addEventListener('pointerdown',e=>{this.down=[e.clientX,e.clientY];this.moved=false;});
  this.canvas.addEventListener('pointerup',e=>{this.moved=this.down&&Math.hypot(e.clientX-this.down[0],e.clientY-this.down[1])>5;});
  new IntersectionObserver(en=>{this.visible=en[0].isIntersecting;if(this.visible)this.loop();},{threshold:.05}).observe(el);
  new ResizeObserver(()=>this.resize()).observe(this.stage);
 }
 part(name,builder,pos,rotZ=0,rotX=0,rotY=0){const g=new THREE.Group();g.position.set(...pos);g.rotation.set(rotX,rotY,rotZ);g.userData.name=name;this.scene.add(g);builder(g);this.parts.push(g);return g;}
 // A tube between two solder points, given in each part's own frame; the middle rises off the surface.
 route(a,al,b,bl,color,lift=8,r=.42,name){const A=a.localToWorld(V(...al)),B=b.localToWorld(V(...bl));const m1=A.clone().lerp(B,.3),m2=A.clone().lerp(B,.7);m1.z+=lift;m2.z+=lift;const w=wire(this.scene,[A.toArray(),m1.toArray(),m2.toArray(),B.toArray()],color,r);w.userData.name=name||null;w.userData.wire=true;if(name)this.parts.push(w);return w;}
 label(text,obj,local,cls=''){const span=document.createElement('span');span.className='fig-label '+cls;span.textContent=text;this.labelBox.append(span);this.labels.push({span,obj,local:V(...local)});return span;}
 frame(dir=[0,-1,.95],pad=.8){const b=new THREE.Box3();for(const p of this.parts)if(!p.userData.wire)b.expandByObject(p);const c=b.getCenter(V()),r=b.getBoundingSphere(new THREE.Sphere()).radius;this.controls.target.copy(c);const d=V(...dir).normalize();this.fit={c,r,d,pad};this.resize();}
 resize(){const w=this.stage.clientWidth,h=this.stage.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;if(this.fit){const {c,r,d,pad}=this.fit;const fov=THREE.MathUtils.degToRad(this.camera.fov),vis=Math.min(1,this.camera.aspect);const dist=r*pad/Math.sin(fov/2)/vis;this.camera.position.copy(c).addScaledVector(d,dist);}this.camera.updateProjectionMatrix();this.render();}
 pick(e){const r=this.canvas.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hits=this.ray.intersectObjects(this.parts,true);for(const h of hits){let o=h.object;while(o&&!o.userData.name)o=o.parent;if(o)return o;}return null;}
 onMove(e){if(this.pinned)return;const p=this.pick(e);this.setHover(p,e);}
 setHover(p,e){
  if(this.hover&&this.hover!==p){this.hover.traverse(m=>{if(m.isMesh&&m.userData.__hm){m.material.dispose();m.material=m.userData.__hm;delete m.userData.__hm;}});}
  if(p&&this.hover!==p)p.traverse(m=>{const mt=m.material;if(!m.isMesh||!mt||mt.isShaderMaterial||!mt.emissive||mt.transparent)return;m.userData.__hm=mt;const c=mt.clone();c.emissive=new THREE.Color('#fff2dc');c.emissiveIntensity=.2;m.material=c;});
  this.hover=p;this.canvas.style.cursor=p?'pointer':'';
  if(!p){this.tip.hidden=true;return;}
  const name=p.userData.name,info=PARTS[name];
  this.tip.innerHTML=info?`<strong>${info[0]}</strong><p>${info[1]}</p><a href="${info[2]}" target="_blank" rel="noopener">Component reference ↗</a>`:`<strong>${name}</strong>`;
  if(e){const r=this.stage.getBoundingClientRect();this.tip.style.left=Math.min(e.clientX-r.left+14,r.width-300)+'px';this.tip.style.top=Math.min(e.clientY-r.top+14,r.height-140)+'px';}
  this.tip.hidden=false;
 }
 render(){
  this.renderer.render(this.scene,this.camera);
  const r=this.canvas.getBoundingClientRect();
  for(const l of this.labels){const p=l.obj.localToWorld(l.local.clone()).project(this.camera);const behind=p.z>1;l.span.style.left=((p.x+1)/2*r.width)+'px';l.span.style.top=((1-p.y)/2*r.height)+'px';l.span.style.opacity=behind?0:1;}
 }
 loop(){if(!this.visible)return;this.controls.update();this.render();requestAnimationFrame(()=>this.loop());}
}

const scenes={
 // Fig. 1 — power: TP4056 → battery, TP4056 → DevKit 5V/GND.
 async power(f){
  const charger=f.part('TP4056 + boost',buildCharger,[-78,6,1.2],0,Math.PI);
  const battery=f.part('LiPo 505060',buildBattery,[-8,42,2.4]);
  const esp=f.part('ESP32-S3 N16R8',buildESP,[62,-8,.8]);
  f.route(charger,PINS.charger(0),battery,PINS.batteryPlus,'#d0342c',10,.45,'B+ → battery +');
  f.route(charger,PINS.charger(1),battery,PINS.batteryMinus,'#222',10,.45,'B− → battery −');
  f.route(charger,PINS.charger(2),esp,PINS.esp(-1,21),'#d0342c',12,.45,'OUT+ → DevKit 5V');
  f.route(charger,PINS.charger(3),esp,PINS.esp(1,22),'#222',12,.45,'OUT− → DevKit GND');
  f.label('USB-C · charging',charger,[-5.5,-13,-2],'note');f.label('B+',charger,[-9,7,2],'pin');f.label('B−',charger,[-3,7,2],'pin alt');f.label('OUT+',charger,[3,7,2],'pin');f.label('OUT−',charger,[9,7,2],'pin alt');
  f.label('tabs pointing UP · red = B+ · black = B−',battery,[0,25,4]);f.label('IN+ pad (underneath) → stripboard strip 5',charger,[0,14,0],'note');
  f.label('5V pin',esp,PINS.esp(-1,21),'pin');f.label('GND pin',esp,PINS.esp(1,22),'pin alt');
  f.frame([0,-1,1]);
 },
 // Fig. 2 — display ribbon: ten conductors in pad order, SDO trimmed.
 async ribbon(f){
  const display=f.part('GC9B72 display',g=>buildDisplay(g),[-52,0,3.6],0,0,Math.PI);
  const esp=f.part('ESP32-S3 N16R8',buildESP,[56,-4,.8]);
  const pins=[['GND',[-1,22]],['VCC → 3V3',[-1,1]],['SCL → GPIO 14',[-1,20]],['SDA → GPIO 13',[-1,19]],['RST → GPIO 12',[-1,18]],['DC → GPIO 11',[-1,17]],['CS → GPIO 10',[-1,16]],['BL → GPIO 9',[-1,15]],['SDO · not wired (cut flush at GPIO 46)',null],['TE → GPIO 3',[-1,13]]];
  pins.forEach(([name,pin],i)=>{const end=pin?PINS.esp(...pin):[-15,27-13*2.54,2.5];f.route(display,PINS.displayPad(i),esp,end,RIBBON_COLORS[i],6+i*.4,.42,name);});
  f.label('10 pads, module order',display,[0,-36,2]);f.label('rows 13 → 20, contiguous',esp,[0,-24,4],'pin');f.label('3V3',esp,PINS.esp(-1,1),'pin');f.label('GND',esp,PINS.esp(-1,22),'pin alt');f.label('SDO (white) cut flush',esp,[-19,27-13*2.54,3],'note');f.label('hover a wire for its pin',display,[0,20,2],'note');
  f.frame([0,-1,1.05]);
 },
 // Fig. 3 — buttons and the stripboard tab.
 async buttons(f){
  const sw=[36,0,-36].map((y,i)=>f.part('Tactile switch '+(i+1),buildSwitch,[-88,y,1.8]));
  const strip=f.part('Ground bus + dividers',buildStrip,[-22,-52,1.1],0,Math.PI);
  const esp=f.part('ESP32-S3 N16R8',buildESP,[62,0,.8]);
  const names=['UP → GPIO 20','CENTRE → GPIO 21','DOWN → GPIO 19'],cols=['#2b6cb0','#e8b820','#2c9a4b'],rows=[19,18,20];
  sw.forEach((s,i)=>{f.route(s,PINS.switchSignal,esp,PINS.esp(1,rows[i]),cols[i],10+i*2,.42,names[i]);f.route(s,PINS.switchGround,strip,PINS.strip(2,-6.35+i*2.54),'#222',7+i,.42,'GND → strip 3 (bus)');});
  f.route(strip,PINS.strip(1),esp,PINS.esp(1,4),'#e8b820',9,.42,'strip 2 → GPIO 1 · battery sense');
  f.route(strip,PINS.strip(3),esp,PINS.esp(1,5),'#2c9a4b',9,.42,'strip 4 → GPIO 2 · charge sense');
  f.route(strip,PINS.strip(2,8.89),esp,PINS.esp(-1,22),'#222',9,.42,'strip 3 → DevKit GND');
  const stub=(i,color,name)=>{const A=strip.localToWorld(V(...PINS.strip(i,-8.89)));wire(f.scene,[A.toArray(),[A.x-8,A.y-12,A.z+3],[A.x-22,A.y-30,A.z+1]],color,.42);};
  stub(0,'#d0342c');stub(4,'#2b6cb0');
  f.label('UP',sw[0],[0,0,4],'pin');f.label('CENTRE',sw[1],[0,0,4],'pin');f.label('DOWN',sw[2],[0,0,4],'pin');
  f.label('B+ from TP4056',strip,[-5.08,-16,0],'note');f.label('VBUS from TP4056 IN+',strip,[5.08,-16,0],'note alt');f.label('R1–R4 · 100 kΩ, laid flat',strip,[0,14,0]);
  f.label('GPIO 20',esp,PINS.esp(1,19),'pin');f.label('GPIO 21',esp,PINS.esp(1,18),'pin alt');f.label('GPIO 19',esp,PINS.esp(1,20),'pin alt2');f.label('GPIO 1',esp,PINS.esp(1,4),'pin');f.label('GPIO 2',esp,PINS.esp(1,5),'pin alt');f.label('GND',esp,PINS.esp(-1,22),'pin');
  f.frame([0,-1,1]);
 },
 // Fig. 4 — section through the centre button station: front shell cut by a clipping plane.
 async section(f){
  f.renderer.localClippingEnabled=true;
  const plane=new THREE.Plane(V(0,-1,0),-38.5);
  const cut=m=>{const c=m.clone();c.clippingPlanes=[plane];c.side=THREE.DoubleSide;return c;};
  const shellGeo=(await stl('shell-0')).clone();shellGeo.rotateY(Math.PI);
  const shell=f.part('Front enclosure',g=>{mesh(g,shellGeo,cut(mat.shell));},[0,0,0]);
  const sw=f.part('Tactile switch 2',g=>{buildSwitch(g);g.traverse(m=>{if(m.isMesh)m.material=cut(m.material);});},[0,-38.5,-3]);
  const capGeo=(await stl('cap-2')).clone();capGeo.rotateY(Math.PI);
  const cap=f.part('Menu button',g=>{mesh(g,capGeo,cut(mat.yellow));},[0,-38.5,1.5]);
  f.ground.visible=false;
  f.label('cap glued on the plunger (outside)',cap,[0,0,3]);f.label('switch inserted from the OUTSIDE (Ø8.8 hole)',sw,[-9,-2,-3],'note');f.label('legs folded back, soldered AFTER insertion',sw,[3.2,-3.3,-4],'pin alt2');f.label('cradle walls',shell,[11,-41,-9],'note');
  f.parts.splice(0);f.parts.push(shell,sw,cap);
  const c=V(0,-43,-1);f.controls.target.copy(c);f.fit={c,r:15,d:V(.55,1,.38).normalize(),pad:1};f.resize();
 },
};

// Flat diagram by default; the 3D scene is built the first time a figure is switched to it.
for(const el of document.querySelectorAll('figure[data-scene]')){
 const flat=el.querySelector('.fig-flat'),stage=el.querySelector('.fig-stage'),buttons=[...el.querySelectorAll('.fig-switch button')];
 let fig=null;
 const show=view=>{buttons.forEach(b=>b.classList.toggle('on',b.dataset.view===view));flat.hidden=view==='3d';stage.hidden=view!=='3d';
  if(view==='3d'&&!fig){fig=new Figure(el);scenes[el.dataset.scene](fig).then(()=>{fig.resize();fig.render();}).catch(err=>{console.error(err);el.classList.add('fig-failed');show('flat');});}
  else if(view==='3d'&&fig){fig.resize();fig.visible=true;fig.loop();}};
 buttons.forEach(b=>b.addEventListener('click',()=>show(b.dataset.view)));
}
