// Keep a good calibration stable during use and provide a safe one-point offset correction.
// Loaded after accuracy-test.js so the full 9-point calibration + accuracy test finishes first.
(function(){
  let modelFrozen=false;
  let quickAdjusting=false;

  function ensureFreezeStatus(){
    let el=document.getElementById('freezeText');
    if(!el){
      el=document.createElement('span');
      el.id='freezeText';
      document.querySelector('.status')?.appendChild(el);
    }
    el.textContent=modelFrozen?'学習：🔒固定':(cameraMode?'学習：調整中':'学習：待機');
  }

  function freezeTraining(){
    try{
      if(window.webgazer?.removeMouseEventListeners){
        webgazer.removeMouseEventListeners();
        modelFrozen=true;
      }
    }catch(e){
      console.warn('Could not freeze WebGazer mouse training',e);
    }
    ensureFreezeStatus();
  }

  // The accuracy-test module already wraps runGazeGame. Freeze only after that whole routine finishes.
  const stabilityBaseRunGazeGame=runGazeGame;
  runGazeGame=async function(){
    modelFrozen=false;ensureFreezeStatus();
    await stabilityBaseRunGazeGame();
    if(cameraMode&&correction?.valid)freezeTraining();
  };

  const stabilityBaseStopCamera=stopCamera;
  stopCamera=async function(close=true){
    const result=await stabilityBaseStopCamera(close);
    modelFrozen=false;ensureFreezeStatus();
    return result;
  };

  function removeQuickTarget(){
    document.querySelectorAll('.quick-adjust-target').forEach(el=>el.remove());
  }

  function applyOffset(dx,dy){
    // A one-point check can safely correct translation drift, but must not rewrite scale/rotation.
    const maxShift=180;
    dx=Math.max(-maxShift,Math.min(maxShift,dx));
    dy=Math.max(-maxShift,Math.min(maxShift,dy));
    if(correction?.type==='affine2d'){
      correction.cx=(Number(correction.cx)||0)+dx;
      correction.cy=(Number(correction.cy)||0)+dy;
    }else if(correction?.valid&&Number.isFinite(correction.sx)){
      correction.bx=(Number(correction.bx)||0)+dx;
      correction.by=(Number(correction.by)||0)+dy;
    }else{
      return false;
    }
    correction.quickAdjustedAt=Date.now();
    correction.quickDx=Math.round(dx);
    correction.quickDy=Math.round(dy);
    save('pecsEyeCorrection',correction);
    updateCorrectionText();
    return true;
  }

  async function runQuickAdjust(){
    if(quickAdjusting||!cameraMode)return;
    if(!correction?.valid){
      $('#settings')?.classList.remove('open');
      $('#status').textContent='先に「みつめて再調整」をしてください';
      return;
    }
    quickAdjusting=true;
    let applied=false;
    let finalStatus='かんたん再調整は反映していません';
    calibrating=true;calCollecting=false;calRaw=[];resetFilter();
    $('#settings')?.classList.remove('open');
    $('#cursor')?.classList.remove('on');
    $('#cal')?.classList.add('on');
    applyPreview(true);
    $('#error').textContent='';
    $('#instruction').textContent='かんたん再調整';
    $('#calStatus').textContent='中央だけ確認します';
    $('#calhint').textContent='🎯をそのまま見つめてね';

    removeQuickTarget();
    const t=document.createElement('div');
    t.className='caltarget quick-adjust-target';
    t.style.left='50%';t.style.top='50%';
    t.innerHTML='<span class="ring"></span><span>🎯</span>';
    $('#cal').appendChild(t);

    await sleep(650);
    if(!cameraMode){quickAdjusting=false;removeQuickTarget();return}
    t.classList.add('recording');
    calRaw=[];calCollecting=true;
    const started=performance.now();
    while(cameraMode&&performance.now()-started<1050)await sleep(70);
    calCollecting=false;

    if(!cameraMode){quickAdjusting=false;removeQuickTarget();return}
    if(calRaw.length<6){
      $('#instruction').textContent='測定できませんでした';
      $('#calStatus').textContent='顔の位置を確認してください';
      $('#calhint').textContent='必要なら9点の再調整をしてください';
      finalStatus='かんたん再調整：測定できませんでした';
      await sleep(1200);
    }else{
      const rawX=median(calRaw.map(v=>v.x)),rawY=median(calRaw.map(v=>v.y));
      const before=applyCorrection(rawX,rawY);
      const tx=innerWidth/2,ty=innerHeight/2;
      const dx=tx-before.x,dy=ty-before.y;
      const error=Math.hypot(dx,dy);
      if(!Number.isFinite(error)||error>260){
        $('#instruction').textContent='ずれが大きすぎます';
        $('#calStatus').textContent=Number.isFinite(error)?`${Math.round(error)}px`:'測定不可';
        $('#calhint').textContent='9点のみつめて再調整をしてください';
        finalStatus='ずれが大きいため、9点の再調整がおすすめです';
        await sleep(1400);
      }else if(applyOffset(dx,dy)){
        applied=true;
        t.classList.remove('recording');t.classList.add('good');
        t.querySelector('span:last-child').textContent='✨';
        $('#instruction').textContent='かんたん再調整 完了';
        $('#calStatus').textContent=`ずれを ${Math.round(error)}px 補正しました`;
        $('#calhint').textContent='9点調整の形は変えず、位置だけ合わせました';
        finalStatus=`かんたん再調整を反映しました（${Math.round(error)}px）`;
        await sleep(900);
      }
    }

    removeQuickTarget();
    calibrating=false;calCollecting=false;resetFilter();
    $('#cal')?.classList.remove('on');
    applyPreview(false);
    $('#cursor')?.classList.add('on');
    $('#dot').className='dot on';
    freezeTraining();
    $('#status').textContent=finalStatus;
    quickAdjusting=false;
  }

  // Add one compact control to teacher settings.
  const actions=document.querySelector('#settings .actions');
  if(actions&&!document.getElementById('quickAdjustBtn')){
    const b=document.createElement('button');
    b.id='quickAdjustBtn';b.className='secondary';b.textContent='🎯 1点かんたん再調整';
    b.onclick=runQuickAdjust;
    const recal=document.getElementById('recalBtn');
    actions.insertBefore(b,recal||actions.firstChild);
  }

  ensureFreezeStatus();
})();
