#!/usr/bin/env python3
"""Generate the 14 General-MIDI brass samples for PitchQuest.

Run from anywhere:  python3 web/scripts/make_sound_samples.py [--only <instrument>]

Output
------
    web/public/sounds/
    |- CREDITS.md                 MIT attribution for the soundfont
    |- manifest.json              provenance + per-sample measured pitch
    |- trumpet/trumpet-{052..084}.mp3      (8 files)
    |- trombone/trombone-{040..065}.mp3    (6 files)

WHY THIS EXISTS
---------------
The practice mode needs short, reference brass tones it can pitch-shift by up
to +/-100 cents, so each sample must sit on an exact sounding MIDI pitch.  There
is no fluidsynth CLI, sox or timidity on this host, and numpy is a broken stub;
what we do have is the MuseScore 4 CLI plus its bundled MIT-licensed
"MS Basic.sf3" soundfont.  This script renders one non-transposing part per
instrument with MuseScore, measures the real sounding pitch of every note with
`measure_pitch.py`, and names the files after the *measured* pitch -- never the
requested one.  MuseScore's importer can silently map a part onto its own
transposing instrument, so "measure, then name" is the load-bearing rule.

MuseScore also ignores `<midi-program>` when importing and picks the soundfont
preset from the part name, silently falling back to its default piano patch for
an unrecognised name -- hence the recognised part name AND the explicit
`<instrument-sound>` pin, plus a sustain gate that fails the render if it still
decays like a piano.

PITCH SETS (sounding / concert MIDI)
------------------------------------
    trumpet  : 52 57 61 66 70 75 79 84
    trombone : 40 45 50 55 60 65
Chosen so the max browser pitch-shift across each instrument's whole drill
range is exactly 200 cents.

PIPELINE
--------
  1. author MusicXML into .tmp/sounds/ (no <transpose>, GM program pinned)
  2. render with `mscore -o raw/<inst>.wav`
  3. gate the render (duration / loudness / 8 or 6 onsets ~4 s apart)
  4. gate the sustain (tail/head RMS + dB/s slope -- catches a piano fallback)
  5. measure each note's real pitch (measure_pitch.py)
  6. if every note is offset by the same constant, re-render shifted (<=2x)
  7. slice 0.80 s from each measured onset, peak-normalise to -3.0 dBFS,
     encode mono 44.1 kHz MP3 @ 96 kbps CBR
  8. re-measure the final MP3s, write manifest.json + CREDITS.md

The script is idempotent: it recreates its scratch tree and output tree on every
run, and the render/measure/encode chain is deterministic.
"""
import datetime
import json
import math
import os
import re
import subprocess
import sys

# Importing measure_pitch must not drop a __pycache__/ into the repo.
sys.dont_write_bytecode = True

HERE = os.path.dirname(os.path.abspath(__file__))          # web/scripts
ROOT = os.path.dirname(os.path.dirname(HERE))              # repo root
OUT_DIR = os.path.join(HERE, "..", "public", "sounds")     # web/public/sounds
WORK = os.path.join(ROOT, ".tmp", "sounds")                # scratch
RAW_DIR = os.path.join(WORK, "raw")

sys.path.insert(0, HERE)
import measure_pitch  # noqa: E402  (lives next to this script)

# ---------------------------------------------------------------- constants
SOUNDFONT = "/usr/share/mscore-4.7/sound/MS Basic.sf3"
MSCORE = "mscore"
SLICE_SEC = 0.80
PEAK_DBFS = -3.0
MP3_KBPS = 96
SAMPLE_RATE = 44100
ONSET_DB = -45          # silencedetect threshold
ONSET_MIN_SIL = 1.5     # silencedetect minimum silence length
MEASURE_OFFSET = 0.20   # analysis frame start, seconds after the onset
MEASURE_DUR = 0.55      # analysis frame length, seconds (fits inside the slice)
SUSTAIN_WINDOWS = 16           # 16 x 50 ms over the 0.80 s slice
SUSTAIN_MIN_TAIL_HEAD = 0.65   # measured: brass 0.71..1.28 vs piano 0.10..0.58
SUSTAIN_MIN_SLOPE_DB_S = -6.0  # measured: brass -5.4..+1.5 vs piano -43.6..-6.9
MIDI_STEP = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"]
MIDI_ALTER = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0]

