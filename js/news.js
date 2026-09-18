
async function apiGet(path) {
  const res = await fetch(SLNA_CONFIG.API_BASE_URL + path);
  if (!res.ok) throw new Error('API request failed: ' + path);
  return res.json();
}
function formatDateLong(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
function fullUrl(relativePath) {
  if (!relativePath) return null;
  const apiOrigin = SLNA_CONFIG.API_BASE_URL.replace('/api', '');
  return apiOrigin + relativePath;
}
function escapeHtml(value) {
  return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
}
async function renderPublicNewsList() {
  const container = document.getElementById('news-list-container');

  if (!container) return;

  try {
    const items = await apiGet('/news');

    if (items.length === 0) {
      container.innerHTML =
          '<div class="news-empty">No news items published yet.</div>';
      return;
    }

    container.innerHTML = items.map(function (item) {
      const detailUrl = 'news-detail.html?id=' + encodeURIComponent(item.id);
      const title = escapeHtml(item.title || 'News Update');
      const date = formatDateLong(item.event_date);
      const excerpt = escapeHtml(
          item.summary || (item.body ? item.body.substring(0, 230) : '')
      );

      const imageHtml = item.photo_url
          ? '<img src="' + fullUrl(item.photo_url) + '" alt="' + title + '">'
          : '<div class="news-grid-placeholder" aria-hidden="true">SLNA</div>';

      return (
          '<article class="news-grid-card">' +
          '<a href="' + detailUrl + '" class="news-grid-image">' +
          imageHtml +
          '<span class="news-grid-label">News</span>' +
          '</a>' +

          '<div class="news-grid-body">' +
          '<div class="news-grid-meta">' +
          '<span>SLNA Admin</span>' +
          '<span>' + date + '</span>' +
          '</div>' +

          '<h2><a href="' + detailUrl + '">' + title + '</a></h2>' +
          '<p>' + excerpt + '</p>' +

          '<a href="' + detailUrl + '" class="news-grid-read-more">' +
          'Read More <span aria-hidden="true">&rarr;</span>' +
          '</a>' +
          '</div>' +
          '</article>'
      );
    }).join('');

  } catch (err) {
    container.innerHTML =
        '<div class="news-empty">Could not load news. Is the backend server running?</div>';

    console.error(err);
  }
}
async function renderHomeNewsPreview() {
  const container = document.getElementById('news-list-container');
  if (!container || !container.classList.contains('home-preview')) return;
  try {
    const items = (await apiGet('/news')).slice(0, 3);
    if (items.length === 0) { container.innerHTML = '<div class="news-empty">No news items published yet.</div>'; return; }
    container.innerHTML = '<div class="grid grid-3">' + items.map(item => {
      const imgHtml = item.photo_url ? '<img src="' + fullUrl(item.photo_url) + '" alt="">' : item.title.charAt(0);
      return '<a href="pages/news-detail.html?id=' + item.id + '" class="card"><div class="card-img">' + imgHtml + '</div><div class="card-body"><div class="date">' + formatDateLong(item.event_date) + '</div><h3>' + item.title + '</h3><p>' + (item.summary || item.body.substring(0, 120)) + '</p></div></a>';
    }).join('') + '</div>';
  } catch (err) { container.innerHTML = '<div class="news-empty">Could not load news. Is the backend server running?</div>'; console.error(err); }
}
async function renderNewsDetail() {
  const container = document.getElementById('news-detail-container');
  if (!container) return;
  const params = new URLSearchParams(window.location.search);
  try {
    const item = await apiGet('/news/' + params.get('id'));
    document.title = item.title + ' | SLNA';
    const photoHtml = item.photo_url ? '<div class="detail-photo"><img src="' + fullUrl(item.photo_url) + '" alt=""></div>' : '';
    const attachmentHtml = item.file_name ? '<div class="detail-attachment">Attachment: ' + item.file_name + '</div>' : '';
    const bcEl = document.getElementById('news-detail-breadcrumb');
    if (bcEl) bcEl.textContent = item.title;
    container.innerHTML = photoHtml + '<div class="detail-date">' + formatDateLong(item.event_date) + '</div><h1>' + item.title + '</h1><div class="detail-body">' + item.body + '</div>' + attachmentHtml;
  } catch (err) { container.innerHTML = '<div class="news-empty">News item not found.</div>'; console.error(err); }
}
async function renderAlbumGrid() {
  const container = document.getElementById('album-grid-container');
  if (!container) return;
  try {
    const albums = await apiGet('/albums');
    if (albums.length === 0) { container.innerHTML = '<div class="news-empty">No photo albums published yet.</div>'; return; }
    container.innerHTML = albums.map(album => {
      const cover = album.cover_photo ? '<img src="' + fullUrl(album.cover_photo) + '" alt="">' : '<div class="no-cover">No Photos</div>';
      return '<a href="album.html?id=' + album.id + '" class="album-tile"><div class="album-cover">' + cover + '<span class="album-count-badge">' + album.photo_count + ' photos</span></div><div class="album-info"><h3>' + album.title + '</h3><div class="album-date">' + formatDateLong(album.event_date) + '</div></div></a>';
    }).join('');
  } catch (err) { container.innerHTML = '<div class="news-empty">Could not load albums. Is the backend server running?</div>'; console.error(err); }
}
let _currentAlbumPhotos = []; let _currentLightboxIndex = 0;
async function renderAlbumDetail() {
  const container = document.getElementById('album-detail-container');
  if (!container) return;
  const params = new URLSearchParams(window.location.search);
  try {
    const album = await apiGet('/albums/' + params.get('id'));
    const headEl = document.getElementById('album-title-heading'); const bcEl = document.getElementById('album-title-breadcrumb');
    if (headEl) headEl.textContent = album.title;
    if (bcEl) bcEl.textContent = album.title;
    _currentAlbumPhotos = album.photos.map(p => fullUrl(p.photo_url));
    container.innerHTML = '<div class="photo-grid">' + _currentAlbumPhotos.map((p, idx) => '<div class="photo-tile" onclick="openLightbox(' + idx + ')"><img src="' + p + '" alt=""></div>').join('') + '</div>';
  } catch (err) { container.innerHTML = '<div class="news-empty">Album not found.</div>'; console.error(err); }
}
function openLightbox(index) { _currentLightboxIndex = index; updateLightboxImage(); document.getElementById('lightbox-overlay').classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeLightbox() { document.getElementById('lightbox-overlay').classList.remove('open'); document.body.style.overflow = ''; }
function lightboxNext() { _currentLightboxIndex = (_currentLightboxIndex + 1) % _currentAlbumPhotos.length; updateLightboxImage(); }
function lightboxPrev() { _currentLightboxIndex = (_currentLightboxIndex - 1 + _currentAlbumPhotos.length) % _currentAlbumPhotos.length; updateLightboxImage(); }
function updateLightboxImage() { document.getElementById('lightbox-img').src = _currentAlbumPhotos[_currentLightboxIndex]; document.getElementById('lightbox-counter').textContent = (_currentLightboxIndex + 1) + ' / ' + _currentAlbumPhotos.length; }
document.addEventListener('keydown', function (e) {
  const overlay = document.getElementById('lightbox-overlay');
  if (!overlay || !overlay.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox(); if (e.key === 'ArrowRight') lightboxNext(); if (e.key === 'ArrowLeft') lightboxPrev();
});
document.addEventListener('DOMContentLoaded', function () {
  renderPublicNewsList(); renderHomeNewsPreview(); renderAlbumGrid(); renderNewsDetail(); renderAlbumDetail();
});
