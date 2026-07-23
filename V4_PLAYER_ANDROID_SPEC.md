# V4 Player — Android Replication Spec

> Target audience: Replit / Android team.
> Goal: build a native Android (ExoPlayer) clone of the web V4 AI-lecture player that consumes the same `presentation.json` and the same `v3-player-proxy` edge function the web client already uses.
> Reference web implementation: `src/components/learning/v4/*` in this repo.

---

## 1. Overview

V4 is the AI-lecture player. The web client:

1. Receives a `jobId` (the pipeline render id).
2. Fetches `presentation.json` from the proxy.
3. Walks the `sections[]` array in order, playing **one video per section** plus optional overlays (subtitles, visual beats, scene-specific UI, quiz).
4. Streams everything through the Supabase edge function `v3-player-proxy` (so origin IPs stay hidden).

Active for course IDs listed in `src/lib/playerSelection.ts` — currently D.Pharmacy `e74e8e53-5949-4113-a565-1e84c2b4ee0e`.

Entry URL pattern on web: `/learning/{courseId}` → opens `V4Player` with `jobId`.

---

## 2. Backend contract

### 2.1 Proxy base

```
PROXY_BASE = https://<supabase-project>.supabase.co/functions/v1/v3-player-proxy
```

(Web reads this from `src/lib/supabaseUrl.ts` — IP-blocked supabase region forces a Cloudflare-proxied host. Android can use the same host.)

### 2.2 Endpoints

| Purpose            | URL                                                              |
|--------------------|------------------------------------------------------------------|
| Presentation JSON  | `${PROXY_BASE}/player/jobs/{jobId}/presentation.json`            |
| Any media asset    | `${PROXY_BASE}/player/jobs/{jobId}/{relativePath}`               |

### 2.3 Path resolution rule (mirror `getMediaSrc` in `utils.ts`)

```
if path starts with http://, https://, or blob:  → use as-is
else strip leading "/" and prepend `${PROXY_BASE}/player/jobs/{jobId}/`
```

### 2.4 Auth headers

Send the same headers the Supabase JS client sends to edge functions:

```
apikey:        <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY>   // anon ok; user JWT also fine
```

---

## 3. `presentation.json` schema

Source of truth: `src/components/learning/v4/types.ts`. Summary below.

### 3.1 V4Presentation (root)

```json
{
  "presentation_title": "string",
  "title": "string",
  "avatar_name": "string",
  "subject": "string",
  "sections": [ V4Section, ... ]
}
```

### 3.2 V4Section

| Field                  | Type                                | Notes |
|------------------------|-------------------------------------|-------|
| `section_id`           | string \| number                    | stable id |
| `title`                | string                              | shown in top bar / section chips |
| `section_type`         | `intro \| content \| summary \| memory \| memory_infographic \| recap \| quiz` | drives UI |
| `type`, `renderer`     | string (legacy fallbacks)           | use `section_type \|\| type` |
| `narration`            | `V4Narration`                       | timing + subtitles |
| `avatar_video`         | string (relative path)              | the talking-head clip |
| `avatar_url`, `avatar`, `b2_url` | string                    | legacy fallbacks for avatar path |
| `video_path`           | string                              | legacy fallback |
| `final_video_path`     | string                              | **pipeline-merged** avatar+visuals video. When present and section is NOT intro/summary, play THIS instead of avatar (and skip overlays). |
| `manim_video_paths`    | string[]                            | overlay manim clips |
| `beat_video_paths`     | string[]                            | overlay beat clips |
| `visual_beats`         | `V4VisualBeat[]`                    | timed video/image overlays |
| `render_spec`          | `{ infographic_beats?: V4InfographicBeat[] }` | for memory_infographic |
| `flashcards`           | `V4Flashcard[]`                     | for memory/recap |
| `understanding_quiz`   | `V4Question`                        | embedded quiz at end of content |
| `questions`            | `V4Question[]`                      | for `quiz` section_type |
| `segment_duration_seconds`, `dur` | number                   | optional total dur hints |

### 3.3 V4Narration / V4Segment

