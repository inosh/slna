
async function apiGet(path) {
  const res = await fetch(SLNA_CONFIG.API_BASE_URL + path);
  if (!res.ok) throw new Error('API request failed: ' + path);
  return res.json();
}
function formatDateLong(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
function formatDateBadge(dateStr) {
  const d = new Date(dateStr);
  return {
    day: d.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' }),
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()
  };
}
function fullUrl(relativePath) {
  if (!relativePath) return null;
  const apiOrigin = SLNA_CONFIG.API_BASE_URL.replace('/api', '');
  return apiOrigin + relativePath;
}
// A news cover may be a photo or a video; the stored URL keeps the file's extension.
function isVideoUrl(url) {
  return /\.(mp4|m4v|webm|mov|ogg|ogv|avi)$/i.test(String(url || ''));
}
// Cover for cards and lists: the photo, or the video's first frame with a play mark.
function coverMediaHtml(url, alt) {
  return isVideoUrl(url)
    ? '<video src="' + fullUrl(url) + '" muted playsinline preload="metadata"></video><span class="media-play-icon">&#9658;</span>'
    : '<img src="' + fullUrl(url) + '" alt="' + (alt || '') + '">';
}
function escapeHtml(value) {
  return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
}
// Full Content is stored as rich HTML; strip tags before using it as a
// plain-text excerpt (card previews, meta description) so truncation can't
// cut mid-tag and corrupt the surrounding markup.
function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = String(html || '');
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}
// News/album body is admin-authored rich HTML (from the Quill editor) that
// we DO want to render as HTML, not escape -- so it needs sanitizing
// instead, to strip any <script>/event-handler/etc. a compromised or
// careless admin account could have saved. Falls back to escaped plain
// text (rather than ever injecting the raw HTML) if DOMPurify fails to load.
function sanitizeHtml(html) {
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(String(html || ''));
  }
  console.error('DOMPurify failed to load; rendering rich text as plain text.');
  return escapeHtml(stripHtml(html));
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
          item.summary || (item.body ? stripHtml(item.body).substring(0, 230) : '')
      );

      const imageHtml = item.photo_url
          ? coverMediaHtml(item.photo_url, title)
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
// Fills the scrolling headline strip at the top of news.html. No-ops on
// any other page since #news-ticker only exists there. Items are rendered
// twice back-to-back so the CSS animation (translateX 0 -> -50%) loops
// seamlessly instead of visibly jumping when it restarts.
async function renderNewsTicker() {
  const ticker = document.getElementById('news-ticker');
  const content = document.getElementById('news-ticker-content');

  if (!ticker || !content) return;

  try {
    const items = await apiGet('/news');

    if (items.length === 0) return;

    const itemsHtml = items.map(function (item) {
      const detailUrl = 'news-detail.html?id=' + encodeURIComponent(item.id);
      const title = escapeHtml(item.title || 'News Update');

      return '<a href="' + detailUrl + '">' + title + '</a>' +
          '<span class="news-ticker-sep" aria-hidden="true">&bull;</span>';
    }).join('');

    content.innerHTML = itemsHtml + itemsHtml;
    ticker.hidden = false;
  } catch (err) {
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
      const title = escapeHtml(item.title || 'News Update');
      const imgHtml = item.photo_url ? coverMediaHtml(item.photo_url, '') : title.charAt(0);
      const preview = escapeHtml(item.summary || stripHtml(item.body).substring(0, 120));
      return '<a href="pages/news-detail.html?id=' + item.id + '" class="card"><div class="card-img">' + imgHtml + '</div><div class="card-body"><div class="date">' + formatDateLong(item.event_date) + '</div><h3>' + title + '</h3><p>' + preview + '</p></div></a>';
    }).join('') + '</div>';
  } catch (err) { container.innerHTML = '<div class="news-empty">Could not load news. Is the backend server running?</div>'; console.error(err); }
}
// Builds a Facebook-style multi-photo grid for a news item's linked album:
// 1 photo full-width, 2/3/4 as an equal row/grid, 5+ as 2 large tiles on
// top and 3 below with a "+N" overlay on the last tile for any photos
// beyond the 5 shown. Clicking any tile opens the shared lightbox (see
// openLightbox below) over the *full* photo set, not just the visible tiles.
function renderNewsGallery(photos) {
  if (!photos || photos.length === 0) return '';

  _currentAlbumPhotos = photos.map(p => fullUrl(p.photo_url));
  _currentAlbumMediaTypes = photos.map(p => p.media_type || 'image');
  const count = photos.length;

  function media(idx) {
    return _currentAlbumMediaTypes[idx] === 'video'
        ? '<video src="' + _currentAlbumPhotos[idx] + '" muted preload="metadata"></video><span class="media-play-icon">&#9658;</span>'
        : '<img src="' + _currentAlbumPhotos[idx] + '" alt="">';
  }
  function tile(idx, overlayCount) {
    const overlay = overlayCount
        ? '<div class="gallery-more-overlay">+' + overlayCount + '</div>'
        : '';
    return '<div class="gallery-tile" onclick="openLightbox(' + idx + ')">' +
        media(idx) + overlay + '</div>';
  }
  function row(indexes, extraStyle) {
    return '<div class="gallery-row" style="grid-template-columns:repeat(' + indexes.length + ',1fr);' + (extraStyle || '') + '">' +
        indexes.map(i => tile(i)).join('') + '</div>';
  }

  let rowsHtml;
  if (count <= 4) {
    rowsHtml = row(photos.map((_, i) => i));
  } else {
    const remaining = count - 5;
    rowsHtml =
        row([0, 1]) +
        '<div class="gallery-row" style="grid-template-columns:repeat(3,1fr);">' +
        tile(2) + tile(3) +
        '<div class="gallery-tile" onclick="openLightbox(4)">' + media(4) +
        (remaining > 0 ? '<div class="gallery-more-overlay">+' + remaining + '</div>' : '') +
        '</div></div>';
  }

  const countClass = count === 1 ? 'count-1' : (count >= 5 ? 'count-5plus' : 'count-' + count);
  return '<div class="news-photo-gallery ' + countClass + '">' + rowsHtml + '</div>' +
      '<div class="news-gallery-caption">' + count + ' item' + (count === 1 ? '' : 's') + ' from this event</div>';
}
async function renderNewsDetail() {
  const container = document.getElementById('news-detail-container');
  if (!container) return;
  const params = new URLSearchParams(window.location.search);
  try {
    const item = await apiGet('/news/' + params.get('id'));
    const title = escapeHtml(item.title || 'News Update');
    document.title = (item.title || 'News Update') + ' | SLNA';
    const photoHtml = !item.photo_url ? ''
      : isVideoUrl(item.photo_url)
        ? '<div class="detail-photo"><video src="' + fullUrl(item.photo_url) + '" controls playsinline preload="metadata"></video></div>'
        : '<div class="detail-photo"><img src="' + fullUrl(item.photo_url) + '" alt=""></div>';
    const attachmentHtml = item.file_name ? '<div class="detail-attachment">Attachment: ' + escapeHtml(item.file_name) + '</div>' : '';
    const galleryHtml = renderNewsGallery(item.photos);
    const bcEl = document.getElementById('news-detail-breadcrumb');
    if (bcEl) bcEl.textContent = item.title;
    const badge = formatDateBadge(item.event_date);
    const badgeHtml = '<div class="news-date-badge"><span class="day">' + badge.day + '</span><span class="month">' + badge.month + '</span></div>';
    container.innerHTML = '<div class="news-detail-header">' + badgeHtml + '<h1>' + title + '</h1></div>' + photoHtml + '<div class="detail-body ql-editor">' + sanitizeHtml(item.body) + '</div>' + galleryHtml + attachmentHtml + slnaShareButtonsHtml(item.title);

    const bodyText = container.querySelector('.detail-body');
    const description = item.summary || (bodyText ? bodyText.textContent.trim().slice(0, 300) : '');
    const canonicalUrl = window.location.origin + window.location.pathname + '?id=' + encodeURIComponent(params.get('id'));
    slnaSetCanonicalAndSchema(canonicalUrl, {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: item.title || 'News Update',
      description: description,
      datePublished: item.event_date,
      dateModified: item.updated_at || item.event_date,
      image: item.photo_url && !isVideoUrl(item.photo_url) ? [fullUrl(item.photo_url)] : undefined,
      publisher: {
        '@type': 'Organization',
        name: "Sri Lanka Nurses Association",
        logo: { '@type': 'ImageObject', url: 'https://slna.lk/images/slna-logo-footer.png' }
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl }
    });
  } catch (err) { container.innerHTML = '<div class="news-empty">News item not found.</div>'; console.error(err); }
}
async function renderNewsSidebar() {
  const container = document.getElementById('news-sidebar-list');
  if (!container) return;
  const currentId = new URLSearchParams(window.location.search).get('id');
  try {
    const items = await apiGet('/news');
    const others = items.filter(item => String(item.id) !== String(currentId)).slice(0, 6);
    if (others.length === 0) {
      container.innerHTML = '<div class="news-empty">No other news items.</div>';
      return;
    }
    container.innerHTML = others.map(item => {
      const thumb = item.photo_url
          ? coverMediaHtml(item.photo_url, '')
          : '<div class="news-sidebar-thumb-fallback">' + escapeHtml((item.title || '?').charAt(0)) + '</div>';
      return '<a class="news-sidebar-item" href="news-detail.html?id=' + item.id + '">' +
          '<div class="news-sidebar-thumb">' + thumb + '</div>' +
          '<div class="news-sidebar-item-body"><h4>' + escapeHtml(item.title) + '</h4><div class="date">' + formatDateLong(item.event_date) + '</div></div>' +
          '</a>';
    }).join('');
  } catch (err) {
    container.innerHTML = '<div class="news-empty">Could not load latest news.</div>';
    console.error(err);
  }
}
// Gallery page, two views:
//   All    - every photo and video from every album (newest album first)
//   Albums - one card per album, opening the album page
// ?view=albums opens the album cards; the address follows the chosen view.
// Any photo/video opens the shared lightbox over the items shown.
async function renderAlbumGrid() {
  const albumsEl = document.getElementById('album-grid-container');
  const allEl = document.getElementById('gallery-all-container');
  if (!albumsEl) return;
  const countEl = document.getElementById('gallery-count');
  const radios = document.querySelectorAll('[name="gallery-view"]');
  const ALL_BATCH = 24;
  let albums = [];

  // "12 photos and 1 video"
  function countText(items) {
    const videos = items.filter(p => (p.media_type || 'image') === 'video').length;
    const photos = items.length - videos;
    const part = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
    return [photos && part(photos, 'photo'), videos && part(videos, 'video')].filter(Boolean).join(' and ');
  }

  function setUrl(view) {
    const url = new URL(window.location.href);
    if (view === 'albums') url.searchParams.set('view', 'albums'); else url.searchParams.delete('view');
    history.replaceState(null, '', url);
  }

  function showAlbums() {
    if (allEl) allEl.hidden = true;
    albumsEl.hidden = false;
    if (countEl) countEl.textContent = albums.length + ' album' + (albums.length === 1 ? '' : 's');
    if (albums.length === 0) { albumsEl.innerHTML = '<div class="news-empty">No photo albums published yet.</div>'; setUrl('albums'); return; }
    albumsEl.innerHTML = albums.map(album => {
      const cover = !album.cover_photo
        ? '<div class="no-cover">No Photos</div>'
        : album.cover_media_type === 'video'
          ? '<video src="' + fullUrl(album.cover_photo) + '" muted preload="metadata"></video><span class="media-play-icon">&#9658;</span>'
          : '<img src="' + fullUrl(album.cover_photo) + '" alt="" loading="lazy">';
      return '<a href="album.html?id=' + album.id + '" class="album-tile"><div class="album-cover">' + cover + '<span class="album-count-badge">' + album.photo_count + ' item(s)</span></div><div class="album-info"><h3>' + escapeHtml(album.title) + '</h3><div class="album-date">' + formatDateLong(album.event_date) + '</div></div></a>';
    }).join('');
    setUrl('albums');
  }

  function showAll() {
    albumsEl.hidden = true;
    if (!allEl) return;
    allEl.hidden = false;
    const items = albums.flatMap(album => (album.photos || []).map(p => ({ url: fullUrl(p.photo_url), media_type: p.media_type || 'image', title: album.title })));
    _currentAlbumPhotos = items.map(p => p.url);
    _currentAlbumMediaTypes = items.map(p => p.media_type);
    if (countEl) countEl.textContent = countText(items);
    setUrl('all');
    if (items.length === 0) { allEl.innerHTML = '<div class="news-empty">No photos or videos published yet.</div>'; return; }

    // Tiles are added a batch at a time ("Show more"), so a large gallery
    // doesn't load every photo and video at once.
    let shown = 0;
    allEl.innerHTML = '<div class="photo-grid"></div><div class="gallery-more" hidden><button type="button" class="btn btn-outline">Show more</button></div>';
    const grid = allEl.querySelector('.photo-grid');
    const more = allEl.querySelector('.gallery-more');
    function addBatch() {
      const next = items.slice(shown, shown + ALL_BATCH);
      grid.insertAdjacentHTML('beforeend', next.map((p, k) => {
        const idx = shown + k;
        const media = p.media_type === 'video'
          ? '<video src="' + p.url + '" muted preload="metadata"></video><span class="media-play-icon">&#9658;</span>'
          : '<img src="' + p.url + '" alt="' + escapeHtml(p.title) + '" loading="lazy">';
        return '<div class="photo-tile" title="' + escapeHtml(p.title) + '" onclick="openLightbox(' + idx + ')">' + media + '</div>';
      }).join(''));
      shown += next.length;
      more.hidden = shown >= items.length;
    }
    more.querySelector('button').addEventListener('click', addBatch);
    addBatch();
  }

  radios.forEach(r => r.addEventListener('change', () => (r.value === 'albums' ? showAlbums() : showAll())));

  try {
    albums = await apiGet('/albums?include=photos');
    if (new URLSearchParams(window.location.search).get('view') === 'albums' || !allEl) {
      const albumsRadio = document.querySelector('[name="gallery-view"][value="albums"]');
      if (albumsRadio) albumsRadio.checked = true;
      showAlbums();
    } else {
      showAll();
    }
  } catch (err) {
    (allEl || albumsEl).innerHTML = '<div class="news-empty">Could not load the gallery. Please try again later.</div>';
    console.error(err);
  }
}
let _currentAlbumPhotos = []; let _currentAlbumMediaTypes = []; let _currentLightboxIndex = 0;
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
    _currentAlbumMediaTypes = album.photos.map(p => p.media_type || 'image');
    container.innerHTML = '<div class="photo-grid">' + _currentAlbumPhotos.map((p, idx) => {
      const isVideo = _currentAlbumMediaTypes[idx] === 'video';
      const media = isVideo ? '<video src="' + p + '" muted preload="metadata"></video><span class="media-play-icon">&#9658;</span>' : '<img src="' + p + '" alt="">';
      return '<div class="photo-tile" onclick="openLightbox(' + idx + ')">' + media + '</div>';
    }).join('') + '</div>';
  } catch (err) { container.innerHTML = '<div class="news-empty">Album not found.</div>'; console.error(err); }
}
function openLightbox(index) { _currentLightboxIndex = index; updateLightboxImage(); document.getElementById('lightbox-overlay').classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeLightbox() {
  document.getElementById('lightbox-overlay').classList.remove('open');
  document.body.style.overflow = '';
  const video = document.getElementById('lightbox-video');
  if (video) { video.pause(); video.src = ''; }
}
function lightboxNext() { _currentLightboxIndex = (_currentLightboxIndex + 1) % _currentAlbumPhotos.length; updateLightboxImage(); }
function lightboxPrev() { _currentLightboxIndex = (_currentLightboxIndex - 1 + _currentAlbumPhotos.length) % _currentAlbumPhotos.length; updateLightboxImage(); }
function updateLightboxImage() {
  const img = document.getElementById('lightbox-img');
  const video = document.getElementById('lightbox-video');
  const url = _currentAlbumPhotos[_currentLightboxIndex];
  const isVideo = _currentAlbumMediaTypes[_currentLightboxIndex] === 'video';
  if (isVideo && video) {
    if (img) img.style.display = 'none';
    video.style.display = '';
    video.src = url;
    video.play().catch(() => {});
  } else {
    if (video) { video.pause(); video.style.display = 'none'; video.src = ''; }
    if (img) { img.style.display = ''; img.src = url; }
  }
  document.getElementById('lightbox-counter').textContent = (_currentLightboxIndex + 1) + ' / ' + _currentAlbumPhotos.length;
}
document.addEventListener('keydown', function (e) {
  const overlay = document.getElementById('lightbox-overlay');
  if (!overlay || !overlay.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox(); if (e.key === 'ArrowRight') lightboxNext(); if (e.key === 'ArrowLeft') lightboxPrev();
});
document.addEventListener('DOMContentLoaded', function () {
  renderPublicNewsList(); renderHomeNewsPreview(); renderAlbumGrid(); renderNewsDetail(); renderNewsSidebar(); renderAlbumDetail(); renderNewsTicker();
});
