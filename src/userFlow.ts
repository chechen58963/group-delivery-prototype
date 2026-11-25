export const orderJourney = ['메뉴 선택', '리더 수락', '각자 결제', '배프가 가게에 주문 전달', '함께 수령']
export function previewMembers(current:number, maximum:number, alreadyJoined=false) {
  return Math.max(2,Math.min(maximum,current+(alreadyJoined?0:1)))
}
export type Place = {id:string;name:string;lat:number;lng:number}
// Named public landmarks, never an inferred home address.
export const pickupPlaces:Place[] = [
  {id:'cnu-main',name:'충남대 정문',lat:36.3621,lng:127.3444},
  {id:'cnu-library',name:'충남대 중앙도서관 앞',lat:36.3665,lng:127.3451},
  {id:'cnu-north',name:'충남대 후문',lat:36.3708,lng:127.3472},
]
export function metersBetween(a:{lat:number;lng:number},b:{lat:number;lng:number}) {
  const rad=(x:number)=>x*Math.PI/180
  const h=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2
  return 12742000*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))))
}
export function originName(point:{lat:number;lng:number}|null|undefined) {
  if(!point)return '출발 위치 미설정'
  const nearest=[...pickupPlaces].sort((a,b)=>metersBetween(point,a)-metersBetween(point,b))[0]
  return metersBetween(point,nearest)<=200?`${nearest.name} 주변`:'지도에서 선택한 출발점'
}

export function recruitmentPickupLabel(post: { meeting?: string; pickup_lat?: number | null; pickup_lng?: number | null }) {
  const label = post.meeting?.trim()
  if (label && label !== '지도에 표시된 공개 수령점' && label !== '지도에 지정한 공개 수령점') return label
  if (post.pickup_lat == null || post.pickup_lng == null) return label || '참가 후 장소 조율'
  const point = { lat: post.pickup_lat, lng: post.pickup_lng }
  const place = pickupPlaces.find(p => metersBetween(point, p) <= 50)
  if (!place) return label || '지도에 표시된 공개 수령점'
  return place.lat === point.lat && place.lng === point.lng ? place.name : `${place.name} 주변`
}
export function pickupCandidates(points:{lat:number;lng:number}[]) {
  return pickupPlaces.map(place=>({...place,distances:points.map(p=>Math.ceil(metersBetween(p,place)))}))
    .filter(p=>points.length>0&&p.distances.every(d=>d<=400))
    .sort((a,b)=>Math.max(...a.distances)-Math.max(...b.distances))
}

type AttentionContext={uid?:string;post?:{owner_id:string;status:string};members:{user_id:string;status:string;active:boolean}[];state?:{phase:string;checkout_mode?:string;nearby_requester?:string|null;nearby_agreed?:boolean;pickup_mode?:string;pickup_agreed_by?:string[]};people:{user_id:string;claimed_amount:number;confirmed_amount:number;received_at?:string|null}[]}
export function needsAttention(target:string,text:string,c:AttentionContext) {
  if(!c.uid||!c.post||['cancelled','completed'].includes(c.post.status))return false
  const own=c.members.find(m=>m.user_id===c.uid)
  if(!own?.active||own.status!=='accepted')return false
  if(target==='applicants')return c.post.owner_id===c.uid&&c.post.status==='open'&&c.members.some(m=>m.status==='pending'&&m.active)
  if(target==='menu'){
    if(c.state?.phase!=='menu')return false
    if(text.includes('근처')||text.includes('장소 제안'))return !!c.state.nearby_requester&&!c.state.nearby_agreed&&c.state.nearby_requester!==c.uid
    if(text.includes('비대면'))return c.state.pickup_mode==='contactless'&&!c.state.pickup_agreed_by?.includes(c.uid)
    return false
  }
  if(target==='payment')return c.state?.checkout_mode!=='platform'&&c.post.owner_id===c.uid&&c.state?.phase==='payment'&&c.people.some(p=>p.user_id!==c.uid&&p.claimed_amount>p.confirmed_amount)
  if(target==='receipt')return c.state?.phase==='arrived'&&!c.people.find(p=>p.user_id===c.uid)?.received_at
  return false
}
