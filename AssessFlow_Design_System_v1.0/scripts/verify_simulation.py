from pathlib import Path
import os

from playwright.sync_api import sync_playwright


def chromium_path() -> str | None:
    local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))
    candidates = sorted(local_app_data.glob("ms-playwright/chromium-*/chrome-win64/chrome.exe"), reverse=True)
    return str(candidates[0]) if candidates else None


def advance(page, action: str, expected_stage: int) -> None:
    page.locator(f'[data-sim-action="{action}"]').click()
    page.wait_for_timeout(600)
    assert page.locator(".sim-stage.active").get_attribute("data-stage") == str(expected_stage)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=chromium_path())
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.goto((Path(__file__).resolve().parents[1] / "simulation.html").as_uri(), wait_until="load")

    assert page.locator("#stageRail .sim-stage").count() == 8
    assert page.locator("#stageRail .sim-stage.active").get_attribute("data-stage") == "0"
    assert page.locator("#stageTitle").text_content() == "Request assessment"
    assert page.locator("svg > use").count() == 0
    assert page.locator(".sim-inspector-card").count() == 3
    assert page.locator("#contractAudit").text_content() == "assessment.requested"

    advance(page, "request", 1)
    assert page.locator("#contractOwner").text_content() == "HR/Talent"
    assert page.locator("#contractAudit").text_content() == "eligibility.confirmed"
    advance(page, "eligibility", 2)
    page.locator("#simMethod").select_option(label="Case Study / Work Sample")
    advance(page, "plan", 3)
    advance(page, "evidence", 4)
    advance(page, "result", 5)
    advance(page, "recommendation", 6)

    page.locator('[data-sim-action="request-changes"]').click()
    page.wait_for_timeout(600)
    assert page.locator(".sim-stage.active").get_attribute("data-stage") == "5"
    advance(page, "recommendation", 6)
    advance(page, "approve", 7)
    page.locator('[data-sim-action="close"]').click()
    page.wait_for_timeout(600)

    assert page.locator("#stageTitle").text_content() == "Assessment case closed"
    assert page.locator("#caseStatus").text_content() == "Closed"
    assert page.locator("#progressLabel").text_content() == "100%"
    assert page.locator("#contractRule").text_content() == "Closed record is immutable"
    assert page.locator("#stageRail .sim-stage.done").count() == 8
    assert page.locator("#timeline .sim-event").count() >= 9

    page.locator("#resetSimulation").click()
    assert page.locator("#stageRail .sim-stage.active").get_attribute("data-stage") == "0"
    assert page.locator("#caseStatus").text_content() == "Draft"

    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(350)
    mobile_width = page.evaluate("document.documentElement.scrollWidth")
    if mobile_width > page.evaluate("window.innerWidth"):
        print(page.evaluate("Array.from(document.querySelectorAll('body *')).map(el => { const r = el.getBoundingClientRect(); return {tag: el.tagName, cls: String(el.className), left: Math.round(r.left), right: Math.round(r.right)}; }).filter(item => item.right > window.innerWidth + 1 || item.left < -1).slice(0, 12)"))
        raise AssertionError(f"mobile horizontal overflow: {mobile_width}px")

    capture = os.environ.get("AF_CAPTURE")
    if capture:
        page.screenshot(path=capture, full_page=True)

    browser.close()

print("assessflow_simulation=passed")
