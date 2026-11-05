import type { MenuMatch, MenuNotification } from './MenuDiscoveryContext'
export function matchPrompts(alerts:MenuNotification[],matches:MenuMatch[]){
  return matches.filter(m=>Number(m.people_count)>0).flatMap(match=>{
    const notes=alerts.filter(n=>n.kind==='menu_match'&&n.payload.stores.includes(match.store_name))
    return notes.length?[{store:match.store_name,count:Number(match.people_count),ids:notes.map(n=>n.id),unread:notes.some(n=>!n.read_at),createdAt:notes.map(n=>n.created_at).sort().at(-1)!}]:[]
  }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.count-a.count)
}
