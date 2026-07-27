(function(){
  'use strict';
  try{
    bootstrapApp();
    window.TravelV2?.afterBootstrap?.();
    setTimeout(()=>loadTripWeather(false).catch(()=>{}),0);
  }catch(error){
    console.error('v2 startup failed',error);
    const box=document.getElementById('auditBox');
    if(box){box.className='alert warn';box.innerHTML='<b>页面初始化失败：</b>'+escapeHtml(error?.message||String(error))}
  }
})();