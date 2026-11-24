import ActionFeedback from './ActionFeedback'
import {WalkingRecordingStatus} from './WalkingRewards'
import CancelOrderControl from './CancelOrderControl'
import {timingSummary,plannedFromNote,timeLabel} from './orderTiming'
import { useEffect, useRef, useState } from 'react'
import { usePreferences } from './AppPreferences'
import { SharedApplicants, SharedChat, useSharedDelivery } from './SharedDelivery'
import { useMenuDiscovery, money } from './MenuDiscoveryContext'
import { StoreSheet, BasketEditor, MenuAlerts, SmallIcon } from './MenuDiscovery'
import type { Screen } from './navigationTypes'
import './baef.css'
import { useDeliveryLifecycle } from './DeliveryLifecycle'
import { OrderWorkspace, ApplicantReputation, RoomTimeEditor, OrderProgress, OrderChatControls, OrderMenu, OrderPayment, OrderDelivery, OrderReceipt, OrderComplete, OrderRating, OrderProfileExtras, OrderParticipants, MeetingTools } from './OrderScreens'
import './ui-polish.css'
import './readability.css'
import './order-entry.css'
import { orderNextStep } from './orderGuidance'
import { orderScreens, useAppNavigation } from './appNavigation'
import './consistency.css'
import './feedback-improvements.css'
import RecruitmentProgress from './RecruitmentProgress'
import { LiveExplore, LiveOrders, LiveStorePicker, LiveMenuPreferences, liveStorePhoto } from './LiveDiscovery'
import Icon, { type IconName } from './ui/Icon'
import StoreBrand from './StoreBrand'
import {previewMembers,needsAttention} from './userFlow'
import {Modal} from './ui/Modal'
import AuthDialog from './AuthDialog'
import { PersonProfile } from './OrderScreens'

function canOpenOrderScreen(screen:Screen,post:{owner_id:string}|undefined,member:{status:string}|undefined,uid:string|undefined){
  if(screen==='detail')return true
  if(screen==='applicants')return !!uid&&post?.owner_id===uid
  if(screen==='order'||screen==='payment')return member?.status==='accepted'||member?.status==='withdrawn'
  return member?.status==='accepted'
}

