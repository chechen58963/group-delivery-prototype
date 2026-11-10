import type { FlowEvent } from './workflow'

export type SharedNotification = FlowEvent & {
  id:number; postId:number; sharedPostId:string; restaurant:string; read:boolean; time:number; eventKey?:string
}
type StorageLike=Pick<Storage,'getItem'|'setItem'>
const targets=new Set(['menu','detail','applicants','chat','payment','delivery','receipt','complete'])
const key=(uid:string,kind:string)=>`baef-history-v1:${uid}:${kind}`
export function readAccountHistory<T>(uid:string,kind:string,fallback:T,storage?:StorageLike):T{
  try{return JSON.parse((storage??localStorage).getItem(key(uid,kind))??'null')??fallback}catch{return fallback}
}
export function saveAccountHistory(uid:string,kind:string,value:unknown,storage?:StorageLike){
  try{(storage??localStorage).setItem(key(uid,kind),JSON.stringify(value))}catch{/* Keep the current session usable when storage is unavailable. */}
}
export function restoreNotifications(uid:string,storage?:StorageLike):SharedNotification[]{
  const value=readAccountHistory<unknown>(uid,'notifications',[],storage)
  if(!Array.isArray(value))return []
  return value.filter((n):n is SharedNotification=>!!n&&Number.isSafeInteger(n.id)&&typeof n.sharedPostId==='string'&&typeof n.restaurant==='string'&&typeof n.text==='string'&&targets.has(n.target)&&typeof n.read==='boolean'&&Number.isFinite(n.time)).slice(0,100)
}
export function restoreChatCursors(uid:string,storage?:StorageLike):Record<string,number>{
  const saved=readAccountHistory<unknown>(uid,'chat-cursors',{},storage)
  return saved&&typeof saved==='object'&&!Array.isArray(saved)?Object.fromEntries(Object.entries(saved).filter(([,id])=>Number.isSafeInteger(id)&&Number(id)>=0)):{}
}
export function appendNotification(list:SharedNotification[],item:SharedNotification){
  return item.eventKey&&list.some(n=>n.eventKey===item.eventKey)?list:[item,...list].slice(0,100)
}
export function mergeChatMessages<T extends {id:number}>(before:T[],incoming:T[]):T[]{
  const merged=new Map(before.map(message=>[message.id,message]))
  for(const message of incoming)merged.set(message.id,message)
  return [...merged.values()].sort((a,b)=>a.id-b.id)
}
