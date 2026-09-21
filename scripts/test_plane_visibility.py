import asyncio
from pathlib import Path

from playwright.async_api import async_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts"


async def main():
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1914, "height": 926})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        await page.goto("http://127.0.0.1:5190", wait_until="networkidle")

        for cycle in range(3):
            await page.wait_for_function(
                "window.__aviator?.engine.phase === 'betting' && window.__aviator.engine.next",
                timeout=30_000,
            )
            await page.evaluate("window.__aviator.engine.next.crash = 10")
            await page.wait_for_function(
                "window.__aviator?.engine.phase === 'flying'",
                timeout=30_000,
            )
            await page.wait_for_timeout(350)
            state = await page.evaluate("""() => {
                const flight = window.__aviator.scene.flight;
                return {
                    visible: flight.plane.visible,
                    alpha: flight.plane.alpha,
                    x: flight.plane.x,
                    y: flight.plane.y,
                    width: flight.plane.width,
                    height: flight.plane.height,
                };
            }""")
            assert state["visible"], f"cycle {cycle + 1}: plane hidden"
            assert state["alpha"] > 0.95, f"cycle {cycle + 1}: alpha={state['alpha']}"
            assert state["width"] > 0 and state["height"] > 0
            await page.screenshot(path=OUT / f"flight-{cycle + 1}.png")
            await page.evaluate("window.__aviator.engine.round.crash = window.__aviator.engine.mult")
            await page.wait_for_function(
                "window.__aviator.engine.phase !== 'flying'",
                timeout=60_000,
            )

        assert not errors, errors
        await browser.close()
        print("plane visible across 3 consecutive flights")


if __name__ == "__main__":
    asyncio.run(main())
