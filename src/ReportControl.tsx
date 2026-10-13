import { useState } from "react"
import { useFlow } from "./FlowContext"

export function ReportControl({ person, postId }: { person: string; postId: number }) {
  const { reports, submitReport } = useFlow()
  const [reason, setReason] = useState("")
  const [detail, setDetail] = useState("")
  const existing = reports.find(r => r.postId === postId && r.person === person)
  return <details className="bg-white border border-gray-100 rounded-xl p-3 text-xs">
    <summary className="cursor-pointer text-gray-500">{person}님 신고 · 이용 규칙</summary>
    <div className="space-y-3 pt-3">
      <p className="text-gray-500">욕설·괴롭힘, 수령 불참, 반복 지각을 신고할 수 있어요. 신고만으로 정지되지 않으며 사실 확인과 소명 후 제재하는 방식으로 설계했어요.</p>
      <p className="text-gray-500">수령 지각은 첫 확인 시 경고, 서로 다른 거래에서 2회 확인되면 새 모집·참여를 3일 제한해요. 진행 중인 거래의 수령은 계속할 수 있어요.</p>
      {existing ? <p role="status" className="font-semibold text-brand">신고 접수 · {existing.reason} · {existing.status} (시연)</p> : <form onSubmit={e => { e.preventDefault(); submitReport(postId, person, reason, detail) }} className="space-y-2">
        <label className="block">신고 사유<select required value={reason} onChange={e => setReason(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 mt-1"><option value="">사유를 선택하세요</option>{["욕설·괴롭힘", "수령 불참", "반복 지각", "부적절한 송금 요구", "기타"].map(r => <option key={r}>{r}</option>)}</select></label>
        <label className="block">상황 설명<textarea value={detail} onChange={e => setDetail(e.target.value)} maxLength={500} placeholder="어떤 일이 있었는지 적어 주세요" className="w-full border border-gray-200 rounded-lg p-2 mt-1" rows={2} /></label>
        <button disabled={!reason} className="border border-gray-200 rounded-lg px-4 py-2 font-semibold disabled:opacity-40">신고 접수하기 (시연)</button>
      </form>}
      <p className="text-gray-400">실제 운영자에게 전달되지 않으며 이 브라우저에 저장돼요.</p>
    </div>
  </details>
}
