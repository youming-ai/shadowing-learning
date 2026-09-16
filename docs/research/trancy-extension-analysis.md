# Trancy Chrome Extension — Technical Breakdown

**Subject:** `Trancy - AI Translator & Dual Subtitles`, Chrome extension ID `mjdbhokoopacimoekfgkcoogikbfgngb`.
**Artifact analysed:** CRX **version 7.9.3** (CRX3, 5,813,079 bytes, 129 files, ~13 MB extracted).
**Audience:** the engineering team building this repo's YouTube-only shadowing app. This document answers *how Trancy is built*, not *what it is worth copying commercially*.

> **Companion document.** `docs/research/trancy-competitive-analysis.md` covers positioning, pricing, and product gaps, and explicitly lists *"I did not install or inspect the extension bundle"* as a research gap. This document closes that gap. Where the two overlap, this one is read from shipped code.

> **IP boundary (read this first).** Trancy's bundle is third-party proprietary code. It was downloaded to `/tmp/trancy-ext` (outside this repository), inspected read-only, and **never copied, vendored, committed, or pasted into this repo**. Everything below is extracted *facts*: field names, endpoint shapes, numbers, string identifiers, and structural description, paraphrased. Short identifiers are quoted because they are the evidence; no source blocks are reproduced. Nothing in the "reuse as ideas" section is a licence to copy their code.

---

## 0. Method and evidence tags

| Tag | Meaning |
|---|---|
| **[C]** Confirmed | Read directly out of the shipped bundle, its `manifest.json`, or a first-party Trancy doc. Filename cited. |
| **[I]** Inferred | My reasoning from confirmed facts. Not stated by Trancy and not proven by the code. |
| **[?]** Unknown | Could not verify from anything I inspected. |

**Primary sources actually inspected**

| # | Source | Kind |
|---|---|---|
| S1 | `https://clients2.google.com/service/update2/crx?...id=mjdbhokoopacimoekfgkcoogikbfgngb` → CRX 7.9.3 | Chrome Web Store update endpoint (first-party distribution) |
| S2 | `manifest.json` | shipped bundle |
| S3 | `assets/background.js` (316,395 B) | shipped bundle |
| S4 | `assets/edvideo-main.js` (2,213,635 B) | shipped bundle |
| S5 | `assets/edreader-main.js` (2,173,120 B) | shipped bundle |
| S6 | `assets/ld-main.js` (2,706,638 B) | shipped bundle |
| S7 | `assets/tagger-main.js` (1,978,079 B) | shipped bundle |
| S8 | `assets/romanize-main.js` (471,231 B) | shipped bundle |
| S9 | `assets/edvideo-onload.js`, `assets/edvideo.css` (278,421 B), `assets/edreader.css`, `_locales/*/messages.json` | shipped bundle |
| S10 | `manual.trancy.org` pages (Markdown via `.md`, indexed by `llms.txt`) | first-party manual |

**Secondary sources used: none.** No CRX mirror, no blog, no third-party teardown. Every claim below comes from S1–S10.

**Caveat inherited from the companion doc:** Trancy's manual is AI-assisted and contains unresolved `EDITOR TODO` notes, so its fine detail is treated as directional. Where the manual and the bundle disagree, the bundle (§0 of this doc) wins.

---

## 1. How it is built

### 1.1 Bundle anatomy

Five large webpack bundles plus a small bootstrap, one service worker, two injected stylesheets. **[C]** (S2, S9)

| File | Size | Role |
|---|---|---|
| `assets/background.js` | 316 KB | MV3 service worker. Redux store, persistence, all provider/backend network calls, RPC hub. |
| `assets/edvideo-main.js` | 2.21 MB | The video player product: subtitle acquisition, the bilingual overlay, the in-player panels. |
| `assets/ld-main.js` | 2.71 MB | Learning-deck UI (sliders/dashboard injected into pages). |
| `assets/tagger-main.js` | 1.98 MB | Full-page immersive translator (web-page text). |
| `assets/edreader-main.js` | 2.17 MB | Reader mode + word/sentence tooling on arbitrary pages. |
| `assets/romanize-main.js` | 471 KB | Client-side romanization module (`window.romanize.{ja,ko,zh}` + `ja.toRomaji`). |
| `assets/edvideo-onload.js` | 2.4 KB | The bootstrap. Its whole job is described in §1.2. |
| `assets/edvideo.css` / `edreader.css` | 278 KB / 227 KB | Global injected stylesheets. |
| `assets/edvideo.js`, `edreader.js`, `eduser.js` | 0 B | **Deliberately empty placeholder files.** **[C]** |

### 1.2 Execution model — this is the most important structural decision

The extension runs the heavy UI **inside the page's main world**, not in a content script. **[C]** (S9 `edvideo-onload.js`)

The bootstrap content script (`run_at: document_start`, `all_frames: true`) does three things:

