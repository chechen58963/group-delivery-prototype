import { pickupDay, pickupTimestamp } from './pickupTime'

export function initialDeliverySlot(day:number,hour:number,now=new Date()){
 const start=new Date(now);start.setDate(start.getDate()+day);start.setHours(hour,0,0,0)
 if(start.getTime()<=now.getTime())start.setTime(Math.ceil((now.getTime()+15*60000)/(15*60000))*15*60000)
 return {deliveryDay:pickupDay(start),deliveryClock:`${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`}
}
export function deliveryWindow(day:string,clock:string){
 const value=pickupTimestamp(day,clock)
 if(!value)return null
 const start=new Date(value),end=new Date(start.getTime()+3600000)
 return {start,end,label:`${clock}–${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`}
}
export function estimatedBill(food:number,totalFee:number,people:number){
 const fee=Math.max(0,Number.isFinite(totalFee)?Math.round(totalFee):0)
 const share=Math.ceil(fee/Math.max(2,Math.floor(people)||2))
 return {share,total:food+share,saving:fee-share}
}
export function compareKnownDistance(a:number,b:number){
 if(!Number.isFinite(a))return Number.isFinite(b)?1:0
 if(!Number.isFinite(b))return -1
 return a-b
}
