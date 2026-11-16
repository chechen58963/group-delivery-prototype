import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useDeliveryLifecycle } from './DeliveryLifecycle'
import { useSharedDelivery } from './SharedDelivery'

export async function pickupPhoto(file:File):Promise<string>{
  if(!file.type.startsWith('image/')||file.size>10*1024*1024)throw new Error('10MB 이하의 사진을 선택해 주세요.')
  const url=URL.createObjectURL(file)
  try{
    const image=new Image();image.src=url;await image.decode()
    const ratio=Math.min(1,960/Math.max(image.width,image.height)),canvas=document.createElement('canvas')
    canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio))
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('사진을 읽을 수 없어요. 다른 사진을 선택해 주세요.')
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height)
    for(const quality of [.78,.6,.4,.25]){const result=canvas.toDataURL('image/jpeg',quality);if(result.length<=240000)return result}
    throw new Error('사진이 너무 커요. 음식이 놓인 부분만 잘라 다시 선택해 주세요.')
  }finally{URL.revokeObjectURL(url)}
}

export function pickupAgreed(state:{pickup_mode?:string;pickup_agreed_by?:string[]},members:{user_id:string}[]){
  return state.pickup_mode!=='contactless'||members.length>0&&members.every(m=>state.pickup_agreed_by?.includes(m.user_id))
}