export default function BaefShell(){
  const s=useSharedDelivery(),d=useMenuDiscovery(),preferences=usePreferences()
  const navigation=useAppNavigation(),[alerts,setAlerts]=useState(false)
  useEffect(()=>{document.title='배프 · 가볍게 함께 주문해요'},[])
  useEffect(()=>{document.documentElement.dataset.bvTheme=preferences.isDark?'dark':'light';return()=>{delete document.documentElement.dataset.bvTheme}},[preferences.isDark])
  const [chatMeeting,setChatMeeting]=useState(false)
  const screen=navigation.route.screen
  const previousUser=useRef(s.session?.user.id)
  useEffect(()=>{
    const uid=s.session?.user.id
    if(previousUser.current&&previousUser.current!==uid){navigation.restore.current=null;navigation.replace('main');setAlerts(false)}
    previousUser.current=uid
  },[s.session?.user.id])
  useEffect(()=>{
    if(!orderScreens.has(screen)){navigation.restore.current=null;return}
    if(s.initializing||!s.ready||(!s.session&&screen!=='detail'))return
    const wanted=navigation.restore.current
    if(wanted){
      const post=s.rawPosts.find(p=>p.id===wanted)
      if(post){
        const member=s.members.find(m=>m.post_id===wanted&&m.user_id===s.session?.user.id)
        s.selectPost(s.numberFor(wanted));navigation.restore.current=null
        if(!canOpenOrderScreen(screen,post,member,s.session?.user.id)){navigation.replace('detail',wanted);s.setNotice('참가 상태를 확인한 뒤 주문 진행 화면을 열어 주세요.')}
      }else{navigation.restore.current=null;navigation.replace('list');s.setNotice('이 모집을 찾을 수 없어요. 다른 모집을 확인해 주세요.')}
      return
    }
    if(!s.selectedRaw&&!navigation.route.order&&s.activeTx){s.selectPost(s.activeTx.post.id);navigation.replace(screen,s.activeTx.post.sharedId??null);return}
    const member=s.members.find(m=>m.post_id===s.selectedRaw?.id&&m.user_id===s.session?.user.id)
    if(s.selectedRaw&&!canOpenOrderScreen(screen,s.selectedRaw,member,s.session?.user.id)){navigation.replace('detail',s.selectedRaw.id);s.setNotice('참가 상태를 확인한 뒤 주문 진행 화면을 열어 주세요.');return}
    if(orderScreens.has(screen)&&s.selectedRaw&&navigation.route.order!==s.selectedRaw.id)navigation.replace(screen,s.selectedRaw.id)
  },[navigation.route.revision,s.selectedRaw?.id,s.ready,s.rawPosts,s.members,s.initializing,s.session?.user.id])
  const [height,setHeight]=useState<number|null>(null)
  useEffect(()=>{
    const viewport=window.visualViewport;if(!viewport)return
    const update=()=>setHeight(viewport.height<window.innerHeight-100?viewport.height:null)
    viewport.addEventListener('resize',update);return()=>viewport.removeEventListener('resize',update)
  },[])
  const push=(requested:Screen)=>{
    const next:Screen=['menu','payment','delivery','receipt','complete'].includes(requested)?'order':requested
    if(next==='chat'){
      if(!s.session){s.setLoginOpen(true);return}
      if(s.tx?.application==='pending'){navigation.push('detail',s.tx.post.sharedId??null);return}
    }
    navigation.push(next,orderScreens.has(next)?s.selectedRaw?.id??s.tx?.post.sharedId??null:null)
  }
  const pop=navigation.pop
  const lifecycle=useDeliveryLifecycle()
  const important=s.notifications.filter(n=>!n.read&&needsAttention(n.target,n.text,{uid:s.session?.user.id,post:s.rawPosts.find(p=>p.id===n.sharedPostId),members:s.members.filter(m=>m.post_id===n.sharedPostId),state:lifecycle.states.find(p=>p.post_id===n.sharedPostId),people:lifecycle.people.filter(p=>p.post_id===n.sharedPostId)})).sort((a,b)=>b.time-a.time)
  const [dismissed,setDismissed]=useState<number|null>(null)
  const attention=orderScreens.has(screen)?important.find(n=>n.id!==dismissed&&n.sharedPostId===s.selectedRaw?.id):undefined
  const count=d.alerts.filter(n=>!n.read_at).length+s.notifications.filter(n=>!n.read).length
  const ongoingChat=screen==='chat'&&s.chatReadable
  const requestedOrder=navigation.restore.current??navigation.route.order
  const orderPage=orderScreens.has(screen)
  const selectedMember=s.members.find(m=>m.post_id===s.selectedRaw?.id&&m.user_id===s.session?.user.id)
  const waitingForOrder=orderPage&&(s.initializing||!!s.session&&(!s.ready||!!requestedOrder&&s.selectedRaw?.id!==requestedOrder))
  const orderAccessBlocked=orderPage&&!!s.session&&!!s.selectedRaw&&!canOpenOrderScreen(screen,s.selectedRaw,selectedMember,s.session?.user.id)
  const orderGate=orderPage&&((!s.session&&screen!=='detail')||waitingForOrder||orderAccessBlocked)
  const mainNav=screen==='main'||screen==='list'||screen==='category'?'main':screen==='profile'?'profile':screen==='chat'?'chat':'orders'
  const nav:[Screen,string,IconName][]=[['main','둘러보기','explore'],['orders','내 주문','bag'],['chat','채팅','chat'],['profile','내 정보','person']]
  const navigate=(next:Screen)=>{
    if(next==='chat'&&s.activeTx){s.selectPost(s.activeTx.post.id);push('chat')}
    else push(next)
  }
  const showNav=['main','list','category','orders','profile'].includes(screen)
  return <div className={`baef-app baef-live bv-app ${preferences.isDark?'app-dark':''}`}>
    <a className="bv-skip" href="#baef-content">본문으로 건너뛰기</a>
    <aside className="bv-sidebar"><button className="bv-wordmark" aria-label="배프 홈" onClick={()=>push('main')}>배프<span>.</span></button><p className="bv-brand-note">가볍게 함께 주문해요</p><nav aria-label="주 메뉴">{nav.map(([next,label,icon])=><button key={next} className={mainNav===next?'active':''} aria-current={mainNav===next?'page':undefined} onClick={()=>navigate(next)}><Icon name={icon}/>{label}{next==='orders'&&s.active&&<i/>}</button>)}</nav><button className="bv-button secondary" onClick={()=>push('create')}><Icon name="plus" size={19}/>새 모집 시작</button><div className="bv-sidebar-bottom"><p>조금 걷고, 함께 아끼는<br/>우리 동네 주문 습관.</p><button className="bv-original-link" onClick={()=>push('profile')}><Icon name="walk" size={19}/>포인트·내 정보<Icon name="arrow" size={15}/></button></div></aside>
    <div className={`bv-main live-main ${ongoingChat?'chat-mode':''} live-screen-${screen}`} style={height?{height:`${height}px`}:undefined}>
    {!ongoingChat&&<header className={`bv-app-header live-app-header ${!showNav?'live-inner-header':''}`}><button className="bv-wordmark bv-mobile-logo" onClick={()=>push('main')} aria-label="배프 홈">배프<span>.</span></button><span className="bv-desktop-greeting">{s.me?.nickname?`${s.me.nickname}님, 오늘은 뭘 드실래요?`:'가까운 배프와 가볍게 함께해요'}</span><div className="live-header-actions"><button className="live-account-control" disabled={s.initializing} onClick={()=>s.session?push('profile'):s.setLoginOpen(true)}>{s.initializing?'확인 중…':s.session?s.me?.nickname??'내 계정':'로그인'}</button><button className="bv-icon bv-notification-button" aria-label={`알림 ${count}개`} onClick={()=>setAlerts(true)}><Icon name="bell"/>{count>0&&<i>{Math.min(count,99)}</i>}</button>{s.session&&<button className="bv-header-avatar" aria-label="내 정보 보기" onClick={()=>push('profile')}><span className="bv-avatar small">{s.me?.nickname.slice(0,1)??'배'}</span></button>}</div></header>}
    {s.error&&!s.loginOpen&&<div className="baef-banner error" role="alert"><span>{s.error}</span><button aria-label="오류 안내 닫기" onClick={()=>s.setError('')}>×</button></div>}
    <ActionFeedback message={d.toast||s.notice} close={()=>{d.setToast('');s.setNotice('')}}/>
    <WalkingRecordingStatus/>
    <main id="baef-content" className={`baef-screen bv-content live-content ${showNav?'has-bottom-nav':''}`}>
    {attention&&!alerts&&!s.loginOpen&&<aside className="baef-inline-order-notice" aria-label="확인할 주문 알림"><Icon name="bell" size={21}/><button onClick={()=>{s.readNotification(attention.id);s.selectPost(attention.sharedPostId?s.numberFor(attention.sharedPostId):attention.postId);push(attention.target as Screen)}}><b>{attention.restaurant}</b><small>{attention.text}</small><span className="baef-alert-link">내용 확인하기 →</span></button><button aria-label="화면 안내 접기" onClick={()=>setDismissed(attention.id)}><Icon name="close" size={16}/></button></aside>}
      {orderGate?<div className="baef-empty">{s.initializing||waitingForOrder||orderAccessBlocked?<p role="status">모임을 불러오는 중이에요.</p>:<><Icon name="bag" size={34}/><h1>로그인하고 모임을 확인해 주세요</h1><p>참가한 모임의 주문 진행과 대화를 이어볼 수 있어요.</p><button className="baef-button" onClick={()=>s.setLoginOpen(true)}>로그인</button><button className="baef-button secondary" onClick={()=>push('main')}>모집 둘러보기</button></>}</div>:<>
      {['menu','payment','delivery','receipt','complete','rating'].includes(screen)&&<OrderProgress push={push}/>}
      {(screen==='main'||screen==='category'||screen==='list')&&<LiveExplore push={push} compact={screen==='list'}/>}
      {screen==='orders'&&<LiveOrders push={push}/>}
      {screen==='create'&&<LiveStorePicker pop={pop} push={push}/>}
      {screen==='detail'&&<GroupDetail pop={pop} push={push}/>}
      {screen==='applicants'&&<SharedApplicants pop={pop} push={push} renderApplicant={userId=><ApplicantReputation userId={userId}/>}/>}
      {screen==='chat'&&(ongoingChat?<SharedChat pop={pop} push={push} workflowControls={<><button className="chat-tool ux-chat-meeting" onClick={()=>setChatMeeting(true)}>{lifecycle.state?.meeting||s.tx?.meeting||'수령 장소 정하기'} · {timingSummary(lifecycle.state)}</button><OrderChatControls push={push}/></>} orderPanel={s.chatEnded?<><p><b>수령 장소</b> · {s.tx?.meeting}</p><OrderParticipants/></>:<><BasketEditor postId={s.tx!.post.sharedId!}/><MeetingTools/><OrderParticipants/></>}/>:<div className="baef-empty"><Icon name="chat" size={36}/><h1>함께 주문하면 대화가 시작돼요</h1><p>열린 모집에 참가하거나<br/>먼저 배프를 모아보세요.</p><button className="baef-button" onClick={()=>push('main')}>함께 주문 둘러보기</button></div>)}
      {screen==='order'&&<OrderWorkspace pop={pop} push={push}/>}
      {screen==='menu'&&<OrderMenu pop={pop} push={push}/>}
      {screen==='payment'&&<OrderPayment pop={pop} push={push}/>}
      {screen==='delivery'&&<OrderDelivery pop={pop} push={push}/>}
      {screen==='receipt'&&<OrderReceipt pop={pop} push={push}/>}
      {screen==='complete'&&<OrderComplete pop={pop} push={push}/>}
      {screen==='rating'&&<OrderRating pop={pop}/>}
      {screen==='profile'&&<AccountScreen push={push}/>}
      </>}
    </main>
    {showNav&&<nav className="bv-bottom-nav" aria-label="하단 메뉴">{nav.map(([next,label,icon])=><button key={next} className={mainNav===next?'active':''} aria-current={mainNav===next?'page':undefined} onClick={()=>navigate(next)}><Icon name={icon} size={23}/><span>{label}</span>{next==='orders'&&s.active&&<i/>}</button>)}</nav>}
    {d.matchingStore&&d.catalog.find(c=>c.store_name===d.matchingStore)&&<StoreSheet intent="create" key={d.matchingStore} store={d.catalog.find(c=>c.store_name===d.matchingStore)!} close={d.closeMatchingStore} push={push}/>}
    {alerts&&<MenuAlerts close={()=>setAlerts(false)} push={push}/>}
    {chatMeeting&&<Modal title="수령 장소와 진행 안내" close={()=>setChatMeeting(false)}><MeetingTools/></Modal>}{s.loginOpen&&<AuthDialog/>}
  </div></div>
}

