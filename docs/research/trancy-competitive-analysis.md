# Trancy — Competitive Analysis for a Web-Based Shadowing App

**Subject:** Trancy (`trancy.org`), focusing on the Learning Center at `learn.trancy.org`
**Date of research:** 2026 (site content is dated 2026; latest changelog entry seen is V7.9.3, September 8, 2026)
**Purpose:** Evidence-based feature breakdown to decide what a focused shadowing/listening app must match or deliberately not match.

---

## 0. Method, evidence tags, and source quality

Every claim below carries one of three tags:

| Tag | Meaning |
|---|---|
| **[C]** Confirmed | Seen on a first-party Trancy surface (product page, official manual, changelog, first-party app-store listing, or Trancy's own shipped client code). URL cited. |
| **[I]** Inferred | My reasoning from confirmed facts; not stated by Trancy. |
| **[?]** Unknown | Could not verify from any first-party source. |

**Primary surfaces used** (all first-party): `www.trancy.org` product/pricing/changelog/blog pages, the official GitBook manual at `manual.trancy.org` (which exposes clean Markdown at `<url>.md` plus an `llms.txt` index), the Chrome Web Store listing, the iOS App Store listing, and the shipped Learning Center JavaScript bundle.

**Two important source caveats found during research:**

1. **Trancy's own manual contains unresolved `EDITOR TODO` notes** admitting that specific documented details were not verified against the live product. Example: the Practice Mode page says its exercise names "should be matched to the current in-product wording before publishing," and the keyboard-shortcuts page says most bindings "were transcribed from a 2-year-old screenshot … and could not be re-verified live." [source](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles/practice-mode.md) **[C]** This is strong evidence that the manual is AI-assisted and partly stale — treat its fine detail as directional, not authoritative.
2. **Trancy's own pricing page is internally inconsistent.** The manual explicitly flags that the free PDF allowance is listed as both 50 pages/month (comparison table) and 2,000 pages/month (plan card). [source](https://manual.trancy.org/en/billing-and-plans/premium.md) **[C]**

**On secondary sources:** I used none. `www.trancy.org/blog` is Trancy-published but is essentially SEO comparison content ("Trancy vs Language Reactor", "Best Language Reactor Alternative 2026"); where I cite it I label it as *Trancy marketing*, not as verified fact.

---

## 1. Positioning & target users

**Claimed positioning.** The site `<title>` is literally "Trancy - YouTube AI Bilingual Subtitles & **Language Reactor Pro**" and the hero reads "Immersive AI Language Learning." **[C]** [www.trancy.org](https://www.trancy.org/) The product explicitly positions itself as the successor/upgrade to Language Reactor, the incumbent dual-subtitle extension. Trancy's blog reinforces this with a deliberate competitor-displacement content strategy (Language Reactor, Immersive Translate, Migaku, eJoy, VoiceTube, Duolingo). **[C]** [blog](https://www.trancy.org/blog)

**The problem it claims to solve.** Passive consumption. The pitch: you already watch YouTube/Netflix and read the web, so turn *that* into study material via bilingual subtitles + AI lookups + speaking practice, instead of using scripted textbooks. The iOS listing frames it as "Turn YouTube & Podcasts into Your Personal Language Classroom. Tired of boring textbooks?" **[C]** [App Store](https://apps.apple.com/app/id6475022743)

**Target users (evidenced, not just inferred).** Trancy's own SEO personas describe: IELTS/TOEFL candidates, non-native developers improving technical English, MOOC (Coursera/edX/Udemy) students, "busy professionals … 20 minutes a day," and Japanese/anime + Korean/K-drama learners. **[C]** (Trancy marketing) [blog](https://www.trancy.org/blog) The realistic core is an **intermediate learner who wants high-volume comprehensible input from real content** and is willing to pay for AI-powered convenience.

**Stated scale — figures are inconsistent across Trancy's own surfaces:**

| Surface | Claim | Source |
|---|---|---|
| Trancy Air page | "Over 1,000,000 downloads and 800,000 registered users" | [trancy-air](https://www.trancy.org/trancy-air) **[C]** |
| Changelog V7.7.7 (Jan 2026) | "surpassed 700,000 users worldwide" | [changelog](https://www.trancy.org/changelog) **[C]** |
| iOS App Store description | "Chosen by 600,000 users" | [App Store](https://apps.apple.com/app/id6475022743) **[C]** |
| Chrome Web Store | 300,000 users, 4.7★ / 2.8K ratings | [CWS](https://chromewebstore.google.com/detail/trancy-ai-translator-dual/mjdbhokoopacimoekfgkcoogikbfgngb) **[C]** |
| Google Play (quoted in manual) | 10,000+ downloads, 3.4★ / 132 reviews | [manual](https://manual.trancy.org/en/get-started/download-mobile-app.md) **[C]** |

**Languages.** "Learn to speak up to 10 languages"; the website itself is available in ~17 UI languages (English, zh-CN, zh-TW, ja, ko, ar, tr, ru, vi, th, de, es, fr, pt, hi, it, id, fa) and the Chrome listing declares 17 languages. **[C]** [manual](https://manual.trancy.org/en/get-started/use-learning-deck/account-settings.md), [CWS](https://chromewebstore.google.com/detail/trancy-ai-translator-dual/mjdbhokoopacimoekfgkcoogikbfgngb)

---

## 2. Core feature inventory

### 2.1 Content import & sources

| Source | Status | Evidence |
|---|---|---|
| YouTube | **[C]** Desktop + mobile; the primary surface. Bilingual subs + AI transcription + channel subscription. | [manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles.md) |
| Netflix, Disney+, Udemy, Coursera, TED, edX, HBO Max | **[C]** **Desktop only.** 7 platforms using each platform's *existing* captions, translated in real time. | [manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles.md) |
| Bilibili | **[C]** Added V7.7.2. | [changelog](https://www.trancy.org/changelog) |
| `learn.deeplearning.ai` | **[C]** Added V7.4.0. | [changelog p2](https://www.trancy.org/changelog?page=2) |
| Web articles (any site) | **[C]** Immersive translation: selection/sentence/paragraph/full-text, right-click or shortcut. Custom site rules ("customized treatments for various news sites, technical forums, social media like Twitter"). | [www.trancy.org](https://www.trancy.org/) |
| PDFs | **[C]** PDF AI Translator: AI extracts PDF → Markdown, OCR for scans, formulas & tables ">95% accuracy"; side-by-side bilingual reading; Alt-key paragraph locate; AI screenshot Q&A. | [pdf page](https://www.trancy.org/pdf) |
| Podcasts | **[C]** Live in Learning Center 2.0 and iOS; Android "coming soon." | [changelog V7.8.6](https://www.trancy.org/changelog), [manual](https://manual.trancy.org/en/billing-and-plans/faq.md) |
| Movies / films | **[C]** Named as supported in the Learning Center 2.0 bilingual subtitle player; `/movie` route exists in the app. | [changelog V7.8.6](https://www.trancy.org/changelog) |
| Books / EPUB | **[C]** "Trancy Reader 1.0" (V7.8.9): word/sentence translation, side-by-side contextual translation, unfamiliar-word highlighting. App routes `/book-home`, `/book-editor`, `/epub-home`, `/epub-reader/:id`, `/reader/:id`. | [changelog](https://www.trancy.org/changelog) |
| User-imported sentences | **[C]** AI Shadowing "supports sentence library, supports manually importing sentences, supports AI creating sentences." | [changelog p3, V4.0.5](https://www.trancy.org/changelog?page=3) |
| User-imported word lists | **[C]** "Premium Vocabulary Book & Word Import"; in-product route `/wordbook-import`. | [pricing](https://www.trancy.org/pricing), [manual](https://manual.trancy.org/en/get-started/use-learning-deck/practice-words.md) |
| YouTube channel subscriptions | **[C]** Search + subscribe to channels; "fresh content delivered the moment it drops." | [changelog V7.8.6](https://www.trancy.org/changelog) |

> **Not supported (worth noting):** local audio/video file upload is described by *competitors* on the App Store, not by Trancy. I found **no** first-party evidence Trancy ingests arbitrary local media files. **[?]**

### 2.2 Subtitle & transcript handling

| Capability | Status | Evidence |
|---|---|---|
| Bilingual subtitles (original + native stacked) | **[C]** | [manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles.md) |
| Three viewing modes: **Theater** (centered video), **Read** (video shrunk to one side, subtitles as scrollable text), **Practice** | **[C]** | [manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles.md) |
| Additional "Cinema mode" | **[C]** Standalone mode, independent subtitle styling, draggable/reorderable, color adjustment (V5.0.0). | [changelog p3](https://www.trancy.org/changelog?page=3) |
| Intelligent sentence segmentation (NLP joins broken captions into sentences) | **[C]** Both in Read/Theater mode and as "Smart Sentence Splitting" on free tier. | [manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles/read-mode.md) |
| **AI Subtitle 2.0** — Whisper transcription when no usable captions | **[C]** YouTube-only, Premium, **asynchronous: ~2–5 min**, results cached and shared between users, still **beta**. Claims ~80% better segmentation than YouTube's own ASR. | [manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles.md), [ai-subtitle](https://www.trancy.org/ai-subtitle) |
| Word-by-word highlighting on YouTube | **[C]** Added V7.9.0. | [changelog](https://www.trancy.org/changelog) |
| Hover-to-lookup on subtitles; click for AI explanation | **[C]** Added V7.9.0. | [changelog](https://www.trancy.org/changelog) |
| Phonetic subtitles (ko/ja/zh), Romaji + Hiragana | **[C]** V5.4.0. | [changelog p3](https://www.trancy.org/changelog?page=3) |
| Subtitle style/font/size adjustment; RTL support for fa/ar | **[C]** | [manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles/theater-mode.md), [changelog V7.8.0](https://www.trancy.org/changelog) |
| Subtitle export | **[C]** Free. **PDF and CSV** format; options to include saved words, highlighted words, timestamps, or collection-only lines. SRT existed historically but no longer appears in the export panel per the manual's own note. | [manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles/export-subtitle.md) |
| External subtitle download | **[C]** Added V7.6.0. | [changelog p2](https://www.trancy.org/changelog?page=2) |
| Playback: speed control, loop line (`R`), auto-pause after each sentence (`J`) | **[C]** | [manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles/theater-mode.md) |
| Click a sentence in Read mode to play just that line | **[C]** | [manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles/read-mode.md) |

### 2.3 Dictionary & lookup

- **Unlimited word & sentence lookup on the free tier.** **[C]** [pricing](https://www.trancy.org/pricing)
- **AI word definitions** (contextual, not dictionary-list), **AI word explainer**, **AI sentence decomposition**, **AI part-of-speech tagging**, **AI grammar analysis** — all Premium. **[C]** [pricing](https://www.trancy.org/pricing)
- **External dictionary** integration and **unknown-word highlighting** while browsing. **[C]** [www.trancy.org](https://www.trancy.org/)
- **Word cards** with phonetics, definitions, inflections, examples, etymology (Trancy Air). **[C]** [trancy-air](https://www.trancy.org/trancy-air)
- **Auto-collect words** on lookup (V3.1.0); one-click save to wordbook. **[C]** [changelog p3](https://www.trancy.org/changelog?page=3)

### 2.4 AI features

| Feature | Status | Notes |
|---|---|---|
| Translation engines: Google, Microsoft (free); DeepL; OpenAI, Claude, Gemini, DeepSeek, Meta, Grok (Premium) | **[C]** | [manual](https://manual.trancy.org/en/get-started/use-extension/custom-translation-engine.md) |
| **Bring-your-own-key** custom engine | **[C]** Free-tier feature. Manual: OpenAI is deliberately *not* offered for subtitle translation due to sentence-breaking quality issues. | [manual](https://manual.trancy.org/en/get-started/use-extension/custom-translation-engine.md) |
| Model tier: GPT-5-mini, GPT-4.1 mini, DeepSeek V4/V3, Claude 4.5 Haiku, Gemini 3.0 Flash | **[C]** Premium + Advanced AI, ~20M tokens/month. | [pricing](https://www.trancy.org/pricing) |
| AI grammar analysis (clauses, word roles, POS labels on subtitle lines) | **[C]** Premium. | [pricing](https://www.trancy.org/pricing) |
| AI video summarization | **[C]** Premium; 10/day, 50/day on Advanced AI. | [pricing](https://www.trancy.org/pricing) |
| **AITalk** — ChatGPT-based spoken conversation trainer | **[C]** Premium. Scenario cards, follow-up + free-dialogue modes, voice or keyboard, one-click smart tips, authentic-phrasing suggestions. | [aichat](https://www.trancy.org/aichat), [manual](https://manual.trancy.org/en/get-started/use-learning-deck/ai-talk.md) |
| **AI Learning Assistant** | **[C]** Premium. | [pricing](https://www.trancy.org/pricing) |
| AI screenshot Q&A for PDFs | **[C]** | [pdf](https://www.trancy.org/pdf) |
| AI Compose / polishing / grammar check (Air) | **[C]** Premium. | [trancy-air](https://www.trancy.org/trancy-air) |
| Screenshot OCR translation, compare-translations (up to 5 engines side by side) | **[C]** Air. | [trancy-air](https://www.trancy.org/trancy-air) |
| Text-to-speech | **[C]** Microsoft Azure TTS (Premium); Air adds "AI voices … better for listening, shadowing and fixing pronunciation." | [pricing](https://www.trancy.org/pricing), [trancy-air](https://www.trancy.org/trancy-air) |

### 2.5 Practice modes

| Mode | Surface | Status | Evidence |
|---|---|---|---|
| **Oral training (shadowing)** | Extension Practice Mode | **[C]** "Repeat each line out loud right after the speaker." | [manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles/practice-mode.md) |
| **Filling (fill-in-the-blank)** | Extension Practice Mode | **[C]** The manual says this label is the one *confirmed from the product UI*. Scored on accuracy + combo in real time. | same |
| **Listening training (dictation)** | Extension Practice Mode | **[C]** behavior documented; exact in-product label unverified (manual's own TODO) | same |
| **Word mastery** (retype target words) | Extension Practice Mode | **[C]** behavior documented; label unverified | same |
| **AI Shadowing** (sentence packs, pronunciation scoring) | Learning Center | **[C]** First-class nav item gated to Premium. | [premium](https://manual.trancy.org/en/billing-and-plans/premium.md) |
| **Video Exercises** | Extension | **[C]** Premium line item on the pricing comparison. | [pricing](https://www.trancy.org/pricing) |
| **Flashcard Practice** (vocab, context sentences, keyboard mode) | Learning Center | **[C]** **The one Learning Center feature that is free for everyone.** | [manual](https://manual.trancy.org/en/get-started/use-learning-deck/practice-words.md) |
| **AITalk conversation** | Learning Center | **[C]** Premium. | [manual](https://manual.trancy.org/en/get-started/use-learning-deck/ai-talk.md) |
| **Pronunciation practice** (system-wide) | Trancy Air desktop | **[C]** Premium; "read a passage aloud sentence by sentence and get an overall score plus per-word feedback." | [trancy-air](https://www.trancy.org/trancy-air) |
| Reading practice | Read mode, Reader, PDF, EPUB | **[C]** | [manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles/read-mode.md) |

**There is no separate "writing practice" or "grammar drill" mode**; grammar support is explanatory (AI analysis), not generative practice. **[I]**

### 2.6 Review & spaced repetition

- **Vocabulary book**: "Words to learn" vs "Already known" buckets, audio playback, batch management, import, multiple wordbooks ("New Wordbook", "Learning Wordbook"). **[C]** [manual](https://manual.trancy.org/en/get-started/use-learning-deck/practice-words.md)
- **Sentence library**: each saved sentence keeps its **original text + translation + source context + audio**; a "Practice" session re-tests them. **[C]** [manual](https://manual.trancy.org/en/get-started/use-learning-deck/practice-sentence.md)
- **FSRS spaced repetition** is claimed **only** in the Trancy Air 1.0.0 changelog, describing collections syncing to the Learning Center "with FSRS spaced repetition." **[C]** [changelog](https://www.trancy.org/changelog) I could not find FSRS/SRS scheduling code in the Learning Center bundle. **[?]** Whether flashcard scheduling is genuinely FSRS-backed is unverified.
- **Sentence packs / "shadowing books"** function as a curriculum-like review structure with per-pack and per-chapter progress. **[C]** (see §3)

### 2.7 Progress tracking

| Signal | Status | Evidence |
|---|---|---|
| **Daily streak** with fire icon, "N days" label, and a **calendar heat-map of active dates** (`activeDates` → `streak-summary-sidebar`, `cal-streak`, `streak-cartoon` mascot image) | **[C]** Read from shipped bundle | `learn.trancy.org/assets/main-r3gO5HhY.js` |
| "Various data statistics" on homepage | **[C]** Added V4.0.5 | [changelog p3](https://www.trancy.org/changelog?page=3) |
| Per-sentence shadowing **best score, stars, attempt count, last-practiced date** | **[C]** Server response mapped into `progress:{best_score, stars, attempts, last_at}` | bundle |
| Pack-level shadow progress (`{done}/{total}`) and **typing** progress tracked separately | **[C]** `sentshadow_shadow_progress`, `typingTotalPracticed` | bundle |
| Dictation **combo** counter ("Perfect ×N") with mascot artwork | **[C]** `dict-combo-badge`, `dict-combo-mascot` | bundle |
| Extension Practice Mode shows live **accuracy + combo** | **[C]** | [manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles/practice-mode.md) |
| AITalk session report: pronunciation, accuracy, fluency, completeness, topic relevance, unique words, tutor summary | **[C]** | bundle (`talk_report_*`) |

---

## 3. The shadowing / speaking practice loop (deep dive)

This is the most important section for a competing product. Trancy implements the loop in **three different places with three different designs**.

### 3.1 Extension — "Practice Mode" (overlay inside the video player)

**Confirmed flow** ([manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles/practice-mode.md)):

1. Open a video on a supported site, turn on Trancy bilingual subtitles.
2. Hover the video → click the **Practice Mode** icon in the Trancy toolbar.
3. Use the **"Mode selection" menu** to choose an exercise (e.g. Filling, shadowing).
4. Work through the video **line by line**; **accuracy and combo update live**.
5. `Esc` exits. `A` / `S` / `D` are quick controls.

**Evidence of scoring internals** (shipped bundle, extension-adjacent): dictation/fill scoring computes `correctWords / totalWords` and a **character-level accuracy**, plus a per-word `ErrorType` from the assessment payload. **[C]** bundle.

**What's shown:** accuracy %, combo counter. **No recording/comparison** is documented for this surface — the "Oral training (shadowing)" description is "repeat each line out loud," i.e. unmonitored repetition. **[C]**/[I]

### 3.2 Learning Center — "AI Shadowing" (the real pronunciation-scored loop)

This is a **first-class navigation item** in the Learning Center. Confirmed nav mapping: `{paths:["/sentence-shadowing","/sentence-pack-studio"], key:"ai_shadowing_title"}`. Related routes: `/shadowing/:id`, `/shadowing`, `/sentence-pack-studio/:id`, `/book-editor`. **[C]** bundle.

**Structure:** curated or user-built **sentence packs** rendered as "shadowing books" with a generated cover, **author, CEFR-style `level`, description**, chapters/groups, and per-pack progress. There is a **Sentence Pack Studio** (`/sentence-pack-studio`) for authoring them, and packs list `totalPracticed`, `typingTotalPracticed`, `last_practiced`, `btn_continue_practice` / `sentshadow_start_practice`. **[C]** bundle.

**The per-sentence loop, reconstructed from shipped code: [C]** bundle

| Step | Evidence |
|---|---|
| Play the original sentence (per-sentence audio, queue of sentences via `shift()`) | `sentence` queue, sentence-level `audioUrl`/`start`/`end` |
| **Record your own reading** — a dedicated recorder button with explicit states `active`, `onRecording`, `analyzing` (`ass-btn-recorder`) | `recordingMode`, `recording`, `analyzing`, `startRecording` / `stopRecording` / `toggleRecording` |
| **Speech assessment runs via Microsoft Azure** `PronunciationAssessment` | `result.PronunciationAssessment.PronScore` |
| **Overall pronunciation score** (0–100) | `PronScore`, color-banded |
| **Four sub-scores shown to the user** | `AccuracyScore`, `CompletenessScore`, `FluencyScore`, and `ProsodyScore` — **Prosody only when the target language starts with `en`** (`target.startsWith("en")` gate) |
| **Per-word scores** and error typing | `Words[].PronunciationAssessment.AccuracyScore`, `Words[].PronunciationAssessment.ErrorType` |
| **Per-phoneme aggregated scores** (averaged across attempts) | `Phonemes[].PronunciationAssessment` rolled into a `Map<phoneme, {total,count}>` |
| **Replay your own recording** (separate button, disabled until a take exists) | `ass-btn-play personal` + `enable: D.audioBlob`; icon `mgc_voice*` |
| **Recording loop toggle** | `toggleRecLoop`, `recLoopRef` |
| Auto-play your take after scoring | setting `autoSpeak` |
| Attempt is **submitted to the server**, which returns `pron_score` + `stars` + `attempts` | `submitShadowingAttempt({course_id, sentence_id, text, score, words})` → `{progress:{best_score, stars, attempts, last_at}}` |
| **Live running average score** while working through the set | `shadowingScoreView(avg)` |
| Best-score badge per sentence, gray/red/orange/green bands | `best_score`; `<=0 gray, <50 red, <80 orange, else green` |
| Typing practice tracked alongside speaking | `typingTotalPracticed`, `typing` |

**Keyboard-first design:** `Enter` toggles recording; `ArrowUp` replays the recorded take; `ArrowDown` also plays the take; a "sentence mode" flag changes key behavior. **[C]** bundle.

**History:** AI Shadowing was introduced/revamped in **V4.0.5 (June 27, 2024)** with "Oral follow-up evaluation, supports sentence library, supports manually importing sentences, supports AI creating sentences." **[C]** [changelog p3](https://www.trancy.org/changelog?page=3)

### 3.3 Trancy Air — system-wide pronunciation practice (outside the browser)

Confirmed 5-step loop ([Air manual, zh](https://manual.trancy.org/trancy-air/yu-yan-yu-xue-xi/kou-yu-gen-du.md)):

1. Select a sentence or passage.
2. Press `Option+S` (macOS) / `Alt+S` (Windows).
3. **Plays the original sentence by sentence.**
4. **Records your reading.**
5. **Shows a pronunciation score and feedback.**

Caveats stated by Trancy itself: microphone permission required, and "scoring is for practice feedback only and does not represent a language exam conclusion." **[C]** Air marketing adds "read a passage aloud sentence by sentence and get an overall score plus per-word feedback. Tap any word to hear it done right." **[C]** [trancy-air](https://www.trancy.org/trancy-air)

### 3.4 What the loop does and does not provide

| Element | Present? |
|---|---|
| Sentence-level looping / focused playback | **Yes** — loop key `R`, click-to-play a line in Read mode, per-sentence queue in AI Shadowing **[C]** |
| Recording your own voice | **Yes** — Azure assessments in both Learning Center and Air **[C]** |
| Numeric scoring | **Yes** — overall + accuracy/fluency/completeness (+ prosody for English) + per-word + per-phoneme **[C]** |
| Side-by-side *original vs. mine* waveform or A/B comparison | **Not confirmed.** You can replay your take and play the original, but no explicit comparison view was found. **[?]** |
| Visual pitch/intonation curve feedback | **Not confirmed** — prosody is surfaced as a *score*, not a curve. **[I]** |
| Articulation / mouth-position guidance, minimal-pair drills | **Not found.** **[?]** |
| Shadowing over *any* video you choose (vs. curated packs) | Extension Practice Mode covers any supported video; deep scoring is tied to packs. **[C]**/[I] |

---

## 4. UX / UI observations

**Two distinct products, one account.**

- **The extension** is an overlay injected into third-party players (Trancy toolbar in the player control bar, `Cmd/Ctrl+E` to start). It inherits the host platform's chrome. **[C]**
- **The Learning Center** (`learn.trancy.org`) is a standalone React SPA. `learn.trancy.org` returns only a `<div id="root">` shell — it is fully client-rendered, which is why a plain fetch yields nothing. **[C]**

**Navigation model (confirmed from the shipped router config):** a dense sidebar/top-app-bar with ~14 top-level destinations. **[C]** bundle

| Nav key | Routes |
|---|---|
| Home | `/home`, `/` |
| Library | `/youtube`, `/library` |
| Materials | `/materials` |
| Podcast | `/podcast` |
| Movie | `/movie` |
| History | `/history` |
| Saved | `/saved` |
| **AI Shadowing** | `/sentence-shadowing`, `/sentence-pack-studio` |
| Sentence | `/sentence` |
| Wordbook | `/vocabulary`, `/review-vocabulary`, `/wordbook-import` |
| Flashcard | `/flashcard`, `/flashcard-home`, `/vocab-mode` |
| AI Talk | `/talk-home`, `/talk`, `/shadowing`, `/talk-report`, `/aitalk` |
| Practice | `/practice` |
| EPUB Reader | `/book-home`, `/reader` |
| Settings | `/settings` |

The bundle declares ~50 routes, far more than the nav exposes (`/topics`, `/topic/:topic`, `/assessment*`, `/aitalk-center`, `/ai-engine`, `/advanced-ai`, `/pdf`, `/epub-reader/:id`, `/book-editor`, `/word-clean`, `/share`, `/redeem`, `/admin/youtube/recommend-channels`). **This is a large, sprawling surface** — a library-first app that has accreted features. **[C]**/[I]

**Design-language decisions worth noting:**

- **Two icon systems coexist**: a MingCute icon font (`mgc_fire_fill`, `mgc_target_line`, `mgc_youtube_line`, `mgc_play_fill`, `mgc_voice*`) for most chrome, and **Remix Icon** (`ri-mic-*`) specifically for the AI-Shadowing mic button. **[C]** bundle — this reads as an inconsistency rather than a deliberate system.
- **Gamification is present but light and warm, not XP-heavy.** There is **no level/XP system** found. Instead: a **streak** with a calendar heat-map and fire icon, a **mascot illustration** beside the streak, a **"Perfect ×N" combo badge with its own mascot** (`perfect.svg`), **confetti animation** on a perfect dictation combo, and **stars** per shadowing sentence. **[C]** bundle
- **Explicit score color bands** (gray → red <50 → orange <80 → green ≥80) are reused across assessment UIs. **[C]** bundle
- **Density:** high. Sidebar + top app bar + drawers (`drawer-course-group`, `topapp-bar middle`), inline meta-tags, filter tags.
- **Theming:** dark / light / follow-system, "plus several color sets"; interface scaling in Air; **premium themes are gated**. **[C]** [manual](https://manual.trancy.org/en/get-started/use-learning-deck/account-settings.md), [trancy-air](https://www.trancy.org/trancy-air)
- **Keyboard-first to the point of being a selling point:** "Shortcut ready — Fly through your leaning tools with keyboard shortcuts for everything. Literally everything." **[C]** [www.trancy.org](https://www.trancy.org/) — though Trancy's own manual admits most documented bindings could not be re-verified. **[C]**
- **Three deliberate viewing layouts** (Theater = focus, Read = text-first with video docked, Practice = exercises) is a genuine information-architecture decision: the same content is re-laid-out per learning intent rather than adding tabs. **[I]**

**Session structure for a shadowing pack:** grid of pack cards with cover/level/progress → pack modal with description → continue/start → per-sentence queue with play → record → analyze → score → replay-mine → next. **[C]** bundle

---

## 5. Pricing & packaging

> **Prices could not be verified.** The pricing page renders plan prices client-side and served literal `0` placeholders over HTTP. Treated as `[?]` below; the manual gives region-specific reference figures.

### Tiers

| | Free | Premium | Premium + Advanced AI ("Kickstart Deal") |
|---|---|---|---|
| Bilingual subtitles (8 platforms) | ✅ | ✅ | ✅ |
| Subtitle export (PDF/CSV) | ✅ | ✅ | ✅ |
| Immersive web translation, unlimited word/sentence lookup | ✅ | ✅ | ✅ |
| Google + Microsoft engines, custom/BYOK engine | ✅ | ✅ | ✅ |
| Smart sentence splitting | ✅ | ✅ | ✅ |
| **Flashcard Practice** | ✅ | ✅ | ✅ |
| Saved words / sentences | **100 words / 50 sentences** | Unlimited | Unlimited |
| PDF translation | 50 pages/mo *(page card says 2,000 — inconsistent)* | 2,000–4,000 pages/mo | **4,000 pages/mo** |
| YouTube AI Subtitle transcription | ❌ | **40 videos/day** | **60 videos/day** |
| AI grammar analysis, video exercises, AI video summaries | ❌ | ✅ (summaries 10/day) | ✅ (50/day) |
| AITalk, AI Pronunciation Assessment, AI Learning Assistant, **AI Shadowing** | ❌ | ✅ | ✅ |
| Premium themes, Azure TTS | ❌ | ✅ | ✅ |
| Advanced engines + ~20M tokens/mo | ❌ | ❌ | GPT-5-mini, GPT-4.1 mini, DeepSeek V4, Claude 4.5 Haiku, Gemini 3.0 Flash |
| Devices | — | **6 simultaneous** | 6 |

Sources: **[C]** [pricing](https://www.trancy.org/pricing), [manual premium](https://manual.trancy.org/en/billing-and-plans/premium.md), [manual faq](https://manual.trancy.org/en/billing-and-plans/faq.md)

### Commercial mechanics

- **Monthly / yearly, yearly "−35%"**, promoted as a limited-time offer "ends September 15, 2026." **[C]** [pricing](https://www.trancy.org/pricing)
- **Reference prices (manual, Turkey region, monthly, standard billing):** Premium from **~$3.49/mo**, Premium + Advanced AI from **~$8.79/mo**. Regional variation is explicit, and **iOS in-app prices run higher than web**. **[C]** [manual](https://manual.trancy.org/en/billing-and-plans/premium.md)
- **Free trial** of paid plans exists; length is not stated on the surfaces I fetched. **[C]**/[?]
- **Refunds:** no-questions-asked within **7 days (monthly)** / **30 days (yearly)**, measured from the most recent purchase *or renewal*. For Premium + Advanced AI, consumed AI-engine usage is deducted from the refunded amount. Process: **cancel first** in dashboard settings, then email `hello@trancy.org` with a receipt or order reference. **[C]** [manual refund](https://manual.trancy.org/en/billing-and-plans/refund.md)
- **BYOK is a pressure-release valve:** if the token quota is exhausted, Trancy falls back to free Google/Microsoft engines, offers an additional engine package (currently **paused**), or you connect your own API key. **[C]** [pricing](https://www.trancy.org/pricing), [manual](https://manual.trancy.org/en/get-started/use-extension/custom-translation-engine.md)
- **PayPal accepted**; **bank transfer not accepted**. **[C]** [manual](https://manual.trancy.org/en/billing-and-plans/subscription.md)
- **Marketing-vs-product tension Trancy itself acknowledges:** marketing calls AITalk a "free AI speaking coach," but the pricing comparison gates AITalk, AI Pronunciation Assessment, and AI Learning Assistant as Premium. The manual instructs readers that "in-product behavior is authoritative." **[C]** [manual](https://manual.trancy.org/en/billing-and-plans/premium.md)

**Implication for a competitor:** the entire **shadowing + pronunciation-scoring** value proposition sits behind Premium. The free tier is essentially a subtitle reader plus flashcards. **[C]**/[I]

---

## 6. Platform surfaces

| Surface | Status | Detail | Source |
|---|---|---|---|
| **Browser extension** | **[C]** | Chrome, Edge, Brave, Arc (Chromium); Firefox (AMO); Safari (macOS App Store). **v7.9.3**, updated Sep 8 2026, 5.54 MiB, 4.7★ (2.8K), 300K users. | [download](https://www.trancy.org/download), [CWS](https://chromewebstore.google.com/detail/trancy-ai-translator-dual/mjdbhokoopacimoekfgkcoogikbfgngb) |
| **Learning Center (web app)** | **[C]** | `learn.trancy.org`, fully client-rendered React SPA. Requires sign-in for most features. | [learn.trancy.org](https://learn.trancy.org/) |
| **Mobile — iOS** | **[C]** | "Trancy - AI Language Learning", dev **L2D LIMITED**, 4.5★, iOS 15.0+, iPhone/iPad. Podcast support live. | [App Store](https://apps.apple.com/app/id6475022743) |
| **Mobile — iOS Safari ext.** | **[C]** | "Trancy ET - AI Translator" (separate app, macOS/visionOS App Store id6475386403). | [download](https://www.trancy.org/download) |
| **Mobile — Android** | **[C]** | "Trancy - Learn Languages" (`org.trancy.app`), Google Play + APK. Manual (verified 2026-06-04) describes it as early: v0.2.2-era, 3.4★ / 132 reviews, 10K+ downloads. | [mobile](https://www.trancy.org/mobile), [manual](https://manual.trancy.org/en/get-started/download-mobile-app.md) |
| **Mobile browser extensions** | **[C]** | Firefox for Android, iOS Safari, and an offline ZIP for Chromium-based mobile browsers (e.g. Kiwi). | [download](https://www.trancy.org/download) |
| **Desktop app — Trancy Air** | **[C]** | macOS + Windows, launched as v1.0.0 (V7.9.3 changelog, Sep 8 2026). System-wide translation via accessibility APIs, plus pronunciation practice. Free engine works without sign-in. | [trancy-air](https://www.trancy.org/trancy-air) |

**Mobile is YouTube-only.** Trancy states plainly that the mobile app does not work with Netflix or Disney+; other platforms are a desktop experience. **[C]** [manual](https://manual.trancy.org/en/get-started/download-mobile-app.md)

**Not found on any surface:** a public API, developer docs, or a public changelog RSS/JSON feed (the blog's "RSS Feed" link points at an X/Twitter redirect). **[?]**

---

## 7. Gaps & opportunities

Reasoning is explicit; each item states what is confirmed and what follows from it.

### 7.1 The shadowing loop is fragmented across three UIs — own one coherent loop

**Evidence [C]:** the extension's Practice Mode (accuracy + combo, no recording), the Learning Center's AI Shadowing (recording + Azure scoring + stars, pack-based), and Air's system-wide pronunciation practice (select → hotkey → record → score) are three separate implementations with different affordances, different key bindings, and different progress models. The extension's practice-mode exercise labels are so uncertain that Trancy's own manual carries a TODO to check them in-product **[C]**.

**Opportunity [I]:** a single, deep, forgiving loop — *listen → record → see per-word/per-sound feedback → immediately re-record the same sentence → see the delta* — is more valuable for pronunciation than breadth. Trancy spreads the same Azure-grade scoring across three surfaces but never confirms a **before/after comparison of two attempts** on the same sentence, which is the single most useful feedback primitive for shadowing.

### 7.2 Pronunciation feedback stops at numbers

**Evidence [C]:** the scoring payload includes `PronScore`, `AccuracyScore`, `FluencyScore`, `CompletenessScore`, `ProsodyScore` (English only), per-word `AccuracyScore` + `ErrorType`, and per-phoneme scores — but the UI surfaces them as labelled numbers with color bands, plus a live average. **[C]** No waveform, pitch contour, syllable-timing, or mouth-shape guidance appears anywhere in the bundle or manuals **[?]**/**[I]**.

**Opportunity [I]:** the data Trancy already computes (phoneme-level scores, word error types) supports far richer visualization — a pitch/timing overlay of "me vs. original," or highlighting the exact syllable that dragged the score down. A focused app can win on *explaining* the score rather than restating it.

### 7.3 Shadowing is Premium-gated; the free tier is a subtitle reader

**Evidence [C]:** the pricing comparison puts **AI Shadowing**, AITalk, AI Pronunciation Assessment, and the AI Learning Assistant on Premium. The free tier gets bilingual subtitles, web translation, lookup, export, and Flashcard Practice, with caps of 100 words / 50 sentences.

**Opportunity [I]:** a shadowing-first app with a **generous or unlimited free speaking loop** and monetization on volume/AI extras (translation, transcription, summaries) attacks Trancy exactly where its paywall is most visible. Pronunciation scoring is Trancy's most emotionally compelling feature and its most aggressively gated one.

### 7.4 Cloud-dependent and latency-bound

**Evidence [C]:** AI Subtitle is **asynchronous, 2–5 minutes**, server-queued, and beta — and only for YouTube. Speech scoring is a **cloud** call (Microsoft Azure). Collections sync through an account; Air's pronunciation scoring requires sign-in. **[C]** [ai-subtitle](https://www.trancy.org/ai-subtitle), [manual](https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles.md), [trancy-air](https://www.trancy.org/trancy-air)

**Opportunity [I]:** the consulting repo is already offline-first and browser-local (IndexedDB, no app DB). Leaning into **instant, local-first practice on content you already have captions for**, with no queue and no account, is a real axis Trancy cannot easily copy without rebuilding its server economics. (Note: this repo has **no ASR path**, so "instant" applies to content with existing captions — which is also exactly Trancy's free-tier behavior.)

### 7.5 Breadth is a liability a focused app can exploit

**Evidence [C]:** Trancy ships a translator, a web translator, a PDF translator, an EPUB reader, a podcast player, a movie player, a flashcard app, and a conversation partner, exposed through ~50 routes and a 14-item nav. Its own blog markets "one account, all platforms."

**Opportunity [I]:** "Trancy does everything adequately" is the classic broad-suite opening. A shadowing app that does *one* thing exceptionally — with a best-in-class per-sentence practice surface — can position against Trancy's density instead of against its feature count.

### 7.6 Trust gaps Trancy leaves open

**Evidence [C]:**
- The pricing page is internally inconsistent on PDF limits (50 vs 2,000 pages/month), acknowledged in Trancy's own manual.
- The manual carries multiple `EDITOR TODO` notes admitting unverified/stale documentation, including that most keyboard shortcuts came from a 2-year-old screenshot, and that a previous refund page's "transaction fee" caveat "could not be verified" and was deleted rather than checked with the payments provider.
- User counts differ across four Trancy surfaces (600K / 700K / 800K / 300K downloads).
- Marketing calls AITalk free; pricing gates it as Premium.
- The manual records an App Store complaint about **removed free auto-translate** on mobile (~2025).

**Opportunity [I]:** none of this is a product defect, but together it signals a company optimizing for SEO acquisition breadth. A competitor with a precise, honest feature/pricing matrix and a genuinely free core loop can differentiate on trust — especially for a tool whose users are evaluating it on a paywall boundary.

### 7.7 Concrete candidate differentiators

Ranked by (evidence strength × defensibility):

1. **Attempt-over-attempt comparison on the same sentence** (A/B playback + score delta). Low effort, high perceived value, unconfirmed in Trancy. **[I]**
2. **Phoneme-level drill-down with a "what to fix" sentence**, not just a score. Trancy already computes per-phoneme scores; it presents them as aggregates. **[C]**→**[I]**
3. **Free, unlimited speaking loop** against Trancy's Premium gate. **[C]**→**[I]**
4. **Local-first / no-account instant practice** on captioned content. **[C]**→**[I]**
5. **Focused "my own video → my own shadowing course" flow**, mirroring Trancy's Sentence Pack Studio but centered on the user's imported content rather than curated packs. **[C]**→**[I]**
6. **Timing/rhythm feedback** (shadowing latency vs. the original speaker) — a natural, hard-to-copy signal unique to shadowing specifically, and one that needs no cloud call. **[I]**

---

## 8. Confidence & gaps

### High confidence (multiple first-party sources, or read directly from shipped code)
- Supported content platforms and the desktop/mobile split.
- The three extension viewing modes and the practice modes at a behavioral level.
- The existence, structure, and scoring internals of Learning Center **AI Shadowing** — read from `learn.trancy.org`'s own shipped bundle, corroborated by the manual and by the V4.0.5 changelog entry.
- The free/Premium feature split and quotas, the 6-device limit, and the refund policy.
- Extension version (7.9.3), rating, user count, and the iOS App Store listing details.

### Medium confidence
- Exact keyboard-shortcut bindings — Trancy's own manual flags most as unverified.
- Exact Practice Mode exercise labels (only "Filling" is confirmed by Trancy's own note).
- Whether Free/AI Shadowing pack lists behave exactly as the code paths suggest (I read code, not a live authenticated session).
- Real-world latency and reliability of AI Subtitle, speech scoring, and translation engines.

### Could NOT verify (explicit gaps)
1. **Live pricing numbers.** `trancy.org/pricing` and `/trancy-air/pricing` render prices client-side and served `0` placeholders. Only the manual's Turkey-region reference values (~$3.49 / ~$8.79 per month) were obtainable.
2. **The authenticated Learning Center UI.** `learn.trancy.org` is a client-rendered SPA returning an empty shell over HTTP; I could not sign in or screenshot any practice session, so all UI structure is inferred from the shipped bundle and manuals, not observed.
3. **The extension's live UI.** The Chrome Web Store listing body is JS-rendered and returned no usable text; I read only metadata (version, rating, size, description) plus programmatic metadata. I did not install or inspect the extension bundle, so extension practice-mode behavior rests on Trancy's own (partly self-doubted) documentation.
4. **Official YouTube/demo videos.** `youtube.com/@trancy` returned only a localized consent shell with no channel data. I could not confirm a channel or review demo videos.
5. **SRT export existence.** The manual documents PDF+CSV and explicitly flags SRT as previously available but possibly removed.
6. **FSRS / true spaced repetition.** Claimed only in the Air 1.0.0 changelog; no scheduling logic found in the Learning Center bundle. Scheduling may be server-side, or the claim may be marketing.
7. **Free-trial length.** Only that a trial exists.
8. **Mobile app current feature parity.** Android version/rating figures come from Trancy's own manual (dated 2026-06-04), not from Google Play directly.
9. **Retention/conversion economics.** No user-retention, DAU, or revenue data exists on any first-party surface.
10. **Whether "shadowing" in Trancy means the same thing to its users as to this project.** Trancy uses it for both unmonitored repetition (extension) and Azure-scored recording (Learning Center/Air).

### Honest framing note
Trancy's public web presence is heavily SEO-optimized: the blog is dominated by competitor-comparison posts, and the manual shows signs of AI-assisted generation with unresolved editorial TODOs. Where the manual and the live product could disagree, Trancy itself says the product wins. This analysis therefore leans on the **shipped JavaScript bundle** for anything structural, and treats the manual as a guided index rather than ground truth.

---

## 9. Sources

All URLs below were actually fetched during this research. Tags: **[P]** product site, **[M]** official manual, **[S]** store listing, **[K]** shipped code.

**Product site**
- [P] https://www.trancy.org/
- [P] https://www.trancy.org/pricing
- [P] https://www.trancy.org/changelog (and `?page=2`, `?page=3`)
- [P] https://www.trancy.org/ai-subtitle
- [P] https://www.trancy.org/aichat
- [P] https://www.trancy.org/mobile
- [P] https://www.trancy.org/download
- [P] https://www.trancy.org/pdf
- [P] https://www.trancy.org/trancy-air
- [P] https://www.trancy.org/trancy-air/pricing
- [P] https://www.trancy.org/blog
- [P] https://learn.trancy.org/ (SPA shell only)
- [P] https://learn.trancy.org/pdf (SPA shell only)

**Official manual (GitBook) — Markdown endpoints**
- [M] https://manual.trancy.org/en/llms.txt
- [M] https://manual.trancy.org/en/sitemap-pages.xml
- [M] https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles.md
- [M] https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles/theater-mode.md
- [M] https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles/read-mode.md
- [M] https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles/practice-mode.md
- [M] https://manual.trancy.org/en/get-started/use-extension/bilingual-subtitles/export-subtitle.md
- [M] https://manual.trancy.org/en/get-started/use-extension/keyboard-shortcuts.md
- [M] https://manual.trancy.org/en/get-started/use-extension/custom-translation-engine.md
- [M] https://manual.trancy.org/en/get-started/use-learning-deck/ai-talk.md
- [M] https://manual.trancy.org/en/get-started/use-learning-deck/practice-sentence.md
- [M] https://manual.trancy.org/en/get-started/use-learning-deck/practice-words.md
- [M] https://manual.trancy.org/en/get-started/use-learning-deck/watch-later.md
- [M] https://manual.trancy.org/en/get-started/use-learning-deck/account-settings.md
- [M] https://manual.trancy.org/en/get-started/download-mobile-app.md
- [M] https://manual.trancy.org/en/billing-and-plans/premium.md
- [M] https://manual.trancy.org/en/billing-and-plans/subscription.md
- [M] https://manual.trancy.org/en/billing-and-plans/refund.md
- [M] https://manual.trancy.org/en/billing-and-plans/faq.md
- [M] https://manual.trancy.org/trancy-air/llms.txt
- [M] https://manual.trancy.org/trancy-air/yu-yan-yu-xue-xi/kou-yu-gen-du.md (口语跟读 — pronunciation/shadowing practice)
- [M] https://manual.trancy.org/trancy-air/can-kao-zi-liao/gong-neng-yu-fang-an-shuo-ming.md (free / signed-in / subscription capability split)

**Store listings**
- [S] https://chromewebstore.google.com/detail/trancy-ai-translator-dual/mjdbhokoopacimoekfgkcoogikbfgngb
- [S] https://apps.apple.com/app/id6475022743 (Trancy - AI Language Learning)
- [S] Redirect targets resolved via `r.trancy.org/u/download-chrome` → `chromewebstore.google.com/...`, and `r.trancy.org/u/download-edge` → `microsoftedge.microsoft.com/addons/detail/aepdhbcjfkpncgbmlllcaloniioihlma` (the Edge listing itself was **not** fetched)

**Shipped first-party client code**
- [K] https://learn.trancy.org/assets/main-r3gO5HhY.js (Learning Center SPA bundle — route table, nav model, AI Shadowing flow, Azure assessment fields, streak/combo UI)

**Attempted but unverifiable**
- `https://chromewebstore.google.com/...` listing body (JS-rendered; only metadata extracted)
- `https://www.youtube.com/@trancy` (returned a localized consent shell; no channel data)
- `https://learn.trancy.org/{locales,locale,i18n}/en.json` (all returned the 5,845-byte SPA shell, not locale data)
