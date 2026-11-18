import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function load(file,imports={}) {
  const output=ts.transpileModule(readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  const module={exports:{}}
  new Function('require','module','exports',output)(id=>imports[id],module,module.exports)
  return module.exports
}
const gps=load('gpsWalk.ts',{'./walkRewards':load('walkRewards.ts')})
const now=1000000
const fix=(meters,time=now,accuracy=5)=>({lat:36.3621+meters/111195,lng:127.3444,time,accuracy})
test('walking fixes accumulate distance automatically and respect the 400m cap',()=>{
  let t=gps.emptyWalkTrack()
  for(let i=0;i<=30;i++)t=gps.appendWalkFix(t,fix(i*15,now+i*10000),now+i*10000)
  assert.equal(t.meters,400)
})
test('stationary jitter and poor accuracy cannot earn distance',()=>{
  let t=gps.appendWalkFix(gps.emptyWalkTrack(),fix(0),now)
  for(let i=1;i<20;i++)t=gps.appendWalkFix(t,fix(i%5,now+i*1000),now+i*1000)
  assert.equal(t.meters,0)
  const before=t
  t=gps.appendWalkFix(t,fix(80,now+20000,100),now+20000)
  assert.equal(t,before)
})
test('vehicle speed, stale fixes, out-of-order timestamps and invalid coordinates are excluded',()=>{
  let t=gps.appendWalkFix(gps.emptyWalkTrack(),fix(0),now)
  t=gps.appendWalkFix(t,fix(100,now+1000),now+1000)
  assert.equal(t.meters,0)
  for(const value of [fix(140,now-1000),fix(140,now),{...fix(140),lat:NaN},{...fix(140),lng:200}]){
    assert.equal(gps.appendWalkFix(t,value,now+20000),t)
  }
})
test('background gaps, pauses and refreshes never connect two locations into a rewarded segment',()=>{
  let t=gps.appendWalkFix(gps.emptyWalkTrack(),fix(0),now)
  t=gps.appendWalkFix(t,fix(15,now+10000),now+10000)
  const distance=t.meters
  t=gps.appendWalkFix(t,fix(200,now+100000),now+100000)
  assert.equal(t.meters,distance)
  t=gps.appendWalkFix({...t,anchor:null},fix(300,now+110000),now+110000)
  assert.equal(t.meters,distance)
})
