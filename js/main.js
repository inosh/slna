
document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle) { toggle.addEventListener('click', function () { nav.classList.toggle('open'); }); }
  document.querySelectorAll('.main-nav .nav-list > li').forEach(function (li) {
    var link = li.querySelector('a'); var dropdown = li.querySelector('.dropdown');
    if (dropdown && window.innerWidth <= 900) { link.addEventListener('click', function (e) { e.preventDefault(); li.classList.toggle('open'); }); }
  });
  var backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', function () { backToTop.style.display = window.scrollY > 400 ? 'flex' : 'none'; });
    backToTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }
  var loginForm = document.querySelector('#member-login-form');
  if (loginForm) { loginForm.addEventListener('submit', function (e) { e.preventDefault(); alert('Demo form.'); }); }
  var contactForm = document.querySelector('#contact-form');
  if (contactForm) { contactForm.addEventListener('submit', function (e) { e.preventDefault(); alert('Thank you!'); contactForm.reset(); }); }
  var joinForm = document.querySelector('#join-form');
  if (joinForm) { joinForm.addEventListener('submit', function (e) { e.preventDefault(); alert('Thank you for applying.'); joinForm.reset(); }); }
});
