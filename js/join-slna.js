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

        // ---- Reusable inline field-error display ----
        // Radio/checkbox fields show their error and highlight against the
        // group wrapper (the row of options, or the checkbox's own label)
        // rather than the individual input, since bordering a single radio
        // button isn't a meaningful error indicator.
        function errorAnchor(input) {
            if (input.type === 'radio' || input.type === 'checkbox') {
                return input.closest('.radio-options') ||
                    input.closest('.checkbox-label') ||
                    input.closest('fieldset') ||
                    input;
            }

            return input;
        }

        function errorHighlightTarget(input) {
            if (input.type === 'radio' || input.type === 'checkbox') {
                return input.closest('.radio-options') ||
                    input.closest('.checkbox-label') ||
                    input;
            }

            return input;
        }

        // All radios sharing a name are one logical field: per the HTML spec,
        // every radio in a required group reports valueMissing (not just the
        // one carrying the `required` attribute), so each fires its own
        // "invalid" event. Route them to a single shared error id/element
        // and keep validity in sync across the whole group, not just the
        // one radio that happened to trigger the check.
        function errorId(input) {
            if (input.type === 'radio' && input.name) {
                return input.name + '-error';
            }

            return input.id + '-error';
        }

        function groupMembers(input) {
            if (input.type === 'radio' && input.name) {
                return Array.prototype.slice.call(
                    form.querySelectorAll('input[type="radio"][name="' + input.name + '"]')
                );
            }

            return [input];
        }

        function getOrCreateErrorElement(input) {
            var id = errorId(input);
            var existing = document.getElementById(id);

            if (existing) {
                return existing;
            }

            var errorEl = document.createElement('p');
            errorEl.id = id;
            errorEl.className = 'field-error-message';
            errorEl.setAttribute('role', 'alert');

            errorAnchor(input).insertAdjacentElement('afterend', errorEl);

            return errorEl;
        }

        function showFieldError(input, message) {
            var errorEl = getOrCreateErrorElement(input);

            errorEl.textContent = message;
            errorEl.hidden = false;

            errorHighlightTarget(input).classList.add('input-error');

            groupMembers(input).forEach(function (member) {
                member.setAttribute('aria-invalid', 'true');
                member.setAttribute('aria-describedby', errorEl.id);

                // Keep the native validity in sync so form.checkValidity() still blocks submit.
                member.setCustomValidity(message);
            });
        }

        function clearFieldError(input) {
            var errorEl = document.getElementById(errorId(input));

            if (errorEl) {
                errorEl.hidden = true;
                errorEl.textContent = '';
            }

            errorHighlightTarget(input).classList.remove('input-error');

            groupMembers(input).forEach(function (member) {
                member.removeAttribute('aria-invalid');
                member.setCustomValidity('');
            });
        }

        // ---- Sri Lankan phone number handling ----
        var phoneFieldIds = [
            'mobile-number',
            'whatsapp-number',
            'residential-number',
            'office-number'
        ];

        function stripPhoneSeparators(input) {
            input.addEventListener('input', function () {
                var cursorPos = input.selectionStart;
                var cleaned = input.value.replace(/[\s-]/g, '');

                if (cleaned !== input.value) {
                    input.value = cleaned;
                    if (cursorPos !== null) {
                        input.setSelectionRange(cursorPos - 1, cursorPos - 1);
                    }
                }
            });
        }

        phoneFieldIds.forEach(function (id) {
            var input = document.getElementById(id);
            if (input) {
                stripPhoneSeparators(input);
            }
        });

        // ---- Sri Lankan NIC formatting ----
        var nicInput = document.getElementById('nic-number');

        if (nicInput) {
            nicInput.addEventListener('input', function () {
                var cursorPos = nicInput.selectionStart;
                var cleaned = nicInput.value
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

        // // ---- Sri Lankan NIC formatting + structural validation ----
        // var nicInput = document.getElementById('nic-number');
        //
        // function isValidSriLankanNic(value) {
        //     var v = String(value || '').trim().toUpperCase();
        //     var currentYear = new Date().getFullYear();
        //
        //     var oldMatch = /^([0-9]{2})([0-9]{3})([0-9]{4})[VX]$/.exec(v);
        //     var newMatch = /^(19|20)([0-9]{2})([0-9]{3})([0-9]{4})$/.exec(v);
        //
        //     function isValidDayField(dayField) {
        //         var day = parseInt(dayField, 10);
        //         var isFemale = day > 500;
        //         var normalizedDay = isFemale ? day - 500 : day;
        //         return normalizedDay >= 1 && normalizedDay <= 366;
        //     }
        //
        //     if (oldMatch) {
        //         // Old NIC only covers 1900s births (issued before year 2000 rollout).
        //         return isValidDayField(oldMatch[2]);
        //     }
        //
        //     if (newMatch) {
        //         var century = newMatch[1]; // "19" or "20"
        //         var yearSuffix = newMatch[2]; // last two digits
        //         var fullYear = parseInt(century + yearSuffix, 10);
        //         var dayField = newMatch[3];
        //
        //         if (fullYear < 1900 || fullYear > currentYear) {
        //             return false;
        //         }
        //
        //         return isValidDayField(dayField);
        //     }
        //
        //     return false;
        // }
        //
        // if (nicInput) {
        //     nicInput.addEventListener('input', function () {
        //         var cursorPos = nicInput.selectionStart;
        //         var cleaned = nicInput.value
        //             .replace(/\s/g, '')
        //             .toUpperCase();
        //
        //         if (cleaned !== nicInput.value) {
        //             nicInput.value = cleaned;
        //             if (cursorPos !== null) {
        //                 nicInput.setSelectionRange(cursorPos, cursorPos);
        //             }
        //         }
        //
        //         // Clear any previous structural-validity error while the user is typing.
        //         nicInput.setCustomValidity('');
        //     });
        //
        //     nicInput.addEventListener('blur', function () {
        //         var value = nicInput.value.trim();
        //
        //         if (!value) {
        //             return;
        //         }
        //
        //         if (!isValidSriLankanNic(value)) {
        //             nicInput.setCustomValidity(
        //                 'Enter a valid Sri Lankan NIC number.'
        //             );
        //         } else {
        //             nicInput.setCustomValidity('');
        //         }
        //     });
        // }

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

        // ---- File field validation (shared by the change listeners below and by submit) ----
        function receiptFieldError(file) {
            if (!file) {
                return 'Please upload your bank receipt.';
            }
            if (file.size > maxFileSize) {
                return 'This file must be 5 MB or smaller.';
            }
            if (!isAllowedReceipt(file)) {
                return 'Upload a PDF, JPG, JPEG, or PNG file.';
            }
            return null;
        }

        function photoFieldError(file) {
            if (!file) {
                return 'Please upload your passport-size photograph.';
            }
            if (file.size > maxFileSize) {
                return 'This file must be 5 MB or smaller.';
            }
            if (!isAllowedImage(file)) {
                return 'Upload a JPG, JPEG, or PNG image.';
            }
            return null;
        }

        if (receiptInput) {
            receiptInput.addEventListener('change', function () {
                showSelectedFile(receiptInput, receiptName);

                var error = receiptFieldError(receiptInput.files[0]);

                if (error) {
                    showFieldError(receiptInput, error);
                } else {
                    clearFieldError(receiptInput);
                }
            });

            // Native "required" fires this on submit before our own file
            // checks below ever run -- show the same friendly message.
            receiptInput.addEventListener('invalid', function (event) {
                event.preventDefault(); // suppress the native bubble -- we render our own message below
                showFieldError(receiptInput, receiptFieldError(receiptInput.files[0]) || receiptInput.validationMessage);
            });
        }

        if (photoInput) {
            photoInput.addEventListener('change', function () {
                var file = photoInput.files[0];

                showSelectedFile(photoInput, photoName);

                var error = photoFieldError(file);

                if (error) {
                    showFieldError(photoInput, error);
                } else {
                    clearFieldError(photoInput);
                }

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

            // Native "required" fires this on submit before our own file
            // checks below ever run -- show the same friendly message.
            photoInput.addEventListener('invalid', function (event) {
                event.preventDefault(); // suppress the native bubble -- we render our own message below
                showFieldError(photoInput, photoFieldError(photoInput.files[0]) || photoInput.validationMessage);
            });
        }

        function focusFirstInvalidField() {
            var invalidField = form.querySelector(':invalid');

            if (!invalidField) {
                return;
            }

            var container = invalidField.closest('.form-group, fieldset') || invalidField;

            container.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            invalidField.focus({ preventScroll: true });
        }

        // ---- Inline validation as the user fills in the form ----
        // Browsers only show their built-in error bubble on submit, and it
        // looks/behaves differently per browser. Instead we suppress it and
        // render our own inline message + red outline next to each field:
        // on blur (so we don't flag a field mid-type), live-clearing as
        // soon as the value becomes valid again, and on every invalid
        // field when the form is submitted.
        // File inputs (receipt/photo) are validated separately above, since
        // they need the custom size/type checks rather than just native
        // constraints -- excluded here so this generic wiring doesn't clear
        // their error the moment *any* file is chosen.
        var liveValidatedFields = form.querySelectorAll('input:not([type="file"]), select, textarea');

        // Clears custom validity across the whole group (not just this one
        // field) before re-checking, so fixing a radio group via a *different*
        // member than the one that first showed the error still clears it.
        function revalidateField(field) {
            groupMembers(field).forEach(function (member) {
                member.setCustomValidity('');
            });

            if (field.validity.valid) {
                clearFieldError(field);
            } else {
                showFieldError(field, field.validationMessage);
            }
        }

        liveValidatedFields.forEach(function (field) {
            field.addEventListener('invalid', function (event) {
                event.preventDefault(); // suppress the native bubble -- we render our own message below
                showFieldError(field, field.validationMessage);
            });

            field.addEventListener('blur', function () {
                revalidateField(field);
            });

            function clearOnceFixed() {
                if (!errorHighlightTarget(field).classList.contains('input-error')) {
                    return;
                }

                revalidateField(field);
            }

            field.addEventListener('input', clearOnceFixed);
            field.addEventListener('change', clearOnceFixed);
        });

        form.addEventListener('submit', async function (event) {
            event.preventDefault();

            alertBox.className = '';
            alertBox.textContent = '';

            if (!form.checkValidity()) {
                focusFirstInvalidField();
                return;
            }

            var receipt = receiptInput ? receiptInput.files[0] : null;
            var photo = photoInput ? photoInput.files[0] : null;
            var fileFieldInvalid = false;

            var receiptError = receiptInput ? receiptFieldError(receipt) : null;
            if (receiptError) {
                showFieldError(receiptInput, receiptError);
                fileFieldInvalid = true;
            } else if (receiptInput) {
                clearFieldError(receiptInput);
            }

            var photoError = photoInput ? photoFieldError(photo) : null;
            if (photoError) {
                showFieldError(photoInput, photoError);
                fileFieldInvalid = true;
            } else if (photoInput) {
                clearFieldError(photoInput);
            }

            if (fileFieldInvalid) {
                focusFirstInvalidField();
                return;
            }

            var apiBase = SLNA_CONFIG.API_BASE_URL;
            var formData = new FormData(form);

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Submitting Application...';
            }

            try {
                var response = await fetch(
                    apiBase + '/membership/applications',
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

            var apiBase = SLNA_CONFIG.API_BASE_URL;

            submitButton.disabled = true;
            submitButton.textContent = 'Checking...';

            try {
                var response = await fetch(
                    apiBase +
                    '/membership/applications/status/' +
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