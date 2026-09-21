import sys, asyncio
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).resolve().parents[1] / "artifacts"
URL = "http://localhost/"

async def main():
    OUT.mkdir(exist_ok=True)
    # 參數：模式 pc|mobile，等待秒數，額外 JS
    mode = sys.argv[1] if len(sys.argv) > 1 else "pc"
    wait = float(sys.argv[2]) if len(sys.argv) > 2 else 2.0
    js = sys.argv[3] if len(sys.argv) > 3 else ""
    vp = {"width": 1914, "height": 926} if mode == "pc" else {"width": 390, "height": 844}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--use-gl=angle","--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport=vp, device_scale_factor=2)
        page = await ctx.new_page()
        errs = []
        page.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type in ("error", "warning") else None)
        page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        await page.goto(URL)
        await page.wait_for_timeout(1200)
        if js:
            await page.evaluate(js)
        await page.wait_for_timeout(wait * 1000)
        await page.screenshot(path=OUT / f"{mode}.png")
        print("\n".join(errs[:20]) or "no console errors")
        await b.close()

asyncio.run(main())
