import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useFlow } from './FlowContext'
import { useSharedDelivery } from './SharedDelivery'
import { FOOD_CHOICES, PICKUP_AREAS, areaName, formatWindow, money, useMenuDiscovery, type MenuStore, type StoreDraft } from './MenuDiscoveryContext'
import { CAMPUS_STORES } from './campus'
import type { Screen } from './WorkflowScreens'
import type { MatchLocation } from './matchingLocation'
import { distanceM, useDeliveryLifecycle } from './DeliveryLifecycle'
import type { MapPin } from './LocationMap'
import FoodPhoto from './FoodPhoto'
import { ButtonHint, SaveFeedback, relativeDateTime, useSaveFeedback } from './uiFeedback'
const BrowseMap=lazy(()=>import('./LocationMap'))
const MatchLocationPicker=lazy(()=>import('./MatchLocationPicker'))

export function SmallIcon({name}:{name:'home'|'people'|'chat'|'profile'|'bell'|'pin'|'back'|'close'|'clock'|'plus'}){
  const paths={home:'m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87',chat:'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z',profile:'M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',back:'m15 18-6-6 6-6',close:'m6 6 12 12M6 18 18 6',clock:'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',plus:'M12 5v14M5 12h14'}
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/>{name==='people'&&<circle cx="9" cy="7" r="4"/>}</svg>
}
const foodName=(key:string)=>FOOD_CHOICES.find(f=>f.id===key)?.name??key
function StorePhoto({store}:{store:MenuStore}){
  const s=CAMPUS_STORES.find(v=>v.name===store.store_name), f=FOOD_CHOICES.find(v=>v.id===store.menu_key)
  return <FoodPhoto key={s?.imageId??f?.photo} symbol={s?.emoji??(store.menu_key==='coffee'?'☕':store.menu_key==='burger'?'🍔':'🥪')} src={`https://images.unsplash.com/photo-${s?.imageId??f?.photo}?auto=format&fit=crop&w=220&q=80`}/>
}

export function LocationChoice(){
  const d=useMenuDiscovery(),{currentLocation}=useFlow()
  const [open,setOpen]=useState(false)
  const [pickMap,setPickMap]=useState(false),[point,setPoint]=useState<MatchLocation|null>(null)
  return <>
    <button className="baef-location" onClick={()=>setOpen(true)} aria-label="수령 지역 설정"><SmallIcon name="pin"/><span>{areaName(d.area)}</span><span aria-hidden="true">⌄</span></button>
    {open&&<div className="baef-overlay" role="dialog" aria-modal="true" aria-labelledby="pickup-title" onKeyDown={e=>{if(e.key==='Escape')setOpen(false)}}><section className="baef-sheet baef-small-sheet"><div className="baef-sheet-title"><h2 id="pickup-title">어디에서 받을까요?</h2><button className="baef-icon-button" aria-label="수령 지역 닫기" onClick={()=>setOpen(false)}><SmallIcon name="close"/></button></div>
      <p className="baef-muted">수령 지역이 달라도, 각자 400m 이내에서 만날 수 있는 배프를 찾아요.</p>
      {PICKUP_AREAS.map(a=><button key={a.id} className={`baef-area-option ${a.id===d.area?'selected':''}`} onClick={()=>{d.setArea(a.id);setOpen(false)}}><span><b>{a.name}</b><small>{a.detail}</small></span><span>{a.id===d.area?'✓':'›'}</span></button>)}
      <p className="baef-muted">지역은 희망 수령 장소예요. 매칭은 아래의 내 출발 위치를 기준으로 해요.<br/>거리 기준은 직선거리이며, 실제 걷는 경로와 수령 장소는 함께 확인해 주세요.</p>
      <button disabled={currentLocation.loading} className="baef-button secondary" onClick={()=>{d.setMatchLocation(null);setPickMap(false);currentLocation.request()}}><SmallIcon name="pin"/>{currentLocation.loading?'현재 위치 확인 중…':'현재 위치 사용'}</button>
      <button className="baef-button secondary" onClick={()=>{setPoint(d.matchLocation);setPickMap(v=>!v)}}>지도에서 내 출발 위치 지정</button>
      {pickMap&&<><p className="baef-muted">지도에서 내가 출발할 곳을 눌러 주세요.</p><Suspense fallback={<p className="baef-muted">지도 불러오는 중…</p>}><MatchLocationPicker point={point} onChange={setPoint}/></Suspense><button className="baef-button" disabled={!point} onClick={()=>{d.setMatchLocation(point);setPickMap(false)}}>이 위치를 출발점으로 사용</button></>}
      {d.manualLocation&&<p className="baef-muted">지도에 지정한 출발 위치를 사용 중이에요.</p>}
      {currentLocation.coordinates&&<p className="baef-muted">현재 위치 · {currentLocation.coordinates.lat.toFixed(4)}, {currentLocation.coordinates.lng.toFixed(4)}<br/>정확도 약 {Math.ceil(currentLocation.coordinates.accuracy)}m · 출발 위치를 기준으로 매칭해요.</p>}
      {currentLocation.error&&<p role="alert" className="baef-error">{currentLocation.error}</p>}
    </section></div>}
  </>
}

