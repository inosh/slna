(function () {
  function getSiteBase() {
    var path = window.location.pathname;

    if (path.indexOf('/slna/') === 0) {
      return '/slna/';
    }

    return '/';
  }

  function partialsBase() {
    return getSiteBase() + 'partials/';
  }

  function normalisePartialPaths(html) {
    var base = getSiteBase();

    if (base === '/') {
      return html;
    }

    return html.replace(/(href|src)="\//g, '$1="' + base);
  }

  function loadPartial(url, targetId, onDone) {
    var target = document.getElementById(targetId);

    if (!target) {
      if (onDone) onDone();
      return;
    }

    fetch(url)
        .then(function (res) {
          if (!res.ok) {
            throw new Error(
                'Failed to fetch ' + url + ' (' + res.status + ')'
            );
          }

          return res.text();
        })
        .then(function (html) {
          target.outerHTML = normalisePartialPaths(html);

          if (onDone) {
            onDone();
          }
        })
        .catch(function (err) {
          console.error('[include-header] ' + err.message);

          if (onDone) {
            onDone();
          }
        });
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
    document.body.classList.add('layout-loading');

    var headerPromise = new Promise(function (resolve) {
      loadPartial(
          partialsBase() + 'header.html',
          'site-header',
          resolve
      );
    });

    var footerPromise = new Promise(function (resolve) {
      loadPartial(
          partialsBase() + 'footer.html',
          'site-footer',
          resolve
      );
    });

    Promise.all([headerPromise, footerPromise]).then(function () {
      markActiveNav();
      initNavToggle();
      initBackToTop();

      document.body.classList.remove('layout-loading');

      document.dispatchEvent(
          new CustomEvent('slna:layout-ready')
      );
    });
  });
})();