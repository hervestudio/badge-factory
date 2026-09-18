import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Shared component builders: the interactive page and the guide's figures draw the same parts.
export const material=(color,roughness=.5,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
export const mat={shell:material('#ad91e0',.72),yellow:material('#f2d22f',.55),pcb:material('#163c33',.66),blue:material('#1d4474',.6),chip:material('#1a1b23',.65),silver:material('#bdc3cc',.3,.72),gold:material('#d2aa55',.36,.7),white:material('#f1ede5'),black:material('#151321',.65)};
export function mesh(parent,geometry,m,pos=[0,0,0]){const o=new THREE.Mesh(geometry,m);o.castShadow=!m.transparent;o.receiveShadow=true;o.position.fromArray(pos);parent.add(o);return o}
export function box(parent,w,h,d,m,pos){return mesh(parent,(Math.min(w,h,d)>=1?new RoundedBoxGeometry(w,h,d,2,Math.min(.55,Math.min(w,h,d)*.16)):new THREE.BoxGeometry(w,h,d)),m,pos)}
export function cyl(parent,r,h,m,pos){const g=new THREE.CylinderGeometry(r,r,h,48);g.rotateX(Math.PI/2);return mesh(parent,g,m,pos)}
export function texture(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
export function decal(parent,w,h,pos,paint,res=512){const t=texture(res,Math.round(res*h/w),paint);const o=mesh(parent,new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,transparent:true,depthWrite:false,roughness:.64,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),pos);o.position.z+=Math.sign(o.position.z||1)*.12;return o}
export function wire(parent,points,color,r=.37){return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),32,r,6,false),material(color,.62))}
export function label(parent,text,w,h,pos,bg='#edf0e3',fg='#24252a'){return decal(parent,w,h,pos,(c,W,H)=>{c.fillStyle=bg;c.fillRect(0,0,W,H);c.fillStyle=fg;c.textAlign='center';c.textBaseline='middle';c.font=`bold ${H*.32}px monospace`;text.split('\n').forEach((s,i,a)=>c.fillText(s,W/2,H*(i+1)/(a.length+1),W*.93))})}

