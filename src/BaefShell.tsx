import { useEffect, useState } from 'react'
import { useFlow } from './FlowContext'
import { SharedAccountControl, SharedApplicants, SharedChat, useSharedDelivery } from './SharedDelivery'
import { useMenuDiscovery, money } from './MenuDiscoveryContext'
import { BaefNavigation, BasketEditor, DiscoveryCreate, MenuAlerts, MenuHome, SmallIcon, TogetherScreen } from './MenuDiscovery'
import type { Screen } from './WorkflowScreens'
import './baef.css'
import { useDeliveryLifecycle } from './DeliveryLifecycle'
import { OrderProgress, OrderChatControls, OrderMenu, OrderPayment, OrderDelivery, OrderReceipt, OrderComplete, OrderRating, OrderProfileExtras, OrderParticipants, MeetingTools } from './OrderScreens'

export default function BaefShell(){
  const s=useSharedDelivery(),d=useMenuDiscovery(),flow=useFlow()
  const [history,setHistory]=useState<Screen[]>(['main']),[alerts,setAlerts]=useState(false)
  useEffect(()=>{document.title='배프 · 한 잔도, 한 끼도 함께'},[])
  const screen=history[history.length-1]
  const [height,setHeight]=useState<number|null>(null)
  useEffect(()=>{
    const viewport=window.visualViewport;if(!viewport)return
    const update=()=>setHeight(viewport.height<window.innerHeight-100?viewport.height:null)
    viewport.addEventListener('resize',update);return()=>viewport.removeEventListener('resize',update)
  },[])
  const push=(next:Screen)=>{
    if(next==='chat'){
      if(!s.session){s.setLoginOpen(true);return}
      if(!s.tx||s.tx.cancelled){setHistory(['chat']);return}
      s.selectPost(s.tx.post.id)
      if(s.tx.application==='pending'){setHistory(['main','detail']);return}
    }
    setHistory(old=>next==='main'?['main']:old.includes(next)?old.slice(0,old.lastIndexOf(next)+1):[...old,next])
  }
  const pop=()=>setHistory(values=>values.length>1?values.slice(0,-1):['main'])
  const count=d.alerts.filter(n=>!n.read_at).length+s.notifications.filter(n=>!n.read).length
  const primary=['main','list','profile','chat'].includes(screen)
  const ongoingChat=screen==='chat'&&s.tx?.application==='accepted'&&!s.tx.cancelled
  return <div className={`baef-app ${flow.isDark?'app-dark':''}`}><div className="baef-shell" style={height?{height:`${height}px`}:undefined}>
    {!ongoingChat&&<header className="baef-header"><button className="baef-wordmark" onClick={()=>push('main')} aria-label="배프 홈">배프<span>.</span></button><div className="baef-header-actions"><SharedAccountControl/><button className="baef-icon-button baef-alert-button" aria-label={`알림 ${count}개`} onClick={()=>setAlerts(true)}><SmallIcon name="bell"/>{count>0&&<span>{Math.min(count,99)}</span>}</button></div></header>}
    {s.error&&!s.loginOpen&&<div className="baef-banner error" role="alert"><span>{s.error}</span><button aria-label="오류 안내 닫기" onClick={()=>s.setError('')}>×</button></div>}
    {(s.notice||d.toast)&&<div className="baef-toast" role="status"><span>{d.toast||s.notice}</span><button aria-label="안내 닫기" onClick={()=>{d.setToast('');s.setNotice('')}}>×</button></div>}
    <div className="baef-screen">
      {['menu','payment','delivery','receipt','complete','rating'].includes(screen)&&<OrderProgress push={push}/>}
      {(screen==='main'||screen==='category')&&<MenuHome push={push}/>}
      {screen==='list'&&<TogetherScreen push={push}/>}
      {screen==='create'&&<DiscoveryCreate pop={pop} push={push}/>}
      {screen==='detail'&&<GroupDetail pop={pop} push={push}/>}
      {screen==='applicants'&&<SharedApplicants pop={pop} push={push}/>}
      {screen==='chat'&&(ongoingChat?<SharedChat pop={pop} push={push} workflowControls={<OrderChatControls push={push}/>} orderPanel={<><BasketEditor postId={s.tx!.post.sharedId!}/><MeetingTools/><OrderParticipants/></>}/>:<div className="baef-empty"><SmallIcon name="chat"/><h1>함께 주문하면 대화가 시작돼요</h1><p>메뉴를 골라 배프를 찾거나<br/>열린 모집에 참가해 보세요.</p><button className="baef-button" onClick={()=>push('list')}>함께 주문 둘러보기</button></div>)}
      {screen==='menu'&&<OrderMenu pop={pop} push={push}/>}
      {screen==='payment'&&<OrderPayment pop={pop} push={push}/>}
      {screen==='delivery'&&<OrderDelivery pop={pop} push={push}/>}
      {screen==='receipt'&&<OrderReceipt pop={pop} push={push}/>}
      {screen==='complete'&&<OrderComplete pop={pop} push={push}/>}
      {screen==='rating'&&<OrderRating pop={pop}/>}
      {screen==='profile'&&<AccountScreen push={push}/>}
    </div>
    {primary&&!ongoingChat&&<BaefNavigation screen={screen} onNavigate={push}/>}
    {alerts&&<MenuAlerts close={()=>setAlerts(false)} push={push}/>}
  </div></div>
}

