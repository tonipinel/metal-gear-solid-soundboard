# Metal Gear Solid soundboard

A web app to play sounds during a Metal Gear Solid by CMON play session, with a
codec-styled interface. Fork of [wikiti/metal-gear-solid-soundboard](https://github.com/wikiti/metal-gear-solid-soundboard).

**https://tonipinel.github.io/metal-gear-solid-soundboard**

The original app, its data file and its audio sources are Daniel @wikiti's work.
This fork adds a mobile-first reskin and a set of playback fixes.

## What this fork changes

Interface, themed after the in-game codec screen:

- Mobile-first: fixed header, one scrolling view, bottom tabs, installable as a
  PWA. On desktop the three sections sit side by side instead.
- A codec header with the frequency display doubling as the master volume, and
  portraits drawn as posterised vector traces — no imagery is bundled or fetched.
- Stages as a pressable list, effects grouped by category with icons, and a now
  playing bar with resume, restart and stop.
- The alert event turns the whole interface red.

Playback:

- Separate volume for music and effects on top of a master level, so the mix
  authored in the data file survives and only the balance changes.
- A stop control, a progress fill inside each effect button, and an activity
  indicator while a track downloads.
- Fixes for playback that could not be stopped after reloading data, a crash on
  stages pointing at a missing track, polling replaced by subscriptions, and
  load errors that no longer hide their cause.
- Audio works on iOS, which needs Web Audio, a real sound played inside a tap,
  and deferred decoding. See [docs/codec-redesign.md](docs/codec-redesign.md).

## Audio and ownership

No audio is stored here. Every sound streams from the same external archives the
original app uses. All Metal Gear Solid audio, characters and related media are
property of Konami. This is an unofficial fan project, not affiliated with or
endorsed by Konami.

The volume meter geometry comes from
[christabor/metal-gear-codec](https://github.com/christabor-archive/metal-gear-codec)
(MIT, Chris Tabor).

## Development

A regular React app: check `package.json` for commands.

`npm start` runs it locally, `npm run build` produces the bundle, and
`npx gh-pages -d build` publishes it.

Useful while debugging audio: `localStorage.mgs-force-engine` set to `webaudio`
or `html5` forces an engine, and Settings shows a live diagnostics block.

## Contributors

The original app was developed by Daniel @wikiti, with the help of Eric @Zypzu
and other BGG community members. Codec skin and playback fixes by
[Toni Pinel](https://github.com/tonipinel).
