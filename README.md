# dashboard_fixed_v9_app

`dashboard_fixed_v9.html`에서 CSS, JS, 기본 거래처 데이터를 분리한 폴더입니다.
기존 localStorage 키는 그대로 사용합니다.

## Entry Points

- `../dashboard_fixed_v9.html`: 기존 Opera 바로가기가 여는 로컬 진입 파일
- `index.html`: Netlify/GitHub용 폴더 내부 진입 파일

## Structure

- `css/style.css`
- `data/client-seed.js`
- `js/storage.js`
- `js/state.js`
- `js/products-grades-erp.js`
- `js/core-auth-nav.js`
- `js/journals-weekly-monthly.js`
- `js/dashboard-records-users.js`
- `js/clients.js`
- `js/daily-entry.js`
- `js/stats-notices.js`
- `js/bootstrap-datepicker.js`
- `js/main.js`

## Netlify 수동 배포

자동 배포가 아니라, GitHub Actions에서 `배포하겠습니다` 버튼을 눌렀을 때만 Netlify에 배포합니다.

Netlify 사이트는 Git 자동 배포를 켜지 않는 방식으로 운영하거나, 이미 Git 연결을 했다면 Netlify의 자동 배포 설정을 꺼둡니다.

GitHub 저장소에는 아래 Secrets가 필요합니다.

- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`

GitHub CLI가 설치되어 있고 로그인되어 있다면 아래 스크립트로 등록할 수 있습니다.

```powershell
.\scripts\setup-github-netlify-secrets.ps1 `
  -NetlifyAuthToken "Netlify에서 만든 token" `
  -NetlifySiteId "Netlify site id"
```

배포할 때는 GitHub 저장소에서:

1. `Actions` 탭으로 이동
2. `배포하겠습니다` workflow 선택
3. `Run workflow` 클릭

수정사항을 저장소에 올리는 것과 실제 배포는 분리됩니다.

```powershell
git add .
git commit -m "수정 내용"
git push
```

위 명령은 저장소 업데이트만 합니다. 실제 Netlify 배포는 `배포하겠습니다` workflow를 실행해야 진행됩니다.

## Amarans API 연동

화면의 `ERP API 연동` 버튼은 `/.netlify/functions/erp-sync`를 호출합니다.
API 키는 프론트 HTML/JS에 넣지 않고 Netlify 환경변수로만 설정합니다.

주문현황/출고현황은 캡처한 cURL 기준으로 기본값이 들어가 있습니다.

- 기본 URL: `https://work.hectonproject.com`
- 기본 주문현황 경로: `/logis/blc0030/0lo00001`
- 기본 주문현황 메뉴코드: `BLC0030`
- 기본 출고현황 경로: `/logis/blf0050/0lo00001`
- 기본 출고현황 메뉴코드: `BLF0050`
- 기본 조회조건: 올해 1월 1일~12월 31일, 품목군 `TM00,TP00`, 거래처분류 `V10002,V10003,V10004,V10005`

필수 환경변수:

- `AMARANS_API_TOKEN` 또는 `AMARANS_API_COOKIE`
- 주문/출고 인증값을 분리해야 하면 `AMARANS_API_ORDER_TOKEN`, `AMARANS_API_SHIP_TOKEN`, `AMARANS_API_ORDER_COOKIE`, `AMARANS_API_SHIP_COOKIE`

선택 환경변수:

- `AMARANS_API_AUTH_HEADER` 기본값: `Authorization`
- `AMARANS_API_AUTH_SCHEME` 기본값: `Bearer`
- `AMARANS_API_BASE_URL` 기본값: `https://work.hectonproject.com`
- `AMARANS_API_ORDER_PATH` 기본값: `/logis/blc0030/0lo00001`
- `AMARANS_API_ORDER_MENU_CODE` 기본값: `BLC0030`
- `AMARANS_API_SHIP_PATH` 기본값: `/logis/blf0050/0lo00001`
- `AMARANS_API_SHIP_MENU_CODE` 기본값: `BLF0050`
- `AMARANS_API_ORDER_BODY_JSON`
- `AMARANS_API_SHIP_BODY_JSON`
- `AMARANS_API_ITEM_GROUPS` 기본값: `TM00,TP00`
- `AMARANS_API_TRADE_GROUPS` 기본값: `V10002,V10003,V10004,V10005`
- `AMARANS_API_WEHAGO_SIGN`
- `AMARANS_API_ORDER_WEHAGO_SIGN`
- `AMARANS_API_SHIP_WEHAGO_SIGN`
- `AMARANS_API_TIMESTAMP`
- `AMARANS_API_ORDER_TIMESTAMP`
- `AMARANS_API_SHIP_TIMESTAMP`
- `AMARANS_API_TRANSACTION_ID`
- `AMARANS_API_ORDER_TRANSACTION_ID`
- `AMARANS_API_SHIP_TRANSACTION_ID`
- `AMARANS_API_EXTRA_HEADERS_JSON`
- `AMARANS_API_ORDER_EXTRA_HEADERS_JSON`
- `AMARANS_API_SHIP_EXTRA_HEADERS_JSON`

캡처한 `authorization`, `cookie`, `wehago-sign` 값은 세션 비밀값이라 만료될 수 있습니다. 코드에 직접 넣지 말고 Netlify Site settings의 Environment variables에만 넣어야 합니다.
`wehago-sign`이 요청마다 달라지는 구조면 캡처값만으로는 오래 유지되지 않을 수 있고, 그 경우 공식 API 인증 방식이나 브라우저 세션에서 sign을 생성하는 별도 프록시가 필요합니다.

### 자동 갱신 동작

대시보드가 열려 있고 로그인 UI 초기화가 끝나면 자동 갱신이 시작됩니다.

- 한국시간 기준 09:00 이상 21:00 미만에만 실행
- 토요일, 일요일은 실행하지 않음
- 2026년 한국 공휴일/대체공휴일은 실행하지 않음
- 마지막 성공 동기화 후 1시간이 지나면 자동으로 `/.netlify/functions/erp-sync` 호출
- 오류가 나면 15분 뒤 다시 시도
- `새로고침` 버튼은 시간/주말/공휴일 제한 없이 즉시 호출

현재 저장소 구조는 브라우저 `localStorage`에 대시보드 데이터를 저장하므로, 자동 갱신은 대시보드가 열려 있을 때 동작합니다. 브라우저를 꺼도 서버에서 계속 최신 데이터를 받아 저장하려면 Netlify Scheduled Function과 별도 저장소(Firebase/DB/Blob 등)를 추가해야 합니다.
