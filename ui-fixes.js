// Post-load fixes for gaze actions and learning-level sequencing.
renderToolbar=function(){
  const item=!!itemInSentence(),ending=!!endingInSentence(),prefix=!!prefixInSentence();
  let html='';
  if(learningLevel>=3)html+=`<button class="tool gazeable teacher-call" data-action="callTeacher">👩‍🏫 せんせいを よぶ<div class="dwell"></div></button>`;
  if(learningLevel===2||learningLevel===3)html+=`<span class="fixed-chip">🙏 「ください」は固定</span>`;
  if(learningLevel===4){
    for(const [k,e] of Object.entries(ENDINGS))html+=`<button class="tool gazeable ending-tool ${ending?'locked':''}" data-ending="${k}" ${!item||ending?'disabled':''}>${e.emoji} ${e.label}<div class="dwell"></div></button>`;
  }
  if(learningLevel===5){
    html+=`<button class="tool gazeable ${prefix?'locked':''}" data-fixed="starter" ${prefix?'disabled':''}>🙋 わたしは<div class="dwell"></div></button>`;
    for(const [k,e] of Object.entries(ENDINGS))html+=`<button class="tool gazeable ending-tool ${ending?'locked':''}" data-ending="${k}" ${!prefix||!item||ending?'disabled':''}>${e.emoji} ${e.label}<div class="dwell"></div></button>`;
  }
  html+=`<button class="tool gazeable" data-action="undo">↩ 1つもどす<div class="dwell"></div></button>`;
  $('#toolbar').innerHTML=html;
  $$('#toolbar [data-ending]').forEach(b=>b.onclick=e=>requestEnding(e.currentTarget.dataset.ending,e.currentTarget));
  $$('#toolbar [data-fixed]').forEach(b=>b.onclick=e=>requestFixed(e.currentTarget.dataset.fixed,e.currentTarget));
  $$('#toolbar [data-action]').forEach(b=>b.onclick=e=>runAction(e.currentTarget.dataset.action,e.currentTarget));
  bindPointer();
};
render=function(){
  document.documentElement.style.setProperty('--card',cardSize+'px');
  $('#levelBadge').textContent=levelStatus();
  const hasItem=!!itemInSentence(),needsPrefix=learningLevel===5&&!prefixInSentence();
  $('#tabs').innerHTML=cats.map(c=>`<button class="tab gazeable ${c===category?'active':''}" data-cat="${c}">${c}<div class="dwell"></div></button>`).join('');
  $$('.tab').forEach(b=>b.onclick=()=>{category=b.dataset.cat;save('pecsEyeCat',category);lockAction(b);render()});
  $('#grid').innerHTML=CARDS.filter(c=>c.category===category).map(c=>{
    const locked=hasItem||needsPrefix||isLocked(c.key);
    return `<button class="card gazeable ${locked?'locked':''}" data-id="${c.id}" ${locked?'disabled':''}><div class="emoji">${c.emoji}</div><div class="label">${c.label}</div><div class="dwell"></div></button>`;
  }).join('');
  $$('.card').forEach(b=>b.onclick=()=>requestCard(b.dataset.id,b));
  renderToolbar();bindPointer();renderSentence();
};
renderSentence=function(){
  const b=$('#sentence');
  b.innerHTML=sentence.length?sentence.map((x,i)=>x.fixed?`<span class="sentence-card" aria-label="固定：${x.label}">${x.emoji||''} ${x.label} 🔒</span>`:`<button class="sentence-card removable" data-i="${i}" title="タッチで外す">${x.emoji||''} ${x.label}</button>`).join(''):'<span style="color:#98a2b3;font-size:22px;font-weight:800">カードを えらんでね</span>';
  $$('.sentence-card.removable').forEach(b=>b.onclick=()=>{
    const i=+b.dataset.i,item=sentence[i];
    if((learningLevel===2||learningLevel===3)&&item?.kind==='item')sentence=[];else sentence.splice(i,1);
    render();$('#status').textContent='ことばから外しました';
  });
};
requestCard=function(id,source){
  const c=CARDS.find(x=>x.id===id);if(!c||itemInSentence())return;
  if(learningLevel===5&&!prefixInSentence()){$('#status').textContent='まず「わたしは」を選んでね';return}
  openConfirm({...c,kind:'item'},source);
};
requestEnding=function(name,source){
  const c=ENDINGS[name];if(!c||endingInSentence())return;
  if(learningLevel===5&&!prefixInSentence()){$('#status').textContent='まず「わたしは」を選んでね';return}
  if(!itemInSentence()){$('#status').textContent='まず絵カードを選んでね';return}
  openConfirm(c,source);
};
runAction=function(action,source){
  if(action==='undo'){sentence.pop();render();$('#status').textContent='1つもどしました';lockAction(source)}
  else if(action==='callTeacher')callTeacher(source);
  else if(action==='speak'){lockAction(source);speak();$('#status').textContent='できたことばを伝えました'}
  else if(action==='clear'){sentence=[];render();$('#status').textContent='ことばを全部消しました';lockAction(source)}
};
render();
