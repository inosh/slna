// js/membership-renew.js
// Renew Membership page. Opened from a personal renewal link (?t=token, in
// reminder emails or sent by the office), or after a lookup with the
// membership number. Shows the member's status and, where relevant, a form
// to renew for 12 months or upgrade (General / Lifetime) with a payment
// slip. After a lookup by number the contact details on record are only
// hinted at, since anyone could type a number.

(function () {
  var API = SLNA_CONFIG.API_BASE_URL;

  var BANK_HTML =
    '<div class="payment-details-box">' +
    '<h4>Bank Transfer Details</h4>' +
    '<dl class="bank-details">' +
    '<div><dt>Account Name</dt><dd>The Sri Lanka Nurses</dd></div>' +
    '<div><dt>Bank</dt><dd>Bank of Ceylon (BOC)</dd></div>' +
    '<div><dt>Branch</dt><dd>Regent Street, Colombo 10</dd></div>' +
    '<div><dt>Account Number</dt><dd>76034111</dd></div>' +
    '</dl>' +
    '</div>';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function fmt(value) {
    if (!value) return '';
    var d = new Date(String(value).slice(0, 10) + 'T00:00:00');
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function money(amount) {
    return 'Rs. ' + Number(amount || 0).toLocaleString('en-LK', { maximumFractionDigits: 2 });
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function request(path, options) {
    var response = await fetch(API + path, options || {});
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Something went wrong. Please try again.');
    }
    return data;
  }

  var STATE_TEXT = {
    active: function (m) {
      return m.valid_until ? 'Active until ' + fmt(m.valid_until) + '.' : 'Lifetime member: no renewal needed.';
    },
    renewal_due: function (m) {
      return 'Your membership expires on ' + fmt(m.valid_until) + '. You can renew now: your new year starts when the current one ends.';
    },
    grace: function (m) {
      return 'Your membership expired on ' + fmt(m.valid_until) + '. You are in the grace period until ' + fmt(m.grace_ends) + ', so renew now to keep it without a break.';
    },
    lapsed: function () {
      return 'Your membership has lapsed. Renew now to reactivate it; your membership number stays the same.';
    },
    deactivated: function () {
      return 'Your membership is not active. Please contact the SLNA office on 071 338 5768.';
    }
  };

  var PENDING_TEXT = 'Your payment has been received and is waiting for verification. Your membership will be updated once it is verified.';

  var UPGRADE_TEXT = {
    LT: function (u) {
      return 'Pay once, never renew. You get a new Lifetime (LT) membership number.' +
        (u.discount > 0 ? ' Includes a ' + money(u.discount) + ' discount for ' + u.years + ' year' + (u.years === 1 ? '' : 's') + ' of membership.' : '');
    },
    GM: function (u) {
      return 'For registered nurses. New General (GM) number, valid until ' + fmt(u.new_valid_until) + '.' +
        (u.discount > 0 ? ' Includes a ' + money(u.discount) + ' discount.' : '');
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var lookupBox = document.getElementById('renew-lookup-box');
    var lookupForm = document.getElementById('renew-lookup-form');
    var lookupAlert = document.getElementById('renew-lookup-alert');
    var host = document.getElementById('renewal-host');
    if (!lookupForm || !host) return;

    var token = new URLSearchParams(window.location.search).get('t');
    // Keep the token out of the address bar (and browser history) once read.
    if (token) history.replaceState(null, '', window.location.pathname);

    function showLookupError(message) {
      lookupAlert.className = 'alert alert-error';
      lookupAlert.textContent = message;
    }

    function isPending(v) {
      return v.latest_request && v.latest_request.status === 'pending';
    }

    function memberCard(v) {
      var m = v.member;
      return '<div class="status-result-card renew-member-card">' +
        '<div class="status-result-heading">' +
        '<div>' +
        '<span class="status-result-label">' + esc(m.category_label) + '</span>' +
        '<strong class="status-result-reference">' + esc(m.membership_number) + '</strong>' +
        '<div class="renew-member-name">' + esc(m.name_with_initials) + '</div>' +
        '</div>' +
        '<span class="application-status member-state-' + esc(m.state) + '">' + esc(isPending(v) ? 'Payment received' : m.state_label) + '</span>' +
        '</div>' +
        '<p class="renew-member-text">' + esc(isPending(v) ? PENDING_TEXT : STATE_TEXT[m.state](m)) + '</p>' +
        '</div>';
    }

    function onRecord(m) {
      var parts = [];
      if (m.email_hint) parts.push('Email on record: ' + esc(m.email_hint));
      if (m.mobile_hint) parts.push('Mobile on record: ' + esc(m.mobile_hint));
      return parts.length ? parts.join(' · ') + '.' : 'We have no email or mobile on record for you.';
    }

    function render(v) {
      lookupBox.hidden = true;
      var latest = v.latest_request;
      var html = memberCard(v);

      if (isPending(v)) {
        html += '<div class="info-box"><p><strong>Payment received: waiting for verification.</strong> ' +
          'We received your ' + (latest.kind === 'upgrade' ? 'upgrade' : 'renewal') + ' (reference ' + esc(latest.payment_reference) + ') on ' +
          esc(fmt(latest.created_at)) + '. We will email you once it is verified.</p></div>';
        host.innerHTML = html;
        return;
      }

      if (latest && latest.status === 'verified' && v.member.state === 'active' && latest.reviewed_at &&
          (Date.now() - new Date(latest.reviewed_at)) < 30 * 86400000) {
        html += '<div class="alert alert-success">✓ ' + (latest.kind === 'upgrade' ? 'Upgrade' : 'Renewal') + ' confirmed. ' +
          (v.member.valid_until ? 'Your membership is valid until ' + esc(fmt(v.member.valid_until)) + '.' : 'You are now a Lifetime member.') + '</div>';
      }

      var options = [];
      if (v.renewal) {
        options.push({ value: 'renewal', amount: v.renewal.amount, title: 'Renew for 12 months', meta: 'Valid until ' + fmt(v.renewal.new_valid_until) });
      }
      (v.upgrades || []).forEach(function (u) {
        options.push({
          value: 'upgrade:' + u.to_category,
          amount: u.amount,
          fullAmount: u.full_amount,
          needsWork: Boolean(u.needs_work_details),
          title: 'Upgrade to ' + u.label.replace(' Membership', ''),
          meta: (UPGRADE_TEXT[u.to_category] || function () { return ''; })(u)
        });
      });

      if (!options.length) {
        host.innerHTML = html + '<p><a href="renew-membership.html" class="btn btn-outline">Look up another membership</a></p>';
        return;
      }

      if (latest && latest.status === 'rejected') {
        html += '<div class="alert alert-error"><strong>Your last payment could not be verified.</strong>' +
          (latest.status_note ? ' ' + esc(latest.status_note) : '') + ' Please submit it again below.</div>';
      }

      var amounts = {};
      var needsWork = {};
      options.forEach(function (o) {
        amounts[o.value] = o.amount;
        needsWork[o.value] = o.needsWork;
      });

      // Associate -> General / Lifetime: registered nurses only, with the
      // work details the student application didn't ask for.
      var workHtml =
        '<div class="renew-work" id="renew-work" hidden>' +
        '<div class="info-box"><p><strong>General and Lifetime memberships are for registered nurses.</strong> ' +
        'Please give your work details below. Your SLNC registration number is not required at this stage.</p></div>' +
        '<div class="application-grid">' +
        '<div class="form-group application-grid-full"><label for="renew-official-address">Official address <span aria-hidden="true">*</span></label>' +
        '<textarea id="renew-official-address" name="officialAddress" rows="2"></textarea></div>' +
        '<div class="form-group"><label for="renew-designation">Designation <span aria-hidden="true">*</span></label>' +
        '<input type="text" id="renew-designation" name="designation" maxlength="255"></div>' +
        '<div class="form-group"><label for="renew-first-date">First appointment date <span aria-hidden="true">*</span></label>' +
        '<input type="date" id="renew-first-date" name="firstAppointmentDate" max="' + today() + '"></div>' +
        '<div class="form-group application-grid-full"><label for="renew-first-place">First appointment place <span aria-hidden="true">*</span></label>' +
        '<input type="text" id="renew-first-place" name="firstAppointmentPlace" maxlength="255"></div>' +
        '<div class="form-group"><label for="renew-slnc-number">SLNC registration number (optional)</label>' +
        '<input type="text" id="renew-slnc-number" name="slncRegistrationNumber" maxlength="100"></div>' +
        '<div class="form-group"><label for="renew-slnc-date">SLNC registration date (optional)</label>' +
        '<input type="date" id="renew-slnc-date" name="slncRegistrationDate" max="' + today() + '"></div>' +
        '</div></div>';

      html +=
        '<div class="form-box join-application-form">' +
        '<form id="renew-form" novalidate>' +
        '<h3>Choose an option</h3>' +
        '<div class="membership-category-options renew-options">' +
        options.map(function (o, i) {
          return '<label class="membership-category-option">' +
            '<input type="radio" name="option" value="' + esc(o.value) + '"' + (i === 0 ? ' checked' : '') + '>' +
            '<span class="membership-category-card">' +
            '<strong>' + esc(o.title) + '</strong>' +
            '<span class="membership-category-fee">' + esc(money(o.amount)) +
            (o.fullAmount && o.fullAmount > o.amount ? ' <s>' + esc(money(o.fullAmount)) + '</s>' : '') + '</span>' +
            '<span class="membership-category-who">' + esc(o.meta) + '</span>' +
            '</span></label>';
        }).join('') +
        '</div>' +
        workHtml +

        '<h3>1. Pay the fee</h3>' +
        '<div class="payment-amount-highlight"><span class="payment-amount-label">Amount to pay:</span>' +
        '<span class="payment-amount-value" id="renew-amount-due">' + esc(money(options[0].amount)) + '</span></div>' +
        BANK_HTML +
        '<p class="form-help">Use <strong>' + esc(v.payment_reference) + '</strong> as the payment reference if your bank allows it.</p>' +

        '<h3>2. ' + (v.member.contact_hidden ? 'Update your contact details (if they changed)' : 'Check your contact details') + '</h3>' +
        (v.member.contact_hidden ? '<p class="form-help">' + onRecord(v.member) + ' Leave these empty to keep what we have.</p>' : '') +
        '<div class="application-grid">' +
        '<div class="form-group"><label for="renew-email">Email</label><input type="email" id="renew-email" name="email" maxlength="255" value="' + esc(v.member.email) + '"></div>' +
        '<div class="form-group"><label for="renew-mobile">Mobile</label><input type="tel" id="renew-mobile" name="mobile" maxlength="13" placeholder="07XXXXXXXX" value="' + esc(v.member.mobile) + '"></div>' +
        '<div class="form-group application-grid-full"><label for="renew-workplace">' + (v.member.category === 'AM' ? 'Current nursing school / university or working place' : 'Current working place') + '</label>' +
        '<input type="text" id="renew-workplace" name="current_working_place" maxlength="255" value="' + esc(v.member.current_working_place) + '"></div>' +
        '</div>' +

        '<h3>3. Upload your payment slip</h3>' +
        '<div class="application-grid">' +
        '<div class="form-group"><label for="renew-date">Date you paid <span aria-hidden="true">*</span></label>' +
        '<input type="date" id="renew-date" name="payment_date" required max="' + today() + '" value="' + today() + '"></div>' +
        '<div class="form-group application-grid-full"><label for="renew-receipt">Payment slip or screenshot <span aria-hidden="true">*</span></label>' +
        '<input type="file" id="renew-receipt" name="receipt" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required>' +
        '<p class="form-help">PDF, JPG or PNG, up to 5 MB.</p></div>' +
        '</div>' +

        '<div id="renew-form-alert" aria-live="polite"></div>' +
        '<button type="submit" class="btn btn-primary">Submit</button>' +
        '</form></div>';

      host.innerHTML = html;

      var form = document.getElementById('renew-form');
      var formAlert = document.getElementById('renew-form-alert');

      var workSection = document.getElementById('renew-work');
      var workplaceLabel = document.querySelector('label[for="renew-workplace"]');
      var workplaceText = workplaceLabel ? workplaceLabel.textContent : '';

      // Shows / hides the work details; their fields are disabled while
      // hidden, so they are not sent.
      function syncWork() {
        var show = Boolean(needsWork[form.option.value]);
        workSection.hidden = !show;
        workSection.querySelectorAll('input, textarea').forEach(function (el) { el.disabled = !show; });
        if (workplaceLabel) {
          workplaceLabel.innerHTML = show ? 'Current working place <span aria-hidden="true">*</span>' : esc(workplaceText);
        }
      }

      form.addEventListener('change', function (e) {
        if (e.target.name === 'option') {
          document.getElementById('renew-amount-due').textContent = money(amounts[e.target.value]);
          syncWork();
        }
      });
      syncWork();

      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        formAlert.className = '';
        formAlert.textContent = '';

        function fail(input, message) {
          formAlert.className = 'alert alert-error';
          formAlert.textContent = message;
          if (input) input.focus();
        }

        form.mobile.value = form.mobile.value.replace(/[\s-]/g, '');
        if (form.email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim())) return fail(form.email, 'Please enter a valid email address.');
        if (form.mobile.value && !/^(?:\+94|0)7[0-8][0-9]{7}$/.test(form.mobile.value)) return fail(form.mobile, 'Enter a mobile number like 07XXXXXXXX or +947XXXXXXXX.');
        if (needsWork[form.option.value]) {
          var required = [
            [form.current_working_place, 'Please enter your current working place.'],
            [form.officialAddress, 'Please enter your official address.'],
            [form.designation, 'Please enter your designation.'],
            [form.firstAppointmentDate, 'Please enter your first appointment date.'],
            [form.firstAppointmentPlace, 'Please enter your first appointment place.']
          ];
          for (var i = 0; i < required.length; i += 1) {
            if (!required[i][0].value.trim()) return fail(required[i][0], required[i][1]);
          }
          if (form.firstAppointmentDate.value > today()) return fail(form.firstAppointmentDate, 'The first appointment date cannot be in the future.');
        }
        if (!form.payment_date.value) return fail(form.payment_date, 'Please enter the date you paid.');
        if (form.payment_date.value > today()) return fail(form.payment_date, 'The payment date cannot be in the future.');
        var file = form.receipt.files[0];
        if (!file) return fail(form.receipt, 'Please upload your payment slip or screenshot.');
        if (file.size > 5 * 1024 * 1024) return fail(form.receipt, 'The payment slip must be 5 MB or smaller.');

        var option = form.option.value;
        var data = new FormData(form);
        data.delete('option');
        data.set('kind', option === 'renewal' ? 'renewal' : 'upgrade');
        if (option !== 'renewal') data.set('to_category', option.slice(8));

        var button = form.querySelector('[type="submit"]');
        button.disabled = true;
        button.textContent = 'Submitting...';

        try {
          var result = await request('/membership/renew/' + encodeURIComponent(token), { method: 'POST', body: data });
          host.innerHTML = memberCard(Object.assign({}, v, { latest_request: { status: 'pending' } })) +
            '<div class="alert alert-success application-success-message">' +
            '<div class="application-success-title">✓ Thank you</div>' +
            '<p>We received your payment slip (reference <strong>' + esc(result.payment_reference) + '</strong>). ' +
            'We will verify it and confirm by email, usually within a few working days.</p></div>';
          host.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) {
          fail(null, err.message);
          button.disabled = false;
          button.textContent = 'Submit';
        }
      });
    }

    async function load() {
      host.innerHTML = '<p class="form-help">Loading your membership...</p>';
      try {
        render(await request('/membership/renew/' + encodeURIComponent(token)));
      } catch (err) {
        host.innerHTML = '';
        lookupBox.hidden = false;
        showLookupError(err.message);
      }
    }

    lookupForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      lookupAlert.className = '';
      lookupAlert.textContent = '';
      var number = document.getElementById('renew-lookup-number').value.trim();
      if (!number) return showLookupError('Please enter your membership number.');

      var button = document.getElementById('renew-lookup-submit');
      button.disabled = true;
      try {
        token = (await request('/membership/renew/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ membership_number: number })
        })).token;
        await load();
      } catch (err) {
        showLookupError(err.message);
      } finally {
        button.disabled = false;
      }
    });

    if (token) load();
  });
})();
