import { pickupTimeFields } from './pickupTime'

export default function PickupTimeField({value,suggestedDate,label='주문 예정 시간'}:{value:string|null;suggestedDate?:string|null;label?:string}){
  const fields=pickupTimeFields(value,suggestedDate)
  return <fieldset className="baef-pickup-time"><legend>{label}</legend><div><label><span>날짜</span><select name="meeting_day" defaultValue={fields.day} required>{fields.days.map(day=><option key={day.value} value={day.value}>{day.label}</option>)}</select></label><label><span>시간</span><input name="time" type="time" step="60" defaultValue={fields.clock} required/></label></div></fieldset>
}
