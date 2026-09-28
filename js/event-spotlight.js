document.addEventListener('DOMContentLoaded', function () {
    const banner = document.getElementById('event-spotlight');

    if (!banner) {
        return;
    }

    const apiBaseUrl = String(SLNA_CONFIG.API_BASE_URL || '')
        .replace(/\/+$/, '');

    const matchTypes = (banner.dataset.matchTypes || '')
        .split(',')
        .map(function (value) { return value.trim().toLowerCase(); })
        .filter(Boolean);

    if (!matchTypes.length) {
        return;
    }

    const label = banner.dataset.label || 'Event';
    const MAX_ITEMS = 6;
    const SECONDS_PER_ITEM = 8;

    function parseEventDate(value) {
        if (!value) {
            return null;
        }

        const safeValue = String(value).slice(0, 10);
        const date = new Date(safeValue + 'T00:00:00');

        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatFullDate(value) {
        const date = parseEventDate(value);

        if (!date) {
            return '';
        }

        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    // Builds one ticker entry (date, kicker, title, and an optional status tag)
    // linking to the news or event's own detail page. Every entry reads as
    // "Latest" — the ticker only ever shows the latest available items, so
    // there's no need to distinguish earlier/past ones from the first.
    function buildTickerItem(item, kind) {
        const isNews = kind === 'news';
        const type = String(item.type || item.event_type || '').trim();
        const title = item.title || type || label;
        const dateValue = item.event_date;
        const kickerText = 'Latest';

        const detailUrl = isNews
            ? 'news-detail.html?id=' + encodeURIComponent(item.id)
            : 'event-detail.html?category=' + encodeURIComponent(item.category || 'other') +
              '&id=' + encodeURIComponent(item.id);

        const link = document.createElement('a');
        link.className = 'ticker-item';
        link.href = detailUrl;
        link.setAttribute('aria-label', kickerText + ' – ' + title);

        const dateEl = document.createElement('span');
        dateEl.className = 'tdate';
        dateEl.textContent = formatFullDate(dateValue);
        link.appendChild(dateEl);

        link.appendChild(document.createTextNode(' — '));

        const kickerEl = document.createElement('b');
        kickerEl.textContent = kickerText + ':';
        link.appendChild(kickerEl);

        link.appendChild(document.createTextNode(' ' + title));

        if (!isNews && item.status && item.status !== 'Completed') {
            const statusEl = document.createElement('span');
            statusEl.className = 'tstatus';
            statusEl.textContent = ' · ' + (item.status === 'Closed' ? 'Registration Closed' : item.status);
            link.appendChild(statusEl);
        }

        return link;
    }

    function renderTicker(items, kind) {
        const ticker = document.createElement('div');
        ticker.className = 'ticker';

        const badge = document.createElement('span');
        badge.className = 'ticker-badge';

        const dot = document.createElement('span');
        dot.className = 'live-dot';
        badge.appendChild(dot);

        const badgeLabel = document.createElement('span');
        badgeLabel.className = 'badge-label';
        badgeLabel.textContent = kind === 'news' ? 'News' : 'Events';
        badge.appendChild(badgeLabel);

        ticker.appendChild(badge);

        const wrap = document.createElement('div');
        wrap.className = 'ticker-wrap';

        const track = document.createElement('div');
        track.className = 'ticker-track';
        track.style.animationDuration = Math.max(items.length * SECONDS_PER_ITEM, 14) + 's';

        // Two identical sets back to back; translating the track by exactly
        // -50% loops seamlessly since both halves are the same width.
        [0, 1].forEach(function (setIndex) {
            const set = document.createElement('div');
            set.className = 'ticker-set';
            if (setIndex === 1) {
                set.setAttribute('aria-hidden', 'true');
            }
            items.forEach(function (item) {
                set.appendChild(buildTickerItem(item, kind));
            });
            track.appendChild(set);
        });

        wrap.appendChild(track);
        ticker.appendChild(wrap);

        const cta = document.createElement('a');
        cta.className = 'ticker-cta';
        cta.href = kind === 'news' ? 'news.html' : 'events-calendar.html';
        cta.textContent = 'View All';
        ticker.appendChild(cta);

        banner.innerHTML = '';
        banner.appendChild(ticker);
        banner.hidden = false;
    }

    async function fetchJson(path) {
        const response = await fetch(apiBaseUrl + path);

        if (!response.ok) {
            throw new Error('Request failed: ' + path);
        }

        return response.json();
    }

    async function load() {
        try {
            const [newsData, eventsData] = await Promise.all([
                fetchJson('/news').catch(function () { return []; }),
                fetchJson('/events/').catch(function () { return []; })
            ]);

            const newsMatches = (Array.isArray(newsData) ? newsData : [])
                .filter(function (item) {
                    const newsType = String(item.news_type || '').trim().toLowerCase();
                    return matchTypes.indexOf(newsType) !== -1 && parseEventDate(item.event_date);
                })
                .sort(function (a, b) { return new Date(b.event_date) - new Date(a.event_date); })
                .slice(0, MAX_ITEMS);

            if (newsMatches.length) {
                renderTicker(newsMatches, 'news');
                return;
            }

            const eventMatches = (Array.isArray(eventsData) ? eventsData : [])
                .filter(function (event) {
                    const type = String(event.type || event.event_type || '').trim().toLowerCase();
                    return matchTypes.indexOf(type) !== -1 && parseEventDate(event.event_date);
                })
                .sort(function (a, b) { return new Date(b.event_date) - new Date(a.event_date); })
                .slice(0, MAX_ITEMS);

            if (eventMatches.length) {
                renderTicker(eventMatches, 'event');
            }
        } catch (error) {
            console.error('Could not load spotlight banner:', error);
        }
    }

    load();
});
