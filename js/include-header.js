(function () {
  function getSiteBase() {
    var path = window.location.pathname;

    if (path.indexOf('/slna/') === 0) {
      return '/slna/';
    }

    return '/';
  }

  function markActiveNav() {
    var base = getSiteBase();
    var path = window.location.pathname.toLowerCase();

    document.querySelectorAll(
        '.main-nav .nav-list > li[data-page]'
    ).forEach(function (li) {
      var page = (li.getAttribute('data-page') || '').toLowerCase();

      if (base !== '/' && page.indexOf('/') === 0) {
        page = base + page.substring(1);
      }

      if (page && path === page) {
        li.classList.add('active');
      }
    });
  }

  function initNavToggle() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.main-nav');

    if (toggle && nav) {
      toggle.setAttribute('aria-expanded', 'false');

      toggle.addEventListener('click', function () {
        var isOpen = nav.classList.toggle('open');

        toggle.setAttribute(
            'aria-expanded',
            isOpen ? 'true' : 'false'
        );
      });
    }

    document.querySelectorAll(
        '.main-nav .nav-list > li'
    ).forEach(function (li) {
      var link = li.querySelector(':scope > a');
      var dropdown = li.querySelector(':scope > .dropdown');

      if (link && dropdown) {
        link.addEventListener('click', function (e) {
          if (window.innerWidth <= 900) {
            e.preventDefault();
            li.classList.toggle('open');
          }
        });
      } else if (link) {
        link.addEventListener('click', function () {
          if (window.innerWidth <= 900 && nav) {
            nav.classList.remove('open');

            if (toggle) {
              toggle.setAttribute('aria-expanded', 'false');
            }
          }
        });
      }
    });
  }

  function initBackToTop() {
    var backToTop = document.querySelector('.back-to-top');

    if (!backToTop) {
      return;
    }

    window.addEventListener('scroll', function () {
      backToTop.style.display =
          window.scrollY > 400 ? 'flex' : 'none';
    });

    backToTop.addEventListener('click', function () {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    markActiveNav();
    initNavToggle();
    initBackToTop();

    document.dispatchEvent(
        new CustomEvent('slna:layout-ready')
    );
  });
})();
