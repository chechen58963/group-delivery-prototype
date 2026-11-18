import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
function load(name){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(()=>({}),m,m.exports);return m.exports}
const f=load('userFlow.ts'),g=load('orderGuidance.ts')
test('joining previews use the resulting headcount and never add an existing member twice',()=>{
 assert.equal(f.previewMembers(2,3),3);assert.equal(f.previewMembers(2,3,true),2);assert.equal(f.previewMembers(5,5),5)
})
test('named pickup candidates stay within 400m of every supplied origin',()=>{
 const points=[{lat:36.3621,lng:127.3444},{lat:36.3624,lng:127.3445}]
 const places=f.pickupCandidates(points);assert.ok(places.length>0)
 assert.ok(places.every(p=>p.distances.length===2&&p.distances.every(d=>d<=400)))
 assert.equal(f.pickupCandidates([...points,{lat:37,lng:128}]).length,0)
})
test('handled applications and old phase notifications do not remain action prompts',()=>{
 const c={uid:'me',post:{owner_id:'me',status:'open'},members:[{user_id:'me',status:'accepted',active:true},{user_id:'a',status:'pending',active:true}],state:{phase:'menu'},people:[]}
 assert.equal(f.needsAttention('applicants','new',c),true)
 c.members[1].status='accepted';assert.equal(f.needsAttention('applicants','new',c),false)
 assert.equal(f.needsAttention('payment','old',c),false)
 c.post.status='completed';assert.equal(f.needsAttention('receipt','old',c),false)
})
test('virtual leader next steps never ask for a bank transfer',()=>{
 const next=g.orderNextStep({role:'participant',application:'accepted',phase:'payment',count:2,virtualLeader:true})
 assert.equal(next.action,'주문 진행하기');assert.doesNotMatch(next.description,/송금|계좌/)
})
