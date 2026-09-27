# Code Health Guide

이 프로젝트는 운영 중인 단일 페이지 대시보드라서 큰 리라이트보다 작은 단위의 안정적인 정리가 우선입니다.

## 파일 역할

- `index.html`: 화면 구조와 모달 뼈대만 둡니다. 새 비즈니스 로직은 추가하지 않습니다.
- `js/security.js`: 인증, 입력 정화, URL allowlist, 보안 유틸만 둡니다.
- `js/storage.js`: Firebase/localStorage 입출력만 담당합니다.
- `js/state.js`: 전역 상태, 채널 판정, 공통 날짜/휴일 기준을 둡니다.
- `js/app-data.js`: 공유 데이터 로딩, 구버전 데이터 마이그레이션, 활성 화면 새로고침을 담당합니다.
- `js/ui-utils.js`: HTML 출력 정화와 색상 검증처럼 모든 화면이 쓰는 순수 UI helper를 둡니다.
- `js/ui-feedback.js`: 공통 모달과 토스트 동작을 담당합니다.
- `js/core-auth-nav.js`: 로그인, 세션, 메뉴 권한, 페이지 전환을 담당합니다.
- `js/dashboard-sales.js`: 대시보드와 영업현황 집계·차트를 담당합니다.
- `js/records.js`: 방문 기록 목록과 관리자 수정·삭제를 담당합니다.
- `js/users.js`: 계정, 가입 승인, 접속 기록을 담당합니다.
- `js/targets.js`: 팀·개인 목표 설정 화면을 담당합니다.
- `js/account.js`: 본인 비밀번호 변경과 기록 배지를 담당합니다.
- `js/products-grades-erp.js`: 품목별 분석, 거래처 등급, ERP 데이터 정규화를 담당합니다.
- `js/clients.js`: 거래처 DB와 거래처 상세 화면을 담당합니다.
- `js/stats-notices.js`: 실적 분석, 공지, 재방문 화면을 담당합니다.
- `js/journals-weekly.js`, `js/journals-monthly.js`, `js/daily-entry.js`: 영업일지 화면을 담당합니다.
- `js/bootstrap-datepicker.js`: 날짜 범위 피커의 상태와 동작만 담당합니다.

## 새 코드 규칙

1. 비밀번호, ERP 토큰, Firebase 토큰, cURL 쿠키를 저장소에 넣지 않습니다.
2. 사용자 입력값을 HTML 문자열에 넣을 때는 `escHtml()` 또는 기존 escaping helper를 사용합니다.
3. 새 Firebase URL은 `securityNormalizeFirebaseUrl()`을 통과시킵니다.
4. 새 계정 ID 검증은 `authValidateUserId()`를 사용합니다.
5. 비밀번호 검증은 `authValidatePasswordPolicy()`를 사용합니다.
6. 새 외부 스크립트 CDN은 반드시 `integrity`, `crossorigin`, `referrerpolicy`를 붙입니다.
7. 새 기능은 기존 담당 파일에 넣고, 여러 파일에서 필요하면 먼저 공통 함수로 뺍니다.
8. 인라인 이벤트와 `innerHTML`은 기존 호환 때문에 남아 있지만, 새로 늘리지 않는 것을 원칙으로 합니다.
9. 공통 전역 함수는 한 파일에서만 선언하며, 화면별 스크립트에 escaping/모달/토스트 helper를 다시 만들지 않습니다.
10. 데이터가 바뀐 뒤의 화면 갱신은 `appRefreshActivePage()`와 `PAGE_RENDERERS`를 거칩니다.

## 점검 명령

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\security-scan.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\security-scan.ps1 -ShowAdvisory
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\code-health.ps1
node scripts\test-app-architecture.cjs
node scripts\test-app-data.cjs
node scripts\test-cost-analysis.cjs
```

`deploy.cmd` 또는 `scripts\deploy.ps1`은 보안 스캔, 코드 건강도 요약, `git diff --check`를 순서대로 실행한 뒤 푸시합니다.

## 리팩터링 우선순위

1. `index.html`의 인라인 이벤트를 화면별 초기화 함수로 천천히 이전합니다.
2. 반복되는 표/페이지네이션 렌더링을 작은 helper로 정리합니다.
3. `products-grades-erp.js`의 품목·등급·ERP 책임을 더 작은 파일로 분리합니다.
4. `innerHTML` 기반 렌더링 중 사용자 입력이 섞이는 곳부터 DOM 생성 방식으로 바꿉니다.
5. Firebase Authentication 또는 API 프록시를 도입하면 현재 클라이언트 자체 로그인의 한계를 줄일 수 있습니다.
