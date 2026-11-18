import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const m={exports:{}}
new Function('module','exports',ts.transpileModule(readFileSync(new URL('../src/orderTiming.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m,m.exports)
const {readyAt,timingSummary,canReportLate,pickupGraceDeadline,etaExpired}=m.exports
test('planned orders and delivery estimates are never pickup readiness',()=>{
 const s={phase:'delivering',planned_order_at:'2026-11-18T09:00:00Z',delivery_eta_start:'2026-11-18T10:00:00Z',delivery_eta_end:'2026-11-18T10:15:00Z'}
 assert.equal(readyAt(s),null);assert.match(timingSummary(s,Date.parse('2026-11-18T10:00:00Z')),/도착 예상/)
 assert.equal(canReportLate(s,'2026-11-18T09:00:00Z',Date.parse('2026-11-18T11:00:00Z')),false)
})

test('expired delivery estimates ask for confirmation without implying food has arrived',()=>{
 const s={phase:'delivering',delivery_eta_start:'2026-11-18T10:00:00Z',delivery_eta_end:'2026-11-18T10:15:00Z'}
 assert.equal(etaExpired(s,Date.parse('2026-11-18T10:15:01Z')),true)
 assert.match(timingSummary(s,Date.parse('2026-11-18T10:15:01Z')),/예상 시간이 지났어요/)
 assert.equal(readyAt(s),null)
 assert.equal(etaExpired({...s,phase:'arrived'},Date.parse('2026-11-18T11:00:00Z')),false)
})
test('pickup grace deadline is absent until ready and acknowledged and rejects malformed dates',()=>{
 const s={phase:'arrived',arrived_at:'2026-11-18T10:00:00Z'}
 assert.equal(pickupGraceDeadline(s,null),null)
 assert.equal(pickupGraceDeadline(s,'invalid'),null)
 assert.equal(pickupGraceDeadline(s,'2026-11-18T10:05:00Z'),Date.parse('2026-11-18T10:15:00Z'))
})
test('contactless pickup starts only when the food is actually placed',()=>{
 const s={phase:'arrived',pickup_mode:'contactless',arrived_at:'2026-11-18T09:00:00Z'}
 assert.equal(readyAt(s),null)
 s.pickup_dropped_at='2026-11-18T09:05:00Z';assert.equal(readyAt(s),s.pickup_dropped_at)
})
test('late grace starts after both readiness and the participant acknowledgement',()=>{
 const s={phase:'arrived',pickup_mode:'meet',arrived_at:'2026-11-18T09:00:00Z'}
 assert.equal(canReportLate(s,null,Date.parse('2026-11-18T10:00:00Z')),false)
 assert.equal(canReportLate(s,'2026-11-18T09:20:00Z',Date.parse('2026-11-18T09:29:59Z')),false)
 assert.equal(canReportLate(s,'2026-11-18T09:20:00Z',Date.parse('2026-11-18T09:30:00Z')),true)
})
