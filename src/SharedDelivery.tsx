import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { CAMPUS_STORES, CATEGORY_PHOTOS } from './campus'
import { makeTransaction, type Post, type Transaction, type Action, type FlowEvent } from './workflow'

type Tester = { user_id: string; nickname: string; active: boolean }
type SharedPost = { id: string; owner_id: string; restaurant: string; category: string; max_members: number; member_count: number; deadline: string; delivery_fee: number; min_order: number; meeting: string; note: string; status: string }
type Member = { id: string; post_id: string; user_id: string; status: string; active: boolean }
type SharedMessage = { id: number; sender_id: string; body: string; created_at: string }
type Notification = FlowEvent & { id: number; postId: number; restaurant: string; read: boolean; time: number }
type CreateInput = { restaurant: string; category: string; maxMembers: string; deadline: string; minAmount: string; currentAmount: string; deliveryTime: string; note: string }
function explain(e: unknown) {
  const error = e as { code?: string; message?: string }
  if (error.code === 'PGRST202' || error.code === 'PGRST205') return '공유 저장소 설정이 필요해요. 진행자에게 문의해 주세요.'
  if (error.message?.includes('Invalid login credentials')) return '이메일 또는 비밀번호를 확인해 주세요.'
  if (error.message?.includes('Failed to fetch')) return '연결하지 못했어요. 인터넷 연결을 확인해 주세요.'
  if (error.code === '23505') return '이미 진행 중인 모집이나 신청이 있어요.'
  if (['23514','23502','22P02'].includes(error.code ?? '')) return '입력한 금액, 인원, 시간과 글 길이를 확인해 주세요.'
  return error.message ?? '요청을 처리하지 못했어요.'
}
function useSharedState() {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(!!supabase)
  const [sample, setSample] = useState(() => new URLSearchParams(location.search).get('mode') === 'demo')
  const [loginOpen, setLoginOpen] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [testers, setTesters] = useState<Tester[]>([])
  const [rawPosts, setRawPosts] = useState<SharedPost[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [messages, setMessages] = useState<SharedMessage[]>([])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const ids = useRef(new Map<string, number>())
  const mutation = useRef(false)
  const sequence = useRef(0)
  const uid = session?.user.id
  const currentUid = useRef(uid)
  currentUid.current = uid
  const live = !!uid && !sample
  const me = testers.find(t => t.user_id === uid)
  const allowed = !!me?.active
  const nickname = (id: string) => testers.find(t => t.user_id === id)?.nickname ?? '참여자'
  const numberFor = useCallback((id: string) => {
    if (!ids.current.has(id)) ids.current.set(id, 1000000 + ids.current.size)
    return ids.current.get(id)!
  }, [])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const activeMember = members.find(m => m.user_id === uid && m.active)
  const activePost = rawPosts.find(p => p.id === activeMember?.post_id)
  const selected = rawPosts.find(p => numberFor(p.id) === selectedId)
  const txSource = activePost ?? (selected && members.some(m => m.post_id === selected.id && m.user_id === uid) ? selected : undefined)
  const ownMember = members.find(m => m.post_id === txSource?.id && m.user_id === uid)
  const addNotification = useCallback((post: SharedPost, text: string, target: FlowEvent['target']) => {
    const item: Notification = { id: ++sequence.current, postId: numberFor(post.id), restaurant: post.restaurant, text, target, read: false, time: Date.now() }
    setNotifications(list => [item, ...list].slice(0, 100)); setNotice(text)
  }, [numberFor])

  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setInitializing(false) })
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    setRawPosts([]); setMembers([]); setTesters([]); setMessages([]); setReady(false)
    setNotifications([]); setSelectedId(null); setError(''); setNotice('')
    if (!uid || sample || !supabase) return
    let alive = true, fetching = false
    let previous: Member[] | null = null
    async function refresh() {
      if (!supabase || fetching) return
      fetching = true
      try {
        const t = await supabase.from('gd_testers').select('*').eq('user_id', uid!).maybeSingle()
        if (t.error) throw t.error
        if (!t.data?.active) {
          if (alive) { setTesters(t.data ? [t.data] : []); setRawPosts([]); setMembers([]); setReady(true) }
          return
        }
        const maintenance = await supabase.rpc('gd_action', { p_action: 'refresh' })
        if (maintenance.error) throw maintenance.error
        const results = await Promise.all([
          supabase.from('gd_testers').select('*'),
          supabase.from('gd_posts').select('*').order('created_at', { ascending: false }),
          supabase.from('gd_participations').select('*'),
        ])
        for (const r of results) if (r.error) throw r.error
        if (!alive) return
        const nextMembers = results[2].data as Member[]
        const nextPosts = results[1].data as SharedPost[]
        if (previous) for (const m of nextMembers) {
          const old = previous.find(v => v.id === m.id)
          const p = nextPosts.find(v => v.id === m.post_id)
          if (!p) continue
          if (m.user_id === uid && old && old.status !== m.status) addNotification(p, m.status === 'accepted' ? '참여 신청이 수락됐어요. 채팅방에 참여하세요.' : '신청·참여 상태가 변경됐어요.', m.status === 'accepted' ? 'chat' : 'detail')
          if (p.owner_id === uid && m.status === 'pending' && (!old || old.status !== 'pending')) addNotification(p, '새 동참 신청이 도착했어요.', 'applicants')
        }
        previous = nextMembers
        setTesters(results[0].data as Tester[]); setRawPosts(nextPosts); setMembers(nextMembers); setReady(true); setError('')
      } catch (e) { if (alive) { setError(explain(e)); setReady(true) } }
      finally { fetching = false }
    }
    void refresh()
    const timer = setInterval(() => { if (!document.hidden) void refresh() }, 3000)
    const focus = () => void refresh()
    window.addEventListener('focus', focus)
    window.addEventListener('shared-delivery-refresh', focus)
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', focus); window.removeEventListener('shared-delivery-refresh', focus) }
  }, [uid, sample, addNotification])

  const chatId = live && allowed && ownMember?.status === 'accepted' ? txSource?.id : undefined
  useEffect(() => {
    setMessages([])
    if (!chatId || !supabase) return
    let alive = true, fetching = false, lastId: number | null = null
    const load = async () => {
      if (!supabase || fetching) return
      fetching = true
      try {
        const r = await supabase.from('gd_messages').select('*').eq('post_id', chatId).order('id', { ascending: false }).limit(200)
        if (r.error) throw r.error
        if (!alive) return
        const next = (r.data as SharedMessage[]).reverse()
        const latest = next[next.length - 1]?.id ?? 0
        if (lastId !== latest) {
          const incoming = next.filter(m => lastId !== null && m.id > lastId && m.sender_id !== uid)
          if (incoming.length) {
            const p = rawPosts.find(v => v.id === chatId)
            if (p) addNotification(p, `새 채팅: ${incoming[incoming.length - 1].body}`, 'chat')
          }
          setMessages(next); lastId = latest
        }
      } catch (e) { if (alive) setError(explain(e)) }
      finally { fetching = false }
    }
    void load(); const timer = setInterval(() => { if (!document.hidden) void load() }, 2000)
    window.addEventListener('shared-delivery-refresh', load)
    return () => { alive = false; clearInterval(timer); window.removeEventListener('shared-delivery-refresh', load) }
  }, [chatId, uid, addNotification])

  async function act(kind: string, id: string | null, data: Record<string, unknown> = {}) {
    if (!supabase || mutation.current || !allowed) return null
    mutation.current = true; setBusy(true); setError('')
    try {
      const r = await supabase.rpc('gd_action', { p_action: kind, p_post: id, p_data: data })
      if (r.error) throw r.error
      if (currentUid.current !== uid) return null
      const [p, m] = await Promise.all([
        supabase.from('gd_posts').select('*').order('created_at', { ascending: false }),
        supabase.from('gd_participations').select('*'),
      ])
      if (currentUid.current !== uid) return null
      if (p.error || m.error) {
        setNotice('요청은 저장됐어요. 최신 목록은 연결이 회복되면 자동으로 표시돼요.')
      } else {
        setRawPosts(p.data as SharedPost[]); setMembers(m.data as Member[])
      }
      window.dispatchEvent(new Event('shared-delivery-refresh'))
      return r.data as string
    } catch (e) { setError(explain(e)); return null }
    finally { mutation.current = false; setBusy(false) }
  }
  function toPost(p: SharedPost): Post {
    const store = CAMPUS_STORES.find(s => s.name === p.restaurant)
    let meta: { text?: string; currentAmount?: number; deliveryTime?: string } = { text: p.note }
    try { const parsed = JSON.parse(p.note); if (parsed.format === 'campus-v1') meta = parsed } catch { /* Plain text posts remain readable. */ }
    return { id: numberFor(p.id), sharedId: p.id, restaurant: p.restaurant, category: p.category,
      emoji: store?.emoji ?? '🍽️', currentMembers: p.member_count, maxMembers: p.max_members,
      minOrderAmount: p.min_order, currentAmount: meta.currentAmount ?? 0, distance: 0,
      deadline: new Date(p.deadline).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
      closesAt: new Date(p.deadline).getTime(), deliveryTime: meta.deliveryTime ?? '채팅에서 조율',
      leaderRating: 0, leaderTrades: 0, leaderName: nickname(p.owner_id),
      status: p.status === 'open' && new Date(p.deadline).getTime() > Date.now() ? 'recruiting' : p.status === 'cancelled' || p.status === 'completed' ? 'complete' : 'full',
      gradFrom: '#ffe8d6', gradTo: '#fff6ee', description: `${meta.text ?? ''}\n수령 제안 장소: ${p.meeting}`.trim(),
      imageId: store?.imageId ?? CATEGORY_PHOTOS[p.category], menus: store?.menus,
      storeSource: store?.source, menuSource: store?.menuSource, menuBasis: store?.menuBasis, priceNote: store?.priceNote }
  }
  const posts = rawPosts.map(toPost)
  let tx: Transaction | null = null
  if (txSource && ownMember) {
    const p = toPost(txSource)
    tx = makeTransaction(p, p.menus ?? [], txSource.owner_id === uid ? 'leader' : 'participant')
    tx.application = ownMember.status === 'pending' ? 'pending' : ownMember.status === 'accepted' ? 'accepted' : 'rejected'
    tx.people = members.filter(m => m.post_id === txSource.id && m.status === 'accepted').map(m => ({
      id: m.user_id === uid ? 'me' : m.user_id === txSource.owner_id ? 'leader' : m.user_id,
      name: nickname(m.user_id), avatar: '🧑', items: p.menus ?? [], quantities: {}, menuConfirmed: false,
      location: { x: 0, y: 0 }, transferClaimed: false, paid: false, received: false,
    }))
    tx.closed = p.status !== 'recruiting'; tx.cancelled = ['cancelled','completed'].includes(txSource.status) || ownMember.status === 'withdrawn'
    tx.meeting = txSource.meeting
    tx.messages = messages.map(m => ({ id: m.id, sender: nickname(m.sender_id), content: m.body,
      isMe: m.sender_id === uid, time: new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) }))
  }
  return {
    session, live, sample, setSample, initializing, loginOpen, setLoginOpen, authBusy, ready, busy, error, setError,
    notice, setNotice, allowed, me, nickname, posts, tx, selectedId, selectPost: setSelectedId,
    selectedRaw: selected, active: !!activeMember, members, rawPosts, act,
    pending: members.filter(m => m.post_id === txSource?.id && m.status === 'pending' && m.active),
    notifications, setNotifications,
    login: async (email: string, password: string) => {
      if (!supabase) { setError('로그인 연결 설정이 필요해요.'); return }
      setAuthBusy(true); setError('')
      try { const r = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (r.error) throw r.error; setSample(false); setLoginOpen(false) }
      catch (e) { setError(explain(e)) } finally { setAuthBusy(false) }
    },
    logout: async () => { const r = await supabase?.auth.signOut({ scope: 'local' }); if (r?.error) setError(explain(r.error)) },
    create: async (input: CreateInput) => {
      if (!live) { setSample(false); setLoginOpen(true); return false }
      const date = new Date(); const [h,m] = input.deadline.split(':').map(Number); date.setHours(h,m,0,0)
      const amount = (s: string) => Number(s.replace(/,/g, '').trim())
      if (!input.restaurant.trim() || !input.category || !input.deadline || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now() || !input.minAmount.trim() || !Number.isInteger(amount(input.minAmount)) || amount(input.minAmount)<0 || !input.currentAmount.trim() || !Number.isInteger(amount(input.currentAmount)) || amount(input.currentAmount)<0 || !input.deliveryTime.trim() || !Number.isInteger(Number(input.maxMembers)) || Number(input.maxMembers)<2 || Number(input.maxMembers)>5) {
        setError('음식점, 정수 금액, 인원(리더 포함 2~5명), 배달 예정 시간과 현재 시간 이후의 마감을 입력해 주세요.'); return false
      }
      const id = await act('create', null, { restaurant: input.restaurant.trim(), category: input.category,
        max_members: Number(input.maxMembers), deadline: date.toISOString(), delivery_fee: 3000, min_order: amount(input.minAmount),
        meeting: '채팅에서 조율', note: JSON.stringify({ format: 'campus-v1', text: input.note, currentAmount: amount(input.currentAmount), deliveryTime: input.deliveryTime }) })
      if (id) { setSelectedId(numberFor(id)); setNotice('모집글을 등록했어요. 다른 참여자에게도 보여요.'); return true } return false
    },
    apply: async (p: Post) => {
      if (!live || !p.sharedId) { setSample(false); setLoginOpen(!session); setNotice(session ? '예시 모집글에는 실제 신청할 수 없어요. 참여자 모집글을 선택해 주세요.' : '로그인하고 실제 모집글에 참여해 주세요.'); return false }
      if (await act('apply', p.sharedId)) { setNotice('동참 신청을 보냈어요. 리더의 수락을 기다려 주세요.'); return true } return false
    },
    dispatch: (action: Action) => {
      if (!txSource) return
      if (action.type === 'message') { void act('message', txSource.id, { body: action.message.content }); return }
      if (action.type === 'close') { void act('close', txSource.id); return }
      if (action.type === 'cancel') { void act(txSource.owner_id === uid ? 'cancel' : 'withdraw', txSource.id); return }
      setNotice('현재 참여자 테스트는 모집·신청·수락·채팅까지 연결돼 있어요. 메뉴·송금·수령 과정은 예시 모드에서 체험할 수 있어요.')
    },
  }
}
type Shared = ReturnType<typeof useSharedState>
const SharedContext = createContext<Shared | null>(null)
export function SharedDeliveryProvider({ children }: { children: ReactNode }) {
  const value = useSharedState()
  return <SharedContext.Provider value={value}>{children}</SharedContext.Provider>
}
export function useSharedDelivery() { const value = useContext(SharedContext); if (!value) throw new Error('SharedDeliveryProvider is required'); return value }

