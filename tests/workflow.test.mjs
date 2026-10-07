import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import ts from "typescript"

const source = await readFile(
  new URL("../src/workflow.ts", import.meta.url),
  "utf8",
)
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText
const {
  makeTransaction,
  transition,
  allPaid,
  allReceived,
  isActive,
  due,
  totalFood,
  feeShare,
  recruitmentClosed,
  recommendMeetings,
  demoLocations,
  isSuspended,
  LATE_GRACE_MS,
  LATE_SUSPENSION_MS,
  flowEvents,
} = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
)
const post = {
  id: 1,
  restaurant: "시연 음식점",
  category: "치킨",
  currentMembers: 2,
  maxMembers: 3,
  minOrderAmount: 25000,
  currentAmount: 18000,
  closesAt: 10000,
}
const menu = [{ id: 1, name: "메뉴", price: 8000, category: "식사" }]
const approved = () =>
  transition(makeTransaction(post, menu, "participant"), {
    type: "approve",
    accepted: true,
    items: menu,
    now: 100,
  })
const finalized = () => {
  let tx = approved()
  tx = transition(tx, { type: "quantity", id: 1, delta: 1 })
  tx = transition(tx, { type: "menu-confirm" })
  return transition(tx, { type: "finalize" })
}
test("approval fills capacity and closes recruitment; rejection releases the application lock", () => {
  const pending = makeTransaction(post, menu, "participant")
  assert.equal(isActive(pending), true)
  const rejected = transition(pending, {
    type: "approve",
    accepted: false,
    items: menu,
    now: 100,
  })
  assert.equal(isActive(rejected), false)
  const tx = approved()
  assert.equal(tx.people.length, 3)
  assert.equal(recruitmentClosed(tx, 100), true)
  assert.equal(tx.people.filter((p) => p.id === "me").length, 1)
})
test("deadline prevents late approval and prevents selecting additional applicants", () => {
  const tx = makeTransaction(post, menu, "participant")
  assert.equal(
    transition(tx, {
      type: "approve",
      accepted: true,
      items: menu,
      now: 10000,
    }),
    tx,
  )
  const leader = makeTransaction(post, menu, "leader")
  assert.equal(
    transition(leader, {
      type: "decide",
      id: 1,
      name: "멤버",
      accepted: true,
      items: menu,
      now: 10000,
    }),
    leader,
  )
})
test("empty menu, insufficient minimum, and unfinished recruitment cannot be finalized", () => {
  const tx = approved()
  assert.equal(transition(tx, { type: "finalize" }).menusFinal, false)
  const expensive = { ...post, minOrderAmount: 999999 }
  let insufficient = transition(
    makeTransaction(expensive, menu, "participant"),
    { type: "approve", accepted: true, items: menu, now: 100 },
  )
  insufficient = transition(insufficient, { type: "quantity", id: 1, delta: 1 })
  insufficient = transition(insufficient, { type: "menu-confirm" })
  assert.equal(transition(insufficient, { type: "finalize" }).menusFinal, false)
  const tx2 = finalized()
  assert.equal(
    transition({ ...tx2, closed: false, menusFinal: false }, {
      type: "finalize",
    }).menusFinal,
    false,
  )
})
test("selected quantities flow into payment; finalization locks menu edits", () => {
  const tx = finalized()
  assert.equal(totalFood(tx), 26000)
  assert.equal(due(tx, "me"), 9000)
  assert.equal(tx.menusFinal, true)
  assert.equal(transition(tx, { type: "quantity", id: 1, delta: 1 }), tx)
})
test("a transfer claim needs leader confirmation; leader also prepares their own payment", () => {
  let tx = transition(finalized(), { type: "claim-transfer", id: "me" })
  assert.equal(allPaid(tx), false)
  assert.equal(transition(tx, { type: "order" }).ordered, false)
  assert.equal(tx.people.find((p) => p.id === "me").paid, false)
  tx = transition(tx, { type: "confirm-transfer", id: "me" })
  assert.equal(tx.people.find((p) => p.id === "me").paid, true)
  assert.equal(allPaid(tx), false)
  tx = transition(tx, { type: "confirm-transfer", id: "member-1" })
  assert.equal(tx.people.find((p) => p.id === "member-1").paid, false)
  tx = transition(tx, { type: "claim-transfer", id: "member-1" })
  tx = transition(tx, { type: "confirm-transfer", id: "member-1" })
  assert.equal(allPaid(tx), false)
  tx = transition(tx, { type: "leader-ready" })
  assert.equal(allPaid(tx), true)
  tx = transition(tx, { type: "order" })
  assert.equal(tx.ordered, true)
  assert.equal(
    transition(tx, { type: "receive", id: "me" }).people.some(
      (p) => p.received,
    ),
    false,
  )
  tx = transition(tx, { type: "arrive", now: 1000 })
  tx = transition(tx, { type: "receive", id: "me" })
  assert.equal(allReceived(tx), false)
  for (const p of tx.people) tx = transition(tx, { type: "receive", id: p.id })
  assert.equal(allReceived(tx), true)
  assert.equal(isActive(tx), false)
})
test("participant cancellation records a pending leader refund; ordering blocks cancellation", () => {
  let tx = transition(finalized(), { type: "claim-transfer", id: "me" })
  const cancelled = transition(tx, { type: "cancel" })
  assert.equal(cancelled.refund, 9000)
  assert.equal(cancelled.refundCompleted, false)
  assert.equal(transition(cancelled, { type: "refund-complete" }).refundCompleted, true)
  assert.equal(isActive(cancelled), false)
  for (const id of ["me", "member-1"]) {
    tx = transition(tx, { type: "claim-transfer", id })
    tx = transition(tx, { type: "confirm-transfer", id })
  }
  tx = transition(tx, { type: "leader-ready" })
  tx = transition(tx, { type: "order" })
  assert.equal(transition(tx, { type: "cancel" }), tx)
})
test("leader cancellation excludes their own payment share from refunds", () => {
  let tx = makeTransaction({ ...post, maxMembers: 2 }, menu, "leader")
  tx = transition(tx, { type: "decide", id: 1, name: "멤버", accepted: true, requestedMenu: "메뉴", items: menu, now: 100 })
  tx = transition(tx, { type: "finalize" })
  tx = transition(tx, { type: "claim-transfer", id: "applicant-1" })
  tx = transition(tx, { type: "confirm-transfer", id: "applicant-1" })
  assert.equal(transition(tx, { type: "cancel" }).refund, due(tx, "applicant-1"))
})
test("fee shares sum to exactly the delivery fee even for seven participants", () => {
  const tx = finalized()
  const large = {
    ...tx,
    people: Array.from({ length: 7 }, (_, i) => ({
      ...tx.people[0],
      id: String(i),
    })),
  }
  assert.equal(
    large.people.reduce((sum, p) => sum + feeShare(large, p.id), 0),
    3000,
  )
})

