"""Synthesize the 60 s soundtrack of the SUWAVE film (D minor, 120 BPM, one bar = 2 s), in the
style of the ion thruster film: detuned saw pads, a 16th-note arpeggio with ping-pong echo, a sub
drone, risers into soft impacts and bells. No sound effects: the touchdowns and the take-off are
marked by the music alone. Everything is generated here, so there is no licensing question.
Sections follow the film's scenes (SC below), each with its own bar grid.

    uv run --with numpy --with scipy python music.py   # -> music.wav
"""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
DUR = 60.0
N = int(SR * DUR)
BEAT = 0.5
BAR = 4 * BEAT
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR

# Scene starts in the film, and the moments the music marks.
SC = dict(lac=0, aile=5, soleil=11, vent=16, mesure=21, cinq=27, prevision=32, zone=39, pose=45, repart=51, fin=55)
TOUCH = SC['aile'] + 4.24
FIVE = SC['cinq'] + 2.6
VEC = (SC['prevision'] + 3.5, SC['prevision'] + 5.1)
PICK = SC['zone'] + 4.9
LAND = SC['pose'] + 1.1


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


def reverb(x, seconds=3.6, decay=1.3, tone=5000):
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

DM, BB, FF, CC, GM, AA = [50, 57, 62, 65, 69, 76], [46, 53, 58, 62, 65, 72], [41, 53, 57, 60, 65, 69], [48, 55, 60, 64, 67, 74], [43, 55, 58, 62, 67, 70], [45, 52, 57, 61, 64, 69]
DMAJ = [50, 57, 62, 66, 69, 78]
ROOT = {id(DM): 38, id(BB): 34, id(FF): 41, id(CC): 36, id(GM): 43, id(AA): 33, id(DMAJ): 38}
DROP = [DM, BB, FF, CC] * 2 + [DM, BB, GM, AA]
# (start, length, chord, brightness): the chord plan, scene by scene.
PLAN = [(0, 5, DM, 700), (5, 4.24, BB, 900), (TOUCH, 3.76, FF, 1100), (13, 4, DM, 1300), (17, 4, CC, 1600)]
PLAN += [(SC['mesure'] + 2 * i, 2, c, 2600 + 900 * (i >= 4)) for i, c in enumerate(DROP)]
PLAN += [(45, 2, BB, 1500), (47, 2, FF, 1500), (49, 2, AA, 1900), (51, 2, DM, 3800), (53, 2, CC, 3800), (55, 5, DMAJ, 2600)]

for k, (start, length, chord, brightness) in enumerate(PLAN):
    tail = 1.2 if k < len(PLAN) - 1 else 0
    n = int((length + tail) * SR)
    pad = np.zeros(n)
    for m in chord:
        for det in (-0.09, 0.0, 0.11):
            pad += saw(mtof(m + det), n, phase=rng.uniform(0, 6.28)) * (0.55 if m < 50 else 0.4)
    pad = lowpass(pad, brightness, 2)
    pad *= env_adsr(n, 1.2 if k in (0, 1, 3) else 0.2, 0.4, 0.85, 1.2 if tail else length * 0.7)
    gain = 0.05 if start < 13 else 0.06
    if k == 0: pad *= np.linspace(0.25, 1, n) ** 0.5
    place(wet, pad, start, gain, pan=-0.15)
    place(wet, np.roll(pad, 220), start, gain * 0.8, pan=0.25)

# Sub drone under the lake and the flight; again under the landing.
for s0, s1 in ((0, 13), (45, 51)):
    n = int((s1 - s0) * SR)
    drone = np.sin(2 * np.pi * mtof(26) * np.arange(n) / SR) * env_adsr(n, 1.2, 0.5, 0.9, 1.5)
    place(dry, drone, s0, 0.15)

# High shimmer: filtered noise breathing over the lake and the end card.
for s0, s1 in ((0, 11), (55, 60)):
    n = int((s1 - s0) * SR)
    sh = highpass(rng.standard_normal(n), 6000) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.4 * np.arange(n) / SR))
    place(wet, sh * env_adsr(n, 1.5, 0.5, 0.8, 1.5), s0, 0.008)

# --- Arpeggio (16ths): enters with the charge, opens through the build, full in the drop ------
pattern = [0, 2, 1, 3, 2, 4, 3, 1]
step = BEAT / 4
for start, length, chord, _ in PLAN:
    if start < 13 or start >= 55: continue
    tones = [m + 12 for m in chord[2:]]
    for k in range(int(round(length / step))):
        tt = start + k * step
        m = tones[pattern[k % 8] % len(tones)]
        n = int(0.35 * SR)
        x = saw(mtof(m), n) * 0.5 + np.sin(2 * np.pi * mtof(m) * np.arange(n) / SR) * 0.6
        if tt < SC['mesure']: open_, g = 1500 + 2500 * (tt - 13) / 8, 0.04 + 0.015 * (tt - 13) / 8
        elif tt < SC['pose']: open_, g = 5200 + (1500 if tt >= SC['prevision'] else 0), 0.062
        elif tt < SC['repart']: open_, g = 2200, 0.045
        else: open_, g = 7500, 0.07
        x = lowpass(x, open_) * np.exp(-np.arange(n) / SR / 0.11)
        pan = 0.35 if k % 2 else -0.35
        place(wet, x, tt, g, pan)
        place(wet, x * 0.45, tt + 3 * step, g, -pan)  # ping-pong echo

