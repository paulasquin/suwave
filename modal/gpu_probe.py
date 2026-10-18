"""Ephemeral Modal GPU box: check whether headless Chromium gets hardware WebGL,
then measure frame rates of each 3D act of the site and grab 1080p captures."""
import modal

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("libvulkan1", "mesa-vulkan-drivers", "libegl1", "libgl1", "libgles2", "vulkan-tools", "fonts-noto-color-emoji", "fonts-dejavu")
    .pip_install("playwright==1.55.0")
    .run_commands("playwright install --with-deps chromium")
    .env({"NVIDIA_DRIVER_CAPABILITIES": "all"})
)
app = modal.App("kit-gpu-probe", image=image)

FLAG_SETS = {
    "angle-vulkan": ["--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
    "angle-egl": ["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist"],
    "default": ["--ignore-gpu-blocklist"],
}

JS_FPS = """async (ms) => new Promise(res => { let n = 0; const t0 = performance.now();
  function f(){ n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(n * 1000 / (performance.now() - t0)); }
  requestAnimationFrame(f); })"""

@app.function(gpu="L4", cpu=8, memory=16384, timeout=1800)
def probe(url: str, flag_set: str = "", shots: bool = False):
    import asyncio, subprocess, json
    from playwright.async_api import async_playwright
    sh = lambda c: subprocess.run(c, shell=True, capture_output=True, text=True).stdout.strip()
    out = {"nvidia": sh("nvidia-smi -L"), "icd": sh("ls /usr/share/vulkan/icd.d /etc/vulkan/icd.d 2>&1"),
           "nvlibs": sh("ldconfig -p | grep -i -E 'nvidia|libcuda' | head -20"), "vulkaninfo": sh("vulkaninfo --summary 2>&1 | grep -E 'deviceName|driverName' | head")}
    files = {}

    async def run(name, flags):
        async with async_playwright() as p:
            b = await p.chromium.launch(channel="chromium", args=flags, headless=True)
            pg = await b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
            await pg.goto("about:blank")
            txt = ""
            renderer = await pg.evaluate("""() => { const gl = document.createElement('canvas').getContext('webgl2');
              const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : String(!!gl); }""")
            res = {"renderer": renderer, "webgl_status": [l for l in txt.splitlines() if l.startswith(("WebGL", "WebGL2", "Vulkan"))][:6]}
            if url and ("SwiftShader" not in renderer or name == "default"):
                await pg.goto(url, wait_until="load")
                await pg.wait_for_function("document.getElementById('loader').classList.contains('done')", timeout=120000)
                await pg.wait_for_timeout(3000)
                fps = {}
                for sel, frac in [("#top", 0.0), ("#top", 0.5), ("#modele", 0.15), ("#modele", 0.6), ("#modele", 0.95)]:  # adapt per site
                    y = await pg.evaluate(f"(()=>{{const e=document.querySelector('{sel}');const r=e.getBoundingClientRect();return r.top+scrollY+{frac}*(r.height-innerHeight);}})()")
                    await pg.evaluate(f"window.scrollTo(0,{y})")
                    await pg.wait_for_timeout(2500)
                    fps[f"{sel}@{frac}"] = round(await pg.evaluate(JS_FPS, 3000), 1)
                    if shots:
                        files[f"{name}-{sel[1:]}-{frac}.png"] = await pg.screenshot(type="png")
                res["fps"] = fps
            await b.close()
            return res

    async def main():
        sets = [flag_set] if flag_set else list(FLAG_SETS)
        for n in sets:
            try:
                out[n] = await run(n, FLAG_SETS[n])
            except Exception as e:
                out[n] = {"error": repr(e)[:400]}
    asyncio.run(main())
    return out, files

@app.local_entrypoint()
def main(url: str = "https://example.paulasquin.com/", flag_set: str = "", shots: bool = False):
    import json, pathlib
    out, files = probe.remote(url, flag_set, shots)
    print(json.dumps(out, indent=1, ensure_ascii=False))
    d = pathlib.Path("shots"); d.mkdir(exist_ok=True)
    for k, v in files.items():
        (d / k).write_bytes(v)
    print("saved", len(files), "captures in", d.resolve())
