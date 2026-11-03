# 참여자 테스트 연결 순서

## 1. 저장소 만들기 (한 번만)

Supabase 프로젝트 왼쪽 **SQL Editor → New query**를 열고
이 폴더의 `setup.sql` 전체를 붙여 넣어 **Run**을 누릅니다.
이 SQL은 gd_로 시작하는 테스트 전용 테이블과 권한을 만듭니다.
기존 브라우저 시연 데이터는 가져오지 않습니다.

## 2. 공개 가입 닫기

**Authentication → 설정의 Sign Up / User Signups**에서
**Allow new users to sign up**을 끕니다. Email/Password 로그인은 켜 둡니다.
메뉴 이름이 다르면 Authentication 설정에서 신규 가입 허용 항목을 찾습니다.
접근 권한은 gd_testers 등록 여부로도 확인하므로 로그인 계정만으로는 데이터를 볼 수 없습니다.

## 3. 개인 계정 만들기

**Authentication → Users → Add user → Create new user**에서 참여자마다
각자의 이메일과 별도 임시 비밀번호를 입력합니다.
진행자가 직접 만든 테스트 계정은 **Auto Confirm User**를 선택합니다.
사이트 화면에 공개 가입은 제공하지 않습니다. 비밀번호는 각 참여자에게 개별 전달합니다.

## 4. 계정에 테스트 접근 권한 주기

SQL Editor에서 아래 예시의 이메일과 닉네임을 실제 참여자 정보로 바꿔 실행합니다.
참여자마다 반복하면 됩니다. 이 명령으로 비밀번호를 설정하지는 않습니다.

```sql
insert into public.gd_testers (user_id, nickname)
select id, '밥친구1'
from auth.users
where lower(email) = lower('participant@example.com')
on conflict (user_id) do update
set nickname = excluded.nickname, active = true;

select nickname, active from public.gd_testers;
```

마지막 결과에 닉네임이 나타나야 합니다. 최대 5명의 테스트 참여자를 등록합니다.
계정을 차단하려면 Table Editor의 gd_testers에서 해당 계정의 active를 false로 바꿉니다.

## 5. 실행과 배포

로컬 `.env.local`에는 제공받은 Project URL / Publishable key가 설정되어 있습니다.
Vite가 이미 실행 중이었다면 다시 시작해야 새 환경변수가 반영됩니다.

현재 프로젝트는 `src/publicSupabaseConfig.ts`에 브라우저용 공개 연결 설정이 있어
Vercel에서도 환경변수 추가 없이 같은 Supabase에 연결됩니다. 데이터 권한은 Auth/RLS에서 제한합니다.
프로젝트를 바꿀 때는 이 파일을 수정하거나 Vercel의 **Settings → Environment Variables**에 다음 두 항목을 설정합니다.

- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

Production과 필요한 Preview 환경에 적용하고, 코드 업로드 후 다시 배포합니다.
브라우저용 Publishable key만 사용합니다. Secret key나 service_role 키를 VITE_ 변수에 넣지 않습니다.
기존 프로토타입 화면 상단의 '로그인'으로 접속합니다.
로그인 후에도 메인·카테고리·상세·모집하기·하단 메뉴는 같은 앱에서 이어집니다.
상단 '예시 보기 / 실제 참여로'로 시연 데이터와 참여자 모집글을 전환할 수 있습니다.
`?mode=demo` 주소로 시연 모드에 바로 들어갈 수도 있습니다.

## 6. 두 사람으로 확인

1. 서로 다른 브라우저/휴대폰에서 A, B 계정으로 각각 로그인합니다.
2. A가 기존 모집하기 화면에서 모집글을 작성하고 B가 목록에서 찾습니다 (약 3초마다 갱신).
3. B가 신청하면 A의 모집 상세에 신청자가 나타납니다.
4. A가 수락하면 B가 채팅방을 열 수 있습니다.
5. 서로 메시지를 보내고 상대 기기에 표시되는지 확인합니다 (약 2초마다 갱신).
6. 새로고침해도 모집글·신청 상태·채팅이 유지되는지 확인합니다.
7. A가 신청자 관리에서 '이 공동배달 테스트 종료'를 누르면 다음 테스트를 시작할 수 있습니다.

## 이번 구현 범위

실제 로그인, 모집글 등록/검색/카테고리, 신청·취소, 수락·거절, 정원에 따른 마감,
리더의 마감/빈자리 재모집/취소/테스트 종료, 참여자 채팅, 상태 변경 알림을 연결했습니다.
알림은 사이트가 열려 있을 때 자동 갱신하는 화면 내 알림이며 휴대폰 푸시는 아닙니다.
글 수정·삭제는 이번 단계에 포함하지 않았으며 취소·마감으로 관리합니다.
실제 GPS 거리 제한·지도, 메뉴 확정, 송금/입금 확인, 주문·수령·평가는 기존 시연에서만 동작합니다.
실제 참여자 화면의 인원·메시지에는 가상 참여자나 자동 응답을 넣지 않습니다.

## 검증 데이터 정리

테스트 종료 후 진행자가 Supabase Table Editor에서 gd_messages, gd_participations,
gd_posts, gd_testers 순으로 필요한 테스트 데이터를 정리하고 Authentication의
테스트 계정을 삭제할 수 있습니다. 활성 모집 중인 계정을 먼저 삭제하지 마세요.
