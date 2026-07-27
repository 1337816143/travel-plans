(function(){
  'use strict';
  const prefs=window.TravelPreferences;
  const layers=window.TravelFloatingLayers;
  const mobile=()=>matchMedia('(max-width:800px)').matches;
  let drawer,content,title,overviewButton,currentDay=null,state='collapsed',startY=0,dragging=false;
  let cardAnchor=null,legendAnchor=null;

  function ensure(){
    if(drawer)return drawer;
    const wrap=document.querySelector('.map-wrap'),card=document.getElementById('dayRouteCard'),legend=document.getElementById('legend');
    if(!wrap||!card||!legend)return null;
    cardAnchor=document.createComment('day-route-card-anchor');legendAnchor=document.createComment('route-overview-anchor');
    card.parentNode.insertBefore(cardAnchor,card);legend.parentNode.insertBefore(legendAnchor,legend);
    drawer=document.createElement('section');drawer.id='mobileRouteDrawer';drawer.className='mobile-route-drawer';drawer.dataset.state='collapsed';drawer.dataset.mode='overview';drawer.setAttribute('aria-label','路线与天气抽屉');
    drawer.innerHTML='<div class="mobile-drawer-grip" role="button" tabindex="0" aria-label="拖动或点击调整抽屉高度"></div><header class="mobile-drawer-bar"><strong id="mobileDrawerTitle">每日路线总览</strong><div class="mobile-drawer-actions"><button type="button" data-drawer-action="overview" hidden>总览</button><button type="button" data-drawer-state="half">半屏</button><button type="button" data-drawer-state="full">全屏</button><button type="button" data-drawer-state="collapsed">收起</button></div></header><div class="mobile-drawer-content"></div>';
    wrap.appendChild(drawer);content=drawer.querySelector('.mobile-drawer-content');title=drawer.querySelector('#mobileDrawerTitle');overviewButton=drawer.querySelector('[data-drawer-action="overview"]');
    drawer.addEventListener('click',event=>{const stateButton=event.target.closest('[data-drawer-state]');if(stateButton)setState(stateButton.dataset.drawerState);const action=event.target.closest('[data-drawer-action]');if(action?.dataset.drawerAction==='overview'){setDayRouteCard(null);setState('half')}});
    const grip=drawer.querySelector('.mobile-drawer-grip'),bar=drawer.querySelector('.mobile-drawer-bar');
    const begin=event=>{if(event.target.closest('button'))return;dragging=true;startY=event.clientY;drawer.setPointerCapture?.(event.pointerId)};
    const end=event=>{if(!dragging)return;dragging=false;const delta=event.clientY-startY;if(delta>70)setState(state==='full'?'half':'collapsed');else if(delta<-70)setState(state==='collapsed'?'half':'full')};
    [grip,bar].forEach(node=>{node.addEventListener('pointerdown',begin);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',()=>{dragging=false})});
    grip.addEventListener('keydown',event=>{if(event.key==='ArrowUp'){setState(state==='collapsed'?'half':'full');event.preventDefault()}if(event.key==='ArrowDown'){setState(state==='full'?'half':'collapsed');event.preventDefault()}});
    return drawer;
  }

  function restore(node,anchor){if(anchor?.parentNode&&node.parentNode!==anchor.parentNode)anchor.parentNode.insertBefore(node,anchor.nextSibling)}
  function moveForViewport(){
    const root=ensure();if(!root)return;
    const card=document.getElementById('dayRouteCard'),legend=document.getElementById('legend');
    if(mobile()){
      if(card.parentNode!==content)content.appendChild(card);
      if(legend.parentNode!==content)content.appendChild(legend);
      root.hidden=false;syncMode();
    }else{
      restore(card,cardAnchor);restore(legend,legendAnchor);root.hidden=true;layers?.set('drawer',false,{desktop:true});
    }
  }

  function validState(value){return['collapsed','half','full'].includes(value)?value:'collapsed'}
  function setState(next,persist=true){
    state=validState(next);if(drawer)drawer.dataset.state=state;
    if(persist)prefs?.set('route-drawer-state',state);
    layers?.set('drawer',state!=='collapsed',{state});
    document.querySelectorAll('[data-drawer-state]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.drawerState===state)));
    return state;
  }

  function syncMode(){
    if(!drawer)return;
    const dayMode=Boolean(currentDay&&document.getElementById('dayRouteCard')?.classList.contains('show'));
    drawer.dataset.mode=dayMode?'day':'overview';overviewButton.hidden=!dayMode;
    if(dayMode){
      const text=document.querySelector('#dayRouteCard .day-route-title')?.textContent?.trim()||`${currentDay.date||''} 行程路线`;
      title.textContent=text;
    }else title.textContent='每日路线总览';
  }

  const originalSetDayRouteCard=setDayRouteCard;
  setDayRouteCard=function(day){
    const result=originalSetDayRouteCard(day);currentDay=day||null;ensure();moveForViewport();syncMode();
    if(mobile())setState(day?'half':'collapsed');
    return result;
  };

  const originalRenderLegend=renderLegend;
  renderLegend=function(date){const result=originalRenderLegend(date);ensure();moveForViewport();syncMode();return result};

  const originalToggleAmapServicePanel=toggleAmapServicePanel;
  toggleAmapServicePanel=function(force){const result=originalToggleAmapServicePanel(force);const open=Boolean(document.getElementById('amapServicePanel')&&!document.getElementById('amapServicePanel').hidden);layers?.set('assistant',open);return result};

  const originalSetPanelCollapsed=setPanelCollapsed;
  setPanelCollapsed=function(collapsed){const result=originalSetPanelCollapsed(collapsed);layers?.set('panel',mobile()&&!collapsed);return result};

  const originalShowMapNotice=showMapNotice;
  showMapNotice=function(text){const result=originalShowMapNotice(text);layers?.set('notice',true);return result};

  const previousAfterBootstrap=window.TravelV2?.afterBootstrap;
  if(window.TravelV2)window.TravelV2.afterBootstrap=function(){
    previousAfterBootstrap?.();
    document.getElementById('mapEngineBadge')?.remove();
    ensure();state=validState(prefs?.get('route-drawer-state','collapsed'));moveForViewport();setState(state,false);syncMode();layers?.sync();
    window.addEventListener('resize',moveForViewport,{passive:true});window.visualViewport?.addEventListener('resize',moveForViewport,{passive:true});
    const notice=document.getElementById('mapNotice');if(notice)new MutationObserver(()=>layers?.set('notice',notice.classList.contains('show'))).observe(notice,{attributes:true,attributeFilter:['class']});
  };

  window.TravelRouteDrawer={setState,get state(){return state},moveForViewport,syncMode};
})();