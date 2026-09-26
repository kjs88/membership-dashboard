"""Read-only discovery of the closing-cost report; never log credentials or amounts."""
import json
import os

from playwright.sync_api import sync_playwright
from amarans_api_v10 import login, switch_company


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(20000)
        login(page, os.environ["AMARANS_USERNAME"], os.environ["AMARANS_PASSWORD"])
        try:
            switch_company(page)
        except Exception:
            print("COMPANY_SWITCH_FAILED", page.url)
            text = page.locator("body").inner_text()
            if "아이디/비밀번호가 일치하지 않습니다" in text:
                print("LOGIN_REJECTED: stored Amarans credentials do not match. No retry.")
            else:
                print("LOGIN_OR_COMPANY_SELECTION_UNAVAILABLE")
            browser.close()
            raise RuntimeError("Company switch unavailable; inspect visible login state.") from None
        for label in ["영업관리", "매출마감관리", "원가분석현황(마감기준)", "관리분류별", "관리구분별"]:
            locator = page.get_by_text(label, exact=True)
            visible = [item for item in locator.all() if item.is_visible()]
            if visible:
                visible[0].click()
                page.wait_for_timeout(2000)
                print("OPENED", label, page.url)

        print("PAGE", page.url)
        print("CONTROLS", json.dumps(page.locator("button, input, a, [role=tab]").evaluate_all(
            "els => els.filter(e => e.getClientRects().length).map(e => ({tag:e.tagName,text:(e.innerText||'').slice(0,80),placeholder:e.getAttribute('placeholder'),href:e.getAttribute('href')}))"
        ), ensure_ascii=False))
        if "원가분석" not in page.locator("body").inner_text():
            print("REPORT_NOT_OPENED")
            browser.close()
            raise RuntimeError("Cost report navigation must be verified.")

        def inspect(response):
            if "/logis/" not in response.url or response.request.method != "POST":
                return
            try:
                request = response.request.post_data_json
                data = response.json()
                def shape(value, depth=0):
                    if depth > 5:
                        return type(value).__name__
                    if isinstance(value, dict):
                        return {key: shape(child, depth + 1) for key, child in value.items()}
                    if isinstance(value, list):
                        return {"length": len(value), "row": shape(value[0], depth + 1) if value else None}
                    return type(value).__name__
                print("API", response.url.split("?")[0], "STATUS", response.status)
                print("REQUEST_SHAPE", json.dumps(shape(request), ensure_ascii=False))
                print("RESPONSE_SHAPE", json.dumps(shape(data), ensure_ascii=False))
            except Exception:
                print("NON_JSON_RESPONSE")

        page.on("response", inspect)
        query = page.get_by_role("button", name="조회", exact=True)
        if query.count():
            query.first.click()
            page.wait_for_timeout(10000)
        else:
            browser.close()
            raise RuntimeError("Cost report query control was not found.")
        browser.close()


if __name__ == "__main__":
    main()
