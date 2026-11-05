import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useSharedDelivery } from './SharedDelivery'
import { useDeliveryLifecycle, distanceM } from './DeliveryLifecycle'
import { useMenuDiscovery } from './MenuDiscoveryContext'
import { WALK_MILESTONE_METERS, WALK_MILESTONE_POINTS, WALK_ORDER_MAX_METERS, walkDistance, walkEstimate, walkProgress } from './walkRewards'
import './walking-rewards.css'
import { ButtonHint, SaveFeedback, relativeDateTime, useSaveFeedback } from './uiFeedback'

type WalkPlan={post_id:string;user_id:string;meters:number;source:'map'|'manual'}
type WalkReward={post_id:string;user_id:string;meters:number;points:number;awarded_at:string}
function useWalkState(){
  const s=useSharedDelivery(),o=useDeliveryLifecycle(),uid=s.session?.user.id
  const [plans,setPlans]=useState<WalkPlan[]>([]),[rewards,setRewards]=useState<WalkReward[]>([])
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const lock=useRef(false),current=useRef(uid);current.current=uid
  const phases=o.states.map(v=>`${v.post_id}:${v.phase}`).join('|')
  useEffect(()=>{
    setPlans([]);setRewards([]);setReady(false);setError('')
  },[uid,s.allowed])
  useEffect(()=>{
    if(!uid||!s.allowed)return
    let alive=true,running=false
    const load=async()=>{
      if(running)return;running=true
      try{
        const [p,r]=await Promise.all([supabase.from('gd_walk_plans').select('*').eq('user_id',uid),supabase.from('gd_walk_rewards').select('*').eq('user_id',uid).order('awarded_at',{ascending:false})])
        if(p.error||r.error)throw p.error??r.error
        if(!alive)return
        setPlans(p.data as WalkPlan[]);setRewards(r.data as WalkReward[]);setReady(true);setError(value=>value==='이동 포인트 저장소 업데이트 후 적립할 수 있어요.'||value==='이동 포인트를 불러오지 못했어요.'?'':value)
      }catch(e){if(alive){setReady(false);setError(['PGRST205','PGRST202','42P01'].includes((e as {code?:string}).code??'')?'이동 포인트 저장소 업데이트 후 적립할 수 있어요.':'이동 포인트를 불러오지 못했어요.')}}finally{running=false}
    }
    void load();const timer=setInterval(()=>{if(!document.hidden)void load()},4000)
    window.addEventListener('walking-rewards-refresh',load);window.addEventListener('focus',load)
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('walking-rewards-refresh',load);window.removeEventListener('focus',load)}
  },[uid,s.allowed,phases])
  const save=async(post:string,meters:number,source:'map'|'manual')=>{
    if(lock.current||!uid)return false
    if(!ready){setError('이동 포인트 저장소 업데이트 후 적립할 수 있어요.');return false}
    lock.current=true;setBusy(true);setError('')
    try{
      const r=await supabase.rpc('gd_set_walk_plan',{p_post:post,p_meters:meters,p_source:source});if(r.error)throw r.error
      if(current.current!==uid)return false
      setPlans(values=>[...values.filter(v=>v.post_id!==post),{post_id:post,user_id:uid,meters,source}]);return true
    }catch(e){if(current.current===uid)setError((e as {message?:string}).message??'예상 거리를 저장하지 못했어요.');return false}finally{lock.current=false;setBusy(false)}
  }
  const totalMeters=rewards.reduce((sum,r)=>sum+r.meters,0),points=rewards.reduce((sum,r)=>sum+r.points,0)
  return {plans,rewards,ready,busy,error,save,totalMeters,points,...walkProgress(totalMeters)}
}
type Walking=ReturnType<typeof useWalkState>
const Context=createContext<Walking|null>(null)
export function WalkingRewardsProvider({children}:{children:ReactNode}){const value=useWalkState();return <Context.Provider value={value}>{children}</Context.Provider>}
function useWalkingRewards(){const value=useContext(Context);if(!value)throw new Error('WalkingRewardsProvider required');return value}
export function WalkingRewardPlan(){
  const w=useWalkingRewards(),o=useDeliveryLifecycle(),d=useMenuDiscovery(),feedback=useSaveFeedback()
  const plan=w.plans.find(p=>p.post_id===o.selectedId),reward=w.rewards.find(p=>p.post_id===o.selectedId)
  const [manual,setManual]=useState(''),[useManual,setUseManual]=useState(false)
  const nearRequester=!!o.state?.nearby_agreed&&o.state.nearby_requester===o.uid
  const pickup=o.state?.meeting_lat!=null&&o.state.meeting_lng!=null?{lat:o.state.meeting_lat,lng:o.state.meeting_lng}:!o.state?.nearby_agreed&&(!o.state||o.state.meeting===o.post?.meeting)&&o.post?.pickup_lat!=null&&o.post.pickup_lng!=null?{lat:o.post.pickup_lat,lng:o.post.pickup_lng}:null
  const mapped=pickup&&d.matchLocation?walkEstimate(distanceM(d.matchLocation,pickup)):null
  const manualNumber=Number(manual),validManual=manual.trim()!==''&&Number.isInteger(manualNumber)&&manualNumber>=0&&manualNumber<=WALK_ORDER_MAX_METERS
  const proposed=nearRequester?0:!useManual&&mapped!=null?mapped:validManual?manualNumber:null
  const editable=!!o.mine&&!o.mine.received_at&&o.state?.phase!=='completed'&&o.state?.phase!=='cancelled'
  useEffect(()=>{setManual(plan?String(plan.meters):'');setUseManual(plan?.source==='manual');feedback.reset()},[o.selectedId])
  useEffect(()=>{if(plan&&feedback.status!=='dirty'){setManual(String(plan.meters));setUseManual(plan.source==='manual')}},[plan?.meters,plan?.source])
  if(!o.post||!o.members.some(m=>m.user_id===o.uid))return null
  const dirty=feedback.status==='dirty'||!!plan&&proposed!=null&&proposed!==plan.meters
  const displayed=reward?.meters??(nearRequester?0:dirty?proposed:plan?.meters??proposed)
  const projected=w.totalMeters+(reward?0:displayed??0)
  const after=walkProgress(projected),bonus=after.earned-walkProgress(w.totalMeters).earned
  const reason=!w.ready?w.error?'':'포인트를 불러오는 중이에요.':proposed==null?'편도 예상 이동거리를 0~400m로 입력해 주세요.':''
  return <section className="baef-walk-card"><div className="baef-section-title"><h2>수령 이동 포인트</h2><span>누적 1km마다 {WALK_MILESTONE_POINTS}P</span></div>
    {reward?<><p>이번 모임에서 <b>{walkDistance(reward.meters)}</b>를 누적했어요.</p>{reward.points>0&&<strong className="baef-walk-earned">1km 달성 · +{reward.points}P</strong>}</>:<>
      <p>이번 편도 예상 이동 <b>{displayed==null?'미등록':walkDistance(displayed)}</b>{plan&&!dirty&&<span className="baef-walk-saved"> · 등록됨</span>}</p>
      {w.ready&&displayed!=null&&<p className="baef-muted">완료 후 누적 {walkDistance(projected)}{bonus>0?` · ${bonus}P 적립`:''}<br/>다음 {WALK_MILESTONE_POINTS}P까지 {walkDistance(after.remaining)}</p>}
      {editable&&<details className="baef-walk-edit" open={!plan}><summary>이번 모임의 예상 거리 등록</summary>{nearRequester?<p className="baef-muted">내 근처에서 받기를 요청한 사람은 0m로 기록해요.</p>:<>
        {mapped!=null&&!useManual?<p className="baef-muted">출발점과 수령점의 직선거리 기준 · 한 모임에 최대 {WALK_ORDER_MAX_METERS}m</p>:<label className="baef-order-field">편도 예상 이동거리 (m)<input type="number" inputMode="numeric" min="0" max={WALK_ORDER_MAX_METERS} step="1" value={manual} onChange={e=>{setManual(e.target.value);feedback.change()}} placeholder="예: 350"/></label>}
        {mapped!=null&&<button className="baef-text-action" onClick={()=>{setUseManual(v=>!v);feedback.change()}}>{useManual?'지도상의 예상 거리 사용':'예상 거리 직접 입력'}</button>}
      </>}
        <button className="baef-button secondary" disabled={!w.ready||w.busy||proposed==null} aria-describedby={reason?'walk-plan-reason':undefined} onClick={()=>{if(proposed==null)return;const version=feedback.begin();void w.save(o.post!.id,proposed,nearRequester||useManual||mapped==null?'manual':'map').then(ok=>{if(ok)feedback.saved(version)})}}>{w.busy?'저장 중…':'이번 예상 거리 저장'}</button><ButtonHint id="walk-plan-reason" reason={reason}/><SaveFeedback status={dirty?'dirty':feedback.status}/>
      </details>}
      {!editable&&o.mine?.received_at&&<p className="baef-muted">{plan?o.state?.phase==='completed'?'누적 내역을 불러오는 중이에요.':'모두 수령하면 누적 거리에 반영돼요.':'수령 전에 예상 거리를 등록하지 않은 모임이에요.'}</p>}
    </>}
    {w.error&&<p role="alert" className="baef-error">{w.error}</p>}
  </section>
}
export function WalkingRewardWallet(){
  const w=useWalkingRewards(),s=useSharedDelivery()
  if(!s.session)return null
  return <section className="baef-profile-section" aria-busy={!w.ready&&!w.error}><div className="baef-section-title"><h2>나의 이동 포인트</h2><span>누적 1km마다 {WALK_MILESTONE_POINTS}P</span></div><div className="baef-walk-balance"><strong>{w.ready?w.points.toLocaleString('ko-KR'):'—'}<small>P</small></strong><span>누적 이동 {w.ready?walkDistance(w.totalMeters):'—'}</span></div>
    {w.ready&&<><progress className="baef-walk-progress" max={WALK_MILESTONE_METERS} value={w.progress} aria-label="다음 이동 보상까지 누적 거리"/><p className="baef-muted">다음 {WALK_MILESTONE_POINTS}P까지 <b>{walkDistance(w.remaining)}</b> · {w.progress}/{WALK_MILESTONE_METERS}m</p></>}
    <details className="baef-order-details"><summary>누적·적립 내역{w.ready?` ${w.rewards.length}건`:''}</summary>{w.rewards.map(r=><div className="baef-walk-history" key={r.post_id}><span><b>{s.rawPosts.find(p=>p.id===r.post_id)?.restaurant??'완료한 모임'}</b><small>{relativeDateTime(r.awarded_at)} · +{walkDistance(r.meters)}</small></span><strong>{r.points>0?`+${r.points}P`:'거리 누적'}</strong></div>)}{w.ready&&!w.rewards.length&&<p className="baef-muted">수령 전 예상 거리를 등록하면 모임 완료 후 여기에 쌓여요.</p>}</details>{w.error&&<p role="alert" className="baef-error">{w.error}</p>}
  </section>
}
