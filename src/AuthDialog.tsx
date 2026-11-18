import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSharedDelivery } from './SharedDelivery'
import './auth.css'

export default function AuthDialog(){
  const s=useSharedDelivery()
  const [mode,setMode]=useState<'login'|'signup'|'forgot'|'reset'>(s.authRecovery?'reset':'login')
  const [message,setMessage]=useState(''),[email,setEmail]=useState(''),[validation,setValidation]=useState('')
  const [showPassword,setShowPassword]=useState(false),[showConfirmation,setShowConfirmation]=useState(false)
  const panel=useRef<HTMLDivElement>(null)
  const [now,setNow]=useState(Date.now()),[resent,setResent]=useState(false)
  useEffect(()=>{if(s.signupRetryUntil<=Date.now())return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[s.signupRetryUntil])
  const wait=Math.max(0,Math.ceil((s.signupRetryUntil-now)/1000))
  const busy=useRef(s.authBusy);busy.current=s.authBusy
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null
    panel.current?.querySelector<HTMLInputElement>('input')?.focus()
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'&&!busy.current)s.setLoginOpen(false)
      if(e.key!=='Tab')return
      const fields=[...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,a[href]')??[])]
      const first=fields[0],last=fields[fields.length-1]
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
    }
    document.addEventListener('keydown',key)
    return()=>{document.removeEventListener('keydown',key);previous?.focus()}
  },[])
  useEffect(()=>{setShowPassword(false);setShowConfirmation(false);if(!message)panel.current?.querySelector<HTMLInputElement>('input')?.focus()},[mode,message])
  useEffect(()=>{if(s.authRecovery){setMode('reset');setMessage('')}},[s.authRecovery])
  const submit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(s.authBusy)return
    const f=new FormData(e.currentTarget),password=String(f.get('password'))
    setValidation('');s.setError('')
    if(mode==='forgot'){if(await s.requestPasswordReset(email))setMessage('비밀번호 재설정 메일을 요청했어요. 받은편지함과 스팸함을 확인해 주세요.');return}
    if(mode==='reset'){if(password.length<8||password!==String(f.get('confirmation'))){setValidation('비밀번호는 8자 이상, 두 칸이 같아야 해요.');return}await s.updatePassword(password);return}
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
    <h2 id="auth-heading">{message?'이메일을 확인해 주세요':mode==='reset'?'새 비밀번호를 정해 주세요':mode==='forgot'?'비밀번호 찾기':mode==='signup'?'배프와 한 끼를 시작해요':'배프에 오신 걸 환영해요'}</h2>
    {message?<><p className="baef-muted">{email}</p><p role="status" className="baef-auth-message">{message}</p><p className="baef-muted">메일이 보이지 않으면 스팸함도 확인해 주세요. 이미 가입한 이메일이라면 로그인해 주세요.</p>{s.error&&<p className="baef-error" role="alert">{s.error}</p>}{resent&&<p role="status" className="baef-auth-wait">인증 메일을 다시 요청했어요. 받은편지함을 확인해 주세요.</p>}{mode!=='forgot'&&<button className="baef-button secondary" disabled={s.authBusy||wait>0} onClick={()=>void s.resendSignup(email).then(ok=>{if(ok)setResent(true)})}>{s.authBusy?'메일 요청 중…':wait>0?`${wait}초 뒤 인증 메일 다시 요청`:'인증 메일 다시 요청'}</button>}<button className="baef-button" onClick={()=>{setMessage('');setMode('login');s.setError('')}}>로그인으로 돌아가기</button></>:<>
      <div className="baef-auth-tabs" aria-label="계정 메뉴">{(['login','signup'] as const).map(m=><button key={m} type="button" aria-pressed={mode===m} onClick={()=>{setMode(m);setValidation('');s.setError('')}}>{m==='login'?'로그인':'회원가입'}</button>)}</div>
      <form onSubmit={submit} className="baef-auth-form" key={mode}>
        {mode==='signup'&&<label>닉네임<input name="nickname" autoComplete="nickname" minLength={2} maxLength={20} placeholder="배프에게 보여줄 이름" required/></label>}
        {mode!=='reset'&&<label>이메일<input name="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" required/></label>}
        {mode!=='forgot'&&<label>비밀번호<span className="baef-password-field"><input name="password" type={showPassword?'text':'password'} autoComplete={mode==='signup'||mode==='reset'?'new-password':'current-password'} minLength={mode==='signup'?8:undefined} maxLength={128} placeholder={mode==='signup'?'8자 이상 입력해 주세요':'비밀번호를 입력해 주세요'} required/><button type="button" aria-label={showPassword?'비밀번호 숨기기':'비밀번호 보기'} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?'숨기기':'보기'}</button></span></label>}
        {(mode==='signup'||mode==='reset')&&<label>비밀번호 확인<span className="baef-password-field"><input name="confirmation" type={showConfirmation?'text':'password'} autoComplete="new-password" maxLength={128} required placeholder="한 번 더 입력해 주세요"/><button type="button" aria-label={showConfirmation?'확인 비밀번호 숨기기':'확인 비밀번호 보기'} aria-pressed={showConfirmation} onClick={()=>setShowConfirmation(v=>!v)}>{showConfirmation?'숨기기':'보기'}</button></span></label>}
        {(validation||s.error)&&<p className="baef-error" role="alert">{validation||s.error}</p>}
        <button className="baef-button" disabled={s.authBusy||mode==='signup'&&wait>0}>{s.authBusy?'잠시만 기다려 주세요…':mode==='signup'&&wait>0?`${wait}초 뒤 다시 요청`:mode==='reset'?'비밀번호 변경':mode==='forgot'?'재설정 메일 받기':mode==='signup'?'회원가입':'로그인'}</button>
        {mode==='signup'&&<p className="baef-auth-wait">{wait>0?'반복 요청을 잠시 막았어요. 발송 한도 오류는 운영자의 설정 확인이 필요할 수 있어요.':'이메일 인증을 마치면 바로 이용할 수 있어요.'}</p>}
        {mode==='login'&&<button type="button" className="baef-text-action" onClick={()=>{setMode('forgot');s.setError('')}}>비밀번호를 잊으셨나요?</button>}
      </form>
    </>}
  </div></div>
}
