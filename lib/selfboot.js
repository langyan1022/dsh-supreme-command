/**
 * 客户端自举脚本模板（DSH Desktop 专用）。
 *
 * 背景：桌面主窗口的 `dsh-app://app/index.html` 是从打包后的 dist 静态文件直接读的，
 * 只额外塞一个 `__DSH_BOOT_READY__`，**不走 webServer 的 index render** —— 所以
 * `webServer.tapIndex` 的注入在桌面端永远不会出现在页面里。但 `dsh-app://app/*` 的
 * 其它路径会带 cookie 转发到 Host，因此 `/dsh-command/*` 全部可用。
 *
 * 于是把"注入"做成一个路由 `/dsh-command/selfboot.js`：客户端半侧发现页面没有 Host
 * 注入时加载它，由它在浏览器里做与 tapIndex 完全相同的事（主题属性、变量、样式、
 * 装饰层、启动屏根节点、跳过判定、10 秒兜底）。Web 模式已有 Host 注入，客户端直接跳过。
 *
 * 本模块只做字符串拼装，不 import 任何运行时代码，避免与 lib/index.js 形成循环依赖。
 */

/**
 * @param {object} p
 * @param {boolean} p.enabled          主题总开关（决定要不要立刻挂 html 属性）
 * @param {string}  p.route            '/dsh-command'
 * @param {string}  p.rootId           启动屏根节点 id
 * @param {string}  p.htmlAttr         html 上的主题属性名
 * @param {string}  p.markersJson      JSON：其它启动屏插件的全局标记列表
 * @param {string}  p.decoHtmlJson     JSON：装饰层 HTML（没有就是 ""）
 * @param {string}  p.varsJson         JSON：主题变量 CSS 文本
 * @param {string}  p.criticalJson     JSON：critical CSS 文本
 * @param {string}  p.gateJson         JSON：{ splashEnabled, mode } 跳过判定用
 * @param {string}  p.splashJson       JSON：完整启动屏配置（splash.js 读 __DSC_SPLASH_CONFIG__）
 * @param {string}  p.centerCode       内容区测量脚本源码（算水印居中偏移）
 */
export function renderSelfBoot(p) {
  return `(function(){try{
  if(window.__DSC_SELFBOOT_DONE__)return;
  window.__DSC_SELFBOOT_DONE__=true;
  var html=document.documentElement;
  if(html.getAttribute(${JSON.stringify(p.htmlAttr)})==='on')return;
  if(!document.head)return;
  var R=${JSON.stringify(p.route)};
  var ROOT=${JSON.stringify(p.rootId)};
  if(${p.enabled ? 'true' : 'false'})html.setAttribute(${JSON.stringify(p.htmlAttr)},'on');
  function node(tag,attrs,text){var n=document.createElement(tag);if(attrs){for(var k in attrs){if(attrs[k]!=null)n.setAttribute(k,attrs[k]);}}if(text!=null)n.textContent=text;return n;}
  var head=document.head;
  head.appendChild(node('link',{rel:'stylesheet',href:R+'/theme.css'}));
  head.appendChild(node('style',{id:'dsh-command-vars'},${p.varsJson}));
  head.appendChild(node('style',{id:'dsh-command-critical'},${p.criticalJson}));
  var decoHtml=${p.decoHtmlJson};
  function addDeco(){
    try{
      if(!decoHtml||document.getElementById('dsh-command-deco'))return;
      var wrap=document.createElement('div');
      wrap.innerHTML=decoHtml;
      var first=wrap.firstChild;
      if(first)(document.body||html).insertBefore(first,(document.body||html).firstChild);
    }catch(e){}
  }
  if(document.body)addDeco();else document.addEventListener('DOMContentLoaded',addDeco,{once:true});

  /* 启动屏：和 Host 的 bootstrap 完全同一套跳过判定 */
  var sc=${p.gateJson};
  var skip=sc.splashEnabled===false;
  try{
    if(!skip&&sc.mode==='session'&&sessionStorage.getItem('dsc:splash')==='1')skip=true;
    if(!skip&&sc.mode==='daily'&&localStorage.getItem('dsc:day')===new Date().toISOString().slice(0,10))skip=true;
  }catch(e){}
  try{
    var others=${p.markersJson};
    for(var i=0;i<others.length;i++){if(window[others[i]]){skip=true;break;}}
  }catch(e){}
  if(skip){window.__DSC_SKIP__=true;return;}

  var SPLASH=${p.splashJson};
  head.appendChild(node('link',{rel:'stylesheet',href:R+'/splash.css'}));
  html.classList.add('dsc-lock');
  function clearRoot(){try{
    var r=document.getElementById(ROOT);if(r&&r.parentNode)r.parentNode.removeChild(r);
    html.classList.remove('dsc-lock');
    if(document.body)document.body.style.overflow='';
  }catch(e){}}
  setTimeout(function(){try{
    if(window.__DSC_RUNNING__===true)return;
    clearRoot();window.__DSC_FAILED__=true;
  }catch(e){}},10000);
  function mount(){
    try{
      if(document.getElementById(ROOT))return;
      var holder=document.createElement('div');
      holder.innerHTML='<div id="'+ROOT+'" class="dsc-splash dsc-splash--boot" role="presentation" aria-hidden="true"></div>';
      var first=holder.firstChild;
      (document.body||html).insertBefore(first,(document.body||html).firstChild);
      (document.body||html).appendChild(node('script',null,'window.__DSC_SPLASH_CONFIG__='+JSON.stringify(SPLASH)+';'));
      var run=node('script',{defer:'defer',src:R+'/splash.js'});
      run.onerror=function(){window.__DSC_FAILED__=true;clearRoot();};
      (document.body||html).appendChild(run);
    }catch(e){clearRoot();}
  }
  if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount,{once:true});
  ${p.centerCode || ''}
}catch(e){}})()`
}
