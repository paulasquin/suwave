"""Synthesize a 30 s space-themed track (D minor, 96 BPM, one bar = 2.5 s) for the video.
Everything is generated here, so there is no licensing question. The structure (intro,
riser at 5 s, impact at 7.5 s, build 12.5-15 s, drop 15-25 s, outro) matches the shot grid
of capture.py; move the FX placements at the bottom to re-time the accents.

    uv run --with numpy --with scipy python music.py   # -> music.wav
"""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
DUR = 30.0
N = int(SR * DUR)
BEAT = 60 / 96
BAR = 4 * BEAT
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env_adsr(n, a, d, s, r, sr=SR):
    e = np.ones(n) * s
    A, D, R = int(a * sr), int(d * sr), int(r * sr)
    A = min(A, n); e[:A] = np.linspace(0, 1, A)
    D = min(D, n - A); e[A:A + D] = np.linspace(1, s, D)
    if R > 0 and R < n: e[-R:] *= np.linspace(1, 0, R)
    return e


def saw(freq, n, phase=0.0):
    # Band-limited sawtooth by additive synthesis (harmonics below 9 kHz).
    t = np.arange(n) / SR
    out = np.zeros(n)
    k = 1
    while k * freq < 9000 and k < 40:
        out += np.sin(2 * np.pi * k * freq * t + phase * k) / k
        k += 1
    return out * 0.6


def lowpass(x, fc, order=2):
    b, a = signal.butter(order, min(fc, SR / 2 - 100) / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def highpass(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def place(buf, x, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N: return
    x = x[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, i:i + len(x)] += x * gain * l * 1.4142
    buf[1, i:i + len(x)] += x * gain * r * 1.4142


def reverb(x, seconds=3.2, decay=1.1, tone=5000):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for c in range(2):
        noise = rng.standard_normal(n) * np.exp(-t / decay)
        ir[c] = lowpass(noise, tone)
        ir[c, : int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    ir /= np.abs(ir).sum(axis=1, keepdims=True).max() / 6
    return np.stack([signal.fftconvolve(x[c], ir[c])[:N] for c in range(2)])


dry = np.zeros((2, N))   # drums, bass
wet = np.zeros((2, N))   # pads, arps, bells, fx (sent to the reverb)

# --- Chords: one per bar ---------------------------------------------------
DM, BB, FF, CC = [50, 57, 62, 65, 69, 76], [46, 53, 58, 62, 65, 72], [41, 53, 57, 60, 65, 69], [48, 55, 60, 64, 67, 74]
ROOT = {id(DM): 38, id(BB): 34, id(FF): 41, id(CC): 36}
BARS = [DM, DM, DM, BB, FF, CC, DM, BB, FF, CC, DM, DM]

# Pads: detuned saws through a slowly opening low-pass.
for bi, chord in enumerate(BARS):
    start = bi * BAR
    length = BAR + 1.2 if bi < len(BARS) - 1 else DUR - start
    n = int(length * SR)
    pad = np.zeros(n)
    for m in chord:
        for det in (-0.09, 0.0, 0.11):
            pad += saw(mtof(m + det), n, phase=rng.uniform(0, 6.28)) * (0.55 if m < 50 else 0.4)
    brightness = 900 + 1800 * min(1, bi / 6) + (1400 if 6 <= bi <= 9 else 0)
    pad = lowpass(pad, brightness, 2)
    pad *= env_adsr(n, 0.9 if bi in (0, 3, 6, 10) else 0.25, 0.4, 0.85, 1.2)
    gain = 0.05 if bi < 2 else 0.06
    if bi == 0: pad *= np.linspace(0.3, 1, n) ** 0.5
    place(wet, pad, start, gain, pan=-0.15)
    place(wet, np.roll(pad, 220), start, gain * 0.8, pan=0.25)

# Sub drone through the intro.
drone = np.sin(2 * np.pi * mtof(26) * t_all[: int(7.5 * SR)]) * env_adsr(int(7.5 * SR), 1.0, 0.5, 0.9, 1.5)
place(dry, drone, 0, 0.16)

# High shimmer: filtered noise breathing in the intro and outro.
for s0, s1 in ((0, 7.5), (25, 30)):
    n = int((s1 - s0) * SR)
    sh = highpass(rng.standard_normal(n), 6000) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.4 * np.arange(n) / SR))
    place(wet, sh * env_adsr(n, 1.5, 0.5, 0.8, 1.5), s0, 0.008)

# --- Arpeggio (16ths) from 7.5 s, brighter in the drop ----------------------
pattern = [0, 2, 1, 3, 2, 4, 3, 1]
step = BEAT / 4
for bi in range(3, 10):
    chord = BARS[bi]
    tones = [m + 12 for m in chord[2:]]
    for k in range(16):
        tt = bi * BAR + k * step
        m = tones[pattern[k % 8] % len(tones)]
        n = int(0.35 * SR)
        x = saw(mtof(m), n) * 0.5 + np.sin(2 * np.pi * mtof(m) * np.arange(n) / SR) * 0.6
        open_ = 1800 + 3500 * (bi - 3) / 6 + (2500 if bi >= 6 else 0)
        x = lowpass(x, open_) * np.exp(-np.arange(n) / SR / 0.11)
        g = 0.05 if bi < 6 else 0.065
        if bi == 5: g *= 0.7 + 0.6 * k / 16   # swells into the drop
        pan = 0.35 if k % 2 else -0.35
        place(wet, x, tt, g, pan)
        place(wet, x * 0.45, tt + 3 * step, g, -pan)  # ping-pong echo

# --- Drums: soft pulse 7.5-15 s, full beat 15-25 s ---------------------------
def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 45 + 85 * np.exp(-t / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.18) + 0.15 * highpass(rng.standard_normal(n), 3000) * np.exp(-t / 0.004)

def hat(length=0.05):
    n = int(length * SR)
    return highpass(rng.standard_normal(n), 7500) * np.exp(-np.arange(n) / SR / (length / 4))

K = kick()
for b in range(int(7.5 / BEAT), int(25 / BEAT)):
    tt = b * BEAT
    if tt < 15:
        if b % 2 == 0: place(dry, K, tt, 0.22)
    else:
        place(dry, K, tt, 0.5)
        place(dry, hat(), tt + BEAT / 2, 0.06, 0.3)
        if b % 4 == 3: place(dry, hat(0.12), tt + BEAT * 0.75, 0.035, -0.3)

# Build-up ticks 12.5-15 s (accelerating 8ths -> 16ths -> 32nds).
tt = 12.5
while tt < 15:
    rate = BEAT / 2 if tt < 13.75 else BEAT / 4 if tt < 14.4 else BEAT / 8
    place(wet, hat(0.06), tt, 0.03 + 0.05 * (tt - 12.5) / 2.5, rng.uniform(-0.5, 0.5))
    tt += rate

# Sub bass following the roots in the drop.
for bi in range(6, 10):
    root = ROOT[id(BARS[bi])]
    for k in range(8):
        n = int(BEAT / 2 * SR)
        f = mtof(root)
        x = np.sin(2 * np.pi * f * np.arange(n) / SR) + 0.3 * np.sin(4 * np.pi * f * np.arange(n) / SR)
        x *= env_adsr(n, 0.01, 0.1, 0.7, 0.05)
        place(dry, x, bi * BAR + k * BEAT / 2, 0.16)

# --- FX: risers, impacts, bells ---------------------------------------------
def riser(length):
    n = int(length * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    out = np.zeros(n)
    seg = 2048
    for i in range(0, n, seg):
        fc = 300 + 7000 * (i / n) ** 2
        b, a = signal.butter(2, [fc / (SR / 2), min(0.95, fc * 1.6 / (SR / 2))], "band")
        out[i:i + seg] = signal.lfilter(b, a, x[i:i + seg])
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * (t / length) ** 2) / SR) * 0.25
    return (out + tone) * (t / length) ** 2

def impact():
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.9)
    crash = lowpass(rng.standard_normal(n), 4000) * np.exp(-t / 0.5) * 0.25
    return boom + crash