function StoreRows({onSelect,browse=false}:{onSelect:(store:MenuStore)=>void;browse?:boolean}){
  const d=useMenuDiscovery(),s=useSharedDelivery()
  const visible=(browse?d.catalog:d.menus.length?d.candidateStores:d.catalog).filter(c=>!browse||((d.browseCategory==='all'||c.menu_key===d.browseCategory)&&`${c.store_name} ${foodName(c.menu_key)} ${c.menus.map(m=>m.name).join(' ')}`.toLowerCase().includes(d.search.trim().toLowerCase())))
  return <div className="baef-store-list">{visible.map(store=>{
    const count=d.visibleMatches.find(m=>m.store_name===store.store_name)?.people_count??0
    const groups=s.posts.filter(p=>p.restaurant===store.store_name&&p.status==='recruiting')
    return <button className="baef-store-row" key={store.store_name} onClick={()=>onSelect(store)}><div className="baef-store-photo"><StorePhoto store={store}/></div><div className="baef-store-info"><div className="baef-store-kicker">{foodName(store.menu_key)}{groups.length>0&&<span className="baef-state-dot">모집 중</span>}</div><h3>{store.store_name}</h3><p>{store.menus.slice(0,2).map(m=>m.name).join(' · ')}</p><div className="baef-store-foot">{Number(count)>0?<span className="baef-match-count">조건이 겹치는 {count}명</span>:<span>메뉴 {store.menus.length}개</span>}<span>목표 {money(store.goal_amount)}</span></div></div><span className="baef-row-arrow">›</span></button>
  })}{!visible.length&&<div className="baef-empty"><h3>검색 결과가 없어요</h3>{browse&&<button className="baef-button secondary" onClick={()=>{d.setSearch('');d.setBrowseCategory('all')}}>검색 조건 지우기</button>}</div>}</div>
}

