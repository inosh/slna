document.addEventListener('DOMContentLoaded', function () {
    const eventsList = document.getElementById('events-list');

    if (!eventsList) {
        return;
    }

    const apiBaseUrl = String(SLNA_CONFIG.API_BASE_URL || '')
        .replace(/\/+$/, '');

    const apiOrigin = apiBaseUrl.replace(/\/api$/, '');

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

    function formatDatePart(value, options) {
        const date = parseEventDate(value);

        if (!date) {
            return '';
        }

        return date.toLocaleDateString('en-GB', options);
    }

    function dateDay(value) {
        return formatDatePart(value, {
            day: '2-digit'
        });
    }

    function dateMonth(value) {
        return formatDatePart(value, {
            month: 'short'
        }).toUpperCase();
    }

    function dateYear(value) {
        return formatDatePart(value, {
            year: 'numeric'
        });
    }

    function readableDate(value) {
        return formatDatePart(value, {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
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

    function eventPhotoMarkup(event) {
        const photoUrl = resolvePhotoUrl(event.photo_url || event.photoUrl);

        if (!photoUrl) {
            return '';
        }

        return `
      <div class="event-list-image">
        <img
                src="${escapeHtml(photoUrl)}"
                alt=""
                loading="lazy"
                onerror="this.parentElement.remove();"
        >
      </div>
    `;
    }

    function eventCardMarkup(event) {
        const title = escapeHtml(event.title);
        const type = escapeHtml(
            event.type || event.event_type || 'CPD Event'
        );
        const status = escapeHtml(event.status || 'Upcoming');
        const eventDate = event.event_date || event.eventDate;
        const time = escapeHtml(event.time);
        const location = escapeHtml(event.location);
        const summary = escapeHtml(event.summary);

        const photoUrl = resolvePhotoUrl(
            event.photo_url || event.photoUrl
        );

        const photoMarkup = photoUrl
            ? `
    <div class="cpd-card-image">
      <img
              src="${escapeHtml(photoUrl)}"
              alt="${escapeHtml(title)}"
              loading="lazy"
      >
    </div>
  `
            : `
    <div class="cpd-card-image cpd-card-image-placeholder">
      <span>SLNA</span>
      <strong>CPD EVENTS</strong>
    </div>
  `;
        return `
    <article class="event-list-card">
      ${photoMarkup}

      <div class="cpd-card-info">
        <div
                class="cpd-card-date"
                aria-label="Event date: ${escapeHtml(
            readableDate(eventDate)
        )}"
        >
          <span class="cpd-date-day">
            ${escapeHtml(dateDay(eventDate))}
          </span>

          <span class="cpd-date-month">
            ${escapeHtml(dateMonth(eventDate))}
          </span>

          <span class="cpd-date-year">
            ${escapeHtml(dateYear(eventDate))}
          </span>
        </div>

        <div class="cpd-card-content">
          <div class="event-card-topline">
            <span class="event-type-badge">
              ${type}
            </span>

            <span class="event-status-badge ${statusClass(event.status)}">
              ${status}
            </span>
          </div>

          <h4>${title}</h4>

          <p class="event-meta">
            <span>${time}</span>
            <span aria-hidden="true">•</span>
            <span>${location}</span>
          </p>

          <p>${summary}</p>

          <a
                  class="btn btn-outline btn-sm"
                  href="event-detail.html?id=${encodeURIComponent(event.id)}"
          >
            View Details
          </a>
        </div>
      </div>
    </article>
  `;
    }

    function renderEmptyState() {
        eventsList.innerHTML = `
      <div class="empty-events-state">
        <h3>No Upcoming CPD Events</h3>
        <p>
          Upcoming SLNA workshops, training sessions, webinars, seminars,
          study days, and conferences will be published here.
        </p>
      </div>
    `;
    }

    function renderErrorState() {
        eventsList.innerHTML = `
      <div class="empty-events-state">
        <h3>Events Currently Unavailable</h3>
        <p>
          Please try again shortly.
        </p>
      </div>
    `;
    }

    async function loadCpdEvents() {
        try {
            const response = await fetch(apiBaseUrl + '/events/cpd');

            if (!response.ok) {
                throw new Error('Could not load CPD events.');
            }

            const data = await response.json();

            const events = Array.isArray(data)
                ? data
                : data.events || data.items || [];

            if (!events.length) {
                renderEmptyState();
                return;
            }

            eventsList.innerHTML = events
                .map(eventCardMarkup)
                .join('');
        } catch (error) {
            console.error('Could not load CPD events:', error);
            renderErrorState();
        }
    }

    loadCpdEvents();
});