export function SharedAccountControl() {
  const s = useSharedDelivery()
  return <>
    <div className="flex items-center gap-2 mr-auto text-xs min-w-0">
      <button className="text-brand truncate max-w-28 py-2" disabled={s.initializing} onClick={() => { if (!s.session) s.setLoginOpen(true); else if (confirm('로그아웃할까요?')) void s.logout() }}>{s.initializing ? '확인 중…' : s.session ? `${s.me?.nickname ?? '내 계정'} · 로그아웃` : '로그인'}</button>
      <button className="text-gray-500 py-2" onClick={() => s.setSample(!s.sample)}>{s.sample ? '실제 참여로' : s.session ? '예시 보기' : '예시 체험'}</button>
    </div>
    {s.loginOpen && <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-labelledby="shared-login-title" onKeyDown={e => { if (e.key === 'Escape') s.setLoginOpen(false) }}>
      <form className="bg-white rounded-3xl p-6 w-full space-y-4 shadow-xl" onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); void s.login(String(f.get('email')), String(f.get('password'))) }}>
        <div className="flex justify-between items-center"><h2 id="shared-login-title" className="font-bold text-lg">공동배달 로그인</h2><button type="button" aria-label="로그인 닫기" onClick={() => s.setLoginOpen(false)}>✕</button></div>
        <p className="text-xs text-gray-500">발급받은 계정으로 로그인하면 같은 앱에서 모집글을 올리고 다른 참여자와 대화할 수 있어요.</p>
        <label className="block text-sm">이메일<input autoFocus name="email" type="email" autoComplete="username" required className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-base" /></label>
        <label className="block text-sm">비밀번호<input name="password" type="password" autoComplete="current-password" required className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-base" /></label>
        {s.error && <p role="alert" className="text-red-600 text-xs">{s.error}</p>}
        <button disabled={s.authBusy} className="w-full bg-brand text-white rounded-xl py-3 font-bold disabled:opacity-40">{s.authBusy ? '로그인 중…' : '로그인'}</button>
      </form>
    </div>}
  </>
}