function GroupDetail({pop,push}:{pop:()=>void;push:(s:Screen)=>void}){
  const s=useSharedDelivery(),d=useMenuDiscovery(),p=s.selectedRaw
  const order=useDeliveryLifecycle()
  const [sheet,setSheet]=useState(false)
  if(!p)return <div className="baef-page"><button className="baef-back" onClick={pop}><SmallIcon name="back"/>뒤로</button><div className="baef-empty"><h2>모집을 찾을 수 없어요</h2><p>마감되었거나 더 이상 참여할 수 없는 모집이에요.</p></div></div>
  const mine=s.members.find(m=>m.post_id===p.id&&m.user_id===s.session?.user.id)
  const owner=p.owner_id===s.session?.user.id
  const people=s.members.filter(m=>m.post_id===p.id&&m.status==='accepted')
  const orders=d.baskets.filter(b=>b.post_id===p.id&&people.some(m=>m.user_id===b.user_id))
  const total=orders.reduce((n,b)=>n+b.total,0)
  const ended=['cancelled','completed'].includes(p.status)
  const open=p.status==='open'&&new Date(p.deadline).getTime()>Date.now()
  const ownSelection=d.catalog.find(c=>c.store_name===p.restaurant)
  // The menu sheet is loaded through the same component used by discovery.
  return <div className="baef-scroll"><div className="baef-page"><button className="baef-back" onClick={pop}><SmallIcon name="back"/>뒤로</button><div className="baef-group-head"><span className="baef-tag">{ended?'종료':open?'모집 중':'모집 마감'}</span><span>{p.member_count}/{p.max_members}명</span></div><h1 className="baef-detail-title">{p.restaurant}</h1><p className="baef-muted">{s.nickname(p.owner_id)}님이 함께 주문할 사람을 찾고 있어요.</p>
    <dl className="baef-detail-facts"><dt>수령 제안 장소</dt><dd>{p.meeting}</dd><dt>모집 마감</dt><dd>{new Date(p.deadline).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}</dd><dt>목표 주문금액</dt><dd>{money(p.min_order)}</dd><dt>배달비</dt><dd>총 {money(p.delivery_fee)} · {Math.ceil(p.delivery_fee/Math.max(2,p.member_count)).toLocaleString()}원씩 예상</dd></dl>
    {mine?.status==='accepted'&&<section className="baef-goal"><div><span>현재 모인 메뉴금액</span><b>{money(total)}</b></div><progress max={Math.max(1,p.min_order)} value={Math.min(total,p.min_order)} aria-label="주문 목표금액 달성도"/><p>{total>=p.min_order?'목표금액을 채웠어요. 주문 내용을 확인해 주세요.':`${money(p.min_order-total)} 더 모이면 목표금액을 채워요.`}</p></section>}
    {mine?.status==='pending'&&mine.active&&<div className="baef-saved-intent"><span className="baef-pulse"/><div><b>참가 신청을 보냈어요</b><p>리더가 확인하면 채팅방에 참여할 수 있어요.</p></div></div>}
    {mine?.active&&<BasketEditor postId={p.id}/>}
    {people.length>0&&<OrderParticipants/>}
    {mine?.status==='accepted'&&<button className="baef-button secondary" onClick={()=>push(order.state?.phase==='completed'?'complete':order.state?.phase==='cancelled'?'payment':'menu')}>메뉴·송금·배달·수령 진행</button>}
    {mine?.status==='withdrawn'&&<button className="baef-button secondary" onClick={()=>push('payment')}>취소·환불 현황</button>}
    {!ended&&mine?.status==='accepted'&&<button className="baef-button" onClick={()=>push(owner?'applicants':'chat')}>{owner?'신청자 관리 · 채팅':'채팅방 열기'}</button>}
    {!ended&&!mine?.active&&open&&<button className="baef-button" disabled={s.busy||s.active} onClick={()=>{if(!s.session){s.setLoginOpen(true);return}if(ownSelection)setSheet(true);else void s.act('apply',p.id)}}>{s.active?'다른 주문에 참여 중이에요':'메뉴 고르고 참가하기'}</button>}
    {mine?.active&&!ended&&(!order.state||['menu','payment'].includes(order.state.phase))&&<button className="baef-text-cancel" disabled={s.busy} onClick={()=>{if(confirm(owner?'모집을 취소할까요? 송금 내역이 있으면 환불 확인이 필요해요.':'참가를 취소할까요? 확정된 금액은 다시 계산하고 송금 내역은 환불 확인에 남겨요.'))void s.act(owner?'cancel':'withdraw',p.id)}}>{owner?'모집 취소':'참가 취소'}</button>}
    {ended&&<p className="baef-muted">종료된 주문 모임이에요.</p>}
    {sheet&&ownSelection&&<JoinSheet store={ownSelection} targetPostId={p.id} close={()=>setSheet(false)} push={push}/>}
  </div></div>
}
import { StoreSheet as JoinSheet } from './MenuDiscovery'

