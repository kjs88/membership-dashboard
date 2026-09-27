# 원가분석현황(마감기준)

## 구현 상태 (2026-09-27)

- 전용 메뉴, 월 선택, 매출/원가/매익/매익률, 월별 추이, 기준별 표, 엑셀 내보내기 구현.
- 기본 접근은 관리자. 다른 계정은 기존 계정 관리의 메뉴 권한에서 `원가분석현황(마감기준)`을 부여한다.
- 실제 ERP 수집 연결 완료. `영업관리 -> 매출마감관리 -> 원가분석현황(마감기준)` 화면의 `BLG0130` API를 기존 Amarans route-fetch 방식으로 호출한다.
- 아마란스의 `마감기준`, `관리분류별`, `품목분류별` 탭과 각 세부 기준을 모두 수집한다.
- 조건은 월별, 품목군 `TM00. 상품` 조회 후 응답의 고객분류명에 `도매`가 포함된 행만 저장한다.
- 2026년 1월~9월 데이터는 Firebase `erp/costAnalysis/2026/months`에 업로드 완료했다.
- 기존 주문/출고 예약 주기는 변경하지 않았다. 자동 실행 시 같은 로그인 세션에서 원가분석도 갱신한다.

## 수집 실행

원가분석만 갱신:

```powershell
python scripts\amarans_api_v10.py --cost-only
```

기존 출고/주문 수집과 함께 갱신:

```powershell
python scripts\amarans_api_v10.py --recent 60
```

`--cost-only`는 `erp/latest` 대용량 주문/출고 노드를 건드리지 않고 `erp/costAnalysis/YYYY`만 갱신한다. 비밀번호는 프롬프트 또는 기존 환경변수 입력을 사용하며, 스크립트는 비밀번호를 파일에 저장하지 않는다.

## 화면의 데이터 계약

Firebase `erp/costAnalysis/YYYY`:

```json
{
  "schemaVersion": 1,
  "months": {
    "2026-09": {
      "syncedAt": "2026-09-27T09:00:00+09:00",
      "basis": "마감기준",
      "itemGroups": ["TM00"],
      "customerGroups": ["V10002", "V10003", "V10004", "V10005", "V10006", "V10007"],
      "customerClassContains": "도매",
      "rowCount": 5,
      "views": {
        "closing-customer": {
          "tab": "마감기준",
          "label": "고객",
          "rowCount": 0,
          "rows": []
        },
        "mgmt-customer-class": {
          "tab": "관리분류별",
          "label": "고객분류",
          "rowCount": 5,
          "rows": []
        },
        "item-large": {
          "tab": "품목분류별",
          "label": "대분류",
          "rowCount": 0,
          "rows": []
        }
      },
      "totals": {
        "sales": 0,
        "cost": 0,
        "profit": 0,
        "marginRate": 0
      },
      "rows": [
        {
          "code": "V10003",
          "name": "도매(장재순)",
          "sales": 0,
          "cost": 0,
          "profit": 0,
          "marginRate": 0
        }
      ]
    }
  }
}
```

각 행: `code`(기준별 고유 코드), `name`(이름), `sales`(매출 원), `cost`(원가 원), `profit`(매익 원), `marginRate`(행 매익률). 금액은 유한한 숫자이며 반품의 음수를 유지한다. ERP의 합계/소계 행을 개별 구분과 중복 저장하지 않는다. 화면 상단 매익률은 `sum(profit) / sum(sales) * 100`, 매출 0일 때 `-`.

하위 호환을 위해 월 노드의 `rows`는 `관리분류별 > 고객분류`와 동일하게 유지한다. 새 화면은 `views`를 우선 사용한다.

성공적으로 조회된 빈 월만 `rowCount: 0`으로 저장한다. 미수집 월은 노드가 없으며 0원으로 표시하지 않는다. Firebase가 빈 배열을 제거하는 특성 때문에 `rowCount: 0`은 필수다. 갱신 시간은 수집 성공 시각이다.

## 확인

`node scripts/test-cost-analysis.cjs`로 가중 매익률, 음수, 매출 0, 월 불일치, 중복 구분, 잘못된 금액, Firebase 빈 배열 처리 검증.

`test-results/cost-preview.html`은 로컬 테스트 데이터 전용이며 Git에 포함하지 않는다. 실제 금액으로 혼동하거나 업로드하지 않는다.