export function MenuHome({push}:{push:(s:Screen)=>void}){
  const d=useMenuDiscovery(),s=useSharedDelivery()
  const [store,setStore]=useState<MenuStore|null>(null)
  const findReason=s.active?'진행 중인 주문을 먼저 확인해 주세요.':!d.menus.length?'먹고 싶은 메뉴를 하나 이상 골라주세요.':!d.stores.length?'가능한 가게를 한 곳 이상 골라주세요.':''
  const heading=d.day===1?'내일은,':new Date().getHours()>=16?'오늘 저녁,':'오늘은,'
  return <div className="baef-scroll"><div className="baef-page">
    <LocationChoice/>
    <section className="baef-question"><span className="baef-eyebrow">한 잔도, 한 끼도 함께</span><h1>{heading}<br/>뭐 먹을까요?</h1><p>먹고 싶은 메뉴가 겹치면 알려드릴게요.</p></section>
    {s.active&&s.tx&&<button className="baef-progress" onClick={()=>{s.selectPost(s.tx!.post.id);push(s.tx!.application==='pending'?'detail':s.tx!.role==='leader'?'applicants':'chat')}}><span className="baef-progress-icon"><SmallIcon name="people"/></span><span><small>{s.tx.application==='pending'?'신청 수락을 기다리고 있어요':'진행 중인 함께 주문'}</small><b>{s.tx.post.restaurant}</b></span><span>›</span></button>}
    <div className="baef-section-title"><h2>먹고 싶은 메뉴</h2><span>여러 개 골라도 좋아요</span></div>
    <div className="baef-food-options">{FOOD_CHOICES.map(f=><button key={f.id} className={`baef-food-option ${d.menus.includes(f.id)?'selected':''}`} aria-pressed={d.menus.includes(f.id)} onClick={()=>d.toggleMenu(f.id)}><span className="baef-food-image"><FoodPhoto symbol={f.id==='coffee'?'☕':f.id==='burger'?'🍔':'🥪'} src={`https://images.unsplash.com/photo-${f.photo}?auto=format&fit=crop&w=250&q=85`}/>{d.menus.includes(f.id)&&<span className="baef-check">✓</span>}</span><b>{f.name}</b></button>)}</div>
    <section className="baef-time"><div className="baef-section-title"><h2>언제 먹을까요?</h2></div><div className="baef-time-inputs"><label><span>날짜</span><select value={d.day} onChange={e=>d.setDay(Number(e.target.value))}><option value={0}>오늘</option><option value={1}>내일</option></select></label><label><span>시간</span><select aria-label="희망 수령 시간" value={d.hour} onChange={e=>d.setHour(Number(e.target.value))}>{Array.from({length:12},(_,i)=>i+11).map(h=><option key={h} value={h} disabled={d.day===0&&h+1<=new Date().getHours()}>{h}:00–{h+1}:00</option>)}</select></label></div></section>
    {!!d.candidateStores.length&&<details className="baef-store-preferences"><summary>가능한 가게 {d.stores.length}곳 <span>변경</span></summary><p className="baef-muted">주문해도 괜찮은 가게를 남겨주세요.</p>{d.candidateStores.map(c=><label key={c.store_name}><input type="checkbox" checked={d.stores.includes(c.store_name)} onChange={()=>d.toggleStore(c.store_name)}/><span>{c.store_name}</span></label>)}</details>}
    <button className="baef-button" aria-describedby={findReason?'find-reason':undefined} disabled={d.saving||!!findReason} onClick={()=>void d.save()}>{d.saving?'선택 저장 중…':s.active?'진행 중인 주문이 있어요':'이 메뉴로 배프 찾기'}<span aria-hidden="true">→</span></button><ButtonHint id="find-reason" reason={findReason}/>
    {d.intent&&<div className="baef-saved-intent"><span className="baef-pulse"/><div><b>{d.intent.menus.map(foodName).join(' · ')} 기다리는 중</b><p>{formatWindow(d.intent.starts_at,d.intent.ends_at)} · {areaName(d.intent.area_id)}</p></div><button aria-label="메뉴 기다리기 취소" onClick={()=>void d.cancel()}>취소</button></div>}
    {d.intent&&d.intent.latitude==null&&<p className="baef-muted">거리 기준으로 배프를 찾으려면 출발 위치를 정한 뒤 선택을 다시 저장해 주세요.</p>}
    {d.error&&<p role="alert" className="baef-error">{d.error}</p>}
    <div className="baef-section-title baef-browse-title"><h2>{d.menus.length?'선택한 메뉴가 있는 가게':'한 잔, 한 끼를 함께할 가게'}</h2><button onClick={()=>push('list')}>모두 보기</button></div>
    <StoreRows onSelect={setStore}/>
    {store&&<StoreSheet store={store} close={()=>setStore(null)} push={push}/>}
  </div></div>
}