function AccountScreen({push}:{push:(s:Screen)=>void}){
  const s=useSharedDelivery(),d=useMenuDiscovery(),flow=useFlow()
  return <div className="baef-scroll"><div className="baef-page"><h1 className="baef-page-title">내 정보</h1><section className="baef-account"><span className="baef-large-avatar">{s.me?.nickname.slice(0,1)??'배'}</span><h2>{s.me?.nickname??'배프에 오신 걸 환영해요'}</h2><p className="baef-muted">{s.session?'함께 주문할 메뉴를 골라보세요.':'로그인하면 메뉴 알림과 함께 주문을 이용할 수 있어요.'}</p>{!s.session&&<button className="baef-button" onClick={()=>s.setLoginOpen(true)}>로그인</button>}</section>
    {s.session&&!s.allowed&&s.ready&&<p className="baef-error">메일의 인증 링크를 먼저 확인해 주세요. 인증을 마쳤는데 이용이 안 되면 다시 로그인해 주세요.</p>}
    {d.intent&&<section className="baef-profile-section"><h2>기다리는 메뉴</h2><p>{d.intent.menus.map(k=>FOOD_LABELS[k]??k).join(' · ')}</p><button className="baef-text-action" onClick={()=>push('main')}>선택 수정하기 →</button></section>}
    {s.active&&s.tx&&<button className="baef-progress" onClick={()=>{s.selectPost(s.tx!.post.id);push('detail')}}><span><small>진행 중인 함께 주문</small><b>{s.tx.post.restaurant}</b></span><span>›</span></button>}
    <OrderProfileExtras push={push}/>
    <section className="baef-profile-section"><h2>화면 테마</h2><div className="baef-theme-options">{([{id:'light',label:'라이트'},{id:'dark',label:'다크'},{id:'system',label:'기기 설정'}] as const).map(t=><button key={t.id} aria-pressed={flow.themePreference===t.id} onClick={()=>flow.setThemePreference(t.id)}>{t.label}</button>)}</div></section>
    {s.session&&<button className="baef-text-cancel" onClick={()=>void s.logout()}>로그아웃</button>}
  </div></div>
}
const FOOD_LABELS:Record<string,string>={coffee:'커피',burger:'햄버거',sandwich:'샌드위치'}