function GroupDetail({pop,push}:{pop:()=>void;push:(s:Screen)=>void}){
  const s=useSharedDelivery(),d=useMenuDiscovery(),p=s.selectedRaw
  const order=useDeliveryLifecycle()
  const [sheet,setSheet]=useState(false),[profile,setProfile]=useState(false)
  if(!p)return <div className="baef-page"><button className="baef-back" onClick={pop}><SmallIcon name="back"/>뒤로</button><div className="baef-empty"><h2>모집을 찾을 수 없어요</h2><p>마감되었거나 더 이상 참여할 수 없는 모집이에요.</p></div></div>
  const mine=s.members.find(m=>m.post_id===p.id&&m.user_id===s.session?.user.id)
  const owner=p.owner_id===s.session?.user.id
  const people=s.members.filter(m=>m.post_id===p.id&&m.status==='accepted')
  const orders=d.baskets.filter(b=>b.post_id===p.id&&people.some(m=>m.user_id===b.user_id))
  const total=orders.reduce((n,b)=>n+b.total,0)
  const ended=['cancelled','completed'].includes(p.status)
  const open=p.status==='open'&&new Date(p.deadline).getTime()>Date.now()
  const ownSelection=d.catalog.find(c=>c.store_name===p.restaurant)
  const state=order.states.find(v=>v.post_id===p.id)
  const next=mine?.active?orderNextStep({role:owner?'leader':'participant',application:mine.status,phase:state?.phase,count:people.length,virtualLeader:s.isVirtual?.(p.owner_id)||p.public_virtual_leader}):null
  // The menu sheet is loaded through the same component used by discovery.
  return <div className="baef-scroll"><div className="baef-page"><button className="baef-back" onClick={pop}><SmallIcon name="back"/>뒤로</button><CancelOrderControl postId={p.id} onCancelled={()=>push('orders')}/><div className="baef-group-head"><span className="baef-tag">{ended?'종료':open?'모집 중':'모집 마감'}</span><span>{p.member_count}/{p.max_members}명</span></div><div className="live-detail-hero">{liveStorePhoto(p.restaurant)&&<img src={liveStorePhoto(p.restaurant)!} alt={`${p.restaurant} 메뉴`}/>}<div><StoreBrand name={p.restaurant}/><span className="bv-eyebrow">{p.category} · 함께 주문</span><h1 className="baef-detail-title">{p.restaurant}</h1><button className="live-leader-link" onClick={()=>s.session?setProfile(true):s.setLoginOpen(true)}><span className="bv-avatar small">{s.nickname(p.owner_id).slice(0,1)}</span><span>{s.nickname(p.owner_id)} · 리더<small>{order.reputation(p.owner_id)?.rating!=null?`★ ${order.reputation(p.owner_id)!.rating}`:'아직 별점 없음'} · 거래 {order.reputation(p.owner_id)?.trades??0}회</small></span><Icon name="chevron" size={17}/></button></div></div>
    {!mine?.active&&<div className="live-detail-benefit"><Icon name="leaf" size={24}/><span><b>함께 주문하면 배달비 약 {money(p.delivery_fee-Math.ceil(p.delivery_fee/Math.max(2,Math.min(p.max_members,p.member_count+1))))} 절약</b><small>혼자 부담 {money(p.delivery_fee)} → 함께 부담 약 {money(Math.ceil(p.delivery_fee/Math.max(2,Math.min(p.max_members,p.member_count+1))))}</small></span></div>}
    {profile&&<PersonProfile userId={p.owner_id} close={()=>setProfile(false)}/>}
    {mine?.status==='pending'&&mine.active&&<section className="baef-current-order"><h2>리더 수락 대기</h2><p>수락되면 알림으로 알려드려요. 기다리는 동안 다른 모집에 중복 신청할 수 없어요.</p><button className="baef-button secondary" disabled={s.busy} onClick={()=>void s.act('withdraw',p.id)}>신청 취소</button></section>}
    {next&&mine?.status!=='pending'&&<section className="baef-current-order"><span className="baef-eyebrow">{owner?'리더 · 다음 할 일':'참가자 · 다음 할 일'}</span><h2>{next.title}</h2><p>{next.description}</p><button className="baef-button" onClick={()=>push(next.route)}>{next.action}<span aria-hidden="true">→</span></button>{mine?.status==='accepted'&&!ended&&<div className="baef-order-links"><button onClick={()=>push('chat')}>채팅방 열기</button>{owner&&next.route!=='applicants'&&<button onClick={()=>push('applicants')}>신청자 관리</button>}</div>}</section>}
    {owner&&mine?.active&&<RoomTimeEditor/>}
    {open&&<RecruitmentProgress postId={p.id} goal={p.min_order} members={p.member_count} maxMembers={p.max_members}/>}<dl className="baef-detail-facts"><dt>수령 제안 장소</dt><dd>{p.meeting}</dd><dt>주문 예정</dt><dd>{timeLabel(state?.planned_order_at??plannedFromNote(p.note))||'모집 후 함께 주문해요'}</dd><dt>모집 마감</dt><dd>{new Date(p.deadline).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}</dd><dt>목표 주문금액</dt><dd>{money(p.min_order)}</dd><dt>배달비</dt><dd>총 {money(p.delivery_fee)} · {Math.ceil(p.delivery_fee/previewMembers(p.member_count,p.max_members,mine?.status==='accepted')).toLocaleString()}원씩 예상</dd></dl>
    {mine?.status==='accepted'&&<section className="baef-goal"><div><span>현재 모인 메뉴금액</span><b>{money(total)}</b></div><progress max={Math.max(1,p.min_order)} value={Math.min(total,p.min_order)} aria-label="주문 목표금액 달성도"/><p>{total>=p.min_order?'목표금액을 채웠어요. 주문 내용을 확인해 주세요.':`${money(p.min_order-total)} 더 모이면 목표금액을 채워요.`}</p></section>}
    {mine?.active&&<BasketEditor postId={p.id}/>}
    {people.length>0&&<OrderParticipants/>}
    {mine?.status==='accepted'&&!mine.active&&<button className="baef-button secondary" onClick={()=>push(state?.phase==='completed'?'complete':state?.phase==='cancelled'?'payment':'menu')}>주문 진행 보기</button>}
    {mine?.status==='withdrawn'&&<button className="baef-button secondary" onClick={()=>push('payment')}>취소·환불 현황</button>}
    {!ended&&!mine?.active&&open&&<button className="baef-button live-detail-join" disabled={s.busy||s.active} onClick={()=>{if(!s.session){s.setLoginOpen(true);return}if(ownSelection)setSheet(true);else void s.act('apply',p.id)}}>{s.active?'다른 주문에 참여 중이에요':'메뉴 고르고 참가 신청'}</button>}
    {ended&&<p className="baef-muted">종료된 주문 모임이에요.</p>}
    {sheet&&ownSelection&&<JoinSheet store={ownSelection} targetPostId={p.id} close={()=>setSheet(false)} push={push}/>}
  </div></div>
}
import { StoreSheet as JoinSheet } from './MenuDiscovery'

