"""Render one act at given progress values with the page UI hidden (local Chromium, software WebGL).
Usage: shot3d.py out_prefix act p1 p2 ... [--ui] [--w=1440 --h=900] [--url=http://127.0.0.1:8000/]
The page must expose window.__kit (?debug) — see js/main.js."""
import asyncio, sys
from playwright.async_api import async_playwright
import glob, os
# Playwright's own browser, or CHROME=/path/to/chrome-headless-shell when its version is missing.
P = os.environ.get('CHROME') or (glob.glob(os.path.expanduser('~/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell')) or [None])[0]

async def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = dict(a[2:].split('=') if '=' in a else (a[2:], '1') for a in sys.argv[1:] if a.startswith('--'))
    prefix, act, *ps = args
    w, h = int(flags.get('w', 1440)), int(flags.get('h', 900))
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=P, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': w, 'height': h})
        logs = []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
        await pg.goto(flags.get('url', 'http://127.0.0.1:8000/') + '?debug', wait_until='load')
        await pg.wait_for_function("window.__kit && document.getElementById('loader').classList.contains('done')", timeout=240000)
        if 'ui' not in flags:
            await pg.add_style_tag(content='main,.topnav,.footer,.grain{visibility:hidden!important}')
        for i, pr in enumerate(ps):
            await pg.evaluate(f"""(() => {{
              const B = window.__kit; const a = B.acts['{act}'];
              ScrollTrigger.getAll().forEach(t => t.disable(false));
              B.stage.setActive('{act}'); a.setProgress({pr});
              if (a.intro !== undefined) a.t0 = performance.now() - 60000;
              if (a.enterTime !== undefined) a.enterAt = performance.now() - 5000;
            }})()""")
            await pg.wait_for_timeout(int(flags.get('wait', 3000)))
            await pg.screenshot(path=f'{prefix}-{i:02d}.png', timeout=240000)
        print('\n'.join(logs[:30]))
        await b.close()
asyncio.run(main())
