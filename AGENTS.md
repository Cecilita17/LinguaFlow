# LinguaFlow Development Guide

## Scope and change discipline

- Make the smallest possible change required for each task.
- Never rewrite, refactor, reformat, or clean up unrelated components.
- Never remove existing functionality unless the request explicitly requires it.
- Do not make speculative improvements. Preserve existing UI, responsive behavior, state, and behavior outside the requested change.
- Before finishing, inspect the diff and confirm that only the requested areas changed.

## Architecture

LinguaFlow is a Node 18+ full-stack language-learning app:

- The frontend is Vite + React under `src/`; `src/main.jsx` installs the global providers and renders `App.jsx`.
- `App.jsx` owns the primary chat experience: active page/tab, target and native language, per-language saved chat history, chat configuration, modals, speech integration, and API calls.
- `server/` is the local Express/backend implementation. `server/index.js` wires the server; `server/handlers.js` contains the shared request handlers and Groq integrations; `conversationEngine.js`, `languageData.js`, and `promptTemplates.js` support conversational behavior.
- `api/` exposes the corresponding serverless endpoints for deployment. Preserve handler contracts and request/response shapes when changing backend behavior.
- `npm run dev` starts both the backend and Vite frontend. Deployment configuration is in `vercel.json`.

## Frontend structure

- `src/components/` contains chat UI, input/header/settings controls, dictionary and grammar modals, plus feature folders:
  - `components/text/` supports the text and EPUB reader.
  - `components/youtube/` supports YouTube import, playback, subtitles, and reader UI.
  - `components/common/` contains reusable shared UI.
- `src/pages/HomePage.jsx`, `TextReaderPage.jsx`, and `YouTubeReaderPage.jsx` are the top-level feature pages.
- `src/services/` is the shared domain layer. Prefer extending an appropriate existing service rather than adding parallel feature logic.
- `src/hooks/useSpeech.js` is the shared speech-recognition, audio recording/transcription, hands-free, and browser TTS implementation.
- `src/constants/languages.js` and `src/constants/translations.js` are the source of truth for language metadata and site copy.

## Global state and persistence

These providers are installed in `src/main.jsx`; inspect and use them before introducing new state:

- `ThemeContext`: light/dark/system theme, persisted under `linguaflow-theme`, and applies document theme classes/attributes.
- `SiteLanguageContext`: Spanish/English interface language and `t()` translation helper, persisted under `linguaflow_site_lang`.
- `AudioSettingsContext`: global speech rate plus chat and text-reader autoplay settings. It persists `linguaflow_global_speech_rate`, `linguaflow_auto_play_ai`, and `linguaflow_auto_play_text_reader`; it also maintains compatibility with legacy `linguaflow_config`.
- `SavedWordsContext`: cross-feature saved vocabulary, persisted under `linguaflow_saved_words`. Its language-aware word-key normalization is important, especially for Chinese.
- `App.jsx` persists target/native language, configuration, and chat histories in `localStorage`. Chat history is stored independently per target language.

Do not create a second source of truth for any of these settings. When a requested behavior is shared, change the existing context, hook, or service rather than adding a competing implementation.

## High-risk shared functionality

Before modifying any related component, trace its dependencies and preserve cross-feature behavior:

- **Audio and speech:** `useSpeech` coordinates browser recognition, MediaRecorder capture, Groq Whisper transcription, hands-free behavior, and TTS. All speech-rate and autoplay behavior must continue to use `AudioSettingsContext`; do not add per-component rate state.
- **Chat:** `App.jsx`, `ChatMessage.jsx`, `InputBar.jsx`, `chatService.js`, and backend handlers work together. Preserve per-language history, corrections, translations, word lookup, grammar breakdowns, and modal behavior.
- **Glosses and translations:** use the shared gloss pipeline. `subtitleGlossService.js` provides language-specific offline-first tokenization, batching, caching, and AI enrichment; `textGlossService.js` deliberately reuses it for text documents. Preserve Chinese word segmentation/Pinyin rules and Arabic no-Latin-transliteration behavior.
- **Text and EPUB reader:** `TextReaderPage.jsx`, `textDocumentService.js`, `textLibraryStorage.js`, and `epubService.js` handle importing, parsing, stable document/paragraph identities, persistence, reader progress, and glosses. Do not duplicate import, storage, or gloss workflows.
- **YouTube reader:** `YouTubeReaderPage.jsx`, `components/youtube/`, `youtubeService.js`, `subtitleService.js`, `subtitleGlossService.js`, and transcript storage share subtitle timing, playback, import, caching, and gloss behavior. Investigate this chain before changing subtitles, timing, audio, or vocabulary behavior.
- **CSS/UI:** global styling begins in `src/index.css`, with component styles/classes throughout the app. Preserve mobile/responsive behavior, existing themes, keyboard/pointer interactions, and accessibility affordances.

## Required workflow for coding tasks

1. Read the component, hook, service, and relevant context that currently own the requested behavior.
2. Identify callers, consumers, persisted data, API contracts, and other features that share the behavior.
3. Reuse existing components, hooks, contexts, constants, and services wherever possible.
4. Implement only the requested behavior, keeping the existing public behavior intact.
5. Run the smallest relevant verification available (and the appropriate build/test when practical).
6. Inspect the final diff; remove any unrelated edits before finishing.

If a requested change could affect chat, shared audio speed/autoplay, glossing/translations, text or EPUB imports, saved data, or the YouTube reader, investigate the dependency before modifying it.
