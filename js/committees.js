document.addEventListener('DOMContentLoaded', function () {
    var listEl = document.querySelector('#committee-list');
    var detailEl = document.querySelector('#committee-detail');
    var committeeNumber = document.querySelector('#committee-number');
    var committeeName = document.querySelector('#committee-name');
    var committeeDescription = document.querySelector(
        '#committee-description'
    );
    var committeeMembers = document.querySelector('#committee-members');

    if (
        !listEl ||
        !detailEl ||
        !committeeNumber ||
        !committeeName ||
        !committeeDescription ||
        !committeeMembers
    ) {
        return;
    }

    var avatarIcon =
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2.5c-3.34 0-10 1.68-10 5V22h20v-2.5c0-3.32-6.66-5-10-5z"/>' +
        '</svg>';

    var committees = [];

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderMembers(members) {
        committeeMembers.innerHTML = members
            .map(function (member) {
                return (
                    '<article class="committee-member">' +
                    '<div class="committee-member-photo placeholder-photo">' +
                    avatarIcon +
                    '</div>' +
                    '<div class="committee-member-info">' +
                    '<h5>' + escapeHtml(member.name) + '</h5>' +
                    '<p>' + escapeHtml(member.designation || '') + '</p>' +
                    '</div>' +
                    '</article>'
                );
            })
            .join('');
    }

    function showCommittee(slotKey) {
        var committee = committees.filter(function (c) {
            return c.slot_key === slotKey;
        })[0];

        if (!committee) return;

        listEl.querySelectorAll('.committee-card').forEach(function (card) {
            var isActive = card.getAttribute('data-committee') === slotKey;
            card.classList.toggle('active', isActive);
            card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        detailEl.hidden = false;
        committeeNumber.textContent = String(committee.display_order).padStart(2, '0');
        committeeName.textContent = committee.name;
        committeeDescription.textContent = committee.description || '';
        renderMembers(committee.members || []);
    }

    function scrollToDetail() {
        var header = document.querySelector('.site-header');
        var headerHeight = header ? header.getBoundingClientRect().height : 0;
        var targetTop =
            detailEl.getBoundingClientRect().top + window.scrollY - headerHeight - 16;

        window.scrollTo({
            top: Math.max(targetTop, 0),
            behavior: 'smooth'
        });
    }

    function renderList() {
        listEl.innerHTML = committees.map(function (committee) {
            return (
                '<button class="committee-card" type="button" data-committee="' + escapeHtml(committee.slot_key) + '" aria-controls="committee-detail" aria-pressed="false">' +
                '<span class="committee-number">' + String(committee.display_order).padStart(2, '0') + '</span>' +
                '<span class="committee-title">' + escapeHtml(committee.name.replace(/\s+Committee$/, '')) + '</span>' +
                '<span class="committee-arrow" aria-hidden="true">→</span>' +
                '</button>'
            );
        }).join('');

        listEl.querySelectorAll('.committee-card').forEach(function (card) {
            card.addEventListener('click', function () {
                showCommittee(card.getAttribute('data-committee'));
                scrollToDetail();
            });
        });
    }

    fetch(SLNA_CONFIG.API_BASE_URL + '/sub-committees')
        .then(function (res) {
            if (!res.ok) throw new Error('bad status');
            return res.json();
        })
        .then(function (data) {
            committees = data || [];

            if (!committees.length) {
                listEl.innerHTML = '<div class="empty-table-state">Sub Committee details are not available right now.</div>';
                return;
            }

            renderList();
            showCommittee(committees[0].slot_key);
        })
        .catch(function () {
            listEl.innerHTML = '<div class="empty-table-state">Could not load the Sub Committees. Please try again later.</div>';
        });
});
