// Use simple ○ / × confirmation symbols instead of text labels.
(function(){
  const yes=document.getElementById('yesBtn');
  const no=document.getElementById('noBtn');
  if(yes)yes.innerHTML='○<div id="yesProgress" class="yesprogress"></div><div class="dwell"></div>';
  if(no)no.innerHTML='×<div class="dwell"></div>';
  const baseOpenConfirm=openConfirm;
  openConfirm=function(choice,source){
    baseOpenConfirm(choice,source);
    const label=document.getElementById('countdown');
    if(!label)return;
    const convert=()=>{
      const t=label.textContent||'';
      const n=t.replace(/「はい」/g,'「○」').replace(/「いいえ」/g,'「×」').replace(/はい/g,'○').replace(/いいえ/g,'×');
      if(n!==t)label.textContent=n;
    };
    convert();
    const observer=new MutationObserver(convert);
    observer.observe(label,{childList:true,characterData:true,subtree:true});
    setTimeout(()=>observer.disconnect(),Math.max(5000,confirmMs+2500));
  };
})();
