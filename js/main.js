// Shared by news-detail and event-detail pages to render a small
// icon-only "share this" row for the current page, meant to sit below the
// content (standard article placement, and keeps the headline area free
// of clutter on pages like the CPD event detail that already carry type/
// status badges up top). Facebook's crawler doesn't run JS, so its link
// preview falls back to the page's static <meta> tags rather than the
// article's own title/photo -- acceptable for now since these pages don't
// render server-side.
function slnaShareButtonsHtml(title) {
  var url = window.location.href;
  var waText = encodeURIComponent(title ? title + ' - ' + url : url);
  var waHref = 'https://wa.me/?text=' + waText;
  var fbHref = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);

  return '' +
    '<div class="share-buttons">' +
      '<span class="share-label">Share this page</span>' +
      '<a class="share-btn share-whatsapp" href="' + waHref + '" target="_blank" rel="noopener" aria-label="Share on WhatsApp">' +
        '<svg viewBox="0 0 448 512" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.8l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>' +
      '</a>' +
      '<a class="share-btn share-facebook" href="' + fbHref + '" target="_blank" rel="noopener" aria-label="Share on Facebook">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8v-6.78H7.9V12.2H10V9.8c0-2.07 1.26-3.22 3.15-3.22.9 0 1.85.16 1.85.16v2.3h-1.04c-1.02 0-1.34.64-1.34 1.3v1.86h2.3l-.37 2.82H12.6V21.8c4.56-.93 8-4.96 8-9.8z"/></svg>' +
      '</a>' +
    '</div>';
}

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