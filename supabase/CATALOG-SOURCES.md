# 충남대 가게·메뉴 확장

확인일: 2026-11-10. 현재 메뉴 선택 화면의 4개 가게·14개 메뉴를 8개 가게·82개 메뉴로 확장합니다. 기존 커피·햄버거·샌드위치 분류를 유지합니다.

`EXPAND-CAMPUS-CATALOG.sql` 전체를 기존 프로젝트 SQL Editor에서 실행합니다. 마지막 결과는 전체 카탈로그의 가게 수·메뉴 수입니다. 운영자가 따로 추가한 항목이 없다면 8 / 82가 표시됩니다.

기존 메뉴 ID·이름·가격은 유지하고 없는 ID만 추가합니다. 주문·신청·채팅·입금·적립 테이블은 수정하지 않습니다. 기존 ID에 다른 이름이 등록되어 있으면 임의로 바꾸지 않고 전체 적용을 중단합니다. 반복 적용해도 중복되지 않습니다. 메뉴 알림의 가게 선택 한도는 4곳에서 20곳으로 확장하되 이용 제한 검사와 접근 권한은 유지합니다.

추가 메뉴의 이름은 공개 매장·브랜드 메뉴를 참고했습니다. 가격은 공개 자료와 브랜드 참고 가격을 사용했으며, 지점의 현재 배달앱 가격·판매 여부·옵션까지 실시간 검증한 데이터는 아닙니다. 실제 배달 가능 여부와 최소주문금액도 별도 확인이 필요합니다. 앱 안에 별도의 프로토타입 경고 문구는 추가하지 않습니다.

출처:

- 써브웨이 대전충남대정문점: https://www.diningcode.com/profile.php?rid=denVMMONBpsd
- 맘스터치 브랜드 메뉴: https://order.momstouch.co.kr/momsmall/menu.jsp?menu_cd=001
- 이디야 브랜드 음료: https://ediya.com/contents/drink.html
- 메가MGC커피 브랜드 메뉴: https://www.mega-mgccoffee.com/menu/menu.php
- 컴포즈커피 대전충남대점: https://www.diningcode.com/profile.php?rid=oibRJriHrERW
- 빽다방 충남대후문점: https://www.diningcode.com/profile.php?rid=DKaBidm6hsYx
- 빽다방 브랜드 메뉴: https://paikdabang.com/menu/menu_coffee/
- 롯데리아 충남대점: https://www.diningcode.com/profile.php?rid=GtB8KA659xRE
- 더벤티 충남대점: https://www.diningcode.com/profile.php?rid=KRahYP37KFyr

앱 표시와 SQL 입력의 원본 데이터는 `src/catalogExpansion.json`입니다. 기존의 비활성 카테고리 가게는 그대로 보존합니다.
