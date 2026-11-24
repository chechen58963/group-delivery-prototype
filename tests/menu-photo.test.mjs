import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {createRequire} from 'node:module'
import {renderToStaticMarkup} from 'react-dom/server'
import React from 'react'
import ts from 'typescript'
const read=name=>JSON.parse(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'))
const photos=read('menuPhotos.json'),variants=read('menuPhotoVariants.json'),representatives=read('menuPhotoRepresentatives.json')
const catalog=read('catalogExpansion.json'),presentation=read('menuPresentation.json')
const require=createRequire(import.meta.url),m={exports:{}}
new Function('require','module','exports',ts.transpileModule(readFileSync(new URL('../src/MenuPhoto.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(name=>name.endsWith('.css')?{}:name.startsWith('./')?read(name.slice(2)):require(name),m,m.exports)
const MenuPhoto=m.exports.default

test('every menu in the eight-store catalogue has a real local photograph',()=>{
  let count=0
  for(const store of catalog){
    const brand=Object.keys(photos).find(key=>store.store_name.startsWith(key))
    for(const menu of store.menus){
      const src=photos[brand]?.[menu.name]
      assert.ok(src,store.store_name+' '+menu.name)
      assert.ok(existsSync(new URL('../public'+src,import.meta.url)),src)
      assert.ok(readFileSync(new URL('../public'+src,import.meta.url)).length>1000,src)
      count++
    }
  }
  assert.equal(count,82)
})
test('every advertised temperature renders its matching photo or an explicitly labelled representative photo',()=>{
  for(const store of presentation){
    const brand=Object.keys(photos).find(key=>store.store_name.startsWith(key))
    for(const menu of store.menus)for(const temperature of menu.temperature_options){
      const exact=variants[brand]?.[menu.name]?.[temperature],rep=representatives[brand]?.[menu.name]
      assert.ok(exact||rep,store.store_name+' '+menu.name+' '+temperature)
      const html=renderToStaticMarkup(React.createElement(MenuPhoto,{storeName:store.store_name,name:menu.name,temperature}))
      assert.match(html,/<img /)
      if(!exact)assert.match(html,/대표 사진/)
    }
  }
})
test('unknown products are never given a different menu photograph',()=>{
  assert.equal(renderToStaticMarkup(React.createElement(MenuPhoto,{storeName:'더벤티',name:'존재하지 않는 메뉴',temperature:'HOT'})),'')
})