INSTRUMENTS = [
    {
        "name": "trumpet",
        # MuseScore 4.7 ignores <midi-program> on import (program 57 and 1
        # render byte-identically) and picks the soundfont preset from
        # <part-name>; an unrecognised name ("Trumpet in C") silently falls
        # back to the default piano patch.  So use the recognised "Trumpet"
        # and pin the preset with <instrument-sound> as well.
        "partName": "Trumpet",
        "program": 57,            # GM 1-based (56 zero-based); provenance only
        "sound": "brass.trumpet",
        "clef": ("G", 2),
        "transposeSemitones": -2,  # written pitch is a M2 above sounding
        "pitches": [52, 57, 61, 66, 70, 75, 79, 84],
    },
    {
        "name": "trombone",
        "partName": "Trombone",
        "program": 58,            # GM 1-based (57 zero-based)
        "sound": "brass.trombone",
        "clef": ("F", 4),
        "transposeSemitones": 0,
        "pitches": [40, 45, 50, 55, 60, 65],
    },
]


# ------------------------------------------------------------------- helpers
def run(cmd, **kw):
    """Run a command, returning CompletedProcess with text output captured."""
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def midi_parts(m):
    """(step, alter, octave) for an absolute MIDI note number.

    `<step>` must be a bare letter A-G; accidentals go in `<alter>`.  Emitting
    e.g. `<step>C#</step>` makes MuseScore silently drop the note.
    """
    return MIDI_STEP[m % 12], MIDI_ALTER[m % 12], m // 12 - 1


def write_musicxml(path, inst, shift=0):
    """Author one non-transposing part, one pitch per 4/4 measure.

    Each measure is a quarter note (<duration>1</duration>) plus a dotted-half
    rest (<duration>3</duration>) at <sound tempo="60"/>, i.e. 1.0 s of sound
    with measure boundaries at 0/4/8... seconds.  `<ff/>` keeps the render loud
    enough to clear the loudness gate without clipping.
    """
    sign, line = inst["clef"]
    L = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 '
         'Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
         '<score-partwise version="4.0">',
         '  <part-list>',
         '    <score-part id="P1">',
         '      <part-name>%s</part-name>' % inst["partName"],
         '      <score-instrument id="P1-I1">',
         '        <instrument-name>%s</instrument-name>' % inst["partName"],
         '        <instrument-sound>%s</instrument-sound>' % inst["sound"],
         '      </score-instrument>',
         '      <midi-instrument id="P1-I1">',
         '        <midi-channel>1</midi-channel>',
         '        <midi-program>%d</midi-program>' % inst["program"],
         '        <volume>100</volume>',
         '        <pan>0</pan>',
         '      </midi-instrument>',
         '    </score-part>',
         '  </part-list>',
         '  <part id="P1">']
    for i, pitch in enumerate(inst["pitches"]):
        step, alter, octave = midi_parts(pitch + shift)
        L.append('    <measure number="%d">' % (i + 1))
        if i == 0:
            L += ['      <attributes>',
                  '        <divisions>1</divisions>',
                  '        <key><fifths>0</fifths></key>',
                  '        <time><beats>4</beats><beat-type>4</beat-type></time>',
                  '        <clef><sign>%s</sign><line>%d</line></clef>' % (sign, line),
                  '      </attributes>',
                  '      <direction placement="above">',
                  '        <direction-type><dynamics><ff/></dynamics></direction-type>',
                  '        <direction-type><metronome><beat-unit>quarter</beat-unit>'
                  '<per-minute>60</per-minute></metronome></direction-type>',
                  '        <sound tempo="60"/>',
                  '      </direction>']
        L += ['      <note>',
              '        <pitch><step>%s</step><alter>%d</alter><octave>%d</octave></pitch>'
              % (step, alter, octave),
              '        <duration>1</duration>',
              '        <type>quarter</type>',
              '      </note>',
              '      <note>',
              '        <rest/>',
              '        <duration>3</duration>',
              '        <type>half</type>',
              '        <dot/>',
              '      </note>',
              '    </measure>']
    L += ['  </part>', '</score-partwise>', '']
    with open(path, "w") as fh:
        fh.write("\n".join(L))


