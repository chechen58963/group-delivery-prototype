import { lazy, Suspense, createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useSharedDelivery } from './SharedDelivery'
import { useDeliveryLifecycle } from './DeliveryLifecycle'
import { useGpsWalk } from './useGpsWalk'
import { WALK_MILESTONE_POINTS, WALK_DAILY_LIMIT, orderRewardEstimate, walkDistance, walkProgress } from './walkRewards'
import './walking-rewards.css'
import { relativeDateTime } from './uiFeedback'

const PointsShop=lazy(()=>import('./PointsShop'))
type PointWallet={balance:number;today_earned:number;earned:number;spent:number;rule_version:number}
type WalkReward={post_id:string;user_id:string;meters:number;points:number;awarded_at:string;rule_version?:number}
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
        if(!alive)return
        setWallet(!w.error&&w.data?.[0]?Object.fromEntries(Object.entries(w.data[0]).map(([key,value])=>[key,Number(value)])) as PointWallet:null);setRewards(r.data as WalkReward[]);setReady(true);setError(value=>value==='이동 포인트 저장소 업데이트 후 적립할 수 있어요.'||value==='이동 포인트를 불러오지 못했어요.'?'':value)
      }catch(e){if(alive){setReady(false);setError(['PGRST205','PGRST202','42P01'].includes((e as {code?:string}).code??'')?'이동 포인트 저장소 업데이트 후 적립할 수 있어요.':'이동 포인트를 불러오지 못했어요.')}}finally{running=false}
    }
    void load();const timer=setInterval(()=>{if(!document.hidden)void load()},4000)
    window.addEventListener('walking-rewards-refresh',load);window.addEventListener('focus',load)
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('walking-rewards-refresh',load);window.removeEventListener('focus',load)}
  },[uid,s.allowed,phases])
  const gps=useGpsWalk(uid,o.people.filter(p=>p.user_id===uid&&!p.received_at&&['ordered','delivering','arrived'].includes(o.states.find(s=>s.post_id===p.post_id)?.phase??'')&&!(o.states.find(s=>s.post_id===p.post_id)?.nearby_agreed&&o.states.find(s=>s.post_id===p.post_id)?.nearby_requester===uid)).map(p=>p.post_id))
  const totalMeters=rewards.reduce((sum,r)=>sum+r.meters,0),points=wallet?.balance??null
  return {rewards,ready,busy,error,gps,totalMeters,points,wallet,policyReady:wallet?.rule_version===2,...walkProgress(totalMeters)}
}
type Walking=ReturnType<typeof useWalkState>
const Context=createContext<Walking|null>(null)
export function WalkingRewardsProvider({children}:{children:ReactNode}){const value=useWalkState();return <Context.Provider value={value}>{children}</Context.Provider>}
function useWalkingRewards(){const value=useContext(Context);if(!value)throw new Error('WalkingRewardsProvider required');return value}
export function WalkingRewardDetails(){
  const w=useWalkingRewards(),o=useDeliveryLifecycle()
  const reward=w.rewards.find(p=>p.post_id===o.selectedId)
  if(!o.post||!o.members.some(m=>m.user_id===o.uid))return null
  const status=w.gps.record?.post===o.selectedId&&w.gps.recording?'GPS 기록 중':reward?`${walkDistance(reward.meters)} 누적${reward.points>0?` · +${reward.points}P`:''}`:o.mine?.received_at?'수령 완료':'GPS 자동 기록'
  return <details className="baef-info-details baef-walk-details"><summary><span>수령 이동 포인트</span><small>{w.error?'불러오기 오류 · 확인':!w.ready?'불러오는 중…':status}</small></summary><div className="baef-info-content"><WalkingRewardPlan/></div></details>
}
export function WalkingRewardReceipt(){return <WalkingRewardPlan receipt/>}
export function WalkingRewardPlan({receipt=false}:{receipt?:boolean}={}){
  const w=useWalkingRewards(),o=useDeliveryLifecycle()
  const reward=w.rewards.find(p=>p.post_id===o.selectedId)
  const nearRequester=!!o.state?.nearby_agreed&&o.state.nearby_requester===o.uid
  const mine=w.gps.record?.post===o.selectedId?w.gps.record:null
  const meters=reward?.meters??(nearRequester?0:mine?.meters??0)
  const canRecord=!!o.mine&&!o.mine.received_at&&['ordered','delivering','arrived'].includes(o.state?.phase??'')&&!nearRequester
  const recording=!!mine&&w.gps.recording
  if(!o.post||!o.members.some(m=>m.user_id===o.uid))return null
  return <section className="baef-walk-card"><div className="baef-section-title"><h2>수령 이동 포인트</h2><span>{w.policyReady?'완료 20P + 이동 5m당 1P':`누적 1km마다 ${WALK_MILESTONE_POINTS}P`}</span></div>
    {reward?<><p>이번 모임에서 <b>{walkDistance(reward.meters)}</b>를 누적했어요.</p>{reward.points>0&&<strong className="baef-walk-earned">이번 거래 적립 · +{reward.points}P</strong>}</>:<>
      <p>자동 기록한 이동 <b aria-live="polite">{walkDistance(meters)}</b>{recording&&' · 기록 중'}</p>
      {nearRequester?<p className="baef-muted">내 근처에서 받기를 요청한 사람은 0m로 기록해요.</p>:<>
        {canRecord?<><button className="baef-button secondary" onClick={()=>recording?w.gps.stop('기록을 멈췄어요. 다시 출발하면 이어서 기록해요.'):w.gps.start(o.post!.id)}>{recording?'이동 기록 멈추기':mine?'이어서 이동 기록':'수령하러 출발 · GPS 기록'}</button><p role="status" className="baef-muted">{mine?w.gps.message:'출발 버튼을 누르면 이동거리를 자동으로 기록해요.'}</p></>:!o.mine?.received_at&&<p className="baef-muted">주문이 완료되면 출발 버튼으로 GPS 기록을 시작할 수 있어요.</p>}
        <p className="baef-muted">화면을 열어 둔 동안 기록해요. 위치 오차가 큰 구간은 제외하며, 한 모임에 최대 400m까지 반영해요.</p>
      </>}
      {w.policyReady&&<p className="baef-muted">전원 수령 완료 후 예상 {orderRewardEstimate(meters,w.wallet?.today_earned??0)}P · 하루 최대 200P</p>}
    </>}
    {w.error&&<p role="alert" className="baef-error">{w.error}</p>}
    {receipt&&o.state?.phase==='arrived'&&<div className="baef-receipt-reward">
      {!o.consistencyReady&&<p role="status">수령 확인 기능을 준비하고 있어요. 잠시 후 다시 시도해 주세요.</p>}
      {!o.mine?.received_at&&<p>수령 완료 시 기록한 {walkDistance(meters)}를 함께 저장해요.</p>}
      <button className="baef-button" disabled={!!o.mine?.received_at||o.busy||w.busy||!w.ready||!o.consistencyReady||o.state.pickup_mode==='contactless'&&!o.state.pickup_dropped_at} onClick={()=>{const measured=nearRequester?0:mine?w.gps.stop():0;void o.act('receive',{walk_meters:measured,walk_source:'gps'}).then(ok=>{if(ok)window.dispatchEvent(new Event('walking-rewards-refresh'))})}}>{o.busy?'수령 확인 중…':o.mine?.received_at?'내 수령 확인 완료':o.state.pickup_mode==='contactless'&&!o.state.pickup_dropped_at?'음식 놓기 알림을 기다리고 있어요':'내 음식 수령 완료'}</button>
    </div>}
  </section>
}
export function WalkingRewardWallet(){
  const w=useWalkingRewards(),s=useSharedDelivery(),[shop,setShop]=useState(false)
  if(!s.session)return null
  return <section className="baef-profile-section" aria-busy={!w.ready&&!w.error}><div className="baef-section-title"><h2>나의 포인트</h2><span>{w.policyReady?'완료 20P + 이동 5m당 1P':`누적 1km마다 ${WALK_MILESTONE_POINTS}P`}</span></div><div className="baef-walk-balance"><strong>{w.points!=null?w.points.toLocaleString('ko-KR'):'—'}<small>P</small></strong><span>누적 이동 {w.ready?walkDistance(w.totalMeters):'—'}</span></div>
    <button className="baef-button secondary" onClick={()=>setShop(true)}>포인트 상점 →</button>
    {shop&&<Suspense fallback={<p role="status" className="baef-muted">상점 여는 중…</p>}><PointsShop close={()=>setShop(false)}/></Suspense>}
    {w.policyReady&&<><progress className="baef-walk-progress" max={WALK_DAILY_LIMIT} value={Math.min(WALK_DAILY_LIMIT,w.wallet?.today_earned??0)} aria-label="오늘 적립한 포인트"/><p className="baef-muted">오늘 {w.wallet?.today_earned??0} / {WALK_DAILY_LIMIT}P 적립 · 거래 완료 20P + 이동 5m당 1P</p></>}
    {!w.policyReady&&w.ready&&<p className="baef-muted">상점에서 사용 가능한 포인트를 확인해 주세요.</p>}

    <details className="baef-order-details"><summary>누적·적립 내역{w.ready?` ${w.rewards.length}건`:''}</summary>{w.rewards.map(r=><div className="baef-walk-history" key={r.post_id}><span><b>{s.rawPosts.find(p=>p.id===r.post_id)?.restaurant??'완료한 모임'}</b><small>{relativeDateTime(r.awarded_at)} · +{walkDistance(r.meters)}</small></span><strong>{r.points>0?`+${r.points}P`:'거리 누적'}</strong></div>)}{w.ready&&!w.rewards.length&&<p className="baef-muted">모임을 완료하면 적립 내역이 여기에 쌓여요.</p>}</details>{w.error&&<p role="alert" className="baef-error">{w.error}</p>}
  </section>
}
