# 배프

충남대학교 주변에서 메뉴를 고르고 배달비를 나누는 공동배달 앱입니다.

## 실행과 검사

```text
npm run dev
npx tsc --noEmit
npm run build
node --test tests/*.test.mjs
```

앱 주소는 `/` 하나입니다. 예전 `/v2/` 주소는 홈으로 이동합니다.

## 주요 파일

- `src/App.tsx`: 실제 앱의 데이터 제공자 구성
- `src/AppPreferences.tsx`: 기존 테마 설정과 현재 위치
- `src/BaefShell.tsx`: 공통 화면과 이동
- `src/LiveDiscovery.tsx`: 모집 탐색·가게 선택·주문 내역
- `src/MenuDiscovery.tsx`: 메뉴 선택·모집 작성·신청·알림
- `src/OrderScreens.tsx`: 주문 준비·송금·수령·환불·후기
- `src/SharedDelivery.tsx`, `src/DeliveryLifecycle.tsx`: 기존 Supabase 데이터 연결과 주문 처리
- `src/ui/`: 공통 아이콘과 대화상자
- `src/styles/`: 현재 디자인의 기본 스타일과 앱 배치

회원·주문·후기·포인트는 기존 Supabase 프로젝트를 사용합니다. 모집 마감과 주문 예정 시각을 동기화하려면 주문 시간 업데이트 이후 `supabase/APPLY-RECRUITMENT-SCHEDULE.sql`을 한 번 적용합니다.