def bell(m, length=3.0):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in ((1, 1, 1.4), (2.76, 0.4, 0.6), (5.4, 0.2, 0.3), (8.93, 0.1, 0.15)))

place(wet, riser(2.5), 5.0, 0.09)            # the dive into the plume
place(dry, impact(), 7.5, 0.35)
place(wet, riser(2.5), 12.5, 0.11)           # build into the drop
place(dry, impact(), 15.0, 0.5)
place(wet, bell(81), 22.5, 0.07, 0.2)        # 6,7 µN reveal
place(wet, bell(86), 22.5 + BEAT, 0.05, -0.2)
place(dry, impact(), 25.0, 0.35)             # into space
place(wet, bell(74), 27.5, 0.08)             # title card
place(wet, bell(81), 27.5 + BEAT / 2, 0.05, 0.3)
place(wet, bell(86), 27.5 + BEAT, 0.04, -0.3)

# --- Mix ---------------------------------------------------------------------
mix = dry + wet * 0.75 + reverb(wet) * 0.55
mix = highpass(mix, 28)
mix = np.tanh(mix * 1.6) / np.tanh(1.6)
fade_in, fade_out = int(0.25 * SR), int(0.8 * SR)
mix[:, :fade_in] *= np.linspace(0, 1, fade_in)
mix[:, -fade_out:] *= np.linspace(1, 0, fade_out) ** 1.5
mix *= 0.89 / np.abs(mix).max()
wavfile.write("music.wav", SR, (mix.T * 32767).astype(np.int16))
print("music.wav", DUR, "s")
