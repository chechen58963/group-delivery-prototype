import { useEffect, useRef, useState } from 'react'
import type { Screen } from './WorkflowScreens'

const screens=new Set<Screen>(['main','category','list','create','detail','applicants','chat','menu','payment','delivery','receipt','complete','rating','profile'])
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const orderScreens=new Set<Screen>(['detail','applicants','chat','menu','payment','delivery','receipt','complete','rating'])
export function readAppRoute(search:string){
 const params=new URLSearchParams(search),candidate=params.get('screen') as Screen
 return {screen:screens.has(candidate)?candidate:'main' as Screen,order:uuid.test(params.get('order')??'')?params.get('order'):null}
}
export function useAppNavigation(){
 const [route,setRoute]=useState(()=>({...readAppRoute(location.search),revision:0}))
 const restore=useRef<string|null>(route.order)
 const write=(screen:Screen,order:string|null,replace=false)=>{
  restore.current=null
  const url=new URL(location.href);url.searchParams.delete('screen');url.searchParams.delete('order')
  if(screen!=='main')url.searchParams.set('screen',screen)
  if(order&&orderScreens.has(screen))url.searchParams.set('order',order)
  const depth=Number(history.state?.baefDepth??0)+(replace?0:1)
  history[replace?'replaceState':'pushState']({...history.state,baefDepth:depth},'',url)
  setRoute(v=>({screen,order:orderScreens.has(screen)?order:null,revision:v.revision+1}))
 }
 useEffect(()=>{
  if(!Number.isInteger(history.state?.baefDepth))history.replaceState({...history.state,baefDepth:0},'')
  const back=()=>{const next=readAppRoute(location.search);restore.current=next.order;setRoute(v=>({...next,revision:v.revision+1}))}
  window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back)
 },[])
 return {route,restore,
  push:(screen:Screen,order:string|null=null)=>{restore.current=null;if(screen!==route.screen||order!==route.order)write(screen,order)},
  replace:(screen:Screen,order:string|null=null)=>write(screen,order,true),
  pop:()=>{if(Number(history.state?.baefDepth??0)>0)history.back();else write('main',null,true)}
 }
}
