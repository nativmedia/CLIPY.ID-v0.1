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
