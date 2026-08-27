// Post-load accuracy test and targeted refinement for PECS Eye.
const ACCURACY_TEST_POINTS=[
  {name:'上',xp:50,yp:18,icon:'☀️'},
  {name:'中央',xp:50,yp:50,icon:'🎯'},
  {name:'下',xp:50,yp:82,icon:'🌈'}
];
let accuracyTesting=false;
let accuracyResult=load('pecsEyeAccuracy',null);

function accuracyThresholds(){
  const base=Math.min(innerWidth,innerHeight);
  const good=Math.round(Math.max(65,Math.min(105,base*.10)));
  return {good,refine:Math.round(good*1.45)};
}
function gradeAccuracy(results){
  const valid=results.filter(r=>Number.isFinite(r.error));
  if(!valid.length)return {grade:'測定できません',emoji:'⚪',avg:null,max:null};
  const avg=Math.round(valid.reduce((s,r)=>s+r.error,0)/valid.length);
  const max=Math.round(Math.max(...valid.map(r=>r.error)));
  const {good,refine}=accuracyThresholds();
  if(max<=good)return {grade:'良好',emoji:'🟢',avg,max};
  if(max<=refine)return {grade:'使える範囲',emoji:'🟡',avg,max};
  return {grade:'要調整',emoji:'🔴',avg,max};
}
function updateAccuracyText(){
  let el=document.getElementById('accuracyText');
  if(!el){el=document.createElement('span');el.id='accuracyText';document.querySelector('.status')?.appendChild(el)}
  if(!accuracyResult?.results?.length){el.textContent='精度：未テスト';return}
  const g=gradeAccuracy(accuracyResult.results);
  el.textContent=`精度：${g.emoji}${g.grade}${Number.isFinite(g.avg)?` 平均${g.avg}px`:''}`;
}
function removeTestTarget(){document.querySelectorAll('.accuracy-target').forEach(x=>x.remove())}
function makeTestTarget(point){
  removeTestTarget();
  const t=document.createElement('div');
  t.className='caltarget accuracy-target';
  t.style.left=point.xp+'%';t.style.top=point.yp+'%';
  t.innerHTML=`<span class="ring"></span><span>${point.icon}</span>`;
  $('#cal').appendChild(t);
  return t;
}
async function measureAccuracyPoint(point,index,total){
  const tx=innerWidth*point.xp/100,ty=innerHeight*point.yp/100,t=makeTestTarget(point);
  $('#instruction').textContent=`精度テスト ${index+1}/${total}　${point.name}を見てね`;
  $('#calStatus').textContent='';$('#calhint').textContent='触らずに、絵を見つめるだけでOK';
  await sleep(480);if(!cameraMode)return null;
  t.classList.add('recording');calRaw=[];calCollecting=true;
  const started=performance.now();
  while(cameraMode&&performance.now()-started<820)await sleep(70);
  calCollecting=false;
  if(calRaw.length<4)return {name:point.name,tx,ty,error:Infinity,dx:0,dy:0,point};
  const rawX=median(calRaw.map(v=>v.x)),rawY=median(calRaw.map(v=>v.y));
  const p=applyCorrection(rawX,rawY),dx=p.x-tx,dy=p.y-ty,error=Math.hypot(dx,dy);
  t.classList.remove('recording');t.classList.add('good');t.querySelector('span:last-child').textContent='✓';
  $('#calStatus').textContent=`${point.name}：${Math.round(error)}px`;
  await sleep(260);
  return {name:point.name,tx,ty,rawX,rawY,predX:p.x,predY:p.y,dx,dy,error,point};
}
async function accuracyTestOnce(){
  const results=[];
  for(let i=0;i<ACCURACY_TEST_POINTS.length&&cameraMode;i++){
    const r=await measureAccuracyPoint(ACCURACY_TEST_POINTS[i],i,ACCURACY_TEST_POINTS.length);
    if(r)results.push(r);
  }
  removeTestTarget();
  return results;
}
function resultSummary(results){
  const {good}=accuracyThresholds();
  return results.map(r=>{
    if(!Number.isFinite(r.error))return `⚪${r.name}:測定不可`;
    return `${r.error<=good?'🟢':'🔴'}${r.name}:${Math.round(r.error)}px`;
  }).join('　');
}
async function refineAccuracyPoints(results){
  const {good}=accuracyThresholds();
  const bad=results.filter(r=>!Number.isFinite(r.error)||r.error>good);
  if(!bad.length)return false;
  $('#instruction').textContent='ずれが大きいところだけ、もう一度みよう';
  $('#calStatus').textContent=resultSummary(results);
  $('#calhint').textContent=`${bad.map(r=>r.name).join('・')}だけ追加調整します`;
  await sleep(900);
  for(let i=0;i<bad.length&&cameraMode;i++){
    const r=bad[i],point=r.point,tx=innerWidth*point.xp/100,ty=innerHeight*point.yp/100,t=makeTestTarget({...point,icon:'✨'});
    $('#instruction').textContent=`追加調整 ${i+1}/${bad.length}　${point.name}を見てね`;
    $('#calStatus').textContent='';$('#calhint').textContent='そのまま見つめてね';
    await sleep(450);if(!cameraMode)break;
    t.classList.add('recording');
    calRaw=[];calCollecting=false;
    const warm=performance.now();
    while(cameraMode&&performance.now()-warm<260){try{webgazer.recordScreenPosition(tx,ty,'click')}catch{}await sleep(80)}
    calRaw=[];calCollecting=true;
    const started=performance.now();
    while(cameraMode&&performance.now()-started<720){try{webgazer.recordScreenPosition(tx,ty,'click')}catch{}await sleep(85)}
    calCollecting=false;
    if(calRaw.length>=4)calPairs.push({px:median(calRaw.map(v=>v.x)),py:median(calRaw.map(v=>v.y)),tx,ty});
    t.classList.remove('recording');t.classList.add('good');t.querySelector('span:last-child').textContent='✨';
    await sleep(180);
  }
  removeTestTarget();
  if(cameraMode){buildPersonalCorrection();resetFilter();return true}
  return false;
}
async function runAccuracyTest(autoRefine=true){
  if(accuracyTesting||!cameraMode)return;
  accuracyTesting=true;calibrating=true;calCollecting=false;resetFilter();
  $('#settings').classList.remove('open');$('#cursor').classList.remove('on');$('#cal').classList.add('on');applyPreview(true);$('#error').textContent='';
  $('#instruction').textContent='3点精度テスト';$('#calStatus').textContent='上・中央・下を見ます';$('#calhint').textContent='出てきた絵を見つめてね';
  await sleep(500);
  let results=await accuracyTestOnce();
  if(cameraMode&&autoRefine){
    const {good}=accuracyThresholds();
    if(results.some(r=>!Number.isFinite(r.error)||r.error>good)){
      const refined=await refineAccuracyPoints(results);
      if(refined&&cameraMode){
        $('#instruction').textContent='もう一度、3点を確認するよ';$('#calhint').textContent='最後のチェック！';await sleep(550);
        results=await accuracyTestOnce();
      }
    }
  }
  if(cameraMode){
    const g=gradeAccuracy(results);
    accuracyResult={at:Date.now(),results:results.map(r=>({name:r.name,error:Number.isFinite(r.error)?Math.round(r.error):null,dx:Math.round(r.dx||0),dy:Math.round(r.dy||0)}))};
    save('pecsEyeAccuracy',accuracyResult);updateAccuracyText();
    $('#instruction').textContent=`${g.emoji} 精度テスト：${g.grade}`;
    $('#calStatus').textContent=resultSummary(results);
    $('#calhint').textContent=Number.isFinite(g.avg)?`平均 ${g.avg}px ／ 最大 ${g.max}px`:'顔の位置を確認して再調整してください';
    await sleep(1500);
    calibrating=false;resetFilter();$('#cal').classList.remove('on');applyPreview(false);$('#cursor').classList.add('on');$('#dot').className='dot on';
    $('#status').textContent=`精度テスト：${g.grade}${Number.isFinite(g.avg)?`（平均${g.avg}px）`:''}`;
  }
  calCollecting=false;accuracyTesting=false;removeTestTarget();
}

// After the normal 9-point calibration, automatically run the independent 3-point test.
const baseRunGazeGame=runGazeGame;
runGazeGame=async function(){
  await baseRunGazeGame();
  if(cameraMode&&correction.valid)await runAccuracyTest(true);
};

// Add a standalone accuracy-test button to teacher settings.
(function addAccuracyButton(){
  const actions=document.querySelector('#settings .actions');
  if(actions&&!document.getElementById('accuracyBtn')){
    const b=document.createElement('button');b.id='accuracyBtn';b.className='secondary';b.textContent='🎯 精度テスト';
    b.onclick=()=>{if(cameraMode)runAccuracyTest(true);else{$('#settings').classList.remove('open');$('#status').textContent='先に「カメラ視線を始める」を押してください'}};
    actions.insertBefore(b,actions.firstChild);
  }
  updateAccuracyText();
})();

// Keep previous gaze-action behavior reliable.
const accuracyBaseRunAction=runAction;
runAction=function(action,source){
  if(action==='speak'){lockAction(source);speak();$('#status').textContent='できたことばを伝えました';return}
  if(action==='clear'){sentence=[];render();$('#status').textContent='ことばを全部消しました';lockAction(source);return}
  accuracyBaseRunAction(action,source);
};
