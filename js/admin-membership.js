// js/admin-membership.js
// Admin dashboard: Member Directory (all categories, renewal states,
// payments history, record payment / upgrade, renewal links,
// deactivate / reactivate), Renewals (verify or reject online renewals and
// upgrades) and the renewal settings on the Membership Settings tab (grace and
// notice days, upgrade loyalty discounts, reminder emails).
// Talks to /api/membership-admin (routes/membership-members.js).
// Uses showSimpleConfirm, showAlert, escapeHtml (js/admin-panel.js) and
// getToken (js/admin-auth.js).

(function () {
  var API = SLNA_CONFIG.API_BASE_URL;
  var ADMIN = API + '/membership-admin';
  var CATEGORY_LABELS = { LT: 'Lifetime', GM: 'General', AM: 'Associate' };
  var CATEGORY_FULL = { LT: 'Lifetime Membership', GM: 'General Membership', AM: 'Associate Membership' };
  var FEE_KEY = { LT: 'lifetime', GM: 'general', AM: 'associate' };
  var PAGE_SIZE = 50;

  var esc = function (v) { return escapeHtml(v == null ? '' : String(v)); };

  function fmtDate(value) {
    if (!value) return '—';
    var d = new Date(String(value).slice(0, 10) + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(value) {
    if (!value) return '—';
    var d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function money(amount) {
    return 'Rs. ' + Number(amount || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 });
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function api(method, path, body) {
    var options = { method: method, headers: { Authorization: 'Bearer ' + getToken() } };
    if (body instanceof FormData) {
      options.body = body;
    } else if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    var response = await fetch(ADMIN + path, options);
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      throw new Error(data.error || data.message ||
        (response.status === 401 ? 'Your session has expired. Please log in again.' : 'Request failed (' + response.status + ').'));
    }
    return data;
  }

  function stateChip(member) {
    var chip = '<span class="application-status member-state-' + esc(member.state) + '">' + esc(member.stateLabel) + '</span>';
    if (member.hasPendingRenewal) chip += '<span class="md-verify-tag">Payment to verify</span>';
    return chip;
  }

  // Buttons on a directory row, depending on the member and the tab:
  //   deactivated              -> Reactivate
  //   renewal waiting          -> Review Renewal
  //   General / Associate      -> Renew / Upgrade
  //     (Lapsed tab: also Renewal Reminder and Deactivate)
  //   Lifetime                 -> View only
  function rowActions(member, tab) {
    var b = function (action, label, style) {
      return '<button type="button" class="btn ' + (style || 'btn-outline') + ' btn-sm" data-md-row="' + action + '" data-id="' + member.id + '">' + label + '</button>';
    };
    // Each line stays on one row: Lapsed has two lines (Renew / Upgrade +
    // Deactivate, then Renewal Reminder + View); everything else has one.
    var view = '<button type="button" class="btn btn-outline btn-sm" data-md-view="' + member.id + '">View</button>';
    var lines = [];
    if (member.state === 'deactivated') {
      lines.push([b('reactivate', 'Reactivate', 'btn-primary'), view]);
    } else if (member.hasPendingRenewal) {
      lines.push([b('review-renewal', 'Review Renewal', 'btn-primary'), view]);
    } else if (member.category !== 'LT' && tab === 'lapsed') {
      lines.push([b('payment', 'Renew / Upgrade', 'btn-primary'), b('deactivate', 'Deactivate', 'btn-danger')]);
      lines.push([b('reminder', 'Renewal Reminder', 'btn-soft-blue'), view]);
    } else if (member.category !== 'LT') {
      lines.push([b('payment', 'Renew / Upgrade', 'btn-primary'), view]);
    } else {
      lines.push([view]);
    }
    // Members tab (with the extra Working Place column): one button per
    // line, View first.
    if (tab === 'current') {
      lines = lines.reduce(function (all, line) {
        return all.concat(line.map(function (button) { return [button]; }));
      }, []);
      lines.sort(function (a, b) { return (b[0] === view) - (a[0] === view); });
    }
    return '<div class="md-row-actions">' + lines.map(function (line) {
      return '<div class="md-row-actions-line">' + line.join('') + '</div>';
    }).join('') + '</div>';
  }

  // "LT 2199" -> 2199, "W 266" -> 266, for sorting by number.
  function numberValue(value) {
    var match = /\d+/.exec(String(value || ''));
    return match ? Number(match[0]) : -1;
  }

  function switchMainTab(id) {
    var button = document.querySelector('.main-tab-btn[data-maintab="' + id + '"]');
    if (button) button.click();
  }

  // ---------- Generic prompt (reason / membership number) ----------

  function prompt(options) {
    return new Promise(function (resolve) {
      var modal = document.getElementById('md-prompt-modal');
      var input = document.getElementById('md-prompt-input');
      var textarea = document.getElementById('md-prompt-textarea');
      var error = document.getElementById('md-prompt-error');
      var fetchNext = document.getElementById('md-prompt-fetch-next');
      var confirmBtn = document.getElementById('md-prompt-confirm');
      var cancelBtn = document.getElementById('md-prompt-cancel');
      var backdrop = modal.querySelector('.admin-confirm-backdrop');

      document.getElementById('md-prompt-title').textContent = options.title;
      document.getElementById('md-prompt-message').textContent = options.message || '';
      document.getElementById('md-prompt-input-group').hidden = !options.inputLabel;
      document.getElementById('md-prompt-label').textContent = options.inputLabel || '';
      document.getElementById('md-prompt-textarea-group').hidden = !options.textareaLabel;
      document.getElementById('md-prompt-textarea-label').textContent = options.textareaLabel || '';
      input.value = options.inputValue || '';
      textarea.value = '';
      error.textContent = '';
      error.classList.remove('is-visible');
      fetchNext.hidden = !options.fetchNextCategory;
      confirmBtn.textContent = options.confirmText || 'Confirm';
      confirmBtn.className = 'btn ' + (options.danger ? 'btn-danger' : 'btn-primary');

      function done(result) {
        modal.hidden = true;
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        backdrop.removeEventListener('click', onCancel);
        fetchNext.removeEventListener('click', onFetch);
        document.removeEventListener('keydown', onKey);
        resolve(result);
      }
      function onCancel() { done(null); }
      function onKey(e) { if (e.key === 'Escape') done(null); }
      async function onFetch() {
        try {
          input.value = (await api('GET', '/next-number?category=' + options.fetchNextCategory)).membershipNumber;
        } catch (err) {
          error.textContent = err.message;
          error.classList.add('is-visible');
        }
      }
      function onConfirm() {
        var value = { input: input.value.trim(), text: textarea.value.trim() };
        if (options.inputLabel && options.inputRequired && !value.input) {
          error.textContent = options.inputLabel + ' is required.';
          error.classList.add('is-visible');
          input.focus();
          return;
        }
        if (options.textareaLabel && options.textareaRequired && !value.text) {
          error.textContent = options.textareaLabel + ' is required.';
          error.classList.add('is-visible');
          textarea.focus();
          return;
        }
        done(value);
      }

      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
      backdrop.addEventListener('click', onCancel);
      fetchNext.addEventListener('click', onFetch);
      document.addEventListener('keydown', onKey);
      modal.hidden = false;
      window.setTimeout(function () { (options.inputLabel ? input : textarea).focus(); }, 0);
    });
  }

  // ======================================================================
  // Member Directory
  // ======================================================================

  function initDirectory() {
    var tbody = document.getElementById('md-table-body');
    if (!tbody) return null;

    var members = [];
    var activeState = 'current';
    var sort = { key: 'membershipNumber', dir: -1 };
    var page = 1;
    var detailMember = null;
    var searchTimer = null;
    var fees = {};
    var settings = null;

    var searchInput = document.getElementById('md-search');
    var categorySelect = document.getElementById('md-category');
    var recordSelect = document.getElementById('md-record');
    var detailCard = document.getElementById('md-detail-card');

    function query() {
      var params = new URLSearchParams({ state: 'all' });
      if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
      if (categorySelect.value) params.set('category', categorySelect.value);
      if (recordSelect.value) params.set('record', recordSelect.value);
      return params;
    }

    function inState(member) {
      switch (activeState) {
        case 'current': return member.state !== 'deactivated';
        case 'pending_renewal': return member.hasPendingRenewal;
        default: return member.state === activeState;
      }
    }

    function updateCounts() {
      var counts = { current: 0, renewal_due: 0, grace: 0, lapsed: 0, deactivated: 0, pending_renewal: 0 };
      members.forEach(function (m) {
        if (m.state !== 'deactivated') counts.current += 1;
        if (counts[m.state] !== undefined && m.state !== 'current') counts[m.state] += 1;
        if (m.hasPendingRenewal) counts.pending_renewal += 1;
      });
      Object.keys(counts).forEach(function (key) {
        var el = document.querySelector('[data-md-count="' + key + '"]');
        if (el) el.textContent = counts[key];
      });
    }

    // Header badges count every member, whatever the filters.
    async function updateBadges() {
      try {
        var overview = await api('GET', '/overview');
        var current = overview.members.current;
        var badge = document.getElementById('member-directory-total-count');
        if (badge) badge.textContent = current;
        var panel = document.getElementById('member-directory-panel-active-count');
        if (panel) panel.textContent = current + ' Members';
        var rn = document.getElementById('renewals-pending-count');
        if (rn) rn.textContent = overview.pendingRenewals;
      } catch (err) { /* badges are optional */ }
    }

    function sorted(list) {
      return list.slice().sort(function (a, b) {
        var result;
        if (sort.key === 'membershipNumber') {
          result = numberValue(a.membershipNumber) - numberValue(b.membershipNumber) ||
            String(a.membershipNumber).localeCompare(String(b.membershipNumber));
        } else if (sort.key === 'validUntil') {
          // Lifetime (no date) sorts after every date.
          result = String(a.validUntil || '9999').localeCompare(String(b.validUntil || '9999'));
        } else {
          result = String(a.fullName || '').localeCompare(String(b.fullName || ''));
        }
        return result * sort.dir;
      });
    }

    function render() {
      var list = sorted(members.filter(inState));
      var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
      page = Math.min(Math.max(1, page), pages);
      var items = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

      // Working Place: Members tab only.
      var showWorkplace = activeState === 'current';
      document.getElementById('md-workplace-th').hidden = !showWorkplace;
      var columns = showWorkplace ? 7 : 6;

      tbody.innerHTML = items.length ? items.map(function (m) {
        var badge = m.isLegacy ? ' <span class="badge-source badge-manual">Legacy</span>'
          : m.isManualEntry ? ' <span class="badge-source badge-manual">Manually Added</span>' : '';
        return '<tr>' +
          '<td><strong>' + esc(m.membershipNumber) + '</strong></td>' +
          '<td>' + esc(m.fullName) + badge +
          '<br><span class="admin-muted">' + esc([m.nicNumber, m.mobileNumber].filter(Boolean).join(' · ') || 'No NIC or contact details yet') + '</span></td>' +
          (showWorkplace ? '<td class="md-workplace">' + (m.currentWorkingPlace ? esc(m.currentWorkingPlace) : '<span class="admin-muted">—</span>') + '</td>' : '') +
          '<td>' + esc(CATEGORY_LABELS[m.category]) + '</td>' +
          '<td>' + (m.category === 'LT' ? 'Lifetime' : esc(fmtDate(m.validUntil))) + '</td>' +
          '<td>' + stateChip(m) + '</td>' +
          '<td>' + rowActions(m, activeState) + '</td>' +
          '</tr>';
      }).join('') : '<tr><td colspan="' + columns + '" class="empty-table-state">No members to display.</td></tr>';

      var bar = document.getElementById('md-pagination');
      if (list.length <= PAGE_SIZE) {
        bar.innerHTML = '';
      } else {
        bar.innerHTML =
          '<button type="button" class="btn btn-outline btn-sm" data-md-page="-1"' + (page <= 1 ? ' disabled' : '') + '>&larr; Prev</button>' +
          '<span class="pagination-status">Showing ' + ((page - 1) * PAGE_SIZE + 1) + '&ndash;' + Math.min(page * PAGE_SIZE, list.length) + ' of ' + list.length + '</span>' +
          '<button type="button" class="btn btn-outline btn-sm" data-md-page="1"' + (page >= pages ? ' disabled' : '') + '>Next &rarr;</button>';
      }

      document.querySelectorAll('[data-md-sort]').forEach(function (th) {
        var arrow = th.querySelector('.sort-arrow');
        var active = th.getAttribute('data-md-sort') === sort.key;
        arrow.textContent = active ? (sort.dir === 1 ? '▲' : '▼') : '⇕';
        arrow.classList.toggle('sort-arrow-active', active);
      });
    }

    async function load() {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-table-state">Loading members...</td></tr>';
      try {
        members = (await api('GET', '/members?' + query().toString())).members;
        updateCounts();
        render();
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-table-state">' + esc(err.message) + '</td></tr>';
      }
      updateBadges();
    }

    async function loadFeesAndSettings() {
      try {
        var feeList = await (await fetch(API + '/membership-fees')).json();
        fees = {};
        feeList.forEach(function (f) { fees[f.key] = f; });
        settings = await api('GET', '/settings');
      } catch (err) { /* used only to pre-fill amounts */ }
    }

    // ---- Member detail ----

    function dl(rows) {
      return '<dl>' + rows.filter(function (r) { return r[1] !== null && r[1] !== undefined && r[1] !== ''; }).map(function (r) {
        return '<div><dt>' + esc(r[0]) + '</dt><dd>' + (r[2] ? r[1] : esc(r[1])) + '</dd></div>';
      }).join('') + '</dl>';
    }

    function renewalKindText(r) {
      return r.kind === 'upgrade'
        ? 'Upgrade ' + CATEGORY_LABELS[r.fromCategory] + ' → ' + CATEGORY_LABELS[r.toCategory]
        : 'Renewal (' + CATEGORY_LABELS[r.toCategory] + ')';
    }

    async function openDetail(id, options) {
      options = options || {};
      detailCard.hidden = false;
      document.getElementById('md-detail-body').innerHTML = '<p class="admin-muted">Loading...</p>';
      document.getElementById('md-detail-actions').innerHTML = '';
      if (!options.keepAlert) document.getElementById('md-detail-alert').innerHTML = '';

      var data;
      try {
        data = await api('GET', '/members/' + id);
      } catch (err) {
        document.getElementById('md-detail-body').innerHTML = '<p class="admin-muted">' + esc(err.message) + '</p>';
        return;
      }

      var m = data.member;
      detailMember = data;
      document.getElementById('md-detail-title').textContent = m.membershipNumber + ' · ' + m.fullName;
      document.getElementById('md-detail-subtitle').innerHTML = esc(CATEGORY_FULL[m.category]) + ' · ' + stateChip(m);

      var joinedThrough = m.isLegacy ? 'Old records (legacy)' : m.isManualEntry ? 'Added by an admin' : 'Online application' + (m.referenceNumber ? ' (' + m.referenceNumber + ')' : '');
      var membership = dl([
        ['Membership number', m.membershipNumber],
        ['Category', CATEGORY_FULL[m.category]],
        ['Status', m.stateLabel],
        ['Member since', m.joinedOn ? fmtDate(m.joinedOn) : ''],
        ['In this category since', m.categorySince && m.categorySince !== m.joinedOn ? fmtDate(m.categorySince) : ''],
        ['Valid until', m.category === 'LT' ? 'Lifetime' : fmtDate(m.validUntil)],
        ['Grace period ends', m.category !== 'LT' ? fmtDate(m.graceEnds) : ''],
        ['Joined through', joinedThrough],
        ['Previous numbers (reserved)', data.previousNumbers.map(function (p) { return p.membership_number; }).join(', ')],
        ['Deactivated', m.deactivatedAt ? fmtDateTime(m.deactivatedAt) + (m.deactivatedReason ? ' — ' + m.deactivatedReason : '') : ''],
        ['Internal note', m.adminNote]
      ]);

      var contact = dl([
        ['NIC', m.nicNumber],
        ['Mobile', m.mobileNumber],
        ['Email', m.emailAddress],
        [m.category === 'AM' ? 'Nursing school / university' : 'Working place', m.currentWorkingPlace],
        ['Designation', m.designation],
        ['Student number', m.studentNumber],
        ['SLNC registration', m.slncRegistrationNumber]
      ]);

      var payments = data.renewals.length
        ? '<div class="table-scroll"><table class="news-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th><th>Status</th><th>Valid until</th></tr></thead><tbody>' +
          data.renewals.map(function (r) {
            return '<tr><td>' + esc(fmtDate(r.paymentDate || r.createdAt)) + '</td>' +
              '<td>' + esc(renewalKindText(r)) + (r.recordedByAdmin ? '<br><span class="admin-muted">Recorded by admin</span>' : '<br><span class="admin-muted">Submitted online</span>') + '</td>' +
              '<td>' + esc(money(r.amount)) + (r.discountAmount > 0 ? '<br><span class="admin-muted">' + esc(money(r.discountAmount)) + ' discount</span>' : '') + '</td>' +
              '<td>' + esc(r.paymentReference || '') + '</td>' +
              '<td>' + esc(r.status) + (r.reviewedByName ? '<br><span class="admin-muted">by ' + esc(r.reviewedByName) + '</span>' : '') + '</td>' +
              '<td>' + (r.status === 'verified' ? (r.newValidUntil ? esc(fmtDate(r.newValidUntil)) : 'Lifetime') : '—') +
              (r.newMembershipNumber && r.newMembershipNumber !== r.previousMembershipNumber ? '<br><span class="admin-muted">' + esc(r.previousMembershipNumber) + ' → ' + esc(r.newMembershipNumber) + '</span>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p class="admin-muted">No renewals or upgrades yet.</p>';

      var reminders = m.category === 'LT' ? '' : (data.reminders.length
        ? '<ul class="md-reminder-list">' + data.reminders.map(function (r) {
          return '<li>' + esc(fmtDateTime(r.created_at)) + ' · ' + esc(r.kind.replace(/_/g, ' ')) + ' · ' + esc(r.status) + (r.detail ? ' (' + esc(r.detail) + ')' : '') + '</li>';
        }).join('') + '</ul>'
        : '<p class="admin-muted">No reminder emails yet.</p>');

      document.getElementById('md-detail-body').innerHTML =
        '<section class="review-section"><h3>Membership</h3>' + membership + '</section>' +
        '<section class="review-section"><h3>Contact &amp; Details</h3>' + contact + '</section>' +
        '<section class="review-section md-detail-wide"><h3>Payments &amp; Renewals</h3>' + payments + '</section>' +
        (m.category === 'LT' ? '' : '<section class="review-section md-detail-wide"><h3>Reminder Emails</h3>' + reminders + '</section>');

      var actions = ['<button type="button" class="btn btn-outline btn-sm" data-md-action="edit">Edit Details</button>'];
      if (m.isActive) {
        if (m.hasPendingRenewal) {
          actions.push('<button type="button" class="btn btn-primary btn-sm" data-md-action="review-renewal">Review Renewal</button>');
        } else if (m.category !== 'LT' || data.upgrades.length) {
          actions.push('<button type="button" class="btn btn-primary btn-sm" data-md-action="payment">' + (m.category === 'LT' ? 'Record Upgrade' : 'Record Payment (Renew / Upgrade)') + '</button>');
        }
        if (m.category !== 'LT') {
          actions.push('<button type="button" class="btn btn-outline btn-sm" data-md-action="copy-link">Copy Renewal Link</button>');
          actions.push('<button type="button" class="btn btn-outline btn-sm" data-md-action="email-link"' + (m.emailAddress ? '' : ' disabled title="No email address on record"') + '>Email Renewal Link</button>');
        }
        actions.push('<button type="button" class="btn btn-danger btn-sm" data-md-action="deactivate">Deactivate</button>');
      } else {
        actions.push('<button type="button" class="btn btn-primary btn-sm" data-md-action="reactivate">Reactivate</button>');
      }
      document.getElementById('md-detail-actions').innerHTML = actions.join(' ');

      if (!options.noScroll) detailCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function refreshDetail(message) {
      if (!detailMember) return;
      await load();
      await openDetail(detailMember.member.id, { keepAlert: true, noScroll: true });
      if (message) showAlert('md-detail-alert', message, 'success');
    }

    // ---- Edit / add member (reuses #member-edit-modal) ----

    var FIELD_MAP = [
      ['fullName', 'member-edit-full-name'],
      ['nameWithInitials', 'member-edit-name-with-initials'],
      ['title', 'member-edit-title'],
      ['nicNumber', 'member-edit-nic'],
      ['dateOfBirth', 'member-edit-dob'],
      ['sex', 'member-edit-sex'],
      ['maritalStatus', 'member-edit-marital-status'],
      ['permanentAddress', 'member-edit-permanent-address'],
      ['currentWorkingPlace', 'member-edit-working-place'],
      ['officialAddress', 'member-edit-official-address'],
      ['mobileNumber', 'member-edit-mobile'],
      ['whatsappNumber', 'member-edit-whatsapp'],
      ['residentialNumber', 'member-edit-residential'],
      ['officeNumber', 'member-edit-office-number'],
      ['emailAddress', 'member-edit-email'],
      ['slncRegistrationNumber', 'member-edit-slnc-number'],
      ['slncRegistrationDate', 'member-edit-slnc-date'],
      ['designation', 'member-edit-designation'],
      ['firstAppointmentDate', 'member-edit-first-appointment-date'],
      ['firstAppointmentPlace', 'member-edit-first-appointment-place'],
      ['nursingSchool', 'member-edit-nursing-school'],
      ['batch', 'member-edit-batch'],
      ['higherEducationalQualification', 'member-edit-higher-qualification'],
      ['studentNumber', 'member-edit-student-number'],
      ['instituteRegistrationDate', 'member-edit-institute-date'],
      ['joinedOn', 'member-edit-joined-on'],
      ['validUntil', 'member-edit-valid-until'],
      ['adminNote', 'member-edit-admin-note']
    ];

    var modal = document.getElementById('member-edit-modal');
    var form = document.getElementById('member-edit-form');
    var numberInput = document.getElementById('member-edit-membership-number');
    var categoryInput = document.getElementById('member-edit-category');
    var editing = null; // { mode: 'edit'|'add'|'legacy', member }

    function show(id, visible) {
      var el = document.getElementById(id);
      if (el) el.hidden = !visible;
    }

    function syncCategoryFields() {
      var category = editing.mode === 'edit' ? editing.member.category : categoryInput.value;
      var associate = category === 'AM';
      show('member-edit-valid-group', category !== 'LT');
      var student = associate || (editing.member && (editing.member.studentNumber || editing.member.instituteRegistrationDate));
      show('member-edit-student-number-group', student);
      show('member-edit-institute-date-group', student);

      // Associate members are students: job fields (SLNC, designation,
      // first appointment, official address) are hidden and not sent.
      modal.querySelectorAll('[data-member-work]').forEach(function (group) {
        group.hidden = associate;
      });
      var workLabel = document.getElementById('member-edit-working-place-label');
      if (workLabel) workLabel.textContent = associate ? 'Current Nursing School / University' : 'Current Working Place';
    }

    function openEdit(mode, member) {
      editing = { mode: mode, member: member || null };
      var isAdd = mode !== 'edit';

      document.getElementById('member-edit-modal-title').textContent =
        mode === 'edit' ? 'Update Member Details' : mode === 'legacy' ? 'Add Legacy Member' : 'Add Member';
      document.getElementById('member-edit-alert').innerHTML = '';
      document.getElementById('member-edit-create-info').style.display = isAdd ? '' : 'none';
      document.getElementById('member-edit-create-info-text').textContent = mode === 'legacy'
        ? 'For members from the pre-digital records. Only Membership Number and Name with Initials are required; the rest can be filled in later.'
        : 'For members accepted outside the online application (e.g. a paper form). Only Membership Number and Name with Initials are required.';

      FIELD_MAP.forEach(function (pair) {
        var input = document.getElementById(pair[1]);
        if (!input) return;
        input.disabled = false;
        input.value = member && member[pair[0]] != null ? member[pair[0]] : '';
      });

      numberInput.value = member ? member.membershipNumber : '';
      numberInput.disabled = !isAdd;
      document.getElementById('member-edit-membership-number-help').textContent = isAdd
        ? (mode === 'legacy'
            ? 'As on the old records. Saved as LT + four digits: 85 becomes LT 0085, 2085 becomes LT 2085. Old formats such as G 23 are kept as typed.'
            : 'e.g. GM 0012, AM 0005 or LT 2200. Use Fetch Next for the next free number.')
        : 'Changes only through an upgrade (Record Payment).';
      document.getElementById('member-edit-fetch-next-membership-number').style.display = mode === 'add' ? '' : 'none';
      document.getElementById('member-edit-membership-number-asterisk').style.display = isAdd ? '' : 'none';
      document.getElementById('member-edit-name-with-initials-asterisk').style.display = '';
      document.getElementById('member-edit-full-name-help').style.display = isAdd ? '' : 'none';

      categoryInput.value = member ? member.category : 'LT';
      show('member-edit-category-group', isAdd);
      // Legacy members come from the old lifetime roll: always Lifetime.
      categoryInput.disabled = mode === 'legacy';
      if (mode === 'legacy') categoryInput.value = 'LT';
      document.getElementById('member-edit-category-help').textContent = mode === 'legacy'
          ? 'Legacy members are always Lifetime members.'
          : 'Change a category later with Record Payment (upgrade).';
      show('member-edit-joined-group', true);
      show('member-edit-admin-note-group', true);
      if (!member && mode === 'add') document.getElementById('member-edit-joined-on').value = today();

      var deactivate = document.getElementById('member-edit-deactivate');
      if (deactivate) deactivate.hidden = true;
      var submit = document.getElementById('member-edit-submit');
      submit.style.display = '';
      submit.textContent = isAdd ? 'Add Member' : 'Save Changes';
      document.getElementById('member-edit-cancel').textContent = 'Cancel';

      syncCategoryFields();
      modal.hidden = false;
      var dialog = modal.querySelector('.admin-edit-dialog');
      if (dialog) dialog.scrollTop = 0;
    }

    function closeEdit() {
      modal.hidden = true;
      editing = null;
    }

    async function submitEdit(e) {
      e.preventDefault();
      if (!editing) return;

      var body = {};
      FIELD_MAP.forEach(function (pair) {
        var input = document.getElementById(pair[1]);
        if (!input || input.closest('[hidden]')) return;
        body[pair[0]] = input.value.trim();
      });
      if (editing.mode === 'edit' && editing.member.category === 'LT') delete body.validUntil;

      if (!body.nameWithInitials) {
        showAlert('member-edit-alert', 'Name with Initials is required.', 'error');
        return;
      }

      var submit = document.getElementById('member-edit-submit');
      submit.disabled = true;
      try {
        if (editing.mode === 'edit') {
          await api('PUT', '/members/' + editing.member.id, body);
          closeEdit();
          await refreshDetail('Member details saved.');
        } else {
          body.membershipNumber = numberInput.value.trim();
          body.category = categoryInput.value;
          body.source = editing.mode === 'legacy' ? 'legacy' : 'manual';
          if (!body.membershipNumber) {
            showAlert('member-edit-alert', 'Membership Number is required.', 'error');
            return;
          }
          var result = await api('POST', '/members', body);
          closeEdit();
          await load();
          showAlert('md-alert', 'Member ' + result.member.membershipNumber + ' added.', 'success');
          openDetail(result.member.id);
        }
      } catch (err) {
        showAlert('member-edit-alert', err.message, 'error');
      } finally {
        submit.disabled = false;
      }
    }

    // ---- Record payment (renew / upgrade) ----

    var paymentModal = document.getElementById('md-payment-modal');
    var kindSelect = document.getElementById('md-payment-kind');

    function discountFor(member, to) {
      var tiers = settings && settings.upgradeDiscounts ? settings.upgradeDiscounts[member.category + '-' + to] || [] : [];
      var since = member.categorySince || member.joinedOn;
      if (!since || !tiers.length) return 0;
      var years = new Date().getFullYear() - Number(since.slice(0, 4));
      if (today().slice(5) < since.slice(5)) years -= 1;
      var tier = tiers.filter(function (t) { return years >= t.years; }).pop();
      return tier ? tier.amount : 0;
    }

    var paymentMode = 'payment'; // 'payment' | 'reactivate'

    var WORK_INPUTS = [
      ['currentWorkingPlace', 'md-work-place', 'Current working place', true],
      ['officialAddress', 'md-work-official-address', 'Official address', true],
      ['designation', 'md-work-designation', 'Designation', true],
      ['firstAppointmentDate', 'md-work-first-date', 'First appointment date', true],
      ['firstAppointmentPlace', 'md-work-first-place', 'First appointment place', true],
      ['slncRegistrationNumber', 'md-work-slnc-number', 'SLNC registration number', false],
      ['slncRegistrationDate', 'md-work-slnc-date', 'SLNC registration date', false]
    ];

    // An Associate upgrading to General / Lifetime gives their work details.
    function needsWork(member, value) {
      return member.category === 'AM' && /^upgrade:(GM|LT)$/.test(value);
    }

    function syncPaymentKind() {
      var member = detailMember.member;
      var value = kindSelect.value;
      var reactivateOnly = value === 'reactivate';

      // "Reactivate only" records no payment: hide the payment fields.
      ['md-payment-amount', 'md-payment-date', 'md-payment-reference', 'md-payment-note'].forEach(function (id) {
        document.getElementById(id).closest('.form-group').hidden = reactivateOnly;
      });
      show('md-payment-work', !reactivateOnly && needsWork(member, value));
      show('md-payment-number-group', !reactivateOnly && value !== 'renewal');
      document.getElementById('md-payment-number').value = '';
      document.getElementById('md-payment-save').textContent = paymentMode === 'reactivate'
        ? (reactivateOnly ? 'Reactivate' : 'Reactivate & Record Payment')
        : 'Record Payment';
      if (reactivateOnly) return;

      var to = value === 'renewal' ? member.category : value.slice(8);
      var fee = fees[FEE_KEY[to]];
      var base = fee && fee.amount !== null ? fee.amount : 0;
      var discount = value === 'renewal' ? 0 : discountFor(member, to);
      document.getElementById('md-payment-amount').value = Math.max(0, base - discount);
      document.getElementById('md-payment-amount-help').textContent = discount > 0
        ? 'Fee ' + money(base) + ' less a ' + money(discount) + ' loyalty discount.'
        : 'The current ' + CATEGORY_LABELS[to] + ' fee. Change it if a different amount was paid.';
      if (value !== 'renewal') fetchPaymentNumber(to);
    }

    async function fetchPaymentNumber(to) {
      try {
        document.getElementById('md-payment-number').value = (await api('GET', '/next-number?category=' + to)).membershipNumber;
      } catch (err) { /* type it in */ }
    }

    // mode 'reactivate': for a deactivated General / Associate member, with
    // "Reactivate only" as the first choice (as in SLICNA).
    async function openPayment(mode) {
      if (!detailMember) return;
      if (!settings) await loadFeesAndSettings();
      paymentMode = mode === 'reactivate' ? 'reactivate' : 'payment';
      var member = detailMember.member;
      var options = [];
      if (paymentMode === 'reactivate') options.push('<option value="reactivate">Reactivate only (no payment)</option>');
      if (member.category !== 'LT') options.push('<option value="renewal">Renewal: 12 more months of ' + esc(CATEGORY_LABELS[member.category]) + '</option>');
      detailMember.upgrades.forEach(function (to) {
        options.push('<option value="upgrade:' + to + '">Upgrade to ' + esc(CATEGORY_FULL[to]) + '</option>');
      });
      kindSelect.innerHTML = options.join('');
      document.getElementById('md-payment-title').textContent =
        (paymentMode === 'reactivate' ? 'Reactivate · ' : 'Renew / Upgrade · ') + member.membershipNumber;
      document.getElementById('md-payment-intro').textContent = paymentMode === 'reactivate'
        ? member.fullName + ' becomes active again with the same number. You can also record a renewal or upgrade paid at the same time. The member and the secretary are emailed.'
        : 'Record a renewal or upgrade paid outside the website. It is verified straight away and the member is emailed.';
      document.getElementById('md-payment-date').value = today();
      document.getElementById('md-payment-reference').value = '';
      document.getElementById('md-payment-note').value = '';
      document.getElementById('md-payment-alert').innerHTML = '';
      WORK_INPUTS.forEach(function (w) {
        document.getElementById(w[1]).value = member[w[0]] || '';
      });
      syncPaymentKind();
      paymentModal.hidden = false;
    }

    async function savePayment() {
      var member = detailMember.member;
      var value = kindSelect.value;
      var reactivating = paymentMode === 'reactivate';

      if (reactivating && value === 'reactivate') {
        if (!(await showSimpleConfirm({
          title: 'Reactivate ' + member.membershipNumber + '?',
          message: member.fullName + ' becomes an active member again with the same number and dates. The member and the secretary are emailed.',
          confirmText: 'Reactivate',
          danger: false
        }))) return;
        await submitPayment('/reactivate', {}, 'Member reactivated.');
        return;
      }

      var to = value === 'renewal' ? member.category : value.slice(8);
      var body = {
        kind: value === 'renewal' ? 'renewal' : 'upgrade',
        to_category: to,
        amount: document.getElementById('md-payment-amount').value,
        payment_date: document.getElementById('md-payment-date').value,
        payment_reference: document.getElementById('md-payment-reference').value.trim(),
        status_note: document.getElementById('md-payment-note').value.trim(),
        membership_number: document.getElementById('md-payment-number').value.trim()
      };

      if (needsWork(member, value)) {
        for (var i = 0; i < WORK_INPUTS.length; i += 1) {
          var w = WORK_INPUTS[i];
          var input = document.getElementById(w[1]);
          body[w[0]] = input.value.trim();
          if (w[3] && !body[w[0]]) {
            showAlert('md-payment-alert', w[2] + ' is required for General or Lifetime membership.', 'error');
            input.focus();
            return;
          }
        }
      }

      var confirmed = await showSimpleConfirm({
        title: body.kind === 'upgrade'
          ? (reactivating ? 'Reactivate and upgrade to ' : 'Upgrade to ') + CATEGORY_FULL[to] + '?'
          : (reactivating ? 'Reactivate and renew?' : 'Record renewal?'),
        message: (reactivating ? member.fullName + ' becomes active again. ' : '') + (body.kind === 'upgrade'
          ? member.fullName + ' becomes a ' + CATEGORY_FULL[to] + ' member with number ' + (body.membership_number || 'the next free number') + '. ' + member.membershipNumber + ' is kept on record and never reused. The member is emailed.'
          : member.membershipNumber + ' is extended by 12 months and the member is emailed.'),
        confirmText: reactivating ? 'Reactivate' : (body.kind === 'upgrade' ? 'Upgrade' : 'Record Renewal'),
        danger: false
      });
      if (!confirmed) return;

      await submitPayment(reactivating ? '/reactivate' : '/payments', body,
        reactivating ? 'Member reactivated and payment recorded.' : (body.kind === 'upgrade' ? 'Upgrade recorded.' : 'Renewal recorded.'));
    }

    async function submitPayment(path, body, message) {
      var button = document.getElementById('md-payment-save');
      button.disabled = true;
      try {
        await api('POST', '/members/' + detailMember.member.id + path, body);
        paymentModal.hidden = true;
        await refreshDetail(message);
        detailCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        showAlert('md-payment-alert', err.message, 'error');
      } finally {
        button.disabled = false;
      }
    }

    // ---- Detail actions ----

    async function onDetailAction(action) {
      var member = detailMember && detailMember.member;
      if (!member) return;

      if (action === 'edit') {
        openEdit('edit', member);
      } else if (action === 'payment') {
        openPayment();
      } else if (action === 'review-renewal') {
        switchMainTab('maintab-renewals');
        if (window.SLNA_OPEN_RENEWAL) window.SLNA_OPEN_RENEWAL(member.pendingRenewalId);
      } else if (action === 'copy-link' || action === 'email-link') {
        var sendEmail = action === 'email-link';
        if (sendEmail && !(await showSimpleConfirm({
          title: 'Email renewal link?',
          message: 'A personal renewal link (valid for 90 days) will be emailed to ' + member.emailAddress + '.',
          confirmText: 'Send Email',
          danger: false
        }))) return;
        try {
          var result = await api('POST', '/members/' + member.id + '/renewal-link', { send_email: sendEmail });
          var copied = false;
          if (!sendEmail && navigator.clipboard) {
            copied = await navigator.clipboard.writeText(result.url).then(function () { return true; }, function () { return false; });
          }
          document.getElementById('md-detail-alert').className = '';
          document.getElementById('md-detail-alert').innerHTML =
            '<div class="alert alert-' + (sendEmail && !result.emailed ? 'error' : 'success') + '">' +
            (sendEmail
              ? (result.emailed ? 'Renewal link emailed to ' + esc(member.emailAddress) + '.' : 'The email could not be sent (email may be turned off). You can send this link by WhatsApp or SMS instead:')
              : (copied ? 'Renewal link copied. ' : '') + 'Send this link to the member (valid for 90 days):') +
            '<br><input type="text" readonly class="md-link-box" value="' + esc(result.url) + '"></div>';
        } catch (err) {
          showAlert('md-detail-alert', err.message, 'error');
        }
      } else if (action === 'deactivate') {
        var answer = await prompt({
          title: 'Deactivate ' + member.membershipNumber + '?',
          message: member.fullName + ' moves to Deactivated and gets no renewal reminders. Nothing is deleted; you can reactivate later.',
          textareaLabel: 'Reason (internal)',
          confirmText: 'Deactivate',
          danger: true
        });
        if (!answer) return;
        try {
          await api('POST', '/members/' + member.id + '/deactivate', { reason: answer.text });
          await refreshDetail('Member deactivated.');
        } catch (err) {
          showAlert('md-detail-alert', err.message, 'error');
        }
      } else if (action === 'reactivate') {
        // General / Associate: reactivate only, or renew / upgrade at the
        // same time. Lifetime: a simple confirm.
        if (member.category !== 'LT') {
          openPayment('reactivate');
          return;
        }
        if (!(await showSimpleConfirm({
          title: 'Reactivate ' + member.membershipNumber + '?',
          message: member.fullName + ' becomes an active member again with the same number. The member and the secretary are emailed.',
          confirmText: 'Reactivate',
          danger: false
        }))) return;
        try {
          await api('POST', '/members/' + member.id + '/reactivate');
          await refreshDetail('Member reactivated.');
        } catch (err) {
          showAlert('md-detail-alert', err.message, 'error');
        }
      }
    }

    // ---- Wiring ----

    document.querySelectorAll('[data-md-state]').forEach(function (button) {
      button.addEventListener('click', function () {
        activeState = button.getAttribute('data-md-state');
        document.querySelectorAll('[data-md-state]').forEach(function (b) { b.classList.toggle('active', b === button); });
        page = 1;
        render();
      });
    });

    document.querySelectorAll('[data-md-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.getAttribute('data-md-sort');
        if (sort.key === key) {
          sort.dir *= -1;
        } else {
          sort.key = key;
          sort.dir = key === 'membershipNumber' ? -1 : 1;
        }
        render();
      });
    });

    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () { page = 1; load(); }, 300);
    });
    categorySelect.addEventListener('change', function () { page = 1; load(); });
    recordSelect.addEventListener('change', function () { page = 1; load(); });
    document.getElementById('md-refresh').addEventListener('click', load);

    document.getElementById('md-download').addEventListener('click', async function () {
      var button = this;
      button.disabled = true;
      try {
        var params = query();
        params.set('state', activeState === 'current' ? '' : activeState);
        var res = await fetch(API + '/member-directory/export?' + params.toString(), { headers: { Authorization: 'Bearer ' + getToken() } });
        if (!res.ok) throw new Error('Could not download the member list.');
        var url = URL.createObjectURL(await res.blob());
        var a = document.createElement('a');
        a.href = url;
        a.download = 'slna-member-directory.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      } catch (err) {
        showAlert('md-alert', err.message, 'error');
      } finally {
        button.disabled = false;
      }
    });

    document.getElementById('md-pagination').addEventListener('click', function (e) {
      var button = e.target.closest('[data-md-page]');
      if (!button) return;
      page += Number(button.getAttribute('data-md-page'));
      render();
    });

    tbody.addEventListener('click', async function (e) {
      var view = e.target.closest('[data-md-view]');
      if (view) {
        openDetail(view.getAttribute('data-md-view'));
        return;
      }
      // Row actions load the member (in the detail card below) and run the
      // same action as the detail card's buttons.
      var row = e.target.closest('[data-md-row]');
      if (!row) return;
      row.disabled = true;
      try {
        await openDetail(row.getAttribute('data-id'), { noScroll: true });
        var action = row.getAttribute('data-md-row');
        if (action === 'reminder') {
          action = detailMember && detailMember.member.emailAddress ? 'email-link' : 'copy-link';
        }
        await onDetailAction(action);
        // Results (e.g. the renewal link) show in the member card.
        if (!detailCard.hidden && action !== 'payment' && action !== 'reactivate' && action !== 'review-renewal') {
          detailCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } finally {
        row.disabled = false;
      }
    });

    document.getElementById('md-detail-close').addEventListener('click', function () {
      detailCard.hidden = true;
      detailMember = null;
    });

    document.getElementById('md-detail-actions').addEventListener('click', function (e) {
      var button = e.target.closest('[data-md-action]');
      if (button) onDetailAction(button.getAttribute('data-md-action'));
    });

    document.getElementById('md-add-member').addEventListener('click', function () { openEdit('add'); });
    document.getElementById('md-add-legacy').addEventListener('click', function () { openEdit('legacy'); });
    categoryInput.addEventListener('change', syncCategoryFields);
    form.addEventListener('submit', submitEdit);
    document.getElementById('member-edit-cancel').addEventListener('click', closeEdit);
    document.getElementById('member-edit-close').addEventListener('click', closeEdit);
    modal.querySelector('.admin-confirm-backdrop').addEventListener('click', closeEdit);
    document.getElementById('member-edit-fetch-next-membership-number').addEventListener('click', async function () {
      try {
        numberInput.value = (await api('GET', '/next-number?category=' + categoryInput.value)).membershipNumber;
      } catch (err) {
        showAlert('member-edit-alert', err.message, 'error');
      }
    });

    kindSelect.addEventListener('change', syncPaymentKind);
    document.getElementById('md-payment-save').addEventListener('click', savePayment);
    document.getElementById('md-payment-cancel').addEventListener('click', function () { paymentModal.hidden = true; });
    paymentModal.querySelector('.admin-confirm-backdrop').addEventListener('click', function () { paymentModal.hidden = true; });
    document.getElementById('md-payment-fetch-next').addEventListener('click', function () {
      var value = kindSelect.value;
      if (value !== 'renewal') fetchPaymentNumber(value.slice(8));
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!paymentModal.hidden) paymentModal.hidden = true;
      else if (!modal.hidden && editing) closeEdit();
    });

    loadFeesAndSettings();
    load();

    return {
      reload: load,
      openMember: function (id) {
        switchMainTab('maintab-member-directory');
        openDetail(id);
      },
      updateBadges: updateBadges
    };
  }

  // ======================================================================
  // Renewals
  // ======================================================================

  function initRenewals(directory) {
    var tbody = document.getElementById('rn-table-body');
    if (!tbody) return;

    var status = 'pending';
    var renewals = [];
    var current = null;
    var card = document.getElementById('rn-review-card');

    function kindText(r) {
      return r.kind === 'upgrade'
        ? 'Upgrade ' + CATEGORY_LABELS[r.fromCategory] + ' → ' + CATEGORY_LABELS[r.toCategory]
        : 'Renewal of ' + CATEGORY_LABELS[r.toCategory];
    }

    async function loadCounts() {
      try {
        var counts = (await api('GET', '/renewals/counts')).counts;
        Object.keys(counts).forEach(function (key) {
          var el = document.querySelector('[data-rn-count="' + key + '"]');
          if (el) el.textContent = counts[key];
        });
        var badge = document.getElementById('renewals-pending-count');
        if (badge) badge.textContent = counts.pending;
      } catch (err) { /* optional */ }
    }

    async function load() {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-table-state">Loading renewals...</td></tr>';
      loadCounts();
      try {
        renewals = (await api('GET', '/renewals?status=' + status)).renewals;
        tbody.innerHTML = renewals.length ? renewals.map(function (r) {
          return '<tr>' +
            '<td>' + esc(fmtDateTime(r.createdAt)) + '</td>' +
            '<td><strong>' + esc(r.membershipNumber) + '</strong><br><span class="admin-muted">' + esc(r.memberName) + '</span></td>' +
            '<td>' + esc(kindText(r)) + (r.recordedByAdmin ? '<br><span class="admin-muted">Recorded by admin</span>' : '') + '</td>' +
            '<td>' + esc(money(r.amount)) + '</td>' +
            '<td>' + esc(r.paymentReference || '') + '</td>' +
            '<td><span class="application-status status-' + (r.status === 'verified' ? 'approved' : r.status) + '">' + esc(r.status === 'pending' ? 'To verify' : r.status) + '</span></td>' +
            '<td><button type="button" class="btn btn-outline btn-sm" data-rn-review="' + r.id + '">Review</button></td>' +
            '</tr>';
        }).join('') : '<tr><td colspan="7" class="empty-table-state">No renewals to display.</td></tr>';
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-table-state">' + esc(err.message) + '</td></tr>';
      }
    }

    function dl(rows) {
      return '<dl>' + rows.filter(function (r) { return r[1]; }).map(function (r) {
        return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
      }).join('') + '</dl>';
    }

    function openReview(r) {
      current = r;
      card.hidden = false;
      document.getElementById('rn-review-title').textContent = kindText(r) + ' · ' + r.membershipNumber;
      document.getElementById('rn-review-subtitle').textContent = r.memberName + ' · submitted ' + fmtDateTime(r.createdAt);

      var after = r.status === 'verified'
        ? (r.newValidUntil ? fmtDate(r.newValidUntil) : 'Lifetime')
        : (r.toCategory === 'LT' ? 'Lifetime' : 'One year more, set when verified');

      document.getElementById('rn-review-body').innerHTML =
        '<section class="review-section"><h3>Payment</h3>' + dl([
          ['Type', kindText(r)],
          ['Amount', money(r.amount) + (r.discountAmount > 0 ? ' (after ' + money(r.discountAmount) + ' loyalty discount)' : '')],
          ['Reference', r.paymentReference],
          ['Paid on', fmtDate(r.paymentDate)],
          ['Valid until before', r.previousValidUntil ? fmtDate(r.previousValidUntil) : 'Lifetime'],
          ['Valid until after', after],
          ['Number', r.newMembershipNumber && r.newMembershipNumber !== r.previousMembershipNumber ? r.previousMembershipNumber + ' → ' + r.newMembershipNumber : ''],
          ['Status', r.status + (r.reviewedByName ? ' by ' + r.reviewedByName : '') + (r.reviewedAt ? ' on ' + fmtDateTime(r.reviewedAt) : '')],
          ['Note', r.statusNote]
        ]) +
        (r.hasReceipt ? '<button type="button" class="btn btn-outline btn-sm" id="rn-view-slip">View Payment Slip</button>' : '<p class="admin-muted">No slip (recorded by an admin).</p>') +
        '</section>' +
        '<section class="review-section"><h3>Contact details to update</h3>' +
        (r.emailAddress || r.mobileNumber || r.currentWorkingPlace
          ? dl([['Email', r.emailAddress], ['Mobile', r.mobileNumber], ['Working place', r.currentWorkingPlace]]) + '<p class="admin-muted">Copied to the member record when verified.</p>'
          : '<p class="admin-muted">No changes.</p>') +
        '</section>';

      var actions = [];
      if (r.status === 'pending') {
        actions.push('<button type="button" class="btn btn-danger" data-rn-action="reject">Reject</button>');
        actions.push('<button type="button" class="btn btn-primary" data-rn-action="verify">Verify ' + (r.kind === 'upgrade' ? 'Upgrade' : 'Renewal') + '</button>');
      }
      actions.push('<button type="button" class="btn btn-outline" data-rn-action="member">Open Member</button>');
      document.getElementById('rn-review-actions').innerHTML = actions.join('');
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function viewSlip() {
      var win = window.open('', '_blank');
      try {
        var res = await fetch(ADMIN + '/renewals/' + current.id + '/receipt', { headers: { Authorization: 'Bearer ' + getToken() } });
        if (!res.ok) throw new Error('The payment slip could not be opened.');
        var url = URL.createObjectURL(await res.blob());
        if (win) win.location.replace(url); else window.open(url, '_blank');
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      } catch (err) {
        if (win) win.close();
        showAlert('rn-alert', err.message, 'error');
      }
    }

    async function onAction(action) {
      if (!current) return;
      if (action === 'member') {
        directory.openMember(current.memberId);
        return;
      }

      var body;
      if (action === 'reject') {
        var reason = await prompt({
          title: 'Reject this ' + (current.kind === 'upgrade' ? 'upgrade' : 'renewal') + '?',
          message: 'The membership is not changed. The member is emailed your reason and asked to submit again.',
          textareaLabel: 'Reason (emailed to the member)',
          textareaRequired: true,
          confirmText: 'Reject',
          danger: true
        });
        if (!reason) return;
        body = { status: 'rejected', status_note: reason.text };
      } else if (current.kind === 'upgrade') {
        var answer = await prompt({
          title: 'Verify upgrade to ' + CATEGORY_FULL[current.toCategory] + '?',
          message: current.membershipNumber + ' is kept on record and never reused; the member gets the number below and is emailed.',
          inputLabel: 'New membership number',
          inputRequired: true,
          fetchNextCategory: current.toCategory,
          confirmText: 'Verify Upgrade'
        });
        if (!answer) return;
        body = { status: 'verified', membership_number: answer.input };
      } else {
        if (!(await showSimpleConfirm({
          title: 'Verify renewal?',
          message: current.membershipNumber + ' is extended by 12 months and the member is emailed.',
          confirmText: 'Verify Renewal',
          danger: false
        }))) return;
        body = { status: 'verified' };
      }

      try {
        await api('PATCH', '/renewals/' + current.id, body);
        card.hidden = true;
        await load();
        showAlert('rn-alert', body.status === 'verified' ? 'Verified. The member has been emailed.' : 'Rejected. The member has been emailed.', 'success');
        directory.reload();
      } catch (err) {
        showAlert('rn-alert', err.message, 'error');
      }
    }

    document.querySelectorAll('[data-rn-status]').forEach(function (button) {
      button.addEventListener('click', function () {
        status = button.getAttribute('data-rn-status');
        document.querySelectorAll('[data-rn-status]').forEach(function (b) { b.classList.toggle('active', b === button); });
        card.hidden = true;
        load();
      });
    });

    tbody.addEventListener('click', function (e) {
      var button = e.target.closest('[data-rn-review]');
      if (!button) return;
      var r = renewals.find(function (x) { return String(x.id) === button.getAttribute('data-rn-review'); });
      if (r) openReview(r);
    });

    card.addEventListener('click', function (e) {
      if (e.target.id === 'rn-view-slip') viewSlip();
      var button = e.target.closest('[data-rn-action]');
      if (button) onAction(button.getAttribute('data-rn-action'));
    });

    document.getElementById('rn-review-close').addEventListener('click', function () { card.hidden = true; });
    document.getElementById('rn-refresh').addEventListener('click', load);

    // From a member's "Review Renewal" button.
    window.SLNA_OPEN_RENEWAL = async function (id) {
      if (status !== 'pending') {
        var pendingTab = document.querySelector('[data-rn-status="pending"]');
        if (pendingTab) pendingTab.click();
      }
      await load();
      var r = renewals.find(function (x) { return String(x.id) === String(id); });
      if (r) openReview(r);
    };

    load();
  }

  // ======================================================================
  // Membership settings (on the Membership Settings tab)
  // ======================================================================

  function initSettings() {
    var form = document.getElementById('ms-renewal-form');
    if (!form) return;

    var paths = [];
    var discounts = {};

    function renderDiscounts() {
      var host = document.getElementById('ms-discount-paths');
      host.innerHTML = paths.map(function (p) {
        var tiers = discounts[p.key] || [];
        return '<div class="ms-discount-path" data-path="' + esc(p.key) + '">' +
          '<h3>' + esc(p.label) + '</h3>' +
          (tiers.length ? tiers.map(function (t, i) {
            return '<div class="ms-discount-row">' +
              '<label>After <input type="number" min="1" max="60" step="1" value="' + esc(t.years) + '" data-field="years"> years</label>' +
              '<label>Rs. <input type="number" min="1" step="1" value="' + esc(t.amount) + '" data-field="amount"> off</label>' +
              '<button type="button" class="btn btn-outline btn-sm" data-remove-tier="' + i + '">Remove</button>' +
              '</div>';
          }).join('') : '<p class="admin-muted">No discount: the full fee applies.</p>') +
          '<button type="button" class="btn btn-outline btn-sm" data-add-tier>Add Discount Tier</button>' +
          '</div>';
      }).join('');
    }

    // Reads the inputs back into `discounts`.
    function readDiscounts() {
      document.querySelectorAll('.ms-discount-path').forEach(function (el) {
        var key = el.getAttribute('data-path');
        discounts[key] = Array.from(el.querySelectorAll('.ms-discount-row')).map(function (row) {
          return {
            years: Number(row.querySelector('[data-field="years"]').value),
            amount: Number(row.querySelector('[data-field="amount"]').value)
          };
        });
      });
    }

    async function load() {
      try {
        var s = await api('GET', '/settings');
        document.getElementById('ms-notice-days').value = s.noticeDays;
        document.getElementById('ms-grace-days').value = s.graceDays;
        paths = s.upgradePaths;
        discounts = s.upgradeDiscounts || {};
        renderDiscounts();
        document.getElementById('ms-email-status').textContent = s.emailEnabled
          ? 'Email sending is on.'
          : 'Email sending is currently turned off on the server, so reminders are logged as skipped.';
      } catch (err) {
        document.getElementById('ms-discount-paths').innerHTML = '<div class="empty-table-state">' + esc(err.message) + '</div>';
      }
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        await api('PUT', '/settings', {
          noticeDays: Number(document.getElementById('ms-notice-days').value),
          graceDays: Number(document.getElementById('ms-grace-days').value)
        });
        showAlert('ms-renewal-alert', 'Renewal settings saved.', 'success');
      } catch (err) {
        showAlert('ms-renewal-alert', err.message, 'error');
      }
    });

    document.getElementById('ms-discount-paths').addEventListener('click', function (e) {
      var path = e.target.closest('.ms-discount-path');
      if (!path) return;
      readDiscounts();
      var key = path.getAttribute('data-path');
      if (e.target.hasAttribute('data-add-tier')) {
        var tiers = discounts[key] || [];
        var last = tiers[tiers.length - 1];
        tiers.push({ years: last ? last.years + 2 : 3, amount: last ? last.amount + 500 : 1000 });
        discounts[key] = tiers;
        renderDiscounts();
      } else if (e.target.hasAttribute('data-remove-tier')) {
        discounts[key].splice(Number(e.target.getAttribute('data-remove-tier')), 1);
        renderDiscounts();
      }
    });

    document.getElementById('ms-discount-save').addEventListener('click', async function () {
      readDiscounts();
      var bad = Object.keys(discounts).some(function (key) {
        return discounts[key].some(function (t) { return !(t.years >= 1 && t.amount > 0); });
      });
      if (bad) {
        showAlert('ms-discount-alert', 'Each tier needs at least 1 year and an amount above 0.', 'error');
        return;
      }
      try {
        var saved = await api('PUT', '/settings', { upgradeDiscounts: discounts });
        discounts = saved.upgradeDiscounts;
        renderDiscounts();
        showAlert('ms-discount-alert', 'Upgrade discounts saved.', 'success');
      } catch (err) {
        showAlert('ms-discount-alert', err.message, 'error');
      }
    });

    document.getElementById('ms-run-reminders').addEventListener('click', async function () {
      var button = this;
      if (!(await showSimpleConfirm({
        title: 'Send due reminders now?',
        message: 'Members whose renewal reminder is due (and not yet sent for this period) are emailed now.',
        confirmText: 'Send Reminders',
        danger: false
      }))) return;
      button.disabled = true;
      try {
        var summary = (await api('POST', '/reminders/run')).summary;
        document.getElementById('ms-reminders-result').innerHTML =
          '<p class="admin-muted">Checked ' + summary.checked + ' annual members: ' + summary.sent + ' sent, ' + summary.skipped + ' skipped, ' + summary.failed + ' failed.</p>' +
          (summary.details.length ? '<ul class="md-reminder-list">' + summary.details.map(function (d) {
            return '<li>' + esc(d.membershipNumber) + ' · ' + esc(d.kind.replace(/_/g, ' ')) + ' · ' + esc(d.status) + (d.detail ? ' (' + esc(d.detail) + ')' : '') + '</li>';
          }).join('') + '</ul>' : '');
      } catch (err) {
        showAlert('ms-reminders-alert', err.message, 'error');
      } finally {
        button.disabled = false;
      }
    });

    load();
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof getToken !== 'function' || !getToken()) return;
    var directory = initDirectory();
    if (directory) initRenewals(directory);
    initSettings();
  });
})();
