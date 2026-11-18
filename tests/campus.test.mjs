import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"

async function moduleFrom(path) {
  const file = new URL(path, import.meta.url)
  let source = await readFile(file, "utf8")
  // Resolve the catalogue fixture before evaluating the transpiled module as a data URL.
  for (const match of [...source.matchAll(/import (\w+) from ['"](\.\/[^'"]+\.json)['"]/g)]) {
    const json = JSON.parse(await readFile(new URL(match[2], file), "utf8"))
    source = source.replace(match[0], `const ${match[1]} = ${JSON.stringify(json)}`)
  }
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`)
}
const { CAMPUS_CENTER, CAMPUS_STORES } = await moduleFrom("../src/campus.ts")
const { makeTransaction, latePenalty, LATE_SUSPENSION_MS } = await moduleFrom("../src/workflow.ts")

test("campus catalogue keeps store identities, menu IDs and public references", () => {
  assert.ok(CAMPUS_CENTER.lat > 36 && CAMPUS_CENTER.lat < 37)
  assert.equal(CAMPUS_STORES.length, 16)
  assert.equal(new Set(CAMPUS_STORES.map(s => s.name)).size, 16)
  for (const store of CAMPUS_STORES) {
    assert.ok(store.menus.length && store.source.startsWith("https://"))
    assert.ok(store.menuSource.startsWith("https://") && store.priceNote)
    assert.equal(new Set(store.menus.map(m => m.id)).size, store.menus.length)
    assert.ok(store.menus.every(m => Number.isInteger(m.id) && m.id > 0 && Number.isInteger(m.price) && m.price > 0))
  }
  const sandwich = CAMPUS_STORES.find(s => s.name.includes("써브웨이"))
  assert.ok(sandwich.menus[0].name.includes("에그마요"))
  assert.equal(new Set(CAMPUS_STORES.map(s => s.category)).size, 9)
})

function cataloguePost() {
  const store = CAMPUS_STORES[0]
  return { id: 1, restaurant: store.name, category: store.category, menus: store.menus, currentMembers: 2, maxMembers: 3, currentAmount: store.menus[0].price * 2, minOrderAmount: store.demoMinOrder, distance: 100, deadline: "18:30", status: "recruiting" }
}

test("known leader orders show the real menu name and keep their amount", () => {
  const post = cataloguePost()
  const tx = makeTransaction(post, post.menus, "participant")
  const leader = tx.people[0]
  assert.equal(leader.items.some(item => item.name === "선택한 메뉴"), false)
  assert.equal(leader.quantities[post.menus[0].id], 1)
})

test("first late receipt warns; two distinct transactions restrict for three days", () => {
  const first = makeTransaction(cataloguePost(), cataloguePost().menus, "participant")
  first.lateReports.me = 1000
  assert.deepEqual(latePenalty([first]), { count: 1, until: 0 })
  assert.deepEqual(latePenalty([first, first]), { count: 1, until: 0 })
  const second = { ...first, post: { ...first.post, id: 2 }, lateReports: { me: 5000 } }
  assert.deepEqual(latePenalty([first, second]), { count: 2, until: 5000 + LATE_SUSPENSION_MS })
})
