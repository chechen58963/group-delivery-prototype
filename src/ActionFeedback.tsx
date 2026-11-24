export default function ActionFeedback({message,close}:{message:string;close:()=>void}){
  if(!message)return null
  return <div className="baef-action-feedback" role="status"><span>{message}</span><button type="button" aria-label="안내 닫기" onClick={close}>×</button></div>
}
