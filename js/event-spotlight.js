document.addEventListener('DOMContentLoaded', function () {
    const banner = document.getElementById('event-spotlight');

    if (!banner) {
        return;
    }

    const apiBaseUrl = String(SLNA_CONFIG.API_BASE_URL || '')
        .replace(/\/+$/, '');

    const apiOrigin = apiBaseUrl.replace(/\/api$/, '');

    const matchTypes = (banner.dataset.matchTypes || '')
        .split(',')
        .map(function (value) { return value.trim().toLowerCase(); })
        .filter(Boolean);

    if (!matchTypes.length) {
        return;
    }

    const label = banner.dataset.label || 'Event';
    const MAX_SLIDES = 6;
    const AUTO_ADVANCE_MS = 6000;

    function parseEventDate(value) {
        if (!value) {
            return null;
        }

        const safeValue = String(value).slice(0, 10);
        const date = new Date(safeValue + 'T00:00:00');

        return Number.isNaN(date.getTime()) ? null : date;
    }

    function formatDatePart(value, options) {
        const date = parseEventDate(value);

        if (!date) {
            return '';
        }

        return date.toLocaleDateString('en-GB', options);
    }

    function resolvePhotoUrl(photoUrl) {
        if (!photoUrl) {
            return '';
        }

        if (/^https?:\/\//i.test(photoUrl)) {
            return photoUrl;
        }

        return apiOrigin + photoUrl;
    }

    function statusClass(status) {
        const value = String(status || '').toLowerCase();

        if (value.includes('open') && !value.includes('soon')) {
            return 'status-open';
        }

        if (value.includes('soon') || value.includes('announced')) {
            return 'status-soon';
        }

        if (value.includes('closed')) {
            return 'status-closed';
        }

        return 'status-default';
    }

    // Builds one slide for either a news item or a fallback calendar event.
    // `index` is only used to vary the news kicker text (Latest vs Earlier).
    function buildSlide(item, kind, index) {
        const isNews = kind === 'news';
        const type = String(item.type || item.event_type || '').trim();
        const title = item.title || type || label;
        const dateValue = item.event_date;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const eventDate = parseEventDate(dateValue);
        const isUpcoming = !!(eventDate && eventDate >= today);

        const photoUrl = resolvePhotoUrl(item.photo_url || item.photoUrl);

        const detailUrl = isNews
            ? 'news-detail.html?id=' + encodeURIComponent(item.id)
            : 'event-detail.html?category=' + encodeURIComponent(item.category || 'other') +
              '&id=' + encodeURIComponent(item.id);

        const slide = document.createElement('a');
        slide.className = 'spotlight-slide' + (photoUrl ? ' has-photo' : '');
        slide.href = detailUrl;
        slide.setAttribute('aria-label', title + ' – view details');

        if (photoUrl) {
            slide.style.backgroundImage = "url('" + photoUrl.replace(/'/g, '%27') + "')";
        }

        const dateBox = document.createElement('div');
        dateBox.className = 'event-spotlight-date';

        const day = document.createElement('span');
        day.className = 'event-spotlight-day';
        day.textContent = formatDatePart(dateValue, { day: '2-digit' });

        const month = document.createElement('span');
        month.className = 'event-spotlight-month';
        month.textContent = formatDatePart(dateValue, { month: 'short' }).toUpperCase();

        const year = document.createElement('span');
        year.className = 'event-spotlight-year';
        year.textContent = formatDatePart(dateValue, { year: 'numeric' });

        dateBox.appendChild(day);
        dateBox.appendChild(month);
        dateBox.appendChild(year);

        const divider = document.createElement('div');
        divider.className = 'event-spotlight-divider';

        const info = document.createElement('div');
        info.className = 'spotlight-info';

        const kicker = document.createElement('span');
        kicker.className = 'spotlight-kicker';
        kicker.textContent = isNews
            ? (index === 0 ? 'Latest News' : 'Earlier News')
            : (isUpcoming ? 'Upcoming Event' : 'Past Event');

        const titleEl = document.createElement('span');
        titleEl.className = 'spotlight-title';
        titleEl.textContent = title;

        info.appendChild(kicker);
        info.appendChild(titleEl);

        slide.appendChild(dateBox);
        slide.appendChild(divider);
        slide.appendChild(info);

        if (!isNews && item.status) {
            const statusEl = document.createElement('span');
            statusEl.className = 'event-spotlight-status ' + statusClass(item.status);
            statusEl.textContent = item.status === 'Closed' ? 'Registration Closed' : item.status;
            slide.appendChild(statusEl);
        }

        const cta = document.createElement('span');
        cta.className = 'event-spotlight-cta';
        cta.appendChild(document.createTextNode((isNews ? 'Read More' : 'View Event') + ' '));

        const arrow = document.createElement('span');
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        cta.appendChild(arrow);

        slide.appendChild(cta);

        return slide;
    }

    function renderSlides(items, kind) {
        const track = document.createElement('div');
        track.className = 'spotlight-track';

        items.forEach(function (item, index) {
            track.appendChild(buildSlide(item, kind, index));
        });

        banner.innerHTML = '';
        banner.appendChild(track);

        const slides = track.querySelectorAll('.spotlight-slide');
        let current = 0;
        let autoTimer = null;

        function goTo(index) {
            current = (index + slides.length) % slides.length;
            track.style.transform = 'translateX(-' + (current * 100) + '%)';

            const dots = banner.querySelectorAll('.spotlight-dot');
            dots.forEach(function (dot, dotIndex) {
                dot.classList.toggle('active', dotIndex === current);
            });
        }

        function resetTimer() {
            if (autoTimer) {
                clearInterval(autoTimer);
            }
            if (slides.length > 1) {
                autoTimer = setInterval(function () { goTo(current + 1); }, AUTO_ADVANCE_MS);
            }
        }

        if (slides.length > 1) {
            const dotsWrap = document.createElement('div');
            dotsWrap.className = 'spotlight-dots';

            slides.forEach(function (_, index) {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'spotlight-dot' + (index === 0 ? ' active' : '');
                dot.setAttribute('aria-label', 'Show item ' + (index + 1) + ' of ' + slides.length);
                dot.addEventListener('click', function (event) {
                    event.preventDefault();
                    goTo(index);
                    resetTimer();
                });
                dotsWrap.appendChild(dot);
            });

            banner.appendChild(dotsWrap);

            banner.addEventListener('mouseenter', function () {
                if (autoTimer) clearInterval(autoTimer);
            });
            banner.addEventListener('mouseleave', resetTimer);

            resetTimer();
        }

        banner.classList.add('spotlight-banner');
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
                .slice(0, MAX_SLIDES);

            if (newsMatches.length) {
                renderSlides(newsMatches, 'news');
                return;
            }

            const eventMatches = (Array.isArray(eventsData) ? eventsData : [])
                .filter(function (event) {
                    const type = String(event.type || event.event_type || '').trim().toLowerCase();
                    return matchTypes.indexOf(type) !== -1 && parseEventDate(event.event_date);
                })
                .sort(function (a, b) { return new Date(b.event_date) - new Date(a.event_date); })
                .slice(0, MAX_SLIDES);

            if (eventMatches.length) {
                renderSlides(eventMatches, 'event');
            }
        } catch (error) {
            console.error('Could not load spotlight banner:', error);
        }
    }

    load();
});
