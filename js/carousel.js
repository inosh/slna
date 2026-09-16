
document.addEventListener('DOMContentLoaded', function () {
  const carousel = document.getElementById('vision-carousel');
  if (!carousel) return;
  const slides = carousel.querySelectorAll('.carousel-slide');
  const dotsContainer = document.getElementById('carousel-dots');
  let current = 0; let autoTimer;
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => goToSlide(i));
    dotsContainer.appendChild(dot);
  });
  const dots = dotsContainer.querySelectorAll('.carousel-dot');
  function goToSlide(index) {
    slides[current].classList.remove('active'); dots[current].classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active'); dots[current].classList.add('active');
  }
  function nextSlide() { goToSlide(current + 1); }
  function prevSlide() { goToSlide(current - 1); }
  document.getElementById('carousel-next').addEventListener('click', () => { nextSlide(); resetAutoTimer(); });
  document.getElementById('carousel-prev').addEventListener('click', () => { prevSlide(); resetAutoTimer(); });
  function resetAutoTimer() { clearInterval(autoTimer); autoTimer = setInterval(nextSlide, 5500); }
  resetAutoTimer();
});
