# Changelog

All notable changes to OpenRadio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.2.0] - 2025-02-07

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

## [0.1.0] - 2025-02-07

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
