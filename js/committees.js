document.addEventListener('DOMContentLoaded', function () {
    var committeeCards = document.querySelectorAll('.committee-card');
    var committeeNumber = document.querySelector('#committee-number');
    var committeeName = document.querySelector('#committee-name');
    var committeeDescription = document.querySelector(
        '#committee-description'
    );
    var committeeMembers = document.querySelector('#committee-members');

    if (
        !committeeCards.length ||
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

    var committees = {
        'educational-service': {
            number: '01',
            name: 'Educational Service Committee',
            description:
                'The Educational Service Committee supports the advancement of nursing education, continuing professional development, and initiatives that strengthen the knowledge and clinical skills of nurses across Sri Lanka.',
            members: [
                { designation: 'Professor', name: 'Prof. Thamara Amarasekara' },
                { designation: 'Sp. Gr. Nursing Tutor', name: 'Ms. I. D. T. N. K. Thilakarathne' },
                { designation: 'Nursing Sister', name: 'Ms. Ganga Mulleriyawa' },
                { designation: 'Nursing Director', name: 'Ms. Dayani Perera' },
                { designation: 'Sp. Gr. Nursing Tutor', name: 'Ms. N. P. Dullewa' }
            ]
        },

        'nursing-service': {
            number: '02',
            name: 'Nursing Service Committee',
            description:
                'The Nursing Service Committee considers matters affecting nursing service delivery, professional practice, quality of care, and the working conditions of nurses in clinical and public health settings.',
            members: [
                { designation: 'Professor', name: 'Prof. S. S. P. Warnakulasuriya' },
                { designation: 'Nursing Officer', name: 'Ms. Samudra Gunarathne' },
                { designation: 'Nursing Officer', name: 'Mr. Keerthi Weerakoon' },
                { designation: 'Nursing Sister (Public Health)', name: 'Ms. R. S. Abeyrama' },
                { designation: 'Nursing Sister', name: 'Ms. Lasanthi Nagasinghe' }
            ]
        },

        election: {
            number: '03',
            name: 'Election Committee',
            description:
                'The Election Committee conducts and oversees the Association’s elections, including nominations, balloting, and the proper administration of election procedures in accordance with the SLNA constitution.',
            members: [
                { designation: 'Sp. Gr. Nursing Officer', name: 'Ms. Chamari Perera' },
                { designation: 'Sp. Gr. Nursing Tutor', name: 'Ms. K. M. D. G. Krishanthi' },
                { designation: 'Sp. Gr. Nursing Officer', name: 'Ms. T. A. D. R. G. Thalagala' },
                { designation: 'Nursing Sister (Public Health)', name: 'Ms. A. N. Palliyaguru' },
                { designation: 'Sp. Gr. Nursing Tutor', name: 'Ms. R. M. P. S. K. Rupasinghe' }
            ]
        },

        'publications-public-awareness': {
            number: '04',
            name: 'Publications & Public Awareness Committee',
            description:
                'The Publications & Public Awareness Committee oversees SLNA publications and communications, and promotes public awareness of the nursing profession and the Association’s work.',
            members: [
                { designation: 'Nursing Sister (Public Health)', name: 'Ms. Manohari' },
                { designation: 'Nursing Sister', name: 'Ms. K. A. D. P. Vidyarathna' },
                { designation: 'Nursing Officer', name: 'Ms. D. M. A. S. Dissanayaka' },
                { designation: 'Sp. Gr. Nursing Tutor', name: 'Ms. G. B. Rohini' },
                { designation: 'Nursing Officer', name: 'Mr. K. H. D. Madushanka' }
            ]
        },

        finance: {
            number: '05',
            name: 'Finance Committee',
            description:
                'The Finance Committee supports responsible financial planning, budget oversight, income and expenditure review, and the sustainable use of Association resources.',
            members: [
                { designation: 'Nursing Officer', name: 'Ms. A. M. C. Niroshika' },
                { designation: 'Nursing Officer', name: 'Ms. P. A. D. Nimali' },
                { designation: 'Nursing Sister (Public Health)', name: 'Ms. Lahiru Subhashini' },
                { designation: 'Nursing Officer', name: 'Mr. C. Madhushan Abeywickrama' },
                { designation: 'Nursing Officer', name: 'Ms. H. P. N. Hansika Jayasinghe' }
            ]
        },

        'programme-organizing': {
            number: '06',
            name: 'Programme Organizing Committee',
            description:
                'The Programme Organizing Committee plans and coordinates the Association’s conferences, workshops, seminars, and other member programmes and events.',
            members: [
                { designation: 'Nursing Sister (Public Health)', name: 'Ms. R. Dharmika' },
                { designation: 'Nursing Officer', name: 'Ms. C. U. Erawwala' },
                { designation: 'Nursing Officer', name: 'Ms. R. M. P. B. Senavirathna' },
                { designation: 'Nursing Officer', name: 'Mr. A. G. H. Lahiru Siriwardana' },
                { designation: 'Nursing Officer', name: 'Mrs. K. A. A. N. Damayanthi' }
            ]
        },

        'social-economic-development': {
            number: '07',
            name: 'Social and Economic Development Committee',
            description:
                'The Social and Economic Development Committee supports member welfare, social development initiatives, and programmes that advance the economic wellbeing of nurses and their communities.',
            members: [
                { designation: 'Nursing Officer', name: 'Ms. B. G. S. C. K. Ariyadas' },
                { designation: 'Nursing Sister (Public Health)', name: 'Ms. Lahiru Subha Rodrigo' },
                { designation: 'Nursing Officer', name: 'Mr. S. M. D. D. Senanayake' },
                { designation: 'Nursing Officer', name: 'Ms. P. R. Chamudi Lalindika' },
                { designation: 'Nursing Officer', name: 'Mrs. K. A. A. Udayangani' }
            ]
        }
    };

    function renderMembers(members) {
        committeeMembers.innerHTML = members
            .map(function (member) {
                return (
                    '<article class="committee-member">' +
                    '<div class="committee-member-photo placeholder-photo">' +
                    avatarIcon +
                    '</div>' +
                    '<div class="committee-member-info">' +
                    '<h5>' + member.name + '</h5>' +
                    '<p>' + member.designation + '</p>' +
                    '</div>' +
                    '</article>'
                );
            })
            .join('');
    }

    function showCommittee(card) {
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
        renderMembers(committee.members);
    }

    function scrollToDetail() {
        var detail = document.querySelector('#committee-detail');
        var header = document.querySelector('.site-header');
        var headerHeight = header ? header.getBoundingClientRect().height : 0;
        var targetTop =
            detail.getBoundingClientRect().top + window.scrollY - headerHeight - 16;

        window.scrollTo({
            top: Math.max(targetTop, 0),
            behavior: 'smooth'
        });
    }

    committeeCards.forEach(function (card) {
        card.addEventListener('click', function () {
            showCommittee(card);
            scrollToDetail();
        });
    });

    var initialCard = document.querySelector('.committee-card.active') || committeeCards[0];
    showCommittee(initialCard);
});
