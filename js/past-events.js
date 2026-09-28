document.addEventListener('DOMContentLoaded', function () {
    const groupsContainer = document.getElementById('past-events-groups');

    if (!groupsContainer) {
        return;
    }

    const apiBaseUrl = String(SLNA_CONFIG.API_BASE_URL || '')
        .replace(/\/+$/, '');

    const filterButtons = Array.from(
        document.querySelectorAll('.events-filter-btn')
    );

    let allEvents = [];
    let activeFilter = 'all';

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
        return formatDatePart(value, { day: '2-digit' });
    }

    function dateMonth(value) {
        return formatDatePart(value, { month: 'short' }).toUpperCase();
    }

    function readableDate(value) {
        return formatDatePart(value, {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    function monthGroupLabel(value) {
        return formatDatePart(value, { month: 'long', year: 'numeric' });
    }

    function monthGroupKey(value) {
        const date = parseEventDate(value);

        if (!date) {
            return 'unknown';
        }

        return date.getFullYear() + '-' + String(date.getMonth()).padStart(2, '0');
    }

    function categoryBadgeMarkup(event) {
        const isCpd = event.category === 'cpd';

        return '<span class="event-category-badge ' +
            (isCpd ? 'cat-cpd' : 'cat-other') + '">' +
            (isCpd ? 'CPD' : 'General') +
            '</span>';
    }

    function eventRowMarkup(event) {
        const title = escapeHtml(event.title);
        const type = escapeHtml(event.type || 'Event');
        const eventDate = event.event_date;
        const time = escapeHtml(event.time);
        const location = escapeHtml(event.location);

        const metaParts = [time, location].filter(Boolean);

        const detailUrl = 'event-detail.html?category=' +
            encodeURIComponent(event.category) +
            '&id=' + encodeURIComponent(event.id);

        return `
    <a class="event-row" href="${detailUrl}">
      <div class="event-row-date" aria-label="Event date: ${escapeHtml(readableDate(eventDate))}">
        <span class="event-row-day">${escapeHtml(dateDay(eventDate))}</span>
        <span class="event-row-month">${escapeHtml(dateMonth(eventDate))}</span>
      </div>

      <div class="event-row-body">
        <div class="event-row-top">
          ${categoryBadgeMarkup(event)}
          <span class="event-type-badge">${type}</span>
        </div>

        <h4 class="event-row-title">${title}</h4>

        ${metaParts.length ? `<p class="event-row-meta">${metaParts.join(' &bull; ')}</p>` : ''}
      </div>

      <span class="event-row-cta" aria-hidden="true">&rarr;</span>
    </a>
  `;
    }

    function groupByMonth(events) {
        const groups = [];
        const groupsByKey = {};

        events.forEach(function (event) {
            const key = monthGroupKey(event.event_date);

            if (!groupsByKey[key]) {
                groupsByKey[key] = {
                    key: key,
                    label: monthGroupLabel(event.event_date),
                    events: []
                };
                groups.push(groupsByKey[key]);
            }

            groupsByKey[key].events.push(event);
        });

        return groups;
    }

    function renderEmptyState() {
        const labels = {
            cpd: 'CPD Events',
            other: 'Other Events',
            all: 'Events'
        };

        groupsContainer.innerHTML = `
      <div class="empty-events-state">
        <h3>No Past ${labels[activeFilter]}</h3>
        <p>
          There is currently no archive of past events in this category.
        </p>
      </div>
    `;
    }

    function renderErrorState() {
        groupsContainer.innerHTML = `
      <div class="empty-events-state">
        <h3>Events Currently Unavailable</h3>
        <p>Please try again shortly.</p>
      </div>
    `;
    }

    function render() {
        const filtered = allEvents.filter(function (event) {
            return activeFilter === 'all' || event.category === activeFilter;
        });

        if (!filtered.length) {
            renderEmptyState();
            return;
        }

        const groups = groupByMonth(filtered);

        groupsContainer.innerHTML = groups.map(function (group) {
            return `
        <div class="events-calendar-month-group">
          <h3 class="events-month-heading">${escapeHtml(group.label)}</h3>
          <div class="events-compact-list">
            ${group.events.map(eventRowMarkup).join('')}
          </div>
        </div>
      `;
        }).join('');
    }

    function setActiveFilter(filter) {
        activeFilter = filter;

        filterButtons.forEach(function (button) {
            const isActive = button.dataset.filter === filter;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        render();
    }

    filterButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            setActiveFilter(button.dataset.filter);
        });
    });

    async function loadEvents() {
        try {
            const response = await fetch(apiBaseUrl + '/events/');

            if (!response.ok) {
                throw new Error('Could not load events.');
            }

            const data = await response.json();
            const events = Array.isArray(data) ? data : [];

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            allEvents = events
                .filter(function (event) {
                    const date = parseEventDate(event.event_date);
                    return date && date < today;
                })
                .sort(function (a, b) {
                    return new Date(b.event_date) - new Date(a.event_date);
                });

            render();
        } catch (error) {
            console.error('Could not load past events:', error);
            renderErrorState();
        }
    }

    loadEvents();
});