```ts
V4Narration {
  full_text?: string,
  total_duration_seconds?: number,
  segments: V4Segment[]
}
V4Segment {
  text: string,
  duration_seconds?: number, duration?: number,
  start_seconds?: number, end_seconds?: number,
  purpose?: string,
  beat_videos?: string[],
  video_path?: string
}
```

### 3.4 V4VisualBeat / V4InfographicBeat

```ts
V4VisualBeat {
  beat_start_seconds: number,
  beat_end_seconds: number,
  visual_type: 'video' | 'image' | 'infographic',
  video_path?: string,
  image_source?: string
}
V4InfographicBeat { start_seconds?, end_seconds?, image_source? }
```

### 3.5 V4Question

```ts
V4Question {
  question: string,        // or question_text
  options: { A: string, B: string, C: string, D: string },
  correct: string,         // or correct_option
  explanation?: string,
  option_reveal_seconds?: number[],
  narration?: {
    option_reveal_seconds?: number[],
    question_script?: string,
    correct_script?: string,
    wrong_script?: string,
    explanation_script?: string
  },
  avatar_clips?: { question?, correct?, wrong?, explanation? },  // relative paths
  script?: { question?, correct?, wrong?, explanation? },
  explanation_visual?: { video_path?, wan_video_path?, image_path?, image_source? }
}
```

### 3.6 V4Flashcard

`{ q?, a?, front?, back?, question?, answer? }` — pick whichever pair is present.

---

## 4. Primary asset rule (CRITICAL — mirror `getPrimarySectionAssets`)

This single rule decides which one URL to preload and play per section. Android **must** match it exactly so cache behavior is identical.

```
function primaryAsset(section, sectionIndex):
  type = section.section_type ?? section.type ?? 'content'
  avatar = section.avatar_video ?? avatar_url ?? avatar ?? b2_url
  final  = section.final_video_path

  if type in {intro, summary}:
      return AVATAR(avatar)        // force avatar regardless of index

  if sectionIndex <= 1:
      return AVATAR(avatar || final)   // first two sections: avatar only

  // sectionIndex >= 2
  return FINAL(final || avatar)        // composited video preferred
```

Why: the pipeline renders `section_N_final.mp4` starting at section 2. Sections 0 & 1 only have an avatar talking head. This rule keeps boot tiny and avoids double-downloading.

---

## 5. Section-by-section behavior

For every section: load primary asset → start playback → render the scene matching `section_type` → on video `ended`, decide whether to enter quiz overlay or auto-advance.

### 5.1 `intro`
- Fullscreen avatar (`V4IntroScene`).
- No subtitles, no overlays.
- On end → auto-advance to next section.

### 5.2 `content` (most common)
Two sub-modes:

**a) Merged mode** (when `final_video_path` is set AND section_type ≠ intro/summary):
- Play `final_video_path` as the sole video source.
- **Do not** render karaoke subtitles, visual beats, manim overlays, or scene UI — the pipeline already baked them in.
- On end → if `understanding_quiz` or `questions[]` present → enter quiz overlay; else → auto-advance.

**b) Composited mode** (no `final_video_path`):
- Play `avatar_video` as the base video layer.
- Schedule overlays on top of the video timeline:
  - `visual_beats[]` → show video/image at `[beat_start_seconds, beat_end_seconds]` (web hook: `useVideoSchedule.ts`).
  - `manim_video_paths[]` → scheduled per `useManimSchedule.ts`.
  - Karaoke subtitles from `narration.segments` with 3 modes: `karaoke` (word highlight using segment timings — see `useKaraokeEngine.ts`), `full`, `off`.
- On end → quiz check same as (a).

### 5.3 `summary`
- Avatar video + `V4SummaryScene` overlay (key-points list synced loosely to avatar).

### 5.4 `memory` / `memory_infographic`
- Avatar video + `V4MemoryScene` overlay (flashcard deck from `flashcards` or infographic strip from `render_spec.infographic_beats`).

### 5.5 `recap`
- Avatar video + `V4RecapScene` overlay (compact bullet recap from `flashcards` / narration).

