// js/membership-fees-display.js
// Fills in the admin-set membership fees wherever a page has a span for
// them. For each category key (lifetime, ordinary, associate):
//   #fee-amount-<key>         "Rs. 6,000"
//   #fee-amount-<key>-table   "Rs. 6,000 (one-time)" / "Rs. 1,200 per year"
//   #fee-amount-<key>-faq     "Rs. 6,000"
// If the API is unreachable, the placeholder text already in the HTML is
// left as-is.

(function () {
  var KEYS = ['lifetime', 'ordinary', 'associate'];

  function formatFeeAmount(amount) {
    var isWhole = Number.isInteger(amount);
    return 'Rs. ' + amount.toLocaleString('en-US', {
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: 2
    });
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function applyFees(fees) {
    var byKey = {};
    fees.forEach(function (fee) { byKey[fee.key] = fee; });

    KEYS.forEach(function (key) {
      var fee = byKey[key];
      if (!fee) return;

      var text = fee.amount === null ? 'To be announced' : formatFeeAmount(fee.amount);
      var period = key === 'lifetime' ? ' (one-time)' : ' per year';

      setText('fee-amount-' + key, text);
      setText('fee-amount-' + key + '-faq', text);
      setText('fee-amount-' + key + '-table', fee.amount === null ? text : text + period);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var hasFeeSpan = KEYS.some(function (key) {
      return document.getElementById('fee-amount-' + key) || document.getElementById('fee-amount-' + key + '-table');
    });
    if (!hasFeeSpan) return;

    fetch(SLNA_CONFIG.API_BASE_URL + '/membership-fees')
        .then(function (res) {
          if (!res.ok) throw new Error('bad status');
          return res.json();
        })
        .then(applyFees)
        .catch(function () {
          // Leave the placeholder text already in the HTML.
        });
  });
})();
