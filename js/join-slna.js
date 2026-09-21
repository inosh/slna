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

        var signatureInput = document.getElementById('signature-photo');
        var signatureName = document.getElementById(
            'signature-photo-name'
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

        if (signatureInput) {
            signatureInput.addEventListener('change', function () {
                showSelectedFile(signatureInput, signatureName);
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
            var signature = signatureInput
                ? signatureInput.files[0]
                : null;

            if (!receipt || !photo || !signature) {
                showMessage(
                    'error',
                    'Please upload the bank receipt, passport-size photograph, and signature image.'
                );
                return;
            }

            if (
                receipt.size > maxFileSize ||
                photo.size > maxFileSize ||
                signature.size > maxFileSize
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

            if (!isAllowedImage(signature)) {
                showMessage(
                    'error',
                    'The signature image must be a JPG, JPEG, or PNG image.'
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
                signatureName.textContent = '';

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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initJoinForm);
    } else {
        initJoinForm();
    }
})();