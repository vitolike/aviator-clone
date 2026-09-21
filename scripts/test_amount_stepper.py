import asyncio

from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1366, "height": 820})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        await page.goto("http://127.0.0.1", wait_until="networkidle")
        await page.wait_for_function("window.__aviator?.scene?.panels?.[0]")

        await page.evaluate("""() => {
          const a = window.__aviator;
          a.game.slots[0].state = 'idle';
          a.game.setAmount(a.game.slots[0], 0.40);
        }""")

        async def click_control(name):
            point = await page.evaluate("""name => {
              const a = window.__aviator;
              const control = a.scene.panels[0][name];
              const global = control.getGlobalPosition();
              const rect = a.app.canvas.getBoundingClientRect();
              return { x: rect.left + global.x, y: rect.top + global.y };
            }""", name)
            await page.mouse.click(point["x"], point["y"])
            await page.wait_for_timeout(100)

        await click_control("plusBtn")
        increased = await page.evaluate("""() => {
          const a = window.__aviator;
          return [a.game.slots[0].amount, a.scene.panels[0].amtText.text, a.scene.panels[0].mainBtn.sub.text];
        }""")
        assert increased == [0.5, "0.50", "0.50 USD"], increased

        await click_control("minusBtn")
        decreased = await page.evaluate("""() => {
          const a = window.__aviator;
          return [a.game.slots[0].amount, a.scene.panels[0].amtText.text, a.scene.panels[0].mainBtn.sub.text];
        }""")
        assert decreased == [0.4, "0.40", "0.40 USD"], decreased
        assert not errors, errors
        await browser.close()
        print("stepper + and - update state and both visible labels")


if __name__ == "__main__":
    asyncio.run(main())
