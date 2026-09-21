(function () {
    function initJoinForm() {
        var form = document.getElementById('join-form');
        var alertBox = document.getElementById('join-form-alert');

        if (!form || !alertBox) {
            return;
        }

        var receiptInput = document.getElementById('payment-receipt');
        var receiptName = document.getElementById('payment-receipt-name');

        var photoInput = document.getElementById('id-photo');
        var photoName = document.getElementById('id-photo-name');
        var photoPreview = document.getElementById('id-photo-preview-image');
        var photoPlaceholder = document.getElementById(
            'id-photo-preview-placeholder'
        );

        var submitButton = form.querySelector('button[type="submit"]');
        var maxFileSize = 5 * 1024 * 1024;

        function showMessage(type, message, allowHtml) {
            alertBox.className = 'alert alert-' + type;

            if (allowHtml) {
                alertBox.innerHTML = message;
            } else {
                alertBox.textContent = message;
            }

            alertBox.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }

        function clearJoinFormMessage() {
            alertBox.className = '';
            alertBox.textContent = '';
        }

        function showSelectedFile(input, output) {
            if (!input || !output) {
                return;
            }

            var file = input.files[0];

            output.textContent = file
                ? 'Selected file: ' + file.name
                : '';
        }

        function isAllowedReceipt(file) {
            return [
                'application/pdf',
                'image/jpeg',
                'image/png'
            ].indexOf(file.type) !== -1;
        }

        function isAllowedImage(file) {
            return [
                'image/jpeg',
                'image/png'
            ].indexOf(file.type) !== -1;
        }

        function escapeHtml(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        if (receiptInput) {
            receiptInput.addEventListener('change', function () {
                showSelectedFile(receiptInput, receiptName);
            });
        }

        if (photoInput) {
            photoInput.addEventListener('change', function () {
                var file = photoInput.files[0];

                showSelectedFile(photoInput, photoName);

                if (!file || !isAllowedImage(file)) {
                    photoPreview.removeAttribute('src');
                    photoPreview.style.display = 'none';
                    photoPlaceholder.style.display = 'inline';
                    return;
                }

                var reader = new FileReader();

                reader.onload = function (event) {
                    photoPreview.src = event.target.result;
                    photoPreview.style.display = 'block';
                    photoPlaceholder.style.display = 'none';
                };

                reader.readAsDataURL(file);
            });
        }

        form.addEventListener('submit', async function (event) {
            event.preventDefault();

            alertBox.className = '';
            alertBox.textContent = '';

            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            var receipt = receiptInput ? receiptInput.files[0] : null;
            var photo = photoInput ? photoInput.files[0] : null;

            if (!receipt || !photo) {
                showMessage(
                    'error',
                    'Please upload the bank receipt and passport-size photograph.'
                );
                return;
            }

            if (
                receipt.size > maxFileSize ||
                photo.size > maxFileSize
            ) {
                showMessage(
                    'error',
                    'Each uploaded file must be 5 MB or smaller.'
                );
                return;
            }

            if (!isAllowedReceipt(receipt)) {
                showMessage(
                    'error',
                    'The bank receipt must be a PDF, JPG, JPEG, or PNG file.'
                );
                return;
            }

            if (!isAllowedImage(photo)) {
                showMessage(
                    'error',
                    'The passport photograph must be a JPG, JPEG, or PNG image.'
                );
                return;
            }

            var apiBase = window.SLNA_API_BASE_URL || 'http://localhost:3000';
            var formData = new FormData(form);

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Submitting Application...';
            }

            try {
                var response = await fetch(
                    apiBase + '/api/membership/applications',
                    {
                        method: 'POST',
                        body: formData
                    }
                );

                var data = await response.json().catch(function () {
                    return {};
                });

                if (!response.ok) {
                    var details = Array.isArray(data.details)
                        ? ' ' + data.details.join(' ')
                        : '';

                    throw new Error(
                        (data.message ||
                            'Unable to submit your application. Please try again.') +
                        details
                    );
                }

                var referenceNumber = escapeHtml(data.referenceNumber);

                form.reset();

                receiptName.textContent = '';
                photoName.textContent = '';

                photoPreview.removeAttribute('src');
                photoPreview.style.display = 'none';
                photoPlaceholder.style.display = 'inline';

                showMessage(
                    'success',
                    '<div class="application-success-message">' +
                    '<div class="application-success-title">' +
                    '✓ Application Received' +
                    '</div>' +
                    '<p>' +
                    'Your lifetime membership application has been received ' +
                    'and is awaiting review by the SLNA Secretariat.' +
                    '</p>' +
                    '<div class="application-reference-box">' +
                    '<span class="application-reference-label">' +
                    'Your Application Reference Number' +
                    '</span>' +
                    '<strong class="application-reference-number">' +
                    referenceNumber +
                    '</strong>' +
                    '</div>' +
                    '<p class="application-reference-help">' +
                    'Please save this reference number. You will need it ' +
                    'to check the status of your application.' +
                    '</p>' +
                    '</div>',
                    true
                );
            } catch (error) {
                showMessage(
                    'error',
                    error.message ||
                    'Unable to submit your application. Please check your connection and try again.'
                );
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent =
                        'Submit Lifetime Membership Application';
                }
            }
        });
        window.SLNA_CLEAR_JOIN_FORM_MESSAGE = clearJoinFormMessage;
    }

    function initJoinTabs() {
        var tabButtons = document.querySelectorAll(
            '[data-join-tab]'
        );

        var tabPanels = document.querySelectorAll(
            '.join-tab-panel'
        );

        if (!tabButtons.length) {
            return;
        }

        tabButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                var targetId =
                    button.getAttribute('data-join-tab');

                var isStatusTab =
                    targetId === 'tab-status';

                var isApplyTab =
                    targetId === 'tab-apply';

                if (isStatusTab) {
                    if (window.SLNA_CLEAR_JOIN_FORM_MESSAGE) {
                        window.SLNA_CLEAR_JOIN_FORM_MESSAGE();
                    }

                    if (window.SLNA_RESET_STATUS_CHECK) {
                        window.SLNA_RESET_STATUS_CHECK();
                    }
                }

                if (isApplyTab) {
                    if (window.SLNA_RESET_STATUS_CHECK) {
                        window.SLNA_RESET_STATUS_CHECK();
                    }

                    if (window.SLNA_CLEAR_JOIN_FORM_MESSAGE) {
                        window.SLNA_CLEAR_JOIN_FORM_MESSAGE();
                    }
                }

                tabButtons.forEach(function (btn) {
                    var selected =
                        btn === button;

                    btn.classList.toggle(
                        'active',
                        selected
                    );

                    btn.setAttribute(
                        'aria-selected',
                        selected ? 'true' : 'false'
                    );
                });

                tabPanels.forEach(function (panel) {
                    var isTarget =
                        panel.id === targetId;

                    panel.classList.toggle(
                        'active',
                        isTarget
                    );

                    panel.hidden = !isTarget;
                });
            });
        });
    }

    function initStatusCheck() {
        var form = document.getElementById('status-check-form');
        var alertBox = document.getElementById('status-check-alert');
        var resultCard = document.getElementById('status-result-card');

        if (!form || !alertBox || !resultCard) {
            return;
        }

        var referenceInput = document.getElementById(
            'status-reference-number'
        );

        var submitButton = document.getElementById(
            'status-check-submit'
        );

        var resultReference = document.getElementById(
            'status-result-reference'
        );

        var resultBadge = document.getElementById(
            'status-result-badge'
        );

        var resultSubmitted = document.getElementById(
            'status-result-submitted'
        );

        var membershipRow = document.getElementById(
            'status-result-membership-row'
        );

        var membershipNumberEl = document.getElementById(
            'status-result-membership-number'
        );

        var messageBox = document.getElementById(
            'status-result-message-box'
        );

        var messageTitle = document.getElementById(
            'status-result-message-title'
        );

        var messageText = document.getElementById(
            'status-result-message-text'
        );

        function showAlert(type, message) {
            alertBox.className = 'alert alert-' + type;
            alertBox.textContent = message;
        }

        function clearAlert() {
            alertBox.className = '';
            alertBox.textContent = '';
        }

        function formatDate(value) {
            if (!value) {
                return '—';
            }

            var date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return value;
            }

            return date.toLocaleDateString('en-GB');
        }

        function statusLabel(status) {
            var labels = {
                pending: 'Pending Review',
                under_review: 'Under Review',
                more_information_required: 'Modification Required',
                approved: 'Approved',
                rejected: 'Rejected'
            };

            return labels[status] || status;
        }

        function resetResultDisplay() {
            resultReference.textContent = '—';

            resultBadge.textContent = '—';
            resultBadge.className = 'application-status';

            resultSubmitted.textContent = '—';

            membershipRow.hidden = true;
            membershipNumberEl.textContent = '—';

            messageBox.hidden = true;
            messageTitle.textContent = 'Message from SLNA';
            messageText.textContent = '—';
        }

        function resetStatusCheckView() {
            clearAlert();

            form.reset();

            resultCard.hidden = true;

            resetResultDisplay();
        }

        function renderResult(application) {
            resetResultDisplay();

            resultReference.textContent = application.referenceNumber;

            resultBadge.textContent = statusLabel(application.status);
            resultBadge.className =
                'application-status status-' + application.status;

            resultSubmitted.textContent = formatDate(
                application.submittedAt
            );

            if (
                application.status === 'approved' &&
                application.membershipNumber
            ) {
                membershipRow.hidden = false;
                membershipNumberEl.textContent =
                    application.membershipNumber;
            }

            if (application.status === 'rejected') {
                messageBox.hidden = false;

                messageTitle.textContent = 'Application Not Approved';

                messageText.textContent =
                    (application.statusNote
                        ? application.statusNote + '\n\n'
                        : '') +
                    'If you wish to apply again, please submit a new lifetime membership application after addressing the feedback above.';
            } else if (
                application.status === 'more_information_required'
            ) {
                messageBox.hidden = false;

                messageTitle.textContent = 'Further Information Required';

                messageText.textContent =
                    (application.statusNote
                        ? application.statusNote + '\n\n'
                        : '') +
                    'Please submit a new lifetime membership application after addressing the feedback above.';
            } else {
                messageBox.hidden = true;
            }

            resultCard.hidden = false;

            resultCard.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }

        form.addEventListener('submit', async function (event) {
            event.preventDefault();

            clearAlert();
            resultCard.hidden = true;
            resetResultDisplay();

            var referenceNumber = referenceInput.value.trim();

            if (!referenceNumber) {
                showAlert(
                    'error',
                    'Please enter your SLNA application reference number.'
                );
                return;
            }

            var apiBase =
                window.SLNA_API_BASE_URL || 'http://localhost:3000';

            submitButton.disabled = true;
            submitButton.textContent = 'Checking...';

            try {
                var response = await fetch(
                    apiBase +
                    '/api/membership/applications/status/' +
                    encodeURIComponent(referenceNumber)
                );

                var data = await response.json().catch(function () {
                    return {};
                });

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        'No application was found for that reference number.'
                    );
                }

                renderResult(data.application);
            } catch (error) {
                showAlert(
                    'error',
                    error.message ||
                    'Could not check the application status. Please try again.'
                );
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Check Status';
            }
        });
        window.SLNA_RESET_STATUS_CHECK = resetStatusCheckView;
    }

    function initAll() {
        initJoinForm();
        initJoinTabs();
        initStatusCheck();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
})();