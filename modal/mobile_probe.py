"""GPU/CPU cost per scene in phone-like conditions on an ephemeral Modal L4."""
import modal
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("libvulkan1", "mesa-vulkan-drivers", "libegl1", "libgl1", "libgles2", "fonts-dejavu")
    .pip_install("playwright==1.55.0")
    .run_commands("playwright install --with-deps chromium")
    .env({"NVIDIA_DRIVER_CAPABILITIES": "all"})
)
app = modal.App("kit-mobile-probe", image=image)
# Positions to measure: (section selector, fraction of the scroll through it). Adapt per site.
POS = [("#top", 0), ("#top", 0.5), ("#modele", 0.15), ("#modele", 0.6), ("#modele", 0.95)]
PROFILES = {
    "pixel7": dict(viewport={"width": 412, "height": 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True,
                   user_agent="Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"),
    "retina": dict(viewport={"width": 1512, "height": 900}, device_scale_factor=2),
}
INSTR = """() => { const S = window.__kit.stage; window.__cpu = { ms: 0, n: 0 };
  for (const a of S.acts.values()) { const u = a.update.bind(a); a.update = (dt, t) => { const t0 = performance.now(); u(dt, t); window.__cpu.ms += performance.now() - t0; window.__cpu.n++; }; }
  const r = S.composer.render.bind(S.composer); S.composer.render = (d) => { const t0 = performance.now(); r(d); window.__cpu.ms += performance.now() - t0; }; }"""
@app.function(gpu="L4", cpu=4, memory=8192, timeout=1500)
def run(url: str, profile: str, shots: bool):
    import asyncio
    from playwright.async_api import async_playwright
    rows, files = [], {}
    async def main():
        async with async_playwright() as p:
            b = await p.chromium.launch(channel="chromium", headless=True, args=["--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist"])
            ctx = await b.new_context(**PROFILES[profile])
            pg = await ctx.new_page()
            await pg.goto(url, wait_until="load")
            await pg.wait_for_function("document.getElementById('loader').classList.contains('done')", timeout=120000)
            info = await pg.evaluate("({dpr: devicePixelRatio, w: innerWidth, h: innerHeight, canvas: [document.getElementById('stage').width, document.getElementById('stage').height], tq: !!document.createElement('canvas').getContext('webgl2').getExtension('EXT_disjoint_timer_query_webgl2')})")
            rows.append(("info", info))
            await pg.evaluate(INSTR)
            for sel, frac in POS:
                y = await pg.evaluate(f"(()=>{{const e=document.querySelector('{sel}');const r=e.getBoundingClientRect();return r.top+scrollY+{frac}*(r.height-innerHeight);}})()")
                await pg.evaluate(f"window.scrollTo(0,{y})")
                await pg.wait_for_timeout(3000)
                await pg.evaluate("window.__cpu = { ms: 0, n: 0 }")
                await pg.wait_for_timeout(3000)
                r = await pg.evaluate("(()=>{const S=window.__kit.stage;return {gpuMs: +S.perf.gpuMs.toFixed(2), cpuMs: +(window.__cpu.ms/Math.max(1,window.__cpu.n)).toFixed(2), fps: +S.perf.fps.toFixed(1), scale: +S.scale.toFixed(2), px: [S.renderer.domElement.width, S.renderer.domElement.height]}})()")
                rows.append((f"{sel}@{frac}", r))
                if shots: files[f"{profile}-{sel[1:]}-{frac}.jpg"] = await pg.screenshot(type="jpeg", quality=75)
            await b.close()
    asyncio.run(main())
    return rows, files
@app.local_entrypoint()
def main(url: str = "https://example.paulasquin.com/?debug", profile: str = "pixel7", shots: bool = False):
    import pathlib
    rows, files = run.remote(url, profile, shots)
    for k, v in rows: print(k, v)
    d = pathlib.Path("mobile"); d.mkdir(exist_ok=True)
    for k, v in files.items(): (d / k).write_bytes(v)
