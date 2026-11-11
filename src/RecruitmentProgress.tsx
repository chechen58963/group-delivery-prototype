import { money, useMenuDiscovery } from './MenuDiscoveryContext'

export default function RecruitmentProgress({postId,goal,members,maxMembers}:{postId:string;goal:number;members:number;maxMembers:number}){
  const d=useMenuDiscovery(),progress=d.recruitmentProgress.find(p=>p.post_id===postId)
  const slots=Math.max(0,maxMembers-members)
  return <div className="baef-recruit-progress">
    <div><b>{progress ? progress.food_total>=goal ? members<2?'목표금액 달성 · 한 명 더 필요해요':progress.selected_people<members?'목표금액 달성 · 메뉴 선택 중':'목표금액·인원 충족' : `목표까지 ${money(Math.max(0,goal-progress.food_total))}` : `목표 주문금액 ${money(goal)}`}</b><span>{slots?`${slots}명 더 참여 가능`:'모집 인원 충족'}</span></div>
    {progress&&<><progress aria-label={`목표 주문금액 달성 ${Math.min(100,Math.floor(progress.food_total/Math.max(1,goal)*100))}%`} value={Math.min(progress.food_total,Math.max(1,goal))} max={Math.max(1,goal)}/><small className="baef-muted">수락된 참가자 메뉴 {money(progress.food_total)}</small></>}
  </div>
}
