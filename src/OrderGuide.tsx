export function OrderRouteSteps({joining=false,current=0}:{joining?:boolean;current?:number}){
  const steps=joining?['내 메뉴 담기','참가 신청','리더 수락']:['가게 선택','메뉴 담기','모집 등록']
  return <ol className="baef-route-steps" aria-label={joining?'모집 참가 순서':'모집 시작 순서'}>{steps.map((label,index)=><li key={label} aria-current={index===current?'step':undefined}><span>{index+1}</span>{label}</li>)}</ol>
}
export function OrderGuide({title,description}:{title:string;description:string}){
  return <div className="baef-order-guide"><b>{title}</b><p>{description}</p></div>
}
