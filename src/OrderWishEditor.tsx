import {displayStoreName} from './storeNames'
import {useState} from 'react'
import {useMenuDiscovery,money,formatWindow} from './MenuDiscoveryContext'
import {useSharedDelivery} from './SharedDelivery'
import {flexibilityChoices,type OrderWish} from './orderSuggestions'
import {LocationChoice} from './MenuDiscovery'
import {Modal} from './ui/Modal'
export default function OrderWishEditor({close}:{close:()=>void}){
 const d=useMenuDiscovery(),s=useSharedDelivery()
 const [wish,setWish]=useState<OrderWish>(()=>{const store=d.catalog.find(c=>c.store_name===d.intent?.wish_store)??d.catalog[0];return {store:store?.store_name??'',menu:d.intent?.wish_menu_id??store?.menus[0]?.id??0,quantity:d.intent?.wish_quantity??1,flexibility:d.intent?.flexibility??'exact',ready:d.intent?!!d.intent.ready_until&&Date.parse(d.intent.ready_until)>Date.now():true}})
 const store=d.catalog.find(c=>c.store_name===wish.store),item=store?.menus.find(m=>m.id===wish.menu)
 const reason=s.active?'진행 중인 주문을 먼저 확인해 주세요.':!item?'먹고 싶은 메뉴를 골라 주세요.':!Number.isInteger(wish.quantity)||wish.quantity<1||wish.quantity>10?'수량은 1~10개로 정해 주세요.':!d.matchLocation?'내 출발 위치를 정해 주세요.':''
 return <Modal title="먹고 싶은 메뉴로 배프 찾기" close={close} footer={<><button className="baef-button" disabled={d.saving||!!reason} onClick={()=>void d.saveOrderWish(wish).then(ok=>{if(ok)close()})}>{d.saving?'저장 중…':wish.ready?'지금 주문할 조합 찾기':'이 조건으로 조합 찾기'}</button>{reason&&<p className="baef-button-hint">{reason}</p>}</>}>
  <p className="baef-muted">원하는 메뉴는 먼저 정하고, 바뀌어도 괜찮은 범위만 선택해요.</p><div className="baef-order-form"><label>가장 먹고 싶은 가게<select value={wish.store} onChange={e=>{const c=d.catalog.find(v=>v.store_name===e.target.value);if(c)setWish(w=>({...w,store:c.store_name,menu:c.menus[0]?.id??0}))}}>{d.catalog.map(c=><option key={c.store_name} value={c.store_name}>{displayStoreName(c.store_name)}</option>)}</select></label><label>원하는 메뉴<select value={wish.menu} onChange={e=>setWish(w=>({...w,menu:Number(e.target.value)}))}>{store?.menus.map(m=><option key={m.id} value={m.id}>{m.name} · {money(m.price)}</option>)}</select></label><label>수량<input type="number" min="1" max="10" inputMode="numeric" value={wish.quantity||''} onChange={e=>setWish(w=>({...w,quantity:Number(e.target.value)}))}/></label></div>
  <fieldset className="baef-flexibility"><legend>어디까지 바뀌어도 괜찮나요?</legend>{flexibilityChoices.map(([value,title,description])=><label key={value}><input type="radio" name="order-flexibility" value={value} checked={wish.flexibility===value} onChange={()=>setWish(w=>({...w,flexibility:value}))}/><span><b>{title}</b><small>{description}</small></span></label>)}</fieldset>
  <label className="baef-ready-choice"><input type="checkbox" checked={wish.ready} onChange={e=>setWish(w=>({...w,ready:e.target.checked}))}/><span><b>지금 주문할 수 있어요</b><small>저장한 뒤 15분 동안 유효해요. 지금 가능한 배프가 있는 조합을 우선 보여줘요.</small></span></label>
  {!wish.ready&&<div className="baef-order-form"><label>주문 희망 날짜<select value={d.day} onChange={e=>d.setDay(Number(e.target.value))}><option value={0}>오늘</option><option value={1}>내일</option></select></label><label>주문 희망 시간<select value={d.hour} onChange={e=>d.setHour(Number(e.target.value))}>{Array.from({length:12},(_,i)=>i+11).map(h=><option key={h} value={h}>{h}:00–{h+1}:00</option>)}</select></label></div>}
  <LocationChoice/>{d.intent&&<div className="live-interest-current"><p>{formatWindow(d.intent.starts_at,d.intent.ends_at)} 조건 저장 중</p><button className="baef-text-cancel" disabled={d.saving} onClick={()=>void d.cancel()}>메뉴 기다리기 취소</button></div>}{d.error&&<p className="baef-error" role="alert">{d.error}</p>}
 </Modal>
}
