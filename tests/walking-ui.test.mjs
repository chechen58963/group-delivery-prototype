import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import ts from 'typescript'
const require=createRequire(import.meta.url)
function compile(file,imports){
 const m={exports:{}}
 const code=ts.transpileModule(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
 new Function('require','module','exports',code)(id=>id in imports?imports[id]:id.endsWith('.css')?{}:require(id),m,m.exports)
 return m.exports
}
let walking,lifecycle,virtualPeer=false
const imports={
 react:{...React,useContext:()=>walking},
 './supabase':{supabase:{}},
 './SharedDelivery':{useSharedDelivery:()=>({session:{user:{id:'me'}},rawPosts:[],isVirtual:id=>virtualPeer&&id==='other'})},
 './DeliveryLifecycle':{useDeliveryLifecycle:()=>lifecycle},
 './useGpsWalk':{},
 './storeNames':compile('storeNames.ts',{}),
 './walkRewards':compile('walkRewards.ts',{}),
 './uiFeedback':{relativeDateTime:v=>v},
}
const {WalkingRewardPlan,WalkingRewardWallet,WalkingRecordingStatus,LeaderRewardBenefit}=compile('WalkingRewards.tsx',imports)
const render=(component,props={})=>renderToStaticMarkup(React.createElement(component,props))
function reset(){
 virtualPeer=false
 walking={rewards:[],ready:false,busy:false,error:'이동 포인트를 불러오지 못했어요.',policyReady:false,wallet:null,points:null,totalMeters:0,gps:{record:null,recording:false,status:'idle',message:'',start(){},stop(){return 0}}}
 lifecycle={post:{id:'room'},uid:'me',selectedId:'room',members:[{user_id:'me'}],mine:{received_at:null},state:{phase:'arrived'},states:[],people:[],consistencyReady:true,busy:false}
}
test('a rewards lookup outage does not disable receipt confirmation or invent the earning rule',()=>{
 reset();const html=render(WalkingRewardPlan,{receipt:true})
 assert.match(html,/>내 음식 수령 완료</)
 assert.doesNotMatch(html,/disabled=""[^>]*>내 음식 수령 완료/)
 assert.match(html,/포인트 다시 불러오기/)
 assert.doesNotMatch(html,/누적 1km마다/)
})

test('leader reward preview and history separate the bonus from ordinary points',()=>{
 reset();walking.ready=true;walking.error='';walking.policyReady=true;walking.leaderRewardsReady=true;walking.wallet={today_earned:0}
 lifecycle.owner=true;lifecycle.members.push({user_id:'other'})
 let html=render(WalkingRewardPlan);assert.match(html,/예상 70P/);assert.match(html,/리더 추가 50P/)
 walking.rewards=[{post_id:'room',meters:0,points:70,leader_bonus:50}]
 html=render(WalkingRewardPlan);assert.match(html,/완료·이동 20P \+ 리더 추가 50P/)
 assert.match(render(LeaderRewardBenefit),/최대 50P 추가/)
})
test('virtual-only rooms and an older backend do not promise a leader bonus',()=>{
 reset();walking.ready=true;walking.error='';walking.policyReady=true;walking.leaderRewardsReady=true;walking.wallet={today_earned:0}
 lifecycle.owner=true;lifecycle.members.push({user_id:'other'});virtualPeer=true
 let html=render(WalkingRewardPlan);assert.match(html,/예상 20P/);assert.doesNotMatch(html,/리더 추가 50P/)
 walking.leaderRewardsReady=false;assert.equal(render(LeaderRewardBenefit),'')
})
test('wallet loading and failures never fall back to an old reward policy',()=>{
 reset();assert.match(render(WalkingRewardWallet),/적립 기준 확인 필요/)
 walking.error='';assert.match(render(WalkingRewardWallet),/적립 기준 확인 중/)
 walking.ready=true;walking.policyReady=true;assert.match(render(WalkingRewardWallet),/완료 20P/)
})
test('GPS pause and permission errors are visible with resume actions and disappear after receipt',()=>{
 reset();walking.gps={...walking.gps,record:{post:'room',meters:45},status:'paused',message:'다른 앱으로 이동해 중지했어요.'}
 lifecycle.states=[{post_id:'room',phase:'arrived'}];lifecycle.people=[{post_id:'room',user_id:'me',received_at:null}]
 let html=render(WalkingRecordingStatus);assert.match(html,/이동 기록 일시 중지/);assert.match(html,/이어 기록/)
 walking.gps.status='error';html=render(WalkingRecordingStatus);assert.match(html,/다시 시도/)
 walking.gps.status='limit';assert.doesNotMatch(render(WalkingRecordingStatus),/<button/)
 lifecycle.people[0].received_at='2026-11-18T10:00:00Z';assert.equal(render(WalkingRecordingStatus),'')
})
test('contactless pickup still cannot complete before dropoff even if rewards are unavailable',()=>{
 reset();lifecycle.state.pickup_mode='contactless';lifecycle.state.pickup_dropped_at=null
 assert.match(render(WalkingRewardPlan,{receipt:true}),/disabled=""[^>]*>음식 놓기 알림을 기다리고 있어요/)
})
