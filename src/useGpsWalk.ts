import { useEffect, useRef, useState } from 'react'
import { appendWalkFix, emptyWalkTrack, type WalkTrack } from './gpsWalk'

type Record = { post: string; meters: number }
export function useGpsWalk(uid: string | undefined, eligible: string[]) {
  const [record,setRecord] = useState<Record | null>(null)
  const [recording,setRecording] = useState(false), [message,setMessage] = useState('')
  const [status,setStatus]=useState<'idle'|'locating'|'recording'|'paused'|'error'|'limit'>('idle')
  const track = useRef<WalkTrack>(emptyWalkTrack()), room = useRef<string | null>(null)
  const watch = useRef<number | null>(null), owner = useRef(uid), generation = useRef(0)
  owner.current=uid
  const key = uid ? `baef-gps-walk:${uid}` : null
  function persist(post: string, meters: number) {
    if(!key)return
    try { sessionStorage.setItem(key,JSON.stringify({post,meters})) } catch { /* Recording still works without storage. */ }
  }
  const stop = (text = '',nextStatus:typeof status='paused') => {
    generation.current++
    if(watch.current!==null) navigator.geolocation?.clearWatch(watch.current)
    watch.current=null;track.current={...track.current,anchor:null};setRecording(false);setStatus(nextStatus)
    if(text)setMessage(text)
    return Math.floor(track.current.meters)
  }
  useEffect(()=>{
    stop('', 'idle');room.current=null;track.current=emptyWalkTrack();setRecord(null);setMessage('')
    if(key)try {
      const saved=JSON.parse(sessionStorage.getItem(key)??'null')
      if(saved&&typeof saved.post==='string'&&Number.isFinite(saved.meters)&&saved.meters>=0&&saved.meters<=400){
        room.current=saved.post;track.current={...emptyWalkTrack(),meters:saved.meters};setRecord(saved)
        setMessage('이전 기록을 불러왔어요. 출발 버튼을 누르면 이어서 기록해요.')
        setStatus(saved.meters>=400?'limit':'paused')
      }
    } catch { /* Ignore malformed saved values. */ }
    return ()=>{generation.current++;if(watch.current!==null)navigator.geolocation?.clearWatch(watch.current);watch.current=null}
  },[uid])
  const eligibility=eligible.join('|')
  useEffect(()=>{
    if(room.current&&!eligible.includes(room.current))stop()
  },[eligibility])
  useEffect(()=>{
    const hidden=()=>{if(document.hidden&&watch.current!==null)stop('화면을 벗어나 기록을 멈췄어요. 돌아오면 이어서 출발해 주세요.')}
    document.addEventListener('visibilitychange',hidden)
    return()=>document.removeEventListener('visibilitychange',hidden)
  },[])
  function start(post: string) {
    if(!uid||!eligible.includes(post))return
    stop()
    if(room.current!==post){room.current=post;track.current=emptyWalkTrack();setRecord({post,meters:0})}
    if(track.current.meters>=400){stop('이번 모임의 이동 적립 한도 400m를 기록했어요.','limit');return}
    if(!window.isSecureContext||!navigator.geolocation){setMessage('이 기기에서는 위치를 기록할 수 없어요. HTTPS 주소와 위치 권한을 확인해 주세요.');setStatus('error');return}
    const own=uid, token=++generation.current
    setRecording(true);setStatus('locating');setMessage('GPS 위치를 확인하고 있어요…')
    try { watch.current=navigator.geolocation.watchPosition(position=>{
      if(owner.current!==own||generation.current!==token||document.hidden)return
      const c=position.coords
      const next=appendWalkFix(track.current,{lat:c.latitude,lng:c.longitude,accuracy:c.accuracy,time:position.timestamp})
      track.current=next;setRecord({post,meters:Math.floor(next.meters)});persist(post,next.meters)
      setStatus(c.accuracy>35?'locating':'recording')
      setMessage(c.accuracy>35?'위치 오차가 커서 기다리고 있어요. 야외에서 다시 확인해 주세요.':'이동을 기록하고 있어요. 수령할 때까지 화면을 열어 두세요.')
      if(next.meters>=400)stop('이번 모임의 이동 적립 한도 400m를 기록했어요.','limit')
    },error=>{
      if(owner.current!==own||generation.current!==token)return
      stop(error.code===1?'위치 권한을 허용해야 이동을 기록할 수 있어요.':error.code===3?'위치를 찾는 데 시간이 걸려요. 출발 버튼으로 다시 시도해 주세요.':'위치를 확인하지 못했어요. 야외에서 다시 시도해 주세요.','error')
    },{enableHighAccuracy:true,maximumAge:0,timeout:15000}) } catch {
      stop('위치 기록을 시작하지 못했어요. 브라우저의 위치 권한을 확인해 주세요.','error')
    }
  }
  return {record,recording,message,status,start,stop}
}