export function SharedDetailActions({ push }: { push: (s: 'applicants' | 'chat' | 'list') => void }) {
  const s = useSharedDelivery(), p = s.selectedRaw
  if (!p) return null
  const mine = s.members.find(m => m.post_id === p.id && m.user_id === s.session?.user.id)
  const leader = p.owner_id === s.session?.user.id
  const ended = ['cancelled','completed'].includes(p.status)
  const btn = 'w-full rounded-2xl py-3 px-4 text-sm font-bold disabled:opacity-40'
  return <div className="space-y-2">
    {mine?.status === 'pending' && mine.active && <p className="text-sm text-center bg-brand-50 p-3 rounded-xl">신청 완료 · 리더 수락을 기다리고 있어요.</p>}
    {mine?.status === 'accepted' && <button className={`${btn} bg-brand text-white`} onClick={() => push(leader && !ended ? 'applicants' : 'chat')}>{leader && !ended ? '신청자 관리 · 채팅방' : '공동 채팅방으로'}</button>}
    {!mine?.active && !ended && <button disabled={s.busy || s.active || p.status !== 'open' || new Date(p.deadline).getTime()<=Date.now()} className={`${btn} bg-brand text-white`} onClick={() => { const post=s.posts.find(v=>v.sharedId===p.id); if(post) void s.apply(post) }}>{s.active ? '다른 모집에 신청·참여 중이에요' : p.status !== 'open' ? '모집 마감' : '동참 신청하기'}</button>}
    {mine?.active && !ended && <button disabled={s.busy} className={`${btn} border border-gray-200 text-gray-500`} onClick={() => { if(confirm(leader ? '모집을 취소할까요?' : '신청·참여를 취소할까요?')) void s.act(leader?'cancel':'withdraw',p.id) }}>{leader?'공동배달 취소':'신청·참여 취소'}</button>}
    {ended && <p className="text-center text-sm text-gray-500">{p.status==='completed'?'종료된 테스트예요.':'취소된 모집이에요.'}</p>}
  </div>
}

