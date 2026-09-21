import asyncio
import json
import os
from playwright.async_api import async_playwright

URL = "http://localhost/"
OUT_DIR = r"C:\Users\victo\.gemini\antigravity-ide\brain\789d94a7-7f6d-4638-839f-be5eecfef990"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 860}, device_scale_factor=1)
        page = await context.new_page()

        errors = []
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: errors.append(f"console {m.type}: {m.text}") if m.type == "error" else None)

        print("Navigating to", URL)
        await page.goto(URL, wait_until="networkidle")
        await page.wait_for_timeout(1000)

        # Click on canvas to focus and unlock audio/interactions
        await page.mouse.click(700, 400)

        # 1. Take initial screenshot (waiting or initial state)
        shot1 = os.path.join(OUT_DIR, "aviator_initial_verified.png")
        await page.screenshot(path=shot1)
        print(f"Saved initial screenshot to {shot1}")

        # Check ticker and engine state
        chk = await page.evaluate("""() => {
            const a = window.__aviator;
            return {
                tickerStarted: a.app.ticker.started,
                tickerFPS: a.app.ticker.FPS,
                phase: a.engine.phase,
                t: a.engine.t,
                hasRound: !!a.engine.round,
                hasNext: !!a.engine.next
            };
        }""")
        print("Engine check:", json.dumps(chk, indent=2))

        # If waiting, wait or trigger flight
        for _ in range(15):
            await page.wait_for_timeout(1000)
            p = await page.evaluate("window.__aviator.engine.phase")
            t = await page.evaluate("window.__aviator.engine.t")
            m = await page.evaluate("window.__aviator.engine.mult")
            print(f"Current phase: {p}, t: {t}, mult: {m}")
            if p == "flying":
                break

        # 3. Take in-flight screenshot
        shot2 = os.path.join(OUT_DIR, "aviator_inflight_verified.png")
        await page.screenshot(path=shot2)
        print(f"Saved in-flight screenshot to {shot2}")

        # 4. Check state
        state = await page.evaluate("""() => {
            const a = window.__aviator;
            return {
                balance: a.game.balance,
                phase: a.engine.phase,
                mult: a.engine.mult,
                slots: a.game.slots.map(s => ({ amount: s.amount, state: s.state })),
                historyCount: a.engine.history.length
            };
        }""")
        print("Game State:", json.dumps(state, indent=2))

        # 5. Wait for next betting phase to test bet placement
        print("Waiting for betting phase...")
        await page.wait_for_function("window.__aviator.engine.phase === 'betting'", timeout=30000)
        await page.wait_for_timeout(500)

        # Click Bet on Panel 0
        btn_pos = await page.evaluate("""() => {
            const btn = window.__aviator.scene.panels[0].mainBtn;
            const gp = btn.getGlobalPosition();
            return { x: gp.x + btn.o.w / 2, y: gp.y + btn.o.h / 2 };
        }""")
        await page.mouse.click(btn_pos["x"], btn_pos["y"])
        await page.wait_for_timeout(300)

        # Check that slot 0 is queued
        s_queued = await page.evaluate("window.__aviator.game.slots[0].state")
        print("Slot 0 state after clicking Bet:", s_queued)

        # Wait for flying phase again and click Cash Out
        await page.wait_for_function("window.__aviator.engine.phase === 'flying'", timeout=20000)
        await page.wait_for_timeout(600)

        c_pos = await page.evaluate("""() => {
            const btn = window.__aviator.scene.panels[0].mainBtn;
            const gp = btn.getGlobalPosition();
            return { x: gp.x + btn.o.w / 2, y: gp.y + btn.o.h / 2 };
        }""")
        await page.mouse.click(c_pos["x"], c_pos["y"])
        await page.wait_for_timeout(500)

        shot3 = os.path.join(OUT_DIR, "aviator_cashed_verified.png")
        await page.screenshot(path=shot3)
        print(f"Saved cashed-out screenshot to {shot3}")

        final_bal = await page.evaluate("window.__aviator.game.balance")
        toast = await page.evaluate("window.__aviator.scene.toastText.text")
        print(f"Final Balance: ${final_bal:.2f}, Toast Message: {toast}")

        print("Errors captured:", errors)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