def render(xml_path, wav_path):
    """Render MusicXML to WAV with the MuseScore CLI (offscreen Qt)."""
    if os.path.exists(wav_path):
        os.remove(wav_path)
    env = dict(os.environ, QT_QPA_PLATFORM="offscreen")
    proc = run([MSCORE, xml_path, "-o", wav_path], env=env)
    if proc.returncode != 0 or not os.path.exists(wav_path):
        sys.stderr.write(proc.stdout + proc.stderr)
        raise RuntimeError("mscore failed to render %s" % xml_path)


def wav_duration(path):
    proc = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "csv=p=0", path])
    return float(proc.stdout.strip())


def max_volume_db(path, extra_ss=None):
    """Peak sample level (dBFS) of a WAV, or of a slice if extra_ss is given."""
    cmd = ["ffmpeg", "-hide_banner"]
    if extra_ss is not None:
        cmd += ["-ss", "%.6f" % extra_ss, "-t", "%.6f" % SLICE_SEC]
    cmd += ["-i", path, "-af", "volumedetect", "-f", "null", "-"]
    proc = run(cmd)
    m = re.search(r"max_volume:\s*(-?\d+(?:\.\d+)?) dB", proc.stderr)
    if not m:
        raise RuntimeError("volumedetect found no max_volume for %s" % path)
    return float(m.group(1))


def onset_times(path, n_notes):
    """Measured note onsets (seconds) via silencedetect.

    The gaps between notes are ~4 s; the first note starts at t=0 and has no
    preceding silence, so its onset is prepended explicitly.  The trailing
    "silence_end" that lands on the file duration is discarded.
    """
    dur = wav_duration(path)
    proc = run(["ffmpeg", "-hide_banner", "-i", path, "-af",
                "silencedetect=n=%ddB:d=%.1f" % (ONSET_DB, ONSET_MIN_SIL),
                "-f", "null", "-"])
    ends = [float(m) for m in re.findall(r"silence_end:\s*(\d+(?:\.\d+)?)", proc.stderr)]
    ends = [t for t in ends if t < dur - 0.1]
    onsets = [0.0] + ends
    if len(onsets) != n_notes:
        raise AssertionError("expected %d onsets, got %d (%s)"
                             % (n_notes, len(onsets), onsets))
    gaps = [onsets[i + 1] - onsets[i] for i in range(len(onsets) - 1)]
    for g in gaps:
        if abs(g - 4.0) > 0.15:
            raise AssertionError("onset gap %.3f s is not ~4.0 s" % g)
    return onsets


def to_mono_16bit(src, dst):
    run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "1", "-ar",
         str(SAMPLE_RATE), "-c:a", "pcm_s16le", dst])


def encode_slice(mono_wav, onset, out_mp3):
    """Two-pass peak-normalise one 0.8 s slice to -3 dBFS and MP3-encode it."""
    peak = max_volume_db(mono_wav, extra_ss=onset)
    gain = PEAK_DBFS - peak
    os.makedirs(os.path.dirname(out_mp3), exist_ok=True)
    proc = run(["ffmpeg", "-v", "error", "-y",
                "-ss", "%.6f" % onset, "-t", "%.6f" % SLICE_SEC, "-i", mono_wav,
                "-af", "volume=%.2fdB" % gain,
                "-ac", "1", "-ar", str(SAMPLE_RATE),
                "-c:a", "libmp3lame", "-b:a", "%dk" % MP3_KBPS, out_mp3])
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr)
        raise RuntimeError("ffmpeg failed to encode %s" % out_mp3)
    return gain