export function SharedApplicants({ pop, push }: { pop: () => void; push: (s: 'chat') => void }) {
  const s=useSharedDelivery(), tx=s.tx, p=s.rawPosts.find(v=>v.id===tx?.post.sharedId)
  if(!p || p.owner_id!==s.session?.user.id) return <p className="p-6 text-sm">내가 작성한 모집글을 선택해 주세요.</p>
  const ended=['cancelled','completed'].includes(p.status)
  const pending=s.members.filter(m=>m.post_id===p.id&&m.status==='pending'&&m.active)
  const people=s.members.filter(m=>m.post_id===p.id&&m.status==='accepted')
  const closed=p.status!=='open'||new Date(p.deadline).getTime()<=Date.now()
  return <div className="flex-1 overflow-y-auto bg-gray-50"><header className="bg-white border-b border-gray-100 p-4 flex items-center gap-4"><button onClick={pop}>‹ 뒤로</button><h1 className="font-bold">신청자 관리</h1></header><div className="p-4 space-y-4">
    <div className="bg-white rounded-2xl p-4 space-y-2"><h2 className="font-bold">{p.restaurant}</h2><p className="text-sm">현재 {p.member_count} / {p.max_members}명 · {closed?'모집 마감':'모집 중'}</p><p className="text-xs text-gray-500">실제 참여자의 신청이 이곳에 표시돼요.</p></div>
    {!pending.length && <p className="text-gray-500 text-sm text-center py-6">대기 중인 신청자가 없어요.</p>}
    {pending.map(m=><div key={m.id} className="bg-white rounded-2xl p-4 space-y-3"><p className="font-bold">🧑 {s.nickname(m.user_id)}</p><p className="text-xs text-gray-500">테스트 참여자 · 평판 정보는 아직 없어요.</p><div className="flex gap-2">{[false,true].map(accept=><button key={String(accept)} disabled={s.busy||closed} className={`flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-40 ${accept?'bg-brand text-white':'border border-gray-200'}`} onClick={()=>void s.act(accept?'accept':'reject',p.id,{user_id:m.user_id})}>{accept?'수락':'거절'}</button>)}</div></div>)}
    <div className="bg-white rounded-2xl p-4"><h2 className="font-bold text-sm mb-2">참여자</h2>{people.map(m=><p className="text-sm py-1" key={m.id}>{s.nickname(m.user_id)} {m.user_id===p.owner_id?'· 리더':''}</p>)}</div>
    <button className="w-full py-3 rounded-2xl bg-brand text-white font-bold" onClick={()=>push('chat')}>공동 채팅방 열기</button>
    {!ended && <>
      {!closed ? <button disabled={s.busy} className="w-full py-3 border border-gray-200 rounded-2xl text-sm" onClick={()=>{if(confirm('현재 멤버로 마감할까요? 대기 중인 신청은 종료돼요.'))void s.act('close',p.id)}}>현재 멤버로 모집 마감</button> : p.member_count<p.max_members&&new Date(p.deadline).getTime()>Date.now()&&<button disabled={s.busy} className="w-full py-3 border border-gray-200 rounded-2xl text-sm" onClick={()=>void s.act('reopen',p.id)}>빈자리 다시 모집</button>}
      <button disabled={s.busy} className="w-full py-3 text-sm text-gray-500" onClick={()=>{if(confirm('공동배달 테스트를 종료할까요? 모든 참여자가 다음 모집에 참여할 수 있어요.'))void s.act('complete',p.id)}}>이 공동배달 테스트 종료</button>
    </>}
  </div></div>
}

