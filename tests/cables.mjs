import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCables } from '../dist/cables.js';
const element=()=>({append(){},addEventListener(){},querySelector:()=>element(),style:{setProperty(){}},classList:{toggle(){}}});
globalThis.document={querySelector:()=>element(),createElement:()=>element(),body:element()};
const root=new THREE.Group(),parts={};for(const name of ['display','esp','battery','charger','strip']){parts[name]=new THREE.Group();root.add(parts[name]);}parts.switches=Array.from({length:3},()=>{const g=new THREE.Group();root.add(g);return g;});
const cables=createCables(root,parts);assert.equal(cables.nets.length,24);
assert.match(cables.nets.find(n=>n.name==='Display / SCL').b.label,/GPIO 14 \(J1-20\)/);
assert.match(cables.nets.find(n=>n.name==='Power / 5 V').b.label,/5V \(J1-21\)/);
assert.ok(!cables.nets.some(n=>n.name.includes('SDO')));
for(const progress of [0,.5,1,6.9,7.3,8,9,10]){
 parts.display.position.set(47*(1-progress/10),3,-4);parts.display.rotation.y=2.88*(1-progress/10);parts.esp.position.set(-47*(1-progress/10),27,-12);
 for(let frame=0;frame<12;frame++)cables.update(progress,1/60);
 if(progress<7)continue;
 for(const n of cables.nets){if(!n.mesh.visible)continue;
 const a=root.worldToLocal(n.a.object.localToWorld(n.a.point.clone())),b=root.worldToLocal(n.b.object.localToWorld(n.b.point.clone()));
 assert.ok(n.nodes[0].distanceTo(a)<1e-9);assert.ok(n.nodes.at(-1).distanceTo(b)<1e-9);
 assert.ok([...n.mesh.geometry.attributes.position.array].every(Number.isFinite));
 }
}
console.log('24 connections verified: solder endpoints remain pinned during opening and closing; all vertices finite; SPI, power and unconnected SDO mappings checked.');
