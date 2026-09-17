# Ableton Now Playing

**Your current Ableton Live track, on your OBS stream. Free and open source.**

A lightweight Mac app for DJs who perform in Ableton Live's Session View. It sends the names of playing clips to a complete, styled OBS Browser source. No Terminal, CSS editing, Node installation, or separate AbletonOSC download needed for the Mac release.

Created by **Liteyear Design**. Independent software; not affiliated with Ableton or OBS.

## Download

Open this repository's **Releases** section and download **Ableton-Now-Playing-Mac-v1.0.0.zip**. The release ZIP is the ready-to-use app. GitHub's **Source code** downloads are for developers and do not include the Mac runtimes.

## Setup

1. Extract the release ZIP and drag **Ableton Now Playing.app** into **Applications**.
2. Open the app and follow the four-step setup wizard.
3. Install the bundled AbletonOSC script, then select **AbletonOSC** in an unused Control Surface row in Live's MIDI settings. Set that row's Input and Output to **None**.
4. Select your DJ tracks in the wizard and save.
5. Add one **Browser** source in OBS using the settings below. All styling is included.

| OBS setting | Value |
| --- | --- |
| Local file | Off |
| URL | `http://127.0.0.1:3210/overlay.html` |
| Width | `1100` |
| Height | `180` |
| Use custom frame rate | On, `1 FPS` |
| Shutdown source when not visible | On |
| Custom CSS | Leave at OBS's default |

Click **Show test card in OBS for 20 seconds** in the wizard to verify the source before playing music. Close the setup tab while streaming. Open the app again and click **Stop widget** after your set.

See [INSTALL.md](INSTALL.md) for the full guide and troubleshooting.

## Features

- One pre-styled charcoal-and-cyan widget with a transparent outer background.
- Four-step setup wizard, AbletonOSC installation button, and custom User Library chooser.
- Select up to 16 Session tracks; show the latest launched clip or all playing selected clips.
- Optional `Artist - Title` splitting and custom subtitle.
- Hide when playback stops; exclude muted tracks.
- Connection recovery and a 20-second test display.
- Intel and Apple Silicon runtimes bundled in one Mac download.
- No analytics, accounts, cloud service, or audio capture.

## Requirements

- macOS 11 or newer, Intel or Apple Silicon.
- Ableton Live 11 or newer, using Session View.
- OBS Studio with Browser source support.
- Only one AbletonOSC bridge using reply port 11001 at a time.

The Mac app is unsigned and not notarized. macOS may require **System Settings → Privacy & Security → Open Anyway** on first launch. The app does not disable security settings, start at login, or install a background login service.

## How it works

AbletonOSC exposes clip and transport state over local OSC. This app subscribes to changes and checks slowly for missed updates. The browser receives changes through Server-Sent Events. There are no scrolling titles, animated meters, playback-position scans, or progress bars.

Titles come from **Session clip names**. This is not audio recognition. The latest launched deck can appear before it is audible: crossfader position, solo, cue routing, and volume are not monitored. Check selected track numbers after rearranging tracks or loading another Live Set. Very long titles are clipped visually to fit the card.

The widget runs entirely on this Mac: HTTP on `127.0.0.1:3210`, outgoing OSC to `127.0.0.1:11000`, incoming OSC on `127.0.0.1:11001`. Configuration writes require a local setup token and matching origin. Do not expose these ports to the Internet.

OBS Browser sources have their own CPU and memory overhead. Use 1 FPS, close the setup preview, and measure performance on your streaming Mac. No universal CPU percentage is promised.

## Development

Requires Node.js 22+ and Python 3.9+ to run tests and build releases. Runtime JS has no npm dependencies.

```sh
npm test
python3 scripts/build-mac.py
```

The build script downloads pinned official Node.js 22.23.2 archives, verifies SHA-256 hashes, and bundles only the executable and license for each architecture. AbletonOSC's source snapshot is included in `vendor/` with its license. Build output is in `dist/`; runtime binaries are release assets, not repository content.

To run the bridge from source on a development machine:

```sh
node app/server.js
```

Open `http://127.0.0.1:3210/`. Source mode stores configuration beside `app/server.js`; the Mac app stores it under `~/Library/Application Support/Ableton Now Playing/`.

## Validation

The original personalized build was confirmed working in a real Mac/Ableton/OBS setup. The generic edition retains its playback and setup behavior, with generic names, separate settings, and a neutral theme. Automated OSC tests cover launches, mute, transport stop, multiple decks, dropped replies, stale replies, reconnects, malformed packets, configuration checks, unchanged-state writes, and clean shutdown. The generic release still benefits from testing across more Macs and Live/OBS versions.

## License and credits

Widget code: [MIT](LICENSE), copyright 2026 Liteyear Design.

Includes [AbletonOSC](https://github.com/ideoforms/AbletonOSC) by Daniel John Jones and contributors (MIT), its bundled python-osc code (Unlicense), and official [Node.js](https://nodejs.org/) runtime binaries in releases. See [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt) and the component license files.
