import type {MenuStore,StoreDraft} from './MenuDiscoveryContext'
import {menuPresentation} from './menuSelection'
import {pickupDay, recruitmentDeadline} from './pickupTime'
import {displayStoreName} from './storeNames'
export type Flexibility='exact'|'brand'|'similar'
export type OrderWish={store:string;menu:number;quantity:number;flexibility:Flexibility;ready:boolean}
export type OrderSuggestion={id:string;store:string;menu_key:string;goal:number;my_item:{id:number;name:string;price:number};other_item:{id:number;name:string;price:number};my_quantity:number;other_quantity:number;other_name:string;other_virtual:boolean;food_total:number;shortfall:number;delivery_fee:number;my_fee:number;my_total:number;ready_count:number;compromises:number;meeting:string;meeting_lat:number;meeting_lng:number;walk_m:number;starts_at:string;expires_at:string}
export const flexibilityChoices:[Flexibility,string,string][]=[
 ['exact','꼭 이 가게·메뉴','선택한 가게와 메뉴를 그대로 찾아요'],
 ['brand','다른 가게도 괜찮아요','아메리카노·카페 라떼 등 같은 종류를 찾아요'],
 ['similar','비슷한 메뉴도 괜찮아요','같은 카테고리의 다른 메뉴도 제안받아요'],
]
export type WishSearch = { query: string; category: string }

export const normalizeMenuSearch = (value: string) => value.toLowerCase().replace(/\s+/g, '')

export function findWishStores(catalog: MenuStore[], { query, category }: WishSearch): MenuStore[] {
  const term = normalizeMenuSearch(query)
  if (!term) return []
  const exact: MenuStore[] = []
  const partial: MenuStore[] = []
  for (const store of catalog) {
    if (category !== 'all' && store.menu_key !== category) continue
    const brand = displayStoreName(store.store_name)
    const matches = store.menus.filter(menu => normalizeMenuSearch(brand + menu.name).includes(term))
    if (!matches.length) continue
    partial.push({ ...store, menus: matches })
    const exactMenus = matches.filter(menu => normalizeMenuSearch(menu.name) === term || normalizeMenuSearch(brand + menu.name) === term)
    if (exactMenus.length) exact.push({ ...store, menus: exactMenus })
  }
  return exact.length ? exact : partial
}

export function suggestionDraft(offer:OrderSuggestion,catalog:MenuStore[],now=Date.now()):StoreDraft|null{
 const store=catalog.find(c=>c.store_name===offer.store),item=store?.menus.find(m=>m.id===offer.my_item.id)
 const start=new Date(offer.starts_at)
 if(!item||item.name!==offer.my_item.name||item.price!==offer.my_item.price||!Number.isFinite(start.getTime())||start.getTime()<=now||Date.parse(offer.expires_at)<=start.getTime())return null
 const deadline = recruitmentDeadline(start, now)
 if (!deadline) return null
 const options=menuPresentation(offer.store,item).temperature_options
 const key=options.includes('ICE')?`${item.id}:ICE`:options.includes('HOT')?`${item.id}:HOT`:String(item.id)
 return {quantities:{[key]:offer.my_quantity},goal:String(offer.goal),maxMembers:2,fee:String(offer.delivery_fee),meeting:offer.meeting,note:'',deliveryDay:pickupDay(start),deliveryClock:`${String(start.getHours()).padStart(2,'0')}:${String(start.getMinutes()).padStart(2,'0')}`,deadline,publicPoint:{lat:offer.meeting_lat,lng:offer.meeting_lng}}
}
