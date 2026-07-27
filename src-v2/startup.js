(function(){
  function reportStartupError(message){
    setTimeout(function(){
      var box=document.getElementById('auditBox');
      if(!box)return;
      box.className='alert warn';
      box.innerHTML='<b>页面初始化失败：</b>'+String(message||'未知错误')+'。请刷新页面；若仍失败，请反馈浏览器与网络环境。';
    },0);
  }
  window.addEventListener('error',function(e){
    if(e&&e.message)reportStartupError(e.message);
  });
  window.addEventListener('unhandledrejection',function(e){
    reportStartupError(e&&e.reason?e.reason:'异步初始化失败');
  });
})();
