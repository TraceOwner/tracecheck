'use strict';

(() => {
  // The pause control lives in site.js; this file only follows its state.
  let paused = window.TraceUI?.motionStopped() ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stages = [];
  window.TraceUI?.onMotion(value => { paused = value; stages.forEach(stage => stage.sync()); });
  const hero=document.querySelector('.cinema-hero');
  if(hero){
    const embers=document.createElement('div');
    embers.className='trace-embers';embers.setAttribute('aria-hidden','true');
    for(let i=0;i<12;i++){
      const dot=document.createElement('i');
      dot.style.cssText='--ember-x:'+(8+i*37%85)+'%;--ember-drift:'+(i%2?75:-65)+'px;--ember-time:'+(8+i%5)+'s;--ember-delay:'+(-i*1.7)+'s';
      embers.append(dot);
    }
    hero.append(embers);
  }

  /* ───── Smoke ─────
     Each route is a different instrument view into the same field (the shader
     lives in smoke-core.js). Where OffscreenCanvas exists the canvas is handed
     to a worker, so context creation, shader compilation and every frame stay
     off this thread; otherwise the same core runs here. */
  const legalLayout=document.querySelector('body[data-page="legal"] .legal-layout');
  if(legalLayout){
    const scene=document.createElement('div');
    scene.className='trace-legal-scene';
    scene.setAttribute('aria-hidden','true');
    legalLayout.prepend(scene);
  }
  const sceneByPage={check:1,methodology:2,projects:3,tools:4};
  const terminalMode=()=>({powershell:0,cmd:1,manual:2})[document.body.dataset.terminalMode]??0;
  const offscreen='Worker' in window && 'OffscreenCanvas' in window && 'transferControlToOffscreen' in HTMLCanvasElement.prototype;
  const hosts=new Map();
  let worker=null,nextId=1,core=null,modal=false;

  function getWorker(){
    if(worker!==null)return worker||null;
    try{
      worker=new Worker('smoke-worker.js');
      worker.onmessage=({data})=>hosts.get(data.id)?.message(data);
      // A worker that cannot start hands every canvas back to the page.
      worker.onerror=()=>{worker.terminate();worker=false;hosts.forEach(stage=>stage.recover());};
    }catch{worker=false;}
    return worker||null;
  }
  function loadCore(){
    return core??=new Promise(resolve=>{
      if(window.TraceSmoke)return resolve();
      const script=document.createElement('script');
      script.src='smoke-core.js';script.onload=script.onerror=()=>resolve();
      document.head.append(script);
    });
  }

  function stage(host){
    const id=nextId++;
    const home=host.classList.contains('cinema-hero');
    const scene=home?0:
      host.classList.contains('trace-legal-scene')?6:(sceneByPage[document.body.dataset.page]??1);
    const strength=home?1:scene===1?.92:scene===6?.52:.76;
    let canvas=null,backend=null,visible=false,mounted=false,live=false,inWorker=false,frame=0;
    let width=0,height=0,rect=null,scroll=0,pointer=null,mode=terminalMode();

    // Geometry is read once per scroll frame, never inside the render loop.
    function measure(){
      rect=host.getBoundingClientRect();
      const next=Math.max(0,Math.min(1,-rect.top/Math.max(1,host.clientHeight)));
      if(Math.abs(next-scroll)>.0004){scroll=next;backend?.input({scroll});if(paused)backend?.still();}
    }
    function attach(){
      canvas=document.createElement('canvas');
      canvas.className='trace-atmosphere';canvas.setAttribute('aria-hidden','true');
      host.prepend(canvas);
      const shared=offscreen&&getWorker();
      if(shared){
        inWorker=true;
        const surface=canvas.transferControlToOffscreen();
        shared.postMessage({id,type:'create',canvas:surface,scene,strength},[surface]);
        backend={
          resize:(w,h)=>shared.postMessage({id,type:'resize',w,h}),
          input:patch=>shared.postMessage({id,type:'input',patch}),
          still:()=>shared.postMessage({id,type:'still'}),
          run:on=>shared.postMessage({id,type:'run',on})
        };
        prime();
      }else{
        inWorker=false;
        const own=canvas;
        loadCore().then(()=>{
          if(canvas!==own)return;
          const smoke=window.TraceSmoke?.create(own,{scene,strength,live:onLive,lost:onLost});
          if(!smoke){onLost();return;}
          backend=smoke;prime();
        });
      }
    }
    function prime(){
      backend.resize(width,height);
      backend.input({scroll,mode,...(pointer||{})});
      if(paused)backend.still();
      sync();
    }
    function onLive(){if(live)return;live=true;requestAnimationFrame(()=>canvas?.classList.add('is-live'));}
    function onLost(){
      backend=null;
      canvas?.remove();canvas=null;
      host.dataset.atmosphere='fallback';
    }
    function recover(){
      // Only canvases that were given to the failed worker are rebuilt on this thread.
      if(!inWorker)return;
      canvas?.remove();canvas=null;backend=null;live=false;
      attach();
    }
    function sync(){
      const active=!paused && !document.hidden && visible && !modal && !!backend;
      backend?.run(active);
      host.dataset.motion=paused?'paused':visible && !document.hidden?'running':'idle';
    }
    function mount(){
      if(mounted)return;
      mounted=true;
      host.dataset.atmosphere='webgl';
      attach();
    }
    function resize(){
      width=host.clientWidth;height=host.clientHeight;
      // Soft smoke needs no retina buffer; cap fill rate on large desktop displays.
      // On the landing page the smoke shares the GPU with the 3D word, so its buffer is smaller still (it is drawn
      // blurred and stretched anyway).
      const ratio=Math.min(1,(home?720:1080)/Math.max(1,width));
      width=Math.round(width*ratio);height=Math.round(height*ratio);
      measure();
      backend?.resize(width,height);
    }
    function aim(event){
      if(paused || event.pointerType==='touch' || !rect)return;
      pointer={x:(event.clientX-rect.left)/rect.width,y:1-(event.clientY-rect.top)/rect.height};
      if(frame)return;
      frame=requestAnimationFrame(()=>{frame=0;backend?.input(pointer);});
    }
    host.addEventListener('pointerenter',()=>{rect=host.getBoundingClientRect();});
    host.addEventListener('pointermove',aim,{passive:true});
    host.addEventListener('pointerleave',()=>{pointer={x:.5,y:.5};backend?.input(pointer);});
    if(scene===1)new MutationObserver(()=>{
      mode=terminalMode();backend?.input({mode});
      if(paused)backend?.still();
    }).observe(document.body,{attributes:true,attributeFilter:['data-terminal-mode']});
    new ResizeObserver(resize).observe(host);
    // The canvas is only created when its host is close to the viewport.
    new IntersectionObserver(entries=>{
      visible=entries[0].isIntersecting;
      if(visible)mount();
      sync();
    },{rootMargin:'160px 0px'}).observe(host);

    const api={sync,recover,measure:()=>visible&&measure(),calm:on=>backend?.input({calm:on}),message({type}){
      if(type==='live')onLive();
      else if(type==='lost')onLost();
    }};
    hosts.set(id,api);
    stages.push(api);
  }

  // The landing page's first screen keeps its smoke behind the 3D word (owner, 2026-10-03: the background must move).
  document.querySelectorAll('.cinema-hero, .page-intro, .trace-legal-scene').forEach(stage);

  // Scroll parallax is read once per frame from the page's single scroll handler (TraceUI.onScroll in site.js).
  // While the page scrolls, the smoke slows its frame rate (smoke-core.js) and picks it up again 200 ms after the
  // last scroll: the page's frames come first.
  let calm=false,calmTimer=0;
  const onScroll=()=>{
    stages.forEach(stage=>stage.measure());
    if(!calm){calm=true;stages.forEach(stage=>stage.calm(true));}
    clearTimeout(calmTimer);calmTimer=setTimeout(()=>{calm=false;stages.forEach(stage=>stage.calm(false));},200);
  };
  if(window.TraceUI?.onScroll)TraceUI.onScroll(onScroll);
  else addEventListener('scroll',onScroll,{passive:true});
  // A modal dialog dims and blurs the page, so the smoke behind it stands still.
  const dialogs=[...document.querySelectorAll('dialog')];
  const watchDialogs=new MutationObserver(()=>{
    const open=dialogs.some(dialog=>dialog.open);
    if(open===modal)return;
    modal=open;stages.forEach(stage=>stage.sync());
  });
  dialogs.forEach(dialog=>watchDialogs.observe(dialog,{attributes:true,attributeFilter:['open']}));
  document.addEventListener('visibilitychange',()=>stages.forEach(stage=>stage.sync()));
})();