def decode_mp3(src, dst):
    """Decode an MP3 to mono 44.1 kHz 16-bit WAV so measure_pitch can read it."""
    proc = run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ac", "1", "-ar",
                str(SAMPLE_RATE), "-c:a", "pcm_s16le", dst])
    if proc.returncode != 0:
        sys.stderr.write(proc.stderr)
        raise RuntimeError("ffmpeg failed to decode %s" % src)


def sustain_stats(samples, sr, onset):
    """Return (tail/head RMS ratio, least-squares slope in dB/s over 0.20..0.80 s).

    Splits the SLICE_SEC window after `onset` into SUSTAIN_WINDOWS equal frames,
    takes the RMS of each, and fits the frame level in dB (relative to the
    loudest frame) across windows 4..15.  A real brass tone holds its level;
    the piano patch MuseScore falls back to decays by tens of dB/s.
    """
    total = int(round(SLICE_SEC * sr))
    start = int(round(onset * sr))
    frame = total // SUSTAIN_WINDOWS
    env = []
    for i in range(SUSTAIN_WINDOWS):
        w = samples[start + i * frame:start + (i + 1) * frame]
        env.append(math.sqrt(sum(v * v for v in w) / len(w)) if w else 0.0)
    peak = max(env)
    head = max(env[:4])
    tail = max(env[-4:])
    window_sec = SLICE_SEC / SUSTAIN_WINDOWS
    xs = [i * window_sec for i in range(4, SUSTAIN_WINDOWS)]
    ys = [20.0 * math.log10(max(env[i], 1e-12) / max(peak, 1e-12))
          for i in range(4, SUSTAIN_WINDOWS)]
    mx = sum(xs) / len(xs)
    my = sum(ys) / len(ys)
    den = sum((x - mx) ** 2 for x in xs)
    slope = (sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den
             if den > 0.0 else 0.0)
    return (tail / head if head > 0.0 else 0.0), slope


