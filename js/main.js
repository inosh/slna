document.addEventListener('DOMContentLoaded', function () {
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