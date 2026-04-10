# 🎯 Immediate next steps (in order)

## 1. Note segmentation (critical)

Right now you have a stream of frequencies. You need **discrete notes**.

### Goal:

Turn this:

```ts
[C4, C4, C4, D4, D4, silence, E4...]
```

Into:

```ts
[
  { note: "C4", start: t1, duration: 400ms },
  { note: "D4", start: t2, duration: 300ms }
]
```

### Heuristics (good enough v1):

* New note if:

  * pitch jump > ~80 cents
  * OR silence gap > 50–100ms
* Ignore first ~50ms (attack phase)

👉 Without this, timing is impossible.

---

## 2. Timing model (v1 = simple, don’t overthink)

You don’t need AI yet.

### Start with:

* Fixed tempo (e.g. 80 BPM)
* Convert time → beats

```ts
msPerBeat = 60000 / bpm
beat = timestamp / msPerBeat
```

Now each detected note has:

```ts
{
  note: "C4",
  startBeat: 1.2,
  durationBeats: 0.8
}
```

---

## 3. Sheet music ingestion

### Use:

* **MusicXML** (don’t use raw MIDI for now)

Parse into:

```ts
{
  note: "C4",
  startBeat: 1,
  duration: 1
}
```

👉 Now you have **expected vs actual**

---

## 4. Matching engine (core of your product)

For each expected note:

* Find closest played note (by time window)

### Compute:

* **Pitch error** (cents)
* **Timing error** (beat offset)

```ts
pitchError = actual.cents
timeError = actual.startBeat - expected.startBeat
```

---

## 5. Scoring system (simple first)

```ts
if (abs(pitchError) < 10 && abs(timeError) < 0.2)
  score = "perfect"
else if (...)
  score = "ok"
else
  score = "miss"
```

---

## 6. Visual feedback (your “aha” moment)

Start minimal:

* Scrolling staff (or even just blocks)
* Notes colored:

  * 🟢 correct
  * 🟡 off timing
  * 🔴 wrong pitch

👉 This is where it becomes “Guitar Hero”

---

## 7. Session loop (product, not tech)

* Play → feedback → retry
* Track:

  * accuracy %
  * problem notes

👉 This is what users actually care about.

---

# 🧱 Final App Skeleton (clean architecture)

Keep it simple but scalable.

```plaintext
src/
├── audio/                  # raw audio handling
│   ├── AudioEngine.ts
│   ├── WorkletProcessor.js
│   └── BufferManager.ts
│
├── pitch/                  # low-level DSP
│   ├── PitchDetector.ts
│   ├── NoteMapper.ts
│   └── SignalFilter.ts
│
├── performance/            # your core logic (IMPORTANT)
│   ├── NoteSegmenter.ts     # stream → notes
│   ├── TimingEngine.ts      # ms → beats
│   ├── Matcher.ts           # expected vs actual
│   ├── Scorer.ts            # grading
│   └── SessionTracker.ts    # stats/history
│
├── score/                  # sheet music domain
│   ├── MusicXmlParser.ts
│   ├── ScoreModel.ts
│   └── TempoMap.ts
│
├── ui/
│   ├── Tuner.tsx
│   ├── PracticeView.tsx
│   ├── NoteLane.tsx         # guitar hero-like
│   └── FeedbackOverlay.tsx
│
├── hooks/
│   ├── useAudio.ts
│   ├── usePitch.ts
│   └── usePracticeSession.ts
│
├── state/
│   └── store.ts (Zustand or similar)
│
└── utils/
    └── math.ts
```

---

# 🔁 Data Flow (end-to-end)

```plaintext
Mic → AudioWorklet → PitchDetector
    → NoteMapper → NoteSegmenter
    → TimingEngine → Matcher
    → Scorer → UI
```

---

# ⚠️ What to NOT do next

Avoid:

* ❌ DTW / ML alignment (too early)
* ❌ multiplayer / backend
* ❌ fancy UI before feedback works
