import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useSharedDelivery } from './SharedDelivery'

export type OrderPhase='menu'|'payment'|'ordered'|'delivering'|'arrived'|'completed'|'cancelled'
export type OrderState={post_id:string;phase:OrderPhase;meeting:string;meeting_time:string|null;meeting_lat:number|null;meeting_lng:number|null;bank:string;account:string;holder:string;leader_ready:boolean;coupon_funding?:'platform'|'leader';nearby_requester:string|null;nearby_address:string|null;nearby_agreed:boolean;arrived_at:string|null;updated_at:string}
export type OrderPerson={post_id:string;user_id:string;food_total:number;fee:number;coupon_discount:number;claimed_amount:number;confirmed_amount:number;refunded_amount:number;refund_due:number;refund_sent:boolean;received_at:string|null;late_reported:boolean;late_ack:boolean;latitude:number|null;longitude:number|null}
export type Reputation={user_id:string;rating:number|null;review_count:number;trades:number}
export type OrderReview={id:string;post_id:string;reviewer_id:string;subject_id:string;stars:number;comment:string;created_at:string}
export type OrderReport={id:string;post_id:string;reporter_id:string;subject_id:string;reason:string;detail:string;status:'pending'|'confirmed'|'dismissed';resolution:string|null}
export const phaseLabel:Record<OrderPhase,string>={menu:'메뉴 결정',payment:'송금 확인',ordered:'주문 완료',delivering:'배달 중',arrived:'수령 확인',completed:'거래 완료',cancelled:'취소·환불'}
export const orderDue=(p:OrderPerson)=>p.food_total+p.fee-p.coupon_discount
export const remainingTransfer=(p:OrderPerson)=>Math.max(0,orderDue(p)-p.confirmed_amount+p.refunded_amount)
export const distanceM=(a:{lat:number;lng:number},b:{lat:number;lng:number})=>{
  const rad=(n:number)=>n*Math.PI/180
  const v=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2
  return 12742000*Math.asin(Math.sqrt(Math.min(1,Math.max(0,v))))
}
export function midpoint(points:{lat:number;lng:number}[]){
  if(!points.length)return null
  return {lat:points.reduce((v,p)=>v+p.lat,0)/points.length,lng:points.reduce((v,p)=>v+p.lng,0)/points.length}
}
function useLifecycleState(){
  const s=useSharedDelivery(),uid=s.session?.user.id
  const [states,setStates]=useState<OrderState[]>([]),[people,setPeople]=useState<OrderPerson[]>([])
  const [reviews,setReviews]=useState<OrderReview[]>([]),[reports,setReports]=useState<OrderReport[]>([]),[reputations,setReputations]=useState<Reputation[]>([])
  const [available,setAvailable]=useState(false),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[busy,setBusy]=useState(false)
  const pending=useRef(false),revision=useRef(0),currentUid=useRef(uid);currentUid.current=uid
  useEffect(()=>{
    setStates([]);setPeople([]);setReviews([]);setReports([]);setReputations([]);setAvailable(false);setError('');setLoadError('')
    if(!uid||!s.allowed)return
    let alive=true,running=false,seen:Map<string,string>|null=null
    const load=async()=>{
      if(running)return;running=true;const generation=revision.current
      try{
        const r=await Promise.all([supabase.from('gd_order_states').select('*'),supabase.from('gd_order_people').select('*'),supabase.from('gd_reviews').select('*').order('created_at',{ascending:false}),supabase.from('gd_reports').select('*'),supabase.rpc('gd_reputation')])
        for(const v of r)if(v.error)throw v.error
        if(!alive||generation!==revision.current)return
        const next=r[0].data as OrderState[]
        if(seen){const changed=next.find(v=>seen!.has(v.post_id)&&seen!.get(v.post_id)!==v.phase);if(changed)s.setNotice(`주문 상태가 ‘${phaseLabel[changed.phase]}’로 바뀌었어요.`)}
        seen=new Map(next.map(v=>[v.post_id,v.phase]));setStates(next);setPeople(r[1].data as OrderPerson[]);setReviews(r[2].data as OrderReview[]);setReports(r[3].data as OrderReport[]);setReputations(r[4].data as Reputation[]);setAvailable(true);setLoadError('')
      }catch(e){if(alive&&generation===revision.current){setAvailable(false);setLoadError(['PGRST202','PGRST205','42P01'].includes((e as {code?:string}).code??'')?'복원한 기능을 이용하려면 공유 저장소 업데이트가 필요해요.':(e as {message?:string}).message??'진행 상태를 불러오지 못했어요.')}}finally{running=false}
    }
    void load();const timer=setInterval(()=>{if(!document.hidden)void load()},3000)
    window.addEventListener('shared-delivery-refresh',load);window.addEventListener('focus',load)
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('shared-delivery-refresh',load);window.removeEventListener('focus',load)}
  },[uid,s.allowed])
  const selectedId=s.selectedRaw?.id??s.tx?.post.sharedId
  const state=states.find(v=>v.post_id===selectedId)
  const post=s.rawPosts.find(v=>v.id===selectedId)
  const orderPeople=people.filter(v=>v.post_id===selectedId)
  const mine=orderPeople.find(v=>v.user_id===uid)
  const owner=post?.owner_id===uid
  const members=s.members.filter(v=>v.post_id===selectedId&&v.status==='accepted')
  useEffect(()=>{
    if(!available||!selectedId||state||!members.some(m=>m.user_id===uid))return
    let alive=true
    void supabase.rpc('gd_order_action',{p_action:'initialize',p_post:selectedId,p_data:{}}).then(r=>{if(alive&&!r.error)window.dispatchEvent(new Event('shared-delivery-refresh'))})
    return()=>{alive=false}
  },[available,selectedId,!!state,members.some(m=>m.user_id===uid)])
  const act=async(action:string,data:Record<string,unknown>={},postId=selectedId)=>{
    if(pending.current||!uid||!postId)return false
    if(!available){setError('공유 저장소 업데이트 후 이용할 수 있어요.');return false}
    pending.current=true;setBusy(true);setError('')
    try{
      const r=await supabase.rpc('gd_order_action',{p_action:action,p_post:postId,p_data:data});if(r.error)throw r.error
      if(currentUid.current!==uid)return false
      revision.current++
      const [updated,updatedPeople]=await Promise.all([supabase.from('gd_order_states').select('*').eq('post_id',postId).maybeSingle(),supabase.from('gd_order_people').select('*').eq('post_id',postId)])
      if(currentUid.current!==uid)return false
      if(updated.data)setStates(values=>[...values.filter(v=>v.post_id!==postId),updated.data as OrderState])
      if(updatedPeople.data)setPeople(values=>[...values.filter(v=>v.post_id!==postId),...updatedPeople.data as OrderPerson[]])
      if(action==='review'){
        const [r,rep]=await Promise.all([supabase.from('gd_reviews').select('*').order('created_at',{ascending:false}),supabase.rpc('gd_reputation')])
        if(currentUid.current===uid){if(r.data)setReviews(r.data as OrderReview[]);if(rep.data)setReputations(rep.data as Reputation[])}
      }
      if(action==='report'){
        const r=await supabase.from('gd_reports').select('*');if(currentUid.current===uid&&r.data)setReports(r.data as OrderReport[])
      }
      window.dispatchEvent(new Event('shared-delivery-refresh'));window.dispatchEvent(new Event('menu-discovery-refresh'))
      return true
    }catch(e){if(currentUid.current===uid)setError((e as {code?:string}).code==='23505'?'이미 저장한 평가 또는 신고예요.':(e as {message?:string}).message??'저장하지 못했어요.');return false}finally{pending.current=false;setBusy(false)}
  }
  const reputation=(id:string)=>reputations.find(v=>v.user_id===id)
  const myReputation=uid?reputation(uid):undefined
  const couponEligible=!!myReputation&&Number(myReputation.rating)>=4.8&&Number(myReputation.trades)>=5&&!people.some(p=>p.user_id===uid&&p.coupon_discount>0&&states.find(v=>v.post_id===p.post_id)?.phase!=='cancelled')
  return {uid,states,people,reviews,reports,reputations,available,error:error||loadError,setError,busy,act,state,post,orderPeople,mine,owner,members,reputation,myReputation,couponEligible,selectedId}
}
type Lifecycle=ReturnType<typeof useLifecycleState>
const Context=createContext<Lifecycle|null>(null)
export function DeliveryLifecycleProvider({children}:{children:ReactNode}){const value=useLifecycleState();return <Context.Provider value={value}>{children}</Context.Provider>}
export function useDeliveryLifecycle(){const value=useContext(Context);if(!value)throw new Error('DeliveryLifecycleProvider required');return value}
