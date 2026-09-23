import * as THREE from 'three';
export const DEFAULTS=Object.freeze({toneMapping:'Neutral',exposure:1.4,contrast:1.02,saturation:.9,environment:.45,ambient:.24,keyIntensity:2.62,keyColor:'#d1d1d1',keyX:-42,keyY:148,keyZ:220,fillIntensity:1.28,fillColor:'#b2b29e',rimIntensity:1.94,rimColor:'#b596ff',shadows:true,shadowSoftness:2.9,ao:true,aoIntensity:1.35,aoRadius:.7,aoThickness:9.4,shellColor:'#9465d3',rearColor:'#f2d22f',shellRoughness:.68,shellMetalness:.17,clearcoat:.76,clearcoatRoughness:.65,surfaceGrain:.145,metalRoughness:.56,metalness:.76,background:'#ffffff',hoverPush:1,zoom:1.2});
export const ranges={exposure:[.1,2.5],contrast:[.5,1.8],saturation:[0,2],environment:[0,2],ambient:[0,2],keyIntensity:[0,8],keyX:[-300,300],keyY:[-300,300],keyZ:[-300,300],fillIntensity:[0,5],rimIntensity:[0,5],shadowSoftness:[0,8],aoIntensity:[0,1.5],aoRadius:[.1,15],aoThickness:[.1,10],shellRoughness:[.05,1],shellMetalness:[0,1],clearcoat:[0,1],clearcoatRoughness:[.05,1],surfaceGrain:[0,.3],metalRoughness:[.05,1],metalness:[0,1],hoverPush:[0,3],zoom:[.6,1.6]};
export function validateSettings(input){const out={...DEFAULTS};for(const key of Object.keys(DEFAULTS)){const v=input[key];if(v===undefined)continue;if(ranges[key]){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(`Invalid ${key}`);out[key]=Math.min(ranges[key][1],Math.max(ranges[key][0],v));}else if(typeof DEFAULTS[key]==='boolean'){if(typeof v!=='boolean')throw new Error(`Invalid ${key}`);out[key]=v;}else if(key==='toneMapping'){if(!['ACES','AgX','Neutral','Linear','None'].includes(v))throw new Error('Unknown tone mapping');out[key]=v;}else {if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw new Error(`Invalid colour: ${key}`);out[key]=v;}}return out;}

// The scene half of the render settings, shared by the dat.GUI panel and the embed page.
export function applyRenderSettings({renderer,scene,camera,key,fill,rim,hemisphere,ao,mat,grade},settings){
 renderer.toneMapping={ACES:THREE.ACESFilmicToneMapping,AgX:THREE.AgXToneMapping,Neutral:THREE.NeutralToneMapping,Linear:THREE.LinearToneMapping,None:THREE.NoToneMapping}[settings.toneMapping];
 renderer.toneMappingExposure=settings.exposure;scene.environmentIntensity=settings.environment;hemisphere.intensity=settings.ambient;
 key.intensity=settings.keyIntensity;key.color.set(settings.keyColor);key.position.set(settings.keyX,settings.keyY,settings.keyZ);
 fill.intensity=settings.fillIntensity;fill.color.set(settings.fillColor);rim.intensity=settings.rimIntensity;rim.color.set(settings.rimColor);
 key.castShadow=settings.shadows;key.shadow.radius=settings.shadowSoftness;
 ao.enabled=settings.ao;ao.blendIntensity=settings.aoIntensity;ao.updateGtaoMaterial({radius:settings.aoRadius,thickness:settings.aoThickness});
 mat.shell.color.set(settings.shellColor);mat.rear.color.set(settings.rearColor);
 for(const m of [mat.shell,mat.rear]){m.roughness=settings.shellRoughness;m.metalness=settings.shellMetalness;m.clearcoat=settings.clearcoat;m.clearcoatRoughness=settings.clearcoatRoughness;m.bumpScale=settings.surfaceGrain;}
 mat.silver.roughness=settings.metalRoughness;mat.silver.metalness=settings.metalness;
 grade.uniforms.contrast.value=settings.contrast;grade.uniforms.saturation.value=settings.saturation;
 camera.zoom=settings.zoom;camera.updateProjectionMatrix();}
