# CLIPY.ID v0.2 — verification

Local verification on Windows, 30 October 2026:

- Frontend TypeScript validation and production build passed.
- All 19 backend tests passed locally, including real FFmpeg rendering and scene detection.
- A stationary gradient source verified that stable framing does not pan or zoom, even when enable_zoom is supplied. A cut changes the held crop immediately. Output remained 720 × 1280 with audio and expected duration.
- The preview thumbnail matched a decoded rendered frame. Publication assets also worked when no source video was retained.
- Unit checks covered jitter, missed detections, dominant-face selection, no-face shots, clip-relative camera cuts, merged duplicate crops, and partial-clip consistency.
- Browser verification confirmed the stable default, disabled zoom in stable mode, and enabled zoom control in follow mode.
- GitHub Actions installs FFmpeg on Linux to run render checks; Windows/macOS run API and planning checks plus renders when FFmpeg is available.

Scope: the framing technique is adapted from CLIPY.ID 2's held-crop design. This release uses the existing Haar face detector, without mouth/audio active-speaker recognition, multi-panel layouts, or new model downloads. Full YouTube transcription was not re-run for this change. Existing rendered videos must be regenerated to use v0.2 framing.

---

# CLIPY.ID v0.1 — verification

Local verification on Windows, 25 October 2026:

- Cross-platform launcher: `python manage.py check` and `python manage.py setup` completed successfully, including dependency installation and frontend build.
- Frontend: TypeScript check and production build passed using Node 24 and Vite 8.
- Dependency audit: `npm audit` returned zero known vulnerabilities at verification time. PostCSS overrides keep Tailwind 3's nested/selector dependencies on patched versions.
- Backend: seven unittest checks passed, covering version/health response, invalid inputs, missing jobs, session origins, cookie import filtering, and disconnect.
- Python dependencies: `pip check` passed.
- Rendering: a generated two-second landscape test video rendered to 720 × 1280 with zoom, reframe, audio, and all three subtitle styles (outline, shadow, box).
- Browser: studio loaded, invalid URL stayed blocked, a complete YouTube video ID enabled the action, options expanded, guide navigation worked, and the storage dialog showed local usage with cancel available. No user data was deleted.
- Responsive layout checked at 390px with no horizontal overflow. Reduced-motion and keyboard focus rules are included. Native modal dialog provides focus containment and Escape handling.

Scope: live YouTube downloading and full speech transcription were not re-run as part of the visual refresh. macOS installation and end-to-end rendering need validation on an actual Mac. CI checks the API on Windows/macOS/Linux and builds the frontend; its result is reported by GitHub Actions.

This release is intended for a personal localhost installation. Source files remain on disk after restart, while job history is in memory. The app is not a hosted multi-user service.
