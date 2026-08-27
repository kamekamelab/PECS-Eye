// Accuracy test that does not advance until gaze is actually aligned and stable.
const ACCURACY_TEST_POINTS=[
  {name:'上',xp:50,yp:18,icon:'☀️'},
  {name:'中央',xp:50,yp:50,icon:'🎯'},
  {name:'下',xp:50,yp:82,icon:'🌈'}
];
let accuracyTesting=false;
let accuracyResult=load('pecsEyeAccuracy',null);

function accuracyThresholds(){
  const base=Math.min(innerWidth,innerHeight);
  const excellent=Math.round(Math.max(45,Math.min(78,base*.075)));
  const pass=Math.round(Math.max(75,Math.min(120,base*.115)));
  return {excellent,pass};
}
function gradeAccuracy(results){
  const valid=results.filter(r=>Number.isFinite(r.error));
  if(!valid.length)return {grade:'測定できません',emoji:'⚪',avg:null,max:null};
  const avg=Math.round(valid.reduce((s,r)=>s+r.error,0)/valid.length);
  const max=Math.round(Math.max(...valid.map(r=>r.error)));
  const {excellent,pass}=accuracyThresholds();
  if(results.some(r=>r.blocked)||max>pass)return {grade:'要調整',emoji:'🔴',avg,max};
  if(max<=excellent)return {grade:'良好',emoji:'🟢',avg,max};
  return {grade:'使用可能',emoji:'🟡',avg,max};
}
function updateAccuracyText(){
  let el=document.getElementById('accuracyText');
  if(!el){el=document.createElement('span');el.id='accuracyText';document.querySelector('.status')?.appendChild(el)}
  if(!accuracyResult?.results?.length){el.textContent='精度：未テスト';return}
  const g=gradeAccuracy(accuracyResult.results);
  el.textContent=`精度：${g.emoji}${g.grade}${Number.isFinite(g.avg)?` 平均${g.avg}px`:''}`;
}
function removeTestTarget(){
  document.querySelectorAll('.accuracy-target,.accuracy-prediction').forEach(x=>x.remove());
}
function makeTestTarget(point){
  removeTestTarget();
  const t=document.createElement('div');
  t.className='caltarget accuracy-target';
  t.style.left=point.xp+'%';t.style.top=point.yp+'%';
  t.innerHTML=`<span class="ring"></span><span>${point.icon}</span>`;
  $('#cal').appendChild(t);
  return t;
}
function showAccuracyPrediction(x,y,ok=false){
  let d=document.querySelector('.accuracy-prediction');
  if(!d){
    d=document.createElement('div');d.className='accuracy-prediction';
    Object.assign(d.style,{position:'fixed',width:'28px',height:'28px',borderRadius:'50%',transform:'translate(-50%,-50%)',zIndex:'10005',pointerEvents:'none',border:'5px solid #fff',boxShadow:'0 2px 14px #0005'});
    $('#cal').appendChild(d);
  }
  d.style.left=x+'px';d.style.top=y+'px';d.style.background=ok?'#22c55e':'#ef4444';
}
async function collectAccuracyWindow(ms=500){
  calRaw=[];calCollecting=true;
  const started=performance.now();
  while(cameraMode&&performance.now()-started<ms)await sleep(55);
  calCollecting=false;
  if(calRaw.length<4)return null;
  const rawX=median(calRaw.map(v=>v.x)),rawY=median(calRaw.map(v=>v.y));
  return {rawX,rawY};
}
async function refineCurrentPoint(sample,tx,ty){
  if(!sample)return;
  // Teach WebGazer again while the learner keeps looking at this same target.
  for(let i=0;i<6&&cameraMode;i++){
    try{webgazer.recordScreenPosition(tx,ty,'click')}catch{}
    await sleep(65);
  }
  // Also add this person's observed gaze/target pair to our 2-D correction model.
  calPairs.push({px:sample.rawX,py:sample.rawY,tx,ty});
  buildPersonalCorrection();
  resetFilter();
}
async function measureAccuracyPoint(point,index,total){
  const tx=innerWidth*point.xp/100,ty=innerHeight*point.yp/100,t=makeTestTarget(point);
  const {pass}=accuracyThresholds();
  $('#instruction').textContent=`精度テスト ${index+1}/${total}　${point.name}を見てね`;
  $('#calStatus').textContent='';
  $('#calhint').textContent='目標と赤い点が重なるまで、そのまま見つめてね';
  await sleep(550);if(!cameraMode)return null;

  let goodStreak=0,refineCount=0,lastResult=null;
  while(cameraMode){
    t.classList.add('recording');
    const sample=await collectAccuracyWindow(520);
    if(!cameraMode)return null;
    if(!sample){
      t.style.borderColor='#f59e0b';
      $('#calStatus').textContent='顔を確認しています。もう少し見てね';
      $('#calhint').textContent='顔をカメラ正面に向けて、そのまま見つめてね';
      await sleep(250);continue;
    }
    const p=applyCorrection(sample.rawX,sample.rawY),dx=p.x-tx,dy=p.y-ty,error=Math.hypot(dx,dy),ok=error<=pass;
    lastResult={name:point.name,tx,ty,rawX:sample.rawX,rawY:sample.rawY,predX:p.x,predY:p.y,dx,dy,error,point};
    showAccuracyPrediction(p.x,p.y,ok);

    if(ok){
      goodStreak++;
      t.style.borderColor='#22c55e';t.style.background='#f0fdf4';
      $('#calStatus').textContent=`${point.name}：${Math.round(error)}px　${goodStreak}/2`;
      $('#calhint').textContent=goodStreak>=2?'合ったよ！':'そのまま、もう少し見てね';
      if(goodStreak>=2){
        t.classList.remove('recording');t.classList.add('good');t.querySelector('span:last-child').textContent='✓';
        await sleep(420);
        return {...lastResult,passed:true};
      }
      await sleep(150);
      continue;
    }

    goodStreak=0;
    t.style.borderColor='#ef4444';t.style.background='#fff1f2';
    t.querySelector('span:last-child').textContent='×';
    $('#calStatus').textContent=`× ${point.name}が ${Math.round(error)}px ずれています`;
    $('#calhint').textContent='次へは進みません。この場所で自動調整します';

    if(refineCount>=3){
      await sleep(700);
      return {...lastResult,passed:false,blocked:true};
    }
    refineCount++;
    await refineCurrentPoint(sample,tx,ty);
    t.querySelector('span:last-child').textContent=point.icon;
    t.style.borderColor='#bfdbfe';t.style.background='#fff';
    $('#calStatus').textContent=`再調整 ${refineCount}/3　同じ場所を見てね`;
    $('#calhint').textContent='目標と赤い点が重なるまで、ここで待ちます';
    await sleep(400);
  }
  return lastResult;
}
async function accuracyTestOnce(){
  const results=[];
  for(let i=0;i<ACCURACY_TEST_POINTS.length&&cameraMode;i++){
    const r=await measureAccuracyPoint(ACCURACY_TEST_POINTS[i],i,ACCURACY_TEST_POINTS.length);
    if(r)results.push(r);
    if(r?.blocked)break;
  }
  removeTestTarget();
  return results;
}
function resultSummary(results){
  const {excellent,pass}=accuracyThresholds();
  return results.map(r=>{
    if(!Number.isFinite(r.error))return `⚪${r.name}:測定不可`;
    const mark=r.error<=excellent?'🟢':r.error<=pass?'🟡':'🔴';
    return `${mark}${r.name}:${Math.round(r.error)}px`;
  }).join('　');
}
async function finishAccuracyTest(results){
  const g=gradeAccuracy(results);
  accuracyResult={at:Date.now(),results:results.map(r=>({name:r.name,error:Number.isFinite(r.error)?Math.round(r.error):null,dx:Math.round(r.dx||0),dy:Math.round(r.dy||0),blocked:!!r.blocked}))};
  save('pecsEyeAccuracy',accuracyResult);updateAccuracyText();
  $('#instruction').textContent=`${g.emoji} 精度テスト：${g.grade}`;
  $('#calStatus').textContent=resultSummary(results);
  if(results.some(r=>r.blocked)){
    $('#calhint').textContent='この点は合わなかったため、ここでテストを停止しました。「みつめて再調整」をしてください';
  }else{
    $('#calhint').textContent=Number.isFinite(g.avg)?`平均 ${g.avg}px ／ 最大 ${g.max}px`:'顔の位置を確認して再調整してください';
  }
  await sleep(results.some(r=>r.blocked)?2200:1500);
  calibrating=false;calCollecting=false;resetFilter();removeTestTarget();
  $('#cal').classList.remove('on');applyPreview(false);$('#cursor').classList.add('on');$('#dot').className='dot on';
  $('#status').textContent=results.some(r=>r.blocked)?'精度テスト停止：みつめて再調整してください':`精度テスト：${g.grade}${Number.isFinite(g.avg)?`（平均${g.avg}px）`:''}`;
}
async function runAccuracyTest(){
  if(accuracyTesting||!cameraMode)return;
  accuracyTesting=true;calibrating=true;calCollecting=false;resetFilter();
  $('#settings').classList.remove('open');$('#cursor').classList.remove('on');$('#cal').classList.add('on');applyPreview(true);$('#error').textContent='';
  $('#instruction').textContent='3点精度テスト';$('#calStatus').textContent='上・中央・下を確認します';$('#calhint').textContent='合うまで次へ進まないよ';
  await sleep(500);
  const results=await accuracyTestOnce();
  if(cameraMode)await finishAccuracyTest(results);
  calCollecting=false;accuracyTesting=false;removeTestTarget();
}

// After the normal 9-point calibration, automatically run the independent 3-point test.
const baseRunGazeGame=runGazeGame;
runGazeGame=async function(){
  await baseRunGazeGame();
  if(cameraMode&&correction.valid)await runAccuracyTest();
};

// Add a standalone accuracy-test button to teacher settings.
(function addAccuracyButton(){
  const actions=document.querySelector('#settings .actions');
  if(actions&&!document.getElementById('accuracyBtn')){
    const b=document.createElement('button');b.id='accuracyBtn';b.className='secondary';b.textContent='🎯 精度テスト';
    b.onclick=()=>{if(cameraMode)runAccuracyTest();else{$('#settings').classList.remove('open');$('#status').textContent='先に「カメラ視線を始める」を押してください'}};
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
