import {displayStoreName} from './storeNames'
import {useMenuDiscovery,money} from './MenuDiscoveryContext'
import {useSharedDelivery} from './SharedDelivery'
import {useNow} from './useNow'
import StoreBrand from './StoreBrand'
import type {Screen} from './navigationTypes'
export default function OrderSuggestions({configure,push,close}:{configure?:()=>void;push?:(screen:Screen)=>void;close?:()=>void}){
 const d=useMenuDiscovery(),s=useSharedDelivery(),now=useNow(15000)
 if(!s.session||!d.suggestionsReady||s.active)return null
 const offers=d.suggestions.filter(v=>Date.parse(v.expires_at)>now+300000)
 const intent=d.intent,wish=d.catalog.find(c=>c.store_name===intent?.wish_store)?.menus.find(m=>m.id===intent?.wish_menu_id)
 return <section className="baef-order-suggestions" aria-label="내 메뉴로 함께 주문할 조합">
   <header><div><span className="bv-eyebrow">내 메뉴로 함께 주문하기</span><h2>{intent?.wish_store?'함께 주문할 조합을 찾고 있어요':'오늘 먹고 싶은 메뉴부터 골라요'}</h2></div>{configure&&<button className="baef-match-configure" onClick={configure}>{intent?.wish_store?'조건 변경':'메뉴·타협 범위 선택'}</button>}</header>
   {wish&&<p className="baef-match-current"><b>{displayStoreName(intent?.wish_store)} · {wish.name} {intent?.wish_quantity??1}개</b><span>{intent?.flexibility==='brand'?'다른 가게의 같은 종류도 가능':intent?.flexibility==='similar'?'같은 카테고리의 다른 메뉴도 가능':'선택한 가게·메뉴 유지'}{intent?.ready_until&&Date.parse(intent.ready_until)>now?' · 지금 주문 가능':''}</span></p>}
   {d.suggestionsError?<div role="status"><p>{d.suggestionsError}</p><button className="baef-text-action" onClick={d.refresh}>다시 불러오기</button></div>:offers.length?<><p className="baef-muted">지금 주문 가능한 사람이 있는 조합을 먼저 보여줘요. 상대에게 모집을 알리고 참가 신청은 리더가 수락해요.</p><div className="baef-match-grid">{offers.map(v=><article className="baef-match-card" key={v.id}><div className="baef-match-store"><StoreBrand name={v.store}/><b>{displayStoreName(v.store)}</b><span>{v.ready_count===2?'둘 다 지금 주문 가능':v.ready_count===1?'1명 지금 주문 가능':'시간대가 맞는 조합'}</span></div><dl><dt>내 메뉴</dt><dd>{v.my_item.name} {v.my_quantity}개 · {money(v.my_item.price*v.my_quantity)}</dd><dt>{v.other_name}{v.other_virtual?' · 가상 유저':''}</dt><dd>{v.other_item.name} {v.other_quantity}개 · {money(v.other_item.price*v.other_quantity)}</dd><dt>함께 받을 곳</dt><dd>{v.meeting} · 각자 직선 최대 약 {v.walk_m}m</dd></dl><div className="baef-match-cost"><span>내 예상 합계 <b>{money(v.my_total)}</b></span><small>음식값 + 배달비 {money(v.my_fee)} · 배달비 {money(v.delivery_fee-v.my_fee)} 절약 예상</small></div><p className={`baef-match-goal ${v.shortfall?'short':'met'}`}>{v.shortfall?`두 사람 메뉴로는 목표금액까지 ${money(v.shortfall)} 부족해요.`:'두 사람 메뉴로 목표 주문금액을 채워요.'}</p>{v.compromises>0&&<p className="baef-muted">허용한 범위 안에서 가게나 메뉴가 달라진 조합이에요. 내 메뉴를 확인해 주세요.</p>}<button className="baef-button secondary" disabled={d.saving} onClick={()=>void (async()=>{const ids=d.alerts.filter(n=>n.kind==='menu_match'&&n.payload.stores.includes(v.store)).map(n=>n.id);if(ids.length)await d.readAlerts(ids);if(await d.startSuggestedOrder(v)){close?.();push?.('create')}})()}>이 조합으로 모집 준비</button></article>)}</div><p className="baef-muted">배달비 3,000원을 두 명이 나누는 예상 금액이에요. 모집 준비에서 메뉴·인원·배달비를 확인하고 변경할 수 있어요.</p></>:<p className="baef-match-empty">{d.loading?'주문할 조합을 확인하고 있어요.':intent?.wish_store?'아직 맞는 조합이 없어요. 출발 위치·시간·허용한 메뉴와 두 사람 모두 400m 이내인 공개 수령점을 기준으로 찾아요.':'원하는 가게·메뉴와 타협 범위를 저장하면, 근처 배프와 함께 주문할 메뉴와 예상 비용을 제안해요.'}</p>}
 </section>
}