test("participant refund does not undo another member's confirmed transfer", () => {
  let tx = transition(finalized(), { type: "claim-transfer", id: "member-1" })
  tx = transition(tx, { type: "confirm-transfer", id: "member-1" })
  tx = transition(tx, { type: "claim-transfer", id: "me" })
  const cancelled = transition(tx, { type: "cancel" })
  assert.equal(cancelled.refund, 9000)
  assert.equal(cancelled.people.find(p => p.id === "member-1").paid, true)
  assert.equal(cancelled.people.find(p => p.id === "me").paid, false)
})

test("meeting suggestions use every accepted member and update when a position changes", () => {
  let tx = approved()
  const initial = recommendMeetings(tx)
  assert.equal(initial.length, 3)
  assert.equal(initial[0].distances.length, 3)
  assert.ok(initial.every((candidate) => candidate.farthest <= 300))
  tx = transition(tx, { type: "meeting", value: "직접 정한 장소" })
  tx = transition(tx, { type: "set-location", id: "me", point: demoLocations[4].point })
  assert.equal(tx.meeting, "직접 정한 장소")
  assert.notDeepEqual(recommendMeetings(tx)[0].distances, initial[0].distances)
})

test("a one-time demo coupon reduces only my transfer before anyone claims payment", () => {
  const tx = finalized()
  const discounted = transition(tx, { type: "apply-coupon" })
  assert.equal(discounted.couponDiscount, 1000)
  assert.equal(due(discounted, "me"), due(tx, "me") - 1000)
  assert.equal(due(discounted, "member-1"), due(tx, "member-1"))
  assert.equal(transition(discounted, { type: "apply-coupon" }), discounted)
  const claimed = transition(tx, { type: "claim-transfer", id: "me" })
  assert.equal(transition(claimed, { type: "apply-coupon" }), claimed)
})

