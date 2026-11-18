import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { usePreferences } from './AppPreferences'
import { useSharedDelivery } from './SharedDelivery'
import { FOOD_CHOICES, PICKUP_AREAS, areaName, formatWindow, money, useMenuDiscovery, type MenuStore, type StoreDraft } from './MenuDiscoveryContext'
import { CAMPUS_STORES } from './campus'
import type { Screen } from './navigationTypes'
import type { MatchLocation } from './matchingLocation'
import { distanceM, useDeliveryLifecycle } from './DeliveryLifecycle'
import type { MapPin } from './LocationMap'
import FoodPhoto from './FoodPhoto'
import StoreBrand from './StoreBrand'
import MenuPicker from './MenuPicker'
import AmountField from './AmountField'
import { menuChoices, menuSubtotal, menuOptionReason, restoreMenuQuantities, type MenuQuantities } from './menuSelection'
import { matchPrompts } from './matchPrompts'
import { foodPhotoSource } from './foodPhotos'
import { OrderRouteSteps } from './OrderGuide'
import { ButtonHint, SaveFeedback, relativeDateTime, useSaveFeedback } from './uiFeedback'
import {originName} from './userFlow'
import { pickupDay, pickupTimeFields } from './pickupTime'
import { deliveryWindow, estimatedBill, initialDeliverySlot } from './discoveryHelpers'
import './discovery-fixes.css'
import './location-choice.css'
const BrowseMap=lazy(()=>import('./LocationMap'))
const MatchLocationPicker=lazy(()=>import('./MatchLocationPicker'))

export function SmallIcon({name}:{name:'home'|'people'|'chat'|'profile'|'bell'|'pin'|'back'|'close'|'clock'|'plus'}){
  const paths={home:'m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87',chat:'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z',profile:'M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',back:'m15 18-6-6 6-6',close:'m6 6 12 12M6 18 18 6',clock:'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',plus:'M12 5v14M5 12h14'}
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/>{name==='people'&&<circle cx="9" cy="7" r="4"/>}</svg>
}
const foodName=(key:string)=>FOOD_CHOICES.find(f=>f.id===key)?.name??key
function StorePhoto({store}:{store:MenuStore}){
  const s=CAMPUS_STORES.find(v=>v.name===store.store_name), f=FOOD_CHOICES.find(v=>v.id===store.menu_key)
  return <StoreBrand name={store.store_name} fallback={<FoodPhoto key={store.menu_key} symbol={s?.emoji??(store.menu_key==='coffee'?'☕':store.menu_key==='burger'?'🍔':'🥪')} src={foodPhotoSource(store.menu_key,s?.imageId??f?.photo,220)}/>}/>
}

