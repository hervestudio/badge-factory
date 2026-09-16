/* Runs the user's unchanged, compiled badge firmware off the render thread.
   Artifact edition: emu.js contains raw text with control bytes (embedded WASM)
   that static hosting can't serve as .js, so it ships as emu.bin and is executed
   from a same-origin blob. NOTE: emu.js defines Emscripten globals (run, Module…)
   in this scope — local names here must not collide. */
var Module = {onRuntimeInitialized() { Module._emu_init(); postMessage({ready:true}); }};
var queuedMsgs = [];
onmessage = e => queuedMsgs.push(e);

fetch('./emu.bin').then(r => r.arrayBuffer()).then(buf => {
 try { importScripts(URL.createObjectURL(new Blob([buf], {type: 'text/javascript'}))); }
 catch (err) { (0, eval)(new TextDecoder('utf-8').decode(buf)); }
 onmessage = handleFrame;
 queuedMsgs.forEach(handleFrame);
 queuedMsgs = null;
}).catch(err => postMessage({error: String(err)}));

function handleFrame({data}) {
 if(data.reset) { Module._emu_init(); return; }
 const d=new Date(),day=d.getFullYear()===2026&&d.getMonth()===8?(d.getDate()===10?1:d.getDate()===11?2:0):0;
 Module._emu_set_now(day,day?d.getHours()*60+d.getMinutes():-1);
 Module._emu_frame(data.dt,data.mask);
 const ptr=Module._emu_fb()>>1,fb=Module.HEAPU16,px=new Uint8ClampedArray(360*360*4);
 for(let i=0,j=0;i<360*360;i++,j+=4){const c=fb[ptr+i];px[j]=(c>>11)<<3;px[j+1]=((c>>5)&63)<<2;px[j+2]=(c&31)<<3;px[j+3]=255;}
 postMessage({pixels:px.buffer,mode:Module._emu_mode()},[px.buffer]);
}