### 5.6 `quiz` (standalone) or `showQuiz = true` (embedded)
Per question, play avatar clips in this order:

```
question  → reveal options at narration.option_reveal_seconds
         ↓ (user picks)
correct  OR  wrong
         ↓
explanation  (+ explanation_visual if present)
         ↓
next question
```

- Each clip lives under `avatar_clips.{question|correct|wrong|explanation}`.
- Quiz clips are **NOT** preloaded — fetch on demand from the proxy.
- After last question: if standalone `quiz` section → auto-advance; if embedded → resume normal flow (advance to next section).

---

## 6. Preloader — BOOT + BG (mirror `useMediaPreloader.ts`)

### 6.1 BOOT phase (gates playback)

- In parallel, fetch the **primary asset** (rule §4) of sections **0, 1, 2** to local cache.
- Section 0 MUST be cached before play starts. Sections 1 & 2 are best-effort.
- Hard timeout: **20s**. After timeout, if sec 0 is ready, start playback with partial cache; sec 1/2 continue in background.
- Show a progress UI: `loaded / total` where total = sum of primary assets for sec 0..2.

### 6.2 BG phase (after BOOT)

- Sequentially (1 fetch at a time, globally) walk sections 3..N-1, primary asset only.
- On user jump to a not-yet-cached section:
  1. Cancel the in-flight BG fetch.
  2. Prioritize the jumped-to section's primary asset.
  3. Resume sequential walk from `max(cursor, currentIndex + 1)`.

### 6.3 Cache map

- Key: full proxy URL string.
- Value: local file path (Android) / blob URL (web).
- Lookup helper `getBlob(proxyUrl) -> localPathOrNull`.
- On unmount/exit: delete cached files (or apply a max-size LRU on Android — see open questions §12).

### 6.4 What is NOT preloaded
- Quiz `avatar_clips` (play on demand).
- Composited-mode overlays (`visual_beats`, `manim_video_paths`) — also on demand. They are short and only used when no `final_video_path` exists.

---

## 7. Playback engine (ExoPlayer)

- **Single video surface**. On section change, swap MediaItem (no two players running).
- `playbackRate`: 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3 (default 1). Persist across section swaps.
- `mute`, `seekTo(percent * duration)`, `replay` (reload current section from 0).
- Fullscreen: on tap, lock orientation to landscape. On exit, unlock.
- Tap-to-start gate on first launch (Android autoplay-with-audio is allowed but matching web UX is preferred).
- `timeupdate`-equivalent:
  - Throttle UI/progress-bar updates to ~250ms.
  - For completion tracking, accumulate `delta = currentTime - lastTime` when `0 < delta < 5s` (skip-aware).
