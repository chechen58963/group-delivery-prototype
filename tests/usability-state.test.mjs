import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
function load(name){const m={exports:{}};new Function('module','exports',ts.transpileModule(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m,m.exports);return m.exports}
const h=load('sharedHistory.ts'),a=load('orderActionRequest.ts'),p=load('publicPickup.ts')
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}}
test('pickup acknowledgement uses order API while pickup method changes retain their API',()=>{
 assert.deepEqual(a.orderActionRequest('pickup-notice-seen','room'),{name:'gd_order_action',args:{p_action:'pickup-notice-seen',p_post:'room',p_data:{}}})
 for(const verb of ['propose','agree','reset','dropoff'])assert.equal(a.orderActionRequest('pickup-'+verb,'room').args.p_action,verb)
 assert.equal(a.orderActionRequest('pickup-agree','room').name,'gd_pickup_action')
 assert.equal(a.orderActionRequest('receive','room',{walk_meters:50}).args.p_data.walk_meters,50)
})
test('reading a chat preserves other rooms, future messages and non-chat action notifications',()=>{
 const notices=[
  {id:1,sharedPostId:'a',target:'chat',eventKey:'a:message:10',read:false},
  {id:2,sharedPostId:'a',target:'chat',eventKey:'a:message:11',read:false},
  {id:3,sharedPostId:'b',target:'chat',eventKey:'b:message:8',read:false},
  {id:4,sharedPostId:'a',target:'payment',read:false},
 ]
 const next=h.readVisibleChat(notices,'a',10)
 assert.deepEqual(next.map(n=>n.read),[true,false,false,false])
 assert.equal(notices[0].read,false)
 assert.equal(h.readVisibleChat(next,'a',10),next)
})
test('chat drafts survive remounts and are isolated by account and room',()=>{
 const s=storage();h.saveChatDraft('alice','one','정문에서 만나요',s)
 assert.equal(h.readChatDraft('alice','one',s),'정문에서 만나요')
 assert.equal(h.readChatDraft('bob','one',s),'')
 assert.equal(h.readChatDraft('alice','two',s),'')
 assert.equal(h.readChatDraft(undefined,'one',s),'')
})
test('send completion never erases text added during the request',()=>{
 const s=storage();h.saveChatDraft('alice','one','보낼 내용',s)
 h.saveChatDraft('alice','one','그 뒤에 쓴 내용',s)
 assert.equal(h.clearSentDraft('alice','one','보낼 내용',s),false)
 assert.equal(h.readChatDraft('alice','one',s),'그 뒤에 쓴 내용')
 assert.equal(h.clearSentDraft('alice','one','그 뒤에 쓴 내용',s),true)
 assert.equal(h.readChatDraft('alice','one',s),'')
})
test('only an explicitly selected valid public coordinate qualifies for recruitment',()=>{
 assert.equal(p.validPublicPickup(null),false)
 assert.equal(p.validPublicPickup({lat:NaN,lng:127}),false)
 assert.equal(p.validPublicPickup({lat:91,lng:127}),false)
 assert.equal(p.validPublicPickup({lat:36.3621,lng:127.3444}),true)
})
