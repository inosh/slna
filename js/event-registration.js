document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('registration-container');

    if (!container) {
        return;
    }

    const apiBaseUrl = String(SLNA_CONFIG.API_BASE_URL || '')
        .replace(/\/+$/, '');

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

    function setHeading(text) {
        const breadcrumbEl = document.getElementById('registration-breadcrumb');

        if (breadcrumbEl) {
            breadcrumbEl.textContent = text;
        }
    }

    function renderNotFound() {
        setHeading('Not Found');

        container.innerHTML = `
      <div class="empty-events-state">
        <h3>This Event Could Not Be Found</h3>
        <p>It may have been removed, or the link you followed is out of date.</p>
      </div>
      <div style="text-align:center; margin-top:18px;">
        <a href="training-workshops.html" class="btn btn-outline">&larr; Back to Events</a>
      </div>
    `;
    }

    function renderClosed(event) {
        setHeading(event.title || 'Registration Unavailable');

        container.innerHTML = `
      <div class="empty-events-state">
        <h3>Registration Is Not Currently Open</h3>
        <p>
          "${escapeHtml(event.title)}" is not open for registration right now
          (status: ${escapeHtml(event.status || 'Unavailable')}).
        </p>
      </div>
      <div style="text-align:center; margin-top:18px;">
        <a href="event-detail.html?category=${encodeURIComponent(category)}&id=${encodeURIComponent(event.id)}" class="btn btn-outline">
          &larr; Back to Event Details
        </a>
      </div>
    `;
    }

    function renderForm(event) {
        setHeading(event.title || 'Register');
        document.title = 'Register: ' + (event.title || 'Event') + ' | SLNA';

        const memberFee = event.member_fee;
        const nonMemberFee = event.non_member_fee;
        const hasFeeData = memberFee !== undefined && memberFee !== null &&
            nonMemberFee !== undefined && nonMemberFee !== null;

        // Fully free: both fees are 0 (or there's no fee data at all --
        // Other Events have no fee concept), so nobody ever pays and the
        // payment fields are left out of the form entirely. "Free for
        // Members Only" (member fee 0, non-member fee > 0) still needs the
        // payment section -- just not when a Member is registering, which
        // is handled dynamically in wireForm once a registrant type is
        // chosen.
        const fullyFree = hasFeeData &&
            Number(memberFee) <= 0 && Number(nonMemberFee) <= 0;
        const neverNeedsPayment = !hasFeeData || fullyFree;

        const membersOnly = event.audience === 'Members Only';

        const mainFacts = [];

        mainFacts.push('<div><dt>Date</dt><dd>' + escapeHtml(readableDate(event.event_date)) + '</dd></div>');

        if (event.time) {
            mainFacts.push('<div><dt>Time</dt><dd>' + escapeHtml(event.time) + '</dd></div>');
        }

        if (event.location) {
            mainFacts.push('<div><dt>Location</dt><dd>' + escapeHtml(event.location) + '</dd></div>');
        }

        const feeFacts = [];

        if (hasFeeData) {
            if (membersOnly) {
                feeFacts.push('<div><dt>Member Fee</dt><dd>' + escapeHtml(formatCurrency(memberFee)) + '</dd></div>');
            } else if (fullyFree) {
                feeFacts.push('<div><dt>Event Fee</dt><dd>Free</dd></div>');
            } else {
                feeFacts.push('<div><dt>Member Fee</dt><dd>' + escapeHtml(formatCurrency(memberFee)) + '</dd></div>');
                feeFacts.push('<div><dt>Non-Member Fee</dt><dd>' + escapeHtml(formatCurrency(nonMemberFee)) + '</dd></div>');
            }
        }

        container.innerHTML = `
      <div class="event-detail-info-card event-registration-summary">
        <h2>${escapeHtml(event.title)}</h2>
        <div class="event-registration-summary-body">
          <dl class="event-registration-main-facts">${mainFacts.join('')}</dl>
          ${feeFacts.length ? `<dl class="event-registration-fee-facts">${feeFacts.join('')}</dl>` : ''}
        </div>
      </div>

      <form id="event-registration-form">
        <h2 class="event-registration-section-title">Applicant Details</h2>

        <div class="application-grid">
          <div class="form-group">
            <label for="reg-registrant-type">Registering As *</label>
            <select id="reg-registrant-type" required${membersOnly ? ' disabled' : ''}>
              <option value="">Select</option>
              <option value="Member">Member</option>
              ${membersOnly ? '' : '<option value="Non-Member">Non-Member</option>'}
            </select>
            ${membersOnly ? '<p class="form-help">This event is open to SLNA members only.</p>' : ''}
          </div>

          <div class="form-group" id="reg-membership-number-group" hidden>
            <label for="reg-membership-number">Membership Number *</label>
            <input type="text" id="reg-membership-number">
          </div>
          
          <div class="form-group">
              <label for="reg-nic">NIC *</label>
              <input
                      type="text"
                      id="reg-nic"
                      placeholder="e.g. 855420159V or 199554200159"
                      pattern="^([0-9]{9}[VXvx]|[0-9]{12})$"
                      title="Enter a valid Sri Lankan NIC: 9 digits followed by V or X (old format), or 12 digits (new format)"
                      maxlength="12"
                      required
              >
          </div>

          <div class="form-group">
            <label for="reg-full-name">Name *</label>
            <input type="text" id="reg-full-name" required>
          </div>

          <div class="form-group">
            <label for="reg-slnc-number">SLNC Registration Number *</label>
            <input type="text" id="reg-slnc-number" required>
          </div>

          <div class="form-group">
            <label for="reg-email">Email Address *</label>
            <input type="email" id="reg-email" required>
          </div>
          
          <div class="form-group">
              <label for="reg-mobile">Mobile</label>
              <input
                      type="tel"
                      id="reg-mobile"
                      placeholder="07XXXXXXXX or +947XXXXXXXX"
                      pattern="^(?:\\\\+94|0)7[0-8][0-9]{7}$"
                      title="Enter a valid Sri Lankan mobile number, e.g. 0771234567 or +94771234567"
                      maxlength="13"
                      required
              >
          </div>
          
          <div class="form-group">
            <label for="reg-certificate-name">Certificate Issue Name *</label>
            <input type="text" id="reg-certificate-name" required>
          </div>

          <div class="form-group application-grid-full">
            <label for="reg-postal-address">Postal Address *</label>
            <textarea id="reg-postal-address" rows="2" required></textarea>
          </div>

          <div class="form-group">
            <label for="reg-workplace">Workplace *</label>
            <input type="text" id="reg-workplace" required>
          </div>

          <div class="form-group application-grid-full">
            <label for="reg-workplace-address">Workplace Address *</label>
            <textarea id="reg-workplace-address" rows="2" required></textarea>
          </div>

          ${neverNeedsPayment ? '' : `
          <div id="reg-payment-fields" style="display:contents;">
            <div class="form-group">
              <label for="reg-pay-by">Pay By (Organization / Individual) *</label>
              <select id="reg-pay-by">
                <option value="">Select</option>
                <option value="Individual">Individual</option>
                <option value="Organization">Organization</option>
              </select>
            </div>

            <div class="form-group">
              <label for="reg-paid-amount">Paid Amount (LKR) *</label>
              <input type="number" id="reg-paid-amount" min="0" step="0.01">
              <p class="form-help" id="reg-paid-amount-help"></p>
            </div>
          </div>
          `}
        </div>

        ${neverNeedsPayment ? '' : `
        <div id="reg-payment-details">
          <div class="event-detail-bank-box" style="margin-top:26px;">
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
              to this account, then attach a clear copy of your bank receipt below.
            </p>
          </div>

          <div class="form-group" style="margin-top:20px;">
            <label for="reg-receipt-input">Bank Receipt (PDF, JPEG, or PNG) *</label>
            <input type="file" id="reg-receipt-input" accept="application/pdf,image/jpeg,image/png">
            <div id="reg-receipt-preview" style="margin-top:8px;"></div>
          </div>
        </div>
        `}

        <div id="registration-alert" aria-live="polite" tabindex="-1"></div>

        <div class="admin-edit-actions">
          <a class="btn btn-outline" href="event-detail.html?category=${encodeURIComponent(category)}&id=${encodeURIComponent(event.id)}">
            Cancel
          </a>
          <button type="submit" class="btn btn-primary">Submit Registration</button>
        </div>
      </form>
    `;

        wireForm(event, neverNeedsPayment, membersOnly);
    }

    function expectedFeeFor(event, registrantType) {
        const value = registrantType === 'Member' ? event.member_fee : event.non_member_fee;
        const parsed = Number(value);

        return Number.isFinite(parsed) ? parsed : null;
    }

    function wireForm(event, neverNeedsPayment, membersOnly) {
        const registrantTypeSelect = document.getElementById('reg-registrant-type');
        const membershipGroup = document.getElementById('reg-membership-number-group');
        const membershipInput = document.getElementById('reg-membership-number');
        const paymentFields = document.getElementById('reg-payment-fields');
        const paymentDetails = document.getElementById('reg-payment-details');
        const payByInput = document.getElementById('reg-pay-by');
        const paidAmountInput = document.getElementById('reg-paid-amount');
        const paidAmountHelp = document.getElementById('reg-paid-amount-help');
        const receiptInput = document.getElementById('reg-receipt-input');
        const receiptPreview = document.getElementById('reg-receipt-preview');
        const form = document.getElementById('event-registration-form');

        let selectedReceipt = null;

        // For a "Free for Members Only" event, a Member registrant pays
        // nothing while a Non-Member still does -- so the whole payment
        // section is shown/required/reset dynamically based on the fee for
        // whichever registrant type is currently selected, instead of being
        // fixed for the whole form. For a fully free event (or one with no
        // fee concept at all) the payment section was never rendered, so
        // this is a no-op.
        function syncPaymentSection() {
            if (neverNeedsPayment) {
                return;
            }

            const fee = expectedFeeFor(event, registrantTypeSelect.value);
            const needsPayment = fee === null || fee > 0;

            if (paymentFields) {
                paymentFields.style.display = needsPayment ? 'contents' : 'none';
            }

            if (paymentDetails) {
                paymentDetails.style.display = needsPayment ? '' : 'none';
            }

            if (payByInput) {
                payByInput.required = needsPayment;
            }

            if (paidAmountInput) {
                paidAmountInput.required = needsPayment;
            }

            if (receiptInput) {
                receiptInput.required = needsPayment;
            }

            if (!needsPayment) {
                if (payByInput) {
                    payByInput.value = '';
                }

                if (paidAmountInput) {
                    paidAmountInput.value = '0.00';
                }

                if (paidAmountHelp) {
                    paidAmountHelp.textContent = '';
                }

                selectedReceipt = null;

                if (receiptInput) {
                    receiptInput.value = '';
                }

                if (receiptPreview) {
                    receiptPreview.innerHTML = '';
                }
            } else if (fee !== null && paidAmountInput) {
                paidAmountInput.value = fee.toFixed(2);
                paidAmountHelp.textContent = 'Should match the ' + registrantTypeSelect.value +
                    ' fee shown above: ' + formatCurrency(fee) + '.';
            } else if (paidAmountHelp) {
                paidAmountHelp.textContent = '';
            }
        }

        // ---- Sri Lankan NIC formatting ----
        const nicInput = document.getElementById('reg-nic');

        if (nicInput) {
            nicInput.addEventListener('input', function () {
                const cursorPos = nicInput.selectionStart;
                const cleaned = nicInput.value
                    .replace(/\s/g, '')
                    .toUpperCase();

                if (cleaned !== nicInput.value) {
                    nicInput.value = cleaned;
                    if (cursorPos !== null) {
                        nicInput.setSelectionRange(cursorPos, cursorPos);
                    }
                }
            });
        }

        // ---- Sri Lankan mobile number validation ----
        const mobileInput = document.getElementById('reg-mobile');

        if (mobileInput) {
            mobileInput.addEventListener('input', function () {
                const cursorPos = mobileInput.selectionStart;
                const cleaned = mobileInput.value.replace(/[\s-]/g, '');

                if (cleaned !== mobileInput.value) {
                    mobileInput.value = cleaned;
                    if (cursorPos !== null) {
                        mobileInput.setSelectionRange(cursorPos - 1, cursorPos - 1);
                    }
                }
            });
        }

        function syncRegistrantTypeState() {
            const isMember = registrantTypeSelect.value === 'Member';

            membershipGroup.hidden = !isMember;
            membershipInput.required = isMember;

            if (!isMember) {
                membershipInput.value = '';
            }

            syncPaymentSection();
        }

        registrantTypeSelect.addEventListener('change', syncRegistrantTypeState);

        if (membersOnly) {
            registrantTypeSelect.value = 'Member';
        }

        syncRegistrantTypeState();

        if (paidAmountInput) {
            paidAmountInput.addEventListener('blur', function () {
                if (paidAmountInput.value === '') {
                    return;
                }

                const parsed = parseFloat(paidAmountInput.value);

                if (Number.isNaN(parsed)) {
                    return;
                }

                paidAmountInput.value = parsed.toFixed(2);
            });
        }

        if (receiptInput) {
            receiptInput.addEventListener('change', function (eventObj) {
                const file = eventObj.target.files[0];

                if (!file) {
                    selectedReceipt = null;
                    receiptPreview.innerHTML = '';
                    return;
                }

                const allowed = ['application/pdf', 'image/jpeg', 'image/png'];

                if (!allowed.includes(file.type)) {
                    showRegistrationAlert('Please select a PDF, JPEG, or PNG file for the receipt.', 'error');
                    eventObj.target.value = '';
                    return;
                }

                if (file.size > 15 * 1024 * 1024) {
                    showRegistrationAlert('The receipt file must be smaller than 15 MB.', 'error');
                    eventObj.target.value = '';
                    return;
                }

                selectedReceipt = file;
                receiptPreview.textContent = 'Selected: ' + file.name;
            });
        }

        form.addEventListener('submit', async function (submitEvent) {
            submitEvent.preventDefault();

            const expectedFee = expectedFeeFor(event, registrantTypeSelect.value);
            const needsPaymentNow = !neverNeedsPayment && (expectedFee === null || expectedFee > 0);

            if (needsPaymentNow) {
                if (!selectedReceipt) {
                    showRegistrationAlert('Please attach your bank receipt before submitting.', 'error');
                    return;
                }

                const paidAmount = parseFloat(paidAmountInput.value);

                if (Number.isNaN(paidAmount) || paidAmount < 0) {
                    showRegistrationAlert('Please enter a valid paid amount.', 'error');
                    return;
                }

                if (expectedFee !== null && Math.abs(paidAmount - expectedFee) > 0.01) {
                    showRegistrationAlert(
                        'Paid amount must match the ' + registrantTypeSelect.value +
                        ' fee of ' + formatCurrency(expectedFee) + '.',
                        'error'
                    );
                    return;
                }
            }

            const formData = new FormData();

            formData.append('event_category', category);
            formData.append('event_id', String(event.id));
            formData.append('event_date', String(event.event_date || '').slice(0, 10));
            formData.append('registrant_type', registrantTypeSelect.value);
            formData.append('membership_number', membershipInput.value.trim());
            formData.append('nic', document.getElementById('reg-nic').value.trim());
            formData.append('full_name', document.getElementById('reg-full-name').value.trim());
            formData.append('slnc_registration_number', document.getElementById('reg-slnc-number').value.trim());
            formData.append('email', document.getElementById('reg-email').value.trim());
            formData.append('mobile', document.getElementById('reg-mobile').value.trim());
            formData.append('certificate_issue_name', document.getElementById('reg-certificate-name').value.trim());
            formData.append('postal_address', document.getElementById('reg-postal-address').value.trim());
            formData.append('workplace', document.getElementById('reg-workplace').value.trim());
            formData.append('workplace_address', document.getElementById('reg-workplace-address').value.trim());

            if (needsPaymentNow) {
                formData.append('paid_amount', parseFloat(paidAmountInput.value).toFixed(2));
                formData.append('pay_by', document.getElementById('reg-pay-by').value);
                formData.append('receipt', selectedReceipt);
            }

            const submitButton = form.querySelector('button[type="submit"]');

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Submitting...';
            }

            try {
                const response = await fetch(apiBaseUrl + '/event-registrations', {
                    method: 'POST',
                    body: formData
                });

                let data = null;

                try {
                    data = await response.json();
                } catch (parseError) {
                    // Ignore -- fall through to the generic message below.
                }

                if (!response.ok) {
                    throw new Error((data && data.error) || 'Could not submit your registration.');
                }

                renderSuccess(event);
            } catch (error) {
                console.error('Could not submit registration:', error);

                const message = error instanceof TypeError
                    ? 'Could not reach the server. Please check your connection and try again.'
                    : (error.message || 'Could not submit your registration.');

                showRegistrationAlert(message, 'error');
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Submit Registration';
                }
            }
        });
    }

    function showRegistrationAlert(message, type) {
        const alertEl = document.getElementById('registration-alert');

        if (!alertEl) {
            return;
        }

        alertEl.innerHTML = '<div class="alert alert-' + type + '">' + escapeHtml(message) + '</div>';
        alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function renderSuccess(event) {
        container.innerHTML = `
      <div class="empty-events-state">
        <h3>Registration Submitted</h3>
        <p>
          Thank you for registering for "${escapeHtml(event.title)}". Our secretariat will
          verify your payment and confirm your registration.
        </p>
      </div>
      <div style="text-align:center; margin-top:18px;">
        <a href="event-detail.html?category=${encodeURIComponent(category)}&id=${encodeURIComponent(event.id)}" class="btn btn-outline">
          &larr; Back to Event Details
        </a>
      </div>
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

            if (event.status !== 'Registration Open') {
                renderClosed(event);
                return;
            }

            renderForm(event);
        } catch (error) {
            console.error('Could not load event:', error);
            renderNotFound();
        }
    }

    loadEvent();
});
