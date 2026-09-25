# Codec redesign

Visual redesign of the MGS soundboard, themed after the in-game codec screen:
mobile-first, with a three-column layout on desktop. Audio playback logic is
reused as-is; the interface above it is rebuilt.

## Goals

- On phones the app reads as a native app: fixed chrome, one scrolling region,
  bottom tab navigation, installable.
- On desktop everything is visible at once, in three columns, with no navigation.
- The visual language is the MGS codec: phosphor green on near-black, monospace
  type, scanlines, hairline panels.
- Theming is centralised. Swapping the palette (e.g. to the CMON rulebook's
  black/grey/red) is an edit to one file.

## Non-goals

- No new audio features (no `show_if` authoring, no offline audio, no keyboard
  shortcuts).
- No changes to the data JSON schema or the deploy setup.
- No i18n. The UI stays in English, matching the audio and the data labels.

## Design tokens

`src/styles/theme.css` declares every colour, font and metric on `:root`.

| Token | Value | Use |
|---|---|---|
| `--codec-bg` | `#050d05` | Screen background |
| `--codec-panel` | `#0a180a` | Panels, rows, inactive buttons |
| `--codec-panel-hi` | `#0f2a0f` | Pressed and active surfaces |
| `--codec-fg` | `#7be03c` | Primary text, active borders |
| `--codec-dim` | `#62b84a` | Secondary text and icons |
| `--codec-line` | `#2a6b2a` | Hairlines and dividers |
| `--codec-alert` | `#e24b4a` | Alert state accent |
| `--font-display` | Share Tech Mono | Headers, stage names, readouts |
| `--font-body` | IBM Plex Mono | SFX labels and long strings |
| `--tap-min` | `44px` | Minimum touch target |
| `--bar-h` | `56px` | Tab bar height |

Component CSS consumes these variables only; no hardcoded colours live outside
`theme.css`. Class names follow BEM-like conventions (`.tab-bar__item--active`).
Scrollbars are restyled globally in `index.css` so native white bars never break
the screen.

## Layout

Breakpoint: `min-width: 900px`, read through `hooks/useMediaQuery` so the two
layouts are separate render branches rather than CSS overrides.

### Phone

```
app                 height: 100dvh, flex column, env(safe-area-inset-*)
├── CodecHeader     140.85 frequency, title, settings trigger
├── main            the only scrolling element; one view at a time
│   └── StageSelector | OverrideButtons | SfxButtons
├── NowPlayingBar   shown while a stage is loaded
└── TabBar          Stage / Events / SFX
```

### Desktop

```
app
├── CodecHeader
├── main (grid 1.1fr / 0.9fr / 1.5fr)
│   ├── column: Mission select   → StageSelector
│   ├── column: Stage overrides  → OverrideButtons
│   └── column: Sound effects    → SfxButtons grouped
├── NowPlayingBar
└── (no TabBar)
```

Each column scrolls independently. `SfxButtons` renders the same way in both
layouts: every category with its heading, one under the other. Categories are
never hidden behind a second level of tabs — during a game the player scans for
a sound, and a chip row would hide three quarters of the board.

### Views

**StageSelector** is a list of pressable rows, not a `<select>`. Tapping a row
plays that stage; tapping the active row stops it.

**OverrideButtons** renders the applicable overrides as full-width buttons.
Pressing the active override toggles it off: the stage resumes where it was
paused, or, with no stage loaded, everything stops. The active button is marked
(`aria-pressed`, `--active` styling, "Playing" tag) so the second press is
discoverable.

**SfxButtons** lists every category in order, each with a heading and a grid of
two columns on a phone. Buttons render an icon plus the label,
and each button carries its own progress fill: a `scaleX` layer behind the
content, in `currentColor` at low opacity, so it follows the alert palette for
free. `playSfx` returns the ids it started and the button polls
`getSfxProgress` on `requestAnimationFrame`, writing the transform straight to
the DOM — re-rendering every button 60 times a second would cost far more than
the animation is worth, and rAF pauses itself in the background.

The fill tracks real playback, never an estimated duration: a clip still
arriving from archive.org shows a dim pulsing state instead of a bar that runs
ahead of the audio. A clip that never starts is dropped after 20 seconds.

The bottom tab bar marks the active tab with a top rule and a panel background,
not colour alone, which the scanline layer washes out.

**NowPlayingBar** shows the stage, a progress line, and Resume (during an
override), Restart and Stop. Status is `Transmitting` while audio plays,
`Standby` while an override has parked the stage, and `Buffering` before a
remote track has started. The bar disappears only on Stop.

### Icons

`react-icons` with the Game Icons set (4040 icons), mapped in `utils/icons.js`:
by id for the specific effects and overrides, by `sfx-guard-` / `sfx-damage-`
prefix for the two families, with a generic fallback so new entries in the data
JSON never render broken. Game Icons is the set that covers weapons, grenades
and melee, which generic icon libraries omit. Cost: roughly 20 kB gzipped.

`utils/label.js` strips emoji from data labels at render time; the JSON keeps
them, the codec interface does not show them.

### CRT layer

`CrtOverlay` is one absolutely positioned, `pointer-events: none` element over
the shell: scanlines (`repeating-linear-gradient`, 4px period) plus a radial
vignette. Accent text gets a soft `text-shadow` glow.

Toggled by `data-crt="on|off"` on `<html>`, persisted in `localStorage` under
`mgs-crt`, exposed as a switch in settings. Under `prefers-reduced-motion` the
view-change animation is dropped; the static scanlines remain.

### Alert state

When the active override is `override-alert`, `App` sets `data-state="alert"` on
`<html>`. `theme.css` redefines the palette under that attribute, so the whole UI
turns red without any component knowing about it.

