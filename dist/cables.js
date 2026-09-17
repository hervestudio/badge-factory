import * as THREE from 'three';
const V=(...a)=>new THREE.Vector3(...a),clamp=THREE.MathUtils.clamp;
const smooth=(v,a,b)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
// Physical endpoints are local pad coordinates, never free-floating approximations.
export function createCables(root,{display,esp,battery,charger,strip,switches,shellFront,shellRear}){
 const anchor=(object,xyz,label)=>({object,point:V(...xyz),label});
 const e=(side,row,label)=>anchor(esp,[side*12,27-(row-1)*2.54,1.2],`ESP32 · ${label} (${side<0?'J1':'J3'}-${row})`);
 const d=(i,label)=>anchor(display,[-11.43+i*2.54,-33,-.6],`Display · ${label}`);
 const s=(i,y=6.35)=>anchor(strip,[-5.08+i*2.54,y,-.9],`Stripboard · strip ${i+1}`);
 const p=(i,label)=>anchor(charger,[-9+i*6,7,-.8],`Charger · ${label}`);
 const nets=[];
 const add=(name,color,a,b,purpose)=>{const net={name,color,a,b,purpose};nets.push(net);return net;};
 const colors=['#70422b','#d52b27','#ef791a','#e7c526','#229657','#246fc1','#8b43c5','#90979c','#eee8dc','#151621'];
 const displayPins=[['GND',e(-1,22,'GND'),'Direct display ground'],['VCC',e(-1,1,'3V3'),'Display power · 3.3 V'],['SCL',e(-1,20,'GPIO 14'),'SPI clock'],['SDA',e(-1,19,'GPIO 13'),'SPI MOSI data'],['RST',e(-1,18,'GPIO 12'),'Display reset'],['DC',e(-1,17,'GPIO 11'),'Data / command'],['CS',e(-1,16,'GPIO 10'),'SPI chip select'],['BL',e(-1,15,'GPIO 9'),'Backlight PWM'],['SDO',anchor(esp,[-15,27-13*2.54,2.5],'Trimmed end · GPIO 46 left empty'),'Unused SPI output · not soldered at the ESP32'],['TE',e(-1,13,'GPIO 3'),'Tearing-effect synchronization']];
 displayPins.forEach((pin,i)=>{if(pin){const n=add(`Display / ${pin[0]}`,colors[i],d(i,pin[0]),pin[1],pin[2]);n.ribbonIndex=i;n.disconnected=i===8;}});
 switches.forEach((sw,i)=>{const name=['Previous','Centre','Next'][i];add(`${name} / signal`,['#3289c1','#d6b82f','#3eaa78'][i],anchor(sw,[3.2,3.3,-1],`${name} switch · signal leg`),e(1,[19,18,20][i],`GPIO ${[20,21,19][i]}`),'Active-low button input');add(`${name} / ground`,'#272830',anchor(sw,[-3.2,3.3,-1],`${name} switch · ground leg`),s(2,-6.35+i*2.54),'Common ground return');});
 add('Battery / positive','#d5312b',anchor(battery,[-10,25,1],'LiPo · positive tab'),p(0,'B+'),'Battery positive · 3.7 V nominal');
 add('Battery / negative','#22252b',anchor(battery,[10,25,1],'LiPo · negative tab'),p(1,'B−'),'Battery negative');
 add('Power / 5 V','#d5312b',p(2,'OUT+'),e(-1,21,'5V'),'Boost output · regulated 5 V');
 add('Power / return','#22252b',p(3,'OUT−'),e(1,22,'GND'),'Direct charger-to-DevKit return');
 add('Sense / battery','#d5312b',p(0,'B+'),s(0),'Battery feed to 100 kΩ divider');
 add('Sense / battery ADC','#d6b82f',s(1),e(1,4,'GPIO 1'),'Divided battery voltage · ADC');
 add('Sense / ground','#25262e',s(2,8.89),e(-1,22,'GND'),'Common bus to DevKit ground');
 add('Sense / charge ADC','#3eaa78',s(3),e(1,5,'GPIO 2'),'Divided USB input voltage · ADC');
 add('Sense / USB input','#3289c1',anchor(charger,[8,-4,-1],'Charger · IN+ / VBUS'),s(4),'USB 5 V input to 100 kΩ divider');
 const group=new THREE.Group();root.add(group);group.userData.name='Wire kit';let selected=-1;
 // Convex proxies for the parts, in each part's own frame; wires are pushed out of them.
 const colliders=[
  {object:display,center:V(0,0,0),r:30.4},
  {object:esp,center:V(0,0,.6),half:V(14.6,32.6,3)},
  {object:esp,center:V(-17,0,1),half:V(1.6,30,5)},
  {object:esp,center:V(17,0,1),half:V(1.6,30,5)},
  {object:battery,center:V(0,0,0),half:V(30.6,25.6,3.2)},
  {object:charger,center:V(0,0,-1.2),half:V(12.6,9.6,2.9)},
  {object:strip,center:V(0,0,-.6),half:V(7,10.7,1.9)},
  ...switches.map(sw=>({object:sw,center:V(0,0,-.6),half:V(3.5,3.6,2.9)})),
 ];
 if(shellFront)colliders.push({object:shellFront,center:V(0,0,.7),half:V(34,68,1.4)});
 if(shellRear)colliders.push({object:shellRear,center:V(0,0,1),half:V(34,68,1.6)});
 if(typeof location!=='undefined'&&new URLSearchParams(location.search).has('colliders')){
  const dbg=new THREE.MeshBasicMaterial({color:'#ff2244',transparent:true,opacity:.35,depthWrite:false});
  for(const c of colliders){const m=c.r?new THREE.Mesh(new THREE.SphereGeometry(c.r,24,16),dbg):new THREE.Mesh(new THREE.BoxGeometry(c.half.x*2,c.half.y*2,c.half.z*2),dbg);m.position.copy(c.center);c.object.add(m);}
 }
 const tmpW=V(),tmpQ=V(),kick=V(),camRight=V(),camUp=V(),invRoot=new THREE.Matrix4();
 let drag=null;
 function collideNode(node,old,k,wr,a,b){
  if(node.distanceTo(a)<7||node.distanceTo(b)<7)return;
  for(const c of colliders){
   tmpW.copy(node);root.localToWorld(tmpW);c.object.worldToLocal(tmpW);
   let hit=false;
   if(c.r!==undefined){const dist=tmpW.distanceTo(c.center);if(dist<c.r+wr){tmpW.sub(c.center).setLength(c.r+wr).add(c.center);hit=true;}}
   else{
    tmpQ.copy(tmpW).sub(c.center);
    const hx=c.half.x+wr,hy=c.half.y+wr,hz=c.half.z+wr;
    if(Math.abs(tmpQ.x)<hx&&Math.abs(tmpQ.y)<hy&&Math.abs(tmpQ.z)<hz){
     const px=hx-Math.abs(tmpQ.x),py=hy-Math.abs(tmpQ.y),pz=hz-Math.abs(tmpQ.z);
     if(px<=py&&px<=pz)tmpQ.x=Math.sign(tmpQ.x||1)*hx;else if(py<=pz)tmpQ.y=Math.sign(tmpQ.y||1)*hy;else tmpQ.z=Math.sign(tmpQ.z||1)*hz;
     tmpW.copy(tmpQ).add(c.center);hit=true;
    }
   }
   if(hit){
    c.object.localToWorld(tmpW);root.worldToLocal(tmpW);
    tmpQ.copy(tmpW).sub(node).multiplyScalar(k);
    node.add(tmpQ);old.addScaledVector(tmpQ,.9);
   }
  }
 }
 // Wires push each other apart so no two ropes intersect.
 const cellOf=(x,y,z)=>(Math.round(x)+512)+(Math.round(y)+512)*1024+(Math.round(z)+512)*1048576;
 function crossNet(k){
  const map=new Map();
  for(const net of nets){if(net.shown<.5||!net.mesh.visible)continue;const r=net.ribbonIndex!==undefined?.45:.34;
   for(let i=2;i<N-2;i++){const p=net.nodes[i];const c=cellOf(p.x,p.y,p.z);let bucket=map.get(c);if(!bucket)map.set(c,bucket=[]);bucket.push([net,i,r]);}}
  for(const [c,bucket] of map){
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
    const other=map.get(c+dx+dy*1024+dz*1048576);if(!other)continue;
    for(const [na,ia,ra] of bucket)for(const [nb,ib,rb] of other){
     if(na===nb)continue;if(na.name>nb.name)continue;
     const pa=na.nodes[ia],pb=nb.nodes[ib];delta.copy(pb).sub(pa);const d=delta.length(),minD=ra+rb;
     if(d>1e-6&&d<minD){delta.multiplyScalar((minD-d)/d*.5*k);pb.add(delta);na.old[ia].addScaledVector(delta,-.8);pa.sub(delta);nb.old[ib].addScaledVector(delta,.8);}
    }
   }
  }
 }
 // Nearest rope segment to the pointer, in screen pixels.
 function nearest(event,camera,canvas,maxPx){
  const rect=canvas.getBoundingClientRect();let best=maxPx,found=null;
  const pointer=new THREE.Vector2(event.clientX,event.clientY);
  nets.forEach(n=>{if(n.shown<.05)return;
   for(let i=0;i<Math.floor((N-1)*n.shown);i++){
    const a=root.localToWorld(n.nodes[i].clone()).project(camera),b=root.localToWorld(n.nodes[i+1].clone()).project(camera),
    p=new THREE.Vector2(rect.left+(a.x+1)*rect.width/2,rect.top+(1-a.y)*rect.height/2),
    q=new THREE.Vector2(rect.left+(b.x+1)*rect.width/2,rect.top+(1-b.y)*rect.height/2),
    v=q.clone().sub(p),t=clamp(pointer.clone().sub(p).dot(v)/(v.lengthSq()||1),0,1),
    distance=pointer.distanceTo(p.addScaledVector(v,t));
    if(distance<best){best=distance;found={net:n,index:clamp(Math.round(i+t),2,N-3),dist:distance};}
   }});
  return found;
 }
 // Brushing a wire nudges it; the Verlet step turns the nudge into motion.
 function hover(event,camera,canvas){
  if(drag)return true;
  const f=nearest(event,camera,canvas,24);
  if(!f)return false;
  const mx=event.movementX||0,my=event.movementY||0;
  if(mx||my){
   camera.updateMatrixWorld();
   camRight.setFromMatrixColumn(camera.matrixWorld,0);camUp.setFromMatrixColumn(camera.matrixWorld,1);
   kick.copy(camRight).multiplyScalar(mx).addScaledVector(camUp,-my).multiplyScalar(.045);
   if(kick.length()>1.1)kick.setLength(1.1);
   invRoot.copy(root.matrixWorld).invert();kick.transformDirection(invRoot).multiplyScalar(Math.min(1.1,Math.hypot(mx,my)*.045));
   for(let k=-2;k<=2;k++){const i=clamp(f.index+k,2,N-3);f.net.old[i].addScaledVector(kick,-(1-Math.abs(k)*.3));}
  }
  return true;
 }
 const dragPlane=new THREE.Plane(),dragRay=new THREE.Raycaster(),dragNdc=new THREE.Vector2(),dragHit=V();
 function startDrag(event,camera,canvas){
  const f=nearest(event,camera,canvas,18);
  if(!f)return false;
  drag={net:f.net,index:f.index,target:f.net.nodes[f.index].clone()};
  dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(tmpW),root.localToWorld(f.net.nodes[f.index].clone()));
  moveDrag(event,camera,canvas);
  return true;
 }
 function moveDrag(event,camera,canvas){
  if(!drag)return;
  const rect=canvas.getBoundingClientRect();
  dragNdc.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  dragRay.setFromCamera(dragNdc,camera);
  if(dragRay.ray.intersectPlane(dragPlane,dragHit))drag.target.copy(root.worldToLocal(dragHit.clone()));
 }
 function endDrag(){drag=null;}
 const N=40,R=8,delta=V(),tangent=V(),normal=V(),binormal=V(),up=V(0,0,1);
 const world=a=>root.worldToLocal(a.object.localToWorld(a.point.clone()));
 nets.forEach((net,index)=>{
  const geometry=new THREE.BufferGeometry(),positions=new Float32Array(N*R*3),indices=[];
  for(let i=0;i<N-1;i++)for(let j=0;j<R;j++){let a=i*R+j,b=i*R+(j+1)%R,c=a+R,d=b+R;indices.push(a,b,c,b,d,c)}
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
  const material=new THREE.MeshStandardMaterial({color:net.color,roughness:.4,metalness:.05});
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.userData.net=index;group.add(mesh);
  Object.assign(net,{mesh,nodes:Array.from({length:N},()=>V()),old:Array.from({length:N},()=>V()),started:false,shown:0});
 });
 const select=document.querySelector('#cable-select'),card=document.querySelector('#cable-detail');
 for(let i=0;i<nets.length;i++){const o=document.createElement('option');o.value=i;o.textContent=nets[i].name;select.append(o)}
 function choose(index){selected=index;select.value=String(index);const n=nets[index];card.hidden=false;card.querySelector('strong').textContent=n.name;card.querySelector('.cable-route').textContent=n.a.label+' → '+n.b.label;card.querySelector('.cable-purpose').textContent=n.purpose;card.style.setProperty('--wire',n.color);for(let i=1;i<N-1;i++)n.nodes[i].z+=Math.sin(i/(N-1)*Math.PI)*.5;}
 select.addEventListener('change',()=>choose(+select.value));
 document.querySelector('#close-cable').onclick=()=>{card.hidden=true;selected=-1;select.value=''};
 function update(current,dt){
  group.visible=current<.8||current>6.8;const inspecting=current>6.8&&current<9;
  document.body.classList.toggle('wiring-view',inspecting);if(!inspecting)card.hidden=true;
  root.updateWorldMatrix(true,true);
  const step=Math.min(dt,1/30),closed=smooth(current,8.6,9.6);
  if(closed<.99&&(current<1.05||current>6.8))crossNet(1-closed);
  nets.forEach((net,index)=>{
   const bench=net.ribbonIndex!==undefined?1-smooth(current,.9,1.05):0,reveal=smooth(current,6.94+index*.009,7.14+index*.009);net.shown=Math.max(bench,reveal,index===selected&&current>6.8?1:0);net.mesh.visible=net.shown>.001;if(!net.mesh.visible){net.started=false;return}if(drag&&drag.net===net&&net.shown<.05)drag=null;
   let a=world(net.a),b=world(net.b),guide;
   if(current<.8){
    const benchSink=260*smooth(current,.12,1.15);
    const r=net.ribbonIndex;
    if(r!==undefined){const y=99+(r-4.5)*.92-benchSink;a=V(-4,y,1.05);b=V(-34.4,y,2.6);guide=new THREE.CatmullRomCurve3([a,V(-16,y,1.05),V(-28,y,1.05),V(-37.5,y,1.05),V(-40.7,y,4.2),V(-37.5,y,7.4),V(-34.6,y,4.6),b]);}
    else {const lane=index-10;a=V(-59-lane*.9,101-benchSink,3);b=V(-82-lane*.9,99-benchSink,3);guide=new THREE.CatmullRomCurve3([a,V(-64-lane*.9,92-benchSink,3),V(-77-lane*.9,92-benchSink,3),b]);}
   } else if(net.ribbonIndex!==undefined){
    const lane=(net.ribbonIndex-4.5)*.9;
    const start=world(anchor(display,[0,-33,-.6],'')),end=world(anchor(esp,[-12,-10,1.2],''));
    const mid=start.clone().lerp(end,.5);mid.y-=6;mid.z=THREE.MathUtils.lerp(14,-7,closed);mid.x=THREE.MathUtils.lerp(mid.x,-23,closed);
    const entry=start.clone().lerp(mid,.35),exit=mid.clone().lerp(end,.65);
    entry.y+=lane;mid.y+=lane;exit.y+=lane;
    guide=new THREE.CatmullRomCurve3([a,entry,mid,exit,b]);
   } else {
    const lane=(index%5)*.4,mid=a.clone().lerp(b,.5);mid.z=THREE.MathUtils.lerp(12+lane,-7-lane*.25,closed);mid.y-=4;
    if(closed>.01)mid.x=THREE.MathUtils.lerp(mid.x,-24+lane,closed);
    guide=new THREE.CatmullRomCurve3([a,a.clone().lerp(mid,.5),mid,mid.clone().lerp(b,.5),b]);
   }
   const targets=guide.getSpacedPoints(N-1),rest=targets.slice(1).map((v,i)=>v.distanceTo(targets[i]));
   if(!net.started){targets.forEach((v,i)=>{net.nodes[i].copy(v);net.old[i].copy(v)});net.started=true;}
   // Damped Verlet integration, fixed solder endpoints, spring routing and length constraints.
   const springK=drag&&drag.net===net?Math.min(1,step*4):Math.min(1,step*24);
   for(let i=1;i<N-1;i++){const node=net.nodes[i],previous=node.clone();delta.copy(node).sub(net.old[i]).multiplyScalar(.55);node.add(delta).addScaledVector(targets[i].clone().sub(node),springK);node.y-=3*step*step;net.old[i].copy(previous);}
   for(let pass=0;pass<12;pass++){net.nodes[0].copy(a);net.nodes[N-1].copy(b);if(drag&&drag.net===net)net.nodes[drag.index].lerp(drag.target,.85);for(let i=0;i<N-1;i++){delta.copy(net.nodes[i+1]).sub(net.nodes[i]);const length=delta.length()||1;delta.multiplyScalar((length-rest[i])/length*.5);if(i>0)net.nodes[i].add(delta);if(i+1<N-1)net.nodes[i+1].sub(delta)}}
   const collideK=(1-closed)*net.shown;if(collideK>.01){const wr=(net.ribbonIndex!==undefined?.45:.34)+.25;for(let i=2;i<N-2;i++)collideNode(net.nodes[i],net.old[i],collideK,wr,a,b);}
   // Bending resistance removes the high-frequency accordion waves of a loose rope.
   const filtered=net.nodes.map(p=>p.clone());for(let i=1;i<N-1;i++)net.nodes[i].lerp(filtered[i-1].clone().add(filtered[i+1]).multiplyScalar(.5),.35);
   net.nodes[0].copy(a);net.nodes[N-1].copy(b);
   const positions=net.mesh.geometry.attributes.position;
   for(let i=0;i<N;i++){tangent.copy(net.nodes[Math.min(N-1,i+1)]).sub(net.nodes[Math.max(0,i-1)]).normalize();normal.crossVectors(tangent,up);if(normal.lengthSq()<.01)normal.set(1,0,0);normal.normalize();binormal.crossVectors(tangent,normal);const radius=index===selected?.62:net.ribbonIndex!==undefined?.45:.34;for(let j=0;j<R;j++){const t=j/R*Math.PI*2,p=net.nodes[i];positions.setXYZ(i*R+j,p.x+radius*(normal.x*Math.cos(t)+binormal.x*Math.sin(t)),p.y+radius*(normal.y*Math.cos(t)+binormal.y*Math.sin(t)),p.z+radius*(normal.z*Math.cos(t)+binormal.z*Math.sin(t)))}}
   positions.needsUpdate=true;net.mesh.geometry.computeVertexNormals();net.mesh.geometry.setDrawRange(0,Math.floor((N-1)*net.shown)*R*6);
   net.mesh.material.emissive.set(net.color);net.mesh.material.emissiveIntensity=index===selected?.5:0;net.mesh.material.transparent=selected>=0&&index!==selected;net.mesh.material.opacity=selected>=0&&index!==selected?.3:1;net.mesh.material.depthWrite=!net.mesh.material.transparent;
  });
 }
 function pick(event,camera,canvas){const rect=canvas.getBoundingClientRect();let best=12,index=-1;const pointer=new THREE.Vector2(event.clientX,event.clientY);nets.forEach((n,j)=>{if(n.shown<.05)return;for(let i=0;i<Math.floor((N-1)*n.shown);i++){const a=root.localToWorld(n.nodes[i].clone()).project(camera),b=root.localToWorld(n.nodes[i+1].clone()).project(camera),p=new THREE.Vector2(rect.left+(a.x+1)*rect.width/2,rect.top+(1-a.y)*rect.height/2),q=new THREE.Vector2(rect.left+(b.x+1)*rect.width/2,rect.top+(1-b.y)*rect.height/2),v=q.clone().sub(p),t=clamp(pointer.clone().sub(p).dot(v)/(v.lengthSq()||1),0,1),distance=pointer.distanceTo(p.addScaledVector(v,t));if(distance<best){best=distance;index=j}}});if(index>=0)choose(index);}
 return {update,pick,nets,group,hover,startDrag,moveDrag,endDrag,get dragging(){return !!drag}};
}
