document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('contact-form');

  if (!form) {
    return;
  }

  var apiBaseUrl = String(SLNA_CONFIG.API_BASE_URL || '').replace(/\/+$/, '');
  var alertEl = document.getElementById('contact-form-alert');
  var mobileInput = document.getElementById('contact-mobile');

  if (mobileInput) {
    mobileInput.addEventListener('input', function () {
      var cursorPos = mobileInput.selectionStart;
      var cleaned = mobileInput.value.replace(/[\s-]/g, '');

      if (cleaned !== mobileInput.value) {
        mobileInput.value = cleaned;
        if (cursorPos !== null) {
          mobileInput.setSelectionRange(cursorPos - 1, cursorPos - 1);
        }
      }
    });
  }

  function showFormAlert(message, type) {
    if (!alertEl) {
      return;
    }

    alertEl.innerHTML = '<div class="alert alert-' + type + '">' + message + '</div>';
    alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    var submitButton = form.querySelector('button[type="submit"]');
    var originalLabel = submitButton ? submitButton.textContent : '';

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';
    }

    var payload = {
      fullName: document.getElementById('contact-name').value.trim(),
      email: document.getElementById('contact-email').value.trim(),
      mobileNumber: document.getElementById('contact-mobile').value.trim(),
      subject: document.getElementById('contact-subject').value,
      message: document.getElementById('contact-message').value.trim()
    };

    try {
      var response = await fetch(apiBaseUrl + '/contact-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      var data = null;

      try {
        data = await response.json();
      } catch (parseError) {
        // Ignore -- fall through to the generic message below.
      }

      if (!response.ok) {
        throw new Error((data && data.error) || 'Could not send your message. Please try again.');
      }

      showFormAlert(
        (data && data.message) || 'Thank you -- your message has been sent.',
        'success'
      );
      form.reset();
    } catch (error) {
      console.error('Could not submit contact form:', error);

      var message = error instanceof TypeError
        ? 'Could not reach the server. Please check your connection and try again.'
        : (error.message || 'Could not send your message. Please try again.');

      showFormAlert(message, 'error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel;
      }
    }
  });
});