- `ended` handler:
  1. If section has embedded `understanding_quiz` or `questions[]` (and isn't already a quiz section) → enter quiz overlay; do not pause/advance.
  2. Else if not the last section → call `loadSection(currentIndex + 1)`.
  3. Else → show completion dialog (see §8).

---

## 8. Completion + analytics (mirror `src/hooks/useVideoCompletionTracker.ts`)

- **Required watch time** = `Σ section.segment_duration_seconds` (or section narration totals) **minus 60 s**.
- Report accumulated `delta` from timeupdate into the tracker.
- When accumulated ≥ required → fire:
  - lecture completion badge insert (Supabase `student_badges`).
  - chapter-test-ready check (if all topic lectures complete → show `ChapterTestReadyDialog`).
- The tracker takes `topicId`, `chapterId`, `subjectId`, `courseId`, `videoTitle` — pass the same fields from the launching screen on Android.

Android can call the existing Supabase REST endpoints directly with the user's JWT, or proxy through a thin native helper.

---

## 9. UI structure

```
┌────────────────────────────────────────────┐
│ TopBar: title │ section chips │ close (X)  │
├────────────────────────────────────────────┤
│                                            │
│   Video surface (avatar OR final)          │
│   + overlay layers (composited mode only)  │
│   + scene overlay (intro/summary/memory…)  │
│   + quiz overlay (when active)             │
│   + subtitle layer (karaoke/full/off)      │
│                                            │
├────────────────────────────────────────────┤
│ BottomBar: ◀  ▶/⏸  ▶  ──seek──  1x  CC  🔊 ⛶│
└────────────────────────────────────────────┘
```

- Loading screen: spinner + `Preparing lecture... loaded/total` + progress bar.
- Tap-to-start overlay on cold start.
- Section chips in top bar are tappable for jump (triggers preloader §6.2 priority path).

---

## 10. Logging contract

Android should emit log tags matching the web client so we can diff sessions:

| Tag                       | When                                                     |
|---------------------------|----------------------------------------------------------|
| `[V4Player]`              | High-level lifecycle (load, play, pause, seek, ended)    |
| `[V4Preload] BOOT …`      | BOOT fetches/skips/timeouts                              |
| `[V4Preload] BG …`        | BG sequential fetches, priority jumps, aborts            |
| `[V4Source] sec=N kind=…` | Resolved source per asset, `source=CACHE` or `PROXY`     |
| `[V4Source] === SECTION N ENTER === …` | Section transition open                     |
| `[V4Source] === SECTION N EXIT  === …` | Section transition close + playedFromCache  |
| `[V4Heartbeat] sec=N …`   | Every 8 s — section, kind, source, currentTime           |

---

## 11. Reference files in this repo

Mirror behavior from these:

| File                                                     | Purpose                                    |
|----------------------------------------------------------|--------------------------------------------|
| `src/components/learning/v4/V4Player.tsx`                | Orchestration + state machine              |
| `src/components/learning/v4/types.ts`                    | JSON schema (TypeScript)                   |
| `src/components/learning/v4/utils.ts`                    | `getMediaSrc`, `getPrimarySectionAssets`, `isMergedSection`, logging helpers |
| `src/components/learning/v4/constants.ts`                | Proxy base, speed steps, badge config      |
| `src/components/learning/v4/hooks/useMediaPreloader.ts`  | BOOT + BG cache rules                      |
| `src/components/learning/v4/hooks/useVideoSchedule.ts`   | Visual beat scheduling                     |
| `src/components/learning/v4/hooks/useManimSchedule.ts`   | Manim overlay scheduling                   |
| `src/components/learning/v4/hooks/useKaraokeEngine.ts`   | Word-by-word subtitle highlighting         |
| `src/components/learning/v4/V4ContentLayers.tsx`         | Composited-mode overlay rendering          |
| `src/components/learning/v4/V4Avatar.tsx`                | Video-element wrapper + source assignment  |
| `src/components/learning/v4/sections/V4IntroScene.tsx`   | Intro UI                                   |
| `src/components/learning/v4/sections/V4SummaryScene.tsx` | Summary UI                                 |
| `src/components/learning/v4/sections/V4MemoryScene.tsx`  | Memory / infographic UI                    |
| `src/components/learning/v4/sections/V4RecapScene.tsx`   | Recap UI                                   |
| `src/components/learning/v4/sections/V4QuizScene.tsx`    | Quiz flow                                  |
| `src/hooks/useVideoCompletionTracker.ts`                 | Completion math + badge inserts            |
| `src/lib/playerSelection.ts`                             | Which course IDs use V4                    |

---

## 12. Open questions for the Replit / Android team

1. **Disk-cache budget**: max bytes for the V4 cache directory (suggest 500 MB LRU)?
2. **Persistence across sessions**: keep cache across app restarts, or wipe on player exit (web wipes on unmount)?
3. **Offline mode**: should a fully-preloaded lecture be playable with no network? If yes we need to persist `presentation.json` too.
4. **Auth header**: confirm whether the Android shell should send the user JWT or just the anon key to the proxy.
5. **Telemetry**: confirm endpoints/tables for the completion tracker writes (mirror what the web hook does).
6. **Push notification** on chapter-test-ready (already in web) — wire to FCM?
7. **Quiz answer logging**: do we need to POST quiz attempts back? Web currently does not for embedded quizzes.

---

End of spec. Ping us if any field, endpoint, or rule above is unclear — the web client is the source of truth and we can extract more detail from any of the files listed in §11.
