type Timing={phase:string;planned_order_at?:string|null;delivery_eta_start?:string|null;delivery_eta_end?:string|null;pickup_mode?:string;pickup_dropped_at?:string|null;arrived_at?:string|null}
export function timeLabel(value:string|null|undefined){return value?new Date(value).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):''}
export function plannedFromNote(note:string|undefined){try{const p=JSON.parse(note??'{}');return typeof p.starts_at==='string'&&Number.isFinite(Date.parse(p.starts_at))?p.starts_at:null}catch{return null}}
export function readyAt(s:Timing|null|undefined){return s?.phase==='arrived'||s?.phase==='completed'?(s.pickup_mode==='contactless'?s.pickup_dropped_at:s.arrived_at)??null:null}
export function timingSummary(s:Timing|null|undefined){
  if(!s)return '주문 예정 시간 확인 중'
  const ready=readyAt(s)
  if(ready)return `수령 가능 · ${timeLabel(ready)} 안내`
  if(s.phase==='arrived')return '리더가 음식을 놓으면 수령할 수 있어요'
  if(['ordered','delivering'].includes(s.phase))return s.delivery_eta_start&&s.delivery_eta_end?`도착 예상 ${timeLabel(s.delivery_eta_start)} ~ ${new Date(s.delivery_eta_end).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`:'도착 예상 시간 확인 중'
  return s.planned_order_at?`주문 예정 ${timeLabel(s.planned_order_at)}`:'모집 후 함께 주문해요'
}
export function canReportLate(s:Timing|null|undefined,seen:string|null|undefined,now=Date.now()){
  const ready=readyAt(s);return !!ready&&!!seen&&now>=Math.max(new Date(ready).getTime(),new Date(seen).getTime())+600000
}
