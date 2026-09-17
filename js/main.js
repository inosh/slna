document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');

  if (toggle && nav) {
    toggle.setAttribute('aria-expanded', 'false');

    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  document.querySelectorAll('.main-nav .nav-list > li').forEach(function (li) {
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

  var backToTop = document.querySelector('.back-to-top');

  if (backToTop) {
    window.addEventListener('scroll', function () {
      backToTop.style.display = window.scrollY > 400 ? 'flex' : 'none';
    });

    backToTop.addEventListener('click', function () {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  var loginForm = document.querySelector('#member-login-form');

  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      alert('Demo form.');
    });
  }

  var contactForm = document.querySelector('#contact-form');

  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      alert('Thank you!');
      contactForm.reset();
    });
  }

  var joinForm = document.querySelector('#join-form');

  if (joinForm) {
    joinForm.addEventListener('submit', function (e) {
      e.preventDefault();
      alert('Thank you for applying.');
      joinForm.reset();
    });
  }

  document.querySelectorAll('.side-menu h3').forEach(function (heading) {
    heading.setAttribute('role', 'button');
    heading.setAttribute('tabindex', '0');
    heading.setAttribute('aria-expanded', 'false');

    function toggleSideMenu() {
      if (window.innerWidth > 900) {
        return;
      }

      var menu = heading.closest('.side-menu');

      if (!menu) {
        return;
      }

      var isOpen = menu.classList.toggle('open');
      heading.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    heading.addEventListener('click', toggleSideMenu);

    heading.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSideMenu();
      }
    });
  });
});