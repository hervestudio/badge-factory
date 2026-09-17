// Picks a render pixel ratio for this machine: a GPU/CPU heuristic up front, then frame-time
// measurements that step the ratio down if the post-processing chain cannot hold ~50 fps.
const TIER_DPR=[1,1.25,1.5,2];

export function detectPerformance(gl){
 const dbg=gl.getExtension('WEBGL_debug_renderer_info');
 const gpu=String((dbg&&gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))||gl.getParameter(gl.RENDERER)||'');
 const g=gpu.toLowerCase(),ua=navigator.userAgent;
 const cores=navigator.hardwareConcurrency||4,memory=navigator.deviceMemory||8;
 const mobile=/Android|iPhone|iPad|Mobile/i.test(ua)||(navigator.maxTouchPoints>1&&Math.min(innerWidth,innerHeight)<900);
 let tier=2,reason='unknown GPU';
 if(/apple m\d|apple gpu/.test(g)&&!mobile){tier=3;reason='Apple silicon';}
 else if(/nvidia|geforce|rtx|gtx|radeon (rx|pro|vii)|arc a\d/.test(g)){tier=3;reason='discrete GPU';}
 else if(/intel|iris|uhd|hd graphics|vega \d|radeon graphics/.test(g)){tier=1;reason='integrated GPU';}
 else if(/mali|adreno|powervr|videocore/.test(g)){tier=1;reason='mobile GPU';}
 else if(/swiftshader|llvmpipe|software/.test(g)){tier=0;reason='software renderer';}
 if(mobile){tier=Math.min(tier,1);reason+=', mobile';}
 if(cores<=4||memory<=4){tier=Math.min(tier,1);reason+=', small CPU/RAM';}
 let dpr=Math.min(devicePixelRatio||1,TIER_DPR[tier]);
 // Keep the framebuffer under ~9 Mpx whatever the screen (a 5K display at 2× would be four times a laptop panel).
 const budget=Math.sqrt(9e6/Math.max(1,innerWidth*innerHeight));
 if(dpr>budget){dpr=Math.max(1,Math.round(budget*4)/4);reason+=', pixel budget';}
 return {gpu,tier,dpr,reason};
}

// Feed it the wall-clock time of consecutive rendered frames; it answers with a lower ratio when the
// machine is clearly struggling, and never steps back up (avoids oscillating).
export function createAdaptiveRatio(initial,onChange){
 let dpr=initial,samples=[],settled=false,lastTime=0;
 return {
  get dpr(){return dpr},
  frame(time){
   if(settled)return;
   if(lastTime&&time-lastTime<100)samples.push(time-lastTime);
   lastTime=time;
   if(samples.length<90)return;
   samples.sort((a,b)=>a-b);const median=samples[samples.length>>1];samples=[];
   if(median>20&&dpr>1){dpr=Math.max(1,Math.round((dpr-.25)*4)/4);onChange(dpr,median);}
   else settled=true;
  },
  reset(){samples=[];lastTime=0;}
 };
}
