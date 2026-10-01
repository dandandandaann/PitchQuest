#!/usr/bin/env python3
"""Measure the sounding (concert) pitch of a monophonic WAV -- pure stdlib.

WHY THIS EXISTS
---------------
`make_sound_samples.py` renders brass samples with MuseScore and must name each
output file after its *measured* sounding MIDI pitch -- not the pitch that was
requested in the MusicXML.  Two things make the requested pitch unreliable:

  1. MuseScore's MusicXML importer may map a part to its own transposing
     instrument ("Trumpet in C" -> "Trumpet in Bb"), shifting every note.
  2. A naive peak-pick (or a naive autocorrelator) on a bright brass tone can
     lock onto the 2nd/3rd harmonic and report, say, 65.9 Hz for a 329.6 Hz
     note -- and, for the low trombone notes here, the fundamental is *weaker
     than its own 3rd/5th harmonics*, so the strongest spectral peak is not
     the pitch at all.

So we render, then measure the actual waveform, then name the files after what
we measured.  This module is the measuring stick.

METHOD (why it is not the naive one)
------------------------------------
* The frame is taken from the steady sustain (default 0.20 s .. 0.75 s after
  the onset).  MuseScore's brass playback has a short attack scoop, so a frame
  starting right at the onset reads ~10 cents flat on the low trombone notes.
* **Octave**: a hand-written iterative radix-2 FFT drives a YIN-style
  cumulative-mean-normalised difference function.  YIN picks the *period*, so
  it is immune to the weak-fundamental trap.  (This is the octave guard --
  a top-5-spectral-peak heuristic was tried and failed: for trombone MIDI 40
  the fundamental is not even among the ten strongest peaks.)
* **Precision**: the magnitude spectrum of a longer, zero-padded frame is
  peak-picked with parabolic interpolation on log-magnitude.  Every peak is
  divided by the harmonic number implied by the YIN octave; the candidates are
  averaged weighted by peak magnitude.  This gives sub-cent agreement with the
  integer MIDI grid (max ~2 cents across the shipped set).

Pure stdlib only: wave, struct, math, cmath (the numpy on this host is a broken
stub with no `__version__`, so it is unusable).  Importable and CLI-runnable.

CLI:
    python3 measure_pitch.py <mono-44k.wav> <onset_sec> [<onset_sec> ...]
prints one line per onset: onset, Hz, MIDI float, nearest MIDI, cents error.
"""
import cmath
import math
import struct
import sys
import wave

# ---------------------------------------------------------------- constants
YIN_FRAME = 16384      # samples used for the octave (period) estimate
YIN_THRESHOLD = 0.12   # CMND threshold; first dip below this wins
FMIN = 40.0            # candidate / search range (Hz)
FMAX = 2500.0
N_HARMONICS = 12       # highest partial number considered when snapping to f0
SNAP_CENTS = 50.0      # a spectral peak counts as a partial if within this

DEFAULT_OFFSET = 0.20  # seconds after the onset where the analysis frame starts
DEFAULT_DUR = 0.55     # analysis frame length in seconds


