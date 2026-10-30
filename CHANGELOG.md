# Changelog

## 0.2.0

- Make locked, shot-based framing the default, inspired by CLIPY.ID 2's held-crop approach.
- Detect camera cuts with FFmpeg scdet and hold one persistent face position per source shot. Missing face samples do not create pans or zoom drift.
- Keep the following-face mode available; automatic zoom is opt-in and applies only to that mode.
- Generate preview and publication thumbnails from rendered clips, including when source retention is disabled.
- Add framing regression and FFmpeg render tests, and update Windows/macOS documentation.

This implementation reuses the existing local Haar detector. It does not add active-speaker recognition, multi-panel layouts, MediaPipe, or YuNet models.

## 0.1.0

- Rebrand klipersid as CLIPY.ID with a monochrome, responsive studio interface.
- Add in-app onboarding, output specifications, improved validation and dependency feedback.
- Retain local YouTube session support and transcription compatibility fixes.
- Add a cross-platform setup/launcher, Windows/macOS instructions, and automated build/API checks.

This is the first CLIPY.ID preview release. Source selection and scores use local heuristics; results require editorial review.
