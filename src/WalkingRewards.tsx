import { lazy, Suspense, createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useSharedDelivery } from './SharedDelivery'
import { useDeliveryLifecycle } from './DeliveryLifecycle'
import { useGpsWalk } from './useGpsWalk'
import { WALK_MILESTONE_POINTS, WALK_DAILY_LIMIT, orderRewardBreakdown, LEADER_COMPLETION_POINTS, walkDistance, walkProgress } from './walkRewards'
import './walking-rewards.css'
import { relativeDateTime } from './uiFeedback'

const PointsShop=lazy(()=>import('./PointsShop'))
type PointWallet={balance:number;today_earned:number;earned:number;spent:number;rule_version:number}
type WalkReward={post_id:string;user_id:string;meters:number;points:number;awarded_at:string;rule_version?:number;leader_bonus?:number}
function useWalkState(){
  const s=useSharedDelivery(),o=useDeliveryLifecycle(),uid=s.session?.user.id
  const [rewards,setRewards]=useState<WalkReward[]>([])
  const [ready,setReady]=useState(false),[busy]=useState(false),[error,setError]=useState('')
  const [wallet,setWallet]=useState<PointWallet|null>(null)
  const phases=o.states.map(v=>`${v.post_id}:${v.phase}`).join('|')
  useEffect(()=>{
    setRewards([]);setWallet(null);setReady(false);setError('')
  },[uid,s.allowed])
  useEffect(()=>{
    if(!uid||!s.allowed)return
    let alive=true,running=false
    const load=async()=>{
      if(running)return;running=true
      try{
        const [r,w]=await Promise.all([supabase.from('gd_walk_rewards').select('*').eq('user_id',uid).order('awarded_at',{ascending:false}),supabase.rpc('gd_point_wallet')])
        if(r.error)throw r.error
        if(w.error)throw w.error
        if(!w.data?.[0])throw new Error('포인트 정보를 불러오지 못했어요.')
        if(!alive)return
        setWallet(Object.fromEntries(Object.entries(w.data[0]).map(([key,value])=>[key,Number(value)])) as PointWallet);setRewards(r.data as WalkReward[]);setReady(true);setError('')
      }catch(e){if(alive){setReady(false);setError(['PGRST205','PGRST202','42P01'].includes((e as {code?:string}).code??'')?'이동 포인트 저장소 업데이트 후 적립할 수 있어요.':'이동 포인트를 불러오지 못했어요.')}}finally{running=false}
    }
    void load();const timer=setInterval(()=>{if(!document.hidden)void load()},4000)
    window.addEventListener('walking-rewards-refresh',load);window.addEventListener('focus',load)
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('walking-rewards-refresh',load);window.removeEventListener('focus',load)}
  },[uid,s.allowed,phases])
  const gps=useGpsWalk(uid,o.people.filter(p=>p.user_id===uid&&!p.received_at&&['ordered','delivering','arrived'].includes(o.states.find(s=>s.post_id===p.post_id)?.phase??'')&&!(o.states.find(s=>s.post_id===p.post_id)?.nearby_agreed&&o.states.find(s=>s.post_id===p.post_id)?.nearby_requester===uid)).map(p=>p.post_id))
  const totalMeters=rewards.reduce((sum,r)=>sum+r.meters,0),points=wallet?.balance??null
  return {rewards,ready,busy,error,gps,totalMeters,points,wallet,policyReady:(wallet?.rule_version??0)>=2,leaderRewardsReady:(wallet?.rule_version??0)>=3,...walkProgress(totalMeters)}
}
type Walking=ReturnType<typeof useWalkState>
const Context=createContext<Walking|null>(null)
export function WalkingRewardsProvider({children}:{children:ReactNode}){const value=useWalkState();return <Context.Provider value={value}>{children}</Context.Provider>}
function useWalkingRewards(){const value=useContext(Context);if(!value)throw new Error('WalkingRewardsProvider required');return value}
function rewardPolicy(w:Walking){return !w.ready?(w.error?'적립 기준 확인 필요':'적립 기준 확인 중…'):w.policyReady?'완료 20P + 이동 5m당 1P':`누적 1km마다 ${WALK_MILESTONE_POINTS}P`}
function RewardRetry({error}:{error:string}){return error?<div className="baef-reward-retry"><p role="alert" className="baef-error">{error}</p><button className="baef-text-action" onClick={()=>window.dispatchEvent(new Event('walking-rewards-refresh'))}>포인트 다시 불러오기</button></div>:null}
export function LeaderRewardBenefit(){
 const w=useWalkingRewards()
 if(!w.ready||!w.leaderRewardsReady)return null
 return <div className="baef-leader-benefit"><b>리더 완료 혜택 · 최대 {LEADER_COMPLETION_POINTS}P 추가</b><p>회원 2명 이상이 함께하고 전원이 수령을 마치면 적립해요. 완료·이동 포인트와 합산해 하루 최대 {WALK_DAILY_LIMIT}P예요.</p></div>
}
export function WalkingRecordingStatus(){
  const w=useWalkingRewards(),o=useDeliveryLifecycle(),r=w.gps.record
  const state=r?o.states.find(s=>s.post_id===r.post):null
  const person=r?o.people.find(p=>p.post_id===r.post&&p.user_id===o.uid):null
  if(!r||!person||person.received_at||!state||!['ordered','delivering','arrived'].includes(state.phase)||state.nearby_agreed&&state.nearby_requester===o.uid)return null
  const labels={idle:'이동 기록 대기',locating:'GPS 위치 확인 중',recording:'이동 기록 중',paused:'이동 기록 일시 중지',error:'위치 확인 필요',limit:'이번 이동 기록 완료'}
  return <aside className="baef-walk-recording-status" data-status={w.gps.status} aria-label="이동 기록 상태"><span><b>{labels[w.gps.status]} · {walkDistance(r.meters)}</b><small>{w.gps.status==='paused'?'다른 앱에서 돌아왔다면 이어 기록을 눌러 주세요.':w.gps.message}</small></span>{w.gps.status!=='limit'&&<button onClick={()=>w.gps.recording?w.gps.stop('기록을 멈췄어요. 다시 출발하면 이어서 기록해요.'):w.gps.start(r.post)}>{w.gps.recording?'멈추기':w.gps.status==='error'?'다시 시도':'이어 기록'}</button>}</aside>
}
export function WalkingRewardDetails(){
  const w=useWalkingRewards(),o=useDeliveryLifecycle()
  const reward=w.rewards.find(p=>p.post_id===o.selectedId)
  if(!o.post||!o.members.some(m=>m.user_id===o.uid))return null
  const status=w.gps.record?.post===o.selectedId&&w.gps.recording?'GPS 기록 중':reward?`${walkDistance(reward.meters)} 누적${reward.points>0?` · +${reward.points}P`:''}`:o.mine?.received_at?'수령 완료':'GPS 자동 기록'
  return <details className="baef-info-details baef-walk-details"><summary><span>이번 모임 포인트</span><small>{w.error?'불러오기 오류 · 확인':!w.ready?'불러오는 중…':status}</small></summary><div className="baef-info-content"><WalkingRewardPlan/></div></details>
}
export function WalkingRewardReceipt(){return <WalkingRewardPlan receipt/>}
export function WalkingRewardPlan({receipt=false}:{receipt?:boolean}={}){
  const w=useWalkingRewards(),o=useDeliveryLifecycle(),shared=useSharedDelivery()
  const reward=w.rewards.find(p=>p.post_id===o.selectedId)
  const leaderEligible=!!w.leaderRewardsReady&&o.owner&&!shared.isVirtual?.(o.uid!)&&o.members.some(m=>m.user_id!==o.uid&&!shared.isVirtual?.(m.user_id))
  const nearRequester=!!o.state?.nearby_agreed&&o.state.nearby_requester===o.uid
  const mine=w.gps.record?.post===o.selectedId?w.gps.record:null
  const meters=reward?.meters??(nearRequester?0:mine?.meters??0)
  const canRecord=!!o.mine&&!o.mine.received_at&&['ordered','delivering','arrived'].includes(o.state?.phase??'')&&!nearRequester
  const recording=!!mine&&w.gps.recording
  const estimate=orderRewardBreakdown(meters,w.wallet?.today_earned??0,leaderEligible)
  if(!o.post||!o.members.some(m=>m.user_id===o.uid))return null
  return <section className="baef-walk-card"><div className="baef-section-title"><h2>이번 모임 포인트</h2><span>{rewardPolicy(w)}</span></div>
    {reward?<><p>이번 모임에서 <b>{walkDistance(reward.meters)}</b>를 누적했어요.</p>{reward.points>0&&<strong className="baef-walk-earned">이번 거래 적립 · +{reward.points}P</strong>}{(reward.leader_bonus??0)>0&&<p className="baef-leader-breakdown">완료·이동 {reward.points-(reward.leader_bonus??0)}P + 리더 추가 {reward.leader_bonus}P</p>}</>:<>
      <p>자동 기록한 이동 <b aria-live="polite">{walkDistance(meters)}</b>{recording&&' · 기록 중'}</p>
      {nearRequester?<p className="baef-muted">내 근처에서 받기를 요청한 사람은 0m로 기록해요.</p>:<>
        {mine&&mine.meters>=400?<p className="baef-muted">이번 모임의 이동 적립 한도 400m를 기록했어요.</p>:canRecord?<><button className="baef-button secondary" onClick={()=>recording?w.gps.stop('기록을 멈췄어요. 다시 출발하면 이어서 기록해요.'):w.gps.start(o.post!.id)}>{recording?'이동 기록 멈추기':mine?'이어서 이동 기록':'수령하러 출발 · GPS 기록'}</button><p role="status" className="baef-muted">{mine?w.gps.message:'출발 버튼을 누르면 이동거리를 자동으로 기록해요.'}</p></>:!o.mine?.received_at&&<p className="baef-muted">주문이 완료되면 출발 버튼으로 GPS 기록을 시작할 수 있어요.</p>}
        <p className="baef-muted">화면을 열어 둔 동안 기록해요. 위치 오차가 큰 구간은 제외하며, 한 모임에 최대 400m까지 반영해요.</p>
      </>}
      {w.policyReady&&<><p className="baef-muted">전원 수령 완료 후 예상 {estimate.total}P · 하루 최대 {WALK_DAILY_LIMIT}P</p>{leaderEligible&&<p className="baef-leader-breakdown">완료·이동 {estimate.base}P + 리더 추가 {estimate.bonus}P · 일일 한도 반영</p>}{o.owner&&w.leaderRewardsReady&&!leaderEligible&&<p className="baef-muted">리더 추가 포인트는 다른 회원과 함께하는 2인 이상 모임에서 적립돼요.</p>}</>}
    </>}
    <RewardRetry error={w.error}/>
    {receipt&&o.state?.phase==='arrived'&&<div className="baef-receipt-reward">
      {!o.consistencyReady&&<p role="status">수령 확인 기능을 준비하고 있어요. 잠시 후 다시 시도해 주세요.</p>}
      {!o.mine?.received_at&&<p>수령 완료 시 기록한 {walkDistance(meters)}를 함께 저장해요.</p>}
      <button className="baef-button" disabled={!!o.mine?.received_at||o.busy||w.busy||!o.consistencyReady||o.state.pickup_mode==='contactless'&&!o.state.pickup_dropped_at} onClick={()=>{const measured=nearRequester?0:mine?w.gps.stop():0;void o.act('receive',{walk_meters:measured,walk_source:'gps'}).then(ok=>{if(ok)window.dispatchEvent(new Event('walking-rewards-refresh'))})}}>{o.busy?'수령 확인 중…':o.mine?.received_at?'내 수령 확인 완료':o.state.pickup_mode==='contactless'&&!o.state.pickup_dropped_at?'음식 놓기 알림을 기다리고 있어요':'내 음식 수령 완료'}</button>
    </div>}
  </section>
}
export function WalkingRewardWallet(){
  const w=useWalkingRewards(),s=useSharedDelivery(),[shop,setShop]=useState(false)
  if(!s.session)return null
  return <section className="baef-profile-section" aria-busy={!w.ready&&!w.error}><div className="baef-section-title"><h2>나의 포인트</h2><span>{rewardPolicy(w)}</span></div><div className="baef-walk-balance"><strong>{w.points!=null?w.points.toLocaleString('ko-KR'):'—'}<small>P</small></strong><span>누적 이동 {w.ready?walkDistance(w.totalMeters):'—'}</span></div>
    <LeaderRewardBenefit/>
    <button className="baef-button secondary" onClick={()=>setShop(true)}>포인트 상점 →</button>
    {shop&&<Suspense fallback={<p role="status" className="baef-muted">상점 여는 중…</p>}><PointsShop close={()=>setShop(false)}/></Suspense>}
    {w.policyReady&&<><progress className="baef-walk-progress" max={WALK_DAILY_LIMIT} value={Math.min(WALK_DAILY_LIMIT,w.wallet?.today_earned??0)} aria-label="오늘 적립한 포인트"/><p className="baef-muted">오늘 {w.wallet?.today_earned??0} / {WALK_DAILY_LIMIT}P 적립 · 거래 완료 20P + 이동 5m당 1P</p></>}
    {!w.policyReady&&w.ready&&<p className="baef-muted">상점에서 사용 가능한 포인트를 확인해 주세요.</p>}

    <details className="baef-order-details"><summary>누적·적립 내역{w.ready?` ${w.rewards.length}건`:''}</summary>{w.rewards.map(r=><div className="baef-walk-history" key={r.post_id}><span><b>{s.rawPosts.find(p=>p.id===r.post_id)?.restaurant??'완료한 모임'}</b><small>{relativeDateTime(r.awarded_at)} · +{walkDistance(r.meters)}</small>{(r.leader_bonus??0)>0&&<small className="baef-leader-breakdown">완료·이동 {r.points-(r.leader_bonus??0)}P + 리더 추가 {r.leader_bonus}P</small>}</span><strong>{r.points>0?`+${r.points}P`:'거리 누적'}</strong></div>)}{w.ready&&!w.rewards.length&&<p className="baef-muted">모임을 완료하면 적립 내역이 여기에 쌓여요.</p>}</details><RewardRetry error={w.error}/>
  </section>
}
