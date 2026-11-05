export function pickupDay(date:Date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

export function pickupTimeFields(value:string|null,suggestedDate?:string|null,now=new Date()){
  const saved=value?new Date(value):null
  const planned=suggestedDate?new Date(suggestedDate):null
  const date=saved&&Number.isFinite(saved.getTime())?saved:planned&&Number.isFinite(planned.getTime())&&pickupDay(planned)>=pickupDay(now)?planned:now
  const day=pickupDay(date)
  const tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1)
  const days=[{value:pickupDay(now),label:'오늘'},{value:pickupDay(tomorrow),label:'내일'}]
  if(!days.some(v=>v.value===day))days.push({value:day,label:`${date.getMonth()+1}월 ${date.getDate()}일 · 기존 일정`})
  return {day,clock:saved&&Number.isFinite(saved.getTime())?`${String(saved.getHours()).padStart(2,'0')}:${String(saved.getMinutes()).padStart(2,'0')}`:'',days}
}

export function pickupTimestamp(day:string,clock:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock))return null
  const date=new Date(`${day}T${clock}:00`)
  if(!Number.isFinite(date.getTime())||pickupDay(date)!==day||date.getHours()!==Number(clock.slice(0,2))||date.getMinutes()!==Number(clock.slice(3)))return null
  return date.toISOString()
}
