import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const m={exports:{}}
new Function('module','exports',ts.transpileModule(readFileSync(new URL('../src/walkRewards.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m,m.exports)
const {orderRewardBreakdown}=m.exports
test('leader bonus is additional to completion and walking, while participant rewards stay unchanged',()=>{
 assert.deepEqual(orderRewardBreakdown(0,0,true),{base:20,bonus:50,total:70})
 assert.deepEqual(orderRewardBreakdown(400,0,true),{base:100,bonus:50,total:150})
 assert.deepEqual(orderRewardBreakdown(400,0,false),{base:100,bonus:0,total:100})
})
test('leader bonus shares the daily cap and never creates points above the limit',()=>{
 assert.deepEqual(orderRewardBreakdown(0,150,true),{base:20,bonus:30,total:50})
 assert.deepEqual(orderRewardBreakdown(400,190,true),{base:10,bonus:0,total:10})
 assert.deepEqual(orderRewardBreakdown(400,200,true),{base:0,bonus:0,total:0})
})