export function TogetherScreen({push}:{push:(s:Screen)=>void}){
  const d=useMenuDiscovery(),s=useSharedDelivery()
  const [store,setStore]=useState<MenuStore|null>(null)
  const scroll=useRef<HTMLDivElement>(null)
  useEffect(()=>{if(scroll.current)scroll.current.scrollTop=d.listScroll.current;return()=>{}},[])
  const search=d.search.trim().toLowerCase()
  const groups=s.posts.filter(p=>p.status==='recruiting'&&d.catalog.some(c=>c.store_name===p.restaurant&&(d.browseCategory==='all'||c.menu_key===d.browseCategory))&&`${p.restaurant} ${p.category} ${p.description} ${p.menus?.map(m=>m.name).join(' ')}`.toLowerCase().includes(search))
  const pointFor=(id:string|undefined)=>{const p=s.rawPosts.find(p=>p.id===id);return p?.pickup_lat!=null&&p.pickup_lng!=null?{lat:p.pickup_lat,lng:p.pickup_lng}:null}
  const distanceFor=(id:string|undefined)=>{const p=pointFor(id);return p&&d.matchLocation?distanceM(p,d.matchLocation):Infinity}
  if(d.sort==='near')groups.sort((a,b)=>distanceFor(a.sharedId)-distanceFor(b.sharedId))
  const pins:MapPin[]=groups.flatMap(p=>{const point=pointFor(p.sharedId);return point?[{id:String(p.id),point:{x:0,y:0},coordinates:point,label:p.restaurant,symbol:p.emoji,kind:'post' as const}]:[]})
  if(d.matchLocation)pins.push({id:'me',point:{x:0,y:0},coordinates:d.matchLocation,label:'내 출발점',symbol:'나',kind:'me'})
  const resetScroll=()=>{d.listScroll.current=0;if(scroll.current)scroll.current.scrollTop=0}
  return <div ref={scroll} onScroll={e=>{d.listScroll.current=e.currentTarget.scrollTop}} className="baef-scroll"><div className="baef-page"><div className="baef-section-title"><h1 className="baef-page-title">함께 주문</h1><button className="baef-text-action" onClick={()=>push('create')}><SmallIcon name="plus"/>직접 모집</button></div><p className="baef-muted">원하는 가게의 모집에 합류하거나 먼저 시작해 보세요.</p>
    <div className="baef-search"><input aria-label="음식점·메뉴 검색" value={d.search} onChange={e=>{d.setSearch(e.target.value);resetScroll()}} placeholder="가게, 음식 종류, 메뉴 검색"/>{d.search&&<button aria-label="검색어 지우기" onClick={()=>{d.setSearch('');resetScroll()}}>×</button>}</div>
    <div className="baef-browse-controls"><select aria-label="음식 카테고리" value={d.browseCategory} onChange={e=>{d.setBrowseCategory(e.target.value);resetScroll()}}><option value="all">전체 메뉴</option>{FOOD_CHOICES.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><select aria-label="모집 정렬" value={d.sort} onChange={e=>{d.setSort(e.target.value as 'recent'|'near');resetScroll()}}><option value="recent">최근 모집순</option><option value="near">수령 장소 가까운 순</option></select></div>
    <div className="baef-tabs"><button className={d.browseTab==='groups'?'active':''} onClick={()=>d.setBrowseTab('groups')}>모집 중{s.session&&s.allowed&&s.ready?` ${groups.length}`:''}</button><button className={d.browseTab==='stores'?'active':''} onClick={()=>d.setBrowseTab('stores')}>가게 찾기</button></div>
    {s.active&&s.tx&&<button className="baef-progress" onClick={()=>{s.selectPost(s.tx!.post.id);push('detail')}}><span><small>내 진행 상황</small><b>{s.tx.post.restaurant}</b></span><span>›</span></button>}
    {d.browseTab==='stores'?<StoreRows browse onSelect={setStore}/>:<><div className="baef-tabs"><button className={d.browseView==='list'?'active':''} onClick={()=>d.setBrowseView('list')}>목록</button><button className={d.browseView==='map'?'active':''} onClick={()=>d.setBrowseView('map')}>지도</button></div>
      {d.browseView==='map'&&<><div className="baef-public-map"><Suspense fallback={<p>지도 불러오는 중…</p>}><BrowseMap pins={pins} title="지도에서 모집글 찾기" onSelect={id=>{if(id==='me')return;s.selectPost(Number(id));push('detail')}}/></Suspense></div><p className="baef-muted">모집자가 공개 수령점을 지정한 모임만 지도에 표시해요. 나머지는 아래 목록에서 볼 수 있어요.</p></>}
      {s.initializing||s.session&&!s.ready?<p className="baef-loading" role="status">불러오는 중…</p>:!s.session?<button className="baef-button secondary" onClick={()=>s.setLoginOpen(true)}>로그인</button>:groups.length?groups.map(p=>{const distance=distanceFor(p.sharedId),nextCount=Math.min(p.maxMembers,p.currentMembers+1),fee=s.rawPosts.find(v=>v.id===p.sharedId)?.delivery_fee??3000;return <button key={p.id} className="baef-group-row" onClick={()=>{s.selectPost(p.id);push('detail')}}><div className="baef-group-head"><span className="baef-tag">{p.category}</span><span>{p.currentMembers}/{p.maxMembers}명</span></div><h2>{p.restaurant}</h2><p>{p.description.split('\n').find(v=>v.includes('수령'))??'수령 장소는 함께 정해요'}</p><p className="baef-savings">균등 분담 시 배달비 약 {money(Math.max(0,fee-Math.ceil(fee/nextCount)))} 절약 예상</p><p className="baef-muted">{Number.isFinite(distance)?`수령점까지 직선 약 ${Math.ceil(distance)}m · 도보 경로 확인 필요`:'공개 수령점 위치 미지정'}</p><div className="baef-group-foot"><b>목표 주문금액 {money(p.minOrderAmount)}</b><span>{p.deadline} 마감</span></div></button>}):<div className="baef-empty">{(search||d.browseCategory!=='all')&&<><h3>검색 결과가 없어요</h3><button className="baef-button secondary" onClick={()=>{d.setSearch('');d.setBrowseCategory('all')}}>검색 조건 지우기</button></>}<button className="baef-button secondary" onClick={()=>push('main')}>메뉴 고르러 가기</button></div>}</>}
    {store&&<StoreSheet store={store} close={()=>setStore(null)} push={push}/>}
  </div></div>
}

export function StoreSheet({store,close,push,targetPostId}:{store:MenuStore;close:()=>void;push:(s:Screen)=>void;targetPostId?:string}){
  const d=useMenuDiscovery(),s=useSharedDelivery()
  const draftKey=`${s.session?.user.id??'guest'}:${store.store_name}:${targetPostId??'new'}`
  const [draft,setDraft]=useState<StoreDraft>(()=>{
    const saved=d.storeDrafts.current.get(draftKey);if(saved)return saved
    const cutoff=new Date();cutoff.setDate(cutoff.getDate()+d.day);cutoff.setHours(d.hour+1,0,0,0)
    return {quantities:{},goal:String(store.goal_amount),maxMembers:2,fee:'3000',meeting:areaName(d.area),note:'',deliveryTime:`${d.hour}:00–${d.hour+1}:00`,deadline:new Date(cutoff.getTime()-cutoff.getTimezoneOffset()*60000).toISOString().slice(0,16),publicPoint:null}
  })
  const {quantities,goal,maxMembers,fee,meeting,note,deliveryTime,deadline,publicPoint}=draft
  const [pending,setPending]=useState(false),[problem,setProblem]=useState(''),[mapOpen,setMapOpen]=useState(false)
  const groups=s.posts.filter(p=>p.restaurant===store.store_name&&p.status==='recruiting'&&(!targetPostId||p.sharedId===targetPostId))
  const [newOpen,setNewOpen]=useState(!groups.length)
  const submitted=useRef(false),title=useRef<HTMLButtonElement>(null),existing=useRef<HTMLElement>(null)
  useEffect(()=>{title.current?.focus()},[])
  useEffect(()=>{if(!submitted.current)d.storeDrafts.current.set(draftKey,draft)},[draftKey,draft])
  function update<K extends keyof StoreDraft>(key:K,value:StoreDraft[K]){setDraft(v=>({...v,[key]:value}));setProblem('')}
  const sum=store.menus.reduce((v,m)=>v+m.price*(quantities[m.id]??0),0)
  const items=store.menus.filter(m=>(quantities[m.id]??0)>0).map(m=>({id:m.id,quantity:quantities[m.id]}))
  const quantity=items.reduce((v,m)=>v+m.quantity,0)
  const reason=s.active?'진행 중인 주문을 먼저 확인해 주세요.':!sum?'메뉴를 하나 이상 담아주세요.':''
  const submit=async(postId?:string)=>{
    if(!s.session){s.setLoginOpen(true);return}
    if(!sum||pending||s.busy||s.active)return
    setPending(true);setProblem('')
    const start=new Date();start.setDate(start.getDate()+d.day);start.setHours(d.hour,0,0,0)
    const end=new Date(start.getTime()+3600000),target=Number(goal),cutoff=new Date(deadline),deliveryFee=Number(fee)
    if(end.getTime()<=Date.now()){setProblem('희망 수령 시간이 지났어요. 홈에서 시간을 다시 골라 주세요.');setPending(false);return}
    if(!postId&&(!Number.isInteger(target)||target<=0||target>1000000)){setProblem('목표 주문금액을 확인해 주세요.');setPending(false);return}
    if(!postId&&(!Number.isFinite(cutoff.getTime())||cutoff.getTime()<=Date.now()||cutoff.getTime()>Date.now()+7*86400000||!Number.isInteger(deliveryFee)||deliveryFee<0||deliveryFee>100000||!meeting.trim()||!deliveryTime.trim())){setProblem('마감 시간, 배달비, 수령 장소와 희망 시간을 확인해 주세요.');setPending(false);return}
    try{
      const result=await s.act(postId?'apply':'create',postId??null,postId?{}:{restaurant:store.store_name,category:store.menu_key==='coffee'?'카페':store.menu_key==='burger'?'버거':'패스트푸드',max_members:maxMembers,
        deadline:cutoff.toISOString(),delivery_fee:deliveryFee,min_order:target,meeting:meeting.trim(),...(publicPoint?{pickup_lat:publicPoint.lat,pickup_lng:publicPoint.lng}:{}),
        note:JSON.stringify({format:'campus-v1',text:`${d.day?'내일':'오늘'} ${deliveryTime.trim()} 함께 주문해요.\n${note.trim()}`,currentAmount:sum,deliveryTime:deliveryTime.trim(),area_id:d.area,starts_at:start.toISOString(),ends_at:end.toISOString()})})
      if(!result)return
      const saved=await d.saveBasket(result,items)
      if(!postId)await d.invite(result)
      if(!saved)s.setNotice('모집은 저장됐어요. 주문 상세에서 내 메뉴를 다시 저장해 주세요.')
      submitted.current=true;d.storeDrafts.current.delete(draftKey)
      s.selectPost(s.numberFor(result));close();push('detail')
    }finally{setPending(false)}
  }
  return <div className="baef-overlay" role="dialog" aria-modal="true" aria-labelledby="store-sheet-title" onKeyDown={e=>{if(e.key==='Escape'&&!pending)close()}}><section className="baef-sheet baef-menu-sheet">
    <header className="baef-sheet-title"><div><span className="baef-eyebrow">{foodName(store.menu_key)}</span><h2 id="store-sheet-title">{store.store_name}</h2></div><button ref={title} className="baef-icon-button" disabled={pending} aria-label="가게 메뉴 닫기" onClick={close}><SmallIcon name="close"/></button></header>
    <div className="baef-sheet-content"><p className="baef-muted">내가 먹을 메뉴를 담고 함께 주문해요.</p>
      <div className="baef-menu-items">{store.menus.map(m=><div className="baef-menu-item" key={m.id}><div><b>{m.name}</b><span>{money(m.price)}</span></div><div className="baef-quantity"><button aria-label={`${m.name} 줄이기`} disabled={pending||!quantities[m.id]} onClick={()=>update('quantities',{...quantities,[m.id]:Math.max(0,(quantities[m.id]??0)-1)})}>−</button><span>{quantities[m.id]??0}</span><button aria-label={`${m.name} 추가`} disabled={pending||(quantities[m.id]??0)>=10} onClick={()=>update('quantities',{...quantities,[m.id]:(quantities[m.id]??0)+1})}>+</button></div></div>)}</div>
      {!targetPostId&&groups.length>0&&<section ref={existing} className="baef-existing-groups"><h3>참가할 모집 선택</h3>{groups.map(p=><div key={p.id}><span>{p.leaderName} · {p.currentMembers}/{p.maxMembers}명 · {p.deadline} 마감</span><button disabled={!!reason||pending||s.busy} title={reason||undefined} onClick={()=>void submit(p.sharedId)}>참가 신청</button></div>)}</section>}
      {!targetPostId&&<details className="baef-proposal-details" open={newOpen} onToggle={e=>setNewOpen(e.currentTarget.open)}><summary>새 모집으로 시작하기</summary><div className="baef-proposal-fields">
        <label>모집 인원 (나 포함)<select value={maxMembers} onChange={e=>update('maxMembers',Number(e.target.value))}>{[2,3,4,5].map(n=><option key={n} value={n}>{n}명</option>)}</select></label>
        <label>목표 주문금액<input type="number" min="1" max="1000000" step="100" value={goal} onChange={e=>update('goal',e.target.value)}/></label>
        <details className="baef-order-details"><summary>모집 조건 자세히 설정</summary><div className="baef-order-form">
          <label>모집 마감<input type="datetime-local" value={deadline} onChange={e=>update('deadline',e.target.value)}/></label><label>총 배달비<input type="number" min="0" max="100000" value={fee} onChange={e=>update('fee',e.target.value)}/></label>
          <label>희망 수령 시간<input value={deliveryTime} maxLength={50} onChange={e=>update('deliveryTime',e.target.value)}/></label><label>수령 제안 장소<input value={meeting} maxLength={200} onChange={e=>update('meeting',e.target.value)}/></label><label>기타 전달사항<textarea value={note} maxLength={500} onChange={e=>update('note',e.target.value)}/></label>
        </div><button className="baef-button secondary" onClick={()=>setMapOpen(v=>!v)}>공개 수령점을 지도에 표시</button>{mapOpen&&<><p className="baef-muted">여기에 찍은 위치는 모집 목록에 공개돼요. 집 주소 대신 함께 만날 공개 장소를 선택해 주세요.</p><Suspense fallback={<p>지도 불러오는 중…</p>}><MatchLocationPicker point={publicPoint} onChange={p=>update('publicPoint',p)}/></Suspense>{publicPoint&&<button className="baef-text-cancel" onClick={()=>update('publicPoint',null)}>공개 위치 제거</button>}</>}</details>
        <p className="baef-muted">{meeting} · {d.day?'내일':'오늘'} {deliveryTime}<br/>배달비 총 {money(Number(fee)||0)} · 마감 {relativeDateTime(deadline)}</p>
      </div></details>}
      {problem&&<p className="baef-error" role="alert">{problem}</p>}{d.error&&<p className="baef-error" role="alert">{d.error}</p>}
    </div>
    <footer className="baef-sheet-footer"><div className="baef-sheet-total"><span>메뉴 {quantity}개 선택</span><b>{money(sum)}</b></div>
      <button className="baef-button" disabled={!!reason||pending||s.busy} aria-describedby={reason?'store-submit-reason':undefined} onClick={()=>{if(targetPostId)void submit(targetPostId);else if(newOpen)void submit();else existing.current?.scrollIntoView({block:'nearest',behavior:'smooth'})}}>{pending?'저장 중…':targetPostId?'참가 신청':newOpen?s.session?'모집 등록':'로그인하고 모집하기':'참가할 모집 선택'}</button><ButtonHint id="store-submit-reason" reason={reason}/>
    </footer>
  </section></div>
}

export function DiscoveryCreate({pop,push}:{pop:()=>void;push:(s:Screen)=>void}){
  const d=useMenuDiscovery(),[store,setStore]=useState<MenuStore|null>(null)
  return <div className="baef-scroll"><div className="baef-page"><button className="baef-back" onClick={pop}><SmallIcon name="back"/>뒤로</button><h1 className="baef-page-title">어느 가게에서 주문할까요?</h1><p className="baef-muted">메뉴를 담으면 바로 모집을 시작할 수 있어요.</p><div className="baef-store-list">{d.catalog.map(c=><button className="baef-store-row" key={c.store_name} onClick={()=>setStore(c)}><div className="baef-store-photo"><StorePhoto store={c}/></div><div className="baef-store-info"><small>{foodName(c.menu_key)}</small><h3>{c.store_name}</h3><p>목표 주문금액 {money(c.goal_amount)}</p></div><span>›</span></button>)}</div>{store&&<StoreSheet store={store} close={()=>setStore(null)} push={push}/>}</div></div>
}

export function BasketEditor({postId}:{postId:string}){
  const s=useSharedDelivery(),d=useMenuDiscovery(),order=useDeliveryLifecycle()
  const p=s.rawPosts.find(v=>v.id===postId),store=d.catalog.find(v=>v.store_name===p?.restaurant)
  const basket=d.baskets.find(b=>b.post_id===postId&&b.user_id===s.session?.user.id)
  const [quantities,setQuantities]=useState<Record<number,number>>({})
  const savedItems=JSON.stringify(basket?.items??[])
  const feedback=useSaveFeedback()
  useEffect(()=>{setQuantities(Object.fromEntries((JSON.parse(savedItems) as {id:number;quantity:number}[]).map(i=>[i.id,i.quantity])))},[postId,savedItems])
  if(!store)return null
  const people=s.members.filter(m=>m.post_id===postId&&m.status==='accepted')
  const orders=d.baskets.filter(b=>b.post_id===postId&&people.some(m=>m.user_id===b.user_id))
  const total=orders.reduce((sum,b)=>sum+b.total,0)
  const active=s.members.some(m=>m.user_id===s.session?.user.id&&m.post_id===postId&&m.active)&&(!order.states.find(v=>v.post_id===postId)||order.states.find(v=>v.post_id===postId)?.phase==='menu')
  const accepted=s.members.some(m=>m.user_id===s.session?.user.id&&m.post_id===postId&&m.status==='accepted')
  return <section className="baef-basket"><div className="baef-section-title"><h3>주문 메뉴</h3><span>{orders.length}/{people.length}명 선택</span></div><details><summary>내 메뉴 {basket?`· ${money(basket.total)}`:'고르기'}</summary><div className="baef-menu-items">{store.menus.map(m=><div className="baef-menu-item" key={m.id}><div><b>{m.name}</b><span>{money(m.price)}</span></div><div className="baef-quantity"><button aria-label={`${m.name} 줄이기`} disabled={!active||!quantities[m.id]} onClick={()=>{feedback.change();setQuantities(q=>({...q,[m.id]:Math.max(0,(q[m.id]??0)-1)}))}}>−</button><span>{quantities[m.id]??0}</span><button aria-label={`${m.name} 추가`} disabled={!active||(quantities[m.id]??0)>=10} onClick={()=>{feedback.change();setQuantities(q=>({...q,[m.id]:(q[m.id]??0)+1}))}}>+</button></div></div>)}</div><button className="baef-button" disabled={!active||d.saving||!Object.values(quantities).some(q=>q>0)} onClick={()=>{const version=feedback.begin();void d.saveBasket(postId,store.menus.filter(m=>(quantities[m.id]??0)>0).map(m=>({id:m.id,quantity:quantities[m.id]}))).then(ok=>{if(ok)feedback.saved(version)})}}>{d.saving?'저장 중…':'내 메뉴 저장'}</button><SaveFeedback status={feedback.status}/><ButtonHint reason={!active?'확정된 메뉴는 변경할 수 없어요.':!Object.values(quantities).some(q=>q>0)?'메뉴를 하나 이상 골라주세요.':''}/></details>
    {accepted?<>{orders.map(b=><div className="baef-basket-person" key={b.user_id}><b>{s.nickname(b.user_id)}</b><p>{b.items.map(i=>`${i.name} ${i.quantity}개`).join(' · ')}</p><span>{money(b.total)}</span></div>)}
    <div className="baef-order-total"><span>현재 모인 메뉴금액</span><b>{money(total)}</b></div><p className="baef-muted">{total>=(p?.min_order??Infinity)?'목표 주문금액을 채웠어요. 메뉴와 금액을 함께 확인해 주세요.':`${money(Math.max(0,(p?.min_order??0)-total))} 더 모이면 목표금액을 채워요.`}</p></>:<p className="baef-muted">참가가 수락되면 함께 주문하는 메뉴와 금액을 확인할 수 있어요.</p>}{d.error&&<p className="baef-error">{d.error}</p>}
  </section>
}

export function MenuAlerts({close,push}:{close:()=>void;push:(s:Screen)=>void}){
  const d=useMenuDiscovery(),s=useSharedDelivery()
  return <section className="baef-alert-panel"><header className="baef-sheet-title"><h1 className="baef-page-title">알림</h1><button className="baef-icon-button" aria-label="알림 닫기" onClick={close}><SmallIcon name="close"/></button></header><div className="baef-alert-scroll">
    {d.alerts.map(n=><button className={`baef-alert-item ${!n.read_at?'unread':''}`} key={n.id} onClick={()=>{void d.readAlerts([n.id]);if(n.kind==='group_invite'&&n.payload.post_id){const p=s.posts.find(p=>p.sharedId===n.payload.post_id);if(p){s.selectPost(p.id);close();push('detail');return}}close();push('list')}}><span className="baef-alert-symbol"><SmallIcon name="people"/></span><div><b>{n.kind==='group_invite'?'함께 주문할 모집이 열렸어요':'메뉴가 겹치는 배프가 있어요'}</b><p>{n.payload.stores.join(' · ')}</p><small>{n.kind==='menu_match'&&n.payload.max_walk_m?'근처에서 함께 수령':areaName(n.payload.area)} · {relativeDateTime(n.created_at)}</small></div></button>)}
    {s.notifications.map(n=><button className={`baef-alert-item ${!n.read?'unread':''}`} key={n.id} onClick={()=>{s.setNotifications(values=>values.map(v=>v.id===n.id?{...v,read:true}:v));s.selectPost(n.postId);close();push(n.target as Screen)}}><span className="baef-alert-symbol"><SmallIcon name="chat"/></span><div><b>{n.restaurant}</b><p>{n.text}</p><small>{relativeDateTime(n.time)}</small></div></button>)}
    {!d.alerts.length&&!s.notifications.length&&<div className="baef-empty"><SmallIcon name="bell"/><h3>아직 도착한 알림이 없어요</h3><p>메뉴가 겹치거나 신청이 도착하면<br/>여기에 알려드릴게요.</p></div>}
  </div></section>
}

export function BaefNavigation({screen,onNavigate}:{screen:string;onNavigate:(s:Screen)=>void}){
  return <nav className="baef-navigation" aria-label="주 메뉴">{([{screen:'main',name:'홈',icon:'home'},{screen:'list',name:'함께 주문',icon:'people'},{screen:'chat',name:'채팅',icon:'chat'},{screen:'profile',name:'내 정보',icon:'profile'}] as const).map(item=><button key={item.screen} aria-current={screen===item.screen?'page':undefined} onClick={()=>onNavigate(item.screen)}><SmallIcon name={item.icon}/><span>{item.name}</span></button>)}</nav>
}
