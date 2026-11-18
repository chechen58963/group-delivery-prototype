import OrderSuggestions from './OrderSuggestionsPanel'
import OrderWishEditor from './OrderWishEditor'
import {plannedFromNote,timeLabel} from './orderTiming'
import CancelOrderControl from './CancelOrderControl'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useSharedDelivery } from './SharedDelivery'
import { useMenuDiscovery, FOOD_CHOICES, money, formatWindow, type MenuStore } from './MenuDiscoveryContext'
import { distanceM, phaseLabel, useDeliveryLifecycle } from './DeliveryLifecycle'
import { LocationChoice, StoreSheet } from './MenuDiscovery'
import StoreBrand from './StoreBrand'
import RecruitmentProgress from './RecruitmentProgress'
import type { Screen } from './navigationTypes'
import type { MapPin } from './LocationMap'
import { orderNextStep } from './orderGuidance'
import { compareKnownDistance, estimatedBill } from './discoveryHelpers'
import { readAccountHistory, saveAccountHistory } from './sharedHistory'
import Icon from './ui/Icon'
import OrderJourney from './OrderJourney'
import { Modal } from './ui/Modal'
import photos from './menuPhotos.json'
import variants from './menuPhotoVariants.json'

const LocationMap = lazy(() => import('./LocationMap'))
type Navigate = (screen: Screen) => void
const photoMap = photos as Record<string, Record<string, string>>
const variantMap = variants as Record<string, Record<string, Record<string, string>>>
export function liveStorePhoto(name: string, menu?: string) {
  const brand = Object.keys(photoMap).find(key => name.startsWith(key))
  if (!brand) return null
  const choices = photoMap[brand]
  const item = menu && choices[menu] ? menu : Object.keys(choices)[0]
  return variantMap[brand]?.[item]?.ICE ?? choices[item] ?? null
}
const categories = [
  { id: 'all', label: '전체', photo: '' },
  { id: 'coffee', label: '커피', photo: '/images/menus/ediya-1-ice.webp' },
  { id: 'burger', label: '버거', photo: '/images/menus/mom-1.webp' },
  { id: 'sandwich', label: '샌드위치', photo: '/images/menus/subway-1.webp' },
]
export function LiveCategories({ value, change }: { value: string; change: (value: string) => void }) {
  return <div className="bv-categories" role="group" aria-label="음식 종류">{categories.map(c => <button key={c.id} aria-pressed={value === c.id} onClick={() => change(c.id)}>{c.photo ? <img src={c.photo} alt="" /> : <Icon name="explore" size={20} />}{c.label}</button>)}</div>
}
function useSavedRooms() {
  const s = useSharedDelivery(), uid = s.session?.user.id
  const [state, setState] = useState<{ uid: string | undefined; ids: string[] }>({ uid: undefined, ids: [] })
  useEffect(() => {
    const raw = uid ? readAccountHistory<unknown>(uid, 'saved-rooms', []) : []
    setState({ uid, ids: Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [] })
  }, [uid])
  const ids = state.uid === uid ? state.ids : []
  return { ids, toggle(id: string) {
    if (!uid) { s.setLoginOpen(true); return }
    setState(previous => {
      const values = previous.uid === uid ? previous.ids : []
      const next = values.includes(id) ? values.filter(v => v !== id) : [...values, id]
      saveAccountHistory(uid, 'saved-rooms', next)
      return { uid, ids: next }
    })
  } }
}
export function LiveExplore({ push, compact = false }: { push: Navigate; compact?: boolean }) {
  const s = useSharedDelivery(), d = useMenuDiscovery(), o = useDeliveryLifecycle()
  const [store, setStore] = useState<MenuStore | null>(null), [preferences, setPreferences] = useState(false), [savedOnly, setSavedOnly] = useState(false)
  const saved = useSavedRooms(), scroll = useRef<HTMLDivElement>(null), restored = useRef(false), previousUser = useRef(s.session?.user.id)
  useEffect(() => {
    const uid = s.session?.user.id
    if (previousUser.current && previousUser.current !== uid) { setStore(null); setPreferences(false); setSavedOnly(false); restored.current = false }
    previousUser.current = uid
  }, [s.session?.user.id])
  useEffect(() => {
    if (restored.current || !d.preferencesReady || s.initializing || (s.session && !s.ready)) return
    if (scroll.current) scroll.current.scrollTop = d.listScroll.current
    restored.current = true
  }, [d.preferencesReady, s.initializing, s.ready, !!s.session])
  const resetScroll = () => { d.saveListScroll(0) }
  const pointFor = (id?: string) => { const p = s.rawPosts.find(v => v.id === id); return p?.pickup_lat != null && p.pickup_lng != null ? { lat: p.pickup_lat, lng: p.pickup_lng } : null }
  const distanceFor = (id?: string) => { const p = pointFor(id); return p && d.matchLocation ? distanceM(p, d.matchLocation) : Infinity }
  const nearby = d.browseRange === 'near' && !!d.matchLocation
  const query = d.search.trim().toLowerCase()
  const matchesStore = (c: MenuStore) => (d.browseCategory === 'all' || d.browseCategory === c.menu_key) && `${c.store_name} ${FOOD_CHOICES.find(f => f.id === c.menu_key)?.name} ${c.menus.map(m => m.name).join(' ')}`.toLowerCase().includes(query)
  const groups = s.posts.filter(p => p.status === 'recruiting' && (s.rawPosts.find(r => r.id === p.sharedId)?.member_count ?? 0) < p.maxMembers && d.catalog.some(c => c.store_name === p.restaurant && (d.browseCategory === 'all' || c.menu_key === d.browseCategory)) && `${p.restaurant} ${p.category} ${p.description} ${d.catalog.find(c => c.store_name === p.restaurant)?.menus.map(m => m.name).join(' ')}`.toLowerCase().includes(query) && (!nearby || distanceFor(p.sharedId) <= 400) && (!savedOnly || saved.ids.includes(p.sharedId ?? '')))
  if (d.sort === 'near' && d.matchLocation) groups.sort((a,b) => compareKnownDistance(distanceFor(a.sharedId),distanceFor(b.sharedId)))
  const pins: MapPin[] = groups.flatMap(p => { const point = pointFor(p.sharedId); return point ? [{ id: String(p.id), point: { x: 0, y: 0 }, coordinates: point, label: p.restaurant, symbol: '모집', kind: 'post' as const }] : [] })
  if (d.matchLocation) pins.push({ id: 'me', point: { x: 0, y: 0 }, coordinates: d.matchLocation, label: '내 출발 위치', symbol: '나', kind: 'me' })
  const activeTx = s.activeTx, phase = o.states.find(v => v.post_id === activeTx?.post.sharedId)?.phase
  const next = activeTx ? orderNextStep({ role: activeTx.role, application: activeTx.application, phase, count: activeTx.people.length, virtualLeader:s.isVirtual?.(s.rawPosts.find(p=>p.id===activeTx.post.sharedId)?.owner_id??'') }) : null
  const loading = s.initializing || !!s.session && !s.ready
  return <div ref={scroll} className="baef-scroll live-explore-scroll" onScroll={e => d.saveListScroll(e.currentTarget.scrollTop)}><div className={`bv-page bv-browse live-explore ${compact ? 'compact' : ''}`}>
    <div className="live-location"><LocationChoice /></div>
    {!compact ? <div className="bv-home-intro"><div><p className="bv-eyebrow">오늘도 가볍게, 함께</p><h1>한 잔만 주문해도,<br />함께라면 가볍게.</h1><p className="bv-home-sub">가까운 배프와 주문하고 배달비를 나눠요.</p></div><div className="bv-intro-art" aria-hidden="true"><div className="bv-art-circle" /><img src="/images/menus/ediya-1-ice.webp" alt="" /><img src="/images/menus/subway-1.webp" alt="" /><span>함께라서<br /><b>가벼운 한 끼</b></span></div></div> : <h1 className="bv-screen-heading">함께 주문할 배프 찾기</h1>}
    {s.active && activeTx && next && <button className="bv-active-strip" onClick={() => { s.selectPost(activeTx.post.id); push(next.route) }}><span className="bv-active-dot" /><span><b>{next.title}</b><small>{activeTx.post.restaurant} · {next.action}</small></span><Icon name="arrow" size={20} /></button>}
    {!compact&&<OrderSuggestions configure={()=>setPreferences(true)} push={push}/>}
    <OrderJourney/><div className="bv-search"><Icon name="search" size={21} /><input type="search" enterKeyHint="search" placeholder="가게나 먹고 싶은 메뉴 검색" aria-label="가게 또는 메뉴 검색" value={d.search} onChange={e => { d.setSearch(e.target.value); resetScroll() }} />{d.search && <button aria-label="검색어 지우기" onClick={() => { d.setSearch(''); resetScroll() }}><Icon name="close" size={18} /></button>}</div>
    <LiveCategories value={d.browseCategory} change={v => { d.setBrowseCategory(v); resetScroll() }} />
    <div className="bv-browse-layout"><section className="live-browse-results"><div className="bv-list-heading"><div><h2>지금 함께 주문할 배프{s.ready && s.session && <em>{groups.length}</em>}</h2><p>{nearby ? '내 출발 위치에서 수령점까지 400m 이내예요.' : '먹고 싶은 메뉴가 있는 모집을 찾아보세요.'}</p></div><div className="bv-list-options"><select aria-label="모집 정렬" value={d.sort === 'near' && !d.matchLocation ? 'recent' : d.sort} onChange={e => d.setSort(e.target.value as 'recent' | 'near')}><option value="recent">최근순</option><option value="near" disabled={!d.matchLocation}>가까운순</option></select><button onClick={() => d.setBrowseView(d.browseView === 'map' ? 'list' : 'map')} aria-pressed={d.browseView === 'map'}><Icon name={d.browseView === 'map' ? 'receipt' : 'map'} size={18} />{d.browseView === 'map' ? '목록' : '지도'}</button></div></div>
      {(!s.session || s.allowed) && <div className="live-range"><button aria-pressed={!nearby} onClick={() => d.setBrowseRange('all')}>전체 모집</button><button aria-pressed={nearby} disabled={!d.matchLocation} onClick={() => d.setBrowseRange('near')}>수령점 400m 이내</button><button aria-pressed={savedOnly} onClick={() => setSavedOnly(v => !v)}><Icon name="heart" size={15} />저장한 모집</button></div>}
      {loading ? <div className="bv-empty" role="status"><span className="bv-empty-icon"><Icon name="bag" size={30} /></span><h2>주변 주문을 불러오고 있어요</h2></div> : !s.session && !s.posts.length ? <div className="live-guest-invite"><Icon name="users" size={30} /><h2>지금 열린 모집이 없어요</h2><p>아래에서 가게를 고르고 첫 모집을 시작해 보세요.</p><button className="bv-button" onClick={() => s.setLoginOpen(true)}>로그인하고 시작하기<Icon name="arrow" size={18} /></button></div> : s.session && !s.allowed ? <div className="bv-empty"><h2>계정 인증을 확인해 주세요</h2><p>이메일 인증을 마친 뒤 다시 로그인해 주세요.</p></div> : <>
        {d.browseView === 'map' && <><div className="baef-public-map live-public-map"><Suspense fallback={<p role="status">지도 불러오는 중…</p>}><LocationMap pins={pins} title="지도에서 모집글 찾기" center={d.matchLocation ?? undefined} onSelect={id => { if (id === 'me') return; s.selectPost(Number(id)); push('detail') }} /></Suspense></div><p className="baef-muted live-map-note">공개 수령점이 지정된 모집만 지도에 표시돼요.</p></>}
        <div className="bv-room-list">{groups.map(p => {
          const distance = distanceFor(p.sharedId), raw = s.rawPosts.find(v => v.id === p.sharedId)!, count = Math.min(p.currentMembers + 1, p.maxMembers), bill = estimatedBill(0, raw.delivery_fee, count), image = liveStorePhoto(p.restaurant), isSaved = saved.ids.includes(raw.id)
          return <article className="bv-room-card" key={raw.id}><button className="bv-room-main" aria-label={`${p.restaurant} 모집 상세`} onClick={() => { s.selectPost(p.id); push('detail') }}><div className="bv-room-photo">{image ? <img src={image} alt={`${p.restaurant} 메뉴`} /> : <StoreBrand name={p.restaurant} fallback={<Icon name="bag" size={36} />} />}<span className="bv-room-photo-tag">{p.deadline} 마감</span></div><div className="bv-room-content"><div className="bv-room-store"><StoreBrand name={p.restaurant} /><span>{p.category}</span></div><h3>{p.restaurant}</h3>{plannedFromNote(raw.note)&&<p className="baef-room-plan">주문 예정 {timeLabel(plannedFromNote(raw.note))}</p>}{(raw.public_virtual_leader||s.isVirtual?.(raw.owner_id))&&<span className="baef-virtual-badge">가상 유저의 모집</span>}<div className="bv-room-route"><Icon name="walk" size={15} /><span>{Number.isFinite(distance) ? `수령점 약 ${Math.ceil(distance)}m` : '거리 확인 필요'}</span><span className="live-room-count">{p.currentMembers} / {p.maxMembers}명</span></div><div className="bv-room-cost"><span>내 예상 배달비 <b>{money(bill.share)}</b></span></div><span className="bv-saving">{money(bill.saving)} 절약 예상</span></div></button><button className={`bv-save ${isSaved ? 'saved' : ''}`} aria-label={isSaved ? `${p.restaurant} 모집 저장 해제` : `${p.restaurant} 모집 저장`} aria-pressed={isSaved} onClick={() => saved.toggle(raw.id)}><Icon name="heart" size={20} /></button></article>
        })}</div>
        {!groups.length && <div className="live-no-groups"><Icon name={savedOnly ? 'heart' : 'users'} size={30} /><h3>{savedOnly ? '저장한 모집 중 열려 있는 주문이 없어요' : '조건에 맞는 모집이 아직 없어요'}</h3><p>먼저 메뉴를 골라 함께할 배프를 모아볼까요?</p>{nearby && <button className="baef-text-action" onClick={() => d.setBrowseRange('all')}>모든 거리의 모집 보기 →</button>}{(d.search || d.browseCategory !== 'all') && <button className="baef-text-action" onClick={() => { d.setSearch(''); d.setBrowseCategory('all') }}>검색 조건 지우기</button>}</div>}
      </>}
      <button className="bv-create-prompt" onClick={() => push('create')}><span><b>찾는 가게가 없나요?</b><small>내가 먼저 함께 주문할 배프를 모아보세요</small></span><Icon name="plus" size={23} /></button>
    </section><aside className="bv-how-it-works"><span className="bv-eyebrow">배프와 주문하기</span><h2>커피 한 잔도<br />부담 없이.</h2><ol>{[['먹고 싶은 메뉴 담기', '근처 모집에서 내 메뉴를 골라요'], ['배달비 나누기', '주문 금액을 리더에게 보내요'], ['가까운 곳에서 받기', '약속한 장소에서 내 음식을 받아요']].map(([title, text], i) => <li key={title}><i>{i + 1}</i><span><b>{title}</b><small>{text}</small></span></li>)}</ol><p>조금 걷고, 함께 아끼는<br />우리 동네 주문 습관.</p></aside></div>
    <section className="live-store-preview"><div className="bv-section-title"><h2>가게부터 골라볼까요?</h2><button className="bv-text-button" onClick={() => push('create')}>모두 보기<Icon name="chevron" size={15} /></button></div><div className="live-brand-grid">{d.catalog.filter(matchesStore).map(c => <button key={c.store_name} onClick={() => setStore(c)}><StoreBrand name={c.store_name} fallback={<Icon name="bag" size={30} />} /><b>{c.store_name}</b><small>메뉴 {c.menus.length}개</small></button>)}</div>{!d.catalog.filter(matchesStore).length && <p className="baef-muted">검색 조건에 맞는 가게가 없어요.</p>}</section>
    <div className="bv-preferences-link"><button onClick={() => setPreferences(true)}><Icon name="bell" size={21} /><span><b>{d.suggestionsReady?'내 메뉴·타협 범위 설정':d.intent ? '관심 메뉴 알림을 기다리고 있어요' : '아직 뭘 먹을지 고민된다면?'}</b><small>먹고 싶은 메뉴가 겹치면 알려드려요</small></span><Icon name="chevron" size={17} /></button></div>
    {d.error && <p className="baef-error" role="alert">{d.error}</p>}
    {store && <StoreSheet store={store} close={() => setStore(null)} push={push} />}
    {preferences && <LiveMenuPreferences close={() => setPreferences(false)} />}
  </div></div>
}
export function LiveMenuPreferences({ close }: { close: () => void }) {
  const d = useMenuDiscovery(), s = useSharedDelivery()
  if (s.session&&d.suggestionsReady) return <OrderWishEditor close={close}/>
  if (!s.session) return <Modal title="먹고 싶은 메뉴 알림" close={close} footer={<button className="baef-button" onClick={() => { close(); s.setLoginOpen(true) }}>로그인하고 메뉴 알림 설정</button>}><p className="baef-muted">로그인하면 먹고 싶은 메뉴와 시간이 맞는 배프를 알려드려요.</p></Modal>
  const reason = s.active ? '진행 중인 주문을 먼저 확인해 주세요.' : !d.menus.length ? '먹고 싶은 메뉴를 하나 이상 골라 주세요.' : !d.stores.length ? '가능한 가게를 한 곳 이상 골라 주세요.' : !d.matchLocation ? '출발 위치를 먼저 설정해 주세요.' : ''
  return <Modal title="먹고 싶은 메뉴 알림" close={close} footer={<><button className="baef-button" disabled={d.saving || !!reason} onClick={() => void d.save().then(ok => { if (ok) close() })}>{d.saving ? '저장 중…' : d.intent ? '메뉴 알림 변경' : '이 메뉴로 알림 받기'}</button>{reason && <p className="baef-muted">{reason}</p>}</>}>
    <p className="baef-muted">메뉴와 시간이 맞는 배프가 생기면 알려드려요.</p><div className="live-interest-choices">{FOOD_CHOICES.map(f => <button key={f.id} aria-pressed={d.menus.includes(f.id)} onClick={() => d.toggleMenu(f.id)}>{f.name}{d.menus.includes(f.id) && <Icon name="check" size={16} />}</button>)}</div>
    <div className="baef-order-form"><label>희망 날짜<select value={d.day} onChange={e => d.setDay(Number(e.target.value))}><option value={0}>오늘</option><option value={1}>내일</option></select></label><label>희망 시간<select value={d.hour} onChange={e => d.setHour(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => i + 11).map(h => <option key={h} value={h} disabled={d.day === 0 && h + 1 <= new Date().getHours()}>{h}:00–{h + 1}:00</option>)}</select></label></div>
    <div className="live-interest-stores"><h3>주문해도 괜찮은 가게</h3>{d.candidateStores.map(c => <label key={c.store_name}><input type="checkbox" checked={d.stores.includes(c.store_name)} onChange={() => d.toggleStore(c.store_name)} /><StoreBrand name={c.store_name} /><span>{c.store_name}</span></label>)}</div><LocationChoice />
    {d.intent && <div className="live-interest-current"><p>{formatWindow(d.intent.starts_at, d.intent.ends_at)} 알림 신청 중</p><button className="baef-text-cancel" disabled={d.saving} onClick={() => void d.cancel()}>알림 신청 취소</button></div>}{d.error && <p role="alert" className="baef-error">{d.error}</p>}
  </Modal>
}
export function LiveStorePicker({ push, pop }: { push: Navigate; pop: () => void }) {
  const d = useMenuDiscovery(), s = useSharedDelivery(), [store, setStore] = useState<MenuStore | null>(null), [query, setQuery] = useState(''), [category, setCategory] = useState('all')
  const found = d.catalog.filter(c => (category === 'all' || c.menu_key === category) && `${c.store_name} ${c.menus.map(m => m.name).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="baef-scroll"><div className="bv-page live-store-picker"><button className="baef-back" onClick={pop}><Icon name="back" size={18} />뒤로</button><span className="bv-eyebrow">1 / 3 · 가게 선택</span><h1 className="bv-screen-heading">어디서 주문할까요?</h1><p className="baef-muted">가게를 고르고 내 메뉴를 담으면 모집을 시작할 수 있어요.</p>{s.active && <div className="bv-active-strip"><span>참여 중인 주문을 먼저 마쳐 주세요.</span><button onClick={() => push('orders')}>내 주문 보기 →</button></div>}<OrderJourney/><div className="bv-search"><Icon name="search" size={20} /><input type="search" aria-label="주문할 가게 검색" placeholder="가게 또는 메뉴 검색" value={query} onChange={e => setQuery(e.target.value)} /></div><LiveCategories value={category} change={setCategory} /><div className="live-store-grid">{found.map(c => <button key={c.store_name} disabled={s.active} onClick={() => setStore(c)}><StoreBrand name={c.store_name} fallback={<Icon name="bag" size={32} />} /><span><small>{FOOD_CHOICES.find(f => f.id === c.menu_key)?.name}</small><h2>{c.store_name}</h2><p>메뉴 {c.menus.length}개 · 목표 {money(c.goal_amount)}</p></span><Icon name="chevron" size={19} /></button>)}</div>{!found.length && <div className="bv-empty"><h2>검색한 가게가 없어요</h2><button className="baef-text-action" onClick={() => { setQuery(''); setCategory('all') }}>검색 조건 지우기</button></div>}{store && <StoreSheet intent="create" store={store} close={() => setStore(null)} push={push} />}</div></div>
}
export function LiveOrders({ push }: { push: Navigate }) {
  const s = useSharedDelivery(), o = useDeliveryLifecycle()
  const participated = s.rawPosts.filter(p => s.members.some(m => m.post_id === p.id && m.user_id === s.session?.user.id)).sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime())
  return <div className="baef-scroll"><div className="bv-page live-orders"><span className="bv-eyebrow">함께한 한 끼의 기록</span><h1 className="bv-screen-heading">내 주문</h1>{!s.session ? <div className="bv-empty"><Icon name="bag" size={32} /><h2>로그인하고 내 주문을 확인해요</h2><button className="baef-button" onClick={() => s.setLoginOpen(true)}>로그인</button></div> : <div className="live-order-history">{participated.map(p => {
    const state = o.states.find(v => v.post_id === p.id), member = s.members.find(m => m.post_id === p.id && m.user_id === s.session?.user.id)!, active = member.active && !['completed', 'cancelled'].includes(p.status), image = liveStorePhoto(p.restaurant), target = member.status === 'withdrawn' || state?.phase === 'cancelled' ? 'payment' : member.status === 'accepted' ? 'order' : 'detail'
    return <article className="baef-order-list-item" key={p.id}><button onClick={() => { s.selectPost(s.numberFor(p.id)); push(target) }}>{image && <img src={image} alt="" />}<span><small data-active={active}>{member.status === 'pending' && member.active ? '수락 대기' : member.status === 'rejected' ? '신청 거절' : member.status === 'withdrawn' ? '참가 취소' : state ? phaseLabel[state.phase] : active ? '모집 중' : '참가 종료'}</small><h2>{p.restaurant}</h2><p>{p.member_count}명 · {p.meeting}</p></span><Icon name="chevron" size={20} /></button><CancelOrderControl postId={p.id}/></article>
  })}{!participated.length && <div className="bv-empty"><Icon name="bag" size={32} /><h2>아직 함께한 주문이 없어요</h2><p>먹고 싶은 메뉴가 있는 모집을 찾아보세요.</p><button className="baef-button" onClick={() => push('main')}>모집 둘러보기</button></div>}</div>}</div></div>
}
