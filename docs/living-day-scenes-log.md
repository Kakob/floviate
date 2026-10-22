# Living Day Scenes — implementation log

**Goal of this slice:** open Floviate mid-day, see a small living scene of what you planned for this moment, and record what is actually happening, or change the plan, without being asked for anything.

## What shipped (Sept 24, 2026)

- `/today` is the landing page and the first nav tab.
- **Plan** (`day_blocks`): ordered segments of a day, each with a title, an optional intention, an optional time anchor, and a scene. Statuses are `planned`, `skipped` and `done`. `done` is set only by "I'm done with this".
- **Current scene** (`currentBlock` in `web/lib/day-scenes.ts`):
  1. A planned timed block covering now; if several overlap, the latest start wins.
  2. Otherwise, the first planned untimed block in order.
  3. Otherwise, unplanned time with the quiet room.
- **Check-ins** (`log_entries.event_kind`):
  - The user records `thought`, `started` and `changed_activity`.
  - The server writes `plan_changed`, `finished` and `skipped` as plan history.
  - Every check-in carries a server-side snapshot of the plan as it was.
- **Scene** (`components/day/living-scene.tsx` plus the `scenes.ts` registry): one SVG room with CSS loops (drifting clouds, swaying plant, breathing figure, steam, a blinking cursor on the computer). It has four presets: writing, computer, reading and quiet. It respects `prefers-reduced-motion` and can be paused.
- **Day strip:** move previous/next through the day's scenes, reorder them, open unplanned thoughts, and browse other dates.

## Consequential decisions

1. **Build on the existing draft.** A draft of this feature was already in the tree. It was hardened rather than replaced.
2. **Order first, times optional.** This settles the conflict between the July Today doc ("no clock-time planning") and the scene idea ("what I intended at this moment"). The Today doc now carries an update note.
3. **Check-ins extend `log_entries`, with no new table.**
   - This follows the Today doc's "no new logging system".
   - `session_id` and `log_type_id` became nullable. The only existing reader (`use-log-entries.ts`) queries by session, so it is unaffected.
   - A CHECK constraint keeps session logs complete.
4. **Plan history is written by a database trigger, not by the client.** An edit and its history commit atomically. Clients can't forge history, because a restrictive RLS policy allows only observation kinds and the audit trigger is `SECURITY DEFINER`. Reordering alone is not audited, to avoid noise.
5. **No completion inference.** A timed block that has ended stays `planned`; it just stops being current. The UI says "Earlier plan", never "missed" or "done".
6. **Logging ≠ coaching.** The check-in mutation has no side effects beyond the insert. `web/lib/scene-support.ts` defines `SceneSupportAdapter`, the only seam for future music and narration, and the page currently uses `silentAdapter`.
7. **No DELETE on blocks.** Skip keeps the day honest and the history intact.
8. **The scene renderer is decoupled.** `LivingScene` takes only `{ preset, paused }`. Adding a scene means adding a registry entry and possibly a prop; the Today page doesn't change.

## Scene library (added Sept 24, 2026)

- **17 scenes**, grouped in the editor:
  - Work & study: writing, computer, day trading, library/CAA, reading, music.
  - Movement: walking, running on the lakefront, biking, gym, exercising in my room.
  - Everyday: eating, smoking, bathroom, quiet.
  - Out & about: traveling by car, doctor's office.
- **Where they live:** `web/components/day/scenes/`. `primitives.tsx` holds the shared palette, the room, windows, plants, steam, scrolling scenery and the `anim()` helper. Each group has a file, and `index.tsx` is the registry.
- **Animation:** the vocabulary is in `scene.module.css`: swing, lift, puff, bob, scroll, spin, turn, rise, glow, drip, slide. Most motion is set by CSS variables on each element (`--a` angle, `--d` duration, `--y`/`--x` distance).
- **Gallery:** `/today/scenes` shows every scene side by side. The block editor links to it.
- **Adding a scene:**
  1. Add the key to `SCENE_PRESET_KEYS` in `lib/day-scenes.ts`.
  2. Draw it in `components/day/scenes/`.
  3. Register it in `scenes/index.tsx`.
  - No migration is needed. Migration `20260924120000_day_scene_keys.sql` replaced the fixed list with a key-format check, and unknown keys render the quiet room.

## Day and week planner (added Sept 25, 2026)

- **Views:** the Today page has **Scene / Day / Week** views. Scene is still the default when you open the app.
- **The grid** (`components/day/plan-grid.tsx`) is a 24-hour grid built the same way as the calendar week view:
  - Drag empty space to make a plan, drag a plan to move it (across days too), or drag its bottom edge to resize.
  - Drag an "any time" plan onto the grid to give it a time.
  - On touch screens, tapping empty space makes a one-hour plan.
- **Shared code:** lane layout moved to `lib/time-grid.ts`, and `week-view.tsx` now uses it too. The grid logic (weeks, placing, copying) is in `lib/day-planner.ts`. Save, remove and copy live in `lib/hooks/use-day-planner.ts`. Moves update the screen straight away.
- **Copying:**
  - Copy a day onto any of the next 14 days, or a week onto the next 1–8 weeks.
  - Copies are independent plans at the same wall-clock times. Skipped plans aren't copied, and copies go after anything already planned that day.
  - Each copy can be undone.
  - Recurring rules were deliberately left out.
