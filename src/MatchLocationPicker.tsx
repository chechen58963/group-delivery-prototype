import { useEffect, useRef, useState } from 'react'
import * as L from 'leaflet'
import { CAMPUS_CENTER } from './campus'
import type { MatchLocation } from './matchingLocation'

export default function MatchLocationPicker({point,onChange}:{point:MatchLocation|null;onChange:(p:MatchLocation)=>void}) {
  const container=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),marker=useRef<L.CircleMarker|null>(null)
  const tile=useRef<L.TileLayer|null>(null),[tileError,setTileError]=useState(false)
  const change=useRef(onChange);change.current=onChange
  useEffect(()=>{
    if(!container.current)return
    const start=point??CAMPUS_CENTER
    const m=L.map(container.current,{center:[start.lat,start.lng],zoom:16,scrollWheelZoom:false})
    map.current=m
    tile.current=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(m)
    tile.current.on('tileerror',()=>setTileError(true));tile.current.on('load',()=>setTileError(false))
    m.on('click',(e:L.LeafletMouseEvent)=>change.current({lat:e.latlng.lat,lng:e.latlng.lng}))
    const resize=new ResizeObserver(()=>m.invalidateSize({pan:false}));resize.observe(container.current)
    return()=>{resize.disconnect();m.remove();map.current=null;marker.current=null;tile.current=null}
  },[])
  useEffect(()=>{
    const m=map.current;if(!m)return
    if(!point){marker.current?.remove();marker.current=null;return}
    if(marker.current)marker.current.setLatLng([point.lat,point.lng])
    else marker.current=L.circleMarker([point.lat,point.lng],{radius:9,color:'#df592c',fillOpacity:.7}).addTo(m)
    if(!m.getBounds().contains([point.lat,point.lng]))m.setView([point.lat,point.lng],m.getZoom(),{animate:false})
  },[point?.lat,point?.lng])
  return <div className="baef-origin-picker"><div ref={container} className="baef-origin-map" role="region" aria-label="출발 위치 지도 · 원하는 위치를 눌러 선택"/>
    {tileError&&<p className="baef-error" role="status">지도 배경을 불러오지 못했어요. 연결 상태를 확인해 주세요. <button type="button" className="baef-text-action" onClick={()=>{setTileError(false);tile.current?.redraw()}}>지도 다시 불러오기</button></p>}
    <div className="baef-origin-actions"><button type="button" className="baef-button secondary" onClick={()=>{const center=map.current?.getCenter();if(center)change.current({lat:center.lat,lng:center.lng})}}>현재 지도 중심 선택</button>{point&&<button type="button" className="baef-button secondary" onClick={()=>map.current?.setView([point.lat,point.lng],16,{animate:false})}>선택 위치로 이동</button>}</div>
  </div>
}
