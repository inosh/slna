// Renders the "Upcoming Events" preview on the home page from the combined
// events endpoint (CPD + other events). Mirrors the date/status helpers in
// cpd-events.js and events-calendar.js so the home page stays consistent
// with the full events calendar.
document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('home-upcoming-events');

    if (!container) {
        return;
    }

    const apiBaseUrl = String(SLNA_CONFIG.API_BASE_URL || '')
        .replace(/\/+$/, '');

    const apiOrigin = apiBaseUrl.replace(/\/api$/, '');

    const MAX_ITEMS = 3;

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function parseEventDate(value) {
        if (!value) {
            return null;
        }

        const safeValue = String(value).slice(0, 10);
        const date = new Date(safeValue + 'T00:00:00');

        return Number.isNaN(date.getTime()) ? null : date;
    }

    function readableDate(value) {
        const date = parseEventDate(value);

        if (!date) {
            return '';
        }

        return date.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
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

    function statusLabel(status) {
        if (status === 'Closed') {
            return 'Registration Closed';
        }

        return status || 'Upcoming';
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

    function renderEmptyState() {
        container.innerHTML = `
      <div class="empty-events-state">
        <h3>No Upcoming Events Right Now</h3>
        <p>
          We don&rsquo;t have any events scheduled at the moment. Please check
          back soon, or browse the full events calendar for past and future
          SLNA programmes.
        </p>
        <a href="pages/events-calendar.html" class="btn btn-outline btn-sm" style="margin-top:14px;">
          View Events Calendar
        </a>
      </div>
    `;
    }

    function renderErrorState() {
        container.innerHTML = `
      <div class="empty-events-state">
        <h3>Events Currently Unavailable</h3>
        <p>Please try again shortly.</p>
      </div>
    `;
    }

    function eventCardMarkup(event) {
        const title = escapeHtml(event.title);
        const type = escapeHtml(event.type || event.event_type || 'Event');
        const status = escapeHtml(statusLabel(event.status));
        const summary = escapeHtml(event.summary || '');
        const photoUrl = resolvePhotoUrl(event.photo_url || event.photoUrl);

        const detailUrl = 'pages/event-detail.html?category=' +
            encodeURIComponent(event.category || 'other') +
            '&id=' + encodeURIComponent(event.id);

        const imgHtml = photoUrl
            ? '<img src="' + escapeHtml(photoUrl) + '" alt="">'
            : escapeHtml((event.title || 'E').charAt(0).toUpperCase());

        return `
      <a href="${detailUrl}" class="card">
        <div class="card-img">${imgHtml}</div>
        <div class="card-body">
          <div class="date">${escapeHtml(readableDate(event.event_date))}</div>

          <div class="event-card-topline">
            <span class="event-type-badge">${type}</span>
            <span class="event-status-badge ${statusClass(event.status)}">${status}</span>
          </div>

          <h3>${title}</h3>
          <p>${summary}</p>
          <span class="card-link">Details &rarr;</span>
        </div>
      </a>
    `;
    }

    async function loadUpcomingEvents() {
        try {
            const response = await fetch(apiBaseUrl + '/events/');

            if (!response.ok) {
                throw new Error('Could not load events.');
            }

            const data = await response.json();
            const events = Array.isArray(data) ? data : [];

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const upcoming = events
                .filter(function (event) {
                    const date = parseEventDate(event.event_date);
                    return date && date >= today;
                })
                .sort(function (a, b) {
                    return new Date(a.event_date) - new Date(b.event_date);
                })
                .slice(0, MAX_ITEMS);

            if (!upcoming.length) {
                renderEmptyState();
                return;
            }

            container.innerHTML = upcoming.map(eventCardMarkup).join('');
        } catch (error) {
            console.error('Could not load upcoming events:', error);
            renderErrorState();
        }
    }

    loadUpcomingEvents();
});
