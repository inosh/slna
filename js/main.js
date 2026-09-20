document.addEventListener('DOMContentLoaded', function () {
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