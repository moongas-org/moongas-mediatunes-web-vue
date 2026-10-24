<img src="https://raw.githubusercontent.com/moongas-org/moongas-mediatunes-web-vue/refs/heads/main/client/public/moongas.svg" width="128" height="128">

# moongas-mediatunes-web-vue

> 🚧 **Status: Work in Progress (WIP)**  
> This project is currently under active development. Features, APIs, and documentation are subject to change.

---

## Overview

**A Deno-tooled TypeScript/Vue SPA for Moongas hybrid media collections, pairing with the separate `mediatunes-svc` backend to seemlessly blend offline and streaming playback.**

### A component of the `moongas` ecosystem of media library tools

- [moongas-collection-demo](https://github.com/moongas-org/moongas-collection-demo) [![CI](https://github.com/moongas-org/moongas-collection-demo/actions/workflows/ci.yml/badge.svg)](https://github.com/moongas-org/moongas-collection-demo/actions/workflows/ci.yml) - Example Moongas media collection (metadata only)
- [moongas-mediatunes-web-vue](https://github.com/moongas-org/moongas-mediatunes-web-vue) [![CI](https://github.com/moongas-org/moongas-mediatunes-web-vue/actions/workflows/ci.yml/badge.svg)](https://github.com/moongas-org/moongas-mediatunes-web-vue/actions/workflows/ci.yml) - A Deno-tooled TypeScript/Vue SPA for Moongas hybrid media collections, pairing with the separate moongas-mediatunes-svc-python-blacksheep backend to seemlessly blend offline and streaming playback
- [moongas-mediatunes-svc-python-blacksheep](https://github.com/moongas-org/moongas-mediatunes-svc-python-blacksheep) [![CI](https://github.com/moongas-org/moongas-mediatunes-svc-python-blacksheep/actions/workflows/ci.yml/badge.svg)](https://github.com/moongas-org/moongas-mediatunes-svc-python-blacksheep/actions/workflows/ci.yml) - Python+BlackSheep implementation of API service for Moongas hybrid media collections—backend for Moongas mediatunes web application (moongas-mediatunes-web-vue)
- [moongas-mediatunes-svc-java-javalin](https://github.com/moongas-org/moongas-mediatunes-svc-java-javalin) [![CI](https://github.com/moongas-org/moongas-mediatunes-svc-python-blacksheep/actions/workflows/ci.yml/badge.svg)](https://github.com/moongas-org/moongas-mediatunes-svc-java-javalin/actions/workflows/ci.yml) - Java+Javalin implementation of API service for Moongas hybrid media collections—backend for Moongas mediatunes web application (moongas-mediatunes-web-vue)
- [moongas-mediascan-go](https://github.com/moongas-org/moongas-mediascan-go) [![CI](https://github.com/moongas-org/moongas-mediascan-go/actions/workflows/ci.yml/badge.svg)](https://github.com/moongas-org/moongas-mediascan-go/actions/workflows/ci.yml) - Golang module to scan media collections and Moongas Yaml metatadata, outputs Moongas database
- [moongas-mediascan-python](https://github.com/moongas-org/moongas-mediascan-python) [![CI](https://github.com/moongas-org/moongas-mediascan-python/actions/workflows/ci.yml/badge.svg)](https://github.com/moongas-org/moongas-mediascan-python/actions/workflows/ci.yml) - Python library with data classes for loading Moongas mediascan databases and Yaml metadata files
- [moongas-mediascripts-python](https://github.com/moongas-org/moongas-mediascripts-python) [![CI](https://github.com/moongas-org/moongas-mediascripts-python/actions/workflows/ci.yml/badge.svg)](https://github.com/moongas-org/moongas-mediascripts-python/actions/workflows/ci.yml) - Python scripts for working with Moongas media collections.
- [moongas-mediatest-python-pytest](https://github.com/moongas-org/moongas-mediatest-python-pytest) [![CI](https://github.com/moongas-org/moongas-mediatest-python-pytest/actions/workflows/ci.yml/badge.svg)](https://github.com/moongas-org/moongas-mediatest-python-pytest/actions/workflows/ci.yml) - Python tool for enforcing media collection rules (implemented with `pytest`)

## Live Demos
- [Live Demo](https://moongas.org/mediatunes)

```mermaid
graph TD;
    A[Start] --- B(Choose Frontend and Backend);
    B --- C{Choose Backend};
    C ---|Python| D[mediatunes-svc-python-blacksheep];
    C ---|Java| E[mediatunes-svc-java-javalin];
    B --- F{Choose Frontend};
    F ---|Deno+Vue| G[mediatunes-web-vue];
    F ---|TBD| H[tbd];
    D ---|has dependency| I[mediascan-python];
    I ---|loads| J[mediascan.db];
    J ---|generates| K[mediascan-go];
    E ---|loads| J[mediascan.db];
    J ---|validates| L[mediatest-python-pytest];
    J ---|reads readonly| M[mediascripts-python];


# Quick Start

### Production

```sh
deno task build     # builds client/ to client/dist
deno task serve     # http://localhost:8000 (env: PORT, BACKEND_URL, BACKEND_URL_PREFIX)
```

### Development

```sh
deno task install   # first time only
deno task dev       # http://localhost:5173
```

### Type checking

```sh
deno task check     # runs vue-tsc on client/ and deno check on server/
```

### Player tests

```sh
deno task test      # player selection regression tests (Node.js 24+)
```

### Filter by year range

[moongas.org/mediatunes/albums?minYear=1990&maxYear=2004](https://moongas.org/mediatunes/albums?minYear=1990&maxYear=2004)

### Filter by year range and genre(s)

[moongas.org/mediatunes/player?minYear=1960&maxYear=2024&genre=Industrial+Metal&genre=Punk&genre=Punk+Rock&genre=Heavy+Metal&genre=Hip+Hop&genre=Urbano&genre=Thrash+Metal&genre=Nu+Metal&genre=Rock+en+español&genre=Funk+Metal&genre=Hip-Hop+français](https://moongas.org/mediatunes/player?minYear=1960&maxYear=2024&genre=Industrial+Metal&genre=Punk&genre=Punk+Rock&genre=Heavy+Metal&genre=Hip+Hop&genre=Urbano&genre=Thrash+Metal&genre=Nu+Metal&genre=Rock+en+español&genre=Funk+Metal&genre=Hip-Hop+français)

### Filter by artist, album and title

[moongas.org/mediatunes/player?artist=Rush&album=Grace%20Under%20Pressure&title=The%20Body%20Electric](https://moongas.org/mediatunes/player?artist=Rush&album=Grace%20Under%20Pressure&title=The%20Body%20Electric)

## Screenshots

[Screenshots](./doc/screenshots/README.md)

## Vue + TypeScript frontend (Deno + Vite)

The web UI is a single-page application built with [Deno](https://deno.com/), [Vite](https://vite.dev/), [Vue 3](https://vuejs.org/) and TypeScript:

- `client/` — the Vue SPA (all TypeScript; uses npm `d3` + `d3-cloud` for the word clouds). Routes mirror the API paths (`/albums`, `/tracks`, `/artists`, `/player`, `/genres-cloud`, etc.).
- `server/main.ts` — plain `Deno.serve` production server: serves the Vite build from `client/dist`, proxies `/api/*` and `/getfile/*` to the backend, and falls back to `index.html` for client-side routes.

The SPA consumes a JSON API (`<base>/api/config`, `<base>/api/albums`, `<base>/api/album`, `<base>/api/tracks`, `<base>/api/artists`, `<base>/api/artist`, `<base>/api/genres`, `<base>/api/artist-geo/<kind>`, `<base>/api/wordcloud/*`, `<base>/api/random-track`) and media files via `<base>/getfile/*`, where `<base>` is the public base path (default `/mediatunes`, matching the Vite `base`). The frontend strips the base prefix and proxies both to the mediatunes-svc backend at `BACKEND_URL` (default `http://127.0.0.1:5000`); the JSON API is served under `BACKEND_URL_PREFIX` (default `/api`) while media files are served at the backend root (`/getfile/<path>`, no prefix). In production, nginx routes all `/mediatunes/*` traffic (including `/mediatunes/api/*` and `/mediatunes/getfile/*`) to this frontend server.

### Explicit album covers and age verification

The albums, player, and name-that-tune views offer an **explicit cover** filter
with `true` and `false` choices. The `explicitCover=true` URL parameter includes
only albums marked explicit; `explicitCover=false` excludes those albums.
Removing the filter includes both. Filtering is performed by the backend using
album metadata, before result limits or random-track selection, and is independent
of age verification. It requires backend support for the `explicitCover` query
parameter on both `/api/albums` and `/api/random-track`.

Album grids require the boolean `explicitCover` field on each
`<base>/api/albums` result and do not need per-cover metadata requests.
The player (including "name that tune") and track listings fetch
`<base>/api/album` metadata.
Covers marked `explicitCover: true` are blurred unless
the user has revealed that cover, or both age verification and automatic unblurring
are remembered. Image space is reserved while each image
and its metadata load; artwork is shown only once its blur state is determined.
The blur filter is applied only when `explicitCover` is exactly `true`, never
while metadata is pending or for non-explicit covers. If metadata fails, the
image is shown without blur; failures are logged and shown in the cover's tooltip.
The album grid starts covers in display order with up to six covers loading
concurrently. Image downloads and any required metadata requests run in parallel;
each completed cover starts the next without waiting for animation frames.
Failed images or metadata requests release their loading slot.
Backends must provide the list's boolean `explicitCover` field and the album
metadata endpoint for player and track views.

The age-verification dialog never opens automatically, regardless of the backend's
`ageVerification` setting. Clicking or keyboard-activating a blurred cover opens
the dialog instead of navigating to tracks or minimizing player details.
Cancel dismisses it without revealing the cover; declining still exits the site.
Clicking **Yes, I am 18+** saves `ageConfirmed=true` and opens a second dialog
with an **Automatically unblur explicit album covers** checkbox (unchecked by
default) and an **Unblur** button. Age verification alone does not reveal any art.

Clicking **Unblur** with the checkbox unchecked reveals only the clicked cover.
Other covers remain blurred, and individual reveals are not persisted: covers
are blurred again after a reload or when the displayed album changes.
Subsequent blurred-cover clicks skip the age question and open the second dialog
directly, including after a reload. Checking the box and clicking **Unblur**
reveals all explicit covers and remembers automatic unblurring across reloads.
The `autoUnblurExplicitCovers` cookie stores the checkbox choice independently
of age verification; existing age cookies without this preference do not enable it.
Both cookies last one year, are scoped to the app's base path, and use
`SameSite=Lax` and `Secure` on HTTPS.
Existing local-storage confirmations are not used in place of the cookie.
The explicit-cover blur applies regardless of the backend's age-verification setting.
This is a visual content warning, not access control for the underlying media files.

### Play history

Local playback uses Howler.js in Web Audio mode, downloading and decoding each
track before playback so seeking works even when the media backend does not
support HTTP byte-range requests. This can increase startup time and memory
usage for large tracks. Howler falls back to HTML5 audio on browsers without
Web Audio support; reliable seeking in that fallback requires the backend to
support byte ranges (`206 Partial Content`).
The player includes
play/pause, a seekable progress bar with elapsed and total time, and volume
control. Restart and clicking the track title control the same playback engine.
Audio is unloaded when switching tracks or leaving the player. Load and playback
errors (including blocked autoplay) are displayed with a Play-to-retry action.
Next, Previous, and automatic advancement retain the history and filter fallback
behavior below. Playback controls are hidden when local playback is disabled.

The player and "name that tune" share a history of played tracks, stored in the
`playHistory` cookie (one year, scoped to the app's base path, `SameSite=Lax`,
`Secure` on HTTPS). Because cookies are limited to about 4 KB, only the most
recent tracks (typically around ten) are kept; the oldest are dropped first.

- **Previous** (left of Restart) goes back one track in the history and is
  disabled at the oldest remembered track.
- **Next** (and the end of playback) goes forward through the history when
  replaying earlier tracks, and loads a new random track once the latest track
  is reached. Loading a new track while earlier in the history discards the
  tracks after the current one.
- The player resumes the most recently played track when opened without
  filters, or with the same filters that track was loaded with; any other
  filters load a new matching random track. With no history, a random track is
  loaded.
- "Name that tune" always starts with a new random track.

When a random selection returns the currently loaded track, the player retries
without the **title** filter, then without **album**, then removes the remaining
filter arguments one at a time in URL order. Repeated values for a filter are
removed together. Once a different track is found, the URL and filter controls
are updated to the relaxed query using browser-history replacement; the
`hints` flag is preserved. Next and automatic advancement skip consecutive
copies of the same file in older play histories.

With no filters left, the player makes at most **10 unfiltered attempts** to
find a different track. If none is returned, or an API request fails, it shows
an error instead of repeating the current track. The current audio is left
intact (so it can finish if still playing); Next can be used to try again.

### Runtimes

- **Node 24+** runs the client toolchain: `deno task install` (dependency install), `dev`, `build`, and `check` (vue-tsc) all execute under Node.
- **Deno** runs the production web server, `server/main.ts` (`deno task serve`).

## Features

- Simple minimalist web interface
- Perfect for a party jukebox hosted on your home WiFi network
- Multiple playback options (configurable):
    1. Play local media files in the browser (using HTML5 `<audio>` tag)
    2. "Play" by opening YouTube search for _"(artist) (album) (title) video"_ (configurable)
        - Great for finding music videos of your favorite music
        - Great for creating YouTube playlists of music videos meeting certain filter criteria (e.g. 80s New Wave music videos for your 80s party)
        - IMHO mediatunes + YouTube premium (no ads) is better than YouTube Music or Spotify
    3. (Default) Display both options
- Album art displayed at a beautiful `1000x1000px` resolution
    - (bandwidth optimized by converting to `.webp` at 80% quality if hosted by yours truly)
- Continuous shuffle playback with filtering options
- Fast (tested with a library of 20,000+ music files)
- Versatile filtering and sorting via a common set of intuitive url parameters
- Comprehensive browsing options—browse by _artist_, _album_, _genre_, _year_, _year range_, and more
- _Name That Tune_—plays a song without displaying the info, but offering hints, challenging the user to name the artist/tune
- Direct download of music files via hyperlinks
- Accessible from mobile devices (tested in Chrome on Android)


## Limitations

- Doesn't work with some `.m4a` files
    - Error: html5 audio element can't decode
- Requires that your music library be scanned with [moongas-mediascan-golang](https://github.com/moongas-org/moongas-mediascan-golang)
    - `moongas-mediascan-golang/cmd/mediascan-db` scans your music library and outputs a `mediascan.db` file
    - This must be repeated to update the music library (e.g. add new files)
    - Album art may be extracted (and converted to .webp) using the mediascan copy covers script
    - I cannot share my music files, of course, as they are copyrighted, but I can share my mediascan database with over 20,000+ tracks, allowing you to browse my extensive and painstakingly organized music library (with accurate tags, genre and year) and _play_ any track by opening a YouTube search for it. 
- Requires that music library be organized with the directory and file structure that Moongas expects
    - For example:
        - Artist folders containing album folders with `cover.jpg` (or `cover.webp`) files
        - Music filenames do not contain prohibited characters such as `+`
    - You can enforce these requirements by testing your music library with Moongas [mediatest](https://github.com/moongas-org/moongas-mediatest-python-pytest)

## Coming soon

- Play entire albums
- Playlists
- Sort by modified time

## Dependencies

- [moongas-mediatunes-svc-python-blacksheep](https://github.com/moongas-org/moongas-mediatunes-svc-python-blacksheep) [![CI](https://github.com/moongas-org/moongas-mediatunes-svc-python-blacksheep/actions/workflows/ci.yml/badge.svg)](https://github.com/moongas-org/moongas-mediatunes-svc-python-blacksheep/actions/workflows/ci.yml) - Python+BlackSheep API service for Moongas hybrid media collections—backend for Moongas mediatunes web application (moongas-mediatunes-web-vue)

## Installation

### Scan your music library with moongas-mediascan-golang

- Modify the mediascan config (`mediascan-config.yml`) values (`mediadirs` etc.) as needed
- Run the `scantodb` command (requires [go](https://go.dev/doc/install))
```bash
cd moongas-mediascan-golang
go run cmd/mediascan-db mediascan-config.yml ../mediascan.db
```

### Install the web app from GitHub source

- Clone the repo
```bash
git clone git@github.com:moongas-org/moongas-mediatunes-web-vue.git
cd moongas-mediatunes-web-vue
```
- Install client dependencies and build the SPA
```bash
deno task install
deno task build
```
- Run the web server
```bash
deno task serve
```

### Automatically start and run as a SystemD service

A systemd unit is provided for the web frontend:

- [`mediatunes-web.service`](./mediatunes-web.service) — the Deno web frontend (serves the Vue SPA)

To set it up:

- Customize the .service file as required
- Build the frontend with `deno task build` (so `client/dist` exists)
- Update [`mediatunes-web.service`](./mediatunes-web.service): set `ExecStart` to the output of `which deno` on the host
- Copy the `.service` file into the systemd system folder to install it as a systemd service
```bash
sudo cp mediatunes-web.service /etc/systemd/system/
cd /etc/systemd/system
sudo chmod 644 mediatunes-web.service
```
- Enable the service with `systemctl enable`:
```bash
sudo systemctl enable mediatunes-web.service
```
- Start the service
```bash
systemctl start mediatunes-web
```
- Use `systemctl status` to verify that `mediatunes-web` is running
```bash
systemctl status mediatunes-web
```
- If you make changes to the unit file, use the `systemctl daemon-reload` command to force systemd to reload it
```bash
systemctl daemon-reload
systemctl restart mediatunes-web
```
- Once you have it set up to run as a service, re-scanning your library is as easy as this:
```bash
cd moongas-mediascan-golang
go run cmd/mediascan-db ../mediascan-config.yml ../mediascan.db
sudo systemctl restart mediatunes-svc
sudo systemctl restart mediatunes-web
systemctl status mediatunes-svc
systemctl status mediatunes-wen
journalctl -b -f -u mediatunes-web
```
- Use `-u` to specify the unit by name (`mediatunes-web`)
- Use `-f` to follow the log so you can watch the server startup
- Use `-b` to only show output since last boot (avoids showing old output)

## Nginx Configuration

You will need to add something similar to this to your Nginx site config:

Simplest:

```bash
    # Everything under /mediatunes/ (SPA, assets, /mediatunes/api/*, and
    # /mediatunes/getfile/*) is handled by the frontend server on :8000,
    # which serves static files and proxies api/getfile to the backend on :5000.
    location /mediatunes/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```

More efficient:

```bash
    # API + media: strip the /mediatunes prefix and send straight to the
    # backend (mediatunes-svc on :5000), which serves /api/* and /getfile/*
    # at its root. The trailing URI on proxy_pass replaces the matched prefix:
    #   /mediatunes/api/config     -> /api/config
    #   /mediatunes/getfile/x.mp3  -> /getfile/x.mp3
    location /mediatunes/api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /mediatunes/getfile/ {
        proxy_pass http://127.0.0.1:5000/getfile/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Everything else under /mediatunes/ (SPA HTML, JS/CSS assets, client-side
    # routes) goes to the frontend server on :8000. No URI part on proxy_pass,
    # so the /mediatunes prefix is preserved and the Deno server strips it.
    location /mediatunes/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

```
