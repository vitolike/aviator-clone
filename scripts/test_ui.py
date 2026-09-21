# UI 互動自測：實際用滑鼠點 canvas 上的按鈕，驗證下注 / 兌現 / 分頁 / 選單
import asyncio, json
from pathlib import Path
from playwright.async_api import async_playwright

URL = "http://localhost:5190/"
OUT = Path(__file__).resolve().parents[1] / "artifacts"

async def center(page, path):
    return await page.evaluate("""(p) => {
      const o = p.split('.').reduce((a,k)=> a[isNaN(k)?k:+k], window.__aviator);
      const g = o.getGlobalPosition();
      const rect = window.__aviator.app.canvas.getBoundingClientRect();
      if (o.hitArea?.contains?.(-1, -1)) return { x: rect.left + g.x, y: rect.top + g.y }; // 中心對齊的元件
      const w = o.o?.w ?? o.w ?? o.width, h = o.o?.h ?? o.h ?? o.height;
      return { x: rect.left + g.x + w/2, y: rect.top + g.y + h/2 };
    }""", path)

async def state(page):
    return await page.evaluate("""() => { const a = window.__aviator; return {
      phase: a.engine.phase, mult: +a.engine.mult.toFixed(2), bal: +a.game.balance.toFixed(2),
      slots: a.game.slots.map(s=>s.state), tab: a.game.slots[0].tab,
      modal: a.scene.modal.visible, keypad: a.scene.keypad.visible, my: a.game.myBets.length }; }""")

async def main():
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-angle=swiftshader","--enable-unsafe-swiftshader","--use-gl=angle"])
        ctx = await b.new_context(viewport={"width":1366,"height":820}, device_scale_factor=1)
        page = await ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
        page.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        await page.goto(URL); await page.wait_for_timeout(1500)
        log = []

        # 1. 點主按鈕下注
        c = await center(page, "scene.panels.0.mainBtn")
        await page.mouse.click(c["x"], c["y"]); await page.wait_for_timeout(200)
        s1 = await state(page); log.append(("點投注", s1))
        assert s1["slots"][0] in ("queued","active"), "下注沒生效"

        # 2. 等進入飛行後點兌現（若該回合秒崩就重下一注再試，最多 6 回合）
        s2 = None
        for _ in range(6):
            await page.wait_for_function("window.__aviator.engine.phase === 'flying'", timeout=20000)
            await page.wait_for_timeout(700)
            st = await state(page)
            if st["slots"][0] != "active":   # 已被秒崩，補下一注等下回合
                if st["slots"][0] == "idle":
                    c = await center(page, "scene.panels.0.mainBtn")
                    await page.mouse.click(c["x"], c["y"])
                await page.wait_for_function("window.__aviator.engine.phase !== 'flying'", timeout=20000)
                continue
            before = st["bal"]
            c = await center(page, "scene.panels.0.mainBtn")
            await page.mouse.click(c["x"], c["y"]); await page.wait_for_timeout(250)
            s2 = await state(page); log.append(("點兌現", s2))
            assert s2["bal"] > before, "兌現後餘額未增加"
            break
        assert s2, "六個回合內都沒能完成兌現測試"
        await page.screenshot(path=f"{OUT}/t_cashed.png")

        # 3. 切到「自動」分頁
        c = await center(page, "scene.panels.0.tabs.btns.1")
        await page.mouse.click(c["x"], c["y"]); await page.wait_for_timeout(200)
        s3 = await state(page); log.append(("切自動分頁", s3))
        assert s3["tab"] == "auto", "分頁切換失效"

        # 4. 開啟自動兌現 + 設定目標倍數（點數字開鍵盤）
        c = await center(page, "scene.panels.0.autoCashToggle")
        await page.mouse.click(c["x"], c["y"]); await page.wait_for_timeout(150)
        c = await center(page, "scene.panels.0.autoCashBg")
        await page.mouse.click(c["x"], c["y"]); await page.wait_for_timeout(250)
        s4 = await state(page); log.append(("開鍵盤", s4))
        assert s4["keypad"], "數字鍵盤沒打開"
        await page.screenshot(path=f"{OUT}/t_keypad.png")
        # 按 1 . 5 0 確定
        for k in ["1","2","3"]:
            idx = {"1":0,"2":1,"3":2}[k]
            c = await center(page, f"scene.keypad.keys.{idx}")
            await page.mouse.click(c["x"], c["y"]); await page.wait_for_timeout(80)
        c = await center(page, "scene.keypad.okBtn")
        await page.mouse.click(c["x"], c["y"]); await page.wait_for_timeout(200)
        target = await page.evaluate("window.__aviator.game.slots[0].autoCashAt")
        log.append(("鍵盤輸入 123 → 目標倍數", target))
        assert abs(target - 123) < 0.01, f"鍵盤輸入失敗: {target}"

        # 5. 開選單 → Provably Fair
        await page.locator("#menu_toggle_btn").click(); await page.wait_for_timeout(300)
        menu_open = await page.locator("#profile_dropdown").evaluate("el => el.classList.contains('show')")
        log.append(("開選單", menu_open))
        assert menu_open, "選單沒打開"
        await page.evaluate("window.__aviator.scene.modal.open('fair', window.__aviator.scene.ctx())")
        await page.wait_for_timeout(400)
        await page.screenshot(path=f"{OUT}/t_fair.png")

        # 6. 等待本回合飛走後再做 Provably Fair 重算驗證
        await page.evaluate("""() => {
          const e = window.__aviator.engine;
          if (e.phase === 'betting' && e.next) e._startFlight();
          if (e.phase === 'flying') e._crash();
        }""")
        await page.wait_for_function("window.__aviator.engine.history.some(h=>h.serverSeed)", timeout=60000)
        ok = await page.evaluate("""async () => {
          const a = window.__aviator; const h = a.engine.history.find(x=>x.serverSeed);
          if (!h) return 'no-round-yet';
          const m = await import('/src/core/fair.js');
          const v = await m.verify(h.serverSeed, h.clientSeed, h.nonce);
          return v.hash === h.hash && Math.abs(v.crash - h.m) < 1e-9 ? 'verified' : 'MISMATCH';
        }""")
        log.append(("公平驗證", ok))
        assert ok in ("verified","no-round-yet"), "驗證失敗"

        print(json.dumps({"log": log, "errors": errs[:10]}, ensure_ascii=True, indent=1))
        await b.close()

asyncio.run(main())
