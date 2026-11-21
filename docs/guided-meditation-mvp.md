# Guided Meditation MVP

The public app follows the [Floviate 1 product reference](https://docs.google.com/document/d/1BRlK2vEVVrwsduADpmHsHQOG_V3PxztdYmbn5Uv_GGM/edit): remember a past experience, explore a present opportunity, imagine a future, compare and combine the feelings, let the images fade, then choose a small practical action. A later reflection compares experience with imagination. Breathing cues are comfortable and optional. Financial aspirations are welcome; the scripts make no claim that meditation produces financial outcomes.

## Start and verify on a phone

```bash
cd web
npm install
npm run dev
```

No `.env.local` is required for free meditations. The dev server listens on `0.0.0.0:3004`. On the same Wi-Fi, open `http://YOUR_COMPUTER_LAN_IP:3004` in iPhone Safari. On a Mac, `ipconfig getifaddr en0` commonly shows the Wi-Fi IP. The computer firewall must permit the development server. Use a real HTTPS deployment for normal public access.

1. Open `/` without signing in. Select **I Got It**.
2. Choose **3 minutes** and the full journey. Keep narration and cinematic dialogue enabled.
3. Rain and brown noise start enabled at 75%. Adjust their independent volumes or turn either off, then press Play. Both remain optional and adjustable during the session.
4. Confirm you hear a narrator recalling capability, a complete “I got it” conversation, a present visualization, a quiet interval with ambient sound, a future/feeling cue, and a closing action invitation.
5. Pause during narration and during silence. Confirm both speech and background stop. Resume and confirm only one sequence plays.
6. Restart, stop, navigate away, and begin another session. Confirm no previous audio continues.
7. Let a session finish and confirm the completion view appears. Resource offers belong here and outside the active meditation.
8. Try narration-only, dialogue-only, and both off. Try one ambient layer, both, and neither.

Browser voices differ between devices and may take a moment to load. Speech begins only after an explicit Play gesture. Keep Safari in the foreground and the screen awake: lock-screen/background playback is not guaranteed. Hiding the page pauses the session; return and press Resume to continue. If the operating system discards paused speech, the player explains that a Restart is needed. Browser speech timing is estimated; completed speech takes priority over cutting off a sentence to hit the requested duration. Check the player’s timing/status messages if speech or an audio asset fails. Captions accompany the experience but are not a substitute for testing audible output on a real device.

For an iPhone ambient-audio check, enable Rain by itself, then Brown noise by itself, and then both; listen during speech and a quiet interval. Repeat with Silent mode enabled, and check Pause/Resume and changing the sound controls during playback. Current Safari should keep the background audible in Silent mode because the player declares a playback audio session. On older browsers without the Audio Session API, turning Silent mode off may still be necessary.

If background sound is silent, use **Test background sounds** in the composer first. This plays only the selected ambient layers, without speech, and stops before a session starts or when the page is hidden. If the test is silent, try **Restore background sound**. If the test is audible but starting narration silences it, record the phone/browser/OS version and that distinction; do not treat an advancing timer as proof of audible output. The active player also offers Restore, applying it after the current spoken sentence to avoid changing system audio modes during speech.

## Small, independent architecture

| Location | Responsibility |
| --- | --- |
| `web/lib/meditation/types.ts` | Meditation, unit, cinematic scene, audio asset, configuration, and timeline contracts. |
| `web/lib/meditation/content.ts` | Editable source scripts, character turns, versions, and meditation definitions. |
| `web/lib/meditation/compose.ts` | Deterministic selection and timing of complete content units and silence. |
| `web/lib/meditation/defaults.ts` | Default configuration and duration presets. |
| `web/lib/meditation/player.ts` | Session clock, sequential speech scheduling, transport state, and cleanup. |
| `web/lib/meditation/audio.ts` | Browser TTS/recording playback and independent procedural ambient layers. |
| `web/lib/meditation/speech-pacing.ts` | Shared speaking rates, sentence boundaries, and pause lengths for rendering and estimates. |
| `web/lib/meditation/saved-config.ts` | Validated local device storage for saved free-session preferences. |
| `web/components/meditation/` | Public library, composer, player, and shared presentation. |
| `web/lib/meditation/resources.ts` | Optional public product and educational links. |

The meditation modules do not depend on tasks, task IDs, account state, or database queries. Root layout renders the public app without account providers. The preserved tracker route group owns its existing auth/query providers. The Supabase client is initialized lazily only when account code uses it; missing credentials never prevent importing or building the free application.

`SessionConfig` identifies a meditation, requested duration (10–900 seconds), focus (`full`, `past`, `present`, `future`, or `feeling`), narration and dialogue switches, independently enabled/leveled ambient layers, optional intention and visualization anchors, and optional voice assignments. A `ComposedSession` contains ordered `TimelineEntry` objects with unit/scene/character IDs, start and duration, text, script version, optional recording, and explicit silence.

Saved preferences and creative briefs stay in the current browser’s local storage. They do not synchronize between devices or create an account. If private browsing or storage restrictions prevent saving, the current session can still be composed and played.

Scripts are the source. Audio is an optional rendering of that source. No generated-audio service is required to author a line, change a speaker, or use the composition engine.

`composeSession(meditation, config)` is pure and deterministic. Sessions below one minute use dedicated emotional recall. One-minute sessions develop a selected focus; the three-minute full journey brings together past, present, future, feeling, and action with one complete Dinner scene. Present-focused sessions can use the First Customer scene; future-focused sessions can use The Offer. Longer sessions add arrival, intention, and additional complete units. Focused journeys keep the chosen phase alongside feeling, action, and return. Remaining time becomes deliberate quiet, weighted toward visualization and feeling.

Recall sessions through 15 seconds select a short variant; 16–59 seconds prefer a medium variant and fall back to a complete shorter variant if needed to fit. Durations must be whole seconds. Sessions from 60–90 seconds select short variants, 91–300 seconds select medium, and longer sessions select long, falling back to the base script if a variant is absent. Visualization anchors can replace a guidance prompt once per phase in sessions of at least a minute. The personal intention appears in the intention phase, available from five minutes onward.

The player uses one active elapsed clock and waits for both the planned time and actual speech completion before advancing. Slow device speech can extend a session; timing drift is surfaced rather than corrected by cutting off or accelerating speech. Pause uses native speech pause/resume and suspends Web Audio; restart, stop, completion, and unmount cancel speech and release audio resources. Brown noise and rain are locally generated stereo layers. No third-party ambient recordings or paid audio services are required.

Browser narration and cinematic dialogue use 85% of their original speaking rates (0.7395 and 0.799). Each complete sentence is spoken in order, with an additional 1.2 seconds between narration sentences and 0.75 seconds between cinematic sentences. Dialogue turns also have a 0.75-second pause. These pauses start after actual speech completion, keep the ambient layers running, freeze on Pause, and are canceled on Stop/Restart. The unit remains intact in the timeline and captions; its duration estimate includes slower speech and its sentence gaps. The shortest recall variants are authored to fit this gentler delivery. Recorded clips keep their measured timing and should be recorded with the intended pauses; recordings are not mechanically stretched.

Before creating or resuming Web Audio, the player feature-detects `navigator.audioSession` and selects `playback` synchronously in the Play gesture. This addresses iOS silencing generated audio with the ring/silent switch while narration remains audible ([WebKit explanation and recommended fix](https://bugs.webkit.org/show_bug.cgi?id=251532)). The previous audio-session mode is restored on cleanup if still owned. Unexpected context suspension/interruption gets one recovery attempt per episode; changing enabled ambient controls also retries from a user gesture. Paused sessions never auto-resume, and cleanup removes the context listener.

Native sentence completion also retries suspended/interrupted ambient audio. A user-requested Restore cycles the owned audio session through `ambient` and back to `playback` across tasks, preserving the existing graph and gains; Pause/Stop/unmount cancel pending recovery. This targets a [reported WebKit stale audio-session failure](https://bugs.webkit.org/show_bug.cgi?id=323104), where the browser can report normal playback while output is silent. A [separate WebKit speech-synthesis fix](https://github.com/WebKit/WebKit/pull/79989/files) addresses speech interrupting other media; its availability depends on the device release. Neither report establishes the cause on a particular phone. The app cannot certify physical sound from API state, so a real-device listening check remains required. It does not automatically cycle audio modes during every sentence.

## Author content

### Add a narrator line

Add a `MeditationUnit` in `content.ts`, or in a content module imported there. Give it a stable ID, phase, type, emotional intent, source text, script version, duration estimate, session eligibility, and transition spacing. For example:

```ts
const line: MeditationUnit = {
  id: 'i-got-it.present-small-step',
  type: 'visualization-prompt',
  phase: 'present',
  emotionalEffect: 'A grounded sense of capability',
  scriptVersion: '1',
  text: 'Picture one small thing you can begin today. Let it be enough to begin.',
  estimatedDurationSeconds: 12,
  minSessionSeconds: 60,
  maxSessionSeconds: 900,
  transition: { beforeSeconds: 1, afterSeconds: 2 },
}
```

Add the unit to the meditation’s `units` collection. Keep IDs stable across editorial changes. Increment the unit’s `scriptVersion` whenever the spoken script changes, and the meditation’s `contentVersion` when its source content changes. Verify that the unit is eligible for the intended duration and selected by the relevant composition recipe. Do not add script conditionals to a React component or the playback engine.

Prefer the existing content helpers, or calculate estimates with `estimateSpeechSeconds(text, type)`, so slower speech and sentence pauses are included. Edit rates and pause lengths in `speech-pacing.ts`; rendering and generated estimates share those settings.

### Add or edit a cinematic scene

A `CinematicScene` has a stable ID, title, category, version, and ordered `DialogueTurn` objects. Each turn has its own stable ID, character ID, text, duration estimate, and script version. Add a `cinematic-dialogue` unit whose `sceneId` refers to the scene; the composer treats the full exchange as one selection. Never split a scene across session boundaries or drop a reply to fit a shorter session. Author a genuinely shorter scene instead.

Character IDs are content assignments, independent of device voices. `SessionConfig.voiceAssignments` can map them to available browser voice identifiers. The player uses available browser voices when a preferred voice is unavailable; distinct voices are limited by the installed voice inventory.

### Add a meditation

Create a `MeditationDefinition` with ID, title, description, theme, exact catchphrase, availability, content status, content version, visual accent, units, and scenes. Register it with the exported content collection. Published free entries become selectable in the library; draft entries such as **I Am Lucky** stay coming soon. Do not use `availability: 'premium'` as evidence of an actual paid entitlement: billing and server-side enforcement are deferred.

### Attach a recorded audio clip

Bundle a licensed clip under `web/public/audio/`, then attach an `audio` object to the unit, variant, or dialogue turn:

```ts
audio: {
  src: '/audio/i-got-it/present-small-step-v1.mp3',
  durationSeconds: 8.42,
  scriptVersion: '1',
}
```

Measure the full audible clip, including deliberate pauses. Its `scriptVersion` must match the script it renders. An edited script remains usable with TTS while a recording is replaced. Do not silently reuse an outdated recording after a text change. Each dialogue turn can have its own clip; keep all turns in their source order. Reuse the same source scripts for a YouTube production rather than extracting dialogue from the player.

### Add a duration variant

A unit’s optional `variants` dictionary accepts `short`, `medium`, and `long` scripts, each with an estimated duration and optional version-matched recording. Write a complete thought for each variant. Adjust `minSessionSeconds` and `maxSessionSeconds` to reflect when the unit makes sense. Use a separate short cinematic scene when an exchange needs different turns. Recompose the relevant durations and check that reflection time remains meaningful.

## Resource and account configuration

Copy `web/.env.example` to `web/.env.local` only if configuration is needed. All of these links are optional and embedded at build time:

| Variable | Destination |
| --- | --- |
| `NEXT_PUBLIC_YOUTUBE_URL` | Educational or guided YouTube video/channel. |
| `NEXT_PUBLIC_FREE_WORKSHEET_URL` | Free worksheet download or landing page. |
| `NEXT_PUBLIC_WORKBOOK_URL` | Real purchase page for the $10 seven-day workbook. |
| `NEXT_PUBLIC_NEWSLETTER_URL` | Newsletter or waitlist signup. |
| `NEXT_PUBLIC_CUSTOM_MEDITATION_URL` | Custom meditation destination; defaults to the local `/custom` brief. |

Absent destinations are unavailable rather than placeholder purchase links. Only internal paths and HTTP(S) destinations are accepted. Changing these public environment variables requires restarting the dev server or rebuilding a deployment.

The worksheet should help readers name a desire, recall an emotional experience, consider a present opportunity, imagine a future feeling, and choose a concrete action. The seven-day workbook extends that practice and later reflection. The configured links connect to those products; this implementation does not pretend to create or sell them.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` enable the existing authenticated task workspace. Its code, routes, migrations, and user data remain intact. No meditation schema migration or task deletion is needed for this MVP.

## Verification and remaining scope

Run `npm test`, `npm run lint`, and `npm run build` from `web/`. Unit tests cover deterministic composition, duration/focus constraints, complete dialogue and spoken units, silence, missing audio behavior, pause/resume, cleanup, and anonymous rendering without Supabase initialization. Test real audio on iPhone Safari and desktop because a DOM simulator cannot certify device voices or audio permissions.

### Local regression checks

Automatic GitHub checks and required merge checks are deferred at the user's request. No workflow is included, and no branch-protection settings were configured as part of this work. Committing and pushing the application does not require enabling these checks. The existing regression tests remain available locally: run `npm test`, `npm run lint`, and `npm run build` from `web/` when changing the audio engine, speech pacing, player controls, or their dependencies. Use Node 22.13 or newer within Node 22, install from the lockfile with `npm ci`, and verify the free build with Supabase credentials empty.

Local tests catch reproducible scheduling, recovery, and cleanup bugs; they do not establish audible output on a phone. Keep phone listening checks alongside them. If GitHub automation becomes useful later, it can be introduced without making checks mandatory for merging. Preserve a known-working commit so an audio regression can be compared with or rolled back to that version.

### Phone audio release check

For changes to audio, speech pacing, player controls, or their dependencies, listen on a physical phone before releasing. Record the commit/build, date, phone model, OS/browser version, and output route (speaker or headphones) in test notes. Repeat on desktop; include Android Chrome when available. Passing tests or an advancing timer do not establish audible output.

1. Start fresh without signing in. In **Test background sounds**, listen to rain alone, brown noise alone, then both. Confirm both default to 75%, their volumes change independently, and both can be turned off.
2. Start the three-minute I Got It journey. Confirm the preview stops and a single ambient mix remains audible under narration, cinematic dialogue, sentence pauses, and the quiet interval. Let it finish normally; confirm all audio stops.
3. During another session, change each ambient volume and switch each layer off/on. Pause and resume during a spoken sentence and during a quiet interval. Confirm elapsed time freezes while paused and there is no overlapping or duplicated speech after resuming.
4. Restart, stop, leave the player, and begin again. Confirm no old speech or background continues. Hide/lock the phone, return, and explicitly Resume; background playback is not promised.
5. On iPhone, repeat an ambient-only test and narration playback with Silent mode enabled. Test the intended speaker/headphone route; record any route-specific failure. On browsers without Audio Session support, note if Silent mode must be off.
6. Try **Restore background sound** in the preview and during speech. Confirm recovery does not restart the session or duplicate a sentence. Record whether playback worked without Restore; recovery is a fallback, not evidence of a clean pass.

If a failure recurs, capture whether the ambient-only test was audible and whether narration caused silence, together with the device/build details. Reproduce that sequence before changing the recovery behavior. After a device OS/browser update, repeat this checklist even if application code has not changed.

Initial voices use browser TTS; professional recordings, offline/background guarantees, synchronized accounts for meditation preferences, paid AI script/speech generation, subscription billing, and entitlement enforcement are future work. Custom input is a local creative brief, not a simulated purchase or an AI service. **I Am Lucky** remains a draft. Resource links become active only when real destinations are supplied.

## Changed files

- Public routes: `web/app/page.tsx`, `web/app/layout.tsx`, `web/app/meditations/[id]/page.tsx`, `web/app/resources/page.tsx`, `web/app/custom/page.tsx`.
- Interface: `web/components/meditation/library.tsx`, `composer.tsx`, `player-view.tsx`, `ambient-controls.tsx`, `use-ambient-preview.ts`, `custom-brief.tsx`, `resource-links.tsx`, `public-shell.tsx`, `meditation.css`.
- Content and engine: `web/lib/meditation/types.ts`, `content.ts`, `defaults.ts`, `compose.ts`, `audio.ts`, `speech-pacing.ts`, `player.ts`, `saved-config.ts`, `resources.ts`.
- Account isolation: `web/app/(tracker)/layout.tsx`, `web/app/sign-in/page.tsx`, `web/app/auth/callback/page.tsx`, `web/lib/auth-context.tsx`, `web/lib/supabase-client.ts`.
- Verification: `web/__tests__/meditation-composition.test.ts`, `meditation-player.test.ts`, `meditation-mobile-audio.test.ts`, `meditation-speech-pacing.test.ts`, `meditation-public.test.tsx`, `meditation-ambient-preview.test.tsx`.
- Setup and documentation: `web/.env.example`, `web/get-ip.sh`, `README.md`, `docs/architecture.md`, and this document.

No dependencies, database tables, migrations, task data, or paid services were added or removed.

## Verification performed for this implementation

- All 339 tests pass across 17 test files, including the preserved task tests, 31 mobile ambient-audio regressions, 14 sentence-playback regressions, and five ambient-preview tests.
- Composition checks exercise every whole-second duration from 10–900 for both published meditations and every focus, plus dialogue/narration combinations at presets and boundaries.
- Production build succeeds with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` explicitly empty. Type checking passes. Lint has only the existing hook warnings in calendar, projects, and the focus-session provider.
- Browser checks covered the public library at desktop and 390px phone width, a complete three-minute I Got It session with both ambient layers and pause/resume, and a complete ten-second recall on the final build. The three-minute player reached its normal completion screen; no browser errors were reported.
- After the slower speech update, a fresh three-minute browser session with both ambient layers and Pause/Resume progressed through the sentence sequence to normal completion with no browser errors.
- On November 21, 2026, the user confirmed that rain and brown noise were audible again on their phone. The device model, OS/browser version, output route, and full checklist results were not recorded, so this is a successful listening report rather than certification across devices. Browser verification and mocked audio tests do not certify subjective voice quality or lock-screen playback.
