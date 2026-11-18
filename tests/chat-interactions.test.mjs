import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import React from 'react'
import ts from 'typescript'
const require=createRequire(import.meta.url)
let shared,slots,cursor
const hookReact={...React,
 useContext:()=>shared,
 useState(initial){const id=cursor++;if(!(id in slots))slots[id]=typeof initial==='function'?initial():initial;return [slots[id],value=>{slots[id]=typeof value==='function'?value(slots[id]):value}]},
 useRef(initial){const id=cursor++;return slots[id]??(slots[id]={current:initial})},
 useEffect(){},useLayoutEffect(){},
}
function compile(name,imports={}){
 const m={exports:{}}
 const code=ts.transpileModule(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
 new Function('require','module','exports',code)(id=>id in imports?imports[id]:require(id),m,m.exports)
 return m.exports
}
const history=compile('sharedHistory.ts')
const {SharedChat}=compile('SharedDelivery.tsx',{
 react:hookReact,'./CancelOrderControl':{default:()=>null},'./supabase':{},'./authErrors':{},'./uiFeedback':{},'./campus':{},'./workflow':{},'./sharedHistory':history,
})
function find(tree,predicate){
 if(!tree||typeof tree!=='object')return null
 if(predicate(tree))return tree
 for(const child of React.Children.toArray(tree.props?.children)){const found=find(child,predicate);if(found)return found}
 return null
}
function environment(t){
 slots=[];cursor=0
 const previous={document:globalThis.document,sessionStorage:globalThis.sessionStorage}
 let focused=true;const data=new Map()
 globalThis.document={hidden:false,hasFocus:()=>focused}
 globalThis.sessionStorage={getItem:key=>data.get(key)??null,setItem:(key,v)=>data.set(key,v)}
 t.after(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}})
 const reads=[]
 shared={session:{user:{id:'alice'}},tx:{post:{sharedId:'room',restaurant:'가게'},people:[],messages:[{id:10,isMe:false,sender:'친구',content:'안녕',time:'18:00'}]},chatReadable:true,chatEnded:false,readChatNotifications:(...args)=>reads.push(args)}
 const render=()=>{cursor=0;return SharedChat({pop(){},push(){}})}
 return {render,reads,focus:value=>{focused=value}}
}
test('actual chat scroll handler only marks latest messages read in a visible focused room',t=>{
 const e=environment(t),tree=e.render(),scroll=find(tree,n=>typeof n.props?.onScroll==='function')
 const element={scrollHeight:1000,clientHeight:400,scrollTop:600};scroll.props.ref.current=element
 scroll.props.onScroll();assert.deepEqual(e.reads,[['room',10]])
 document.hidden=true;scroll.props.onScroll();assert.equal(e.reads.length,1)
 document.hidden=false;e.focus(false);scroll.props.onScroll();assert.equal(e.reads.length,1)
 e.focus(true);element.scrollTop=100;scroll.props.onScroll();assert.equal(e.reads.length,1)
})
test('actual chat composer preserves edits made while a send is pending and restores by account and room',async t=>{
 const e=environment(t);let tree=e.render()
 let input=find(tree,n=>n.type==='textarea')
 input.props.onChange({target:{value:'보낼 메시지'}});tree=e.render()
 let finish;shared.act=()=>new Promise(resolve=>{finish=resolve})
 const send=find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}})
 input=find(tree,n=>n.type==='textarea');input.props.onChange({target:{value:'새로 쓰는 메시지'}});e.render()
 finish('room');await send
 assert.equal(find(e.render(),n=>n.type==='textarea').props.value,'새로 쓰는 메시지')
 shared.tx.post.sharedId='other';assert.equal(find(e.render(),n=>n.type==='textarea').props.value,'')
 shared.tx.post.sharedId='room';assert.equal(find(e.render(),n=>n.type==='textarea').props.value,'새로 쓰는 메시지')
 shared.session.user.id='bob';assert.equal(find(e.render(),n=>n.type==='textarea').props.value,'')
 shared.session.user.id='alice';shared.act=async()=>null
 await find(e.render(),n=>n.type==='form').props.onSubmit({preventDefault(){}})
 assert.equal(find(e.render(),n=>n.type==='textarea').props.value,'새로 쓰는 메시지')
})
