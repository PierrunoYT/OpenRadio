# Changelog

All notable changes to OpenRadio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.3.0] - 2026-02-07

### Added

- **Pagination** — "Load More Stations" button on all station lists (country, genre, language, search)
- Stations load in pages of 50 with unlimited scrolling via Load More
- Previous/next player controls now work across all loaded pages
- Styled Load More button with hover effects matching the app theme

### Changed

- Station lists no longer hard-capped at 100 results
- Search results now paginated (previously limited to 60)
- Refactored station fetching into a shared `fetchMoreStations` helper for consistency

---

## [0.2.1] - 2026-02-07

### Added

- Screenshot of the Discover view added to `assets/`
- README now displays the screenshot at the top
- Project structure in README updated to include `assets/` directory

---

## [0.2.0] - 2026-02-07

### Fixed

- Removed `crossorigin="anonymous"` from audio element that was blocking most radio streams from loading
- Audio element is now properly reset (src cleared, load called) before switching stations to prevent state corruption
- Stream URLs are now resolved fresh from the Radio Browser API before playback to avoid stale URLs

### Added

- Retry logic for stream playback — up to 2 automatic retries with alternate URL fallback
- Attempts both the resolved URL and original URL on retry for better success rate
- Incremental delay between retries (500ms, 1000ms) to handle transient failures

### Changed

- Playback function is now async to support URL resolution before play
- Error handler now retries instead of immediately giving up
- Toast messages updated to be more descriptive on stream failures

---

## [0.1.0] - 2026-02-07

### Added

- Initial release
- Discover view with Top Voted, Trending, and Recently Added stations
- Real-time search across 30,000+ stations by name, country, or genre
- Browse by Country with station counts
- Browse by Genre/Tag with station counts
- Browse by Language with station counts
- Favorites system persisted in localStorage
- Full audio player with play/pause, previous/next, volume, and mute controls
- Media Session API integration for OS-level media controls
- Keyboard shortcuts (Space, arrows, M, /, F)
- Responsive design with collapsible sidebar on mobile
- Dark theme with purple accents and equalizer animation
- Multiple Radio Browser API servers with automatic fallback
- Toast notifications for user feedback
- Station card playing state with animated equalizer bars
- Volume preference saved in localStorage
