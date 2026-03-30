# PitchQuest Implementation Plan
## 1. Concrete Implementation Tasks
### Phase 1: Foundation & Audio Infrastructure
- [x] Initialize React + TypeScript project with Vite.
- [x] Setup project structure (folders for hooks, components, worklets).
- [x] Implement `PitchProcessor` as an `AudioWorkletProcessor`.
  - [x] Handle sample accumulation (buffer size 2048).
  - [x] Integrate `pitchy` within the worklet (or via message passing if preferred for MVP simplicity, but worklet is better for latency).
- [x] Create `useAudioContext` hook to manage `AudioContext` lifecycle and permission.
### Phase 2: Pitch Detection Engine
- [x] Implement `usePitchDetection` hook.
  - [x] Connect microphone source to `AudioWorkletNode`.
  - [x] Receive frequency and clarity data from worklet.
- [x] Develop `pitch-math.ts`:
  - [x] `freqToNote(freq)`: Convert Hz to MIDI and note name.
  - [x] `calculateCents(freq, expectedFreq)`: Determine deviation.
- [x] Implement stabilization logic:
  - [x] `MedianFilter` class for outlier rejection.
  - [x] `MovingAverage` for jitter reduction.
### Phase 3: UI Implementation
- [x] Create `PitchDisplay` component.
  - [x] Large note label (e.g., "A4").
  - [x] Frequency display (Hz).
- [x] Create `CentsMeter` component.
  - [x] Visual needle or bar indicating -50 to +50 cents.
  - [x] Color feedback (green for in-tune, red for out-of-tune).
### Phase 4: Refinement & Testing
- [ ] Test with various wind instruments (simulated or real).
- [ ] Optimize buffer sizes and thresholds based on feedback.
- [ ] Add "Start/Stop" controls and visual feedback for mic access.
---
## 2. Suggested File/Module Structure
```text
src/
├── assets/
├── audio/
│   ├── hooks/
│   │   ├── useAudioContext.ts      # AudioContext management
│   │   └── usePitchDetection.ts    # Main logic hook
│   ├── processors/
│   │   └── pitch-processor.ts      # AudioWorklet (raw JS or bundled TS)
│   └── utils/
│       ├── pitch-math.ts           # Freq to Note logic
│       └── smoothing.ts            # Median/Moving average filters
├── components/
│   ├── PitchDisplay.tsx            # Main note label
│   ├── CentsMeter.tsx              # The visual tuner UI
│   └── AudioControl.tsx            # Start/Stop button
├── App.tsx
└── main.tsx
```
*Note: `AudioWorklet` scripts usually need to be separate files or bundled specifically to be loaded via `audioContext.audioWorklet.addModule()`.*
---
## 3. Key Technical Decisions
| Decision | Value | Rationale |
| :--- | :--- | :--- |
| **Buffer Size** | 2048 samples | Balanced latency (~46ms @ 44.1kHz) with accuracy for lower wind instrument notes. |
| **Algorithm** | YIN (`pitchy`) | Robust for monophonic instruments, handles harmonic interference well. |
| **Clarity Threshold**| 0.9 | High precision requirement to avoid "ghost notes" during silence or breath noise. |
| **Smoothing** | Median (5) + MA (3)| Median filter removes 1-2 frame outliers; Moving Average smooths the "needle" movement. |
| **Sample Rate** | 44100 / 48000 Hz | Standard hardware rates; `pitchy` adjusts based on provided rate. |
---
## 4. Milestones
1. **Milestone 1: Signal Chain**: Mic input successfully reaches an `AudioWorklet` and logs data to console.
2. **Milestone 2: Raw Pitch**: `pitchy` returning frequency values from live audio.
3. **Milestone 3: Stable Note**: Frequency converted to note names with stabilization applied.
4. **Milestone 4: Visual Feedback**: MVP UI with working Cents Meter.
---
## 5. Risks & Mitigations
| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Audio Latency** | High | Use `AudioWorklet` instead of `ScriptProcessorNode`. Avoid heavy main-thread work. |
| **Ambient Noise** | Medium | Use "Clarity" metric from `pitchy` to ignore low-confidence detections. |
| **Worklet Loading** | Low | Ensure the worklet script is served correctly (Vite `?worker&url` or public folder). |
| **Inharmonicity** | Low | Wind instruments are generally strongly harmonic; YIN handles this well. |