def render_and_measure(inst):
    """Author -> render -> gate -> measure one instrument.

    Returns (onsets, measurements) where measurements is the list of dicts from
    measure_pitch.measure_onsets.  Applies the MuseScore-transposition
    auto-correction: if every note is off by the same constant, regenerate the
    MusicXML shifted by that amount and try again (max 2 attempts).
    """
    name = inst["name"]
    xml_path = os.path.join(WORK, "%s-concert.musicxml" % name)
    wav_path = os.path.join(RAW_DIR, "%s.wav" % name)
    mono_path = os.path.join(RAW_DIR, "%s.mono.wav" % name)
    n = len(inst["pitches"])

    for attempt in range(3):
        write_musicxml(xml_path, inst, shift=inst.get("_shift", 0))
        render(xml_path, wav_path)

        # --- Phase 3 gate -------------------------------------------------
        dur = wav_duration(wav_path)
        lo, hi = (4 * n + 0.0, 4 * n + 4.0)   # 8 notes -> 32..36 s; 6 -> 24..28
        assert lo <= dur <= hi, "%s duration %.2f s outside %.1f..%.1f" % (name, dur, lo, hi)
        peak = max_volume_db(wav_path)
        assert peak > -20.0, "%s render is near-silent (max %.1f dBFS)" % (name, peak)
        onsets = onset_times(wav_path, n)
        print("  gate OK: duration %.2f s, max %.1f dBFS, %d onsets"
              % (dur, peak, len(onsets)))

        to_mono_16bit(wav_path, mono_path)
        ms = measure_pitch.measure_onsets(mono_path, onsets,
                                          MEASURE_OFFSET, MEASURE_DUR)
        offsets = [m["midi"] - p for m, p in zip(ms, inst["pitches"])]
        median = sorted(offsets)[len(offsets) // 2]
        consistent = all(abs(o - median) < 0.15 for o in offsets)
        if abs(median) >= 0.5 and consistent and attempt < 2:
            shift = -int(round(median))
            print("  transposition detected: every note off by %+.3f semitones; "
                  "re-rendering shifted by %+d" % (median, shift))
            inst["_shift"] = inst.get("_shift", 0) + shift
            continue
        break

    for m, p in zip(ms, inst["pitches"]):
        err = abs(m["midi"] - round(m["midi"]))
        assert err <= 0.06, ("%s note intended %d measured midi %.4f "
                             "(%.1f cents) -- octave/spelling error"
                             % (name, p, m["midi"], (m["midi"] - round(m["midi"])) * 100))
        assert round(m["midi"]) == p, (
            "%s note %d measured midi %d -- filename drift would break the "
            "app's sample table" % (name, p, round(m["midi"])))

    # --- sustain gate -----------------------------------------------------
    # MuseScore ignores <midi-program> and picks the soundfont preset from
    # <part-name>; an unrecognised name silently falls back to its default
    # piano patch, which decays instead of sustaining.  Gate on the tail/head
    # RMS ratio and the dB/s slope so that never ships.
    sr, samples = measure_pitch.read_wav_mono(mono_path)
    for i, onset in enumerate(onsets):
        tail_head, slope = sustain_stats(samples, sr, onset)
        assert tail_head >= SUSTAIN_MIN_TAIL_HEAD and slope >= SUSTAIN_MIN_SLOPE_DB_S, (
            "%s note %d sustain tail/head %.2f, %+.1f dB/s -- MuseScore fell "
            "back to its default piano patch; check part-name / "
            "<instrument-sound> in write_musicxml()"
            % (name, i, tail_head, slope))
        print("  sustain OK: tail/head %.2f, %+.1f dB/s" % (tail_head, slope))
    return onsets, ms


# ------------------------------------------------------------- CREDITS / manifest
CREDITS = """# Sound sample credits

The 14 brass samples in this directory (`trumpet/trumpet-*.mp3`,
`trombone/trombone-*.mp3`) are derived from the **MS Basic** soundfont that
ships with MuseScore 4 (`/usr/share/mscore-4.7/sound/MS Basic.sf3`), itself a
scaled-down build of **MuseScore_General.sf2**.  They were rendered with the
MuseScore 4 CLI, then sliced, peak-normalised and MP3-encoded by
`web/scripts/make_sound_samples.py`.

MS Basic.sf3 is shared under the **MIT licence**, as were MuseScore_General.sf2,
FluidR3Mono and FluidR3 before it.  The acknowledgements and copyright notices
below are reproduced as required of any derivative work.

## Copyright and acknowledgements

FluidR3 (original version) by Frank Wen Copyright (c) 2000-02

Mono conversion (FluidR3Mono) by Michael Cowgill Copyright (c) 2014-17

Adaptation for MuseScore_General.sf2 by S. Christian Collins Copyright (c) 2018-19

Fluid (R3) SoundFont Copyright (c) 2000-2002, 2008 Frank Wen <getfrank@gmail.com>

## MIT licence

Mono version: Copyright (c) 2014-16 Michael Cowgill
Copyright (c) 2000-2002, 2008 Frank Wen <getfrank@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""


def write_manifest(results, generated):
    path = os.path.join(OUT_DIR, "manifest.json")
    # Seed from the existing manifest so a --only run keeps the untouched
    # instrument's block verbatim (including its measuredHz/measuredCentsError)
    # and any extra top-level fields; the regenerated keys below overwrite in
    # place, preserving the existing key order (trumpet, trombone).
    manifest = {}
    try:
        with open(path) as fh:
            manifest = json.load(fh)
        if not isinstance(manifest, dict):
            manifest = {}
    except (ValueError, OSError):
        manifest = {}
    manifest["version"] = 1
    manifest["generator"] = "web/scripts/make_sound_samples.py"
    manifest["generated"] = generated
    manifest["source"] = {
        "renderer": "MuseScore 4.7.4 (mscore CLI)",
        "soundfont": "MS Basic.sf3 (MuseScore_General)",
        "soundfontPath": SOUNDFONT,
        "license": "MIT",
        "credits": "CREDITS.md",
    }
    manifest["format"] = {
        "codec": "mp3",
        "bitrateKbps": MP3_KBPS,
        "channels": 1,
        "sampleRate": SAMPLE_RATE,
        "sliceSec": SLICE_SEC,
        "peakDbFS": PEAK_DBFS,
    }
    instruments = manifest.get("instruments")
    if not isinstance(instruments, dict):
        instruments = {}
        manifest["instruments"] = instruments
    for inst, samples in results:
        instruments[inst["name"]] = {
            "gmProgram1Based": inst["program"],
            "transposeSemitones": inst["transposeSemitones"],
            "samples": samples,
        }
    with open(path, "w") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")
    return path


# ------------------------------------------------------------------- pipeline
def main():
    argv = sys.argv[1:]
    if not argv:
        selected = INSTRUMENTS
    elif len(argv) == 2 and argv[0] == "--only":
        names = [i["name"] for i in INSTRUMENTS]
        if argv[1] not in names:
            sys.stderr.write("unknown instrument '%s' -- choose from %s\n"
                             % (argv[1], ", ".join(names)))
            return 2
        selected = [i for i in INSTRUMENTS if i["name"] == argv[1]]
    else:
        sys.stderr.write("usage: make_sound_samples.py [--only trumpet|trombone]\n")
        return 2
    only = bool(argv)

    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    for inst in selected:
        os.makedirs(os.path.join(OUT_DIR, inst["name"]), exist_ok=True)

    results = []
    for inst in selected:
        name = inst["name"]
        print("=== %s (%d samples) ===" % (name, len(inst["pitches"])))
        onsets, ms = render_and_measure(inst)

        samples = []
        for onset, m in zip(onsets, ms):
            midi = int(round(m["midi"]))
            fname = "%s/%s-%03d.mp3" % (name, name, midi)
            out_mp3 = os.path.join(OUT_DIR, name, "%s-%03d.mp3" % (name, midi))
            gain = encode_slice(os.path.join(RAW_DIR, "%s.mono.wav" % name),
                                onset, out_mp3)
            # Phase 6: re-measure the FINAL mp3 (onset is 0 -- the slice starts
            # on the note; window 0.20..0.75 s fits inside the 0.80 s slice).
            decoded = os.path.join(RAW_DIR, "%s-%03d.decoded.wav" % (name, midi))
            decode_mp3(out_mp3, decoded)
            final = measure_pitch.measure_onsets(decoded, [0.0],
                                                 MEASURE_OFFSET, MEASURE_DUR)[0]
            err_cents = measure_pitch.cents(final["hz"],
                                            measure_pitch.midi_to_hz(midi))
            assert abs(err_cents) <= 15.0, (
                "%s measured %+.1f cents from filename MIDI %d"
                % (fname, err_cents, midi))
            samples.append({
                "file": fname,
                "midi": midi,
                "measuredHz": round(final["hz"], 3),
                "measuredCentsError": round(err_cents, 2),
            })
            print("  %-22s onset %6.3f s  gain %+5.2f dB  "
                  "raw %7.3f Hz  final %7.3f Hz  %+6.2f cents"
                  % (fname, onset, gain, m["hz"], final["hz"], err_cents))
        results.append((inst, samples))

    generated = datetime.date.today().isoformat()
    write_manifest(results, generated)
    if only:
        print("wrote manifest.json (--only: CREDITS.md left untouched)")
    else:
        with open(os.path.join(OUT_DIR, "CREDITS.md"), "w") as fh:
            fh.write(CREDITS)
        print("wrote manifest.json + CREDITS.md")

    total = 0
    for _root, _dirs, files in os.walk(OUT_DIR):
        for f in files:
            total += os.path.getsize(os.path.join(_root, f))
    print("sounds/ total: %.0f KB" % (total / 1024.0))


if __name__ == "__main__":
    sys.exit(main())