// Display module, modeled to the measured CAD footprint. `screenMaterial` fills the active area.
export function buildDisplay(display,screenMaterial){
 cyl(display,29.62,1.6,mat.blue,[0,0,-1.4]);box(display,30.5,13,1.6,mat.blue,[0,-30.7,-1.4]);
 cyl(display,27.96,2.5,material('#0c0c18',.2,.12),[0,0,.4]);
 const screenMesh=mesh(display,new THREE.CircleGeometry(26.8,96),screenMaterial||material('#07070c',.18,.05),[0,0,1.82]);
 for(let i=0;i<10;i++){cyl(display,.7,.3,mat.gold,[-11.43+i*2.54,-33, -.45]);box(display,.65,3,.65,mat.gold,[-11.43+i*2.54,-34.5,-2.6])}
 const displaySilk=label(display,'TFT 2.1 0_10\nGC9B72   360×360',36,10,[0,13,-2.24],'#204d75','#cad4df');displaySilk.rotation.y=Math.PI;
 box(display,8,6,1,mat.chip,[0,-14,-2.6]);
 for(let i=0;i<6;i++){box(display,1.2,2,.65,i%2?mat.silver:mat.chip,[-12+i*4,-20,-2.6]);wire(display,[[-11+i*4,-30,-2.25],[-11+i*4,-25,-2.25],[-8+i*3,-18,-2.25]],'#63899a',.12)}
 return screenMesh;
}
// DevKit with RF can, antenna, headers, USB connectors and surface components.
export function buildESP(esp){
 box(esp,28.2,64.4,1.6,material('#16181c',.5),[0,0,0]);box(esp,18,20,2.6,mat.silver,[0,12,2.1]);label(esp,'ESPRESSIF\nESP32-S3\nN16R8',10,7.5,[0,12,3.43],'#c8cbd0','#43484e');
 box(esp,16,10,.2,mat.black,[0,26.3,.94]);
 for(let i=0;i<5;i++){box(esp,1,6,.12,mat.gold,[-6+i*3,27,1.1]);if(i<4)box(esp,3,1,.12,mat.gold,[-4.5+i*3,i%2?24.5:29.5,1.1])}
 for(let side of [-1,1])for(let i=0;i<22;i++){const x=side*12,y=27-i*2.54;cyl(esp,.82,.16,mat.gold,[x,y,1]);box(esp,.55,.55,3,mat.gold,[x,y,-1.7]);}
 box(esp,8,8,1.4,mat.chip,[0,-9,1.5]);for(let i=0;i<14;i++)box(esp,1.2,2,.8,i%3?mat.chip:mat.silver,[-8+(i%4)*5,-19+Math.floor(i/4)*6,1.1]);
 for(const x of [-6,6]){box(esp,8.2,6.4,2.5,mat.silver,[x,-28.8,2]);box(esp,6.7,.2,1.3,mat.black,[x,-32.1,2]);box(esp,3,4,1,mat.silver,[x,-20,1.5]);box(esp,1.5,2,1,mat.black,[x,-20,2.3])}
 label(esp,'ESP32-S3',15,3,[0,-3,1],'#16181c','#c9ced6');
}
// Landscape foil pouch.
export function buildBattery(battery){
 box(battery,60,50,4.8,mat.silver,[0,0,0]);box(battery,60.8,4.6,5.4,mat.yellow,[0,23.1,0]);box(battery,60.8,2.6,5.4,mat.yellow,[0,-24.1,0]);
 for(const x of [-29.9,29.9])box(battery,1.4,50.6,5.4,mat.yellow,[x,0,0]);
 decal(battery,47,29,[0,0,2.43],(c,w,h)=>{c.fillStyle='#c7c9cd';c.fillRect(0,0,w,h);c.fillStyle='#42464c';c.font=`${h*.12}px monospace`;c.textAlign='center';['Li-ion POLYMER','505060   3.7 V','2000 mAh   7.4 Wh','+                  −'].forEach((t,i)=>c.fillText(t,w/2,h*(.25+i*.16)));});
}
// USB-C charger and boost board.
export function buildCharger(charger){
 box(charger,24,18,1.1,material('#16181c',.5),[0,0,0]);box(charger,7,7,3,mat.chip,[-5,1,-2]);box(charger,5,4,1.1,mat.chip,[5,2,-1.3]);box(charger,1.3,1.1,.5,material('#e04338',.35),[1.8,-6.5,-1.4]);box(charger,1.3,1.1,.5,material('#3f7de0',.35),[4,-6.5,-1.4]);
 box(charger,8.5,6,3.1,mat.silver,[-5.5,-8,-2]);box(charger,6.9,.2,1.8,mat.black,[-5.5,-11.1,-2]);
 for(let i=0;i<4;i++){cyl(charger,1,.2,mat.gold,[-9+i*6,7,-.65]);box(charger,1.3,2,.8,mat.silver,[-8+i*5,-3,-1])}
 const powerText=label(charger,'TP4056  5V',17,3,[0,0,-3.6],'#16181c','#c9ced6');powerText.rotation.y=Math.PI;
}
// Stripboard and the four flat 100 kOhm resistors.
export function buildStrip(strip){
 box(strip,12.7,20.3,1.2,material('#94713c'),[0,0,0]);
 for(let i=0;i<5;i++){box(strip,1.4,19,.1,mat.gold,[-5.08+i*2.54,0,-.66]);for(let j=0;j<8;j++)cyl(strip,.43,.15,mat.black,[-5.08+i*2.54,-8.89+j*2.54,-.76]);}
 for(let i=0;i<4;i++){const x=-5.08+i*2.54,y=-6+i*4;box(strip,1.8,1.5,1.4,material('#acd4df'),[x+1.27,y,-1.5]);wire(strip,[[x,y,-.8],[x+.5,y,-1.5],[x+2,y,-1.5],[x+2.54,y,-.8]],'#c0c4c6',.13)}
}
// 6 x 6 x 5 tactile switch with four legs.
export function buildSwitch(sw){
 box(sw,6,6,3.5,mat.black,[0,0,-1.8]);box(sw,5.8,5.8,.5,mat.silver,[0,0,.2]);cyl(sw,1.7,1.3,mat.black,[0,0,1]);for(const sx of [-1,1])for(const sy of [-1,1])box(sw,.55,2.8,.45,mat.silver,[sx*3.2,sy*3.3,-1]);
}
// Spool of silicone hook-up wire, lying on a flange.
export function buildSpool(sp,color,spin){
 const roll=new THREE.Group();sp.add(roll);roll.rotation.z=spin;
 for(const z of [-6.6,6.6])cyl(roll,14,1.8,mat.white,[0,0,z]);
 cyl(roll,11.6,11,material(color,.6),[0,0,0]);
 cyl(roll,4.4,15.4,mat.white,[0,0,0]);
 for(const z of [-2.8,.4,3.1])mesh(roll,new THREE.TorusGeometry(11.6,.5,10,48),material(color,.5),[0,0,z]);
 wire(roll,[[11.4,0,3],[16.5,3.5,-.5],[21.5,8,-4],[26,13,-6.7]],color,.6);
}
export function buildStrapBar(bar){const bg=new THREE.CylinderGeometry(1.5,1.5,29.4,24);bg.rotateZ(Math.PI/2);mesh(bar,bg,mat.silver);}

// Planar UVs for the tessellated CAD parts, so the shell grain reads on every face.
export function planarUVs(g){const a=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(a.count*2);for(let i=0;i<a.count;i++){const x=Math.abs(n.getX(i)),y=Math.abs(n.getY(i)),z=Math.abs(n.getZ(i));uv[i*2]=(x>z?a.getY(i):a.getX(i))/10;uv[i*2+1]=(z>=x&&z>=y?a.getY(i):a.getZ(i))/10;}g.setAttribute('uv',new THREE.BufferAttribute(uv,2));}

// Solder points used by the wiring, in each part's own frame (mirrors cables.js).
export const PINS={
 esp:(side,row)=>[side*12,27-(row-1)*2.54,1.2],
 displayPad:i=>[-11.43+i*2.54,-33,-.6],
 strip:(i,y=6.35)=>[-5.08+i*2.54,y,-.9],
 charger:i=>[-9+i*6,7,-.8],
 switchSignal:[3.2,3.3,-1],switchGround:[-3.2,3.3,-1],
 batteryPlus:[-10,25,1],batteryMinus:[10,25,1],
};
export const RIBBON_COLORS=['#70422b','#d52b27','#ef791a','#e7c526','#229657','#246fc1','#8b43c5','#90979c','#eee8dc','#151621'];
