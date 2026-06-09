# Security Notes

이 대시보드는 GitHub Pages 정적 호스팅과 Firebase Realtime Database를 사용합니다.
정적 클라이언트에는 비밀키를 안전하게 숨길 수 없으므로, 브라우저 코드만으로는 Firebase REST API 직접 공격을 완전히 차단할 수 없습니다.

## 현재 적용된 방어

- PBKDF2-SHA256 비밀번호 해시 저장
- 기존 평문 비밀번호 로그인 성공 시 자동 해시 마이그레이션
- Firebase/DOM 입력 데이터 정화
- Firebase URL allowlist 검증
- CSP meta, SRI, referrer policy 적용
- iframe 삽입 방어 스크립트
- 배포 전 비밀정보/토큰 스캔
- GitHub Actions 최소 권한 설정

## 운영자가 꼭 해야 하는 설정

1. GitHub Secrets에만 ERP/Firebase 토큰을 저장합니다.
2. cURL에서 복사한 `Bearer`, `BIZCUBE`, `oAuthToken`, `signKey` 값을 저장소에 넣지 않습니다.
3. Firebase Console에서 최소한 공개 쓰기 권한을 끄는 방향으로 전환합니다.
4. 완전한 방어가 필요하면 Firebase Authentication 또는 별도 API 프록시를 도입해야 합니다.

## 권장 Firebase Rules 전환 방향

현재 앱은 자체 로그인 계정으로 동작하므로, 아래 규칙은 Firebase Authentication 도입 후 적용하는 목표 형태입니다.

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": false,
    "erp": {
      "latest": {
        ".read": "auth != null",
        ".write": "auth.token.admin === true"
      }
    },
    "data": {
      ".read": "auth != null",
      ".write": "auth.token.admin === true"
    }
  }
}
```

Firebase Auth 전환 전에는 이 규칙을 그대로 적용하면 현재 브라우저 저장 기능이 막힙니다.
