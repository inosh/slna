document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('event-detail-container');

    if (!container) {
        return;
    }

    const apiBaseUrl = String(SLNA_CONFIG.API_BASE_URL || '')
        .replace(/\/+$/, '');

    const apiOrigin = apiBaseUrl.replace(/\/api$/, '');

    const params = new URLSearchParams(window.location.search);
    const category = params.get('category') === 'other' ? 'other' : 'cpd';
    const id = params.get('id');

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

    function resolvePhotoUrl(photoUrl) {
        if (!photoUrl) {
            return '';
        }

        if (/^https?:\/\//i.test(photoUrl)) {
            return photoUrl;
        }

        return apiOrigin + photoUrl;
    }

    // Most event flyers are either a wide/landscape photo or a tall poster
    // with all the details baked into the image. Landscape stays in the
    // original side-by-side layout; a noticeably-taller-than-wide image
    // switches to a layout where "About This Event" moves up next to the
    // info panel instead of trailing a very tall image. Resolves to
    // 'landscape' (also used when there's no photo, or it fails to load) or
    // 'portrait'.
    function detectImageOrientation(photoUrl) {
        return new Promise(function (resolve) {
            if (!photoUrl) {
                resolve('landscape');
                return;
            }

            const probe = new Image();

            probe.onload = function () {
                resolve(
                    probe.naturalHeight > probe.naturalWidth * 1.15
                        ? 'portrait'
                        : 'landscape'
                );
            };

            probe.onerror = function () {
                resolve('landscape');
            };

            probe.src = photoUrl;
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

    function formatCurrency(value) {
        const parsed = Number(value);

        if (!Number.isFinite(parsed)) {
            return '';
        }

        if (parsed <= 0) {
            return 'Free';
        }

        return 'LKR ' + parsed.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function renderNotFound() {
        const breadcrumbEl = document.getElementById('event-detail-breadcrumb');

        if (breadcrumbEl) {
            breadcrumbEl.textContent = 'Not Found';
        }

        container.innerHTML = `
      <div class="empty-events-state">
        <h3>This Event Could Not Be Found</h3>
        <p>
          It may have been removed, or the link you followed is out of date.
        </p>
      </div>
    `;
    }

    function renderEvent(event, orientation) {
        const title = event.title || 'Event Details';

        document.title = title + ' | SLNA';

        const breadcrumbEl = document.getElementById('event-detail-breadcrumb');

        if (breadcrumbEl) {
            breadcrumbEl.textContent = title;
        }

        const type = event.type || event.event_type || '';
        const status = event.status || '';
        const time = event.time || '';
        const location = event.location || '';
        const audience = event.audience || '';
        const summary = event.summary || '';
        const memberFee = event.member_fee;
        const nonMemberFee = event.non_member_fee;
        const photoUrl = resolvePhotoUrl(event.photo_url || event.photoUrl);
        const attachmentDownloadUrl = (event.attachment_url || event.attachmentUrl)
            ? apiBaseUrl + '/events/' + category + '/' + encodeURIComponent(event.id) + '/attachment'
            : '';

        const factsRows = [];

        factsRows.push(
            '<div><dt>Date</dt><dd>' + escapeHtml(readableDate(event.event_date)) + '</dd></div>'
        );

        if (time) {
            factsRows.push('<div><dt>Time</dt><dd>' + escapeHtml(time) + '</dd></div>');
        }

        if (location) {
            factsRows.push('<div><dt>Location</dt><dd>' + escapeHtml(location) + '</dd></div>');
        }

        if (audience) {
            factsRows.push('<div><dt>For</dt><dd>' + escapeHtml(audience) + '</dd></div>');
        }

        const hasFeeData = memberFee !== undefined && memberFee !== null &&
            nonMemberFee !== undefined && nonMemberFee !== null;

        const hasPayableFee = hasFeeData &&
            (Number(memberFee) > 0 || Number(nonMemberFee) > 0);

        if (hasFeeData) {
            factsRows.push(
                '<div><dt>Event Fee</dt><dd>' +
                'Member: ' + escapeHtml(formatCurrency(memberFee)) +
                '<br>Non-Member: ' + escapeHtml(formatCurrency(nonMemberFee)) +
                '</dd></div>'
            );
        }

        const statusLabel = status === 'Closed'
            ? 'Registration Closed'
            : (status || 'Registration Unavailable');

        const registerMarkup = status === 'Registration Open'
            ? '<a class="btn btn-primary" href="event-registration.html?category=' +
              encodeURIComponent(category) + '&id=' + encodeURIComponent(event.id) +
              '">Register Now</a>'
            : '<span class="event-detail-status-note">' +
              escapeHtml(statusLabel) +
              '</span>';

        const mediaMarkup = photoUrl
            ? '<img src="' + escapeHtml(photoUrl) + '" alt="' + escapeHtml(title) + '">'
            : '<div class="event-detail-media-placeholder"><span>SLNA</span><strong>' +
              (category === 'cpd' ? 'CPD EVENT' : 'EVENT') + '</strong></div>';

        const badgesMarkup =
            (type ? '<span class="event-type-badge">' + escapeHtml(type) + '</span>' : '') +
            (status ? '<span class="event-status-badge ' + statusClass(status) + '">' +
                escapeHtml(status) + '</span>' : '');

        const bankDetailsMarkup = hasPayableFee ? `
      <div class="event-detail-bank-box">
        <h3>Bank Transfer Details</h3>

        <dl class="event-detail-bank-grid">
          <div>
            <dt>Account Name</dt>
            <dd>The Sri Lanka Nurses</dd>
          </div>

          <div>
            <dt>Bank</dt>
            <dd>Bank of Ceylon (BOC)</dd>
          </div>

          <div>
            <dt>Branch</dt>
            <dd>Regent Street, Colombo 10</dd>
          </div>

          <div>
            <dt>Account Number</dt>
            <dd>76034111</dd>
          </div>
        </dl>

        <p class="event-detail-bank-note">
          Transfer the applicable event fee (Member or Non-Member, as shown above)
          to this account, then upload a clear copy of your bank receipt when you register.
        </p>
      </div>
    ` : '';

        const infoCardMarkup = `
      <div class="event-detail-info-card">
        <dl>${factsRows.join('')}</dl>
        <div class="event-detail-register">${registerMarkup}</div>
      </div>
    `;

        const summaryMarkup = (summary || attachmentDownloadUrl) ? `
      <div class="event-detail-summary">
        <h2>About This Event</h2>
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ''}
        ${attachmentDownloadUrl ? `<p class="event-detail-attachment">Read more about the event &mdash; <a href="${attachmentDownloadUrl}">Refer the Attachment</a></p>` : ''}
      </div>
    ` : '';

        // Portrait poster: "About This Event" moves into the same column as
        // the info panel so the page isn't left with a huge gap of empty
        // space next to a very tall image. Landscape/wide photos (and the
        // no-photo placeholder) keep the original layout untouched.
        const layoutMarkup = orientation === 'portrait' ? `
      <div class="event-detail-layout event-detail-layout-portrait">
        <div class="event-detail-left-col">
          ${infoCardMarkup}
          ${summaryMarkup}
        </div>

        <div class="event-detail-media">${mediaMarkup}</div>
      </div>
    ` : `
      <div class="event-detail-layout">
        ${infoCardMarkup}
        <div class="event-detail-media">${mediaMarkup}</div>
      </div>

      ${summaryMarkup}
    `;

        container.innerHTML = `
      <h1 class="event-detail-title">${escapeHtml(title)}</h1>

      <div class="event-detail-badges">${badgesMarkup}</div>

      ${layoutMarkup}

      ${bankDetailsMarkup}
    `;
    }

    async function loadEvent() {
        if (!id) {
            renderNotFound();
            return;
        }

        try {
            const response = await fetch(
                apiBaseUrl + '/events/' + category + '/' + encodeURIComponent(id)
            );

            if (!response.ok) {
                throw new Error('Event not found.');
            }

            const event = await response.json();
            const photoUrl = resolvePhotoUrl(event.photo_url || event.photoUrl);
            const orientation = await detectImageOrientation(photoUrl);

            renderEvent(event, orientation);
        } catch (error) {
            console.error('Could not load event:', error);
            renderNotFound();
        }
    }

    loadEvent();
});
