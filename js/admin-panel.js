
document.addEventListener('DOMContentLoaded', function () {
  const session = requireAuth();
  if (!session) return;
  document.getElementById('welcome-user').textContent = session.username + ' (' + session.role + ')';
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.main-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active'); document.getElementById(btn.dataset.maintab).classList.add('active');
    });
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active'); document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
  loadAdminNewsTable(); loadAdminAlbumTable();

  async function parseApiError(res) {
    try { const data = await res.json(); if (data && data.error) return data.error; } catch (e) {}
    if (res.status === 401) return 'Your session has expired. Please log out and log in again.';
    if (res.status === 413) return 'That file is too large for the server to accept. Please choose a smaller file.';
    return 'Something went wrong (status ' + res.status + '). Please try again.';
  }
  function networkErrorMessage(err) { console.error(err); return 'Could not reach the server. Please check that the backend is running (npm start in the slna-backend folder) and try again.'; }

  const typeForm = document.getElementById('type-news-form');
  let typePhotoFile = null;
  document.getElementById('type-photo-input').addEventListener('change', function (e) {
    if (e.target.files.length) {
      const file = e.target.files[0];
      if (file.size > 25 * 1024 * 1024) { showAlert('type-alert', 'That photo is ' + (file.size/(1024*1024)).toFixed(1) + 'MB, over the 25MB limit.', 'error'); e.target.value=''; return; }
      typePhotoFile = file;
      const reader = new FileReader();
      reader.onload = (evt) => { document.getElementById('type-photo-preview').innerHTML = '<img src="' + evt.target.result + '" class="thumb-preview">'; };
      reader.readAsDataURL(typePhotoFile);
    }
  });
  typeForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const title = document.getElementById('type-title').value.trim();
    const event_date = document.getElementById('type-date').value;
    const summary = document.getElementById('type-summary').value.trim();
    const body = document.getElementById('type-body').value.trim();
    if (!title || !event_date || !body) { showAlert('type-alert', 'Please fill in title, date, and content.', 'error'); return; }
    const formData = new FormData();
    formData.append('title', title); formData.append('event_date', event_date); formData.append('summary', summary); formData.append('body', body);
    if (typePhotoFile) formData.append('photo', typePhotoFile);
    try {
      const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/news/typed', { method: 'POST', headers: { 'Authorization': 'Bearer ' + getToken() }, body: formData });
      if (!res.ok) { showAlert('type-alert', await parseApiError(res), 'error'); return; }
      showAlert('type-alert', 'News item published.', 'success');
      typeForm.reset(); typePhotoFile = null; document.getElementById('type-photo-preview').innerHTML = '';
      loadAdminNewsTable();
    } catch (err) { showAlert('type-alert', networkErrorMessage(err), 'error'); }
  });

  const fileForm = document.getElementById('file-news-form');
  const fileInput = document.getElementById('file-upload-input');
  const fileDrop = document.getElementById('file-drop-zone');
  const fileNameDisplay = document.getElementById('file-name-display');
  let selectedDocument = null; let filePhotoFile = null;
  document.getElementById('file-photo-input').addEventListener('change', function (e) {
    if (e.target.files.length) {
      const file = e.target.files[0];
      if (file.size > 25 * 1024 * 1024) { showAlert('file-alert', 'That photo is ' + (file.size/(1024*1024)).toFixed(1) + 'MB, over the 25MB limit.', 'error'); e.target.value=''; return; }
      filePhotoFile = file;
      const reader = new FileReader();
      reader.onload = (evt) => { document.getElementById('file-photo-preview').innerHTML = '<img src="' + evt.target.result + '" class="thumb-preview">'; };
      reader.readAsDataURL(filePhotoFile);
    }
  });
  fileDrop.addEventListener('click', () => fileInput.click());
  fileDrop.addEventListener('dragover', (e) => { e.preventDefault(); fileDrop.classList.add('dragover'); });
  fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
  fileDrop.addEventListener('drop', (e) => { e.preventDefault(); fileDrop.classList.remove('dragover'); if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; handleFileSelect(e.dataTransfer.files[0]); } });
  fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileSelect(e.target.files[0]); });
  function handleFileSelect(file) {
    if (file.size > 30 * 1024 * 1024) { showAlert('file-alert', 'That document is ' + (file.size/(1024*1024)).toFixed(1) + 'MB, over the 30MB limit.', 'error'); fileInput.value=''; return; }
    selectedDocument = file;
    fileNameDisplay.textContent = 'Selected: ' + file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (evt) => { document.getElementById('file-summary').value = evt.target.result.substring(0, 200); document.getElementById('file-body-preview').value = evt.target.result; };
      reader.readAsText(file);
    } else { document.getElementById('file-body-preview').value = ''; }
  }
  fileForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!selectedDocument) { showAlert('file-alert', 'Please select a document to upload.', 'error'); return; }
    const title = document.getElementById('file-title').value.trim();
    const event_date = document.getElementById('file-date').value;
    const summary = document.getElementById('file-summary').value.trim();
    const body = document.getElementById('file-body-preview').value.trim();
    if (!title || !event_date) { showAlert('file-alert', 'Please provide a title and date.', 'error'); return; }
    const formData = new FormData();
    formData.append('title', title); formData.append('event_date', event_date); formData.append('summary', summary); formData.append('body', body); formData.append('document', selectedDocument);
    if (filePhotoFile) formData.append('photo', filePhotoFile);
    try {
      const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/news/upload', { method: 'POST', headers: { 'Authorization': 'Bearer ' + getToken() }, body: formData });
      if (!res.ok) { showAlert('file-alert', await parseApiError(res), 'error'); return; }
      showAlert('file-alert', 'News item published with attachment.', 'success');
      fileForm.reset(); fileNameDisplay.textContent = ''; selectedDocument = null; filePhotoFile = null; document.getElementById('file-photo-preview').innerHTML = '';
      loadAdminNewsTable();
    } catch (err) { showAlert('file-alert', networkErrorMessage(err), 'error'); }
  });

  let albumPhotoFiles = [];
  const albumPhotoInput = document.getElementById('album-photo-input');
  albumPhotoInput.addEventListener('change', function (e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const oversized = files.filter(f => f.size > 25 * 1024 * 1024);
    if (oversized.length > 0) { showAlert('album-alert', oversized.length + ' photo(s) over the 25MB limit were skipped: ' + oversized.map(f => f.name).join(', '), 'error'); }
    albumPhotoFiles = albumPhotoFiles.concat(files.filter(f => f.size <= 25 * 1024 * 1024));
    renderAlbumPhotoPicker(); albumPhotoInput.value = '';
  });
  function renderAlbumPhotoPicker() {
    const picker = document.getElementById('album-photo-picker');
    Promise.all(albumPhotoFiles.map(file => new Promise((resolve) => { const reader = new FileReader(); reader.onload = (e) => resolve(e.target.result); reader.readAsDataURL(file); }))).then((dataUrls) => {
      picker.innerHTML = dataUrls.map((p, idx) => '<div class="photo-picker-item"><img src="' + p + '"><button type="button" onclick="window._removeAlbumPhoto(' + idx + ')">X</button></div>').join('');
      const countEl = document.getElementById('album-photo-count'); if (countEl) countEl.textContent = albumPhotoFiles.length + ' photo(s) selected';
    });
  }
  window._removeAlbumPhoto = function (idx) { albumPhotoFiles.splice(idx, 1); renderAlbumPhotoPicker(); };
  const albumForm = document.getElementById('album-form');
  albumForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const title = document.getElementById('album-title').value.trim();
    const event_date = document.getElementById('album-date').value;
    if (!title || !event_date) { showAlert('album-alert', 'Please provide an album title and date.', 'error'); return; }
    if (albumPhotoFiles.length === 0) { showAlert('album-alert', 'Please add at least one photo.', 'error'); return; }
    const formData = new FormData();
    formData.append('title', title); formData.append('event_date', event_date);
    albumPhotoFiles.forEach(file => formData.append('photos', file));
    try {
      const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/albums', { method: 'POST', headers: { 'Authorization': 'Bearer ' + getToken() }, body: formData });
      if (!res.ok) { showAlert('album-alert', await parseApiError(res), 'error'); return; }
      showAlert('album-alert', 'Photo album "' + title + '" published with ' + albumPhotoFiles.length + ' photo(s).', 'success');
      albumForm.reset(); albumPhotoFiles = []; renderAlbumPhotoPicker();
      loadAdminAlbumTable();
    } catch (err) { showAlert('album-alert', networkErrorMessage(err), 'error'); }
  });
});
function showAlert(elId, message, type) { const el = document.getElementById(elId); el.innerHTML = '<div class="alert alert-' + type + '">' + message + '</div>'; setTimeout(() => { el.innerHTML = ''; }, 6000); }
async function loadAdminNewsTable() {
  const tbody = document.getElementById('news-table-body');
  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/news'); if (!res.ok) throw new Error('bad status');
    const items = await res.json();
    if (items.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">No news items yet.</td></tr>'; return; }
    const apiOrigin = SLNA_CONFIG.API_BASE_URL.replace('/api', '');
    tbody.innerHTML = items.map(item => {
      const badgeClass = item.source === 'file' ? 'badge-file' : 'badge-typed'; const badgeLabel = item.source === 'file' ? 'FILE UPLOAD' : 'TYPED';
      const thumb = item.photo_url ? '<img src="' + apiOrigin + item.photo_url + '" class="thumb-preview" style="width:40px;height:40px;">' : '-';
      return '<tr><td>' + thumb + '</td><td>' + item.title + '</td><td>' + item.event_date + '</td><td><span class="badge-source ' + badgeClass + '">' + badgeLabel + '</span></td><td>' + (item.file_name || '-') + '</td><td><button class="btn btn-danger btn-sm" onclick="handleDeleteNews(' + item.id + ')">Delete</button></td></tr>';
    }).join('');
  } catch (err) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#c0392b;">Could not load news. Is the backend server running?</td></tr>'; }
}
async function handleDeleteNews(id) {
  if (!confirm('Delete this news item?')) return;
  try { const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/news/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + getToken() } }); if (!res.ok) { alert('Could not delete this item.'); return; } loadAdminNewsTable(); }
  catch (err) { alert('Could not reach the server.'); }
}
async function loadAdminAlbumTable() {
  const tbody = document.getElementById('album-table-body');
  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/albums'); if (!res.ok) throw new Error('bad status');
    const albums = await res.json();
    if (albums.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888;">No albums yet.</td></tr>'; return; }
    const apiOrigin = SLNA_CONFIG.API_BASE_URL.replace('/api', '');
    tbody.innerHTML = albums.map(album => {
      const thumb = album.cover_photo ? '<img src="' + apiOrigin + album.cover_photo + '" class="thumb-preview" style="width:40px;height:40px;">' : '-';
      return '<tr><td>' + thumb + '</td><td>' + album.title + '</td><td>' + album.photo_count + ' photos</td><td><button class="btn btn-danger btn-sm" onclick="handleDeleteAlbum(' + album.id + ')">Delete</button></td></tr>';
    }).join('');
  } catch (err) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#c0392b;">Could not load albums. Is the backend server running?</td></tr>'; }
}
async function handleDeleteAlbum(id) {
  if (!confirm('Delete this album?')) return;
  try { const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/albums/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + getToken() } }); if (!res.ok) { alert('Could not delete this album.'); return; } loadAdminAlbumTable(); }
  catch (err) { alert('Could not reach the server.'); }
}