- **Removing plans** (migration `20260925000000_day_block_delete.sql`):
  - A plan can be removed only while it has no check-ins. After that it can only be skipped, so recorded moments keep their context.
  - Removing a plan also removes its plan-change history.

## Scene-first plans (added Sept 25, 2026)

- **Making a plan is choosing a scene.**
  - "Add a plan", dragging on the Day/Week grid, and "Choose a scene for now" (shown when nothing is planned) all open the same picker (`components/day/new-plan-dialog.tsx`).
  - One click creates the plan, named after its scene.
  - "Choose a scene for now" plans the next hour from the current quarter hour.
- **Details are optional and come later.** The details editor (`block-editor.tsx`) holds the name, what you'd like from it, the time, and a scene change.
- **Names:** a plan still named after its scene keeps following the scene if the scene changes, until you give it a name of your own.

## Now view: rhythm sessions (added Oct 3, 2026)

- **Scene and Rhythm are now one tab, Now.** The tabs are Now / Day / Week / Trends.
  - Trends holds the "On this day" list and the four-week trends.
  - Pieces: `rhythm-now.tsx`, `now-stack.tsx`, `tap-bar.tsx`, `entry-panel.tsx`, `day-timeline.tsx` and `rhythm-history.tsx`.
- **A tap is a moment.** Its panel offers **Start session**.
  - In `rhythm_entries`: `ended_at = occurred_at` is a moment, `NULL` is live, and a later time is a finished session.
  - The database always inserts a tap as a moment (trigger), so only an explicit update starts a session.
- **Several sessions can run at once.** Tapping something that is already running adds a *mark* to it instead of a second entry.
  - A mark is a row in `rhythm_marks`: a timestamped note with an optional 1–5 level.
  - For a session, marks replace the single "during" slot. Moments keep before/during/after.
- **Urges:** a single tap is still "let it pass". A started urge becomes a "Craving" whose marks hold its strength.
  - It ends with "It passed" (stop, then what helped) or "I smoked", which ends it and logs the cigarette as a moment.
- **Ending a session** records when it ended, the after-feeling, "What got done" and free-text tally rows.
  - A tally row is label / amount / unit, e.g. Bench · 3x8 · 135 lb.
  - The rows prefill from the last session of the same activity and variant.
- **Variants** are sub-taps under an activity, like the urge button: Writing → Journal, Coding → Vibecode, Music → Listening.
  - A new **Exercise** activity has Gym, At home, Run, Walk and Bike, each with its own existing scene.
  - Variants are stored in `rhythm_entries.variant`.
- **The hero shows what you're doing.** When something is live (and you haven't picked a plan in the strip), the hero shows the latest live session's scene. The plan for now sits underneath, so the two can be compared.
- **The timeline** puts the plan and what was lived side by side for one day: bars for sessions (a live one grows to now), dots for taps, ticks for notes.
- **Forgotten sessions:** after 12 hours a live session shows "Still going?" with a one-tap end at its last note.
- **Trends** add time spent in finished sessions, this week against last.
- **Not built:**
  - guessing what you're doing from patterns;
  - linking a session to a plan block or a focus session;
  - user-made activities;
  - a structured workout logger with per-exercise history.

## Tests

- `web/__tests__/day-scenes.test.ts` covers current-scene rules, selection, ordering, validation, and day bounds on a DST day.
- `web/__tests__/day-planner.test.ts` covers week ranges, DST-safe times, placing blocks, copying days (times, lengths past midnight, positions, skipped plans) and lane layout.
- `web/__tests__/living-scene.test.tsx` checks that every key has a drawing, every scene renders, unknown keys fall back to the quiet room, and gradient ids stay unique when scenes share a page.
- `web/__tests__/rhythm.test.ts` and `rhythm-migration.test.ts` cover sessions: moment/live/session states, tap routing, tallies, end checks, timeline layout, and the sessions migration (backfill, insert-as-moment trigger, span checks, marks RLS).
- `web/__tests__/day-scenes-migration.test.ts` runs the real migration in pglite, with stubbed Supabase auth and pre-existing tables. It checks:
  - server snapshots on check-ins
  - plan history on edit
  - `finished`/`skipped` events, with reordering not recorded
  - forged events rejected, and other users' blocks rejected
  - legacy session logs still accepted

## Next candidates (not built)

- **Supported mode:** a real adapter for music and narration, with explicit instructions ("help me start", "don't interrupt"). Narration stops while music continues.
- **Link a block to a focus session:** `day_blocks.session_id`. Starting a focus block would launch the existing session flow.
- **More scenes:** kitchen/meal, listening to music (Listening borrows the reading nook for now).
- **Voice check-ins:** transcription.
- **Ratings on blocks:** productivity, enjoyment and adversity, as new event kinds or log types; anticipated vs. experienced value.
- **Evening review and "plan tomorrow"**, from the Today doc.
