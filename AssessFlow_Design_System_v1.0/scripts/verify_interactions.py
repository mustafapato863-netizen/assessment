from pathlib import Path
import os

from playwright.sync_api import sync_playwright


def chromium_path() -> str | None:
    local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))
    candidates = sorted(local_app_data.glob("ms-playwright/chromium-*/chrome-win64/chrome.exe"), reverse=True)
    return str(candidates[0]) if candidates else None


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=chromium_path())
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    port = os.environ.get("AF_TEST_PORT")
    if port:
        page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
    else:
        page.goto((Path(__file__).resolve().parents[1] / "index.html").as_uri(), wait_until="load")

    assert page.locator(".skip-link").count() == 1
    assert page.locator("svg > use").count() == 0
    assert page.locator(".sidebar .nav-item svg path").count() > 0
    assert page.locator(".loader-ring").count() == 1
    assert page.locator(".skeleton-demo span").count() == 3
    assert page.locator(".search-results").get_attribute("hidden") is not None
    assert page.locator(".metrics-grid .kpi").count() == 4
    assert page.locator(".metrics-grid .kpi-chart span").count() == 28
    assert page.locator(".metrics-grid .kpi-trend.danger").count() == 1
    assert page.locator(".loader-orbit").count() == 1
    assert page.locator(".loader-progress i").count() == 1
    search = page.locator("#searchInput")
    search.fill("workflow")
    assert page.locator(".search-result").count() > 0
    page.locator(".search-result").first.click()
    assert page.locator("#workflow").is_visible()
    search.press("Escape")
    assert page.locator(".search-results").get_attribute("hidden") is not None

    page.locator("#collapseSidebar").click()
    assert page.locator("body.sidebar-collapsed").count() == 1
    page.locator("#collapseSidebar").click()
    assert page.locator("body.sidebar-collapsed").count() == 0

    theme = page.locator("#themeToggle")
    initial_theme = theme.get_attribute("aria-pressed")
    theme.click()
    assert theme.get_attribute("aria-pressed") != initial_theme

    toggle = page.locator(".toggle").first
    initial_toggle = toggle.get_attribute("aria-checked")
    toggle.click()
    assert toggle.get_attribute("aria-checked") != initial_toggle

    async_button = page.locator(".async-demo .btn-primary")
    async_button.click()
    assert async_button.get_attribute("aria-busy") == "true"
    assert async_button.locator(".btn-spinner").count() == 1
    assert "is-loading" in (async_button.get_attribute("class") or "")
    page.wait_for_timeout(1000)
    assert async_button.get_attribute("aria-busy") is None
    assert "is-loading" not in (async_button.get_attribute("class") or "")

    page.locator(".tab").nth(1).click()
    assert page.locator(".tab").nth(1).get_attribute("aria-selected") == "true"

    page.set_viewport_size({"width": 390, "height": 844})
    page.locator("#mobileMenu").click()
    assert page.locator("body.mobile-nav-open").count() == 1
    page.locator(".mobile-scrim").click(position={"x": 370, "y": 500})
    assert page.locator("body.mobile-nav-open").count() == 0

    capture = os.environ.get("AF_CAPTURE")
    if capture:
        page.screenshot(path=capture, full_page=True)

    browser.close()

print("assessflow_interactions=passed")
