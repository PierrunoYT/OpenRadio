// ===== OpenRadio - Worldwide Internet Radio =====
// Uses the free Radio Browser API: https://www.radio-browser.info/

(function () {
  'use strict';

  // ===== Configuration =====
  const API_SERVERS = [
    'https://de1.api.radio-browser.info',
    'https://de2.api.radio-browser.info',
    'https://nl1.api.radio-browser.info',
    'https://at1.api.radio-browser.info',
  ];

  const PAGE_SIZE = 50;
  const DISCOVER_LIMIT = 24;
  const SEARCH_DEBOUNCE = 400;
  const FAV_KEY = 'openradio_favorites';
  const VOL_KEY = 'openradio_volume';
  const LAST_STATION_KEY = 'openradio_last_station';

  let apiBase = API_SERVERS[0];
  let currentStation = null;
  let currentList = [];
  let currentIndex = -1;
  let isPlaying = false;
  let isLoading = false;
  let favorites = {};
  let searchTimeout = null;

  // Pagination state for each paginated view
  const pagination = {
    country: { offset: 0, allStations: [], endpoint: '', hasMore: true, loading: false },
    genre:   { offset: 0, allStations: [], endpoint: '', hasMore: true, loading: false },
    lang:    { offset: 0, allStations: [], endpoint: '', hasMore: true, loading: false },
    search:  { offset: 0, allStations: [], query: '', hasMore: true, loading: false },
  };

  function resetPagination(key) {
    pagination[key].offset = 0;
    pagination[key].allStations = [];
    pagination[key].hasMore = true;
    pagination[key].loading = false;
  }

  // ===== DOM References =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const audio = $('#audio-player');
  const playerBar = $('#player-bar');
  const playerName = $('#player-name');
  const playerMeta = $('#player-meta');
  const playerFavicon = $('#player-favicon');
  const btnPlay = $('#btn-play');
  const btnPrev = $('#btn-prev');
  const btnNext = $('#btn-next');
  const btnFavPlayer = $('#btn-fav-player');
  const btnMute = $('#btn-mute');
  const volumeSlider = $('#volume-slider');
  const iconPlay = $('#icon-play');
  const iconPause = $('#icon-pause');
  const iconLoading = $('#icon-loading');
  const heartOutline = $('#heart-outline');
  const heartFilled = $('#heart-filled');
  const volIcon = $('#vol-icon');
  const volMuteIcon = $('#vol-mute-icon');
  const searchBar = $('#search-bar');
  const searchInput = $('#search-input');
  const searchClear = $('#search-clear');
  const viewTitle = $('#view-title');
  const sidebarToggle = $('#sidebar-toggle');
  const sidebar = $('#sidebar');
  const favCountBadge = $('#fav-count');

  // ===== Initialize =====
  function init() {
    loadFavorites();
    loadVolume();
    selectRandomAPI();
    setupEventListeners();
    setupSidebarBackdrop();
    navigateTo('discover');
  }

  function selectRandomAPI() {
    apiBase = API_SERVERS[Math.floor(Math.random() * API_SERVERS.length)];
  }

  // ===== API Helpers =====
  async function apiFetch(endpoint, params = {}) {
    const url = new URL(`${apiBase}/json/${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    try {
      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'OpenRadio/1.0' },
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return await res.json();
    } catch (err) {
      // Try fallback server
      const fallback = API_SERVERS.find((s) => s !== apiBase) || API_SERVERS[0];
      const fallbackUrl = new URL(`${fallback}/json/${endpoint}`);
      Object.entries(params).forEach(([k, v]) => fallbackUrl.searchParams.set(k, v));

      const res = await fetch(fallbackUrl.toString(), {
        headers: { 'User-Agent': 'OpenRadio/1.0' },
      });
      if (!res.ok) throw new Error(`API fallback error: ${res.status}`);
      apiBase = fallback;
      return await res.json();
    }
  }

  // ===== Navigation =====
  const views = {
    discover: { title: 'Discover', showSearch: false },
    search: { title: 'Search', showSearch: true },
    favorites: { title: 'Favorites', showSearch: false },
    countries: { title: 'Browse by Country', showSearch: false },
    genres: { title: 'Browse by Genre', showSearch: false },
    languages: { title: 'Browse by Language', showSearch: false },
  };

  let currentView = 'discover';

  function navigateTo(view) {
    currentView = view;
    const config = views[view];

    // Update nav buttons
    $$('.nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Update views
    $$('.view').forEach((v) => v.classList.remove('active'));
    $(`#view-${view}`).classList.add('active');

    // Update topbar
    viewTitle.textContent = config.title;
    viewTitle.classList.toggle('hidden', config.showSearch);
    searchBar.classList.toggle('hidden', !config.showSearch);

    if (config.showSearch) {
      searchInput.focus();
    }

    // Close sidebar on mobile
    closeSidebar();

    // Load content
    loadView(view);
  }

  async function loadView(view) {
    switch (view) {
      case 'discover':
        loadDiscover();
        break;
      case 'favorites':
        renderFavorites();
        break;
      case 'countries':
        loadCountries();
        break;
      case 'genres':
        loadGenres();
        break;
      case 'languages':
        loadLanguages();
        break;
    }
  }

  // ===== Discover View =====
  let discoverLoaded = false;

  async function loadDiscover() {
    if (discoverLoaded) return;

    try {
      const [topVoted, trending, recent] = await Promise.all([
        apiFetch('stations/topvote', { limit: DISCOVER_LIMIT, hidebroken: true }),
        apiFetch('stations/topclick', { limit: DISCOVER_LIMIT, hidebroken: true }),
        apiFetch('stations/lastchange', { limit: DISCOVER_LIMIT, hidebroken: true }),
      ]);

      renderStationGrid('top-voted', topVoted);
      renderStationGrid('trending', trending);
      renderStationGrid('recently-added', recent);
      discoverLoaded = true;
    } catch (err) {
      console.error('Failed to load discover:', err);
      showError('top-voted', 'Failed to load stations. Please refresh.');
    }
  }

  // ===== Search =====
  function handleSearch(query) {
    if (searchTimeout) clearTimeout(searchTimeout);

    searchClear.classList.toggle('hidden', !query);

    if (!query.trim()) {
      renderSearchEmpty();
      return;
    }

    searchTimeout = setTimeout(async () => {
      const container = $('#search-results');
      container.innerHTML = '<div class="loading-placeholder"><div class="loader"></div></div>';

      resetPagination('search');
      pagination.search.query = query;
      pagination.search.endpoint = 'stations/search';

      try {
        const params = {
          name: query,
          limit: PAGE_SIZE,
          offset: 0,
          hidebroken: true,
          order: 'votes',
          reverse: true,
        };

        const results = await apiFetch('stations/search', params);

        container.innerHTML = '';

        if (results.length === 0) {
          container.innerHTML = `
            <div class="empty-state">
              <p>No stations found</p>
              <span>Try a different search term</span>
            </div>`;
        } else {
          pagination.search.allStations = results;
          pagination.search.offset = results.length;
          pagination.search.hasMore = results.length >= PAGE_SIZE;

          appendStationCards(container, results, pagination.search.allStations);

          if (pagination.search.hasMore) {
            const wrapper = document.createElement('div');
            wrapper.className = 'load-more-wrapper';
            wrapper.innerHTML = `<button class="load-more-btn">Load More Stations</button>`;
            wrapper.querySelector('.load-more-btn').addEventListener('click', () => {
              wrapper.innerHTML = '<div class="loader"></div>';
              fetchMoreStations('search', container, false);
            });
            container.appendChild(wrapper);
          }
        }
      } catch (err) {
        console.error('Search failed:', err);
        showError('search-results', 'Search failed. Please try again.');
      }
    }, SEARCH_DEBOUNCE);
  }

  function renderSearchEmpty() {
    $('#search-results').innerHTML = `
      <div class="empty-state">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p>Search for radio stations worldwide</p>
        <span>Type a station name, country, or genre</span>
      </div>`;
  }

  // ===== Countries =====
  let countriesLoaded = false;

  async function loadCountries() {
    if (countriesLoaded) return;

    try {
      const countries = await apiFetch('countries', { order: 'stationcount', reverse: true });
      const filtered = countries.filter((c) => c.stationcount > 10 && c.name);

      const container = $('#countries-list');
      container.classList.remove('loading-placeholder');
      container.innerHTML = filtered
        .map(
          (c) => `
        <button class="tag-chip" data-country="${escapeAttr(c.name)}">
          ${escapeHtml(c.name)}
          <span class="tag-count">${c.stationcount}</span>
        </button>`
        )
        .join('');

      container.addEventListener('click', (e) => {
        const chip = e.target.closest('.tag-chip');
        if (!chip) return;
        loadCountryStations(chip.dataset.country);
      });

      countriesLoaded = true;
    } catch (err) {
      console.error('Failed to load countries:', err);
    }
  }

  async function loadCountryStations(country) {
    const listEl = $('#countries-list');
    const stationsEl = $('#country-stations');

    listEl.classList.add('hidden');
    stationsEl.classList.remove('hidden');
    stationsEl.innerHTML = `
      <div style="grid-column: 1/-1">
        <button class="back-btn" id="back-countries">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Countries
        </button>
        <h3 class="section-title">${escapeHtml(country)}</h3>
      </div>
      <div class="loading-placeholder" style="grid-column:1/-1"><div class="loader"></div></div>`;

    $('#back-countries').addEventListener('click', () => {
      stationsEl.classList.add('hidden');
      listEl.classList.remove('hidden');
    });

    resetPagination('country');
    pagination.country.endpoint = 'stations/bycountryexact/' + encodeURIComponent(country);
    await fetchMoreStations('country', stationsEl, true);
  }

  async function fetchMoreStations(key, container, isFirstLoad) {
    const pag = pagination[key];
    if (pag.loading || !pag.hasMore) return;
    pag.loading = true;

    // Build the request params
    const params = {
      limit: PAGE_SIZE,
      offset: pag.offset,
      hidebroken: true,
      order: 'votes',
      reverse: true,
    };

    // For search, use a different endpoint structure
    let endpoint = pag.endpoint;
    if (key === 'search') {
      endpoint = 'stations/search';
      params.name = pag.query;
    }

    try {
      const stations = await apiFetch(endpoint, params);

      if (isFirstLoad) {
        // Remove the loader, keep the header
        const header = container.querySelector('div:first-child');
        container.innerHTML = '';
        if (header) container.appendChild(header);
      }

      // Remove existing load-more button
      const existingBtn = container.querySelector('.load-more-wrapper');
      if (existingBtn) existingBtn.remove();

      pag.allStations = pag.allStations.concat(stations);
      pag.offset += stations.length;
      pag.hasMore = stations.length >= PAGE_SIZE;

      appendStationCards(container, stations, pag.allStations);

      // Add "Load More" button if there are more results
      if (pag.hasMore) {
        const wrapper = document.createElement('div');
        wrapper.className = 'load-more-wrapper';
        wrapper.innerHTML = `<button class="load-more-btn">Load More Stations</button>`;
        wrapper.querySelector('.load-more-btn').addEventListener('click', () => {
          wrapper.innerHTML = '<div class="loader"></div>';
          fetchMoreStations(key, container, false);
        });
        container.appendChild(wrapper);
      }
    } catch (err) {
      console.error(`Failed to load stations (${key}):`, err);
      if (isFirstLoad) {
        showError(container.id, 'Failed to load stations. Please try again.');
      }
    } finally {
      pag.loading = false;
    }
  }

  // ===== Genres =====
  let genresLoaded = false;

  async function loadGenres() {
    if (genresLoaded) return;

    try {
      const tags = await apiFetch('tags', { order: 'stationcount', reverse: true, limit: 200 });
      const filtered = tags.filter((t) => t.stationcount > 20 && t.name && t.name.length > 1);

      const container = $('#genres-list');
      container.classList.remove('loading-placeholder');
      container.innerHTML = filtered
        .map(
          (t) => `
        <button class="tag-chip" data-tag="${escapeAttr(t.name)}">
          ${escapeHtml(t.name)}
          <span class="tag-count">${t.stationcount}</span>
        </button>`
        )
        .join('');

      container.addEventListener('click', (e) => {
        const chip = e.target.closest('.tag-chip');
        if (!chip) return;
        loadGenreStations(chip.dataset.tag);
      });

      genresLoaded = true;
    } catch (err) {
      console.error('Failed to load genres:', err);
    }
  }

  async function loadGenreStations(tag) {
    const listEl = $('#genres-list');
    const stationsEl = $('#genre-stations');

    listEl.classList.add('hidden');
    stationsEl.classList.remove('hidden');
    stationsEl.innerHTML = `
      <div style="grid-column: 1/-1">
        <button class="back-btn" id="back-genres">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Genres
        </button>
        <h3 class="section-title">${escapeHtml(tag)}</h3>
      </div>
      <div class="loading-placeholder" style="grid-column:1/-1"><div class="loader"></div></div>`;

    $('#back-genres').addEventListener('click', () => {
      stationsEl.classList.add('hidden');
      listEl.classList.remove('hidden');
    });

    resetPagination('genre');
    pagination.genre.endpoint = 'stations/bytag/' + encodeURIComponent(tag);
    await fetchMoreStations('genre', stationsEl, true);
  }

  // ===== Languages =====
  let languagesLoaded = false;

  async function loadLanguages() {
    if (languagesLoaded) return;

    try {
      const langs = await apiFetch('languages', { order: 'stationcount', reverse: true });
      const filtered = langs.filter((l) => l.stationcount > 20 && l.name && l.name.length > 1);

      const container = $('#languages-list');
      container.classList.remove('loading-placeholder');
      container.innerHTML = filtered
        .map(
          (l) => `
        <button class="tag-chip" data-lang="${escapeAttr(l.name)}">
          ${escapeHtml(l.name)}
          <span class="tag-count">${l.stationcount}</span>
        </button>`
        )
        .join('');

      container.addEventListener('click', (e) => {
        const chip = e.target.closest('.tag-chip');
        if (!chip) return;
        loadLanguageStations(chip.dataset.lang);
      });

      languagesLoaded = true;
    } catch (err) {
      console.error('Failed to load languages:', err);
    }
  }

  async function loadLanguageStations(lang) {
    const listEl = $('#languages-list');
    const stationsEl = $('#language-stations');

    listEl.classList.add('hidden');
    stationsEl.classList.remove('hidden');
    stationsEl.innerHTML = `
      <div style="grid-column: 1/-1">
        <button class="back-btn" id="back-languages">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Languages
        </button>
        <h3 class="section-title">${escapeHtml(lang)}</h3>
      </div>
      <div class="loading-placeholder" style="grid-column:1/-1"><div class="loader"></div></div>`;

    $('#back-languages').addEventListener('click', () => {
      stationsEl.classList.add('hidden');
      listEl.classList.remove('hidden');
    });

    resetPagination('lang');
    pagination.lang.endpoint = 'stations/bylanguageexact/' + encodeURIComponent(lang);
    await fetchMoreStations('lang', stationsEl, true);
  }

  // ===== Favorites =====
  function loadFavorites() {
    try {
      const data = localStorage.getItem(FAV_KEY);
      favorites = data ? JSON.parse(data) : {};
    } catch {
      favorites = {};
    }
    updateFavCount();
  }

  function saveFavorites() {
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
    updateFavCount();
  }

  function toggleFavorite(station) {
    const id = station.stationuuid;
    if (favorites[id]) {
      delete favorites[id];
      showToast(`Removed "${station.name}" from favorites`);
    } else {
      favorites[id] = {
        stationuuid: station.stationuuid,
        name: station.name,
        url_resolved: station.url_resolved || station.url,
        favicon: station.favicon,
        country: station.country,
        tags: station.tags,
        bitrate: station.bitrate,
        codec: station.codec,
        language: station.language,
        homepage: station.homepage,
      };
      showToast(`Added "${station.name}" to favorites`);
    }
    saveFavorites();
    updateFavoriteButtons(id);

    // If on favorites view, re-render
    if (currentView === 'favorites') {
      renderFavorites();
    }
  }

  function isFavorite(stationuuid) {
    return !!favorites[stationuuid];
  }

  function updateFavCount() {
    const count = Object.keys(favorites).length;
    favCountBadge.textContent = count;
    favCountBadge.classList.toggle('hidden', count === 0);
  }

  function updateFavoriteButtons(stationuuid) {
    // Update all fav buttons for this station
    $$(`.btn-fav[data-id="${stationuuid}"]`).forEach((btn) => {
      btn.classList.toggle('active', isFavorite(stationuuid));
      btn.innerHTML = isFavorite(stationuuid)
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    });

    // Update player fav button
    if (currentStation && currentStation.stationuuid === stationuuid) {
      updatePlayerFavButton();
    }
  }

  function updatePlayerFavButton() {
    if (!currentStation) return;
    const fav = isFavorite(currentStation.stationuuid);
    heartOutline.classList.toggle('hidden', fav);
    heartFilled.classList.toggle('hidden', !fav);
  }

  function renderFavorites() {
    const container = $('#favorites-list');
    const favList = Object.values(favorites);

    if (favList.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <p>No favorites yet</p>
          <span>Click the heart icon on any station to save it here</span>
        </div>`;
      return;
    }

    renderStationGrid('favorites-list', favList);
  }

  // ===== Render Station Cards =====
  function renderStationGrid(containerId, stations) {
    const container = $(`#${containerId}`);
    container.classList.remove('loading-placeholder');
    container.innerHTML = '';

    // Save list for next/prev navigation
    if (containerId !== 'favorites-list') {
      // We handle list tracking per-grid
    }

    appendStationCards(container, stations);
  }

  function appendStationCards(container, stations, fullList) {
    const frag = document.createDocumentFragment();
    // fullList is the complete accumulated list (for prev/next across pages)
    const playableList = fullList || stations;

    stations.forEach((station, idx) => {
      const card = document.createElement('div');
      card.className = 'station-card';
      if (currentStation && currentStation.stationuuid === station.stationuuid && isPlaying) {
        card.classList.add('playing');
      }
      card.dataset.uuid = station.stationuuid;

      const tags = [station.country, station.tags?.split(',')[0]].filter(Boolean).join(' / ');
      const fav = isFavorite(station.stationuuid);

      card.innerHTML = `
        <div class="station-favicon">
          ${
            station.favicon
              ? `<img src="${escapeAttr(station.favicon)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='📻'" />`
              : '📻'
          }
        </div>
        <div class="station-info">
          <span class="station-name" title="${escapeAttr(station.name)}">${escapeHtml(station.name)}</span>
          <span class="station-tags">${escapeHtml(tags)}</span>
          ${station.bitrate ? `<span class="station-bitrate">${station.bitrate} kbps${station.codec ? ' / ' + station.codec : ''}</span>` : ''}
        </div>
        <div class="now-playing-indicator">
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="station-actions">
          <button class="btn-fav ${fav ? 'active' : ''}" data-id="${station.stationuuid}" aria-label="Toggle favorite" title="Toggle favorite">
            ${
              fav
                ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
                : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
            }
          </button>
        </div>`;

      // Click to play
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-fav')) {
          toggleFavorite(station);
          return;
        }

        // Use the full accumulated list for prev/next navigation
        currentList = playableList;
        currentIndex = playableList.findIndex((s) => s.stationuuid === station.stationuuid);

        playStation(station);
      });

      frag.appendChild(card);
    });

    container.appendChild(frag);
  }

  // ===== Audio Player =====
  let retryCount = 0;
  const MAX_RETRIES = 2;

  async function playStation(station) {
    const fallbackUrl = station.url_resolved || station.url;
    if (!fallbackUrl) {
      showToast('This station has no playable URL');
      return;
    }

    currentStation = station;
    isLoading = true;
    isPlaying = false;
    retryCount = 0;
    updatePlayerUI();

    // Show player bar
    playerBar.classList.remove('hidden');

    // Resolve the freshest stream URL from the API (also reports the click)
    const resolvedUrl = await resolveStationUrl(station.stationuuid);
    const url = resolvedUrl || fallbackUrl;

    // Only proceed if this station is still the one we want to play
    if (currentStation && currentStation.stationuuid === station.stationuuid) {
      attemptPlay(url);
    }

    // Save last station
    try {
      localStorage.setItem(LAST_STATION_KEY, JSON.stringify(station));
    } catch {}

    // Update media session
    updateMediaSession(station);
  }

  function attemptPlay(url) {
    // Stop any current playback cleanly
    audio.pause();
    audio.removeAttribute('src');
    audio.load();

    // Small delay to let the audio element reset
    setTimeout(() => {
      audio.src = url;
      audio.load();

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Playback attempt failed:', err.message);

          if (retryCount < MAX_RETRIES && currentStation) {
            retryCount++;
            // Retry: try the alternate URL if available
            const altUrl =
              retryCount === 1 && currentStation.url && currentStation.url !== url
                ? currentStation.url
                : url;
            console.log(`Retrying playback (${retryCount}/${MAX_RETRIES})...`);
            setTimeout(() => attemptPlay(altUrl), 500 * retryCount);
          } else {
            isLoading = false;
            isPlaying = false;
            updatePlayerUI();
            showToast('Failed to play this station. Try another one.');
          }
        });
      }
    }, 100);
  }

  function togglePlayPause() {
    if (!currentStation) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {
        showToast('Playback failed. Try again.');
      });
    }
  }

  function playPrev() {
    if (currentList.length === 0 || currentIndex <= 0) return;
    currentIndex--;
    playStation(currentList[currentIndex]);
  }

  function playNext() {
    if (currentList.length === 0 || currentIndex >= currentList.length - 1) return;
    currentIndex++;
    playStation(currentList[currentIndex]);
  }

  function updatePlayerUI() {
    if (!currentStation) return;

    // Station info
    playerName.textContent = currentStation.name;
    const metaParts = [currentStation.country, currentStation.tags?.split(',')[0]].filter(Boolean);
    playerMeta.textContent = metaParts.join(' / ');

    // Favicon
    if (currentStation.favicon) {
      playerFavicon.src = currentStation.favicon;
      playerFavicon.onerror = () => {
        playerFavicon.src = '';
        playerFavicon.style.display = 'none';
      };
      playerFavicon.style.display = '';
    } else {
      playerFavicon.src = '';
      playerFavicon.style.display = 'none';
    }

    // Play/pause/loading icons
    iconPlay.classList.toggle('hidden', isPlaying || isLoading);
    iconPause.classList.toggle('hidden', !isPlaying || isLoading);
    iconLoading.classList.toggle('hidden', !isLoading);

    // Favorite
    updatePlayerFavButton();

    // Update playing state on cards
    $$('.station-card').forEach((card) => {
      card.classList.toggle(
        'playing',
        card.dataset.uuid === currentStation.stationuuid && isPlaying
      );
    });

    // Document title
    if (isPlaying) {
      document.title = `${currentStation.name} - OpenRadio`;
    } else {
      document.title = 'OpenRadio - Worldwide Internet Radio';
    }
  }

  // ===== Audio Events =====
  audio.addEventListener('playing', () => {
    isPlaying = true;
    isLoading = false;
    updatePlayerUI();
  });

  audio.addEventListener('pause', () => {
    isPlaying = false;
    isLoading = false;
    updatePlayerUI();
  });

  audio.addEventListener('waiting', () => {
    isLoading = true;
    updatePlayerUI();
  });

  audio.addEventListener('error', () => {
    // Only handle error if we're actively trying to play something
    if (!currentStation) return;

    if (retryCount < MAX_RETRIES) {
      retryCount++;
      const url = currentStation.url_resolved || currentStation.url;
      console.log(`Stream error, retrying (${retryCount}/${MAX_RETRIES})...`);
      setTimeout(() => attemptPlay(url), 500 * retryCount);
    } else {
      isPlaying = false;
      isLoading = false;
      updatePlayerUI();
      showToast('Stream unavailable. Try another station.');
    }
  });

  audio.addEventListener('ended', () => {
    // Auto-play next
    playNext();
  });

  // ===== Volume =====
  function loadVolume() {
    const saved = localStorage.getItem(VOL_KEY);
    const vol = saved ? parseInt(saved, 10) : 80;
    volumeSlider.value = vol;
    audio.volume = vol / 100;
  }

  function setVolume(val) {
    audio.volume = val / 100;
    localStorage.setItem(VOL_KEY, val);
    updateVolumeIcon();
  }

  function toggleMute() {
    if (audio.volume > 0) {
      audio.dataset.prevVol = audio.volume;
      audio.volume = 0;
      volumeSlider.value = 0;
    } else {
      const prev = parseFloat(audio.dataset.prevVol) || 0.8;
      audio.volume = prev;
      volumeSlider.value = Math.round(prev * 100);
    }
    updateVolumeIcon();
  }

  function updateVolumeIcon() {
    const muted = audio.volume === 0;
    volIcon.classList.toggle('hidden', muted);
    volMuteIcon.classList.toggle('hidden', !muted);
  }

  // ===== Media Session API =====
  function updateMediaSession(station) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: station.country || 'Internet Radio',
      album: station.tags?.split(',')[0] || 'OpenRadio',
      artwork: station.favicon
        ? [{ src: station.favicon, sizes: '512x512', type: 'image/png' }]
        : [],
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
  }

  // ===== Resolve & Report Click =====
  // The /url endpoint both reports a click AND returns the resolved stream URL
  async function resolveStationUrl(stationuuid) {
    try {
      const result = await apiFetch(`url/${stationuuid}`);
      if (result && result.ok === true && result.url) {
        return result.url;
      }
    } catch {}
    return null;
  }

  function reportClick(stationuuid) {
    // resolveStationUrl already reports the click
  }

  // ===== Sidebar =====
  function setupSidebarBackdrop() {
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    backdrop.id = 'sidebar-backdrop';
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', closeSidebar);
  }

  function toggleSidebar() {
    sidebar.classList.toggle('open');
    $('#sidebar-backdrop').classList.toggle('active');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    const backdrop = $('#sidebar-backdrop');
    if (backdrop) backdrop.classList.remove('active');
  }

  // ===== Toast =====
  let toastTimeout;
  function showToast(message) {
    let toast = $('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // ===== Error Display =====
  function showError(containerId, message) {
    const container = $(`#${containerId}`);
    container.classList.remove('loading-placeholder');
    container.innerHTML = `
      <div class="empty-state">
        <p>${escapeHtml(message)}</p>
        <span>Check your internet connection and try again</span>
      </div>`;
  }

  // ===== Helpers =====
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ===== Event Listeners =====
  function setupEventListeners() {
    // Navigation
    $$('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.view));
    });

    // Player controls
    btnPlay.addEventListener('click', togglePlayPause);
    btnPrev.addEventListener('click', playPrev);
    btnNext.addEventListener('click', playNext);
    btnFavPlayer.addEventListener('click', () => {
      if (currentStation) toggleFavorite(currentStation);
    });

    // Volume
    volumeSlider.addEventListener('input', (e) => setVolume(e.target.value));
    btnMute.addEventListener('click', toggleMute);

    // Search
    searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      handleSearch('');
      searchInput.focus();
    });

    // Sidebar toggle (mobile)
    sidebarToggle.addEventListener('click', toggleSidebar);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Don't fire shortcuts when typing in search
      if (e.target.tagName === 'INPUT') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          playPrev();
          break;
        case 'ArrowRight':
          playNext();
          break;
        case 'ArrowUp':
          e.preventDefault();
          volumeSlider.value = Math.min(100, parseInt(volumeSlider.value) + 5);
          setVolume(volumeSlider.value);
          break;
        case 'ArrowDown':
          e.preventDefault();
          volumeSlider.value = Math.max(0, parseInt(volumeSlider.value) - 5);
          setVolume(volumeSlider.value);
          break;
        case 'm':
          toggleMute();
          break;
        case '/':
          e.preventDefault();
          navigateTo('search');
          break;
        case 'f':
          if (currentStation) toggleFavorite(currentStation);
          break;
      }
    });
  }

  // ===== Start =====
  document.addEventListener('DOMContentLoaded', init);
})();
