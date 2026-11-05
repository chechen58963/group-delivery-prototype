import { useRef, useState } from 'react'

export function useSaveFeedback(){
  const [status,setStatus]=useState<'idle'|'dirty'|'saved'>('idle')
  const revision=useRef(0)
  return {status,change:()=>{revision.current++;setStatus('dirty')},begin:()=>revision.current,
    saved:(submitted:number)=>{if(submitted===revision.current)setStatus('saved')},reset:()=>{revision.current++;setStatus('idle')}}
}
export function SaveFeedback({status}:{status:'idle'|'dirty'|'saved'}){
  return status==='idle'?null:<p className={`baef-save-feedback ${status}`} role="status">{status==='dirty'?'변경사항 저장 필요':'저장했어요.'}</p>
}
export function ButtonHint({reason,id}:{reason:string;id?:string}){
  return reason?<p id={id} className="baef-button-hint">{reason}</p>:null
}
export function relativeDateTime(value:string|number|Date,now=new Date()){
  const date=new Date(value)
  if(!Number.isFinite(date.getTime()))return ''
  const tomorrow=new Date(now);tomorrow.setDate(now.getDate()+1)
  const day=date.toDateString()===now.toDateString()?'오늘':date.toDateString()===tomorrow.toDateString()?'내일':date.toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'})
  return `${day} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}
