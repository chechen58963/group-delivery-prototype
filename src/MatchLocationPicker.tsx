import { useEffect, useRef } from 'react'
import * as L from 'leaflet'
import { CAMPUS_CENTER } from './campus'
import type { MatchLocation } from './matchingLocation'

export default function MatchLocationPicker({point,onChange}:{point:MatchLocation|null;onChange:(p:MatchLocation)=>void}) {
  const container=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),marker=useRef<L.CircleMarker|null>(null)
  const change=useRef(onChange);change.current=onChange
  useEffect(()=>{
    if(!container.current)return
    const start=point??CAMPUS_CENTER
    const m=L.map(container.current,{center:[start.lat,start.lng],zoom:16,scrollWheelZoom:false})
    map.current=m
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(m)
    m.on('click',(e:L.LeafletMouseEvent)=>change.current({lat:e.latlng.lat,lng:e.latlng.lng}))
    const resize=new ResizeObserver(()=>m.invalidateSize({pan:false}));resize.observe(container.current)
    return()=>{resize.disconnect();m.remove();map.current=null;marker.current=null}
  },[])
  useEffect(()=>{
    const m=map.current;if(!m)return
    if(!point){marker.current?.remove();marker.current=null;return}
    if(marker.current)marker.current.setLatLng([point.lat,point.lng])
    else marker.current=L.circleMarker([point.lat,point.lng],{radius:9,color:'#df592c',fillOpacity:.7}).addTo(m)
  },[point?.lat,point?.lng])
  return <div ref={container} className="baef-origin-map" role="region" aria-label="출발 위치 지도 · 원하는 위치를 눌러 선택"/>
}