export function SharedChat({ pop, push }: { pop: () => void; push: (s: 'applicants') => void }) {
  const s=useSharedDelivery(), tx=s.tx
  const [draft,setDraft]=useState(''), [panel,setPanel]=useState(false), [unseen,setUnseen]=useState(false)
  const list=useRef<HTMLDivElement>(null), follow=useRef(true)
  useEffect(()=>{
    if(follow.current) requestAnimationFrame(()=>{if(list.current)list.current.scrollTop=list.current.scrollHeight})
    else setUnseen(true)
  },[tx?.messages.length])
  if(!tx||tx.application!=='accepted'||tx.cancelled)return <div className="p-6 text-center space-y-4"><p>참여 중인 채팅방이 없거나 승인을 기다리고 있어요.</p><button className="text-brand" onClick={pop}>돌아가기</button></div>
  return <div className="chat-room flex-1 min-h-0 flex flex-col relative">
    <header className="chat-header px-3 pt-3 pb-2 shrink-0"><div className="flex items-center gap-2"><button className="w-9 h-10 text-2xl" aria-label="채팅 나가기" onClick={pop}>‹</button><div className="flex-1 min-w-0"><h1 className="font-bold text-sm truncate">{tx.post.restaurant}</h1><p className="chat-muted text-[11px]">{tx.people.length}명 · {tx.closed?'모집 마감':'모집 중'}</p></div>{tx.role==='leader'&&<button className="text-brand text-xs" onClick={()=>push('applicants')}>신청자 관리</button>}</div>
      <button className="chat-tool rounded-xl w-full py-2 text-xs mt-2" onClick={()=>setPanel(!panel)} aria-expanded={panel}>메뉴 참고 · 수령 장소 · 참여자 {panel?'접기':'보기'}</button>
    </header>
    {panel&&<div className="chat-panel p-4 overflow-y-auto max-h-[40%] shrink-0 space-y-3 text-xs border-b border-gray-100"><p><b>수령 제안 장소</b> · {tx.meeting}</p><p>메뉴·수량·수령 시간은 채팅으로 함께 정해 주세요.</p><p className="chat-muted">실제 주문·송금 없이 모집과 소통 과정을 검증하는 테스트예요.</p><p><b>참여자</b> · {tx.people.map(p=>p.name).join(', ')}</p><details><summary className="cursor-pointer font-bold">음식점 메뉴 참고</summary>{tx.post.menus?.map(m=><p className="py-1" key={m.id}>{m.name} · {m.price.toLocaleString()}원</p>)}<p className="chat-muted">공개 자료의 참고 메뉴·가격이며 지점 판매 여부는 확인이 필요해요.</p></details></div>}
    <div ref={list} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4" onScroll={()=>{const el=list.current;if(el){follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;if(follow.current)setUnseen(false)}}}>
      <p className="chat-muted text-[10px] text-center">참여자끼리 나누는 실제 대화 · 약 2초마다 갱신</p>
      {!tx.messages.length&&<p className="chat-muted text-center text-sm py-8">메뉴와 만날 시간을 이야기해 보세요.</p>}
      {tx.messages.map(m=><div key={m.id} className={`flex flex-col ${m.isMe?'items-end':'items-start'}`}><span className="chat-muted text-[10px] mb-1">{m.sender}</span><p className={`chat-bubble max-w-[85%] px-3 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${m.isMe?'chat-bubble-mine rounded-tr-sm':'rounded-tl-sm'}`} style={{overflowWrap:'anywhere'}}>{m.content}</p><time className="chat-muted text-[10px] mt-1">{m.time}</time></div>)}
    </div>
    {unseen&&<button className="chat-new-message self-center rounded-full py-2 px-4 text-xs mb-2" onClick={()=>{if(list.current)list.current.scrollTop=list.current.scrollHeight;follow.current=true;setUnseen(false)}}>새 메시지 ↓</button>}
    <form className="chat-composer flex items-end gap-2 px-3 py-3 shrink-0" onSubmit={async e=>{e.preventDefault();if(!draft.trim()||s.busy)return;const p=tx.post.sharedId!;if(await s.act('message',p,{body:draft.trim()})){setDraft('');follow.current=true}}}>
      <textarea aria-label="메시지 입력" maxLength={2000} rows={2} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="메시지를 입력하세요" className="chat-input resize-none rounded-2xl px-3 py-3 flex-1 min-w-0 text-base outline-none"/><button disabled={s.busy||!draft.trim()} className="chat-send rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-40">전송</button>
    </form>
  </div>
}
