import * as THREE from 'three';
// A woven loop, with a folded lower end, release buckle and swivel clip.
export function makeLanyard(parent){
 const cv=document.createElement('canvas');cv.width=1024;cv.height=96;const c=cv.getContext('2d');c.fillStyle='#aa98e8';c.fillRect(0,0,1024,96);c.fillStyle='#372a62';c.font='bold 23px Arial';c.textBaseline='middle';
 for(let x=0;x<1024;x+=340){c.fillText('THREE.JS CONF',x+55,48);c.fillStyle='#68508e';c.fillText('PARIS 2026',x+228,48);c.strokeStyle='#68508e';c.lineWidth=2;c.beginPath();c.arc(x+25,48,18,0,Math.PI*2);c.stroke();c.beginPath();c.arc(x+25,48,10,.1,Math.PI-.1);c.stroke();c.fillRect(x+18,40,2,3);c.fillRect(x+29,40,2,3);c.fillStyle='#372a62';}
 const texture=new THREE.CanvasTexture(cv);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.repeat.x=3;texture.anisotropy=8;
 const weave=document.createElement('canvas');weave.width=weave.height=64;const w=weave.getContext('2d');w.fillStyle='#888';w.fillRect(0,0,64,64);for(let i=0;i<64;i+=2){w.fillStyle=i%4?'#aaa':'#666';w.fillRect(i,0,1,64);w.fillStyle='#777';w.fillRect(0,i,64,1)}const bump=new THREE.CanvasTexture(weave);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.repeat.set(35,2);
 const fabric=new THREE.MeshPhysicalMaterial({map:texture,roughness:.9,side:THREE.DoubleSide,bumpMap:bump,bumpScale:.12,sheen:.7,sheenColor:new THREE.Color('#baa9e6')});
 const points=[[0,-46,1],[-20,-29,2],[-26,18,1],[-19,58,3],[0,66,5],[21,53,6],[27,15,3],[16,-27,4],[0,-46,1]].map(a=>new THREE.Vector3(...a));
 const curve=new THREE.CatmullRomCurve3(points,false,'centripetal');const n=160,pos=[],uv=[],indices=[];
 for(let i=0;i<=n;i++){const t=i/n,p=curve.getPoint(t),d=curve.getTangent(t),side=new THREE.Vector3(-d.y,d.x,0).normalize();const twist=Math.sin(t*Math.PI*2)*.35;side.z=twist;side.normalize();for(const sign of [-1,1]){const v=p.clone().addScaledVector(side,sign*4.5);pos.push(...v.toArray());uv.push(t,sign<0?0:1)}if(i<n){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2)}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();const ribbon=new THREE.Mesh(g,fabric);ribbon.castShadow=ribbon.receiveShadow=true;parent.add(ribbon);
 const silver=new THREE.MeshStandardMaterial({color:'#bec4ce',metalness:.93,roughness:.22});const black=new THREE.MeshStandardMaterial({color:'#181921',roughness:.6});
 function mesh(geometry,material,x,y,z){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
 mesh(new THREE.BoxGeometry(13,11,3),black,0,-43,3);
 const ring=mesh(new THREE.TorusGeometry(5,1,8,32),silver,0,-53,2);ring.scale.y=.7;
 mesh(new THREE.CylinderGeometry(2,2,5,16),silver,0,-59,2);
 const hook=mesh(new THREE.TorusGeometry(5,1.15,10,32,Math.PI*1.82),silver,0,-66,2);hook.scale.y=1.35;hook.rotation.z=.25;
 mesh(new THREE.BoxGeometry(1.2,7,1.5),silver,4,-65,2);
 // Attach the clasp to the strap bar when the kit is assembled.
 parent.userData.lanyardMaterials=[fabric,silver,black];return parent;
}
