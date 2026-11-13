/**
 * 内容区测量脚本（内联注入）。
 *
 * 目的：中央那层 UEG 半模糊水印要**压在内容区（聊天区）的中央**，而不是整个窗口的中央——
 * 左边有导航栏，按整窗居中会明显偏左，糊在会话列表上。
 *
 * 测量策略（按可靠性排序）：
 *   1) `main` / `[role=main]` 的几何中心（最直接）；
 *   2) 左边栏宽度：贴左（left≈0）、占满高度、宽度在 40px–45% 视口之间的最宽元素，
 *      内容区中心 = 左边栏宽度 / 2（水印右移半个导航栏宽）；
 *   3) 都没有就退回 134px（268px 导航栏的一半）。
 *
 * 结果写进 `--dsc-content-shift` / `--dsc-content-w`；应用异步渲染，所以有定时重试、
 * MutationObserver 与 resize 监听。纯测量，不改 DOM 结构。
 */
export const CENTER_JS = `(function(){try{
  if(window.__DSC_CENTER__)return;
  window.__DSC_CENTER__=true;
  var root=document.documentElement;

  function measure(){
    var vw=window.innerWidth||root.clientWidth||1280;
    var vh=window.innerHeight||root.clientHeight||800;
    var shift=null,cw=null;

    /* 1) main 的中心 */
    var main=document.querySelector('main,[role="main"]');
    if(main){
      var r=main.getBoundingClientRect();
      if(r.left>=40&&r.width>vw*0.3&&r.height>vh*0.4){
        shift=r.left+r.width/2-vw/2;
        cw=r.width;
      }
    }

    /* 2) 左边栏宽度（贴左、够高、窄） */
    if(shift===null&&document.body){
      var all=document.body.querySelectorAll('aside,nav,div,section');
      var limit=Math.min(all.length,2000);
      var best=0;
      for(var i=0;i<limit;i++){
        var rr=all[i].getBoundingClientRect();
        if(rr.left>-2&&rr.left<6&&rr.height>vh*0.72&&rr.width>40&&rr.width<vw*0.45&&rr.width>best)best=rr.width;
      }
      if(best>0){shift=best/2;cw=vw-best;}
    }

    /* 3) 兜底：按默认 268px 导航栏 */
    if(shift===null){shift=134;cw=vw-268;}

    shift=Math.round(shift);
    root.style.setProperty('--dsc-content-shift',shift+'px');
    root.style.setProperty('--dsc-content-w',Math.round(cw)+'px');
    return true;
  }

  var tries=0;
  function retry(){
    try{measure()}catch(e){}
    if(tries++<40)setTimeout(retry,250);
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){retry()},{once:true});
  }else{
    retry();
  }
  try{window.addEventListener('resize',function(){try{measure()}catch(e){}},{passive:true})}catch(e){}
  try{
    var pending=0;
    var mo=new MutationObserver(function(){
      if(pending)return;
      pending=setTimeout(function(){pending=0;try{measure()}catch(e){}},400);
    });
    if(document.documentElement)mo.observe(document.documentElement,{childList:true,subtree:true});
  }catch(e){}
}catch(e){}})()`
