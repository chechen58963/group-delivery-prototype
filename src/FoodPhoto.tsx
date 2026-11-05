import { useState } from 'react'
export default function FoodPhoto({src,symbol}:{src:string;symbol:string}){
  const [failed,setFailed]=useState(false)
  return failed?<span className="baef-photo-fallback" aria-hidden="true">{symbol}</span>:<img alt="" loading="lazy" src={src} onError={()=>setFailed(true)}/>
}
