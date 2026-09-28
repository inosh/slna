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

    const dayEl = banner.querySelector('.event-spotlight-day');
    const monthEl = banner.querySelector('.event-spotlight-month');
    const yearEl = banner.querySelector('.event-spotlight-year');
    const eyebrowEl = banner.querySelector('.event-spotlight-eyebrow');
    const statusEl = banner.querySelector('.event-spotlight-status');

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

    function render(event) {
        const type = String(event.type || event.event_type || '').trim();
        const title = event.title || type || label;
        const dateValue = event.event_date;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const eventDate = parseEventDate(dateValue);
        const isUpcoming = !!(eventDate && eventDate >= today);

        const photoUrl = resolvePhotoUrl(event.photo_url || event.photoUrl);
        const category = event.category || 'other';

        const detailUrl = 'event-detail.html?category=' +
            encodeURIComponent(category) +
            '&id=' + encodeURIComponent(event.id);

        banner.href = detailUrl;
        banner.setAttribute('aria-label', title + ' – view event details');

        if (photoUrl) {
            banner.classList.add('has-photo');
            banner.style.backgroundImage = "url('" + photoUrl.replace(/'/g, '%27') + "')";
        }

        if (dayEl) dayEl.textContent = formatDatePart(dateValue, { day: '2-digit' });
        if (monthEl) monthEl.textContent = formatDatePart(dateValue, { month: 'short' }).toUpperCase();
        const yearValue = formatDatePart(dateValue, { year: 'numeric' });

        if (yearEl) yearEl.textContent = yearValue;
        if (eyebrowEl) {
            const eyebrowPrefix = isUpcoming ? 'Upcoming – ' + label : 'Most Recent – ' + label;
            eyebrowEl.textContent = yearValue ? eyebrowPrefix + ' - ' + yearValue : eyebrowPrefix;
        }
        if (statusEl) {
            if (event.status) {
                statusEl.textContent = event.status === 'Closed' ? 'Registration Closed' : event.status;
                statusEl.className = 'event-spotlight-status ' + statusClass(event.status);
                statusEl.hidden = false;
            } else {
                statusEl.hidden = true;
            }
        }

        banner.hidden = false;
    }

    async function load() {
        try {
            const response = await fetch(apiBaseUrl + '/events/');

            if (!response.ok) {
                throw new Error('Could not load events.');
            }

            const data = await response.json();
            const events = Array.isArray(data) ? data : [];

            const matches = events
                .filter(function (event) {
                    const type = String(event.type || event.event_type || '').trim().toLowerCase();
                    return matchTypes.indexOf(type) !== -1 && parseEventDate(event.event_date);
                })
                .sort(function (a, b) {
                    return new Date(b.event_date) - new Date(a.event_date);
                });

            if (!matches.length) {
                return;
            }

            render(matches[0]);
        } catch (error) {
            console.error('Could not load featured event:', error);
        }
    }

    load();
});