function AccountScreen({push}:{push:(s:Screen)=>void}){
  const s=useSharedDelivery(),d=useMenuDiscovery(),preferences=usePreferences()
  const active=s.activeTx
  const [preferencesOpen,setPreferencesOpen]=useState(false),[profile,setProfile]=useState(false)
  return <div className="baef-scroll"><div className="baef-page live-profile-page"><h1 className="baef-page-title">내 정보</h1><section className="baef-account"><span className="baef-large-avatar">{s.me?.nickname.slice(0,1)??'배'}</span><h2>{s.me?.nickname??'배프에 오신 걸 환영해요'}</h2><p className="baef-muted">{s.session?'함께 주문할 메뉴를 골라보세요.':'로그인하면 메뉴 알림과 함께 주문을 이용할 수 있어요.'}</p>{!s.session&&<button className="baef-button" onClick={()=>s.setLoginOpen(true)}>로그인</button>}</section>
    {s.session&&!s.allowed&&s.ready&&<p className="baef-error">메일의 인증 링크를 먼저 확인해 주세요. 인증을 마쳤는데 이용이 안 되면 다시 로그인해 주세요.</p>}
    {d.intent&&<section className="baef-profile-section"><h2>기다리는 메뉴</h2><p>{d.intent.menus.map(k=>FOOD_LABELS[k]??k).join(' · ')}</p><button className="baef-text-action" onClick={()=>setPreferencesOpen(true)}>선택 수정하기 →</button></section>}
    {s.active&&active&&<button className="baef-progress" onClick={()=>{s.selectPost(active.post.id);push('detail')}}><span><small>진행 중인 함께 주문</small><b>{active.post.restaurant}</b></span><span>›</span></button>}
    {s.session&&<button className="live-profile-reviews" onClick={()=>setProfile(true)}><Icon name="star" size={21}/><span>내 평판과 받은 후기</span><Icon name="chevron" size={18}/></button>}{profile&&s.session&&<PersonProfile userId={s.session?.user.id} close={()=>setProfile(false)}/>}<button className="live-profile-reviews" onClick={()=>setPreferencesOpen(true)}><Icon name="bell" size={21}/><span>관심 메뉴 알림 설정</span><Icon name="chevron" size={18}/></button>{preferencesOpen&&<LiveMenuPreferences close={()=>setPreferencesOpen(false)}/>}<OrderProfileExtras push={push}/>
    <section className="baef-profile-section"><h2>화면 테마</h2><div className="baef-theme-options">{([{id:'light',label:'라이트'},{id:'dark',label:'다크'},{id:'system',label:'기기 설정'}] as const).map(t=><button key={t.id} aria-pressed={preferences.themePreference===t.id} onClick={()=>preferences.setThemePreference(t.id)}>{t.label}</button>)}</div></section>
    {s.session&&<button className="baef-text-cancel" onClick={()=>void s.logout()}>로그아웃</button>}
  </div></div>
}
const FOOD_LABELS:Record<string,string>={coffee:'커피',burger:'햄버거',sandwich:'샌드위치'}
