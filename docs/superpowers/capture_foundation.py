"""Capture a single screenshot of the foundation desktop (no apps wired yet)."""
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent / "screenshots"
OUT.mkdir(exist_ok=True, parents=True)
URL = "http://localhost:3000"


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.on("console", lambda msg: print(f"[console.{msg.type}] {msg.text}"))
        page.goto(URL, wait_until="domcontentloaded")
        # Give the auto-open terminal a moment to mount.
        page.wait_for_timeout(1500)
        out = OUT / "10-foundation.png"
        page.screenshot(path=str(out), full_page=False)
        print(f"saved {out}")
        ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
