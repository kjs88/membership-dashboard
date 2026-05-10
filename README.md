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

