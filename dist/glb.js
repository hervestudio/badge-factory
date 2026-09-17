import * as THREE from 'three';

// Minimal GLB reader for untextured PBR meshes (positions, normals, indices, KHR_materials_clearcoat).
const TYPE_SIZE={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const ARRAY={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
export async function loadGLB(url){
 const buf=await (await fetch(url)).arrayBuffer(),dv=new DataView(buf);
 if(dv.getUint32(0,true)!==0x46546c67)throw new Error('Not a GLB file: '+url);
 let offset=12,json=null,bin=null;
 while(offset<buf.byteLength){const len=dv.getUint32(offset,true),type=dv.getUint32(offset+4,true);const chunk=buf.slice(offset+8,offset+8+len);if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(chunk));else if(type===0x004e4942)bin=chunk;offset+=8+len;}
 const accessor=i=>{const a=json.accessors[i],v=json.bufferViews[a.bufferView],size=TYPE_SIZE[a.type],Arr=ARRAY[a.componentType];return {array:new Arr(bin,(v.byteOffset||0)+(a.byteOffset||0),a.count*size),size};};
 const materials=(json.materials||[]).map(m=>{const pbr=m.pbrMetallicRoughness||{},cc=m.extensions?.KHR_materials_clearcoat;const c=pbr.baseColorFactor||[1,1,1,1];return new THREE.MeshPhysicalMaterial({color:new THREE.Color().setRGB(c[0],c[1],c[2],THREE.LinearSRGBColorSpace),metalness:pbr.metallicFactor??1,roughness:pbr.roughnessFactor??1,clearcoat:cc?.clearcoatFactor||0,clearcoatRoughness:cc?.clearcoatRoughnessFactor||0,side:m.doubleSided?THREE.DoubleSide:THREE.FrontSide});});
 const parts=[];
 for(const mesh of json.meshes)for(const prim of mesh.primitives){const g=new THREE.BufferGeometry();const pos=accessor(prim.attributes.POSITION);g.setAttribute('position',new THREE.BufferAttribute(pos.array,pos.size));if(prim.attributes.NORMAL!==undefined){const n=accessor(prim.attributes.NORMAL);g.setAttribute('normal',new THREE.BufferAttribute(n.array,n.size));}else g.computeVertexNormals();if(prim.indices!==undefined){const idx=accessor(prim.indices);g.setIndex(new THREE.BufferAttribute(idx.array,1));}parts.push({geometry:g,material:materials[prim.material]||new THREE.MeshStandardMaterial()});}
 return parts;
}
