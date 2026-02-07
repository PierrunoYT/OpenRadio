# 📻 OpenRadio

**A free, open-source internet radio player for listening to worldwide radio stations — right in your browser.**

No accounts, no ads, no tracking. Just open and listen.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
![Build](https://img.shields.io/badge/build-none_needed-brightgreen.svg)

---

## Features

- **30,000+ stations** from around the world via the [Radio Browser API](https://www.radio-browser.info/)
- **Discover** — Top voted, trending, and recently added stations
- **Search** — Real-time search by station name, country, or genre
- **Browse by Country** — Every country with active radio stations
- **Browse by Genre** — Pop, rock, jazz, classical, electronic, news, and hundreds more
- **Browse by Language** — Filter stations by broadcast language
- **Favorites** — Save your favorite stations locally (persisted in localStorage)
- **Full Audio Player** — Play/pause, previous/next, volume control, mute toggle
- **Media Session Integration** — Controls appear in your OS notification area and lock screen
- **Keyboard Shortcuts** — Navigate and control playback without touching the mouse
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Dark Theme** — Modern dark UI with purple accents and animated equalizer
- **Zero Dependencies** — Pure HTML, CSS, and JavaScript. No frameworks, no build step
- **Automatic Failover** — Multiple API servers with fallback and stream retry logic

## Getting Started

### Option 1: Just Open It

1. Download or clone this repository
2. Open `index.html` in any modern browser
3. Start listening

```bash
git clone https://github.com/your-username/OpenRadio.git
cd OpenRadio
# Open index.html in your browser
start index.html        # Windows
open index.html         # macOS
xdg-open index.html     # Linux
```

### Option 2: Serve It Locally

Use any static file server:

```bash
# Python
python -m http.server 8000

# Node.js (npx, no install needed)
npx serve .

# PHP
php -S localhost:8000
```

Then visit `http://localhost:8000`.

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `←` | Previous station |
| `→` | Next station |
| `↑` | Volume up |
| `↓` | Volume down |
| `M` | Mute / Unmute |
| `/` | Jump to search |
| `F` | Toggle favorite |

## Project Structure

```
OpenRadio/
├── index.html    # App structure and layout
├── style.css     # Dark theme styling and responsive design
├── app.js        # Application logic, API calls, audio player
├── README.md     # This file
└── CHANGELOG.md  # Version history
```

## Technology

- **HTML5 Audio** for stream playback
- **Radio Browser API** — free, open-source API with community-maintained station database
- **CSS Grid & Flexbox** for layout
- **CSS Custom Properties** for theming
- **Media Session API** for OS-level media controls
- **localStorage** for favorites and preferences
- **Vanilla JavaScript** — no frameworks, no transpilers, no bundlers

## API

OpenRadio uses the [Radio Browser API](https://www.radio-browser.info/), a free and open community-driven database of internet radio stations. The app connects to multiple API servers for reliability:

- `de1.api.radio-browser.info`
- `de2.api.radio-browser.info`
- `nl1.api.radio-browser.info`
- `at1.api.radio-browser.info`

If one server is unreachable, the app automatically falls back to another.

## Browser Support

Any modern browser with HTML5 Audio support:

- Chrome / Edge 80+
- Firefox 78+
- Safari 14+
- Opera 67+

> **Note:** Some radio streams may not work in all browsers due to codec support (e.g., HLS streams). The vast majority of stations use MP3 or AAC which work everywhere.

## Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m "Add my feature"`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

This project is licensed under the [MIT License](LICENSE).

---

**OpenRadio** — Open Source. Free Forever.
