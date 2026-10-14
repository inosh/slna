// js/executive-committee.js
// Renders the Executive Committee roster and term/AGM details on
// pages/executive-committee.html from the admin-managed backend data
// (routes/executive-committee.js in the backend repo), instead of the
// previously hardcoded markup.

(function () {
  // Seat keys in display order -- grouped the same way the page always
  // has: President/General Secretary/Treasurer featured, then the 3 Vice
  // Presidents, then the remaining 4 seats.
  var GROUPS = [
    { slots: ['president', 'general_secretary', 'treasurer'], gridClass: 'team-grid-3', featured: true },
    { slots: ['vp_hospital', 'vp_education', 'vp_public_health'], gridClass: 'team-grid-3', featured: false },
    { slots: ['asst_secretary_1', 'asst_secretary_2', 'asst_treasurer', 'librarian'], gridClass: 'team-grid-4', featured: false }
  ];

  function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
  }

  function resolveMediaUrl(url) {
    if (!url) return null;
    var apiOrigin = SLNA_CONFIG.API_BASE_URL.replace('/api', '');
    return /^https?:\/\//i.test(url) ? url : apiOrigin + url;
  }

  function ordinalSuffix(n) {
    var v = n % 100;
    if (v >= 11 && v <= 13) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  function ordinal(n) {
    return n + ordinalSuffix(n);
  }

  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  // agm_date comes back as a plain "YYYY-MM-DD" string (see db/pool.js's
  // date type parser in the backend) -- parsed manually so the date never
  // shifts a day from a UTC/local timezone conversion.
  function formatAgmDate(dateStr) {
    var parts = String(dateStr || '').split('-');
    if (parts.length !== 3) return '';
    var year = Number(parts[0]);
    var monthIndex = Number(parts[1]) - 1;
    var day = Number(parts[2]);
    if (!year || monthIndex < 0 || monthIndex > 11 || !day) return '';
    return ordinal(day) + ' ' + MONTH_NAMES[monthIndex] + ' ' + year;
  }

  function renderMemberCard(member, featured) {
    var photoUrl = resolveMediaUrl(member.photo_url);
    var altText = escapeHtml(member.name) + ', ' + escapeHtml(member.role_title);

    return (
      '<div class="member-card' + (featured ? ' featured' : '') + '">' +
        '<div class="member-photo">' +
          (photoUrl ? '<img src="' + photoUrl + '" alt="' + altText + '">' : '') +
        '</div>' +
        '<div class="member-name">' + escapeHtml(member.name) + '</div>' +
        '<div class="member-role">' + escapeHtml(member.role_title) +
          (member.designation ? '<span>' + escapeHtml(member.designation) + '</span>' : '') +
        '</div>' +
      '</div>'
    );
  }

  function renderRoster(members) {
    var byKey = {};
    members.forEach(function (member) { byKey[member.slot_key] = member; });

    return GROUPS.map(function (group) {
      var cards = group.slots
          .map(function (slotKey) { return byKey[slotKey]; })
          .filter(Boolean)
          .map(function (member) { return renderMemberCard(member, group.featured); })
          .join('');

      return '<div class="team-grid ' + group.gridClass + '">' + cards + '</div>';
    }).join('');
  }

  function applyData(data) {
    var rosterEl = document.getElementById('exec-committee-roster');
    var eyebrowEl = document.getElementById('exec-term-eyebrow');
    var agmNoteEl = document.getElementById('exec-agm-note');
    var termNoteEl = document.getElementById('exec-term-note');

    if (data.settings) {
      var termText = data.settings.term_start_year + '–' + data.settings.term_end_year;

      if (eyebrowEl) eyebrowEl.textContent = 'Board of Officers · ' + termText;

      if (agmNoteEl) {
        var agmDateText = formatAgmDate(data.settings.agm_date);
        var note = 'Elected at the ' + ordinal(data.settings.agm_number) + ' Annual General Meeting';
        if (agmDateText) note += ', held on ' + agmDateText;
        if (data.settings.agm_venue) note += ' at ' + data.settings.agm_venue;
        note += '.';
        agmNoteEl.textContent = note;
      }

      if (termNoteEl) {
        termNoteEl.textContent = 'The Board of Officers above was elected for the ' + termText + ' term.';
      }
    }

    if (rosterEl) {
      if (data.members && data.members.length) {
        rosterEl.innerHTML = renderRoster(data.members);
      } else {
        rosterEl.innerHTML = '<div class="empty-table-state">Executive Committee details are not available right now.</div>';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('exec-committee-roster')) return;

    fetch(SLNA_CONFIG.API_BASE_URL + '/executive-committee')
        .then(function (res) {
          if (!res.ok) throw new Error('bad status');
          return res.json();
        })
        .then(applyData)
        .catch(function () {
          var rosterEl = document.getElementById('exec-committee-roster');
          if (rosterEl) {
            rosterEl.innerHTML = '<div class="empty-table-state">Could not load the Executive Committee. Please try again later.</div>';
          }
        });
  });
})();
