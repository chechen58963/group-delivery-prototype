import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSharedDelivery } from './SharedDelivery'
import './auth.css'

export default function AuthDialog(){
  const s=useSharedDelivery()
  const [mode,setMode]=useState<'login'|'signup'>('login')
  const [message,setMessage]=useState(''),[email,setEmail]=useState(''),[validation,setValidation]=useState('')
  const panel=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null
    panel.current?.querySelector<HTMLInputElement>('input')?.focus()
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'&&!s.authBusy)s.setLoginOpen(false)
      if(e.key!=='Tab')return
      const fields=[...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,a[href]')??[])]
      const first=fields[0],last=fields[fields.length-1]
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
    }
    document.addEventListener('keydown',key)
    return()=>{document.removeEventListener('keydown',key);previous?.focus()}
  },[s.authBusy])
  const submit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(s.authBusy)return
    const f=new FormData(e.currentTarget),password=String(f.get('password'))
    setValidation('');s.setError('')
    if(mode==='login'){await s.login(email,password);return}
    const nickname=String(f.get('nickname')).trim()
    if(nickname.length<2||nickname.length>20){setValidation('닉네임은 2~20자로 입력해 주세요.');return}
    if(password.length<8){setValidation('비밀번호는 8자 이상 입력해 주세요.');return}
    if(password!==String(f.get('confirmation'))){setValidation('비밀번호가 서로 달라요. 다시 확인해 주세요.');return}
    const result=await s.signup(email,password,nickname)
    if(result==='email')setMessage('입력한 이메일의 인증 링크를 눌러 가입을 마쳐주세요. 인증 후에는 별도 승인 없이 이용할 수 있어요.')
  }
  return <div className="baef-auth-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-heading"><div ref={panel} className="baef-auth-panel">
    <header><span className="baef-wordmark">배프<span>.</span></span><button type="button" aria-label="로그인 닫기" disabled={s.authBusy} onClick={()=>s.setLoginOpen(false)}>×</button></header>
    <h2 id="auth-heading">{message?'이메일을 확인해 주세요':mode==='signup'?'배프와 한 끼를 시작해요':'다시 만나서 반가워요'}</h2>
    {message?<><p className="baef-muted">{email}</p><p role="status" className="baef-auth-message">{message}</p><p className="baef-muted">이미 가입한 이메일이라면 로그인해 주세요.</p><button className="baef-button" onClick={()=>{setMessage('');setMode('login');s.setError('')}}>로그인으로 돌아가기</button></>:<>
      <div className="baef-auth-tabs" aria-label="계정 메뉴">{(['login','signup'] as const).map(m=><button key={m} type="button" aria-pressed={mode===m} onClick={()=>{setMode(m);setValidation('');s.setError('')}}>{m==='login'?'로그인':'회원가입'}</button>)}</div>
      <form onSubmit={submit} className="baef-auth-form" key={mode}>
        {mode==='signup'&&<label>닉네임<input name="nickname" autoComplete="nickname" minLength={2} maxLength={20} placeholder="배프에게 보여줄 이름" required/></label>}
        <label>이메일<input name="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" required/></label>
        <label>비밀번호<input name="password" type="password" autoComplete={mode==='signup'?'new-password':'current-password'} minLength={mode==='signup'?8:undefined} maxLength={128} placeholder={mode==='signup'?'8자 이상 입력해 주세요':'비밀번호를 입력해 주세요'} required/></label>
        {mode==='signup'&&<label>비밀번호 확인<input name="confirmation" type="password" autoComplete="new-password" maxLength={128} required placeholder="한 번 더 입력해 주세요"/></label>}
        {(validation||s.error)&&<p className="baef-error" role="alert">{validation||s.error}</p>}
        <button className="baef-button" disabled={s.authBusy}>{s.authBusy?'잠시만 기다려 주세요…':mode==='signup'?'회원가입':'로그인'}</button>
        {mode==='signup'&&<p className="baef-muted">이메일 인증을 마치면 바로 이용할 수 있어요.</p>}
      </form>
    </>}
  </div></div>
}