# ---------------------------------------------------------------- wav input
def read_wav_mono(path):
    """Return (sample_rate, [float samples in -1..1]) from a PCM WAV.

    Accepts 16-bit and 32-bit integer PCM and 32-bit float PCM.  Callers should
    pre-convert to mono 44.1 kHz with ffmpeg; this reader does not resample.
    """
    with wave.open(path, "rb") as w:
        nchan = w.getnchannels()
        width = w.getsampwidth()
        sr = w.getframerate()
        raw = w.readframes(w.getnframes())
    if width == 2:
        ints = struct.unpack("<%dh" % (len(raw) // 2), raw)
        scale = 1.0 / 32768.0
    elif width == 4:
        # Could be int32 or float32; ffmpeg's pcm_f32le is by far the common
        # case here, so try float first and fall back to int.
        try:
            vals = struct.unpack("<%df" % (len(raw) // 4), raw)
            if any(math.isnan(v) or abs(v) > 1e30 for v in vals):
                raise ValueError
            if max(abs(v) for v in vals) > 2.0:  # implausible as float
                raise ValueError
            ints, scale = vals, 1.0
        except (struct.error, ValueError):
            ints = struct.unpack("<%di" % (len(raw) // 4), raw)
            scale = 1.0 / 2147483648.0
    else:
        raise ValueError("unsupported sample width %d" % width)
    if nchan == 1:
        return sr, [v * scale for v in ints]
    per = len(ints) // nchan
    out = [0.0] * per
    for c in range(nchan):
        base = c * per
        for i in range(per):
            out[i] += ints[base + i] * scale
    inv = 1.0 / nchan
    return sr, [v * inv for v in out]


# ---------------------------------------------------------------------- FFT
def _twiddles(n):
    return [cmath.exp(-2j * math.pi * k / n) for k in range(n // 2)]


def fft(a, tw):
    """In-place iterative radix-2 Cooley-Tukey FFT.  len(a) must be 2**k.

    `tw` is the twiddle table from `_twiddles(len(a))`.
    """
    n = len(a)
    j = 0
    for i in range(1, n):
        bit = n >> 1
        while j & bit:
            j ^= bit
            bit >>= 1
        j |= bit
        if i < j:
            a[i], a[j] = a[j], a[i]
    length = 2
    while length <= n:
        half = length >> 1
        step = n // length
        for start in range(0, n, length):
            k = 0
            for p in range(start, start + half):
                u = a[p]
                v = a[p + half] * tw[k]
                a[p] = u + v
                a[p + half] = u - v
                k += step
        length <<= 1


def _hann(n):
    return [0.5 - 0.5 * math.cos(2.0 * math.pi * i / n) for i in range(n)]


# ----------------------------------------------------------- period estimate
def yin_f0(samples, sr, start_sec, frame=YIN_FRAME, threshold=YIN_THRESHOLD):
    """YIN-style f0 (Hz) via an FFT-computed difference function.

    The difference function d(tau) = 2*(r(0) - r(tau)) is obtained from the
    power spectrum, so this is O(n log n) rather than O(n * maxlag).  The
    cumulative-mean normalisation (CMND) is what suppresses the octave-too-low
    error that a plain autocorrelation peak-pick suffers from.
    """
    start = int(round(start_sec * sr))
    frame = min(frame, len(samples))
    if start + frame > len(samples):
        start = max(0, len(samples) - frame)
    fr = samples[start:start + frame]
    win = _hann(len(fr))
    buf = [complex(fr[i] * win[i], 0.0) for i in range(len(fr))]
    n = len(buf)
    fft(buf, _twiddles(n))
    power = [c.real * c.real + c.imag * c.imag for c in buf]
    cc = [complex(v, 0.0) for v in power]
    fft(cc, _twiddles(n))                      # IFFT via real-even spectrum
    r = [cc[i].real / n for i in range(n)]     # autocorrelation r[tau]
    d = [2.0 * (r[0] - r[t]) for t in range(n)]
    dp = [1.0] * n
    run = 0.0
    for t in range(1, n):
        run += d[t]
        dp[t] = d[t] / (run / t) if run > 0.0 else 1e20
    lo = max(2, int(sr / FMAX))
    hi = min(n - 1, int(sr / FMIN))
    tau = -1
    for t in range(lo, hi):
        if dp[t] < threshold:
            while t + 1 < hi and dp[t + 1] < dp[t]:
                t += 1
            tau = t
            break
    if tau < 0:
        tau = min(range(lo, hi), key=lambda t: dp[t])
    y0, y1, y2 = dp[tau - 1], dp[tau], dp[tau + 1]
    den = y0 - 2.0 * y1 + y2
    delta = 0.5 * (y0 - y2) / den if den != 0.0 else 0.0
    return sr / (tau + delta)


# --------------------------------------------------------- spectral peaks
def spectral_peaks(samples, sr, start_sec, dur_sec):
    """Return [(freq_hz, magnitude)] for local maxima in FMIN..FMAX, desc."""
    need = int(dur_sec * sr)
    n = 1
    while n < need:
        n <<= 1
    start = int(round(start_sec * sr))
    fr = samples[start:start + need]
    win = _hann(len(fr))
    buf = [complex((fr[i] * win[i]) if i < len(fr) else 0.0, 0.0)
           for i in range(n)]
    fft(buf, _twiddles(n))
    half = n // 2
    fpb = sr / float(n)
    mags = [abs(buf[i]) for i in range(half)]
    lo = max(2, int(FMIN / fpb))
    hi = min(half - 2, int(FMAX / fpb))
    out = []
    for b in range(lo, hi + 1):
        if mags[b] > mags[b - 1] and mags[b] >= mags[b + 1]:
            y0 = math.log(mags[b - 1] + 1e-30)
            y1 = math.log(mags[b] + 1e-30)
            y2 = math.log(mags[b + 1] + 1e-30)
            den = y0 - 2.0 * y1 + y2
            delta = 0.5 * (y0 - y2) / den if den != 0.0 else 0.0
            if delta < -0.5 or delta > 0.5:
                delta = 0.0
            out.append(((b + delta) * fpb, mags[b]))
    out.sort(key=lambda x: -x[1])
    return out


# ------------------------------------------------------------- pitch estimate
def hz_to_midi(f):
    return 69.0 + 12.0 * math.log(f / 440.0, 2)


def midi_to_hz(m):
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))


def cents(f, ref_hz):
    return 1200.0 * math.log(f / ref_hz, 2)


def measure(samples, sr, onset, offset_sec=DEFAULT_OFFSET, dur_sec=DEFAULT_DUR):
    """Estimate the sounding frequency (Hz) of the note starting at `onset`.

    Returns (freq_hz, coarse_f0_hz).  `coarse_f0_hz` is the raw YIN period
    estimate -- useful diagnostics, it is *not* the reported pitch.
    """
    coarse = yin_f0(samples, sr, onset + offset_sec)
    coarse_midi = hz_to_midi(coarse)
    peaks = spectral_peaks(samples, sr, onset + offset_sec, dur_sec)
    total_w = 0.0
    total_f = 0.0
    for f, m in peaks[:25]:
        k = int(round(f / midi_to_hz(coarse_midi)))
        if not 1 <= k <= N_HARMONICS:
            continue
        ref = f / k
        if abs(hz_to_midi(ref) - coarse_midi) <= SNAP_CENTS / 100.0:
            total_f += ref * m
            total_w += m
    if total_w == 0.0:
        return coarse, coarse
    return total_f / total_w, coarse


def measure_onsets(path, onsets, offset_sec=DEFAULT_OFFSET, dur_sec=DEFAULT_DUR):
    """Measure each onset (seconds) of the WAV at `path`.

    Returns a list of dicts: onset, hz, coarseHz, midi, midiRound, centsError.
    """
    sr, samples = read_wav_mono(path)
    out = []
    for t in onsets:
        f, coarse = measure(samples, sr, t, offset_sec, dur_sec)
        m = hz_to_midi(f)
        out.append({
            "onset": t,
            "hz": f,
            "coarseHz": coarse,
            "midi": m,
            "midiRound": int(round(m)),
            "centsError": cents(f, midi_to_hz(round(m))),
        })
    return out


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2
    path = argv[1]
    onsets = [float(x) for x in argv[2:]]
    for r in measure_onsets(path, onsets):
        print("onset %7.4f s  %9.3f Hz  midi %8.4f  -> %3d  (%+6.2f cents)"
              % (r["onset"], r["hz"], r["midi"], r["midiRound"], r["centsError"]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
