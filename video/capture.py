"""Render the 3D acts of a kit site frame by frame on an ephemeral Modal GPU,
1080x1920 at 30 fps, with a virtual clock so every frame is deterministic.
The site must be deployed (the capture loads it with ?capture: full quality, UI hidden).

    MODAL_PROFILE=photomate modal run capture.py --url "https://example.paulasquin.com/?capture&lang=fr"
    MODAL_PROFILE=photomate modal run capture.py --only 3,4   # re-render some shots, splice with ffmpeg

Output: clean.mp4 (3D only, no text, no music) or shots_3-4.mp4.
"""
import modal

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("libvulkan1", "mesa-vulkan-drivers", "libegl1", "libgl1", "libgles2", "fonts-dejavu", "ffmpeg")
    .pip_install("playwright==1.55.0")
    .run_commands("playwright install --with-deps chromium")
    .env({"NVIDIA_DRIVER_CAPABILITIES": "all"})
)
app = modal.App("kit-video-capture", image=image)

FPS = 30
W, H = 1080, 1920
# One shot per bar of the music (96 BPM: 2.5 s). Fields: start s, end s, act name,
# progress from, progress to, easing, options:
#   zoom         camera zoom on top of the site's portrait framing (tighter for video)
#   shift        horizontal view shift (fraction of the width) to recentre a subject,
#                fading out as the progress reaches shift_until
#   restart      restart the act's wall-clock intro at the start of the shot (act.t0),
#                restartAt ms into it
SHOTS = [
    (0.0, 5.0, "intro", 0.00, 0.30, "linear", {"restart": True}),
    (5.0, 7.5, "intro", 0.30, 1.00, "in", {}),
    (7.5, 15.0, "model", 0.00, 0.33, "linear", {"zoom": 1.3}),
    (15.0, 22.5, "model", 0.40, 0.70, "inout", {"zoom": 1.3}),
    (22.5, 30.0, "model", 0.70, 1.00, "out", {"zoom": 1.2}),
]

CLOCK = """(() => {
  let now = 0; const start = Date.now(); let q = [];
  performance.now = () => now;
  Date.now = () => start + now;
  window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
  window.cancelAnimationFrame = () => {};
  window.__advance = (ms) => { now += ms; const cbs = q; q = []; for (const cb of cbs) { try { cb(now); } catch (e) { console.error(e); } } };
})();"""

STEP = """([act, p, first, o]) => {
  const B = window.__kit, a = B.acts[act];
  document.getElementById('stage-labels').style.display = 'none';
  if (B.stage.active !== a) B.stage.setActive(act);
  if (first && o.restart) a.t0 = performance.now() - (o.restartAt || 0);
  a.camera.zoom = o.zoom || 1;
  if (o.shift) a.camera.setViewOffset(innerWidth, innerHeight, o.shift * innerWidth * (1 - Math.min(1, p / (o.shift_until || 1))), 0, innerWidth, innerHeight);
  a.camera.updateProjectionMatrix();
  a.setProgress(p);
  window.__advance(1000 / 30);
}"""

def ease(k, t):
    if k == "in": return t * t
    if k == "out": return 1 - (1 - t) ** 2
    if k == "inout": return 3 * t * t - 2 * t * t * t
    return t

@app.function(gpu="L4", cpu=8, memory=16384, timeout=3600)
def render(url: str, only: str = "") -> bytes:
    keep = {int(x) for x in only.split(",") if x}
    import asyncio, subprocess, pathlib
    from playwright.async_api import async_playwright
    out = pathlib.Path("/tmp/frames"); out.mkdir()
    async def main():
        async with async_playwright() as p:
            b = await p.chromium.launch(channel="chromium", headless=True,
                                        args=["--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist"])
            pg = await b.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
            pg.on("pageerror", lambda e: print("PAGEERROR", e))
            await pg.add_init_script(CLOCK)
            await pg.goto(url, wait_until="load")
            for _ in range(2000):  # let the loader finish on the virtual clock
                await pg.evaluate("window.__advance && window.__advance(16)")
                if await pg.evaluate("!!window.__kit && document.getElementById('loader').classList.contains('done')"):
                    break
                await pg.wait_for_timeout(20)
            await pg.wait_for_timeout(1500)
            n = 0
            for si, (t0, t1, act, p0, p1, k, opts) in enumerate(SHOTS):
                frames = round((t1 - t0) * FPS)
                if keep and si not in keep and si + 1 not in keep:
                    continue
                for i in range(frames):
                    pr = p0 + (p1 - p0) * ease(k, i / max(1, frames - 1))
                    await pg.evaluate(STEP, [act, pr, i == 0, opts])
                    if keep and si not in keep:
                        continue  # previous shot is replayed only to warm up the act
                    await pg.screenshot(path=str(out / f"f{n:04d}.png"))
                    n += 1
                print(act, t0, t1, "done", n, flush=True)
            await b.close()
    asyncio.run(main())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", "/tmp/frames/f%04d.png",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "/tmp/clean.mp4"], check=True)
    return pathlib.Path("/tmp/clean.mp4").read_bytes()

@app.local_entrypoint()
def main(url: str = "https://example.paulasquin.com/?capture", only: str = ""):
    data = render.remote(url, only)
    name = "clean.mp4" if not only else f"shots_{only.replace(',', '-')}.mp4"
    open(name, "wb").write(data)
    print(name, len(data) // 1024, "KiB")
