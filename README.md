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

아마란스 수집은 로컬 Python 자동화가 담당하고, Netlify 대시보드는 Firebase Realtime Database의 `erp/latest`를 읽습니다.
아마란스 계정 정보와 `wehago-sign`은 브라우저/Netlify에 저장하지 않습니다.

흐름:

1. `scripts/amarans_api_v10.py`가 Playwright로 아마란스에 로그인합니다.
2. 아마란스 페이지가 만든 signed API 요청을 가로채고 payload만 교체합니다.
3. 주문현황/출고현황을 누적 merge한 뒤 대시보드 형식으로 변환합니다.
4. Firebase `erp/latest`에 `{ order, ship, syncedAt, orderCount, shipCount }`를 업로드합니다.
5. 대시보드는 로그인 후 Firebase 최신 ERP 데이터를 불러와 `localStorage`와 화면에 반영합니다.

Python 환경변수:

- `AMARANS_USERNAME`
- `AMARANS_PASSWORD`
- `AMARANS_FIREBASE_DB_URL` 기본값: 대시보드 `DB_URL`
- `AMARANS_FIREBASE_AUTH_TOKEN` Firebase 규칙에서 인증이 필요할 때만
- `AMARANS_REMOTE_ERP_PATH` 기본값: `erp/latest`
- `AMARANS_PAGE_SIZE` 기본값: `99999`
- `AMARANS_SKIP_FIREBASE_UPLOAD=1` 로컬 파일만 만들고 원격 업로드 생략

### 자동 갱신 동작

로컬 Windows 작업 스케줄러가 `scripts/amarans_api_v10.py --auto --recent 90`을 1시간마다 실행합니다.
Python 스크립트는 `--auto`에서 아래 조건을 스스로 검사하고 필요 없는 시간에는 종료합니다.

- 한국시간 기준 09:00 이상 21:00 미만에만 실행
- 토요일, 일요일은 실행하지 않음
- 2026년 한국 공휴일/대체공휴일은 실행하지 않음
- `--force`를 붙이면 시간/주말/공휴일 제한 없이 즉시 수집

대시보드가 열려 있을 때는 마지막 반영 후 1시간이 지나면 Firebase 최신 데이터를 다시 읽습니다.
`새로고침` 버튼은 시간/주말/공휴일 제한 없이 Firebase의 최신 ERP 데이터를 즉시 다시 읽습니다.

아마란스에서 지금 즉시 새 데이터를 다시 수집하려면 로컬 PC에서 아래 명령을 실행합니다.

```powershell
python .\scripts\amarans_api_v10.py --auto --force --recent 90
```
