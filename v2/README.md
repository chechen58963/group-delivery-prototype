# 배프 UI 통합

`/`와 `/v2/`는 이제 같은 앱을 엽니다. 두 진입점 모두 `src/main.tsx`와 기존 인증·공유 데이터 제공자를 사용합니다.

## 화면과 기능

- `src/BaefShell.tsx`: v2 스타일의 공통 화면, 실제 계정·알림·화면 이동
- `src/LiveDiscovery.tsx`: 실제 모집 탐색, 메뉴·가게 검색, 지도, 저장한 모집, 내 주문 내역, 관심 메뉴 알림
- `src/MenuDiscovery.tsx`: 기존 메뉴 저장·모집 등록·참가 신청 처리. 모집 메뉴 선택과 조건 확인을 순서대로 표시
- `src/OrderScreens.tsx`: 기존 주문·송금·수령·환불·후기 처리. 주문 준비는 요약과 설정 대화상자로 구성
- `src/v2/v2.css`, `src/live-v2.css`: 새 디자인과 기존 기능 화면의 스타일
- `src/v2/ui.tsx`: 공통 대화상자

기존 Supabase 연결, DB, 로그인 세션, 주문, 메뉴, 후기 및 포인트를 그대로 사용합니다. DB 마이그레이션은 추가하지 않았습니다. 기존 화면 체험용 데이터와 자동 응답 코드는 제거했습니다. UI 체험 버전은 Git 커밋 `65e3db5`에서 확인할 수 있습니다.

## 검사

```text
npx tsc --noEmit
npm run build
node --test tests/workflow.test.mjs tests/campus.test.mjs tests/live-ui.test.mjs
```

`live-ui.test.mjs`는 실제 컴포넌트를 제어된 데이터로 렌더링해 모집 필터, 계정별 주문 내역, 역할별 준비·송금 버튼과 중복 송금 방지 조건을 검사합니다. 네트워크나 DB 변경은 수행하지 않습니다. 브라우저에서 두 계정으로 함께 진행하는 실사용 검사를 대신하지는 않습니다.
