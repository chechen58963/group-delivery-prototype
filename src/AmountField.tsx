import { useId } from 'react'

export function adjustAmount(value:string,delta:number,min:number,max:number){
  const amount=Number(value.replace(/,/g,''))
  return String(Math.max(min,Math.min(max,(Number.isFinite(amount)?Math.round(amount):0)+delta)))
}
export default function AmountField({label,value,onChange,min=0,max=1000000,kind='goal'}:{label:string;value:string;onChange:(v:string)=>void;min?:number;max?:number;kind?:'goal'|'fee'}){
  const id=useId(),changes=kind==='fee'?[-500,500,1000]:[-1000,1000,10000]
  return <div className="baef-amount-field"><label htmlFor={id}>{label}</label><div className="baef-amount-input"><input id={id} type="number" inputMode="numeric" step="1" min={min} max={max} value={value} onChange={e=>onChange(e.target.value)} aria-describedby={`${id}-hint`}/><span>원</span></div><div className="baef-amount-shortcuts">{changes.map(delta=><button key={delta} type="button" aria-label={`${label} ${delta<0?'빼기':'더하기'} ${Math.abs(delta).toLocaleString()}원`} disabled={delta<0?Number(value)<=min:Number(value)>=max} onClick={()=>onChange(adjustAmount(value,delta,min,max))}>{delta>0?'+':'−'}{Math.abs(delta).toLocaleString()}</button>)}</div><small id={`${id}-hint`}>금액을 눌러 직접 입력할 수 있어요.</small></div>
}
