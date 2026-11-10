export const WALK_MILESTONE_METERS=1000
export const WALK_MILESTONE_POINTS=100
export const WALK_ORDER_MAX_METERS=400
export const walkEstimate=(meters:number)=>Number.isFinite(meters)?Math.max(0,Math.min(WALK_ORDER_MAX_METERS,Math.floor(meters))):0
export const walkDistance=(meters:number)=>meters>=1000?`${(meters/1000).toLocaleString('ko-KR',{maximumFractionDigits:2})}km`:`${meters.toLocaleString('ko-KR')}m`
export function walkProgress(total:number){
  const progress=total%WALK_MILESTONE_METERS
  return {progress,remaining:WALK_MILESTONE_METERS-progress,earned:Math.floor(total/WALK_MILESTONE_METERS)*WALK_MILESTONE_POINTS}
}

export const WALK_COMPLETION_POINTS=20
export const WALK_METERS_PER_POINT=5
export const WALK_DAILY_LIMIT=200
export const orderRewardEstimate=(meters:number,today:number)=>Math.min(20+Math.floor(Math.max(0,Math.min(400,meters))/5),Math.max(0,200-today))