1. Creates a **Trusted Types policy** (`trancy-inject-policy`), warns and degrades if a page's Trusted Types CSP blocks it, then creates `<script type="module" src=chrome.runtime.getURL(...)>` elements and prepends them to `document.documentElement` for `edvideo-main.js`, `romanize-main.js`, and `ld-main.js`. Loading as ES modules is what escapes the page's `script-src` restrictions. **[C]** **[I]** for the CSP rationale.
2. Installs a **`window.postMessage` bridge** in both directions: `{eventName: "message:background"}` is forwarded to `chrome.runtime.sendMessage`, and `chrome.runtime.onMessage` payloads are re-broadcast into the page as `{eventName: "message:content"}`. **[C]**
3. Owns **hotkey capture**: it attaches `keydown` in the *capture phase* on both `window` and `document` (so it wins against the page's own handlers) and posts a normalised key event into the page world. `hotkeys-install` / `hotkeys-uninstall` messages toggle this. **[C]**

Why this matters: the page world is where the player objects live — `window.netflix.appContext...`, YouTube's player API, Disney's `disney-web-player` element, and the ability to monkey-patch `XMLHttpRequest`, `fetch`, `JSON.parse`, and `JSON.stringify`. **All five XHR/fetch interception and monkey-patching techniques in §2 are only possible from the main world.** **[I]**

**Two transports coexist in the same bundle. [C]** `edvideo-main.js` contains both a transport class that talks to `chrome.runtime.sendMessage(chrome.runtime.id, ...)` directly (guarded on `chrome.runtime.id` existing, with "Extension context invalidated" handling) *and* a transport class that posts `{eventName:"message:background"}` via `window.postMessage`. `ld-main.js` is loaded **twice** — once as a declared content script (isolated world, all URLs) and once injected as a page-world module on the 20 video hosts — which is why the bundle has to be world-agnostic. **[C]** for the double load and the two transports; **[I]** for the reason.

### 1.3 Background service worker

`assets/background.js` is an MV3 service worker and the single privileged node: **[C]** (S3)

- A **Redux store**, with a hand-rolled RPC hub class (`{from, to, name, body, uuid, tabid}` envelopes, targeted at specific tabs, `sendMessageWithRetry` with backoff up to 10 attempts).
- **All** provider and backend `fetch` calls. Content scripts never hold API keys or user tokens in a form they use directly; they ask the background to perform the call.
- 19 RPC handler names registered on that hub: `closeWindow`, `createWindow`, `dispatch`, `edvideo:embed`, `forward`, `getCommands`, `getState`, `getStateChunks`, `nativeMessage`, `open`, `rebuildContextMenus`, `reload`, `reloadExtension`, `request`, `runtime`, `shortcut`, `toggle`, `track`, `translateWithEngine`. **[C]**
- `getStateChunks({only, exclude})` lets a page ask for just the state slices it needs (e.g. `translatorService`). **[C]**
- A `chrome.contextMenus` rebuild path, `chrome.windows.create`/`remove`, `chrome.tabs.create`/`query`, `chrome.commands.getAll`, and a `sendNativeMessage` passthrough. **[C]**
- A telemetry/client-info module: `findAndUpsertUUID()` generates a `crypto.randomUUID()` persisted under storage key `uuid`; `getClientInfo()` derives OS/OS-version/browser from the UA; anonymous `track(name, props)` events go to a first-party collector at `r.trancy.org`. **[C]**

Note: the manifest declares **no** `tabs`, `webRequest`, `scripting`, `cookies`, or `activeTab` permission. **[C]** The XHR sniffing in §2 needs none of them, because it is done by patching globals in the page world.

### 1.4 State and persistence

**Redux + redux-persist** into `chrome.storage.local`. **[C]** (S3)

- Persist key is `db1` → storage key **`persist:db1`**. `stateReconciler` is a merge; **no whitelist**, so the whole root state persists — including `user.token` and `translatorService.engines`. **[C]**
- The storage adapter wraps `chrome.storage.local` with defensive **guards**: a 3-step read retry (`[100, 300, 900]` ms), a `.corrupt` backup copy when a rehydrate fails to parse, and a refusal to write when the read has not succeeded yet, or when it would drop a `"user":` key without an intervening logout. It logs each blocked write with a reason tag. **[C]**
- Two other `chrome.storage.local` keys: `uuid` (device identity) and `trancy.ai-catalog.prompt-pack.v1` (a legacy key that is actively *removed*; the current prompt pack lives under a different key). **[C]**

Root state slices (default values as shipped): `translatorService`, `dualCaption`, `setting`, `edreader`, `fulltextRule`, `player`, `practice`, `whisper`, `writer`, `quickTranslator`, `wordbook`, `words`, `videoSentences`, `tasks`, `config`, `stats`, `user`. **[C]**

### 1.5 `manifest.json` verbatim facts

**Core** **[C]** (S2)

| Field | Value |
|---|---|
| `manifest_version` | `3` |
| `version` | `7.9.3` |
| `default_locale` | `en` |
| `background` | `{ "service_worker": "assets/background.js" }` — service worker, not a page |
| `action` | `{ "default_title": "Trancy" }` — **no popup** |
| `update_url` | `https://clients2.google.com/service/update2/crx` |

**Permissions** **[C]**

| Field | Value |
|---|---|
| `permissions` | `["storage", "contextMenus", "unlimitedStorage"]` |
| `host_permissions` | `["<all_urls>"]` |
| `web_accessible_resources` | `[{ "resources": ["assets/*"], "matches": ["http://*/*", "https://*/*", "file:///*"] }]` |
| `externally_connectable` | `{ "matches": ["*://localhost/*"] }` |
| `options_page` / `options_ui` / `side_panel` | **absent** |

Notable: `unlimitedStorage` is requested although the extension ships no database code; `host_permissions` is the maximum (`<all_urls>`) while the declared content-script match list is narrower, because the broad match is what `web_accessible_resources` and main-world injection need on arbitrary pages. **[C]** for the values, **[I]** for that rationale.

**Content scripts** **[C]**

| # | Matches | JS | CSS | `run_at` | `all_frames` |
|---|---|---|---|---|---|
| 0 | 20 hosts (below) | `edvideo-onload.js` | `edvideo.css` | `document_start` | `true` |
| 1 | `http://*/*`, `https://*/*`, `file://*/*` | `tagger-main.js`, `ld-main.js`, `edreader-main.js` | — | `document_start` | `true` |

`all_frames: true` on both — the video pair matters because many platforms play inside an iframe. **[C]**

**Content-script match list (20 hosts)** **[C]**

`youtube.com`, `m.youtube.com`, `www.youtube.com`, `netflix.com`, `www.netflix.com`, `www.coursera.org`, `coursera.org`, `www.udemy.com`, `udemy.com`, `*.udemy.cn`, `*.udemy.com`, `*.ted.com`, `*.youtube-nocookie.com`, `*.hbomax.com`, `*.max.com`, `*.disneyplus.com`, `*.edx.org`, `*.primevideo.com`, `*.deeplearning.ai`, `*.bilibili.com`

**Commands / shortcuts** **[C]**

| Command | Default | Mac | i18n description key |
|---|---|---|---|
| `toggle` | `Ctrl+E` | `Command+E` | `toggleVideoImmersive` |
| `fulltext-translate` | `Alt+E` | `Alt+E` | `toggleFulltextImmersive` |
| `quick-translator` | `Alt+D` | `Alt+D` | `quickTranslator` |
| `ai-transcribe` | *(none suggested)* | — | `aiTranscribe` |
| `caption-toggle` | `Alt+C` | `Alt+C` | `captionToggle` |

The redux `shortcuts` default state carries its own copies (`KeyE`, `KeyD`, `KeyT`, `KeyC` with meta/alt modifiers), so the in-product shortcut table is a separate source of truth from `manifest.commands`. **[C]**

**i18n** — `default_locale: "en"`, 17 locales: `ar, de, en, es, fa, fr, id, it, ja, ko, pt_BR, ru, th, tr, vi, zh_CN, zh_TW`. Only manifest strings and context menus go through `_locales`; the UI has its own bundled translation table. **[C]**

---

## 2. How it gets subtitles per platform

**The short answer to the key question:** for essentially every platform, Trancy obtains subtitles **from the user's own authenticated browser session**, by intercepting the network responses the page itself receives, plus DOM/DASH-manifest parsing and direct same-origin `fetch` calls to the URLs it observed. It does **not** ask a Trancy server "give me the subtitles for this Netflix episode." Trancy's servers are used only for its own Whisper transcription (YouTube-only), for translation, and as a cache of already-transcribed YouTube corpora. **[C]** for the interception mechanics; **[I]** for the framing.

### 2.1 Platform identification

A single URL-regex function maps `location.href` to one of ten platform ids: `youtube`, `netflix`, `coursera`, `udemy`, `ted`, `hbo` (matched on `max.com`), `disney`, `edx`, `bilibili`, `primevideo`, `deeplearning`. The manifest's `*.hbomax.com` / `*.max.com` entries and `*.deeplearning.ai` / `*.primevideo.com` entries match this list, i.e. the shipped match list is **broader than the manual's "8 platforms"** — Prime Video, Bilibili and DeepLearning.AI are wired up in code but undocumented. **[C]**

### 2.2 The strategy table

There is an explicit per-platform strategy config: `{strategy, timing, adapter, domAnchor, autoSubtitle, completeCorpus}`. **[C]** (S4)

| Platform | `strategy` | `timing` | `domAnchor` (cue selector / shadow host / hide) | flags |
|---|---|---|---|---|
| `youtube` | *(default)* | `self` | — | `autoSubtitle`, Whisper-capable |
| `netflix` | `streaming` | `dom-anchor` | cue `.player-timedtext-text-container` | `completeCorpus` |
| `disney` | `streaming` | `dom-anchor` | shadowHost `timed-text-override-region`, cue `.hive-subtitle-renderer-line`, hide `.hive-subtitle-renderer-wrapper` | |
| `hbo` | `streaming` | `dom-anchor` | cue `[class*="TextCue-Fuse-Web-Play"]` | |
| `udemy` | `streaming` | `self` | — | |
| `deeplearning` | `streaming` | `self` | — | `autoSubtitle` |
| `edx` | `streaming` | `self` | — | `autoSubtitle` |
| `bilibili` | `streaming` | `self` | — | |
| `coursera` | `texttrack` | `self` | — | `autoSubtitle` |
| `ted` | `texttrack` | `self` | — | `autoSubtitle` |
| *default* | `preload` | `self` | — | |

Three strategies: **`streaming`** (intercept the page's network traffic), **`texttrack`** (read the native HTML5 `TextTrack` API), **`preload`** (default). `dom-anchor` timing means the *currently rendered native caption node* is used as the playback anchor instead of trusting `video.currentTime`. **[C]** for the table; **[I]** for the strategy semantics.

### 2.3 Per-platform acquisition mechanics

All of the following are **[C]** (S4), traced method by method.

| Platform | How the captions are obtained |
|---|---|
| **YouTube** | Intercepts every `api/timedtext` XHR and stashes the raw `json3` response keyed by URL (bounded to ~6 entries). Independently fetches the watch page and parses `ytInitialPlayerResponse` out of an inline script. Then a 3-tier acquisition: use the intercepted corpus → self-`fetch` the timedtext URL from the page → **drive YouTube's own player** to make it request the track. Also borrows the `pot`/`potc` tokens from a previously observed timedtext URL and replays them on its own request. 8 s budget (5 s when `tlang` is set). |
| **Netflix** | The most invasive. (a) Patches **`JSON.stringify`** to inject the playback profile `webvtt-lssdh-ios8` into Netflix's own manifest request, forcing WebVTT timed-text tracks. (b) Patches **`JSON.parse`** to capture `result.timedtexttracks`. (c) Intercepts both XHR and `fetch` for `nflxvideo.net` responses and parses TTML or WebVTT. (d) Uses Chrome's built-in `window.detectLanguage()` on the cue text when the manifest has no `xml:lang`. |
| **Disney+** | `XHR` sniff on any `.vtt` response; **plus** a global `JSON.parse` patch to capture `stream.sources[0].complete.url`. Rendered cues are read from a **shadow-root** (`timed-text-override-region` → `.hive-subtitle-renderer-line`) and the native wrapper is hidden via `.hive-subtitle-renderer-wrapper`. |
| **HBO Max / max.com** | Sniffs the `dash.mpd` response and **parses the DASH MPD with `DOMParser`**: finds VTT `Representation`s, reads `Role`, `lang`, `SegmentTemplate@media`/`startNumber`, `S@t`/`S@d`, converts the ISO-8601 `start` duration, remaps `zh-Hans-CN`→`zh-CN` / `zh-Hant-TW`→`zh-Hant`, and builds a per-segment subtitle source URL. |
| **Prime Video** | Sniffs `GetVodPlaybackResources`, reads `timedTextUrls.result.subtitleUrls`, stores the payload in its context, and computes a **`__trancyPreMainOffsetMs`** from the `intraTitlePlaylist` (summing `endMs - startMs` of all entries before the `Main` one) so cue times line up with the playlist offset. |
| **Udemy** | Sniffs `vtt-*.udemycdn.com` responses (VTT) **and** the course `fields` API for `captions[]` / `asset.captions[]`. Separately performs an authenticated `fetch` to `https://www.udemy.com/api-2.0/users/me/subscribed-courses/{id}/lectures/{id}/?fields[lecture]=asset&fields[asset]=captions,title,asset_type` **with `credentials: 'include'`** — i.e. it spends the user's own Udemy cookies. |
| **Coursera** | Sniffs the `subtitlesVtt` + `fields` response and rewrites each locale's path to `${location.origin}${path}` so the VTT is fetched same-origin. |
| **TED** | Sniffs the `/streams` response and reads `subtitles[]` with an inline `webvtt` field; also has a DOM-extraction fallback that re-fetches the page, reads `#__NEXT_DATA__`, follows `playerData → resources.hls.metadata`, fetches that, and reads `subtitles[]`. |
| **edX** | Declared `streaming` with an adapter whose only match is a URL regex; the platform-specific listener method is an **empty no-op**, which suggests edX is served by the generic `texttrack`/adapter path. **[C]** for the empty method; **[I]** for the conclusion. |
| **Bilibili** | Sniffs any URL containing `subtitle/`, parses the JSON `body[]` of `{from, to, content}` (seconds → ms). |
| **DeepLearning.AI** | Sniffs any `.vtt` response and parses it. |

### 2.4 Automatic corpus upload and shared cache

While acquiring a YouTube track, the extension also does the opposite: it **uploads the raw caption corpus to Trancy's servers** (`subtitle:raw:write` forwarded to the background; `POST /3/youtube/captions` with `format: "json3"` and an `x-client-id` of the form `CLIENT<timestamp>`). Before uploading, it checks `GET /2/youtube/captions/{id}/status?target=&source=json3` and skips if the server already has it. It can then read other users' corpora back via `GET /3/youtube/captions/{id}/corpus?target={lang}` as `remoteCorpusFallback`. **[C]**

This is the code-level confirmation of the manual's "once a video has been processed, Trancy caches the result so other users can reuse it" claim — and it shows the shared cache is broader than the manual implies: it applies to *intercepted* YouTube captions, not only Whisper output. **[C]** + **[I]**.

### 2.5 Sync and timing model

- **Time source is per-platform, not `video.currentTime`.** Netflix reads `window.netflix.appContext.state.playerApp.getAPI().videoPlayer.getVideoPlayerBySessionId(...).getCurrentTime()` (falling back to `video.currentTime`); Disney reads `disney-web-player.mediaPlayer.timeline.info.playheadPositionMs` (falling back to `.progress-bar .slider-container[aria-valuenow]`); TED falls back to parsing the time label text; Prime Video subtracts the playlist offset above; YouTube uses `video.currentTime`. **[C]**
- **`dom-anchor` timing** (Netflix, Disney, HBO) derives the active line from the DOM cue node rather than the clock, then matches it back into the corpus. **[C]**
- **Predictive translation batching** is explicit and two-tiered: `{ai: {targetLead: 18, maxBatch: 6, maxInflight: 12}, mt: {targetLead: 90, maxBatch: 30, maxInflight: 8}}` — i.e. translate 18 lines ahead in batches of 6 for AI engines, 90 lines ahead in batches of 30 for machine-translation engines. A separate "baseline" pass backfills up to 100 still-untranslated lines. **[C]**
- A minimum-language-evidence threshold (`MIN_LANG_CUES: 10`) gates switching the active language, and Google's legacy MT path chunks on 40 characters (special-cased for Korean). **[C]**
- Watchdog counters exist for the failure modes this design creates: `corpusStarvedTracked`, `noSourceTicks`, `sourceWaiting`, `lastSourceWaitId`. **[C]**

---

## 3. The subtitle overlay

**No shadow DOM for the video overlay. [C]** It is a normal, absolutely-positioned custom element with a heavily namespaced class prefix, plus one global stylesheet.

- The overlay is created as a **custom element** whose tag name is `trancy-caption-window` and whose `id` is also `trancy-caption-window`, then React `createRoot` renders into it. Removal is `document.querySelectorAll("trancy-caption-window").forEach(e => e.remove())`. **[C]**
- Positioning comes from a global content-script stylesheet: `trancy-caption-window { position: absolute; top: 0; left: 0; pointer-events: none; z-index: 999999999 }`, with a **per-platform `z-index` override** (`xtc-youtube` 58, `xtc-ted` 19, `xtc-bilibili` 9, `xtc-deeplearning`/`xtc-udemy` 2, `xtc-coursera` 1) set by putting a class on `document.documentElement`. **[C]**
- Geometry is driven at runtime, not by CSS: a `ResizeObserver` plus a `resize` listener call a routine that resolves `{video, element}` for the platform, reads `getBoundingClientRect()`, and writes the overlay's `width`/`height` inline. Font scale is derived as **`rect.width / 60`** px. **[C]**
- **Player anchoring is per platform**: YouTube `.html5-video-player` (filtered for non-zero size and to exclude `ytd-video-preview`), Netflix `.watch-video`, Prime Video `.dv-player-fullscreen .atvwebplayersdk-player-container`, and `video.parentElement` for Udemy/DeepLearning/Coursera/default. **[C]**
- **Control-bar awareness** is done by observing each platform's control bar and toggling a class on the overlay: `netflix-active`, `udemy-active`, `coursera-active`, `hbo-active`, `disney-active`. Two of these pierce a **shadow root** (`main-app-controls-overlay.shadowRoot` for Disney, whose `.controls-footer / progress-bar / .experience-controls` are watched with a `MutationObserver`); the rest watch `style`/`class` attributes or `getComputedStyle(...).opacity`. **[C]**
- **YouTube ads** are handled by polling the player element for the `ad-showing` class every 500 ms. **[C]**
- **Full screen** needs no special handling for the overlay itself, because the overlay is a child of the player container: a hook sets `document.onfullscreenchange` and compares `document.fullscreenElement` to the container, and the theater/immersive modes call `requestFullscreen()`/`exitFullscreen()` explicitly. `theaterColor` is a separate per-language caption colour used in theater mode. **[C]**
- **User drag**: `mousemove`/`mouseup` handlers rewrite the overlay's `top`/`bottom` percentage, clamping at the edges. **[C]**
- Caption text is rendered twice (primary/secondary) with `dualCaption` state controlling colour, size, font family, opacity, blur, character edge, flip, and target/native language. Word-level tokens are rendered as spans with per-token hover popups and click-to-save. **[C]**
- The native captions are suppressed by toggling the platform's own subtitle button (documented in code for YouTube via `.ytp-subtitles-button` + `toggleSubtitles`) or by the `hideSelector` for Disney. **[C]**

---

## 4. BYOK and subscription

### 4.1 The provider catalog is data, not code

`background.js` embeds a JSON catalog (`JSON.parse` of a string literal, `version: 8024f31c67f2`) with **16 providers, 137 models, 14 builtins**. It is refreshed at runtime from `GET /1/ai/catalog` (with `If-None-Match`/ETag, 5 s abort, schema validation) and cached in `chrome.storage.local`. A separate prompt pack is refreshed from `GET /2/ai/prompt-pack`, and DOM selector rules from `GET /6/rules?device=desktop`. **[C]**

Each provider entry carries `id`, `displayName`, `iconUrl`, `protocol`, `auth`, `endpoint.{direct,proxy}`, `headers`, `bodyMapping`, `responseMapping`, `capabilities`, optional `langMap` and `quirks`. Protocols seen: `openai-chat`, `anthropic-messages`, `google-generative`, `deepl`, `legacy-mt`. **[C]**

**Providers with a `direct` endpoint** **[C]**

| Provider id | Protocol | Auth scheme | Direct endpoint (host) |
|---|---|---|---|
| `openai` | `openai-chat` | `bearer` | `api.openai.com` |
| `siliconflow` | `openai-chat` | `bearer` | `api.siliconflow.cn` |
| `anthropic` | `anthropic-messages` | `api-key-header: x-api-key` | `api.anthropic.com` |
| `gemini` | `google-generative` | `api-key-header: x-goog-api-key` | `generativelanguage.googleapis.com` |
| `deepseek` | `openai-chat` | `bearer` | `api.deepseek.com` |
| `glm` | `openai-chat` | `bearer` | `open.bigmodel.cn` |
| `grok` | `openai-chat` | `bearer` | `api.x.ai` |
| `openrouter` | `openai-chat` | `bearer` | `openrouter.ai` |
| `tencent` | `openai-chat` | `bearer` | `api.hunyuan.cloud.tencent.com` |
| `baidu` | `openai-chat` | `bearer` | `qianfan.baidubce.com` |
| `aliyun`, `qwen-mt` | `openai-chat` | `bearer` | `dashscope.aliyuncs.com` |
| `doubao` | `openai-chat` | `bearer` | `ark.cn-beijing.volces.com` |
| `deepl` | `deepl` | `deepl-auth` | `api.deepl.com/v2/translate` |
| `google-translate` | `legacy-mt` | `none` | `translate.googleapis.com` |
| `microsoft-translate` | `legacy-mt` | `oauth-token` (`edge.microsoft.com/translate/auth`, TTL 540 s) | `api-edge.cognitive.microsofttranslator.com` |

Two details worth noting as facts: the `anthropic` provider carries the quirk `"anthropic-dangerous-browser"`, which makes the adapter send the `anthropic-dangerous-direct-browser-access: true` header — an explicit acknowledgement that requests originate from a browser. And DeepL's `proxy` field points at `api-free.deepl.com`, which is not a proxy at all: it is the free-tier host, selected when the user's key ends in the documented `:fx` suffix. **[C]**

### 4.2 How a BYOK key is used — the important answer

**When a custom engine runs, the request goes from the user's browser straight to the provider. It is not proxied through Trancy. [C], with one caveat marked [I] below.**

Evidence chain, all **[C]** (S3):

1. The request layer resolves an endpoint with a single expression that prefers an explicit override, then `provider.endpoint.proxy` if a `useProxy` flag is set, else `provider.endpoint.direct`.
2. For **user-defined (BYOK) engines**, the provider object is synthesised at runtime and has **only a `direct` endpoint** — no `proxy` field is ever populated. So that expression can only resolve to the user's own configured endpoint, whatever `useProxy` says.
3. The auth resolver maps the provider's `auth.kind` to provider-native headers built from the engine's own key: `Authorization: Bearer <key>` (openai-chat family), `x-api-key: <key>` (Anthropic), `x-goog-api-key: <key>` (Gemini), `DeepL-Auth-Key: <key>` (DeepL), or a `query-param`. If the key is missing it throws `AUTH_TOKEN_FAILED` with the message *"auth scheme requires an engine key"*. No Trancy token is ever added to a direct request.
4. The response adapter reads the provider's native response shape (`choices.*.message.content`, `content.*.text`, `candidates.*.content.parts.*.text`, `translations.*.text`).
5. All of this runs in the **background service worker**, so the fetch's origin is the extension, not the page.
6. The `useProxy` flag: I found it **read** in the background (`Boolean(e.useProxy)`, threaded into the normaliser and into every adapter) but I found **no client call site that ever sets it** — the content-script `translateWithEngine` calls pass only `{texts, from, to, engine, useCache}`. In this build it is therefore effectively always `false`. **[C]** for the observation; **[I]** for "vestigial/dead flag from an earlier proxy design".

**Caveat on key storage. [I]** The engine list — including BYOK engines and their keys — is fetched from the server as `GET /2/translator/engines`, returning `{engines, quota}`, and merged into the persisted store. The extension bundles contain **no API-key input UI** (`apiKey`, `api_key`, `customProtocol` appear zero times in the page-world bundles); the "add engine" button opens `learn.trancy.org/advanced-ai` in a tab. So the evidence says: **the key is stored server-side in the user's Trancy account (so it syncs across devices), then handed back to the extension; inference from a custom engine is nonetheless a direct browser→provider call, and the key is applied client-side.** I could not observe the server's response body to confirm whether it returns the raw key or something else, and the manual describes entering the key inside the product. Treat "Trancy never sees the key" as **not** supported; treat "Trancy does not proxy BYOK inference" as **supported**.

### 4.3 The hosted path — how a subscription engine actually runs

There is a separate, clearly-labelled branch for Trancy's own engines: if `engine.type === "trancy"`, translation is routed to `POST https://api.trancy.org/4/translations` with `Authorization: Bearer <user token>` and the body `{texts, from, to, model, title?, contextText?, glossaries?}`, in batches of 20 concurrent calls behind a rate limiter (10 concurrent). A legacy path (`/3/translations`) with the same auth does the same for `type: "trancy"` engines in the older translator class. **[C]**

So the split is by **engine type**, not by a per-request flag: **[C]**

| `engine.type` | Path | Key holder |
|---|---|---|
| `trancy` | `api.trancy.org/{3,4}/translations` with the user's bearer token | Trancy (server-side) |
| `built-in` | provider `direct` endpoint (Google free MT, Microsoft edge token, DeepL with the user's own key if present) | none / user's DeepL key |
| `user` (BYOK) | provider `direct` endpoint with the user's key | user |

The catalog's `hosted: true` flag (19 of 137 models: GPT-4.1/mini/nano, GPT-5/mini/nano, Claude Haiku 4.5 / Sonnet 4.5, Gemini 2.0 Flash / 2.5 Flash / 2.5 Pro / 3 Flash, DeepSeek Chat, DeepL, SiliconFlow Default) marks which catalog models Trancy offers as hosted, and each hosted model also carries a `role` of 1, 2, or 3. **[C]** for the mechanism and the flag; **[?]** for what `role` 1/2/3 mean — I found no code that branches on it. **[I]** it is a tier/quality ranking.

### 4.4 Account, free vs paid, quota

- **Login is optional.** The extension is fully usable without an account for free engines; individual actions gate themselves (e.g. saving a video, opening an AI-subtitle, or entering the advanced-AI settings shows the signup slider when `!loggedIn`, or opens the dashboard when logged in). **[C]**
- **Auth flows**, all through `api.trancy.org`: `GET /1/google/authURL` and `GET /1/apple/authURL` (the extension opens the URL, then polls `GET /1/google/profile?state={state}`), plus direct `POST /1/login {email,password}` and `POST /1/signup {email,password}`. **[C]**
- **Token storage:** the returned object must contain both `id` and `token` for the `user/login` reducer to accept it, and it then lives in `state.user` — which redux-persist writes to `chrome.storage.local["persist:db1"]`. Note there is **no refresh token and no refresh flow**; the only expiry handling is a `user/expired` action that resets the voice and theme back to defaults. **[C]** for all of that; **[?]** for the token's lifetime.
- **Request auth:** every first-party API call sends `Authorization: Bearer <user.token>` when a token exists and `x-locale: <interface language>`. Custom headers seen across the bundle: `x-trancy-app`, `x-trancy-et`, `x-trancy-platform`, `x-trancy-version`, `x-trancy-version`-style `x-catalog-version`, `x-rules-version`, `x-prompt-version-2`, `x-client-id`, `x-locale`, `x-api-key`, `x-goog-api-key`, `x-tu`. **[C]**
- **Free/paid gating, as visible client-side:** `state.config.enableIAP`, `state.config.PRACTICE_LIMIT` (default 5), `state.user.AIEngineExpired`, and a per-provider quota tally `state.translatorService.quota = {amount, cost, OpenAI, Anthropic, DeepL, Google, DeepSeek}`. The derived flag is `AIEngineAvailable = (user.AIEngineExpired > now) || (quota.amount - quota.cost > 0)` — i.e. **Trancy's hosted AI is allowed if either the account's AI entitlement has not expired or there is remaining quota credit.** Exhausting it silently falls back: a helper substitutes the built-in Google engine for AI engines when the configured engine is a retired/built-in one and `AIEngineAvailable` is false. **[C]**
- `GET /1/stripe/portal` exists and is used by the billing UI; the premium signup surface is an in-page slider route `/setting/premium?info=...` rather than a web page. **[C]**
- **Whisper / "AI Subtitle 2.0"** (YouTube only, matching the manual): submit/fetch `GET /3/youtube/captions/{videoId}?target={lang}&source=audio`, poll `GET /2/youtube/captions/{id}/status?target={lang}&source=json3` (note: the status poll says `source=json3` while the fetch says `source=audio` — an inconsistency in their own code), queue list `GET /2/youtube/queues?target={lang}`, legacy `GET /1/youtube/captions/{id}?target=`, and `POST /2/youtube/captions` for submission. The code's own capability gate is `get whisperable() { return "youtube" === this.platform }`. **[C]**

---

## 5. Backend API surface (all endpoints observed in the bundles)

**Host:** `https://api.trancy.org` (constant `API_ENDPOINT`). Other first-party hosts: `static.trancy.org` (icons/assets), `r.trancy.org` (telemetry/redirect), `learn.trancy.org` (web app), `www.trancy.org`. **[C]**

| Endpoint | Method | Purpose |
|---|---|---|
| `/1/login`, `/1/signup` | POST | email+password auth |
| `/1/google/authURL`, `/1/apple/authURL` | GET | OAuth start URL |
| `/1/google/profile?state=` | GET | OAuth completion / profile fetch |
| `/1/user`, `/1/user/profile`, `/1/user/attributes` | GET/PATCH/DELETE | account |
| `/1/stripe/portal` | GET | billing portal |
| `/1/config?version=`, `/1/configs` | GET/POST | **cross-device settings sync** (versioned document) |
| `/1/ai/catalog` | GET | remote provider/model catalog (ETag) |
| `/2/ai/prompt-pack` | GET | remote prompt pack (ETag) |
| `/6/rules?device=desktop` | GET | remote DOM/selector rule set (ETag) |
| `/2/translator/engines` | GET | **engine list + quota** (incl. BYOK engines) |
| `/3/translations`, `/4/translations` | POST | Trancy-hosted translation proxy (v1, v2) |
| `/1/translator/glm/token` | GET | short-lived token for the GLM proxy (`x-client-id` required) |
| `/1/translation` | POST | legacy translation |
| `/1/tokens` | POST | tokenizer (`{language, texts, appendSpace, withTransliteration}`) |
| `/2/sentences`, `/2/sentences/grammar`, `/2/sentences/keyphrases`, `/1/sentences/grammar`, `/1/sents` | GET/POST | sentence/AI grammar analysis |
| `/1/dictionary`, `/1/explain`, `/1/explain/detail` | GET | lookup |
| `/1/words`, `/2/wordbook/words`, `/3/words/{id}`, `/4/words`, `/1/wordbooks`, `/2/phrases`, `/2/sentence?code=&sid=` | GET/POST | vocabulary + saved sentences |
| `/1/tts/speech`, `/1/tts/voices`, `/1/voice`, `/1/dictvoice` | GET/POST | TTS audio |
| `/1/videos`, `/1/videos/{id}`, `/2/videos`, `/2/videos/{id}` | GET/POST | saved videos ("Watch Later") |
| `/2/youtube/captions`, `/3/youtube/captions` | POST | submit captions / Whisper job |
| `/1/youtube/captions/{id}`, `/3/youtube/captions/{id}?target=&source=audio` | GET | fetch corpora (legacy / Whisper) |
| `/2/youtube/captions/{id}/status`, `/3/youtube/captions/{id}/corpus?target=` | GET | job status / shared corpus |
| `/2/youtube/queues?target=` | GET | AI-subtitle queue state |
| `/1/notification`, `/1/meta`, `/1/feedback` | GET/POST | misc |

Response envelope is consistently `{message, data}` with `message === "ok"` on success. **[C]**

---

## 6. Extension ↔ web app relationship

- **Shared backend + shared account, not direct messaging. [C]** The extension and `learn.trancy.org` both authenticate against `api.trancy.org` with a bearer token, and both read/write the versioned config document (`/1/config`, `/1/configs`). That is the state-sharing channel.
- **`externally_connectable` lists only `*://localhost/*`. [C]** `learn.trancy.org` is *not* externally connectable, so the production web app cannot call `chrome.runtime.sendMessage(extensionId, ...)`. There is no `chrome.runtime.onMessageExternal` handler in the background bundle. **[C]**
- Instead the extension **pushes the user into the web app**: a helper recognises the web app by hostname (`learn.trancy.org`, plus localhost/127.0.0.1 for development), and actions call an `openDashboard(url)` that opens tabs, e.g. `https://learn.trancy.org/practice/{videoId}?t={seconds}` (carrying the current playback position), `https://learn.trancy.org/advanced-ai`, and `https://learn.trancy.org` for the dashboard. **[C]**
- Because the all-URLs content script (`tagger-main.js`, `ld-main.js`, `edreader-main.js`) matches `http://*/*` and `https://*/*`, the extension's content scripts *do* run on `learn.trancy.org`; `learn.trancy.org/pdf` is explicitly blacklisted from the full-text translator. **[C]** **[?]** whether the injected code has a dedicated web-app integration branch — I did not find one beyond the hostname helper.
- **Native messaging** is wired (`sendNativeMessage` RPC + `nativeMessage`) but the manifest declares no `nativeMessaging` permission, so this path cannot be active in this build. **[C]**

---

## 7. What we could reuse as ideas (not code)

Reiterating the boundary: **these are architectural patterns to reimplement from scratch in our own code. Trancy's source, assets, selectors, prompt text, and fonts are theirs; none of it was or should be copied into this repo.** Several of these techniques (main-world injection, XHR sniffing, JSON monkey-patching) are also things a platform's terms of service may prohibit — see the notes below.

### Ideas that fit our YouTube-only app

| Idea | Why it's worth stealing | Note for us |
|---|---|---|
| **Treat the provider catalog as versioned data, not code** | A single JSON blob (protocol + auth kind + endpoint + body/response mapping + capabilities) drives 16 providers and 137 models. Adding a provider becomes a server-side data edit, and `GET /1/ai/catalog` with ETag keeps clients current without a store release. This is directly applicable to our Groq-only `worker/lib` today. | We already have a thin Worker; a small `providers.ts` table with `{endpoint, authHeader, bodyMap, textPath}` would make "add Gemini / OpenAI / DeepL" a config change. |
| **A declarative per-platform strategy table** | `{strategy, timing, domAnchor, adapter}` per platform is a genuinely good shape: it keeps platform quirks in data and the engine platform-agnostic. | Even YouTube-only, our extractor would benefit from `{source: 'innertube' \| 'timedtext-intercept' \| 'dom-anchor', timing: 'self' \| 'dom-anchor'}`. |
| **Predictive, batched translation ahead of the playhead** | `targetLead / maxBatch / maxInflight` is the difference between "subtitles blink in late" and "subtitles are just there". Our chunked post-process is a *whole-file* approach; Trancy's is a *window* approach. | A hybrid: prefetch the next N segments' translations while playing, keep our whole-file path for offline/prepare. |
| **A per-platform current-time resolver** | Never trust `video.currentTime` alone. Reading the platform's own time source and falling back in a chain is cheap insurance. | Only relevant if we ever leave YouTube; worth keeping as an interface (`getCurrentTimeMs()`). |
| **Client-side romanization as an injected module** | `romanize-main.js` exposes `window.romanize.{ja,ko,zh}` and `ja.toRomaji`, used for furigana/romaji on tokens. | We already do furigana server-side via Groq. Doing it client-side removes a round trip and works offline. |
| **Storage guards around persisted client state** | The read-retry, `.corrupt` backup, "don't write before a successful read", and "don't drop the user object without a logout" guards are a small amount of code that prevents a whole class of "my settings vanished" bugs. | We persist to IndexedDB via Dexie and localStorage for language/theme; a `safeSet` wrapper with the same three rules is cheap. |
| **Override the platform's `z-index` per platform via a root class** | One class on `<html>` (`xtc-youtube`) plus a per-platform `z-index` rule avoids the classic overlay-under-controls bug. | Applies the moment we support more than one embed style. |
| **Drive the platform to fetch its own data instead of scraping it** | `drivePlayerTrack` asks YouTube's player API to select the caption track so *YouTube* makes the request, and `borrowPot` replays the observed `pot`/`potc` tokens. Both avoid fighting anti-bot measures. | Same caution: we currently resolve captions server-side via `youtubei.js`, which is cleaner and avoids all of this. Take the *idea* (prefer the official request path) not the technique. |

### Ideas that are deliberately **not** recommended for us

- **Main-world injection of the whole UI.** It is what forces Trancy into two worlds, two transports, a postMessage bridge, and a Trusted Types policy — a large amount of accidental complexity. Our app renders in our own page and needs none of it.
- **Monkey-patching `JSON.parse` / `JSON.stringify` globally.** Netflix and Disney both do this. It is fragile, unbounded in blast radius (every `JSON.parse` on the page pays for it), and the kind of thing that gets an extension delisted.
- **Spending the user's cookies on a third-party API** (`credentials: 'include'` against Udemy's API). This is a clear ToS and trust hazard.
- **No token refresh.** Trancy's auth has no refresh path, so a long-lived session must be re-established by logging in again. We should not copy that part.

### Honest framing

Measured by *engineered surface area*, Trancy's extension is ~10 MB of mostly duplicated UI bundles (the same panels appear in `edvideo-main`, `ld-main`, and `edreader-main`) whose hardest problems are all **platform-adaptation** problems, not **language-learning** problems. Our advantage is that we have one platform and an official server-side caption path, so we can spend the same effort on the practice loop instead of on ten DOM scrapers. **[I]**

---

## 8. Confidence & gaps

### High confidence — read directly from the 7.9.3 bundle
- Manifest facts in §1.5 (permissions, content scripts, commands, i18n, `externally_connectable`, service worker, no options page).
- The two-world injection model, the postMessage bridge, hotkey capture in the isolated world (§1.2).
- Redux + redux-persist into `chrome.storage.local` under `persist:db1`, with the storage guards (§1.4).
- The per-platform strategy table and every per-platform acquisition mechanic in §2.3.
- The provider catalog: 16 providers, 137 models, 19 `hosted`, `version 8024f31c67f2`; every `direct` endpoint and auth scheme in §4.1.
- That custom engines have no proxy endpoint and are called directly with the user's key (§4.2).
- That Trancy-hosted engines go to `api.trancy.org/{3,4}/translations` with the user's bearer token (§4.3).
- The full endpoint list in §5.
- The overlay being a non-shadow-DOM custom element with runtime-sized geometry, per-platform z-index, ResizeObserver, and control-bar class toggles (§3).
- `externally_connectable` limited to localhost, and no `onMessageExternal` handler (§6).

### Medium confidence
- The **reasons** behind design choices (why main-world, why no shadow DOM, what `role: 1|2|3` means, why `ld-main.js` is loaded twice). These are my inferences.
- That `useProxy` is vestigial. I confirmed it is read and that no client call site sets it, but a server-provided engine might carry it in a field I did not connect.
- The claim that `remoteCorpusFallback` is what makes the manual's "shared cached subtitles" real. The code path exists and is exercised as a fallback; I did not measure how often it hits.
- That edX falls back to the generic `texttrack` path (its dedicated listener is an empty function).

### Could NOT verify — explicit gaps
1. **The server side of anything.** No response bodies, no server code. In particular: whether `/2/translator/engines` returns BYOK keys verbatim, and whether Trancy logs them.
2. **Whether BYOK inference is *always* direct in practice.** The code paths I read can only produce direct requests for custom engines, but I could not observe live traffic. A proxy could exist behind a provider entry I would have to see the server return.
3. **Exact token lifetime / session behaviour.** No refresh endpoint found; the `user/expired` action only resets voice and theme.
4. **The live product.** I did not install the extension or sign in. Everything is static analysis of shipped code plus Trancy's own docs. Runtime behaviour (retries, real latency, which fallbacks actually fire) is unobserved.
5. **Whether any of this still works.** YouTube's `pot`/`potc` handling and Netflix's `webvtt-lssdh-ios8` profile are exactly the kind of thing that breaks between releases; 7.9.3 is a snapshot, dated ~2026-09-08 in the CRX headers.
6. **`role` semantics** on hosted models (1/2/3). No code branches on it in the bundles.
7. **The `_locales` UI strings vs. the bundled UI translation table** — the two are separate systems; I did not map them.
8. **The `ipaddress: "36.139.231.181"` literal** that `postCaptions` sends in the body of a legacy submit path. Almost certainly dead/leftover code, but I cannot say why it is there.
9. **Whether the extension reads anything from the page on `learn.trancy.org`** beyond running the generic content scripts (§6).
10. **Version currency.** A newer CRX may exist; I analysed exactly the artifact the update endpoint served at the time of writing.

---

## 9. Sources

All of the following were actually fetched or opened during this research. **[K]** = shipped extension code, **[M]** = first-party manual.

**Distribution / bundle [K]**
- `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0&acceptformat=crx2,crx3&x=id%3Dmjdbhokoopacimoekfgkcoogikbfgngb%26uc` — redirected to `MJDBHOKOOPACIMOEKFGKCOOGIKBFGNGB_7_9_3_0.crx` (CRX3, `Cr24` header, ZIP payload from offset 1321).
- `manifest.json`
- `assets/background.js`
- `assets/edvideo-main.js`
- `assets/edreader-main.js`
- `assets/ld-main.js`
- `assets/tagger-main.js`
- `assets/romanize-main.js`
- `assets/edvideo-onload.js`
- `assets/edvideo.css`
- `assets/edreader.css`, `assets/eduser.css`
- `_locales/{ar,de,en,es,fa,fr,id,it,ja,ko,pt_BR,ru,th,tr,vi,zh_CN,zh_TW}/messages.json`
- `_metadata/verified_contents.json`
- `index.html` (empty shell)
- Extracted copies (facts only) written to `/tmp/trancy-ext/catalog.json` and `/tmp/trancy-ext/ext/` — **outside this repository; not committed.**

**First-party documentation [M]**
- `https://manual.trancy.org/llms.txt` — documentation index
- `https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles.md` — supported platform list, bilingual vs. AI Subtitle, shared cache, AI Subtitle quotas
- `https://manual.trancy.org/en/get-started/use-extension/custom-translation-engine.md` — engine tiers, BYOK flow, quota fallback behaviour

**Referenced but not re-fetched**
- `docs/research/trancy-competitive-analysis.md` (this repo) — positioning, pricing, product gaps, and the stated gap this document fills.
- Chrome Web Store listing `https://chromewebstore.google.com/detail/mjdbhokoopacimoekfgkcoogikbfgngb` — identified the extension and its ID only.
