"""
Capture screenshots of every screen / window in the current thunderkeg-homepage
build, so the user can feed them to Claude design (artifacts) for the rework.

Dev server must already be running on http://localhost:3000.
Saves PNGs to docs/superpowers/screenshots/.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent / "screenshots"
OUT.mkdir(exist_ok=True, parents=True)
URL = "http://localhost:3000"


def shot(page, name: str):
    """Take a full-viewport screenshot and log the path."""
    path = OUT / f"{name}.png"
    page.screenshot(path=str(path), full_page=False)
    print(f"  -> {path.name}")


def safe_click(page, selector: str, *, timeout: int = 4000) -> bool:
    """Click a selector if present; return True if clicked."""
    try:
        el = page.locator(selector).first
        el.wait_for(state="visible", timeout=timeout)
        el.click()
        return True
    except Exception:
        return False


def open_desktop_icon(page, label: str, screenshot_name: str):
    """Find a desktop icon by visible text and double-click it, then screenshot."""
    print(f"Opening icon: {label}")
    candidates = [
        f'text=/^{label}$/',
        f'text="{label}"',
    ]
    opened = False
    for sel in candidates:
        try:
            el = page.locator(sel).first
            el.wait_for(state="visible", timeout=2000)
            el.dblclick()
            opened = True
            break
        except Exception:
            continue
    if not opened:
        print(f"  (icon '{label}' not found, skipping)")
        return False
    page.wait_for_timeout(1200)
    shot(page, screenshot_name)
    return True


def close_active_window(page):
    """Click the red close dot on the topmost window."""
    try:
        # Red close button in window chrome
        page.locator("button.bg-red-500").last.click(timeout=1500)
        page.wait_for_timeout(300)
    except Exception:
        pass


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        # Capture console errors too so we know what's actually broken
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on(
            "console",
            lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type in ("error", "warning")
            else None,
        )

        # Bypass any saved state so we land on the boot screen
        page.add_init_script(
            "try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}"
        )

        print("\n=== Landing / boot screen ===")
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_timeout(2500)
        shot(page, "01-landing-hero")

        # Click "Explore Features" to advance the landing animation
        if safe_click(page, 'button:has-text("Explore Features")'):
            page.wait_for_timeout(1500)
            shot(page, "02-landing-features")

        # Try to advance to role-select (FeatureSection has its own "continue")
        for label in ("Continue", "Get Started", "Enter", "Continue to Terminal"):
            if safe_click(page, f'button:has-text("{label}")'):
                break
        page.wait_for_timeout(1200)
        shot(page, "03-role-select")

        # Pick "Recruiter" or first available role card
        for label in ("Recruiter", "Professional", "Collaborator", "Continue"):
            if safe_click(page, f'button:has-text("{label}")'):
                break
        page.wait_for_timeout(1500)
        shot(page, "04-desktop-with-terminal")

        # Take a screenshot of just the desktop (close the auto-opened terminal first)
        close_active_window(page)
        page.wait_for_timeout(500)
        shot(page, "05-desktop-empty")

        # Right-click for wallpaper menu
        try:
            page.mouse.click(800, 400, button="right")
            page.wait_for_timeout(500)
            shot(page, "06-wallpaper-menu")
            page.mouse.click(50, 50)  # dismiss
            page.wait_for_timeout(300)
        except Exception:
            pass

        # Cycle through every desktop icon
        icons = [
            ("Terminal", "10-terminal"),
            ("Resume", "11-resume-viewer"),
            ("Flow Chart", "12-flow-chart"),
            ("Agent Select", "13-agent-select"),
            ("About", "14-about"),
            ("Projects", "15-projects"),
            ("Jarvis", "16-jarvis"),
            ("Doom", "17-doom"),
            ("MP3 Player", "18-mp3-player"),
            ("VLC Player", "19-vlc-player"),
        ]
        for label, name in icons:
            opened = open_desktop_icon(page, label, name)
            # Close before opening next, to avoid stacked z-index chaos
            if opened:
                close_active_window(page)
                page.wait_for_timeout(300)

        # Start menu (click first item in taskbar — usually leftmost)
        print("\nStart menu")
        try:
            # Taskbar is fixed bottom; try to find a likely start button
            page.locator(".fixed.bottom-0 button").first.click(timeout=2000)
            page.wait_for_timeout(500)
            shot(page, "20-start-menu")
            page.mouse.click(50, 50)
        except Exception:
            print("  (start menu button not found)")

        # Save error log
        log_path = OUT / "_console-errors.txt"
        log_path.write_text("\n".join(errors) or "(no errors captured)", encoding="utf-8")
        print(f"\nConsole log -> {log_path.name}")

        browser.close()
        print(f"\nDone. Screenshots in {OUT}")


if __name__ == "__main__":
    main()