# --- Drums: half-time pulse from the wind, full beat in the drop and the take-off ------------
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
for b in range(int(SC['vent'] / BEAT), int(SC['fin'] / BEAT)):
    tt = b * BEAT
    if tt < SC['mesure']:
        if b % 4 == 0: place(dry, K, tt, 0.2)
    elif tt < SC['zone'] or tt >= SC['repart']:
        place(dry, K, tt, 0.48 if tt >= SC['repart'] else 0.42)
        place(dry, hat(), tt + BEAT / 2, 0.06, 0.3)
        if b % 4 == 3: place(dry, hat(0.12), tt + BEAT * 0.75, 0.035, -0.3)
    elif tt < SC['pose']:                       # the program scans: lighter, ticking hats
        if b % 2 == 0: place(dry, K, tt, 0.3)
        place(dry, hat(0.03), tt + BEAT / 4, 0.03, -0.4)
        place(dry, hat(), tt + BEAT / 2, 0.05, 0.3)
        place(dry, hat(0.03), tt + 3 * BEAT / 4, 0.03, 0.4)

# Build ticks into the drop and into the take-off (accelerating 8ths -> 16ths -> 32nds).
for s0, s1 in ((SC['mesure'] - 2.5, SC['mesure']), (SC['repart'] - 2.0, SC['repart'])):
    tt = s0
    while tt < s1:
        left = s1 - tt
        rate = BEAT / 2 if left > 1.2 else BEAT / 4 if left > 0.5 else BEAT / 8
        place(wet, hat(0.06), tt, 0.03 + 0.05 * (1 - left / (s1 - s0)), rng.uniform(-0.5, 0.5))
        tt += rate

# Sub bass following the roots in the drop and the take-off.
for start, length, chord, _ in PLAN:
    if not (SC['mesure'] <= start < SC['fin']) or SC['pose'] <= start < SC['repart']: continue
    root = ROOT[id(chord)]
    for k in range(int(length / (BEAT / 2))):
        n = int(BEAT / 2 * SR)
        f = mtof(root)
        x = np.sin(2 * np.pi * f * np.arange(n) / SR) + 0.3 * np.sin(4 * np.pi * f * np.arange(n) / SR)
        x *= env_adsr(n, 0.01, 0.1, 0.7, 0.05)
        place(dry, x, start + k * BEAT / 2, 0.15)
for start, length, chord, _ in PLAN:                # long notes under the landing
    if SC['pose'] <= start < SC['repart']:
        n = int(length * SR)
        x = np.sin(2 * np.pi * mtof(ROOT[id(chord)]) * np.arange(n) / SR) * env_adsr(n, 0.3, 0.3, 0.8, 0.6)
        place(dry, x, start, 0.12)

# --- FX: risers, impacts, bells -----------------------------------------------------------
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

place(wet, bell(74), 0.6, 0.07)                    # title
place(wet, bell(81), 0.6 + BEAT, 0.05, 0.3)
place(wet, riser(2.2), TOUCH - 2.2, 0.06)          # the flare
place(dry, impact(), TOUCH, 0.18)                  # touchdown, felt rather than heard
place(wet, bell(77), TOUCH, 0.05, -0.2)
place(wet, riser(2.5), SC['mesure'] - 2.5, 0.11)   # build into the drop
place(dry, impact(), SC['mesure'], 0.45)
place(wet, bell(81), FIVE, 0.07, 0.2)              # 5 %
place(wet, bell(86), FIVE + BEAT, 0.05, -0.2)
place(wet, bell(77), VEC[0], 0.045, -0.3)          # the drift vectors land
place(wet, bell(81), VEC[1], 0.045, 0.3)
place(wet, bell(86), PICK, 0.06, 0.2)              # the zone is picked
place(wet, bell(74), LAND, 0.05)                   # the computed landing
place(wet, riser(2.0), SC['repart'] - 2.0, 0.12)   # build into the take-off
place(dry, impact(), SC['repart'], 0.5)
place(dry, impact(), SC['fin'], 0.3)               # end card
for i, m in enumerate((74, 78, 81, 86)):
    place(wet, bell(m), SC['fin'] + 0.3 + i * BEAT / 2, 0.075 - 0.01 * i, (-0.3, 0.3)[i % 2])

# --- Mix -------------------------------------------------------------------------------------
mix = dry + wet * 0.75 + reverb(wet) * 0.55
mix = highpass(mix, 28)
mix = np.tanh(mix * 1.6) / np.tanh(1.6)
fade_in, fade_out = int(0.25 * SR), int(1.6 * SR)
mix[:, :fade_in] *= np.linspace(0, 1, fade_in)
mix[:, -fade_out:] *= np.linspace(1, 0, fade_out) ** 1.5
mix *= 0.89 / np.abs(mix).max()
wavfile.write("music.wav", SR, (mix.T * 32767).astype(np.int16))
print("music.wav", DUR, "s")
