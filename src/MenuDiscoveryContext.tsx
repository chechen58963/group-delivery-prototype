import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useSharedDelivery } from './SharedDelivery'
import { CAMPUS_STORES } from './campus'

export const FOOD_CHOICES = [
  { id: 'coffee', name: '커피', subtitle: '한 잔만 필요할 때', photo: '1509042239860-f550ce710b93' },
  { id: 'burger', name: '햄버거', subtitle: '버거 하나도 가볍게', photo: '1568901346375-23c9450c58cd' },
  { id: 'sandwich', name: '샌드위치', subtitle: '간단하게 한 끼', photo: '1528735602780-2552fd46c7af' },
] as const
export const PICKUP_AREAS = [
  { id: 'cnu-main', name: '충남대 정문', detail: '정문 앞·궁동 로데오 주변' },
  { id: 'cnu-north', name: '충남대 후문', detail: '후문·농대입구 주변' },
  { id: 'gungdong', name: '궁동', detail: '궁동 공영주차장 주변' },
] as const
export type CatalogItem = { id: number; name: string; price: number }
export type MenuStore = { store_name: string; menu_key: string; goal_amount: number; menus: CatalogItem[] }
export type MenuIntent = { user_id: string; menus: string[]; stores: string[]; starts_at: string; ends_at: string; area_id: string; active: boolean }
export type MenuMatch = { store_name: string; people_count: number }
export type MenuNotification = { id: string; kind: 'menu_match' | 'group_invite'; payload: { stores: string[]; area: string; post_id?: string; starts_at?: string; ends_at?: string }; created_at: string; expires_at: string; read_at: string | null }
export type Basket = { post_id: string; user_id: string; items: (CatalogItem & { quantity: number })[]; total: number }
const fallbackCatalog: MenuStore[] = CAMPUS_STORES.filter(s => ['카페', '버거', '패스트푸드'].includes(s.category)).map(s => ({
  store_name: s.name, menu_key: s.category === '카페' ? 'coffee' : s.category === '버거' ? 'burger' : 'sandwich', goal_amount: s.demoMinOrder, menus: s.menus,
}))
export const money = (n: number) => n.toLocaleString('ko-KR') + '원'
export const areaName = (id: string) => PICKUP_AREAS.find(a => a.id === id)?.name ?? '충남대 정문'
export function formatWindow(start: string, end: string) {
  const a=new Date(start), b=new Date(end)
  const date=a.toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'})
  return `${date} ${a.getHours()}:${String(a.getMinutes()).padStart(2,'0')}–${b.getHours()}:${String(b.getMinutes()).padStart(2,'0')}`
}
function defaultSlot() { const h=new Date().getHours(); return h<18?18:h<22?h:18 }
function useDiscoveryState() {
  const shared=useSharedDelivery(), uid=shared.session?.user.id
  const [catalog,setCatalog]=useState<MenuStore[]>(fallbackCatalog)
  const [menus,setMenus]=useState<string[]>([])
  const [stores,setStores]=useState<string[]>([])
  const [day,setDay]=useState(new Date().getHours()>=22?1:0)
  const [hour,setHour]=useState(defaultSlot)
  const [area,setArea]=useState('cnu-main')
  const [intent,setIntent]=useState<MenuIntent|null>(null)
  const [matches,setMatches]=useState<MenuMatch[]>([])
  const [alerts,setAlerts]=useState<MenuNotification[]>([])
  const [baskets,setBaskets]=useState<Basket[]>([])
  const [connected,setConnected]=useState(false)
  const [loading,setLoading]=useState(false)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [toast,setToast]=useState('')
  const lock=useRef(false), epoch=useRef(0)
  const currentUid=useRef(uid);currentUid.current=uid
  const activeIntent=intent?.active && new Date(intent.ends_at).getTime()>Date.now()?intent:null
  const candidateStores=catalog.filter(c=>menus.includes(c.menu_key))
  const toggleMenu=(id:string)=>{
    const next=menus.includes(id)?menus.filter(m=>m!==id):[...menus,id]
    setMenus(next);setStores(previous=>catalog.filter(c=>next.includes(c.menu_key)&&(previous.includes(c.store_name)||!menus.includes(c.menu_key))).map(c=>c.store_name))
  }
  const toggleStore=(name:string)=>setStores(values=>values.includes(name)?values.filter(n=>n!==name):[...values,name])
  useEffect(()=>{
    let alive=true
    void supabase.from('gd_menu_catalog').select('*').then(r=>{if(alive&&r.data?.length)setCatalog(r.data as MenuStore[])})
    return ()=>{alive=false}
  },[])
  useEffect(()=>{
    const generation=++epoch.current
    setIntent(null);setMatches([]);setAlerts([]);setBaskets([]);setConnected(false);setError('')
    if(!uid||!shared.allowed)return
    let alive=true,running=false,hydrated=false
    let seen:Set<string>|null=null
    const load=async()=>{
      if(running)return;running=true;setLoading(true)
      try{
        const [own,found,notes,orders]=await Promise.all([
          supabase.from('gd_intents').select('*').eq('user_id',uid).maybeSingle(),
          supabase.rpc('gd_find_menu_matches'),
          supabase.from('gd_menu_notifications').select('*').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(50),
          supabase.from('gd_baskets').select('*'),
        ])
        for(const r of [own,found,notes,orders])if(r.error)throw r.error
        if(!alive||epoch.current!==generation)return
        const value=own.data as MenuIntent|null
        setIntent(value);setMatches((found.data??[]) as MenuMatch[]);setBaskets((orders.data??[]) as Basket[])
        const next=(notes.data??[]) as MenuNotification[]
        if(seen){const fresh=next.find(n=>!seen!.has(n.id)&&!n.read_at);if(fresh)setToast(fresh.kind==='group_invite'?'함께 주문할 모집이 열렸어요. 알림을 확인해 보세요.':'메뉴와 시간이 맞는 배프가 있어요. 알림을 확인해 보세요.')}
        seen=new Set(next.map(n=>n.id));setAlerts(next);setConnected(true);setError('')
        if(!hydrated&&value?.active&&new Date(value.ends_at).getTime()>Date.now()){
          setMenus(value.menus);setStores(value.stores);setArea(value.area_id)
          const d=new Date(value.starts_at);setHour(d.getHours());setDay(d.toDateString()===new Date().toDateString()?0:1)
        }
        hydrated=true
      }catch(e){
        if(alive&&epoch.current===generation){
          const code=(e as {code?:string}).code
          setConnected(false)
          setError(code==='PGRST205'||code==='PGRST202'?'메뉴 알림 연결을 준비하고 있어요. 잠시 후 다시 시도해 주세요.':'메뉴 선택을 불러오지 못했어요. 연결 상태를 확인해 주세요.')
        }
      }finally{running=false;if(alive)setLoading(false)}
    }
    void load();const timer=setInterval(()=>{if(!document.hidden)void load()},5000)
    window.addEventListener('menu-discovery-refresh',load);window.addEventListener('focus',load)
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('menu-discovery-refresh',load);window.removeEventListener('focus',load)}
  },[uid,shared.allowed])
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),6500);return()=>clearTimeout(timer)},[toast])
  const refresh=()=>window.dispatchEvent(new Event('menu-discovery-refresh'))
  const run=async(fn:()=>PromiseLike<{error:unknown}>)=>{
    if(lock.current)return false
    if(!uid){shared.setLoginOpen(true);return false}
    if(!shared.allowed){setError('계정의 이용 권한을 확인해 주세요.');return false}
    lock.current=true;setSaving(true);setError('')
    try{const r=await fn();if(r.error)throw r.error;if(currentUid.current!==uid)return false;refresh();return true}
    catch(e){if(currentUid.current===uid)setError((e as {message?:string}).message??'저장하지 못했어요. 다시 시도해 주세요.');return false}
    finally{lock.current=false;setSaving(false)}
  }
  const save=async()=>{
    if(!menus.length||!stores.length){setError('먹고 싶은 메뉴와 가능한 가게를 한 곳 이상 골라 주세요.');return false}
    const start=new Date();start.setDate(start.getDate()+day);start.setHours(hour,0,0,0)
    const end=new Date(start.getTime()+3600000)
    if(end.getTime()<=Date.now()){setError('아직 지나지 않은 시간대를 골라 주세요.');return false}
    const result=await run(()=>supabase.rpc('gd_save_intent',{p_menus:menus,p_stores:stores,p_start:start.toISOString(),p_end:end.toISOString(),p_area:area}))
    if(result)setToast('선택을 저장했어요. 메뉴와 시간이 맞는 사람이 생기면 알려드릴게요.')
    return result
  }
  const savedDate=new Date();savedDate.setDate(savedDate.getDate()+day);savedDate.setHours(hour,0,0,0)
  const sameSelection=!!activeIntent&&activeIntent.area_id===area&&new Date(activeIntent.starts_at).getTime()===savedDate.getTime()
    &&[...activeIntent.menus].sort().join('|')===[...menus].sort().join('|')
    &&[...activeIntent.stores].sort().join('|')===[...stores].sort().join('|')
  const currentAlerts=alerts.filter(n=>n.kind!=='menu_match'||(activeIntent&&!shared.active&&n.payload.stores.some(store=>matches.some(m=>m.store_name===store&&Number(m.people_count)>0))))
  return {catalog,menus,stores,day,hour,area,setDay,setHour,setArea,toggleMenu,toggleStore,candidateStores,
    intent:activeIntent,matches,visibleMatches:sameSelection?matches:[],alerts:currentAlerts,baskets,connected,loading,saving,error,setError,toast,setToast,save,refresh,
    cancel:async()=>{if(await run(()=>supabase.rpc('gd_cancel_intent'))) {setIntent(null);setMatches([]);setToast('메뉴 기다리기를 취소했어요.')}},
    readAlerts:async(ids:string[])=>{if(await run(()=>supabase.rpc('gd_mark_menu_notifications',{p_ids:ids})))setAlerts(values=>values.map(n=>ids.includes(n.id)?{...n,read_at:new Date().toISOString()}:n))},
    saveBasket:async(post:string,items:{id:number;quantity:number}[])=>run(()=>supabase.rpc('gd_save_basket',{p_post:post,p_items:items})),
    invite:async(post:string)=>run(()=>supabase.rpc('gd_invite_menu_matches',{p_post:post})),
  }
}
type Discovery=ReturnType<typeof useDiscoveryState>
const Context=createContext<Discovery|null>(null)
export function MenuDiscoveryProvider({children}:{children:ReactNode}){const value=useDiscoveryState();return <Context.Provider value={value}>{children}</Context.Provider>}
export function useMenuDiscovery(){const value=useContext(Context);if(!value)throw new Error('MenuDiscoveryProvider is required');return value}