export default function PickupMethod({receipt=false}:{receipt?:boolean}){
  const o=useDeliveryLifecycle(),s=useSharedDelivery(),state=o.state
  const [note,setNote]=useState(''),[photo,setPhoto]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false),[retry,setRetry]=useState(0),[expanded,setExpanded]=useState(false)
  const generation=useRef(0)
  useEffect(()=>{generation.current++;setNote('');setPhoto('');setError('');setLoading(false);return()=>{generation.current++}},[o.selectedId,o.uid])
  useEffect(()=>{
    setPhoto('');if(!receipt||!state?.pickup_dropped_at||!o.selectedId)return
    let alive=true;setLoading(true);setError('')
    void supabase.from('gd_pickup_photos').select('photo').eq('post_id',o.selectedId).maybeSingle().then(r=>{
      if(!alive)return
      if(r.error||!r.data)setError('수령 사진을 불러오지 못했어요. 다시 불러오거나 채팅에서 장소를 확인해 주세요.')
      else setPhoto(r.data.photo)
      setLoading(false)
    })
    return()=>{alive=false}
  },[receipt,o.selectedId,o.uid,state?.pickup_dropped_at,retry])
  if(!state||!Object.prototype.hasOwnProperty.call(state,'pickup_mode'))return null
  const mode=state.pickup_mode==='contactless',agreed=pickupAgreed(state,o.members),editable=state.phase==='menu',mineAgreed=state.pickup_agreed_by?.includes(o.uid??'')
  const act=(action:string,data:Record<string,unknown>={})=>o.act(`pickup-${action}`,{...data,expected_updated_at:state.updated_at})
  if(receipt&&!mode)return null
  const details=<>
    {mode?<><p><b>지정 장소에서 각자 찾아가요</b></p><p>{state.pickup_note}</p><p className="baef-muted">수령 장소 · {state.meeting}</p>
      <div className="baef-pickup-status">{o.members.map(m=><span key={m.id}>{s.nickname(m.user_id)} · {state.pickup_agreed_by?.includes(m.user_id)?'동의':'확인 대기'}</span>)}</div>
      {editable&&<>{!mineAgreed&&<button className="baef-button" disabled={o.busy} onClick={()=>void act('agree')}>장소·안내 확인하고 비대면 수령에 동의</button>}<button className="baef-button secondary" disabled={o.busy} onClick={()=>{if(confirm('비대면 제안을 취소하고 직접 만나서 받기로 변경할까요?'))void act('reset')}}>직접 만나서 받기로 변경</button>{!agreed&&<p className="baef-pickup-warning">모두 동의하면 주문을 확정할 수 있어요. 장소·시간이나 참가자가 바뀌면 다시 동의해 주세요.</p>}</>}
      {receipt&&<>
        <ol><li>리더가 음식에 닉네임을 표시하고 합의한 장소에 놓아요.</li><li>놓은 사진과 알림을 확인하고 내 음식을 찾아가요.</li><li>각자 음식 확인 후 아래에서 수령 완료를 눌러요.</li></ol>
        {state.pickup_dropped_at?<><p role="status"><b>음식을 놓았어요 · {new Date(state.pickup_dropped_at).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</b></p>{photo&&<><button className="baef-pickup-photo-button" aria-label="음식을 놓은 장소 사진 크게 보기" onClick={()=>setExpanded(true)}><img src={photo} className="baef-pickup-photo" alt="리더가 음식을 놓은 수령 장소"/></button>{expanded&&<div className="baef-overlay" role="dialog" aria-modal="true" aria-label="수령 장소 사진" onKeyDown={e=>{if(e.key==='Escape')setExpanded(false)}}><section className="baef-sheet"><button autoFocus className="baef-button secondary" onClick={()=>setExpanded(false)}>사진 닫기</button><img src={photo} className="baef-pickup-photo expanded" alt="음식을 놓은 수령 장소 확대"/></section></div>}</>}{loading&&<p role="status">수령 사진 불러오는 중…</p>}{error&&<><p className="baef-error" role="alert">{error}</p><button className="baef-button secondary" onClick={()=>setRetry(v=>v+1)}>사진 다시 불러오기</button></>}</>:o.owner?<>
          <label className="baef-order-field">음식을 놓은 장소 사진<input type="file" accept="image/*" disabled={loading||o.busy} onChange={async e=>{const file=e.target.files?.[0];e.currentTarget.value='';if(!file)return;const version=++generation.current;setLoading(true);setError('');setPhoto('');try{const result=await pickupPhoto(file);if(version===generation.current)setPhoto(result)}catch(e){if(version===generation.current)setError((e as Error).message||'사진을 읽지 못했어요. 다른 사진을 선택해 주세요.')}finally{if(version===generation.current)setLoading(false)}}}/></label>
          {loading&&<p role="status">사진 준비 중…</p>}{photo&&<img src={photo} className="baef-pickup-photo" alt="등록할 수령 장소 사진 미리보기"/>}{error&&<p className="baef-error" role="alert">{error}</p>}
          <button className="baef-button" disabled={!photo||loading||o.busy} onClick={()=>void act('dropoff',{photo}).then(ok=>{if(ok)s.setNotice('음식을 놓았다는 알림을 보냈어요. 각자 찾아간 뒤 수령을 확인해 주세요.')})}>{o.busy?'알리는 중…':'음식을 놓았어요 · 모두에게 알리기'}</button>
        </>:<p className="baef-pickup-warning" role="status">리더가 음식을 놓으면 사진과 알림을 확인할 수 있어요.</p>}
      </>}
    </>:<><p>현재는 직접 만나서 음식을 받아요.</p>{editable&&<><p className="baef-muted">원하면 리더가 음식을 놓고 각자 찾아가는 방식을 제안할 수 있어요. 배달비 분담은 바뀌지 않아요.</p><label className="baef-order-field">놓을 위치와 음식 구분 방법<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={500} placeholder="예: 정문 경비실 옆 탁자, 봉투에 닉네임 표시"/></label><button className="baef-button secondary" disabled={o.busy||!note.trim()} onClick={()=>void act('propose',{note:note.trim()})}>비대면 수령 제안</button></>}</>}
  </>
  return receipt?<section className="baef-pickup-mode"><h2>비대면 수령 안내</h2>{details}</section>:<details id="order-pickup" className="baef-info-details baef-pickup-mode" open={mode&&!agreed}><summary><span>수령 방식</span><small>{mode?agreed?'비대면 수령 · 모두 동의':'비대면 수령 · 동의 필요':'직접 만나기'}</small></summary><div className="baef-info-content">{details}</div></details>
}
