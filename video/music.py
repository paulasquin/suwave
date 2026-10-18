"""Synthesize a 30 s calm, luminous track for the SUWAVE teaser (D major, 96 BPM, one bar = 2.5 s):
golden-hour pads, a kalimba-like arpeggio, wind and water textures, a soft beat from 12.5 s,
a bell melody over the drift map, a splash when the wing lands (8.9 s) and servo ticks under
the anchor shot. Everything is generated here, so there is no licensing question. The
structure follows the shot grid of capture.py; move the placements below to re-time accents.

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


dry = np.zeros((2, N))   # beat, bass
wet = np.zeros((2, N))   # pads, plucks, bells, textures (sent to the reverb)

# --- Chords: one per bar (Dmaj9, Bm9, Gmaj7#11, Asus/A6) ------------------------
D9, BM, G7, AS = [50, 57, 61, 64, 66, 69], [47, 54, 57, 61, 62, 66], [43, 50, 54, 57, 61, 64], [45, 52, 57, 59, 62, 66]
ROOT = {id(D9): 38, id(BM): 35, id(G7): 31, id(AS): 33}
BARS = [D9, D9, BM, G7, D9, AS, BM, G7, D9, AS, G7, D9]

def soft_saw(freq, n):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, 9):
        out += np.sin(2 * np.pi * k * freq * t) / (k ** 1.6)
    return out * 0.5

# Pads: warm, slowly breathing, brighter in the middle.
for bi, chord in enumerate(BARS):
    start = bi * BAR
    length = BAR + 1.5 if bi < len(BARS) - 1 else DUR - start
    n = int(length * SR)
    pad = np.zeros(n)
    for m in chord:
        for det in (-0.07, 0.0, 0.08):
            pad += soft_saw(mtof(m + det), n) * (0.5 if m < 50 else 0.38)
    bright = 700 + 1500 * min(1, bi / 5) + (900 if 7 <= bi <= 9 else 0)
    pad = lowpass(pad, bright, 2)
    pad *= env_adsr(n, 1.2 if bi in (0, 2, 5, 8) else 0.5, 0.5, 0.85, 1.5)
    pad *= 1 + 0.12 * np.sin(2 * np.pi * 0.2 * np.arange(n) / SR)
    gain = 0.055 if bi < 2 else 0.065
    if bi == 0: pad *= np.linspace(0.2, 1, n) ** 0.6
    place(wet, pad, start, gain, pan=-0.2)
    place(wet, np.roll(pad, 300), start, gain * 0.8, pan=0.25)

# Wind: band-passed noise swells; water: soft lapping (low noise, slow modulation).
def band(x, lo, hi):
    b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x)
nw = N
wind = band(rng.standard_normal(nw), 300, 1400)
wmod = 0.35 + 0.65 * (0.5 + 0.5 * np.sin(2 * np.pi * t_all / 7.0 + 1.0)) ** 2
wind *= wmod * np.clip(1 - np.abs(t_all - 6) / 9, 0.15, 1)
place(wet, wind, 0, 0.009, -0.3)
lap = lowpass(rng.standard_normal(nw), 420, 4) * (0.5 + 0.5 * np.sin(2 * np.pi * t_all * 0.6) ** 6)
place(dry, lap, 0, 0.05, 0.2)
# Sparkle: high shimmer at the start and the end (sun glints).
for s0, s1 in ((0, 10), (24, 30)):
    n = int((s1 - s0) * SR)
    sh = highpass(rng.standard_normal(n), 7000) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.5 * np.arange(n) / SR))
    place(wet, sh * env_adsr(n, 2.0, 0.5, 0.8, 2.0), s0, 0.0015)

# --- Kalimba-like arpeggio (8ths, 16ths from 15 s) ------------------------------
def pluck(m, length=0.9):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.35) + 0.35 * np.sin(2 * np.pi * f * 3.0 * t) * np.exp(-t / 0.06)
    x += 0.12 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.03)
    return x * (1 - np.exp(-t / 0.002))
pattern = [0, 2, 4, 1, 3, 5, 2, 4]
for bi in range(2, 12):
    chord = BARS[bi]
    tones = [m + 12 for m in chord[1:]]
    sub = 4 if 6 <= bi <= 9 else 2
    steps = 4 * sub
    for k in range(steps):
        if bi == 11 and k > steps // 2: break
        tt = bi * BAR + k * BEAT / sub
        m = tones[pattern[k % 8] % len(tones)]
        g = 0.07 if sub == 2 else 0.055
        if bi == 2: g *= 0.4 + 0.6 * k / steps
        pan = 0.4 if k % 2 else -0.4
        place(wet, pluck(m), tt, g, pan)
        place(wet, pluck(m) * 0.35, tt + 3 * BEAT / sub, g, -pan)

# --- Soft beat 12.5-25 s ---------------------------------------------------------
def kick():
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    f = 48 + 60 * np.exp(-t / 0.05)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
def shaker(length=0.07):
    n = int(length * SR)
    return band(rng.standard_normal(n), 5000, 11000) * np.sin(np.pi * np.arange(n) / n) ** 2
def rim():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 1700 * t) * 0.6 + band(rng.standard_normal(n), 1500, 4000)) * np.exp(-t / 0.018)
K = kick()
for b in range(int(12.5 / BEAT), int(25 / BEAT)):
    tt = b * BEAT
    full = tt >= 15
    if b % 2 == 0 or full: place(dry, K, tt, 0.32 if full else 0.2)
    place(dry, shaker(), tt + BEAT / 2, 0.05 if full else 0.03, 0.3)
    if full: place(dry, shaker(0.04), tt + BEAT / 4, 0.02, -0.3); place(dry, shaker(0.04), tt + 3 * BEAT / 4, 0.02, -0.3)
    if full and b % 4 == 2: place(dry, rim(), tt, 0.06, -0.15)

# Round bass under the beat.
for bi in range(5, 10):
    root = ROOT[id(BARS[bi])]
    for k, (off, ln) in enumerate(((0, 1.5), (1.5, 0.5), (2, 1.5), (3.5, 0.5))):
        n = int(ln * BEAT * SR)
        f = mtof(root + (12 if k == 3 else 0))
        x = np.sin(2 * np.pi * f * np.arange(n) / SR) + 0.2 * np.sin(4 * np.pi * f * np.arange(n) / SR)
        x *= env_adsr(n, 0.01, 0.15, 0.6, 0.06)
        place(dry, x, bi * BAR + off * BEAT, 0.15)

# --- Bell melody over the drift map (17.5-25 s) ---------------------------------
def bell(m, length=2.6):
    n = int(length * SR)
    t = np.arange(n) / SR
    f = mtof(m)
    return sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in ((1, 1, 1.5), (2.0, 0.25, 0.9), (2.76, 0.3, 0.5), (5.4, 0.12, 0.25)))
melody = [(17.5, 78), (18.75, 81), (19.375, 78), (20.0, 76), (21.25, 74), (22.5, 78), (23.125, 81), (23.75, 83), (24.375, 85)]
for tt, m in melody:
    place(wet, bell(m), tt, 0.06, 0.15 * np.sin(tt))

# --- FX --------------------------------------------------------------------------
def swell(length):
    n = int(length * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    noise = rng.standard_normal(n)
    seg = 2048
    for i in range(0, n, seg):
        fc = 400 + 5000 * (i / n) ** 2
        b, a = signal.butter(2, [fc / (SR / 2), min(0.95, fc * 1.5 / (SR / 2))], "band")
        x[i:i + seg] = signal.lfilter(b, a, noise[i:i + seg])
    return x * (t / length) ** 2.2
def splash():
    n = int(1.8 * SR)
    t = np.arange(n) / SR
    burst = band(rng.standard_normal(n), 400, 6000) * np.exp(-t / 0.18)
    bloop = np.sin(2 * np.pi * np.cumsum(220 + 500 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.12) * 0.5
    drops = sum(np.sin(2 * np.pi * (900 + 400 * k) * np.clip(t - 0.15 * k, 0, None)) * np.exp(-np.clip(t - 0.15 * k, 0, None) / 0.03) * (t > 0.15 * k) * 0.15 for k in range(1, 5))
    return burst + bloop + drops
def tick():
    n = int(0.03 * SR)
    return band(rng.standard_normal(n), 2000, 7000) * np.exp(-np.arange(n) / SR / 0.004)

place(wet, swell(1.8), 7.1, 0.06)          # the approach
place(dry, splash(), 9.0, 0.22)            # touchdown
place(wet, swell(2.5), 15.0, 0.05)         # into the drift map
place(wet, bell(74, 4.0), 17.5, 0.05, -0.2)
place(dry, splash() * 0.5, 23.0, 0.14)     # landing at the chosen point
tt = 25.0
while tt < 27.3:                           # servo + worm screw of the anchor
    place(dry, tick(), tt, 0.05, 0.3)
    tt += 0.085
for i, m in enumerate((74, 78, 81, 86)):   # end card
    place(wet, bell(m, 3.5), 27.5 + i * BEAT / 3, 0.06 - i * 0.008, (-0.3, 0.3)[i % 2])

# --- Mix -----------------------------------------------------------------------
mix = dry + wet * 0.7 + reverb(wet, seconds=3.8, decay=1.4, tone=4500) * 0.6
mix = highpass(mix, 30)
mix = mix / np.abs(mix).max()
mix = np.tanh(mix * 2.2) / np.tanh(2.2)
fade_in, fade_out = int(0.4 * SR), int(1.2 * SR)
mix[:, :fade_in] *= np.linspace(0, 1, fade_in)
mix[:, -fade_out:] *= np.linspace(1, 0, fade_out) ** 1.5
mix *= 0.89 / np.abs(mix).max()
wavfile.write("music.wav", SR, (mix.T * 32767).astype(np.int16))
print("music.wav", DUR, "s")
