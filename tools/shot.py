"""Screenshot the page at scroll positions. Usage: shot.py url out_prefix spec...
spec = 0.42 (fraction of the page) or #section@0.5 (fraction of the scroll through that section).
Env: VW, VH, DSF (viewport, device scale), WAIT0 (ms after load), CHROME (browser path)."""
import asyncio, sys, json
from playwright.async_api import async_playwright
import glob, os
# Playwright's own browser, or CHROME=/path/to/chrome-headless-shell when its version is missing.
CHROME = os.environ.get("CHROME") or (glob.glob(os.path.expanduser("~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell")) or [None])[0]

async def main():
    url, prefix = sys.argv[1], sys.argv[2]
    specs = sys.argv[3:]
    w, h = int(__import__("os").environ.get("VW", 1440)), int(__import__("os").environ.get("VH", 900))
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=float(__import__('os').environ.get('DSF', 1)), is_mobile=w < 700, has_touch=w < 700)
        logs = []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        await pg.goto(url, wait_until='load')
        await pg.wait_for_function("document.getElementById('loader').classList.contains('done')", timeout=180000)
        await pg.wait_for_timeout(int(__import__("os").environ.get("WAIT0", "4000")))
        for i, spec in enumerate(specs):
            if spec.startswith('#'):
                sel, _, frac = spec.partition('@')
                y = await pg.evaluate(f"""(() => {{ const e = document.querySelector('{sel}'); const r = e.getBoundingClientRect(); return r.top + scrollY + {float(frac or 0)} * (r.height - innerHeight); }})()""")
            else:
                y = await pg.evaluate(f"document.documentElement.scrollHeight * {float(spec)}")
            await pg.evaluate(f"window.scrollTo(0, {y})")
            await pg.wait_for_timeout(3500)
            await pg.screenshot(path=f'{prefix}-{i:02d}.png', timeout=240000)
        print('\n'.join(logs[:40]))
        await b.close()

asyncio.run(main())
