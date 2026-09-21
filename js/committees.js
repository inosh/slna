document.addEventListener('DOMContentLoaded', function () {
    var committeeCards = document.querySelectorAll('.committee-card');
    var committeeNumber = document.querySelector('#committee-number');
    var committeeName = document.querySelector('#committee-name');
    var committeeDescription = document.querySelector(
        '#committee-description'
    );

    if (
        !committeeCards.length ||
        !committeeNumber ||
        !committeeName ||
        !committeeDescription
    ) {
        return;
    }

    var committees = {
        'nursing-education': {
            number: '01',
            name: 'Nursing Education Committee',
            description:
                'The Nursing Education Committee supports the advancement of nursing education, continuing professional development, professional learning, and initiatives that strengthen the knowledge and skills of nurses in Sri Lanka.'
        },

        'nursing-services': {
            number: '02',
            name: 'Nursing Services Committee',
            description:
                'The Nursing Services Committee considers matters affecting nursing service delivery, professional practice, quality of care, working environments, and the collective professional interests of nurses.'
        },

        planning: {
            number: '03',
            name: 'Organisation, Strategy & Planning Committee',
            description:
                'The Organisation, Strategy & Planning Committee supports structured planning, organisational development, priority setting, and the monitoring of initiatives that advance the Association’s objectives.'
        },

        'public-relations': {
            number: '04',
            name: 'Publicity & Public Relations Committee',
            description:
                'The Publicity & Public Relations Committee promotes SLNA activities, supports communication with members and the public, and strengthens the Association’s public profile and professional relationships.'
        },

        nominations: {
            number: '05',
            name: 'Nominations Committee',
            description:
                'The Nominations Committee supports transparent and orderly nomination processes in accordance with the Association’s constitution, rules, and approved election procedures.'
        },

        welfare: {
            number: '06',
            name: 'Membership & Financial Welfare Committee',
            description:
                'The Membership & Financial Welfare Committee considers member engagement, membership support, welfare initiatives, and financial assistance or benefits approved for eligible members.'
        },

        finance: {
            number: '07',
            name: 'Finance Committee',
            description:
                'The Finance Committee supports responsible financial planning, budget oversight, income and expenditure review, and the sustainable use of Association resources.'
        }
    };

    committeeCards.forEach(function (card) {
        card.addEventListener('click', function () {
            var committeeKey = card.getAttribute('data-committee');
            var committee = committees[committeeKey];

            if (!committee) {
                return;
            }

            committeeCards.forEach(function (item) {
                item.classList.remove('active');
                item.setAttribute('aria-pressed', 'false');
            });

            card.classList.add('active');
            card.setAttribute('aria-pressed', 'true');

            committeeNumber.textContent = committee.number;
            committeeName.textContent = committee.name;
            committeeDescription.textContent = committee.description;

            document.querySelector('#committee-detail').scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        });
    });
});