## Codec header

The header reproduces the in-game codec screen: a portrait on each side and,
between them, the frequency display with VOLUME above and SETTINGS below.

- **Portraits** are vector drawings, not images: the codec frames reduced to
  two tone bands, smoothed hard and traced with potrace, then painted in
  `currentColor` so they follow the palette, alert state included. Detail is
  deliberately low — they read as codec frames rather than as portraits of the
  characters. Nothing is fetched at runtime and no bitmap ships with the app.

- **The meter** reuses the ramp geometry from christabor/metal-gear-codec
  (MIT, Chris Tabor), recoloured to `currentColor` and split into an off layer
  and a lit layer clipped bottom-up by the master level. Its box keeps the
  original 113.949 x 67.502 proportion — stretched, it stops reading as the
  codec.
- **140.85** is fixed set dressing: in the game it is the channel, here it
  never changes. The level is read from the bars.
- **Minus and plus** step the master volume by 5%, and an invisible range input
  over the display carries drag and keyboard support. Steps read the latest
  value from a ref, because repeated taps land within one render.
- **SETTINGS** opens the settings panel, replacing the gear icon.

## Mixing

Music and effects are separate channels, because the right balance depends on
the speakers: a laptop tends to bury the guard voices under the music, a
bluetooth speaker does the opposite.

A master level sits over both channels: the codec dial scales music and effects
together and leaves the balance between them untouched, stored under
`mgs-master-level`.

Each sound keeps the base volume it declares in the data (music tracks sit at
0.25 so they stay under the voices). A channel level multiplies that base, so
the authored mix is preserved and the sliders only shift the balance between the
two groups. Levels and mute flags persist per channel under `mgs-volume-music`,
`mgs-volume-sfx`, `mgs-muted-music` and `mgs-muted-sfx`, falling back to the old
single `mgs-master-volume` for anyone upgrading. The global `Howler.volume()` is
no longer used.

Both sliders live in the settings panel, under Mix. The header keeps only the
frequency, the title and the settings trigger, which buys back around 60px of
vertical space on a phone.

Volume controls seed their state from the service and write only on user
input. An effect that applied state on mount would push the first render's
defaults into the service and persist them, wiping the stored mix every time
the settings panel opened.

Note when reading playback state back: Howler queues `volume()` on a track that
is not loaded yet and its getter keeps reporting the old value until the file
arrives. The queued value is applied on load, so this is a reporting lag, not a
lost setting.

## Audio service

Playback behaviour is unchanged. Three methods were added:

- `getPlaybackState()` — read-only snapshot for the now playing bar.
- `clearOverride(stages)` — resume the parked stage, or stop cleanly when no
  stage is loaded.
- `stop()` — full stop: music, effects already sounding (`stopAllSounds`) and
  pending ones, clearing `currentStage` so the bar empties.

`OverrideButtons` and `SfxButtons` subscribe to `onOverrideUpdate` instead of
polling on a 500 ms `setInterval`, which is what the original code did. The bar
still samples every 500 ms, because playback position has no event to listen to,
but it stops sampling while `document.hidden` is true.

`SfxButtons` holds no selection state, so the remount caused by keying `<main>`
on the active tab costs nothing.

## PWA

`manifest.json` in `standalone`, portrait, `#050d05` for theme and background;
generated 192/512 icons replacing the CRA defaults; `viewport-fit=cover`,
`apple-mobile-web-app-capable`, and `touch-action: manipulation` to suppress
double-tap zoom.

## Reloading data

`loadSounds` stops playback and unloads every existing Howl before building the
new ones. Replacing the map alone leaves whatever is playing running from an
instance nothing references, out of reach of stop(), until the page is
reloaded. `App` clears the selected stage at the same time, so the list does not
keep marking a stage that is no longer playing.

## Load errors

`onloaderror` now keeps the browser's MediaError code instead of discarding it,
and `handleLoadError` decides what the player sees:

- **1, aborted** — we cancel downloads ourselves every time the stage changes
  mid-load, so this is noise, not a failure. Logged at debug level only.
- **2, network** — one silent retry a second later if that stage is still the
  one selected; remote archives drop connections often enough to be worth it.
  A second failure surfaces the toast.
- **3 and 4** — reported straight away; a retry will not fix a bad source.

The toast now carries the code, so a report of "it keeps failing" can be told
apart from a cancelled download without guessing.

## Known limitations

Stopping a sound effect in the same tick it was triggered does not take: Howler's
HTML5 audio registers the instance a few milliseconds after `play()`, so a `stop()`
arriving at 0 ms is lost while one at 20 ms works. Reaching that window by hand is
not realistic, so there is no workaround in the code.

Data edited through the settings panel is only checked for its four top-level
sections. Entries missing an `id` no longer break the app — icons fall back to a
generic one and React keys fall back to the index — but they cannot be played.

## Accessibility

- `--codec-fg` on `--codec-bg` is roughly 12:1; `--codec-dim` carries no
  essential-only information.
- The tab bar is a `<nav>` with `aria-current` on the active tab; toggles expose
  `aria-pressed`; icon-only controls carry `aria-label`; icons are
  `aria-hidden`.
- Focus rings are visible, not suppressed.
- The settings dialog moves focus into itself on open, traps Tab, closes on
  Escape and returns focus to the trigger.

## Verification

Manual, in the browser at 375×812, 430×932 and 1280×860:

- No horizontal scroll at any width; the shell matches the viewport height.
- Stage playback confirmed by progress advancing against the track duration.
- Alert turns the UI red; pressing the active override restores the stage.
- Stop empties the bar and clears the active row.
- The CRT switch persists across reloads.
- `CI=true npm run build` compiles with no warnings.

The repository has no test suite, so there is nothing automated to run.
