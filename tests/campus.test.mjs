import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"

async function moduleFrom(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8")
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`)
}
const { CAMPUS_POSTS, CAMPUS_CENTER, CAMPUS_STORES, mergeCampusPosts } = await moduleFrom("../src/campus.ts")
const { loadSnapshot, saveSnapshot } = await moduleFrom("../src/prototypeStorage.ts")
const { makeTransaction, latePenalty, LATE_SUSPENSION_MS } = await moduleFrom("../src/workflow.ts")

test("campus recruitment data use relevant store menus and remain within 700m", () => {
  assert.ok(CAMPUS_CENTER.lat > 36 && CAMPUS_CENTER.lat < 37)
  assert.equal(CAMPUS_POSTS.length, 26)
  assert.equal(CAMPUS_STORES.length, 12)
  assert.equal(new Set(CAMPUS_POSTS.map(p => p.id)).size, 26)
  for (const p of CAMPUS_POSTS) {
    assert.ok(p.distance <= 700)
    assert.ok(p.menus.length && p.storeSource.startsWith("https://"))
    assert.ok(p.menuSource.startsWith("https://") && p.priceNote)
  }
  const sandwich = CAMPUS_POSTS.find(p => p.restaurant.includes("써브웨이"))
  assert.ok(sandwich.menus[0].name.includes("에그마요"))
  assert.equal(new Set(CAMPUS_STORES.map(s => s.category)).size, 9)
})

test("catalogue update adds new stores once and preserves ongoing order and owned posts", () => {
  const original = CAMPUS_POSTS.slice(0, 12).map(p => ({ ...p, menus: [{ id: 1, name: "등록 당시 메뉴", price: 1000, category: "식사" }], status: p.id === 2 ? "complete" : p.status }))
  const owned = { ...CAMPUS_POSTS[0], id: 9999, restaurant: "내 모집글", leaderName: "나" }
  const saved = [owned, ...original]
  const merged = mergeCampusPosts(saved, CAMPUS_POSTS, 1)
  assert.equal(merged.length, 27)
  assert.deepEqual(merged.find(p => p.id === 1), original[0])
  assert.deepEqual(merged.find(p => p.id === owned.id), owned)
  assert.equal(merged.find(p => p.id === 2).status, "complete")
  assert.deepEqual(mergeCampusPosts(merged, CAMPUS_POSTS, 1), merged)
  assert.ok(merged.some(p => p.category === "피자"))
  assert.ok(merged.some(p => p.category === "분식"))
  assert.ok(merged.some(p => p.category === "일식"))
})

test("known leader orders show the real menu name and keep their amount", () => {
  const post = CAMPUS_POSTS[0]
  const tx = makeTransaction(post, post.menus, "participant")
  const leader = tx.people[0]
  assert.equal(leader.items.some(item => item.name === "선택한 메뉴"), false)
  assert.equal(leader.quantities[post.menus[0].id], 1)
})

test("created recruitment and leader progress survive snapshot roundtrip", () => {
  let raw = null
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value } }
  const post = { ...CAMPUS_POSTS[0], id: 1001, leaderName: "나", distance: 0, currentMembers: 1 }
  const tx = makeTransaction(post, post.menus, "leader")
  const snapshot = { posts: [post, ...CAMPUS_POSTS], selectedId: post.id, tx, completed: [], reviews: {}, myLocation: "충남대학교 정문 주변", clockOffset: 0, suspensionUntil: 0, couponUsed: false, reports: [{ id: 1, postId: 2, person: "밥친구", reason: "욕설·괴롭힘", detail: "시연", status: "검토 대기", createdAt: 1 }] }
  assert.equal(saveSnapshot(snapshot, storage), true)
  assert.deepEqual(loadSnapshot(storage), snapshot)
  assert.equal(loadSnapshot(storage).tx.role, "leader")
  assert.equal(loadSnapshot(storage).reports[0].status, "검토 대기")
})

test("unavailable and corrupt browser storage degrade without crashing", () => {
  assert.equal(loadSnapshot({ getItem: () => "{broken" }), null)
  assert.equal(loadSnapshot({ getItem: () => JSON.stringify({ posts: [] }) }), null)
  assert.equal(saveSnapshot({}, { setItem: () => { throw Error("quota") } }), false)
})

test("first late receipt warns; two distinct transactions restrict for three days", () => {
  const first = makeTransaction(CAMPUS_POSTS[0], CAMPUS_POSTS[0].menus, "participant")
  first.lateReports.me = 1000
  assert.deepEqual(latePenalty([first]), { count: 1, until: 0 })
  assert.deepEqual(latePenalty([first, first]), { count: 1, until: 0 })
  const second = { ...first, post: { ...first.post, id: 2 }, lateReports: { me: 5000 } }
  assert.deepEqual(latePenalty([first, second]), { count: 2, until: 5000 + LATE_SUSPENSION_MS })
})