export function LocationChoice(){
  const d=useMenuDiscovery(),{currentLocation}=usePreferences()
  const [open,setOpen]=useState(false),[pickMap,setPickMap]=useState(false),[point,setPoint]=useState<MatchLocation|null>(null)
  const [feedback,setFeedback]=useState(''),[gpsAttempted,setGPSAttempted]=useState(false),requestVersion=useRef(0)
  const useGPS=async()=>{
    const version=++requestVersion.current;setFeedback('');setGPSAttempted(true)
    const coordinates=await currentLocation.request()
    if(requestVersion.current!==version)return
    if(coordinates){d.setMatchLocation(null);setPickMap(false);setFeedback('현재 위치를 출발점으로 적용했어요.')}
    else setFeedback('위치를 바꾸지 않았어요. 다시 시도하거나 지도에서 선택해 주세요.')
  }
  const active=d.matchLocation
  return <>
    <button className="baef-location" onClick={()=>{setOpen(true);setPickMap(false);setFeedback('')}} aria-label="출발 위치와 수령 지역 설정"><SmallIcon name="pin"/><span>{originName(d.matchLocation)}</span><span aria-hidden="true">⌄</span></button>
    <button className="baef-origin-summary" onClick={()=>setOpen(true)}>{active?`${d.manualLocation?'지도에서 정한 출발점 사용 중':'GPS 출발점 사용 중'} · 위치 확인 ›`:'출발 위치를 설정하면 가까운 모집을 찾을 수 있어요 ›'}</button>
    {open&&<div className="baef-overlay" role="dialog" aria-modal="true" aria-labelledby="pickup-title" onKeyDown={e=>{if(e.key==='Escape'){if(pickMap)setPickMap(false);else setOpen(false)}}}><section className={`baef-sheet baef-small-sheet ${pickMap?'baef-location-map-sheet':''}`}><div className="baef-sheet-title"><h2 id="pickup-title">{pickMap?'내 출발 위치 선택':'출발 위치와 수령 지역'}</h2><button className="baef-icon-button" aria-label="수령 지역 닫기" onClick={()=>setOpen(false)}><SmallIcon name="close"/></button></div>
      {pickMap?<>
        <p className="baef-muted">지도를 눌러 출발점을 찍어 주세요. 지도를 움직인 뒤 중심점을 선택해도 돼요.</p>
        <Suspense fallback={<p role="status">지도 불러오는 중…</p>}><MatchLocationPicker point={point} onChange={setPoint}/></Suspense>
        <p className="baef-muted">{point?`선택한 위치 · ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`:'출발점을 선택해 주세요.'}</p>
        <button className="baef-button" disabled={!point} onClick={()=>{if(!point)return;requestVersion.current++;d.setMatchLocation(point);setGPSAttempted(false);setPickMap(false);setFeedback('지도에서 고른 출발 위치를 적용했어요.')}}>이 위치를 출발점으로 사용</button>
        <button className="baef-button secondary" onClick={()=>setPickMap(false)}>선택 취소</button>
      </>:<>
        <p className="baef-muted">내 출발점은 거리 계산에, 주문 예정 지역은 메뉴 알림에 사용해요.</p>
        {PICKUP_AREAS.map(a=><button key={a.id} className={`baef-area-option ${a.id===d.area?'selected':''}`} onClick={()=>d.setArea(a.id)}><span><b>{a.name}</b><small>{a.detail}</small></span><span>{a.id===d.area?'✓':'›'}</span></button>)}
        <div className="baef-active-origin"><b>{active?`적용된 출발 위치 · ${d.manualLocation?'지도 선택':'현재 위치'}`:'출발 위치를 설정해 주세요'}</b>{active&&<p>{active.lat.toFixed(5)}, {active.lng.toFixed(5)}{!d.manualLocation&&currentLocation.coordinates&&<><br/>마지막 확인 {new Date(currentLocation.coordinates.updatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}<br/>GPS 정확도 약 {Math.ceil(currentLocation.coordinates.accuracy)}m{currentLocation.coordinates.accuracy>100&&' · 오차가 크면 지도에서 위치를 지정해 주세요.'}</>}</p>}<small>수령 지역과 별도로, 이 출발점을 기준으로 거리를 계산해요.</small></div>
        {active&&<div className="baef-origin-preview"><Suspense fallback={<p role="status">출발 위치 지도 불러오는 중…</p>}><BrowseMap pins={[{id:'origin',point:{x:0,y:0},coordinates:active,label:'내 출발 위치',symbol:'나',kind:'me'}]} onSelect={()=>{}} title="현재 적용된 내 출발 위치" center={active}/></Suspense></div>}
        <button disabled={currentLocation.loading} className="baef-button secondary" onClick={()=>void useGPS()}><SmallIcon name="pin"/>{currentLocation.loading?'현재 위치 확인 중…':'현재 위치 사용'}</button>
        <button className="baef-button secondary" onClick={()=>{requestVersion.current++;setPoint(d.matchLocation);setPickMap(true)}}>지도에서 내 출발 위치 지정</button>
        {feedback&&<p className="baef-origin-saved" role="status">{feedback.includes('적용했어요')?'✓ ':''}{feedback}{feedback.includes('적용했어요')&&' 모집글 거리에 반영돼요.'}</p>}
        {currentLocation.error&&(gpsAttempted||!d.manualLocation)&&<p role="alert" className="baef-error">{currentLocation.error}</p>}
        <button className="baef-button" onClick={()=>setOpen(false)}>설정 완료</button>
      </>}
    </section></div>}
  </>
}

export function StoreSheet(props:{store:MenuStore;close:()=>void;push:(s:Screen)=>void;targetPostId?:string;intent?:'create'}){
 const s=useSharedDelivery(),[choice,setChoice]=useState<string|null>(props.targetPostId??(props.intent==='create'?'new':null))
 const groups=s.posts.filter(p=>p.restaurant===props.store.store_name&&p.status==='recruiting'&&p.currentMembers<p.maxMembers)
 if(choice)return <StoreOrderSheet {...props} targetPostId={choice==='new'?undefined:choice}/>
 return <div className="baef-overlay" role="dialog" aria-modal="true"><section className="baef-sheet baef-small-sheet"><header className="baef-sheet-title"><h2>{props.store.store_name}</h2><button onClick={props.close} aria-label="가게 닫기">×</button></header><p>열린 모집에 참가하거나, 새 모집을 시작해 보세요.</p>{groups.map(p=><button className="baef-button secondary" key={p.id} onClick={()=>setChoice(p.sharedId!)}>{p.leaderName} · {p.currentMembers}/{p.maxMembers}명 · 참가할 메뉴 고르기</button>)}{!groups.length&&<p className="baef-muted">지금 열린 모집이 없어요.</p>}<button className="baef-button" onClick={()=>setChoice('new')}>내가 새 모집하기</button></section></div>
}
function StoreOrderSheet({store,close,push,targetPostId}:{store:MenuStore;close:()=>void;push:(s:Screen)=>void;targetPostId?:string}){
  const d=useMenuDiscovery(),s=useSharedDelivery(),o=useDeliveryLifecycle()
  const draftKey=`${s.session?.user.id??'guest'}:${store.store_name}:${targetPostId??'new'}`
  const [draft,setDraft]=useState<StoreDraft>(()=>{
    const saved=d.storeDrafts.current.get(draftKey);if(saved)return saved
    const slot=initialDeliverySlot(d.day,d.hour),cutoff=deliveryWindow(slot.deliveryDay,slot.deliveryClock)!.start
    return {quantities:{},goal:String(store.goal_amount),maxMembers:2,fee:'3000',meeting:areaName(d.area),note:'',...slot,deadline:new Date(cutoff.getTime()-cutoff.getTimezoneOffset()*60000).toISOString().slice(0,16),publicPoint:null}
  })
  const {quantities,goal,maxMembers,fee,meeting,note,deliveryDay,deliveryClock,deadline,publicPoint}=draft
  const [pending,setPending]=useState(false),[problem,setProblem]=useState(''),[mapOpen,setMapOpen]=useState(false),[step,setStep]=useState(0)
  const groups:typeof s.posts=[]
  const [newOpen,setNewOpen]=useState(!groups.length)
  const submitted=useRef(false),title=useRef<HTMLButtonElement>(null),existing=useRef<HTMLElement>(null)
  useEffect(()=>{title.current?.focus()},[])
  useEffect(()=>{if(!submitted.current)d.persistDraft(draftKey,draft)},[draftKey,draft])
  function update<K extends keyof StoreDraft>(key:K,value:StoreDraft[K]){setDraft(v=>({...v,[key]:value}));setProblem('')}
  function updateDelivery(key:'deliveryDay'|'deliveryClock',value:string){
    setDraft(previous=>{const next={...previous,[key]:value},prior=deliveryWindow(previous.deliveryDay,previous.deliveryClock),chosen=deliveryWindow(next.deliveryDay,next.deliveryClock),cutoff=new Date(previous.deadline)
      if(chosen&&(!Number.isFinite(cutoff.getTime())||cutoff.getTime()>chosen.start.getTime()||prior&&cutoff.getTime()===prior.start.getTime()))next.deadline=new Date(chosen.start.getTime()-chosen.start.getTimezoneOffset()*60000).toISOString().slice(0,16)
      return next});setProblem('')
  }
  const sum=menuSubtotal(store.menus,quantities)
  const items=menuChoices(store.menus,quantities)
  const quantity=items.reduce((v,m)=>v+m.quantity,0)
  const reason=s.active?'진행 중인 주문을 먼저 확인해 주세요.':!sum?'메뉴를 하나 이상 담아주세요.':menuOptionReason(store.store_name,store.menus,quantities,d.menuOptionsReady)
  const window=deliveryWindow(deliveryDay,deliveryClock)
  const selectedPost=targetPostId?s.rawPosts.find(p=>p.id===targetPostId):null
  const selectedState=targetPostId?o.states.find(v=>v.post_id===targetPostId):null
  const previewPeople=selectedPost?Math.min(selectedPost.max_members,selectedPost.member_count+1):maxMembers
  const baseBill=estimatedBill(sum,selectedPost?.delivery_fee??Number(fee),previewPeople)
  const agreedFee=selectedState?.nearby_agreed?(selectedState.nearby_requester===s.session?.user.id?selectedPost?.delivery_fee??0:0):null
  const bill=agreedFee==null?baseBill:{share:agreedFee,total:sum+agreedFee,saving:Math.max(0,(selectedPost?.delivery_fee??0)-agreedFee)}
  const previewPoint=selectedPost?.pickup_lat!=null&&selectedPost.pickup_lng!=null?{lat:selectedPost.pickup_lat,lng:selectedPost.pickup_lng}:targetPostId?null:publicPoint
  const previewDistance=previewPoint&&d.matchLocation?Math.ceil(distanceM(previewPoint,d.matchLocation)):null
  const today=new Date(),tomorrow=new Date(today);tomorrow.setDate(today.getDate()+1)
  const deliveryDays=[{day:pickupDay(today),label:'오늘'},{day:pickupDay(tomorrow),label:'내일'}]
  if(!deliveryDays.some(v=>v.day===deliveryDay))deliveryDays.push({day:deliveryDay,label:`${deliveryDay.slice(5).replace('-','월 ')}일 · 저장된 일정`})
  const deadlineFields=pickupTimeFields(deadline,window?.start.toISOString())
  const billKnown=!!targetPostId||newOpen||!groups.length
  const submit=async(postId?:string)=>{
    if(!s.session){s.setLoginOpen(true);return}
    if(reason||pending||s.busy)return
    setPending(true);setProblem('')
    const target=Number(goal),cutoff=new Date(deadline),deliveryFee=Number(fee)
    if(postId){const room=s.rawPosts.find(p=>p.id===postId);if(!room||room.status!=='open'||new Date(room.deadline).getTime()<=Date.now()){setProblem('이 모집은 마감됐어요. 다른 모집을 선택해 주세요.');setPending(false);return}}
    if(!postId&&(!window||window.start.getTime()<=Date.now())){setProblem('앞으로의 주문 날짜와 시간을 골라 주세요.');setPending(false);return}
    if(!postId&&(!Number.isInteger(target)||target<=0||target>1000000)){setProblem('목표 주문금액을 확인해 주세요.');setPending(false);return}
    if(!postId&&(!Number.isFinite(cutoff.getTime())||cutoff.getTime()<=Date.now()||cutoff.getTime()>window!.start.getTime()||cutoff.getTime()>Date.now()+7*86400000||!Number.isInteger(deliveryFee)||deliveryFee<0||deliveryFee>100000||!meeting.trim())){setProblem('모집 마감은 현재부터 주문 예정 시간 사이로 정하고, 배달비와 수령 장소도 확인해 주세요.');setPending(false);return}
    try{
      const result=await s.act(postId?'apply':'create',postId??null,postId?{}:{restaurant:store.store_name,category:store.menu_key==='coffee'?'카페':store.menu_key==='burger'?'버거':'패스트푸드',max_members:maxMembers,
        deadline:cutoff.toISOString(),delivery_fee:deliveryFee,min_order:target,meeting:meeting.trim(),...(publicPoint?{pickup_lat:publicPoint.lat,pickup_lng:publicPoint.lng}:{}),
        note:JSON.stringify({format:'campus-v1',text:`${relativeDateTime(window!.start)} 주문 예정이에요.\n${note.trim()}`,currentAmount:sum,deliveryTime:window!.label,area_id:d.area,starts_at:window!.start.toISOString(),ends_at:window!.end.toISOString()})})
      if(!result)return
      const saved=await d.saveBasket(result,items)
      if(!postId)await d.invite(result)
      if(!saved)s.setNotice('모집은 저장됐어요. 주문 상세에서 내 메뉴를 다시 저장해 주세요.')
      if(saved)s.setNotice(postId?'참가 신청을 보냈어요. 리더가 수락하면 주문을 준비할 수 있어요.':'모집을 등록했어요. 신청자를 수락한 뒤 메뉴와 수령 장소를 확정해 주세요.');submitted.current=true;d.persistDraft(draftKey,null)
      s.selectPost(s.numberFor(result));close();push('detail')
    }finally{setPending(false)}
  }
  return <div className="baef-overlay" role="dialog" aria-modal="true" aria-labelledby="store-sheet-title" onKeyDown={e=>{if(e.key==='Escape'&&!pending)close()}}><section className="baef-sheet baef-menu-sheet">
    <header className="baef-sheet-title"><div className="baef-store-heading"><div className="baef-store-photo"><StorePhoto store={store}/></div><div><span className="baef-eyebrow">{foodName(store.menu_key)}</span><h2 id="store-sheet-title">{store.store_name}</h2></div></div><button ref={title} className="baef-icon-button" disabled={pending} aria-label="가게 메뉴 닫기" onClick={close}><SmallIcon name="close"/></button></header>
    <div className="baef-sheet-content"><OrderRouteSteps joining={!!targetPostId} current={targetPostId?0:step+1}/>{!targetPostId&&step===1&&<button className="baef-back live-edit-menu" onClick={()=>setStep(0)}>‹ 메뉴 다시 고르기</button>}<p className="baef-muted">{targetPostId?'내 메뉴를 담아 신청하면 리더 수락 후 참여할 수 있어요.':'내 메뉴를 담고 모집을 등록하면 함께할 사람을 받을 수 있어요.'}</p>
      <div hidden={step!==0}><MenuPicker storeName={store.store_name} menus={store.menus} quantities={quantities} onChange={v=>update('quantities',v)} disabled={pending} optionsEnabled={d.menuOptionsReady}/></div>
      {!targetPostId&&step===0&&groups.length>0&&<section ref={existing} className="baef-existing-groups"><h3>참가할 모집 선택</h3>{groups.map(p=>{const room=s.rawPosts.find(v=>v.id===p.sharedId),cost=estimatedBill(sum,room?.delivery_fee??3000,Math.min(p.maxMembers,p.currentMembers+1));return <div key={p.id}><span>{p.leaderName} · {p.currentMembers}/{p.maxMembers}명 · {p.deadline} 마감<br/>내 예상 합계 {money(cost.total)} · 배달비 {money(cost.share)}</span><button disabled={!!reason||pending||s.busy} title={reason||undefined} onClick={()=>void submit(p.sharedId)}>참가 신청</button></div>})}</section>}
      {!targetPostId&&step===1&&<details className="baef-proposal-details" open={newOpen} onToggle={e=>setNewOpen(e.currentTarget.open)}><summary>새 모집으로 시작하기</summary><div className="baef-proposal-fields">
        <details className="baef-recruit-settings" open><summary><b>모집 조건 변경</b><span>{maxMembers}명 · 목표 {money(Number(goal)||0)}</span></summary><div className="baef-order-form">
        <label>모집 인원 (나 포함)<select value={maxMembers} onChange={e=>update('maxMembers',Number(e.target.value))}>{[2,3,4,5].map(n=><option key={n} value={n}>{n}명</option>)}</select></label>
        <AmountField label="목표 주문금액" min={1} value={goal} onChange={v=>update('goal',v)}/>
        <div className="baef-more-conditions"><div className="baef-order-form">
          <fieldset className="baef-slot-fields"><legend>모집 마감</legend><div className="baef-deadline-fields"><label>날짜<select aria-label="모집 마감 날짜" value={deadlineFields.day} onChange={e=>update('deadline',`${e.target.value}T${deadlineFields.clock}`)}>{deadlineFields.days.map(day=><option key={day.value} value={day.value}>{day.label}</option>)}</select></label><label>시간<input aria-label="모집 마감 시각" type="time" step="60" value={deadlineFields.clock} onChange={e=>update('deadline',`${deadlineFields.day}T${e.target.value}`)}/></label></div></fieldset><AmountField label="총 배달비" max={100000} kind="fee" value={fee} onChange={v=>update('fee',v)}/>
          <fieldset className="baef-slot-fields"><legend>주문 예정 시간</legend><div><label>날짜<select aria-label="모집 주문 예정 날짜" value={deliveryDay} onChange={e=>updateDelivery('deliveryDay',e.target.value)}>{deliveryDays.map(day=><option key={day.day} value={day.day}>{day.label}</option>)}</select></label><label>시간<input aria-label="모집 주문 예정 시각" type="time" step="60" value={deliveryClock} onChange={e=>updateDelivery('deliveryClock',e.target.value)}/></label></div></fieldset><label>수령 제안 장소<input value={meeting} maxLength={200} onChange={e=>update('meeting',e.target.value)}/></label><label>기타 전달사항<textarea value={note} maxLength={500} onChange={e=>update('note',e.target.value)}/></label>
        </div><button className="baef-button secondary" onClick={()=>setMapOpen(v=>!v)}>공개 수령점을 지도에 표시</button>{mapOpen&&<><p className="baef-muted">여기에 찍은 위치는 모집 목록에 공개돼요. 집 주소 대신 함께 만날 공개 장소를 선택해 주세요.</p><Suspense fallback={<p>지도 불러오는 중…</p>}><MatchLocationPicker point={publicPoint} onChange={p=>update('publicPoint',p)}/></Suspense>{publicPoint&&<button className="baef-text-cancel" onClick={()=>update('publicPoint',null)}>공개 위치 제거</button>}</>}</div>
        </div></details><p className="baef-muted">{meeting} · {window?relativeDateTime(window.start):'수령 시간 선택 필요'}<br/>배달비 총 {money(Number(fee)||0)} · 마감 {relativeDateTime(deadline)}</p>
      </div></details>}
      {!targetPostId&&step===1&&(newOpen||!groups.length)&&<section className="baef-recruit-preview" aria-label="등록할 모집 조건"><h3>이 조건으로 모집해요</h3><dl><dt>모집 인원</dt><dd>나 포함 {maxMembers}명</dd><dt>목표 주문금액</dt><dd>{money(Number(goal)||0)}</dd><dt>모집 마감</dt><dd>{relativeDateTime(deadline)}</dd><dt>주문 예정</dt><dd>{window?relativeDateTime(window.start):'시간 선택 필요'}</dd><dt>수령 제안 장소</dt><dd>{meeting.trim()||'장소 입력 필요'}</dd><dt>전체 배달비</dt><dd>{money(Number(fee)||0)}</dd></dl></section>}
      {sum>0&&(!!targetPostId||step===1)&&(!!targetPostId||newOpen||!groups.length)&&<section className="baef-estimate" aria-label="참가 전 예상 비용"><h3>내 예상 부담</h3><dl><dt>음식값</dt><dd>{money(sum)}</dd><dt>배달비 · {agreedFee!=null?'합의한 수령 방식':`${previewPeople}명 균등 분담`}</dt><dd>{money(bill.share)}</dd><dt className="baef-estimate-total">예상 합계</dt><dd className="baef-estimate-total">{money(bill.total)}</dd></dl><p className="baef-estimate-saving">혼자 배달비를 낼 때보다 약 {money(bill.saving)} 절약</p><p>{previewDistance!=null?`수령점까지 직선 약 ${previewDistance}m`:previewPoint?'출발 위치를 정하면 수령점까지 거리를 볼 수 있어요.':'수령점을 지도에 정하면 이동거리를 확인할 수 있어요.'}<br/>{selectedState?.nearby_agreed?'내 근처 수령 합의가 있어요. 참가 후 확정된 분담액을 확인해 주세요.':'모집 인원과 수령 방식이 확정되면 최종 금액을 안내해요.'}</p></section>}
      {problem&&<p className="baef-error" role="alert">{problem}</p>}{d.error&&<p className="baef-error" role="alert">{d.error}</p>}
    </div>
    <footer className="baef-sheet-footer">{quantity>0&&(billKnown?<div className="baef-footer-bill"><span>음식값 {money(sum)}</span><span>+ {agreedFee!=null?'합의한 배달비':`${previewPeople}명 균등 분담 시 배달비`} {money(bill.share)}</span></div>:<p className="baef-footer-bill">참가할 모집을 고르면 배달비를 확인할 수 있어요.</p>)}<div className="baef-sheet-total"><span>메뉴 {quantity}개 · {billKnown?'내 예상 합계':'음식값'}</span><b>{money(billKnown&&quantity>0?bill.total:sum)}</b></div>
      <button className="baef-button" disabled={!!reason||pending||s.busy} aria-describedby={reason?'store-submit-reason':undefined} onClick={()=>{if(!targetPostId&&step===0){setNewOpen(true);setStep(1);return}if(targetPostId)void submit(targetPostId);else if(newOpen||!groups.length)void submit();else existing.current?.scrollIntoView({block:'nearest',behavior:'smooth'})}}>{pending?'저장 중…':!targetPostId&&step===0?'모집 조건 확인':targetPostId?'이 메뉴로 참가 신청':newOpen||!groups.length?s.session?'이 조건으로 모집 시작':'로그인하고 모집하기':'참가할 모집 선택'}</button><ButtonHint id="store-submit-reason" reason={reason}/>
    </footer>
  </section></div>
}

export function BasketEditor({postId}:{postId:string}){
  const s=useSharedDelivery(),d=useMenuDiscovery(),order=useDeliveryLifecycle()
  const p=s.rawPosts.find(v=>v.id===postId),store=d.catalog.find(v=>v.store_name===p?.restaurant)
  const basket=d.baskets.find(b=>b.post_id===postId&&b.user_id===s.session?.user.id)
  const [quantities,setQuantities]=useState<MenuQuantities>({})
  const savedItems=JSON.stringify(basket?.items??[])
  const feedback=useSaveFeedback()
  useEffect(()=>{setQuantities(restoreMenuQuantities(JSON.parse(savedItems)))},[postId,savedItems])
  if(!store)return null
  const optionReason=menuOptionReason(store.store_name,store.menus,quantities,d.menuOptionsReady)
  const people=s.members.filter(m=>m.post_id===postId&&m.status==='accepted')
  const orders=d.baskets.filter(b=>b.post_id===postId&&people.some(m=>m.user_id===b.user_id))
  const total=orders.reduce((sum,b)=>sum+b.total,0)
  const active=s.members.some(m=>m.user_id===s.session?.user.id&&m.post_id===postId&&m.active)&&(!order.states.find(v=>v.post_id===postId)||order.states.find(v=>v.post_id===postId)?.phase==='menu')
  const accepted=s.members.some(m=>m.user_id===s.session?.user.id&&m.post_id===postId&&m.status==='accepted')
  return <section className="baef-basket"><div className="baef-section-title"><h3>주문 메뉴</h3><span>{orders.length}/{people.length}명 선택</span></div><details open={!basket&&active}><summary>내 메뉴 {basket?`· ${money(basket.total)}`:'고르기'}</summary><MenuPicker key={postId} storeName={store.store_name} menus={store.menus} quantities={quantities} onChange={value=>{feedback.change();setQuantities(value)}} disabled={!active} optionsEnabled={d.menuOptionsReady}/><button className="baef-button" disabled={!active||d.saving||!!optionReason||!Object.values(quantities).some(q=>q>0)} onClick={()=>{const version=feedback.begin();void d.saveBasket(postId,menuChoices(store.menus,quantities)).then(ok=>{if(ok)feedback.saved(version)})}}>{d.saving?'저장 중…':'내 메뉴 저장'}</button><SaveFeedback status={feedback.status}/><ButtonHint reason={!active?'확정된 메뉴는 변경할 수 없어요.':!Object.values(quantities).some(q=>q>0)?'메뉴를 하나 이상 골라주세요.':optionReason}/></details>
    {accepted?<>{orders.map(b=><div className="baef-basket-person" key={b.user_id}><b>{s.nickname(b.user_id)}</b><p>{b.items.map(i=>`${i.name} ${i.quantity}개`).join(' · ')}</p><span>{money(b.total)}</span></div>)}
    <div className="baef-order-total"><span>현재 모인 메뉴금액</span><b>{money(total)}</b></div><p className="baef-muted">{total>=(p?.min_order??Infinity)?'목표 주문금액을 채웠어요. 메뉴와 금액을 함께 확인해 주세요.':`${money(Math.max(0,(p?.min_order??0)-total))} 더 모이면 목표금액을 채워요.`}</p></>:<p className="baef-muted">참가가 수락되면 함께 주문하는 메뉴와 금액을 확인할 수 있어요.</p>}{d.error&&<p className="baef-error">{d.error}</p>}
  </section>
}

export function MenuAlerts({close,push}:{close:()=>void;push:(s:Screen)=>void}){
  const d=useMenuDiscovery(),s=useSharedDelivery()
  const unread=d.alerts.filter(n=>!n.read_at).length+s.notifications.filter(n=>!n.read).length
  const entries=[
    ...matchPrompts(d.alerts,d.matches).map(match=>({key:`match:${match.store}`,time:new Date(match.createdAt).getTime(),view:<button className={`baef-alert-item ${match.unread?'unread':''}`} onClick={()=>{void d.readAlerts(match.ids);d.startMatchingRoom(match.store);close();push('create')}}><span className="baef-alert-symbol"><SmallIcon name="people"/></span><div><b>함께 주문할 배프 {match.count}명이 있어요</b><p>{match.store} · 메뉴와 시간이 겹쳐요.</p><p>모집을 시작해 볼까요? →</p><small>{relativeDateTime(match.createdAt)}</small></div></button>})),
    ...d.alerts.filter(n=>n.kind==='group_invite').map(n=>({key:`invite:${n.id}`,time:new Date(n.created_at).getTime(),view:<button className={`baef-alert-item ${!n.read_at?'unread':''}`} onClick={()=>{void d.readAlerts([n.id]);if(n.payload.post_id){const p=s.posts.find(p=>p.sharedId===n.payload.post_id);if(p){s.selectPost(p.id);close();push('detail');return}}close();push('list')}}><span className="baef-alert-symbol"><SmallIcon name="people"/></span><div><b>함께 주문할 모집이 열렸어요</b><p>{n.payload.stores.join(' · ')}</p><small>{areaName(n.payload.area)} · {relativeDateTime(n.created_at)}</small></div></button>})),
    ...s.notifications.map(n=>({key:`order:${n.id}`,time:n.time,view:<button className={`baef-alert-item ${!n.read?'unread':''}`} onClick={()=>{s.readNotification(n.id);s.selectPost(n.sharedPostId?s.numberFor(n.sharedPostId):n.postId);close();push(n.target as Screen)}}><span className="baef-alert-symbol"><SmallIcon name="chat"/></span><div><b>{n.restaurant}</b><p>{n.text}</p><small>{relativeDateTime(n.time)}</small></div></button>})),
  ].sort((a,b)=>b.time-a.time)
  return <section className="baef-alert-panel"><header className="baef-sheet-title"><h1 className="baef-page-title">알림</h1><button className="baef-icon-button" aria-label="알림 닫기" onClick={close}><SmallIcon name="close"/></button></header><div className="baef-alert-toolbar"><span>{unread>0?`읽지 않은 알림 ${unread}개`:'모든 알림을 확인했어요'}</span><button className="baef-text-action" disabled={!unread||d.saving} onClick={()=>{const ids=d.alerts.filter(n=>!n.read_at).map(n=>n.id);if(ids.length)void d.readAlerts(ids);s.readAllNotifications()}}>모두 읽음</button></div><div className="baef-alert-scroll">
    {entries.map(entry=><div key={entry.key}>{entry.view}</div>)}
    {!entries.length&&<div className="baef-empty"><SmallIcon name="bell"/><h3>아직 도착한 알림이 없어요</h3><p>메뉴가 겹치거나 신청이 도착하면<br/>여기에 알려드릴게요.</p></div>}
  </div></section>
}
