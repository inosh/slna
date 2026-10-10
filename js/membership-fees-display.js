// js/membership-fees-display.js
// Fills in the admin-configurable fee amounts on the Membership Categories
// & Fees page. If the API is unreachable, the static placeholder text
// already in the HTML is left as-is.

(function () {
  function formatFeeAmount(amount) {
    const isWhole = Number.isInteger(amount);
    return 'Rs. ' + amount.toLocaleString('en-US', {
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: 2
    });
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function toggleHidden(id, hidden) {
    const el = document.getElementById(id);
    if (el) el.hidden = hidden;
  }

  function applyFees(fees) {
    const byKey = {};
    fees.forEach(function (fee) { byKey[fee.key] = fee; });

    const associate = byKey.associate;
    const lifetime = byKey.lifetime;
    const upgrade = byKey.upgrade;

    if (associate) {
      const text = associate.amount === null ? 'To be announced' : formatFeeAmount(associate.amount);
      setText('fee-amount-associate', text);
      setText('fee-amount-associate-table', text);
      setText('fee-amount-associate-step', text);
    }

    if (lifetime) {
      const text = lifetime.amount === null ? 'To be announced' : formatFeeAmount(lifetime.amount);
      setText('fee-amount-lifetime', text);
      setText('fee-amount-lifetime-faq', text);
      setText('fee-amount-lifetime-table', lifetime.amount === null ? text : text + ' (one-time)');
    }

    if (upgrade) {
      const isTba = upgrade.amount === null;
      const amountText = isTba ? '' : formatFeeAmount(upgrade.amount);

      setText('fee-amount-upgrade-step', isTba ? 'Additional fee to be announced' : 'Additional fee: ' + amountText);
      setText('fee-amount-upgrade-table', isTba ? 'To be announced' : amountText);
      setText('fee-amount-upgrade-faq', isTba ? 'to be announced' : 'of ' + amountText);
      setText('fee-amount-upgrade-notice', amountText);

      toggleHidden('upgrade-tba-notice', !isTba);
      toggleHidden('upgrade-fee-set-notice', isTba);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('fee-amount-lifetime')) return;

    fetch(SLNA_CONFIG.API_BASE_URL + '/membership-fees')
        .then(function (res) {
          if (!res.ok) throw new Error('bad status');
          return res.json();
        })
        .then(applyFees)
        .catch(function () {
          // Leave the static placeholder text already in the HTML.
        });
  });
})();