test("only an uncollected participant can be marked late after ten minutes", () => {
  let tx = finalized()
  for (const id of ["me", "member-1"]) {
    tx = transition(tx, { type: "claim-transfer", id })
    tx = transition(tx, { type: "confirm-transfer", id })
  }
  tx = transition(tx, { type: "leader-ready" })
  tx = transition(tx, { type: "order" })
  tx = transition(tx, { type: "arrive", now: 1000 })
  assert.equal(transition(tx, { type: "mark-late", id: "me", now: 1000 + LATE_GRACE_MS - 1 }), tx)
  assert.equal(transition(tx, { type: "mark-late", id: "leader", now: 1000 + LATE_GRACE_MS }), tx)
  const reportedAt = 1000 + LATE_GRACE_MS
  tx = transition(tx, { type: "mark-late", id: "me", now: reportedAt })
  assert.equal(tx.lateReports.me, reportedAt)
  assert.equal(transition(tx, { type: "mark-late", id: "me", now: reportedAt + 1 }), tx)
  assert.equal(isSuspended(reportedAt + LATE_SUSPENSION_MS - 1, reportedAt + LATE_SUSPENSION_MS), true)
  assert.equal(isSuspended(reportedAt + LATE_SUSPENSION_MS, reportedAt + LATE_SUSPENSION_MS), false)
  const received = transition(tx, { type: "receive", id: "me" })
  assert.equal(received.people.find((p) => p.id === "me").received, true)
})

test("an applicant with no requested menu must choose before finalization", () => {
  let tx = makeTransaction({ ...post, maxMembers: 2 }, menu, "leader")
  tx = transition(tx, { type: "decide", id: 2, name: "미정 멤버", accepted: true, requestedMenu: "미정", items: menu, now: 100 })
  assert.equal(transition(tx, { type: "finalize" }).menusFinal, false)
  tx = transition(tx, { type: "other-menu", id: "applicant-2" })
  assert.equal(transition(tx, { type: "finalize" }).menusFinal, true)
})

test("acceptance notifications are emitted once and link to chat", () => {
  const pending = makeTransaction(post, menu, "participant")
  const accepted = transition(pending, { type: "approve", accepted: true, items: menu, now: 100 })
  const events = flowEvents(pending, accepted)
  assert.ok(events.some(event => event.target === "chat" && event.text.includes("수락")))
  assert.deepEqual(flowEvents(accepted, transition(accepted, { type: "approve", accepted: true, items: menu, now: 100 })), [])
})

test("chat notifications exclude outgoing and previously seen messages", () => {
  const tx = transition(makeTransaction(post, menu, "participant"), { type: "approve", accepted: true, items: menu, now: 100 })
  const outgoing = transition(tx, { type: "message", message: { id: 1, sender: "나", content: "안녕", isMe: true, time: "17:30" } })
  assert.deepEqual(flowEvents(tx, outgoing), [])
  const incoming = transition(outgoing, { type: "message", message: { id: 2, sender: "리더", content: "같이 만나요", isMe: false, time: "17:31" } })
  assert.deepEqual(flowEvents(outgoing, incoming), [{ text: "리더: 같이 만나요", target: "chat" }])
  assert.deepEqual(flowEvents(incoming, incoming), [])
})
