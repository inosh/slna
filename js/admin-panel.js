
// admin-panel.js -- Posts/deletes news and albums via the real backend API.
// UPDATED: friendlier error messages, including when the backend server
// itself is unreachable (not running, wrong port, etc.)

// Client-side photo compression -- album and news photo uploads only.
// Downscales to a max dimension and re-encodes as JPEG at high quality
// (similar target to Facebook's upload pipeline) so large camera photos
// upload faster without a visible quality loss. Profile pictures and bank
// slip uploads (join form, event registration) intentionally skip this.
const PHOTO_COMPRESSION = { maxDimension: 2048, quality: 0.85, skipUnderBytes: 300 * 1024 };

function compressImageFile(file, opts) {
  opts = opts || PHOTO_COMPRESSION;
  if (!file.type || !file.type.startsWith('image/') || file.type === 'image/gif') {
    return Promise.resolve(file);
  }
  if (file.size <= opts.skipUnderBytes) {
    return Promise.resolve(file);
  }
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(objectUrl);
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      const longestSide = Math.max(width, height);
      if (longestSide > opts.maxDimension) {
        const scale = opts.maxDimension / longestSide;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(function (blob) {
        if (!blob || blob.size >= file.size) {
          resolve(file);
          return;
        }
        const newName = outputType === 'image/jpeg'
            ? file.name.replace(/\.[^.]+$/, '') + '.jpg'
            : file.name;
        resolve(new File([blob], newName, { type: outputType, lastModified: Date.now() }));
      }, outputType, opts.quality);
    };
    img.onerror = function () {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

function compressImageFiles(files) {
  return Promise.all(files.map((file) => compressImageFile(file)));
}

// Generic "are you sure?" modal used in place of the browser's built-in
// confirm() throughout the admin panel (News/Gallery/Queries deletes,
// closing event registration, etc). Resolves true/false instead of
// blocking the main thread the way window.confirm() does.
function showSimpleConfirm(options) {
  options = options || {};

  return new Promise(function (resolve) {
    const modal = document.getElementById('admin-simple-confirm-modal');

    if (!modal) {
      resolve(window.confirm(options.message || 'Are you sure?'));
      return;
    }

    const titleEl = document.getElementById('admin-simple-confirm-title');
    const messageEl = document.getElementById('admin-simple-confirm-message');
    const cancelBtn = document.getElementById('cancel-admin-simple-confirm');
    const confirmBtn = document.getElementById('confirm-admin-simple-confirm');
    const backdrop = modal.querySelector('.admin-confirm-backdrop');

    titleEl.textContent = options.title || 'Confirm';
    messageEl.textContent = options.message || 'Are you sure?';
    confirmBtn.textContent = options.confirmText || 'Confirm';
    confirmBtn.className = 'btn ' + (options.danger === false ? 'btn-primary' : 'btn-danger');

    function cleanup(result) {
      modal.hidden = true;
      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
      backdrop.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }

    function onCancel() { cleanup(false); }
    function onConfirm() { cleanup(true); }
    function onKeydown(event) {
      if (event.key === 'Escape') cleanup(false);
    }

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
    backdrop.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKeydown);

    modal.hidden = false;
    confirmBtn.focus();
  });
}

document.addEventListener('DOMContentLoaded', function () {
  const session = requireAuth();
  if (!session) return;
  document.getElementById('welcome-user').textContent = session.username + ' (' + session.role + ')';
  document.getElementById('logout-btn').addEventListener('click', logout);

  let cpdEventAdminConfig = null;
  let otherEventAdminConfig = null;

  // Clears the "Add new item" forms for News, Gallery, CPD Events, and
  // Other Events whenever the admin switches main tabs, so half-entered
  // data from a previous visit doesn't linger (and accidentally get
  // submitted) when they come back to a tab later.
  function resetAddItemForms() {
    if (typeof resetTypeNewsForm === 'function') resetTypeNewsForm();
    if (typeof resetFileNewsForm === 'function') resetFileNewsForm();
    if (typeof resetAlbumForm === 'function') resetAlbumForm();
    if (cpdEventAdminConfig && typeof cpdEventAdminConfig.resetForm === 'function') cpdEventAdminConfig.resetForm();
    if (otherEventAdminConfig && typeof otherEventAdminConfig.resetForm === 'function') otherEventAdminConfig.resetForm();
  }

  document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.main-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.maintab).classList.add('active');
      resetAddItemForms();
    });
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  loadAdminNewsTable();
  loadAdminAlbumTable();
  initMembershipApplications();
  initContactQueries();
  initEditNewsForm();
  initAlbumTitleEditModal();

  function populateTimeSelectGroup(group) {
    if (!group) {
      return;
    }

    const hourSelect = document.getElementById(group.hour);
    const minuteSelect = document.getElementById(group.minute);
    const periodSelect = document.getElementById(group.period);

    if (!hourSelect || !minuteSelect || !periodSelect) {
      return;
    }

    for (let hour = 1; hour <= 12; hour++) {
      const value = String(hour);
      hourSelect.appendChild(new Option(value, value, hour === 12, hour === 12));
    }

    for (let minute = 0; minute < 60; minute++) {
      const value = String(minute).padStart(2, '0');
      minuteSelect.appendChild(new Option(value, value, minute === 0, minute === 0));
    }

    ['AM', 'PM'].forEach(function (period) {
      periodSelect.appendChild(
          new Option(period, period, period === 'AM', period === 'AM')
      );
    });
  }

  function getTimeGroupValue(group) {
    if (!group) {
      return '';
    }

    const hourSelect = document.getElementById(group.hour);
    const minuteSelect = document.getElementById(group.minute);
    const periodSelect = document.getElementById(group.period);

    if (!hourSelect || !minuteSelect || !periodSelect) {
      return '';
    }

    return hourSelect.value + ':' + minuteSelect.value + ' ' + periodSelect.value;
  }

  function parseTimeToken(token) {
    const match = /^(\d{1,2}):?(\d{2})?\s*([AP]M)$/i.exec(String(token || '').trim());

    if (!match) {
      return null;
    }

    return {
      hour: String(parseInt(match[1], 10)),
      minute: (match[2] || '00').padStart(2, '0'),
      period: match[3].toUpperCase()
    };
  }

  function parseTimeRange(value) {
    if (!value) {
      return null;
    }

    const parts = String(value)
        .split(/[–—-]/)
        .map(function (part) { return part.trim(); })
        .filter(Boolean);

    if (parts.length < 2) {
      return null;
    }

    const start = parseTimeToken(parts[0]);
    const end = parseTimeToken(parts[parts.length - 1]);

    return start && end ? { start: start, end: end } : null;
  }

  function setTimeGroupValue(group, parsed) {
    if (!group || !parsed) {
      return;
    }

    const hourSelect = document.getElementById(group.hour);
    const minuteSelect = document.getElementById(group.minute);
    const periodSelect = document.getElementById(group.period);

    if (hourSelect) hourSelect.value = parsed.hour;
    if (minuteSelect) minuteSelect.value = parsed.minute;
    if (periodSelect) periodSelect.value = parsed.period;
  }

  // Shared by the "Add CPD Event" form and the "Update Event" modal: shows,
  // requires, and enables only the fee inputs that matter for the chosen
  // Fee Type and Audience, so the admin physically can't type into (or
  // leave a stray value in) a field that doesn't apply -- 'free' forces
  // both fees to 0, 'free_for_members' forces just the member fee to 0,
  // and a "Members Only" audience forces the non-member fee to 0 and
  // hides it regardless of fee type, since there's no such thing as a
  // non-member registering. Fields are hidden with an inline style (not
  // the `hidden` attribute) because `.fee-row`'s own `display:grid` rule
  // would otherwise win the cascade and leave a "hidden" field fully
  // visible and editable. clearOnSwitch blanks a field that just became
  // visible again (a fresh choice to make) -- used for the "Add" form,
  // but not the edit modal, where the field may already hold a real
  // saved value worth keeping as-is.
  function applyCpdFeeType(feeType, membersOnly, elements, clearOnSwitch) {
    const showMember = feeType === 'paid';
    const showNonMember = feeType !== 'free' && !membersOnly;

    [
      { field: elements.memberFeeField, input: elements.memberFeeInput, show: showMember },
      { field: elements.nonMemberFeeField, input: elements.nonMemberFeeInput, show: showNonMember }
    ].forEach(function (entry) {
      const wasHidden = entry.field.style.display === 'none';

      entry.field.style.display = entry.show ? '' : 'none';
      entry.input.required = entry.show;
      entry.input.disabled = !entry.show;

      if (!entry.show) {
        entry.input.value = '0.00';
      } else if (clearOnSwitch && wasHidden) {
        entry.input.value = '';
      }
    });
  }

  function initCpdFeeTypeSelector() {
    const select = document.getElementById('cpd-event-fee-type');
    const audienceSelect = document.getElementById('cpd-event-audience');
    const memberFeeField = document.getElementById('cpd-event-member-fee-field');
    const nonMemberFeeField = document.getElementById('cpd-event-non-member-fee-field');
    const memberFeeInput = document.getElementById('cpd-event-member-fee');
    const nonMemberFeeInput = document.getElementById('cpd-event-non-member-fee');
    const form = document.getElementById('cpd-event-form');

    if (!select || !audienceSelect || !memberFeeField || !nonMemberFeeField || !memberFeeInput || !nonMemberFeeInput) {
      return;
    }

    const elements = { memberFeeField, memberFeeInput, nonMemberFeeField, nonMemberFeeInput };

    function sync() {
      applyCpdFeeType(select.value, audienceSelect.value === 'Members Only', elements, true);
    }

    select.addEventListener('change', sync);
    audienceSelect.addEventListener('change', sync);

    if (form) {
      form.addEventListener('reset', function () {
        window.setTimeout(function () {
          select.value = 'paid';
          sync();
        }, 0);
      });
    }
  }

  function initCpdEventsAdmin() {
    cpdEventAdminConfig = {
      formId: 'cpd-event-form',
      alertId: 'cpd-event-alert',
      tableAlertId: 'cpd-events-table-alert',
      tableBodyId: 'cpd-events-table-body',
      photoInputId: 'cpd-event-photo-input',
      photoPreviewId: 'cpd-event-photo-preview',
      attachmentInputId: 'cpd-event-attachment-input',
      attachmentPreviewId: 'cpd-event-attachment-preview',
      endpoint: '/events/cpd',
      successMessage: 'CPD event published.',
      submitLabel: 'Publish CPD Event',
      typeOptions: ['Workshop', 'Training', 'Webinar', 'Seminar', 'Study Day', 'Conference', 'Educational Program', 'Other'],
      statusOptions: ['Registration Open', 'Registration Opening Soon', 'Programme Announced Soon', 'Closed'],
      fields: {
        title: 'cpd-event-title',
        type: 'cpd-event-type',
        audience: 'cpd-event-audience',
        event_date: 'cpd-event-date',
        time: {
          start: {
            hour: 'cpd-event-start-hour',
            minute: 'cpd-event-start-minute',
            period: 'cpd-event-start-period'
          },
          end: {
            hour: 'cpd-event-end-hour',
            minute: 'cpd-event-end-minute',
            period: 'cpd-event-end-period'
          }
        },
        location: 'cpd-event-location',
        fee_type: 'cpd-event-fee-type',
        member_fee: 'cpd-event-member-fee',
        non_member_fee: 'cpd-event-non-member-fee',
        summary: 'cpd-event-summary',
        status: 'cpd-event-status'
      },
      timePreviewId: 'cpd-event-time-preview'
    };

    setupEventAdminForm(cpdEventAdminConfig);
  }

  function initOtherEventsAdmin() {
    otherEventAdminConfig = {
      formId: 'other-event-form',
      alertId: 'other-event-alert',
      tableAlertId: 'other-events-table-alert',
      tableBodyId: 'other-events-table-body',
      photoInputId: 'other-event-photo-input',
      photoPreviewId: 'other-event-photo-preview',
      endpoint: '/events/other',
      successMessage: 'Other event published.',
      submitLabel: 'Publish Other Event',
      typeOptions: ['Annual Conference', 'International Nurses Day', 'General Meeting', 'Annual General Meeting', 'Other Event'],
      statusOptions: ['Upcoming', 'Registration Open', 'Announcement Soon', 'Completed'],
      fields: {
        title: 'other-event-title',
        type: 'other-event-type',
        event_date: 'other-event-date',
        time: {
          start: {
            hour: 'other-event-start-hour',
            minute: 'other-event-start-minute',
            period: 'other-event-start-period'
          },
          end: {
            hour: 'other-event-end-hour',
            minute: 'other-event-end-minute',
            period: 'other-event-end-period'
          }
        },
        location: 'other-event-location',
        summary: 'other-event-summary',
        status: 'other-event-status'
      },
      timePreviewId: 'other-event-time-preview'
    };

    setupEventAdminForm(otherEventAdminConfig);
  }

  // ------------------------------------------------------------------
  // Shared "Update Event" modal (used by both CPD and Other events)
  // ------------------------------------------------------------------

  const EVENT_EDIT_TIME_FIELDS = {
    start: {
      hour: 'event-edit-start-hour',
      minute: 'event-edit-start-minute',
      period: 'event-edit-start-period'
    },
    end: {
      hour: 'event-edit-end-hour',
      minute: 'event-edit-end-minute',
      period: 'event-edit-end-period'
    }
  };

  let activeEditConfig = null;
  let activeEditItem = null;
  let editSelectedPhoto = null;
  let editSelectedAttachment = null;

  function escapeHtmlForModal(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
  }

  function getEventEditTimeValue() {
    const start = getTimeGroupValue(EVENT_EDIT_TIME_FIELDS.start);
    const end = getTimeGroupValue(EVENT_EDIT_TIME_FIELDS.end);

    return start && end ? start + '–' + end : '';
  }

  function updateEventEditTimePreview() {
    const previewEl = document.getElementById('event-edit-time-preview');

    if (!previewEl) {
      return;
    }

    const range = getEventEditTimeValue();

    previewEl.innerHTML = range
        ? 'Will be shown as: <strong>' + range + '</strong>'
        : '';
  }

  function openEventEditModal(config, item) {
    const modal = document.getElementById('event-edit-modal');

    if (!modal) {
      return;
    }

    activeEditConfig = config;
    activeEditItem = item;
    editSelectedPhoto = null;
    editSelectedAttachment = null;

    const isCpd = !!config.fields.audience;

    document.getElementById('event-edit-modal-title').textContent =
        isCpd ? 'Update CPD Event' : 'Update Other Event';

    document.getElementById('event-edit-alert').innerHTML = '';

    document.getElementById('event-edit-title').value = item.title || '';

    const typeSelect = document.getElementById('event-edit-type');
    const currentType = item.type || item.event_type || '';

    typeSelect.innerHTML = '';
    (config.typeOptions || []).forEach(function (type) {
      typeSelect.appendChild(new Option(type, type, false, currentType === type));
    });

    const audienceGroup = document.getElementById('event-edit-audience-group');

    if (isCpd) {
      audienceGroup.hidden = false;
      document.getElementById('event-edit-audience').value = item.audience || 'Open for Public';
    } else {
      audienceGroup.hidden = true;
    }

    document.getElementById('event-edit-date').value =
        String(item.event_date || item.eventDate || '').slice(0, 10);

    const defaultTime = { hour: '12', minute: '00', period: 'AM' };
    const parsedTime = parseTimeRange(item.time);

    setTimeGroupValue(EVENT_EDIT_TIME_FIELDS.start, parsedTime ? parsedTime.start : defaultTime);
    setTimeGroupValue(EVENT_EDIT_TIME_FIELDS.end, parsedTime ? parsedTime.end : defaultTime);
    updateEventEditTimePreview();

    document.getElementById('event-edit-location').value = item.location || '';

    const feesGroup = document.getElementById('event-edit-fees-group');

    if (isCpd) {
      feesGroup.hidden = false;

      const memberFee = item.member_fee !== undefined && item.member_fee !== null
          ? Number(item.member_fee)
          : 0;

      const nonMemberFee = item.non_member_fee !== undefined && item.non_member_fee !== null
          ? Number(item.non_member_fee)
          : 0;

      document.getElementById('event-edit-member-fee').value = memberFee.toFixed(2);
      document.getElementById('event-edit-non-member-fee').value = nonMemberFee.toFixed(2);

      const feeTypeSelect = document.getElementById('event-edit-fee-type');
      const feeType = ['paid', 'free', 'free_for_members'].includes(item.fee_type)
          ? item.fee_type
          : 'paid';

      if (feeTypeSelect) {
        feeTypeSelect.value = feeType;
        applyCpdFeeType(feeType, item.audience === 'Members Only', {
          memberFeeField: document.getElementById('event-edit-member-fee-field'),
          memberFeeInput: document.getElementById('event-edit-member-fee'),
          nonMemberFeeField: document.getElementById('event-edit-non-member-fee-field'),
          nonMemberFeeInput: document.getElementById('event-edit-non-member-fee')
        }, false);
      }
    } else {
      feesGroup.hidden = true;
    }

    document.getElementById('event-edit-summary').value = item.summary || '';

    const statusSelect = document.getElementById('event-edit-status');

    statusSelect.innerHTML = '';
    (config.statusOptions || []).forEach(function (status) {
      statusSelect.appendChild(new Option(status, status, false, item.status === status));
    });

    const currentPhotoEl = document.getElementById('event-edit-current-photo');
    const photoUrl = item.photo_url || item.photoUrl;

    if (photoUrl) {
      const apiOrigin = SLNA_CONFIG.API_BASE_URL.replace('/api', '');
      const imageUrl = /^https?:\/\//i.test(photoUrl) ? photoUrl : apiOrigin + photoUrl;

      currentPhotoEl.innerHTML =
          '<img src="' + imageUrl + '" alt="" onerror="this.style.display=\'none\';">' +
          '<span>Current photo &mdash; choose a new file below to replace it.</span>';
    } else {
      currentPhotoEl.innerHTML = '<span>No photo uploaded yet.</span>';
    }

    document.getElementById('event-edit-photo-input').value = '';
    document.getElementById('event-edit-photo-preview').innerHTML = '';

    const attachmentGroup = document.getElementById('event-edit-attachment-group');

    if (isCpd) {
      attachmentGroup.hidden = false;

      const currentAttachmentEl = document.getElementById('event-edit-current-attachment');
      const attachmentUrl = item.attachment_url;

      if (attachmentUrl) {
        const apiOrigin = SLNA_CONFIG.API_BASE_URL.replace('/api', '');
        const fileUrl = /^https?:\/\//i.test(attachmentUrl) ? attachmentUrl : apiOrigin + attachmentUrl;

        currentAttachmentEl.innerHTML =
            '<a href="' + fileUrl + '" target="_blank" rel="noopener">' +
            escapeHtmlForModal(item.attachment_filename || 'Current attachment') +
            '</a><span> &mdash; choose a new file below to replace it.</span>';
      } else {
        currentAttachmentEl.innerHTML = '<span>No attachment uploaded yet.</span>';
      }

      document.getElementById('event-edit-attachment-input').value = '';
    } else {
      attachmentGroup.hidden = true;
    }

    modal.hidden = false;

    window.setTimeout(function () {
      document.getElementById('event-edit-title').focus();
    }, 0);
  }

  function closeEventEditModal() {
    const modal = document.getElementById('event-edit-modal');

    if (modal) {
      modal.hidden = true;
    }

    activeEditConfig = null;
    activeEditItem = null;
    editSelectedPhoto = null;
    editSelectedAttachment = null;
  }

  function initEventEditModal() {
    const modal = document.getElementById('event-edit-modal');

    if (!modal) {
      return;
    }

    populateTimeSelectGroup(EVENT_EDIT_TIME_FIELDS.start);
    populateTimeSelectGroup(EVENT_EDIT_TIME_FIELDS.end);

    [EVENT_EDIT_TIME_FIELDS.start, EVENT_EDIT_TIME_FIELDS.end].forEach(function (group) {
      [group.hour, group.minute, group.period].forEach(function (id) {
        const select = document.getElementById(id);

        if (select) {
          select.addEventListener('change', updateEventEditTimePreview);
        }
      });
    });

    const editFeeTypeSelect = document.getElementById('event-edit-fee-type');
    const editAudienceSelect = document.getElementById('event-edit-audience');

    if (editFeeTypeSelect && editAudienceSelect) {
      const syncEditFeeType = function () {
        applyCpdFeeType(editFeeTypeSelect.value, editAudienceSelect.value === 'Members Only', {
          memberFeeField: document.getElementById('event-edit-member-fee-field'),
          memberFeeInput: document.getElementById('event-edit-member-fee'),
          nonMemberFeeField: document.getElementById('event-edit-non-member-fee-field'),
          nonMemberFeeInput: document.getElementById('event-edit-non-member-fee')
        }, false);
      };

      editFeeTypeSelect.addEventListener('change', syncEditFeeType);
      editAudienceSelect.addEventListener('change', syncEditFeeType);
    }

    ['event-edit-member-fee', 'event-edit-non-member-fee'].forEach(function (id) {
      const input = document.getElementById(id);

      if (!input) {
        return;
      }

      input.addEventListener('blur', function () {
        if (input.value === '') {
          return;
        }

        const parsed = parseFloat(input.value);

        if (Number.isNaN(parsed)) {
          return;
        }

        input.value = parsed.toFixed(2);
      });
    });

    const photoInput = document.getElementById('event-edit-photo-input');
    const photoPreview = document.getElementById('event-edit-photo-preview');

    if (photoInput) {
      photoInput.addEventListener('change', function (event) {
        const file = event.target.files[0];

        if (!file) {
          editSelectedPhoto = null;

          if (photoPreview) {
            photoPreview.innerHTML = '';
          }

          return;
        }

        if (!file.type.startsWith('image/')) {
          showAlert('event-edit-alert', 'Please select an image file.', 'error');
          event.target.value = '';
          return;
        }

        if (file.size > 15 * 1024 * 1024) {
          showAlert('event-edit-alert', 'The photo must be smaller than 15 MB.', 'error');
          event.target.value = '';
          return;
        }

        editSelectedPhoto = file;

        const reader = new FileReader();

        reader.onload = function (readerEvent) {
          if (photoPreview) {
            photoPreview.innerHTML =
                '<img src="' + readerEvent.target.result + '" alt="Selected event photo preview" style="max-width:160px;max-height:100px;object-fit:cover;border-radius:6px;">';
          }
        };

        reader.readAsDataURL(file);
      });
    }

    const attachmentInput = document.getElementById('event-edit-attachment-input');

    if (attachmentInput) {
      attachmentInput.addEventListener('change', function (event) {
        const file = event.target.files[0];

        if (!file) {
          editSelectedAttachment = null;
          return;
        }

        if (file.type !== 'application/pdf') {
          showAlert('event-edit-alert', 'Please select a PDF file for the attachment.', 'error');
          event.target.value = '';
          return;
        }

        if (file.size > 15 * 1024 * 1024) {
          showAlert('event-edit-alert', 'The attachment must be smaller than 15 MB.', 'error');
          event.target.value = '';
          return;
        }

        editSelectedAttachment = file;
      });
    }

    const closeButton = document.getElementById('event-edit-close');
    const cancelButton = document.getElementById('event-edit-cancel');
    const backdrop = modal.querySelector('.admin-confirm-backdrop');

    if (closeButton) closeButton.addEventListener('click', closeEventEditModal);
    if (cancelButton) cancelButton.addEventListener('click', closeEventEditModal);
    if (backdrop) backdrop.addEventListener('click', closeEventEditModal);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !modal.hidden) {
        closeEventEditModal();
      }
    });

    const form = document.getElementById('event-edit-form');

    if (!form) {
      return;
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      if (!activeEditConfig || !activeEditItem) {
        return;
      }

      const config = activeEditConfig;
      const isCpd = !!config.fields.audience;

      const editFields = {
        title: 'event-edit-title',
        type: 'event-edit-type',
        event_date: 'event-edit-date',
        time: EVENT_EDIT_TIME_FIELDS,
        location: 'event-edit-location',
        summary: 'event-edit-summary',
        status: 'event-edit-status'
      };

      if (isCpd) {
        editFields.audience = 'event-edit-audience';
        editFields.fee_type = 'event-edit-fee-type';
        editFields.member_fee = 'event-edit-member-fee';
        editFields.non_member_fee = 'event-edit-non-member-fee';
      }

      const formData = new FormData();
      let hasMissingField = false;

      Object.keys(editFields).forEach(function (fieldName) {
        let value;

        if (fieldName === 'time') {
          value = getEventEditTimeValue();
        } else {
          const input = document.getElementById(editFields[fieldName]);
          value = input ? input.value.trim() : '';
        }

        if (!value) {
          hasMissingField = true;
        }

        formData.append(fieldName, value);
      });

      if (hasMissingField) {
        showAlert('event-edit-alert', 'Please complete all required fields.', 'error');
        return;
      }

      if (editSelectedPhoto) {
        formData.append('photo', editSelectedPhoto);
      }

      if (isCpd && editSelectedAttachment) {
        formData.append('attachment', editSelectedAttachment);
      }

      const submitButton = form.querySelector('button[type="submit"]');

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';
      }

      try {
        const response = await fetch(
            SLNA_CONFIG.API_BASE_URL + config.endpoint + '/' + encodeURIComponent(activeEditItem.id),
            {
              method: 'PUT',
              headers: {
                Authorization: 'Bearer ' + getToken()
              },
              body: formData
            }
        );

        if (!response.ok) {
          throw new Error(await parseApiError(response));
        }

        closeEventEditModal();
        showAlert(config.tableAlertId || config.alertId, 'Event updated.', 'success');

        if (typeof config.reload === 'function') {
          await config.reload();
        }
      } catch (error) {
        const message = error instanceof TypeError
            ? networkErrorMessage(error)
            : (error.message || 'Could not update this event.');

        showAlert('event-edit-alert', message, 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Save Changes';
        }
      }
    });
  }

  initCpdEventsAdmin();
  initCpdFeeTypeSelector();
  initOtherEventsAdmin();
  initEventEditModal();

  // ------------------------------------------------------------------
  // Event Registrations admin: list CPD events, view/confirm/reject
  // registrations (and their bank receipts) submitted for each one.
  // ------------------------------------------------------------------

  let registrationEventsById = {};
  let registrationsByEventId = {};
  let activeRegistrationEventId = null;
  let registrationStatusFilter = 'All';
  let registrationSearchTerm = '';

  function formatRegistrationFee(value) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
  }

  function formatRegistrationDate(value) {
    if (!value) {
      return '—';
    }

    const date = new Date(String(value).slice(0, 10) + 'T00:00:00');

    if (Number.isNaN(date.getTime())) {
      return escapeHtmlForModal(value);
    }

    return date.toLocaleDateString('en-GB');
  }

  function registrationStatusClass(status) {
    const value = String(status || '').toLowerCase();

    if (value === 'confirmed') return 'status-confirmed';
    if (value === 'rejected') return 'status-rejected';

    return 'status-pending';
  }

  function resolveReceiptUrl(receiptUrl) {
    if (!receiptUrl) {
      return '';
    }

    if (/^https?:\/\//i.test(receiptUrl)) {
      return receiptUrl;
    }

    return SLNA_CONFIG.API_BASE_URL.replace('/api', '') + receiptUrl;
  }

  function renderRegistrationEventsTable() {
    const tbody = document.getElementById('event-registrations-events-body');

    if (!tbody) {
      return;
    }

    const events = Object.values(registrationEventsById);

    if (!events.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-table-state">
            No CPD events published yet.
          </td>
        </tr>
      `;
      return;
    }

    events.sort(function (a, b) {
      return new Date(a.event_date) - new Date(b.event_date);
    });

    tbody.innerHTML = events.map(function (event) {
      const count = (registrationsByEventId[event.id] || []).length;

      return `
        <tr>
          <td>${escapeHtmlForModal(event.title)}</td>
          <td>${formatRegistrationDate(event.event_date)}</td>
          <td>${escapeHtmlForModal(event.status)}</td>
          <td>Member: ${formatRegistrationFee(event.member_fee)}<br>Non-Member: ${formatRegistrationFee(event.non_member_fee)}</td>
          <td>${count}</td>
          <td>
            <button
                    type="button"
                    class="btn btn-outline btn-sm"
                    data-registration-event-id="${event.id}"
            >
              View Registrations
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderRegistrationReviewBody() {
    const tbody = document.getElementById('registration-review-body');

    if (!tbody) {
      return;
    }

    const all = registrationsByEventId[activeRegistrationEventId] || [];

    const searchTerm = registrationSearchTerm.trim().toLowerCase();

    let registrations = all.filter(function (registration) {
      const status = registration.status || 'Pending';

      if (registrationStatusFilter !== 'All' && status !== registrationStatusFilter) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      const haystack = [
        registration.nic,
        registration.full_name,
        registration.membership_number
      ].join(' ').toLowerCase();

      return haystack.indexOf(searchTerm) !== -1;
    });

    registrations = registrations.slice().sort(function (a, b) {
      const aPending = (a.status || 'Pending') === 'Pending' ? 0 : 1;
      const bPending = (b.status || 'Pending') === 'Pending' ? 0 : 1;

      return aPending - bPending;
    });

    if (!registrations.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="empty-table-state">
            ${all.length
              ? 'No registrations match this filter or search.'
              : 'No registrations submitted for this event yet.'}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = registrations.map(function (registration) {
      const receiptUrl = resolveReceiptUrl(registration.receipt_url);
      const status = registration.status || 'Pending';
      const isNonMember = registration.registrant_type === 'Non-Member';

      return `
        <tr class="${isNonMember ? 'registration-row-non-member' : ''}">
          <td>${escapeHtmlForModal(registration.full_name)}</td>
          <td>${escapeHtmlForModal(registration.nic)}</td>
          <td>${escapeHtmlForModal(registration.registrant_type)}</td>
          <td>${escapeHtmlForModal(registration.membership_number || '—')}</td>
          <td>${formatRegistrationFee(registration.paid_amount)}</td>
          <td>${escapeHtmlForModal(registration.pay_by)}</td>
          <td>
            ${receiptUrl
              ? `<a href="${receiptUrl}" target="_blank" rel="noopener">View Receipt</a>`
              : '—'}
          </td>
          <td>
            <span class="registration-status-badge ${registrationStatusClass(status)}">
              ${escapeHtmlForModal(status)}
            </span>
          </td>
          <td>
            <div class="row-actions">
              ${status === 'Rejected'
                ? `
                  <button
                          type="button"
                          class="btn btn-outline btn-sm"
                          data-registration-action="Confirmed"
                          data-registration-id="${registration.id}"
                  >
                    Confirm Back
                  </button>
                `
                : `
                  <button
                          type="button"
                          class="btn btn-outline btn-sm"
                          data-registration-action="Confirmed"
                          data-registration-id="${registration.id}"
                          ${status === 'Confirmed' ? 'disabled' : ''}
                  >
                    Confirm
                  </button>
                  <button
                          type="button"
                          class="btn btn-outline btn-sm"
                          data-registration-action="Rejected"
                          data-registration-id="${registration.id}"
                  >
                    Reject
                  </button>
                `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function openRegistrationReviewModal(eventId) {
    const modal = document.getElementById('registration-review-modal');
    const event = registrationEventsById[eventId];

    if (!modal || !event) {
      return;
    }

    activeRegistrationEventId = eventId;
    registrationStatusFilter = 'All';
    registrationSearchTerm = '';

    document.getElementById('registration-review-modal-title').textContent =
        'Registrations — ' + event.title;

    document.getElementById('registration-review-alert').innerHTML = '';

    document.getElementById('registration-review-fees').textContent =
        'Event Fee — Member: LKR ' + formatRegistrationFee(event.member_fee) +
        '  |  Non-Member: LKR ' + formatRegistrationFee(event.non_member_fee);

    const searchInput = document.getElementById('registration-review-search');

    if (searchInput) {
      searchInput.value = '';
    }

    document.querySelectorAll('[data-registration-filter]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-registration-filter') === 'All');
    });

    renderRegistrationReviewBody();

    modal.hidden = false;
  }

  function closeRegistrationReviewModal() {
    const modal = document.getElementById('registration-review-modal');

    if (modal) {
      modal.hidden = true;
    }

    activeRegistrationEventId = null;
  }

  async function downloadRegistrationExport(format) {
    if (!activeRegistrationEventId) {
      return;
    }

    const url = SLNA_CONFIG.API_BASE_URL + '/event-registrations/export/' + format +
        '?category=cpd&event_id=' + encodeURIComponent(activeRegistrationEventId) +
        '&status=' + encodeURIComponent(registrationStatusFilter);

    try {
      const response = await fetch(url, {
        headers: { Authorization: 'Bearer ' + getToken() }
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const disposition = response.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : ('registrations.' + (format === 'excel' ? 'xlsx' : 'pdf'));

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(function () {
        URL.revokeObjectURL(blobUrl);
      }, 60000);
    } catch (error) {
      const message = error instanceof TypeError
          ? networkErrorMessage(error)
          : (error.message || 'Could not generate the export.');

      showAlert('registration-review-alert', message, 'error');
    }
  }

  async function loadEventRegistrationsAdmin() {
    try {
      const [eventsResponse, registrationsResponse] = await Promise.all([
        fetch(SLNA_CONFIG.API_BASE_URL + '/events/cpd', {
          headers: { Authorization: 'Bearer ' + getToken() }
        }),
        fetch(SLNA_CONFIG.API_BASE_URL + '/event-registrations?category=cpd', {
          headers: { Authorization: 'Bearer ' + getToken() }
        })
      ]);

      if (!eventsResponse.ok || !registrationsResponse.ok) {
        throw new Error('Could not load events or registrations.');
      }

      const events = await eventsResponse.json();
      const registrations = await registrationsResponse.json();

      registrationEventsById = {};
      events.forEach(function (event) {
        registrationEventsById[event.id] = event;
      });

      registrationsByEventId = {};
      registrations.forEach(function (registration) {
        if (!registrationsByEventId[registration.event_id]) {
          registrationsByEventId[registration.event_id] = [];
        }
        registrationsByEventId[registration.event_id].push(registration);
      });

      renderRegistrationEventsTable();
    } catch (error) {
      const tbody = document.getElementById('event-registrations-events-body');

      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="empty-table-state">
              Could not load CPD events or registrations.
            </td>
          </tr>
        `;
      }

      console.error(error);
    }
  }

  function initEventRegistrationsAdmin() {
    const panel = document.getElementById('maintab-event-registrations');

    if (!panel) {
      return;
    }

    const eventsBody = document.getElementById('event-registrations-events-body');

    if (eventsBody) {
      eventsBody.addEventListener('click', function (event) {
        const viewButton = event.target.closest('[data-registration-event-id]');

        if (!viewButton) {
          return;
        }

        openRegistrationReviewModal(Number(viewButton.getAttribute('data-registration-event-id')));
      });
    }

    const modal = document.getElementById('registration-review-modal');
    const closeButton = document.getElementById('registration-review-close');
    const backdrop = modal ? modal.querySelector('.admin-confirm-backdrop') : null;
    const reviewBody = document.getElementById('registration-review-body');

    if (closeButton) closeButton.addEventListener('click', closeRegistrationReviewModal);
    if (backdrop) backdrop.addEventListener('click', closeRegistrationReviewModal);

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && modal && !modal.hidden) {
        closeRegistrationReviewModal();
      }
    });

    if (reviewBody) {
      reviewBody.addEventListener('click', async function (event) {
        const actionButton = event.target.closest('[data-registration-action]');

        if (!actionButton) {
          return;
        }

        const status = actionButton.getAttribute('data-registration-action');
        const registrationId = actionButton.getAttribute('data-registration-id');

        try {
          const response = await fetch(
              SLNA_CONFIG.API_BASE_URL + '/event-registrations/' + encodeURIComponent(registrationId) + '/status',
              {
                method: 'PATCH',
                headers: {
                  Authorization: 'Bearer ' + getToken(),
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: status })
              }
          );

          if (!response.ok) {
            throw new Error(await parseApiError(response));
          }

          const data = await response.json();
          const updated = data.registration;

          const list = registrationsByEventId[activeRegistrationEventId] || [];
          const index = list.findIndex(function (item) { return item.id === updated.id; });

          if (index !== -1) {
            list[index] = updated;
          }

          renderRegistrationReviewBody();

          showAlert(
              'registration-review-alert',
              'Registration marked as ' + status + '.',
              'success'
          );
        } catch (error) {
          const message = error instanceof TypeError
              ? networkErrorMessage(error)
              : (error.message || 'Could not update the registration.');

          showAlert('registration-review-alert', message, 'error');
        }
      });
    }

    document.querySelectorAll('[data-registration-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        registrationStatusFilter = button.getAttribute('data-registration-filter');

        document.querySelectorAll('[data-registration-filter]').forEach(function (other) {
          other.classList.toggle('active', other === button);
        });

        renderRegistrationReviewBody();
      });
    });

    const searchInput = document.getElementById('registration-review-search');

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        registrationSearchTerm = searchInput.value;
        renderRegistrationReviewBody();
      });
    }

    const exportPdfButton = document.getElementById('registration-export-pdf');
    const exportExcelButton = document.getElementById('registration-export-excel');

    if (exportPdfButton) {
      exportPdfButton.addEventListener('click', function () {
        downloadRegistrationExport('pdf');
      });
    }

    if (exportExcelButton) {
      exportExcelButton.addEventListener('click', function () {
        downloadRegistrationExport('excel');
      });
    }

    loadEventRegistrationsAdmin();
  }

  initEventRegistrationsAdmin();

  function getRegistrationCount(item) {
    const raw = item.registrationCount !== undefined ? item.registrationCount : item.registration_count;
    const parsed = Number(raw);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  // ------------------------------------------------------------------
  // Shared "Delete Event" confirmation modal (used by both CPD and Other
  // events -- wired once here, since the modal is a single shared DOM
  // element, rather than once per setupEventAdminForm() call).
  // ------------------------------------------------------------------
  const eventDeleteModal = document.getElementById('event-delete-confirm-modal');
  const eventDeleteModalName = document.getElementById('event-delete-confirm-name');
  const eventDeleteModalMessage = document.getElementById('event-delete-confirm-message');
  const eventDeleteModalWarning = document.getElementById('event-delete-confirm-warning');
  const cancelEventDeleteButton = document.getElementById('cancel-event-delete-confirmation');
  const confirmEventDeleteButton = document.getElementById('confirm-event-delete-modal');

  let pendingEventDelete = null;

  function closeEventDeleteConfirmModal() {
    if (!eventDeleteModal) {
      return;
    }

    eventDeleteModal.hidden = true;
    pendingEventDelete = null;
  }

  function openEventDeleteConfirmModal(config, item, eventId) {
    if (!eventDeleteModal) {
      return;
    }

    const registrationCount = getRegistrationCount(item);

    pendingEventDelete = { config, eventId };

    eventDeleteModalName.textContent = item.title || ('Event #' + eventId);

    if (registrationCount > 0) {
      eventDeleteModalMessage.innerHTML =
          '<strong>This event has ' + registrationCount + ' registration' + (registrationCount === 1 ? '' : 's') + '.</strong>';

      eventDeleteModalWarning.innerHTML =
          '<strong>Deleting this event will also permanently delete ' +
          (registrationCount === 1 ? 'that registration record' : 'all ' + registrationCount + ' registration records') +
          '. This action cannot be undone.</strong>';

      eventDeleteModalWarning.hidden = false;
    } else {
      eventDeleteModalMessage.textContent = 'Are you sure you want to delete this event? This action cannot be undone.';
      eventDeleteModalWarning.hidden = true;
      eventDeleteModalWarning.textContent = '';
    }

    eventDeleteModal.hidden = false;
    confirmEventDeleteButton.focus();
  }

  async function submitEventDeleteConfirmation() {
    if (!pendingEventDelete) {
      closeEventDeleteConfirmModal();
      return;
    }

    const { config, eventId } = pendingEventDelete;
    const tableAlertId = config.tableAlertId || config.alertId;

    confirmEventDeleteButton.disabled = true;
    confirmEventDeleteButton.textContent = 'Deleting...';

    try {
      const response = await fetch(
          SLNA_CONFIG.API_BASE_URL + config.endpoint + '/' + encodeURIComponent(eventId),
          {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + getToken() }
          }
      );

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }

      closeEventDeleteConfirmModal();
      showAlert(tableAlertId, 'Event deleted.', 'success');

      if (typeof config.reload === 'function') {
        await config.reload();
      }
    } catch (error) {
      const message = error instanceof TypeError
          ? networkErrorMessage(error)
          : (error.message || 'Could not delete this event.');

      closeEventDeleteConfirmModal();
      showAlert(tableAlertId, message, 'error');
    } finally {
      confirmEventDeleteButton.disabled = false;
      confirmEventDeleteButton.textContent = 'Delete Event';
    }
  }

  if (cancelEventDeleteButton) {
    cancelEventDeleteButton.addEventListener('click', closeEventDeleteConfirmModal);
  }

  if (confirmEventDeleteButton) {
    confirmEventDeleteButton.addEventListener('click', submitEventDeleteConfirmation);
  }

  if (eventDeleteModal) {
    const eventDeleteBackdrop = eventDeleteModal.querySelector('.admin-confirm-backdrop');

    if (eventDeleteBackdrop) {
      eventDeleteBackdrop.addEventListener('click', closeEventDeleteConfirmModal);
    }
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && eventDeleteModal && !eventDeleteModal.hidden) {
      closeEventDeleteConfirmModal();
    }
  });

  function setupEventAdminForm(config) {
    const form = document.getElementById(config.formId);

    if (!form) {
      return;
    }

    const tableBody = document.getElementById(config.tableBodyId);
    const photoInput = document.getElementById(config.photoInputId);
    const photoPreview = document.getElementById(config.photoPreviewId);
    const attachmentInput = config.attachmentInputId
        ? document.getElementById(config.attachmentInputId)
        : null;
    const attachmentPreview = config.attachmentPreviewId
        ? document.getElementById(config.attachmentPreviewId)
        : null;

    let selectedPhoto = null;
    let selectedAttachment = null;
    let currentItems = [];

    if (config.fields.time && typeof config.fields.time === 'object') {
      populateTimeSelectGroup(config.fields.time.start);
      populateTimeSelectGroup(config.fields.time.end);
    }

    function getValue(fieldName) {
      const fieldRef = config.fields[fieldName];

      if (fieldName === 'time' && fieldRef && typeof fieldRef === 'object') {
        const start = getTimeGroupValue(fieldRef.start);
        const end = getTimeGroupValue(fieldRef.end);

        return start && end ? start + '–' + end : '';
      }

      const input = document.getElementById(fieldRef);

      return input ? input.value.trim() : '';
    }

    function updateTimePreview() {
      if (!config.timePreviewId) {
        return;
      }

      const previewEl = document.getElementById(config.timePreviewId);

      if (!previewEl) {
        return;
      }

      const range = getValue('time');

      previewEl.innerHTML = range
          ? 'Will be shown as: <strong>' + escapeHtml(range) + '</strong>'
          : '';
    }

    if (config.timePreviewId && config.fields.time && typeof config.fields.time === 'object') {
      [config.fields.time.start, config.fields.time.end].forEach(function (group) {
        if (!group) {
          return;
        }

        [group.hour, group.minute, group.period].forEach(function (id) {
          const select = document.getElementById(id);

          if (select) {
            select.addEventListener('change', updateTimePreview);
          }
        });
      });

      updateTimePreview();
    }

    [config.fields.member_fee, config.fields.non_member_fee].forEach(function (id) {
      if (!id) {
        return;
      }

      const input = document.getElementById(id);

      if (!input) {
        return;
      }

      input.addEventListener('blur', function () {
        if (input.value === '') {
          return;
        }

        const parsed = parseFloat(input.value);

        if (Number.isNaN(parsed)) {
          return;
        }

        input.value = parsed.toFixed(2);
      });
    });

    function escapeHtml(value) {
      return String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
    }

    function formatDate(value) {
      if (!value) {
        return '—';
      }

      const date = new Date(value + 'T00:00:00');

      if (Number.isNaN(date.getTime())) {
        return escapeHtml(value);
      }

      return date.toLocaleDateString('en-GB');
    }

    function getItemValue(item, camelCase, snakeCase) {
      return item[camelCase] || item[snakeCase] || '';
    }

    function renderPhoto(item) {
      const storedPhotoUrl =
          item.photo_url ||
          item.photoUrl ||
          item.image_url ||
          item.imageUrl ||
          '';

      if (!storedPhotoUrl) {
        return '—';
      }

      const apiOrigin = SLNA_CONFIG.API_BASE_URL.replace('/api', '');

      const imageUrl = /^https?:\/\//i.test(storedPhotoUrl)
          ? storedPhotoUrl
          : apiOrigin + storedPhotoUrl;

      return `
    <img
            src="${escapeHtml(imageUrl)}"
            class="thumb-preview"
            alt=""
            style="width:60px;height:45px;object-fit:cover;border-radius:4px;"
            onerror="this.style.display='none';"
    >
  `;
    }

    const hasAudienceFeeColumns = !!config.fields.audience;
    const columnCount = hasAudienceFeeColumns ? 9 : 7;

    function formatFee(value) {
      const parsed = Number(value);

      return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
    }

    function renderRow(item) {
      const title = getItemValue(item, 'title', 'title');
      const type = getItemValue(item, 'type', 'event_type');
      const date = getItemValue(item, 'eventDate', 'event_date');
      const location = getItemValue(item, 'location', 'location');
      const status = getItemValue(item, 'status', 'status');
      const audience = getItemValue(item, 'audience', 'audience');
      const memberFee = getItemValue(item, 'memberFee', 'member_fee');
      const nonMemberFee = getItemValue(item, 'nonMemberFee', 'non_member_fee');
      const registrationCount = getRegistrationCount(item);
      const id = item.id;

      return `
      <tr>
        <td>${renderPhoto(item)}</td>
        <td>${escapeHtml(title)}</td>
        <td>${escapeHtml(type)}</td>
        <td>${formatDate(date)}</td>
        <td>${escapeHtml(location)}</td>
        ${
        hasAudienceFeeColumns
            ? `<td>${escapeHtml(audience)}</td>
               <td>Member: ${formatFee(memberFee)}<br>Non-Member: ${formatFee(nonMemberFee)}</td>`
            : ''
      }
        <td>${escapeHtml(status)}${
          hasAudienceFeeColumns
              ? `<br><span style="font-size:12px;color:var(--muted);">${registrationCount} registration${registrationCount === 1 ? '' : 's'}</span>`
              : ''
      }</td>
        <td>
          ${
          id
              ? `<div class="row-actions">
                   <button
                           type="button"
                           class="btn btn-outline btn-sm"
                           data-event-edit-id="${escapeHtml(id)}"
                   >
                         Update
                   </button>
                   ${
                  hasAudienceFeeColumns && status === 'Registration Open'
                      ? `<button
                               type="button"
                               class="btn btn-outline btn-sm"
                               data-event-close-registration-id="${escapeHtml(id)}"
                         >
                               Close Registration
                         </button>`
                      : ''
              }
                   <button
                           type="button"
                           class="btn btn-outline btn-sm"
                           data-event-delete-id="${escapeHtml(id)}"
                   >
                         Delete
                   </button>
                 </div>`
              : '—'
      }
        </td>
      </tr>
    `;
    }

    async function loadItems() {
      if (!tableBody) {
        return;
      }

      try {
        const response = await fetch(
            SLNA_CONFIG.API_BASE_URL + config.endpoint,
            {
              headers: {
                Authorization: 'Bearer ' + getToken()
              }
            }
        );

        if (!response.ok) {
          throw new Error('Could not load events.');
        }

        const data = await response.json();
        const items = Array.isArray(data)
            ? data
            : data.items || data.events || [];

        currentItems = items;

        if (!items.length) {
          tableBody.innerHTML = `
          <tr>
            <td colspan="${columnCount}" class="empty-table-state">
              No events published yet.
            </td>
          </tr>
        `;

          return;
        }

        tableBody.innerHTML = items.map(renderRow).join('');
      } catch (error) {
        console.error(error);

        tableBody.innerHTML = `
        <tr>
          <td colspan="${columnCount}" class="empty-table-state">
            Could not load events. The backend endpoint may not be available yet.
          </td>
        </tr>
      `;
      }
    }

    config.reload = loadItems;

    config.resetForm = function () {
      form.reset();
      selectedPhoto = null;
      selectedAttachment = null;

      if (photoPreview) {
        photoPreview.innerHTML = '';
      }

      if (attachmentPreview) {
        attachmentPreview.innerHTML = '';
      }

      updateTimePreview();
    };

    if (photoInput) {
      photoInput.addEventListener('change', function (event) {
        const file = event.target.files[0];

        if (!file) {
          selectedPhoto = null;

          if (photoPreview) {
            photoPreview.innerHTML = '';
          }

          return;
        }

        if (!file.type.startsWith('image/')) {
          showAlert(
              config.alertId,
              'Please select an image file.',
              'error'
          );

          event.target.value = '';
          return;
        }

        if (file.size > 15 * 1024 * 1024) {
          showAlert(
              config.alertId,
              'The photo must be smaller than 15 MB.',
              'error'
          );

          event.target.value = '';
          return;
        }

        selectedPhoto = file;

        const reader = new FileReader();

        reader.onload = function (readerEvent) {
          if (!photoPreview) {
            return;
          }

          photoPreview.innerHTML = `
          <img
                  src="${readerEvent.target.result}"
                  alt="Selected event photo preview"
                  style="max-width:160px;max-height:100px;object-fit:cover;border-radius:6px;"
          >
        `;
        };

        reader.readAsDataURL(file);
      });
    }

    if (attachmentInput) {
      attachmentInput.addEventListener('change', function (event) {
        const file = event.target.files[0];

        if (!file) {
          selectedAttachment = null;

          if (attachmentPreview) {
            attachmentPreview.innerHTML = '';
          }

          return;
        }

        if (file.type !== 'application/pdf') {
          showAlert(
              config.alertId,
              'Please select a PDF file for the attachment.',
              'error'
          );

          event.target.value = '';
          return;
        }

        if (file.size > 15 * 1024 * 1024) {
          showAlert(
              config.alertId,
              'The attachment must be smaller than 15 MB.',
              'error'
          );

          event.target.value = '';
          return;
        }

        selectedAttachment = file;

        if (attachmentPreview) {
          attachmentPreview.textContent = 'Selected: ' + file.name;
        }
      });
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      const formData = new FormData();
      let hasMissingField = false;

      Object.keys(config.fields).forEach(function (fieldName) {
        const value = getValue(fieldName);

        if (!value) {
          hasMissingField = true;
        }

        formData.append(fieldName, value);
      });

      if (hasMissingField) {
        showAlert(
            config.alertId,
            'Please complete all required fields.',
            'error'
        );

        return;
      }

      if (selectedPhoto) {
        formData.append('photo', selectedPhoto);
      }

      if (selectedAttachment) {
        formData.append('attachment', selectedAttachment);
      }

      const submitButton = form.querySelector(
          'button[type="submit"]'
      );

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Publishing...';
      }

      try {
        const response = await fetch(
            SLNA_CONFIG.API_BASE_URL + config.endpoint,
            {
              method: 'POST',
              headers: {
                Authorization: 'Bearer ' + getToken()
              },
              body: formData
            }
        );

        if (!response.ok) {
          throw new Error(await parseApiError(response));
        }

        showAlert(
            config.alertId,
            config.successMessage,
            'success'
        );

        form.reset();
        selectedPhoto = null;
        selectedAttachment = null;

        if (photoPreview) {
          photoPreview.innerHTML = '';
        }

        if (attachmentPreview) {
          attachmentPreview.innerHTML = '';
        }

        updateTimePreview();

        await loadItems();
      } catch (error) {
        const message = error instanceof TypeError
            ? networkErrorMessage(error)
            : (error.message || 'Could not publish this event.');

        showAlert(config.alertId, message, 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = config.submitLabel;
        }
      }
    });

    if (tableBody) {
      tableBody.addEventListener('click', async function (event) {
        const editButton = event.target.closest('[data-event-edit-id]');

        if (editButton) {
          const eventId = editButton.getAttribute('data-event-edit-id');

          const item = currentItems.find(function (candidate) {
            return String(candidate.id) === String(eventId);
          });

          if (item) {
            openEventEditModal(config, item);
          }

          return;
        }

        const closeRegistrationButton = event.target.closest(
            '[data-event-close-registration-id]'
        );

        if (closeRegistrationButton) {
          const eventId = closeRegistrationButton.getAttribute(
              'data-event-close-registration-id'
          );

          if (!eventId) {
            return;
          }

          const confirmedClose = await showSimpleConfirm({
            title: 'Close Registration',
            message: 'Close registration for this event? Attendees will no longer be able to register.',
            confirmText: 'Close Registration',
            danger: false
          });

          if (!confirmedClose) {
            return;
          }

          try {
            const response = await fetch(
                SLNA_CONFIG.API_BASE_URL +
                config.endpoint +
                '/' +
                encodeURIComponent(eventId) +
                '/status',
                {
                  method: 'PATCH',
                  headers: {
                    Authorization: 'Bearer ' + getToken(),
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ status: 'Closed' })
                }
            );

            if (!response.ok) {
              throw new Error(await parseApiError(response));
            }

            showAlert(config.alertId, 'Registration closed.', 'success');

            await loadItems();
          } catch (error) {
            const message = error instanceof TypeError
                ? networkErrorMessage(error)
                : (error.message || 'Could not close registration.');

            showAlert(config.alertId, message, 'error');
          }

          return;
        }

        const deleteButton = event.target.closest(
            '[data-event-delete-id]'
        );

        if (!deleteButton) {
          return;
        }

        const eventId = deleteButton.getAttribute(
            'data-event-delete-id'
        );

        if (!eventId) {
          return;
        }

        const eventItem = currentItems.find(function (candidate) {
          return String(candidate.id) === String(eventId);
        });

        openEventDeleteConfirmModal(config, eventItem || {}, eventId);
      });
    }

    loadItems();
  }
  // Helper: turns any fetch/response failure into a clear message for the admin.
  async function parseApiError(res) {
    try {
      const data = await res.json();
      if (data && data.error) return data.error;
    } catch (e) {
      // response wasn't JSON (rare) -- fall through to generic message
    }
    if (res.status === 401) return 'Your session has expired. Please log out and log in again.';
    if (res.status === 413) return 'That file is too large for the server to accept. Please choose a smaller file.';
    return 'Something went wrong (status ' + res.status + '). Please try again.';
  }

  function networkErrorMessage(err) {
    console.error(err);
    return 'Could not reach the server. Please check that the backend is running (npm start in the slna-backend folder) and try again.';
  }

  // ---- News: Type in UI ----
  const typeForm = document.getElementById('type-news-form');
  let typePhotoFile = null;
  document.getElementById('type-photo-input').addEventListener('change', async function (e) {
    if (e.target.files.length) {
      const file = e.target.files[0];
      if (file.size > 15 * 1024 * 1024) {
        showAlert('type-alert', 'That photo is ' + (file.size / (1024*1024)).toFixed(1) + 'MB, which is over the 25MB limit. Please choose a smaller photo.', 'error');
        e.target.value = '';
        return;
      }
      typePhotoFile = await compressImageFile(file);
      const reader = new FileReader();
      reader.onload = (evt) => { document.getElementById('type-photo-preview').innerHTML = '<img src="' + evt.target.result + '" class="thumb-preview">'; };
      reader.readAsDataURL(typePhotoFile);
    }
  });

  // Gallery photos become a linked photo album when the news item is published.
  let typeGalleryFiles = [];
  const typeGalleryInput = document.getElementById('type-gallery-input');
  typeGalleryInput.addEventListener('change', async function (e) {
    const files = Array.from(e.target.files);
    const maxSize = (f) => f.type.startsWith('video/') ? 100 * 1024 * 1024 : 15 * 1024 * 1024;
    const oversized = files.filter(f => f.size > maxSize(f));
    const validFiles = files.filter(f => f.size <= maxSize(f));
    if (oversized.length) {
      showAlert('type-alert', oversized.length + ' file(s) are over the size limit (15MB for photos, 100MB for videos) and were not added: ' + oversized.map(f => f.name).join(', '), 'error');
    }
    const compressedFiles = await compressImageFiles(validFiles);
    typeGalleryFiles = typeGalleryFiles.concat(compressedFiles);
    renderTypeGalleryPicker();
    typeGalleryInput.value = '';
  });
  function renderTypeGalleryPicker() {
    const picker = document.getElementById('type-gallery-picker');
    Promise.all(typeGalleryFiles.map(file => new Promise((resolve) => {
      if (file.type.startsWith('video/')) { resolve({ url: URL.createObjectURL(file), isVideo: true }); return; }
      const reader = new FileReader(); reader.onload = (evt) => resolve({ url: evt.target.result, isVideo: false }); reader.readAsDataURL(file);
    }))).then(items => {
      picker.innerHTML = items.map((item, idx) =>
        '<div class="photo-picker-item">' +
        (item.isVideo
          ? '<video src="' + item.url + '" muted></video><span class="media-play-icon">&#9658;</span>'
          : '<img src="' + item.url + '">') +
        '<button type="button" onclick="window._removeTypeGalleryPhoto(' + idx + ')">X</button></div>'
      ).join('');
      const countEl = document.getElementById('type-gallery-count');
      if (countEl) countEl.textContent = typeGalleryFiles.length + ' item(s) selected';
    });
  }
  window._removeTypeGalleryPhoto = function (idx) { typeGalleryFiles.splice(idx, 1); renderTypeGalleryPicker(); };

  function resetTypeNewsForm() {
    typeForm.reset();
    typePhotoFile = null;
    typeGalleryFiles = [];
    document.getElementById('type-photo-preview').innerHTML = '';
    document.getElementById('type-alert').innerHTML = '';
    renderTypeGalleryPicker();
  }

  typeForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const title = document.getElementById('type-title').value.trim();
    const news_type = document.getElementById('type-news-type').value;
    const event_date = document.getElementById('type-date').value;
    const summary = document.getElementById('type-summary').value.trim();
    const body = document.getElementById('type-body').value.trim();
    if (!title || !news_type || !event_date || !body) { showAlert('type-alert', 'Please fill in title, type, date, and content.', 'error'); return; }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('news_type', news_type);
    formData.append('event_date', event_date);
    formData.append('summary', summary);
    formData.append('body', body);
    if (typePhotoFile) formData.append('photo', typePhotoFile);
    typeGalleryFiles.forEach(file => formData.append('photos', file));

    try {
      const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/news/typed', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() },
        body: formData,
      });
      if (!res.ok) { showAlert('type-alert', await parseApiError(res), 'error'); return; }
      showAlert('type-alert', 'News item published.', 'success');
      typeForm.reset(); typePhotoFile = null; typeGalleryFiles = [];
      document.getElementById('type-photo-preview').innerHTML = '';
      renderTypeGalleryPicker();
      loadAdminNewsTable();
    } catch (err) {
      showAlert('type-alert', networkErrorMessage(err), 'error');
    }
  });

  // ---- News: Upload File ----
  const fileForm = document.getElementById('file-news-form');
  const fileInput = document.getElementById('file-upload-input');
  const fileDrop = document.getElementById('file-drop-zone');
  const fileNameDisplay = document.getElementById('file-name-display');
  let selectedDocument = null;
  let filePhotoFile = null;

  document.getElementById('file-photo-input').addEventListener('change', async function (e) {
    if (e.target.files.length) {
      const file = e.target.files[0];
      if (file.size > 15 * 1024 * 1024) {
        showAlert('file-alert', 'That photo is ' + (file.size / (1024*1024)).toFixed(1) + 'MB, which is over the 25MB limit. Please choose a smaller photo.', 'error');
        e.target.value = '';
        return;
      }
      filePhotoFile = await compressImageFile(file);
      const reader = new FileReader();
      reader.onload = (evt) => { document.getElementById('file-photo-preview').innerHTML = '<img src="' + evt.target.result + '" class="thumb-preview">'; };
      reader.readAsDataURL(filePhotoFile);
    }
  });
  fileDrop.addEventListener('click', () => fileInput.click());
  fileDrop.addEventListener('dragover', (e) => { e.preventDefault(); fileDrop.classList.add('dragover'); });
  fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
  fileDrop.addEventListener('drop', (e) => {
    e.preventDefault(); fileDrop.classList.remove('dragover');
    if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; handleFileSelect(e.dataTransfer.files[0]); }
  });
  fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFileSelect(e.target.files[0]); });

  function handleFileSelect(file) {
    if (file.size > 15 * 1024 * 1024) {
      showAlert('file-alert', 'That document is ' + (file.size / (1024*1024)).toFixed(1) + 'MB, which is over the 30MB limit. Please choose a smaller file.', 'error');
      fileInput.value = '';
      return;
    }
    selectedDocument = file;
    fileNameDisplay.textContent = 'Selected: ' + file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
    if (file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        document.getElementById('file-summary').value = evt.target.result.substring(0, 200);
        document.getElementById('file-body-preview').value = evt.target.result;
      };
      reader.readAsText(file);
    } else {
      document.getElementById('file-body-preview').value = '';
    }
  }

  // Gallery photos become a linked photo album when the news item is published.
  let fileGalleryFiles = [];
  const fileGalleryInput = document.getElementById('file-gallery-input');
  fileGalleryInput.addEventListener('change', async function (e) {
    const files = Array.from(e.target.files);
    const maxSize = (f) => f.type.startsWith('video/') ? 100 * 1024 * 1024 : 15 * 1024 * 1024;
    const oversized = files.filter(f => f.size > maxSize(f));
    const validFiles = files.filter(f => f.size <= maxSize(f));
    if (oversized.length) {
      showAlert('file-alert', oversized.length + ' file(s) are over the size limit (15MB for photos, 100MB for videos) and were not added: ' + oversized.map(f => f.name).join(', '), 'error');
    }
    const compressedFiles = await compressImageFiles(validFiles);
    fileGalleryFiles = fileGalleryFiles.concat(compressedFiles);
    renderFileGalleryPicker();
    fileGalleryInput.value = '';
  });
  function renderFileGalleryPicker() {
    const picker = document.getElementById('file-gallery-picker');
    Promise.all(fileGalleryFiles.map(file => new Promise((resolve) => {
      if (file.type.startsWith('video/')) { resolve({ url: URL.createObjectURL(file), isVideo: true }); return; }
      const reader = new FileReader(); reader.onload = (evt) => resolve({ url: evt.target.result, isVideo: false }); reader.readAsDataURL(file);
    }))).then(items => {
      picker.innerHTML = items.map((item, idx) =>
        '<div class="photo-picker-item">' +
        (item.isVideo
          ? '<video src="' + item.url + '" muted></video><span class="media-play-icon">&#9658;</span>'
          : '<img src="' + item.url + '">') +
        '<button type="button" onclick="window._removeFileGalleryPhoto(' + idx + ')">X</button></div>'
      ).join('');
      const countEl = document.getElementById('file-gallery-count');
      if (countEl) countEl.textContent = fileGalleryFiles.length + ' item(s) selected';
    });
  }
  window._removeFileGalleryPhoto = function (idx) { fileGalleryFiles.splice(idx, 1); renderFileGalleryPicker(); };

  function resetFileNewsForm() {
    fileForm.reset();
    fileNameDisplay.textContent = '';
    selectedDocument = null;
    filePhotoFile = null;
    fileGalleryFiles = [];
    document.getElementById('file-photo-preview').innerHTML = '';
    document.getElementById('file-alert').innerHTML = '';
    renderFileGalleryPicker();
  }

  fileForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!selectedDocument) { showAlert('file-alert', 'Please select a document to upload.', 'error'); return; }
    const title = document.getElementById('file-title').value.trim();
    const news_type = document.getElementById('file-news-type').value;
    const event_date = document.getElementById('file-date').value;
    const summary = document.getElementById('file-summary').value.trim();
    const body = document.getElementById('file-body-preview').value.trim();
    if (!title || !news_type || !event_date) { showAlert('file-alert', 'Please provide a title, type, and date.', 'error'); return; }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('news_type', news_type);
    formData.append('event_date', event_date);
    formData.append('summary', summary);
    formData.append('body', body);
    formData.append('document', selectedDocument);
    if (filePhotoFile) formData.append('photo', filePhotoFile);
    fileGalleryFiles.forEach(file => formData.append('photos', file));

    try {
      const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/news/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() },
        body: formData,
      });
      if (!res.ok) { showAlert('file-alert', await parseApiError(res), 'error'); return; }
      showAlert('file-alert', 'News item published with attachment.', 'success');
      fileForm.reset(); fileNameDisplay.textContent = ''; selectedDocument = null; filePhotoFile = null; fileGalleryFiles = [];
      document.getElementById('file-photo-preview').innerHTML = '';
      renderFileGalleryPicker();
      loadAdminNewsTable();
    } catch (err) {
      showAlert('file-alert', networkErrorMessage(err), 'error');
    }
  });

  // ---- Albums ----
  let albumPhotoFiles = [];
  const albumPhotoInput = document.getElementById('album-photo-input');
  albumPhotoInput.addEventListener('change', async function (e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const maxSize = (f) => f.type.startsWith('video/') ? 100 * 1024 * 1024 : 15 * 1024 * 1024;
    const oversized = files.filter(f => f.size > maxSize(f));
    if (oversized.length > 0) {
      showAlert('album-alert', oversized.length + ' file(s) are over the size limit (15MB for photos, 100MB for videos) and were not added: ' + oversized.map(f => f.name).join(', '), 'error');
    }
    const validFiles = files.filter(f => f.size <= maxSize(f));
    const compressedFiles = await compressImageFiles(validFiles);

    albumPhotoFiles = albumPhotoFiles.concat(compressedFiles);
    renderAlbumPhotoPicker();
    albumPhotoInput.value = '';
  });

  function renderAlbumPhotoPicker() {
    const picker = document.getElementById('album-photo-picker');
    Promise.all(albumPhotoFiles.map(file => new Promise((resolve) => {
      if (file.type.startsWith('video/')) {
        resolve({ url: URL.createObjectURL(file), isVideo: true });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => resolve({ url: e.target.result, isVideo: false });
      reader.readAsDataURL(file);
    }))).then((items) => {
      picker.innerHTML = items.map((item, idx) =>
        '<div class="photo-picker-item">' +
        (item.isVideo
          ? '<video src="' + item.url + '" muted preload="metadata"></video><span class="media-play-icon">&#9658;</span>'
          : '<img src="' + item.url + '">') +
        '<button type="button" onclick="window._removeAlbumPhoto(' + idx + ')">X</button></div>'
      ).join('');
      const countEl = document.getElementById('album-photo-count');
      if (countEl) countEl.textContent = albumPhotoFiles.length + ' item(s) selected';
    });
  }
  window._removeAlbumPhoto = function (idx) { albumPhotoFiles.splice(idx, 1); renderAlbumPhotoPicker(); };

  const albumForm = document.getElementById('album-form');
  albumForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const title = document.getElementById('album-title').value.trim();
    const event_date = document.getElementById('album-date').value;
    if (!title || !event_date) { showAlert('album-alert', 'Please provide an album title and date.', 'error'); return; }
    if (albumPhotoFiles.length === 0) { showAlert('album-alert', 'Please add at least one photo or video.', 'error'); return; }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('event_date', event_date);
    albumPhotoFiles.forEach(file => formData.append('photos', file));

    try {
      const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/albums', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() },
        body: formData,
      });
      if (!res.ok) { showAlert('album-alert', await parseApiError(res), 'error'); return; }
      showAlert('album-alert', 'Photo album "' + title + '" published with ' + albumPhotoFiles.length + ' item(s).', 'success');
      albumForm.reset(); albumPhotoFiles = []; renderAlbumPhotoPicker();
      loadAdminAlbumTable();
    } catch (err) {
      showAlert('album-alert', networkErrorMessage(err), 'error');
    }
  });

  function resetAlbumForm() {
    albumForm.reset();
    albumPhotoFiles = [];
    document.getElementById('album-alert').innerHTML = '';
    renderAlbumPhotoPicker();
  }

  function initMembershipApplications() {
    const membershipPanel = document.getElementById(
        'maintab-membership'
    );

    if (!membershipPanel) {
      return;
    }

    const tbody = document.getElementById(
        'membership-applications-body'
    );

    const searchInput = document.getElementById(
        'membership-search'
    );

    const alertBox = document.getElementById(
        'membership-applications-alert'
    );

    const reviewCard = document.getElementById(
        'membership-review-card'
    );

    const reviewReference = document.getElementById(
        'membership-review-reference'
    );

    const membershipDecisionFields = document.getElementById(
        'membership-decision-fields'
    );

    const membershipAdminNoteGroup = document.getElementById(
        'membership-admin-note-group'
    );

    const membershipReviewActions = document.getElementById(
        'membership-review-actions'
    );

    const membershipNumberError = document.getElementById(
        'membership-number-error'
    );

    const membershipNumberInput = document.getElementById(
        'membership-number'
    );

    const statusNoteInput = document.getElementById(
        'membership-status-note'
    );

    const statusNoteError = document.getElementById(
        'membership-status-note-error'
    );

    const adminNoteInput = document.getElementById(
        'membership-admin-note'
    );

    const refreshButton = document.getElementById(
        'refresh-membership-applications'
    );

    const closeButton = document.getElementById(
        'close-membership-review'
    );

    const approveButton = document.getElementById(
        'approve-membership-application'
    );

    const rejectButton = document.getElementById(
        'reject-membership-application'
    );

    const moreInformationButton = document.getElementById(
        'request-membership-information'
    );

    const receiptButton = document.getElementById(
        'view-membership-receipt'
    );

    const photoButton = document.getElementById(
        'view-membership-photo'
    );

    const idApplicationPanel = document.getElementById(
        'id-application-admin-panel'
    );

    const idApplicationStatusDisplay = document.getElementById(
        'id-application-status-display'
    );

    const downloadIdApplicationPdfButton = document.getElementById(
        'download-id-application-pdf'
    );

    const downloadIdApplicationPhotoButton = document.getElementById(
        'download-id-application-photo'
    );

    const confirmIdApplicationButton = document.getElementById(
        'confirm-id-application-generation'
    );

    const idConfirmationModal = document.getElementById(
        'id-application-confirm-modal'
    );

    const idConfirmationReference = document.getElementById(
        'id-confirm-modal-reference'
    );

    const cancelIdConfirmationButton = document.getElementById(
        'cancel-id-application-confirmation'
    );

    const confirmIdModalButton = document.getElementById(
        'confirm-id-application-modal'
    );

    const membershipDecisionModal = document.getElementById(
        'membership-decision-confirm-modal'
    );

    const membershipDecisionModalTitle = document.getElementById(
        'membership-decision-modal-title'
    );

    const membershipDecisionModalIntroduction = document.getElementById(
        'membership-decision-modal-introduction'
    );

    const membershipDecisionModalReference = document.getElementById(
        'membership-decision-modal-reference'
    );

    const membershipDecisionModalAction = document.getElementById(
        'membership-decision-modal-action'
    );

    const membershipDecisionModalNumberRow = document.getElementById(
        'membership-decision-modal-number-row'
    );

    const membershipDecisionModalNumber = document.getElementById(
        'membership-decision-modal-number'
    );

    const membershipDecisionModalStatusNoteRow = document.getElementById(
        'membership-decision-modal-status-note-row'
    );

    const membershipDecisionModalStatusNote = document.getElementById(
        'membership-decision-modal-status-note'
    );

    const membershipDecisionModalAdminNoteRow = document.getElementById(
        'membership-decision-modal-admin-note-row'
    );

    const membershipDecisionModalAdminNote = document.getElementById(
        'membership-decision-modal-admin-note'
    );

    const membershipDecisionModalWarning = document.getElementById(
        'membership-decision-modal-warning'
    );

    const cancelMembershipDecisionButton = document.getElementById(
        'cancel-membership-decision-confirmation'
    );

    const confirmMembershipDecisionButton = document.getElementById(
        'confirm-membership-decision-modal'
    );

    let pendingMembershipDecision = null;

    const membershipDecisionHistory =
        document.getElementById(
            'membership-decision-history'
        );

    const readOnlyStatusNote =
        document.getElementById(
            'read-only-status-note'
        );

    const readOnlyAdminNote =
        document.getElementById(
            'read-only-admin-note'
        );

    let applications = [];
    let activeStatus = 'pending';
    let selectedApplication = null;

    function membershipUrl(path) {
      return SLNA_CONFIG.API_BASE_URL + path;
    }

    function setMembershipMessage(type, message, options) {
      options = options || {};

      alertBox.className = 'alert alert-' + type;
      alertBox.textContent = message;

      if (options.focus) {
        alertBox.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        window.setTimeout(function () {
          alertBox.focus();
        }, 350);
      }
    }
    function clearMembershipMessage() {
      alertBox.className = '';
      alertBox.textContent = '';
    }

    function escapeHtml(value) {
      return String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
    }

    function displayValue(value) {
      if (
          value === null ||
          value === undefined ||
          value === ''
      ) {
        return '—';
      }

      return String(value);
    }

    function formatDate(value) {
      if (!value) {
        return '—';
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return value;
      }

      return date.toLocaleDateString('en-GB');
    }

    function formatDateTime(value) {
      if (!value) {
        return '—';
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return value;
      }

      return date.toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    }

    function normalizeApplication(application) {
      return {
        id: application.id,
        referenceNumber:
            application.referenceNumber ||
            application.reference_number,

        applicationStatus:
            application.applicationStatus ||
            application.application_status,

        membershipNumber:
            application.membershipNumber ||
            application.membership_number,

        idApplicationStatus:
            application.idApplicationStatus ||
            application.id_application_status ||
            'pending',

        idApplicationCreatedAt:
            application.idApplicationCreatedAt ||
            application.id_application_created_at ||
            null,

        fullName:
            application.fullName ||
            application.full_name,

        nameWithInitials:
            application.nameWithInitials ||
            application.name_with_initials,

        title: application.title,

        nicNumber:
            application.nicNumber ||
            application.nic_number,

        dateOfBirth:
            application.dateOfBirth ||
            application.date_of_birth,

        sex: application.sex,

        maritalStatus:
            application.maritalStatus ||
            application.marital_status,

        permanentAddress:
            application.permanentAddress ||
            application.permanent_address,

        currentWorkingPlace:
            application.currentWorkingPlace ||
            application.current_working_place,

        officialAddress:
            application.officialAddress ||
            application.official_address,

        mobileNumber:
            application.mobileNumber ||
            application.mobile_number,

        whatsappNumber:
            application.whatsappNumber ||
            application.whatsapp_number,

        residentialNumber:
            application.residentialNumber ||
            application.residential_number,

        officeNumber:
            application.officeNumber ||
            application.office_number,

        emailAddress:
            application.emailAddress ||
            application.email_address,

        slncRegistrationNumber:
            application.slncRegistrationNumber ||
            application.slnc_registration_number,

        slncRegistrationDate:
            application.slncRegistrationDate ||
            application.slnc_registration_date,

        designation: application.designation,

        firstAppointmentDate:
            application.firstAppointmentDate ||
            application.first_appointment_date,

        firstAppointmentPlace:
            application.firstAppointmentPlace ||
            application.first_appointment_place,

        nursingSchool:
            application.nursingSchool ||
            application.nursing_school,

        batch: application.batch,

        higherEducationalQualification:
            application.higherEducationalQualification ||
            application.higher_educational_qualification,

        paymentReference:
            application.paymentReference ||
            application.payment_reference,

        transferDate:
            application.transferDate ||
            application.transfer_date,

        statusNote:
            application.statusNote ||
            application.status_note,

        adminNote:
            application.adminNote ||
            application.admin_note,

        submittedAt:
            application.submittedAt ||
            application.created_at
      };
    }

    async function parseMembershipError(response) {
      try {
        const data = await response.json();

        if (data && (data.message || data.error)) {
          const error = new Error(
              data.message ||
              data.error
          );

          error.field = data.field || null;
          error.status = response.status;

          return error;
        }
      } catch (error) {
        // Use generic message below.
      }

      const error = new Error(
          response.status === 401
              ? 'Your session has expired. Please log in again.'
              : response.status === 403
                  ? 'You do not have permission to manage membership applications.'
                  : 'Membership request failed with status ' +
                  response.status +
                  '.'
      );

      error.status = response.status;

      return error;
    }

    function updateCounts() {
      const statuses = [
        'pending',
        'under_review',
        'more_information_required',
        'approved',
        'rejected'
      ];

      statuses.forEach(function (status) {
        const count = applications.filter(function (application) {
          return application.applicationStatus === status;
        }).length;

        const countElement = document.getElementById(
            status.replace(/_/g, '-') + '-status-count'
        );

        if (countElement) {
          countElement.textContent = count;
        }
      });

      const pendingCount = applications.filter(function (application) {
        return application.applicationStatus === 'pending';
      }).length;

      const pendingBadge = document.getElementById(
          'membership-pending-count'
      );

      if (pendingBadge) {
        pendingBadge.textContent = pendingCount;
      }

      const idApplicationCount = applications.filter(function (application) {
        return (
            application.applicationStatus === 'approved' &&
            application.idApplicationStatus === 'pending'
        );
      }).length;

      const idApplicationCountElement = document.getElementById(
          'id-application-status-count'
      );

      if (idApplicationCountElement) {
        idApplicationCountElement.textContent = idApplicationCount;
      }
    }

    function renderApplications() {
      const searchTerm = (
          searchInput.value || ''
      ).toLowerCase().trim();

      const filtered = applications.filter(function (application) {
        const searchable = [
          application.referenceNumber,
          application.fullName,
          application.nicNumber,
          application.membershipNumber,
          application.slncRegistrationNumber
        ]
            .join(' ')
            .toLowerCase();

        const matchesActiveTab =
            activeStatus === 'id_application'
                ? (
                    application.applicationStatus === 'approved' &&
                    application.idApplicationStatus === 'pending'
                )
                : application.applicationStatus === activeStatus;

        return (
            matchesActiveTab &&
            (!searchTerm || searchable.indexOf(searchTerm) !== -1)
        );
      });

      tbody.innerHTML = '';

      if (!filtered.length) {
        tbody.innerHTML =
            '<tr>' +
            '<td colspan="7" class="empty-table-state">' +
            'No ' +
            escapeHtml(activeStatus.replace(/_/g, ' ')) +
            ' membership applications to display.' +
            '</td>' +
            '</tr>';

        return;
      }

      filtered.forEach(function (application) {
        const row = document.createElement('tr');

        row.innerHTML =
            '<td><strong>' +
            escapeHtml(application.referenceNumber) +
            '</strong></td>' +

            '<td>' +
            escapeHtml(application.fullName) +
            (
                application.membershipNumber
                    ? '<br><span class="admin-muted">' +
                    escapeHtml(application.membershipNumber) +
                    '</span>'
                    : ''
            ) +
            '</td>' +

            '<td>' +
            escapeHtml(application.nicNumber) +
            (
                application.slncRegistrationNumber
                    ? '<br><span class="admin-muted">' +
                    escapeHtml(application.slncRegistrationNumber) +
                    '</span>'
                    : ''
            ) +
            '</td>' +

            '<td>' +
            escapeHtml(application.currentWorkingPlace) +
            '<br>' +
            '<span class="admin-muted">' +
            escapeHtml(application.designation) +
            '</span>' +
            '</td>' +

            '<td>' +
            escapeHtml(formatDateTime(application.submittedAt)) +
            '</td>' +

            '<td>' +
            '<span class="application-status status-' +
            escapeHtml(application.applicationStatus) +
            '">' +
            escapeHtml(
                application.applicationStatus.replace(/_/g, ' ')
            ) +
            '</span>' +
            '</td>' +

            '<td>' +
            '<button ' +
            'type="button" ' +
            'class="btn btn-outline btn-sm" ' +
            'data-review-reference="' +
            escapeHtml(application.referenceNumber) +
            '">' +
            'Review' +
            '</button>' +
            '</td>';

        tbody.appendChild(row);
      });
    }

    function fillReviewFields(application) {
      reviewCard
          .querySelectorAll('[data-application-field]')
          .forEach(function (field) {
            const key = field.getAttribute(
                'data-application-field'
            );

            let value = application[key];

            if (
                key === 'dateOfBirth' ||
                key === 'slncRegistrationDate' ||
                key === 'firstAppointmentDate' ||
                key === 'transferDate'
            ) {
              value = formatDate(value);
            }

            if (key === 'applicationStatus') {
              value = value
                  ? value.replace(/_/g, ' ')
                  : '';
            }

            if (
                key === 'membershipNumber' &&
                !value
            ) {
              value = 'Not assigned';
            }

            field.textContent = displayValue(value);
          });
    }

    function updateReviewWorkflowVisibility(application) {
      const membershipStatus =
          application.applicationStatus;

      const openedFromIdApplicationTab =
          activeStatus === 'id_application';

      const canMakeMembershipDecision =
          !openedFromIdApplicationTab &&
          (
              membershipStatus === 'pending' ||
              membershipStatus === 'under_review'
          );

      const showIdApplicationWorkflow =
          openedFromIdApplicationTab &&
          membershipStatus === 'approved';

      const showReadOnlyDecisionHistory =
          membershipStatus === 'more_information_required' ||
          membershipStatus === 'rejected';

      if (membershipDecisionFields) {
        membershipDecisionFields.classList.toggle(
            'workflow-visible',
            canMakeMembershipDecision
        );
      }

      if (membershipAdminNoteGroup) {
        membershipAdminNoteGroup.classList.toggle(
            'workflow-visible',
            canMakeMembershipDecision
        );
      }

      if (membershipReviewActions) {
        membershipReviewActions.classList.toggle(
            'workflow-visible',
            canMakeMembershipDecision
        );
      }

      if (idApplicationPanel) {
        idApplicationPanel.classList.toggle(
            'workflow-visible',
            showIdApplicationWorkflow
        );
      }

      renderDecisionHistory(
          application,
          showReadOnlyDecisionHistory
      );

      if (showIdApplicationWorkflow) {
        idApplicationStatusDisplay.textContent =
            application.idApplicationStatus === 'created'
                ? 'ID application created'
                : 'ID application pending';

        idApplicationStatusDisplay.className =
            'application-status ' +
            (
                application.idApplicationStatus === 'created'
                    ? 'status-id_application_created'
                    : 'status-id_application_pending'
            );
      }
    }

    function openReview(application) {
      selectedApplication = application;

      clearMembershipNumberError();
      clearStatusNoteError();
      clearMembershipMessage();

      /*
       * Hide all workflow-specific controls immediately.
       * The visibility function will enable only the correct workflow.
       */
      if (membershipDecisionFields) {
        membershipDecisionFields.classList.remove(
            'workflow-visible'
        );
      }

      if (membershipAdminNoteGroup) {
        membershipAdminNoteGroup.classList.remove(
            'workflow-visible'
        );
      }

      if (membershipReviewActions) {
        membershipReviewActions.classList.remove(
            'workflow-visible'
        );
      }

      if (idApplicationPanel) {
        idApplicationPanel.classList.remove(
            'workflow-visible'
        );
      }

      reviewCard.hidden = false;

      reviewReference.textContent =
          application.referenceNumber +
          (
              application.membershipNumber
                  ? ' · Membership No: ' + application.membershipNumber
                  : ''
          ) +
          ' · Submitted ' +
          formatDateTime(application.submittedAt) +
          ' · Status: ' +
          application.applicationStatus.replace(/_/g, ' ');

      membershipNumberInput.value =
          application.membershipNumber || '';

      statusNoteInput.value =
          application.statusNote || '';

      adminNoteInput.value =
          application.adminNote || '';

      fillReviewFields(application);

      updateReviewWorkflowVisibility(application);

      reviewCard.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }

    async function loadApplications() {
      clearMembershipMessage();

      tbody.innerHTML =
          '<tr>' +
          '<td colspan="7" class="empty-table-state">' +
          'Loading membership applications...' +
          '</td>' +
          '</tr>';

      try {
        const response = await fetch(
            membershipUrl('/membership/admin/applications'),
            {
              headers: {
                Authorization: 'Bearer ' + getToken()
              }
            }
        );

        if (!response.ok) {
          throw await parseMembershipError(response);
        }

        const data = await response.json();

        const source = Array.isArray(data)
            ? data
            : data.applications || [];

        applications = source.map(normalizeApplication);

        updateCounts();
        renderApplications();
      } catch (error) {
        applications = [];
        updateCounts();

        tbody.innerHTML =
            '<tr>' +
            '<td colspan="7" class="empty-table-state">' +
            escapeHtml(error.message) +
            '</td>' +
            '</tr>';

        setMembershipMessage(
            'error',
            error.message ||
            'Could not load membership applications.',
            { focus: true }
        );
      }
    }

    function clearMembershipDecisionModal() {
      if (!membershipDecisionModal) {
        return;
      }

      membershipDecisionModal.hidden = true;
      membershipDecisionModal.classList.remove(
          'decision-reject',
          'decision-more-information',
          'decision-approve'
      );

      pendingMembershipDecision = null;
    }

    function decisionLabel(status) {
      const labels = {
        approved: 'Approve Application',
        rejected: 'Reject Application',
        more_information_required:
            'Request More Information'
      };

      return labels[status] || 'Update Application';
    }

    function prepareMembershipDecision(status) {
      clearMembershipNumberError();
      clearStatusNoteError();

      if (!selectedApplication) {
        setMembershipMessage(
            'error',
            'Select an application to review first.',
            { focus: true }
        );
        return;
      }

      if (
          activeStatus === 'id_application' ||
          selectedApplication.applicationStatus === 'approved' ||
          selectedApplication.applicationStatus === 'rejected'
      ) {
        setMembershipMessage(
            'error',
            'This application is read-only in the current workflow.',
            { focus: true }
        );
        return;
      }

      const membershipNumber =
          membershipNumberInput.value.trim();

      const statusNote =
          statusNoteInput.value.trim();

      const adminNote =
          adminNoteInput.value.trim();

      if (
          status === 'approved' &&
          !membershipNumber
      ) {
        showMembershipNumberError(
            'Enter a membership number before approving this application.'
        );
        return;
      }

      if (
          (
              status === 'more_information_required' ||
              status === 'rejected'
          ) &&
          !statusNote
      ) {
        showStatusNoteError(
            status === 'rejected'
                ? 'Applicant Status Note is required before rejecting this application.'
                : 'Applicant Status Note is required before requesting more information.'
        );
        return;
      }

      pendingMembershipDecision = {
        status: status,
        membershipNumber: membershipNumber,
        statusNote: statusNote,
        adminNote: adminNote
      };

      openMembershipDecisionModal();
    }

    function openMembershipDecisionModal() {
      if (
          !membershipDecisionModal ||
          !selectedApplication ||
          !pendingMembershipDecision
      ) {
        return;
      }

      const decision = pendingMembershipDecision;
      const isApproval = decision.status === 'approved';
      const isRejection = decision.status === 'rejected';
      const isMoreInformation =
          decision.status === 'more_information_required';

      membershipDecisionModal.classList.remove(
          'decision-reject',
          'decision-more-information',
          'decision-approve'
      );

      if (isRejection) {
        membershipDecisionModal.classList.add(
            'decision-reject'
        );
      } else if (isMoreInformation) {
        membershipDecisionModal.classList.add(
            'decision-more-information'
        );
      } else {
        membershipDecisionModal.classList.add(
            'decision-approve'
        );
      }

      membershipDecisionModalTitle.textContent =
          isApproval
              ? 'Confirm Membership Approval'
              : isRejection
                  ? 'Confirm Application Rejection'
                  : 'Confirm Information Request';

      membershipDecisionModalIntroduction.textContent =
          isApproval
              ? 'Please confirm that you want to approve this membership application and assign the membership number below.'
              : isRejection
                  ? 'Please confirm that you want to reject this membership application.'
                  : 'Please confirm that you want to request additional information from this applicant.';

      membershipDecisionModalReference.textContent =
          selectedApplication.referenceNumber;

      membershipDecisionModalAction.textContent =
          decisionLabel(decision.status);

      membershipDecisionModalNumberRow.hidden =
          !isApproval;

      membershipDecisionModalNumber.textContent =
          decision.membershipNumber || '—';

      membershipDecisionModalStatusNoteRow.hidden =
          !decision.statusNote;

      membershipDecisionModalStatusNote.textContent =
          decision.statusNote || '—';

      membershipDecisionModalAdminNoteRow.hidden =
          !decision.adminNote;

      membershipDecisionModalAdminNote.textContent =
          decision.adminNote || '—';

      membershipDecisionModalWarning.textContent =
          isApproval
              ? 'This will approve the application and assign the membership number. This action cannot be undone from this screen.'
              : isRejection
                  ? 'This will mark the application as rejected. The applicant will see the Applicant Status Note.'
                  : 'This will mark the application as requiring more information. The applicant will see the Applicant Status Note.';

      confirmMembershipDecisionButton.textContent =
          isApproval
              ? 'Confirm Approval'
              : isRejection
                  ? 'Confirm Rejection'
                  : 'Confirm Information Request';

      membershipDecisionModal.hidden = false;

      window.setTimeout(function () {
        confirmMembershipDecisionButton.focus();
      }, 0);
    }

    async function submitMembershipDecision() {
      if (!selectedApplication || !pendingMembershipDecision) {
        clearMembershipDecisionModal();

        setMembershipMessage(
            'error',
            'No membership decision is ready to submit.',
            { focus: true }
        );

        return;
      }

      const referenceNumber =
          selectedApplication.referenceNumber;

      const status =
          pendingMembershipDecision.status;

      const membershipNumber =
          pendingMembershipDecision.membershipNumber;

      const statusNote =
          pendingMembershipDecision.statusNote;

      const adminNote =
          pendingMembershipDecision.adminNote;

      confirmMembershipDecisionButton.disabled = true;
      confirmMembershipDecisionButton.textContent =
          'Saving Decision...';

      try {
        const response = await fetch(
            membershipUrl(
                '/membership/admin/applications/' +
                encodeURIComponent(referenceNumber) +
                '/status'
            ),
            {
              method: 'PATCH',
              headers: {
                Authorization: 'Bearer ' + getToken(),
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                status: status,
                membershipNumber: membershipNumber || null,
                statusNote: statusNote || null,
                adminNote: adminNote || null
              })
            }
        );

        if (!response.ok) {
          throw await parseMembershipError(response);
        }

        clearMembershipDecisionModal();

        setMembershipMessage(
            'success',
            referenceNumber +
            ' has been updated to ' +
            status.replace(/_/g, ' ') +
            '.'
        );

        reviewCard.hidden = true;
        selectedApplication = null;

        await loadApplications();
      } catch (error) {
        if (
            status === 'approved' &&
            error.field === 'membershipNumber'
        ) {
          clearMembershipDecisionModal();

          showMembershipNumberError(error.message);

          return;
        }

        setMembershipMessage(
            'error',
            error.message ||
            'Could not update the membership application.',
            { focus: true }
        );
      } finally {
        confirmMembershipDecisionButton.disabled = false;
        confirmMembershipDecisionButton.textContent =
            'Confirm Decision';
      }
    }

    async function openProtectedDocument(fileType) {
      if (!selectedApplication) {
        setMembershipMessage(
            'error',
            'Select an application first.'
        );
        return;
      }

      const url = membershipUrl(
          '/membership/admin/applications/' +
          encodeURIComponent(selectedApplication.referenceNumber) +
          '/files/' +
          fileType
      );

      let previewWindow = window.open('', '_blank');

      if (!previewWindow) {
        setMembershipMessage(
            'error',
            'The document could not be opened because the browser blocked the new tab. Please allow pop-ups for this site and try again.'
        );
        return;
      }

      previewWindow.document.write(
          '<!DOCTYPE html>' +
          '<html>' +
          '<head><title>Loading document...</title></head>' +
          '<body style="font-family:Arial,sans-serif;padding:24px;">' +
          '<p>Loading protected document...</p>' +
          '</body>' +
          '</html>'
      );

      try {
        const response = await fetch(url, {
          headers: {
            Authorization: 'Bearer ' + getToken()
          }
        });

        if (!response.ok) {
          const error = await parseMembershipError(response);

          previewWindow.close();

          throw error;
        }

        const fileBlob = await response.blob();
        const fileUrl = URL.createObjectURL(fileBlob);

        previewWindow.location.replace(fileUrl);

        window.setTimeout(function () {
          URL.revokeObjectURL(fileUrl);
        }, 60000);
      } catch (error) {
        if (previewWindow && !previewWindow.closed) {
          previewWindow.close();
        }

        setMembershipMessage(
            'error',
            error.message ||
            'Could not open the protected document.',
            { focus: true }
        );
      }
    }

    document
        .querySelectorAll('[data-membership-status]')
        .forEach(function (button) {
          button.addEventListener('click', function () {
            activeStatus = button.getAttribute(
                'data-membership-status'
            );

            document
                .querySelectorAll('[data-membership-status]')
                .forEach(function (tab) {
                  tab.classList.remove('active');
                });

            button.classList.add('active');

            reviewCard.hidden = true;
            selectedApplication = null;

            renderApplications();
          });
        });

    tbody.addEventListener('click', function (event) {
      const reviewButton = event.target.closest(
          '[data-review-reference]'
      );

      if (!reviewButton) {
        return;
      }

      const referenceNumber = reviewButton.getAttribute(
          'data-review-reference'
      );

      const application = applications.find(function (item) {
        return item.referenceNumber === referenceNumber;
      });

      if (application) {
        openReview(application);
      }
    });

    searchInput.addEventListener('input', function () {
      renderApplications();
    });

    refreshButton.addEventListener('click', function () {
      loadApplications();
    });

    closeButton.addEventListener('click', function () {
      reviewCard.hidden = true;
      selectedApplication = null;

      membershipNumberInput.value = '';
      statusNoteInput.value = '';
      adminNoteInput.value = '';

      clearMembershipNumberError();
      clearStatusNoteError();
      clearMembershipMessage();

      if (membershipDecisionHistory) {
        membershipDecisionHistory.hidden = true;
      }

      [
        membershipDecisionFields,
        membershipAdminNoteGroup,
        membershipReviewActions,
        idApplicationPanel
      ].forEach(function (element) {
        if (element) {
          element.classList.remove('workflow-visible');
        }
      });
    });

    approveButton.addEventListener('click', function () {
      prepareMembershipDecision('approved');
    });

    rejectButton.addEventListener('click', function () {
      prepareMembershipDecision('rejected');
    });

    moreInformationButton.addEventListener('click', function () {
      prepareMembershipDecision(
          'more_information_required'
      );
    });

    receiptButton.addEventListener('click', function () {
      openProtectedDocument('receipt');
    });

    photoButton.addEventListener('click', function () {
      openProtectedDocument('photo');
    });

    if (cancelIdConfirmationButton) {
      cancelIdConfirmationButton.addEventListener(
          'click',
          closeIdConfirmationModal
      );
    }

    if (confirmIdModalButton) {
      confirmIdModalButton.addEventListener(
          'click',
          submitIdApplicationConfirmation
      );
    }

    if (idConfirmationModal) {
      idConfirmationModal
          .querySelector('.admin-confirm-backdrop')
          .addEventListener(
              'click',
              closeIdConfirmationModal
          );
    }

    statusNoteInput.addEventListener('input', function () {
      clearStatusNoteError();
      clearMembershipMessage();
    });

    if (statusNoteInput) {
      statusNoteInput.addEventListener('input', function () {
        clearStatusNoteError();
        clearMembershipMessage();
      });
    }

    if (cancelMembershipDecisionButton) {
      cancelMembershipDecisionButton.addEventListener(
          'click',
          clearMembershipDecisionModal
      );
    }

    if (confirmMembershipDecisionButton) {
      confirmMembershipDecisionButton.addEventListener(
          'click',
          submitMembershipDecision
      );
    }

    if (membershipDecisionModal) {
      const decisionBackdrop =
          membershipDecisionModal.querySelector(
              '.admin-confirm-backdrop'
          );

      if (decisionBackdrop) {
        decisionBackdrop.addEventListener(
            'click',
            clearMembershipDecisionModal
        );
      }
    }

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') {
        return;
      }

      if (
          idConfirmationModal &&
          !idConfirmationModal.hidden
      ) {
        closeIdConfirmationModal();
      }

      if (
          membershipDecisionModal &&
          !membershipDecisionModal.hidden
      ) {
        clearMembershipDecisionModal();
      }
    });

    loadApplications();

    if (downloadIdApplicationPdfButton) {
      downloadIdApplicationPdfButton.addEventListener(
          'click',
          function () {
            downloadIdApplicationPdf();
          }
      );
    }

    if (downloadIdApplicationPhotoButton) {
      downloadIdApplicationPhotoButton.addEventListener(
          'click',
          function () {
            downloadIdApplicationPhoto();
          }
      );
    }

    if (confirmIdApplicationButton) {
      confirmIdApplicationButton.addEventListener(
          'click',
          function (event) {
            event.preventDefault();
            openIdConfirmationModal();
          }
      );
    }

    function buildIdFileBaseName(application) {
      return (
        'SLNA-' +
        application.membershipNumber +
        '-' +
        String(
            application.nameWithInitials ||
            application.fullName
        )
            .replace(/\./g, '')
            .trim()
            .replace(/\s+/g, '-')
      );
    }

    async function downloadIdApplicationPdf() {
      if (!selectedApplication) {
        setMembershipMessage(
            'error',
            'Select an application first.'
        );
        return;
      }

      if (
          selectedApplication.applicationStatus !==
          'approved'
      ) {
        setMembershipMessage(
            'error',
            'The membership application must be approved before the ID application PDF can be generated.'
        );
        return;
      }

      if (!selectedApplication.membershipNumber) {
        setMembershipMessage(
            'error',
            'A membership number must be assigned before generating the ID application PDF.'
        );
        return;
      }

      const url = membershipUrl(
          '/membership/admin/applications/' +
          encodeURIComponent(
              selectedApplication.referenceNumber
          ) +
          '/id-application.pdf'
      );

      let downloadWindow = window.open('', '_blank');

      if (!downloadWindow) {
        setMembershipMessage(
            'error',
            'The browser blocked the PDF window. Please allow pop-ups for this site.'
        );
        return;
      }

      downloadWindow.document.write(
          '<!DOCTYPE html>' +
          '<html><body style="font-family:Arial;padding:24px;">' +
          '<p>Generating ID application PDF...</p>' +
          '</body></html>'
      );

      try {
        const response = await fetch(url, {
          headers: {
            Authorization: 'Bearer ' + getToken()
          }
        });

        if (!response.ok) {
          throw await parseMembershipError(response);
        }

        const pdfBlob = await response.blob();
        const pdfUrl = URL.createObjectURL(pdfBlob);

        const link = downloadWindow.document.createElement('a');
        link.href = pdfUrl;
        link.download =
            buildIdFileBaseName(selectedApplication) +
            '-ID-Application.pdf';

        downloadWindow.document.body.appendChild(link);
        link.click();

        downloadWindow.document.body.innerHTML =
            '<p>Download started. You may close this window.</p>';

        window.setTimeout(function () {
          URL.revokeObjectURL(pdfUrl);
        }, 60000);
      } catch (error) {
        if (!downloadWindow.closed) {
          downloadWindow.close();
        }

        setMembershipMessage(
            'error',
            error.message ||
            'Could not generate the ID application PDF.',
            { focus: true }
        );
      }
    }

    async function downloadIdApplicationPhoto() {
      if (!selectedApplication) {
        setMembershipMessage(
            'error',
            'Select an application first.'
        );
        return;
      }

      if (
          selectedApplication.applicationStatus !==
          'approved'
      ) {
        setMembershipMessage(
            'error',
            'The membership application must be approved before the ID photograph can be downloaded.'
        );
        return;
      }

      if (!selectedApplication.membershipNumber) {
        setMembershipMessage(
            'error',
            'A membership number must be assigned before downloading the ID photograph.'
        );
        return;
      }

      const url = membershipUrl(
          '/membership/admin/applications/' +
          encodeURIComponent(
              selectedApplication.referenceNumber
          ) +
          '/id-photo'
      );

      try {
        const response = await fetch(url, {
          headers: {
            Authorization: 'Bearer ' + getToken()
          }
        });

        if (!response.ok) {
          throw await parseMembershipError(response);
        }

        const photoBlob = await response.blob();
        const photoUrl = URL.createObjectURL(photoBlob);

        const filename =
            buildIdFileBaseName(selectedApplication) +
            '-ID-Photo.jpg';

        const link = document.createElement('a');
        link.href = photoUrl;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.setTimeout(function () {
          URL.revokeObjectURL(photoUrl);
        }, 60000);
      } catch (error) {
        setMembershipMessage(
            'error',
            error.message ||
            'Could not download the ID photograph.',
            { focus: true }
        );
      }
    }

    function closeIdConfirmationModal() {
      if (!idConfirmationModal) {
        return;
      }

      idConfirmationModal.hidden = true;
    }

    function openIdConfirmationModal() {
      if (!selectedApplication) {
        setMembershipMessage(
            'error',
            'Select an application first.'
        );
        return;
      }

      if (
          selectedApplication.applicationStatus !==
          'approved'
      ) {
        setMembershipMessage(
            'error',
            'Only approved membership applications can have an ID application created.'
        );
        return;
      }

      if (
          selectedApplication.idApplicationStatus ===
          'created'
      ) {
        setMembershipMessage(
            'error',
            'The ID application has already been confirmed as created.'
        );
        return;
      }

      idConfirmationReference.textContent =
          selectedApplication.referenceNumber;

      idConfirmationModal.hidden = false;
      confirmIdModalButton.focus();
    }

    async function submitIdApplicationConfirmation() {
      if (!selectedApplication) {
        closeIdConfirmationModal();

        setMembershipMessage(
            'error',
            'Select an application first.'
        );

        return;
      }

      confirmIdModalButton.disabled = true;
      confirmIdModalButton.textContent =
          'Confirming...';

      try {
        const response = await fetch(
            membershipUrl(
                '/membership/admin/applications/' +
                encodeURIComponent(
                    selectedApplication.referenceNumber
                ) +
                '/id-application'
            ),
            {
              method: 'PATCH',
              headers: {
                Authorization: 'Bearer ' + getToken(),
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({})
            }
        );

        if (!response.ok) {
          throw await parseMembershipError(response);
        }

        const data = await response.json();

        closeIdConfirmationModal();

        setMembershipMessage(
            'success',
            data.message ||
            'ID application generation has been confirmed.'
        );

        reviewCard.hidden = true;
        selectedApplication = null;

        await loadApplications();
      } catch (error) {
        setMembershipMessage(
            'error',
            error.message ||
            'Could not confirm ID application generation.'
        );
      } finally {
        confirmIdModalButton.disabled = false;
        confirmIdModalButton.textContent =
            'Confirm ID Application Generated';
      }
    }

    if (idConfirmationModal) {
      const backdrop = idConfirmationModal.querySelector(
          '.admin-confirm-backdrop'
      );

      if (backdrop) {
        backdrop.addEventListener(
            'click',
            closeIdConfirmationModal
        );
      }
    }

    membershipNumberInput.addEventListener('input', function () {
      clearMembershipNumberError();
      clearMembershipMessage();
    });

    function clearMembershipNumberError() {
      if (membershipNumberError) {
        membershipNumberError.textContent = '';
        membershipNumberError.classList.remove('is-visible');
      }

      if (membershipNumberInput) {
        membershipNumberInput.classList.remove('input-error');
        membershipNumberInput.removeAttribute('aria-invalid');
      }
    }

    function showMembershipNumberError(message) {
      if (membershipNumberError) {
        membershipNumberError.textContent = message;
        membershipNumberError.classList.add('is-visible');
      }

      if (membershipNumberInput) {
        membershipNumberInput.classList.add('input-error');
        membershipNumberInput.setAttribute('aria-invalid', 'true');

        membershipNumberInput.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        window.setTimeout(function () {
          membershipNumberInput.focus();
        }, 350);
      }
    }

    function renderDecisionHistory(
        application,
        visible
    ) {
      if (!membershipDecisionHistory) {
        return;
      }

      membershipDecisionHistory.hidden = !visible;

      if (!visible) {
        return;
      }

      if (readOnlyStatusNote) {
        readOnlyStatusNote.textContent =
            application.statusNote || 'No applicant status note recorded.';
      }

      if (readOnlyAdminNote) {
        readOnlyAdminNote.textContent =
            application.adminNote || 'No internal admin note recorded.';
      }
    }

    function clearStatusNoteError() {
      if (statusNoteError) {
        statusNoteError.textContent = '';
        statusNoteError.classList.remove('is-visible');
      }

      if (statusNoteInput) {
        statusNoteInput.classList.remove('input-error');
        statusNoteInput.removeAttribute('aria-invalid');
      }
    }

    function showStatusNoteError(message) {
      if (statusNoteError) {
        statusNoteError.textContent = message;
        statusNoteError.classList.add('is-visible');
      }

      if (statusNoteInput) {
        statusNoteInput.classList.add('input-error');
        statusNoteInput.setAttribute('aria-invalid', 'true');

        statusNoteInput.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        window.setTimeout(function () {
          statusNoteInput.focus();
        }, 350);
      }
    }
  }
});

function showAlert(elId, message, type) {
  const el = document.getElementById(elId);

  if (!el) return;

  el.innerHTML = '<div class="alert alert-' + type + '">' + message + '</div>';

  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  if (!el.hasAttribute('aria-live')) el.setAttribute('aria-live', 'polite');

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.setTimeout(() => { el.focus({ preventScroll: true }); }, 300);

  clearTimeout(el._alertTimeout);
  el._alertTimeout = setTimeout(() => { el.innerHTML = ''; }, 6000);
}

async function loadAdminNewsTable() {
  const tbody = document.getElementById('news-table-body');
  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/news');
    if (!res.ok) throw new Error('bad status');
    const items = await res.json();
    if (items.length === 0) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#888;">No news items yet.</td></tr>'; return; }
    const apiOrigin = SLNA_CONFIG.API_BASE_URL.replace('/api', '');
    tbody.innerHTML = items.map(item => {
      const badgeClass = item.source === 'file' ? 'badge-file' : 'badge-typed';
      const badgeLabel = item.source === 'file' ? 'FILE UPLOAD' : 'TYPED';
      const thumb = item.photo_url ? '<img src="' + apiOrigin + item.photo_url + '" class="thumb-preview" style="width:40px;height:40px;">' : '-';
      const gallery = item.album_id
          ? '<a href="album.html?id=' + item.album_id + '" target="_blank" rel="noopener">View Album</a>'
          : '-';
      return '<tr><td>' + thumb + '</td><td>' + item.title + '</td><td>' + (item.news_type || '-') + '</td><td>' + item.event_date + '</td><td><span class="badge-source ' + badgeClass + '">' + badgeLabel + '</span></td><td>' + gallery + '</td><td><button class="btn btn-outline btn-sm" onclick="handleEditNews(' + item.id + ')">Edit</button> <button class="btn btn-danger btn-sm" onclick="handleDeleteNews(' + item.id + ')">Delete</button></td></tr>';
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#c0392b;">Could not load news. Is the backend server running?</td></tr>';
  }
}

async function handleDeleteNews(id) {
  const confirmed = await showSimpleConfirm({
    title: 'Delete News Item',
    message: 'Are you sure you want to delete this news item? This action cannot be undone.',
    confirmText: 'Delete News Item'
  });
  if (!confirmed) return;
  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/news/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + getToken() },
    });
    if (!res.ok) {
      showAlert('news-table-alert', 'Could not delete this item. It may have already been removed.', 'error');
      return;
    }
    showAlert('news-table-alert', 'News item deleted.', 'success');
    loadAdminNewsTable();
  } catch (err) {
    console.error(err);
    showAlert('news-table-alert', 'Could not reach the server. Please check that the backend is running (npm start in the slna-backend folder) and try again.', 'error');
  }
}

// ---- News: Edit ----
let editNewsCurrentItem = null;
let editNewsPhotoFile = null;
let editNewsGalleryFiles = [];

async function handleEditNews(id) {
  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/news/' + id);
    if (!res.ok) throw new Error('bad status');
    const item = await res.json();
    const apiOrigin = SLNA_CONFIG.API_BASE_URL.replace('/api', '');

    editNewsCurrentItem = item;
    editNewsPhotoFile = null;
    editNewsGalleryFiles = [];

    document.getElementById('edit-news-alert').innerHTML = '';
    document.getElementById('edit-news-reference').textContent = 'Editing: ' + item.title;
    document.getElementById('edit-news-title').value = item.title || '';
    document.getElementById('edit-news-type').value = item.news_type || '';
    document.getElementById('edit-news-date').value = (item.event_date || '').slice(0, 10);
    document.getElementById('edit-news-summary').value = item.summary || '';
    document.getElementById('edit-news-body').value = item.body || '';

    document.getElementById('edit-news-current-photo').innerHTML = item.photo_url
        ? '<img src="' + apiOrigin + item.photo_url + '" class="thumb-preview" style="width:80px;height:80px;">'
        : 'No cover photo set.';
    document.getElementById('edit-news-photo-preview').innerHTML = '';
    document.getElementById('edit-news-photo-input').value = '';

    document.getElementById('edit-news-current-album').innerHTML = item.album_id
        ? 'Current album: <a href="album.html?id=' + item.album_id + '" target="_blank" rel="noopener">' +
        (item.photos ? item.photos.length : '?') + ' item(s) &mdash; view</a>'
        : 'No album linked to this news item yet.';

    document.getElementById('edit-news-override-album').checked = false;
    document.getElementById('edit-news-gallery-section').style.display = 'none';
    document.getElementById('edit-news-gallery-input').value = '';
    renderEditNewsGalleryPicker();

    const card = document.getElementById('edit-news-card');
    card.hidden = false;
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error(err);
    showAlert('news-table-alert', 'Could not load this news item for editing.', 'error');
  }
}

function closeEditNewsCard() {
  document.getElementById('edit-news-card').hidden = true;
  editNewsCurrentItem = null;
}

function renderEditNewsGalleryPicker() {
  const picker = document.getElementById('edit-news-gallery-picker');
  Promise.all(editNewsGalleryFiles.map(file => new Promise((resolve) => {
    if (file.type.startsWith('video/')) { resolve({ url: URL.createObjectURL(file), isVideo: true }); return; }
    const reader = new FileReader(); reader.onload = (evt) => resolve({ url: evt.target.result, isVideo: false }); reader.readAsDataURL(file);
  }))).then(items => {
    picker.innerHTML = items.map((item, idx) =>
      '<div class="photo-picker-item">' +
      (item.isVideo
        ? '<video src="' + item.url + '" muted></video><span class="media-play-icon">&#9658;</span>'
        : '<img src="' + item.url + '">') +
      '<button type="button" onclick="window._removeEditNewsGalleryPhoto(' + idx + ')">X</button></div>'
    ).join('');
    const countEl = document.getElementById('edit-news-gallery-count');
    if (countEl) countEl.textContent = editNewsGalleryFiles.length + ' item(s) selected';
  });
}
window._removeEditNewsGalleryPhoto = function (idx) { editNewsGalleryFiles.splice(idx, 1); renderEditNewsGalleryPicker(); };

function initEditNewsForm() {
  const form = document.getElementById('edit-news-form');
  const closeButton = document.getElementById('close-edit-news');
  const photoInput = document.getElementById('edit-news-photo-input');
  const overrideCheckbox = document.getElementById('edit-news-override-album');
  const gallerySection = document.getElementById('edit-news-gallery-section');
  const galleryInput = document.getElementById('edit-news-gallery-input');

  closeButton.addEventListener('click', closeEditNewsCard);

  photoInput.addEventListener('change', async function (e) {
    if (e.target.files.length) {
      const file = e.target.files[0];
      if (file.size > 15 * 1024 * 1024) {
        showAlert('edit-news-alert', 'That photo is ' + (file.size / (1024 * 1024)).toFixed(1) + 'MB, which is over the 15MB limit. Please choose a smaller photo.', 'error');
        e.target.value = '';
        return;
      }
      editNewsPhotoFile = await compressImageFile(file);
      const reader = new FileReader();
      reader.onload = (evt) => { document.getElementById('edit-news-photo-preview').innerHTML = '<img src="' + evt.target.result + '" class="thumb-preview">'; };
      reader.readAsDataURL(editNewsPhotoFile);
    }
  });

  overrideCheckbox.addEventListener('change', function () {
    gallerySection.style.display = overrideCheckbox.checked ? 'block' : 'none';
    if (!overrideCheckbox.checked) {
      editNewsGalleryFiles = [];
      galleryInput.value = '';
      renderEditNewsGalleryPicker();
    }
  });

  galleryInput.addEventListener('change', async function (e) {
    const files = Array.from(e.target.files);
    const maxSize = (f) => f.type.startsWith('video/') ? 100 * 1024 * 1024 : 15 * 1024 * 1024;
    const oversized = files.filter(f => f.size > maxSize(f));
    const validFiles = files.filter(f => f.size <= maxSize(f));
    if (oversized.length) {
      showAlert('edit-news-alert', oversized.length + ' file(s) are over the size limit (15MB for photos, 100MB for videos) and were not added: ' + oversized.map(f => f.name).join(', '), 'error');
    }
    const compressedFiles = await compressImageFiles(validFiles);
    editNewsGalleryFiles = editNewsGalleryFiles.concat(compressedFiles);
    renderEditNewsGalleryPicker();
    galleryInput.value = '';
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!editNewsCurrentItem) return;

    const title = document.getElementById('edit-news-title').value.trim();
    const news_type = document.getElementById('edit-news-type').value;
    const event_date = document.getElementById('edit-news-date').value;
    const summary = document.getElementById('edit-news-summary').value.trim();
    const body = document.getElementById('edit-news-body').value.trim();
    const overrideAlbum = overrideCheckbox.checked;

    if (!title || !news_type || !event_date || !body) {
      showAlert('edit-news-alert', 'Please fill in title, type, date, and content.', 'error');
      return;
    }
    if (overrideAlbum && editNewsGalleryFiles.length === 0) {
      showAlert('edit-news-alert', 'Please select the photos/videos to upload for the album, or uncheck "Replace the existing album\'s items" to keep it unchanged.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('news_type', news_type);
    formData.append('event_date', event_date);
    formData.append('summary', summary);
    formData.append('body', body);
    formData.append('override_album', overrideAlbum ? 'true' : 'false');
    if (editNewsPhotoFile) formData.append('photo', editNewsPhotoFile);
    if (overrideAlbum) editNewsGalleryFiles.forEach(file => formData.append('photos', file));

    try {
      const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/news/' + editNewsCurrentItem.id, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + getToken() },
        body: formData,
      });
      if (!res.ok) {
        let message = 'Could not update the news item.';
        try {
          const data = await res.json();
          if (data && data.error) message = data.error;
        } catch (parseErr) {
          // Response wasn't JSON -- fall back to the generic message above.
        }
        showAlert('edit-news-alert', message, 'error');
        return;
      }
      showAlert('edit-news-alert', 'News item updated.', 'success');
      loadAdminNewsTable();
    } catch (err) {
      console.error(err);
      showAlert('edit-news-alert', 'Could not reach the server. Please check that the backend is running (npm start in the slna-backend folder) and try again.', 'error');
    }
  });
}

let albumTableCache = [];

function formatAlbumDate(value) {
  if (!value) return '-';
  const date = new Date(String(value).slice(0, 10) + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB');
}

async function loadAdminAlbumTable() {
  const tbody = document.getElementById('album-table-body');
  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/albums');
    if (!res.ok) throw new Error('bad status');
    const albums = await res.json();
    albumTableCache = albums;
    if (albums.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888;">No albums yet.</td></tr>'; return; }
    const apiOrigin = SLNA_CONFIG.API_BASE_URL.replace('/api', '');
    tbody.innerHTML = albums.map(album => {
      const thumb = !album.cover_photo ? '-'
        : album.cover_media_type === 'video'
          ? '<video src="' + apiOrigin + album.cover_photo + '" class="thumb-preview" style="width:40px;height:40px;" muted preload="metadata"></video>'
          : '<img src="' + apiOrigin + album.cover_photo + '" class="thumb-preview" style="width:40px;height:40px;">';
      return '<tr><td>' + thumb + '</td><td>' + escapeHtml(album.title) + '</td><td>' + formatAlbumDate(album.event_date) + '</td><td>' + album.photo_count + ' item(s)</td><td><button class="btn btn-outline btn-sm" onclick="handleEditAlbumTitle(' + album.id + ')">Edit Title</button> <button class="btn btn-danger btn-sm" onclick="handleDeleteAlbum(' + album.id + ')">Delete</button></td></tr>';
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#c0392b;">Could not load albums. Is the backend server running?</td></tr>';
  }
}

let albumTitleEditId = null;

function handleEditAlbumTitle(id) {
  const album = albumTableCache.find(function (candidate) { return Number(candidate.id) === Number(id); });
  if (!album) return;

  albumTitleEditId = id;
  document.getElementById('album-title-edit-alert').innerHTML = '';
  document.getElementById('album-title-edit-input').value = album.title || '';

  const modal = document.getElementById('album-title-edit-modal');
  modal.hidden = false;
  document.getElementById('album-title-edit-input').focus();
}

function closeAlbumTitleEditModal() {
  document.getElementById('album-title-edit-modal').hidden = true;
  albumTitleEditId = null;
}

function initAlbumTitleEditModal() {
  const modal = document.getElementById('album-title-edit-modal');
  if (!modal) return;

  const form = document.getElementById('album-title-edit-form');
  const cancelButton = document.getElementById('cancel-album-title-edit');
  const backdrop = modal.querySelector('.admin-confirm-backdrop');

  cancelButton.addEventListener('click', closeAlbumTitleEditModal);
  backdrop.addEventListener('click', closeAlbumTitleEditModal);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !modal.hidden) closeAlbumTitleEditModal();
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!albumTitleEditId) return;

    const title = document.getElementById('album-title-edit-input').value.trim();
    if (!title) {
      showAlert('album-title-edit-alert', 'Please enter a title.', 'error');
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';

    try {
      const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/albums/' + albumTitleEditId, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({ title: title })
      });

      if (!res.ok) {
        let message = 'Could not update the album title.';
        try {
          const data = await res.json();
          if (data && data.error) message = data.error;
        } catch (parseErr) {
          // Response wasn't JSON -- fall back to the generic message above.
        }
        showAlert('album-title-edit-alert', message, 'error');
        return;
      }

      closeAlbumTitleEditModal();
      showAlert('album-table-alert', 'Album title updated.', 'success');
      loadAdminAlbumTable();
    } catch (err) {
      console.error(err);
      showAlert('album-title-edit-alert', 'Could not reach the server. Please check that the backend is running (npm start in the slna-backend folder) and try again.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Save Title';
    }
  });
}

async function handleDeleteAlbum(id) {
  const confirmed = await showSimpleConfirm({
    title: 'Delete Album',
    message: 'Are you sure you want to delete this album? This action cannot be undone.',
    confirmText: 'Delete Album'
  });
  if (!confirmed) return;
  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/albums/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + getToken() },
    });
    if (!res.ok) {
      showAlert('album-table-alert', 'Could not delete this album. It may have already been removed.', 'error');
      return;
    }
    showAlert('album-table-alert', 'Album deleted.', 'success');
    loadAdminAlbumTable();
  } catch (err) {
    console.error(err);
    showAlert('album-table-alert', 'Could not reach the server. Please check that the backend is running (npm start in the slna-backend folder) and try again.', 'error');
  }
}

// ---- User Queries (Contact SLNA form submissions) ----

let activeQueryStatus = 'all';
let contactQueriesCache = [];

const CONTACT_QUERY_SUBJECT_LABELS = {
  general: 'General Inquiry',
  feedback: 'Feedback / Suggestion',
  membership: 'Membership Query',
  events: 'Events & CPD',
  other: 'Other'
};

function escapeHtml(value) {
  return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
}

function formatQueryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function updateContactQueriesBadge() {
  const badge = document.getElementById('queries-new-count');
  if (!badge) return;
  const newCount = contactQueriesCache.filter(q => q.status === 'new').length;
  badge.textContent = String(newCount);
}

function renderContactQueriesTable() {
  const tbody = document.getElementById('contact-queries-table-body');
  if (!tbody) return;

  const filtered = activeQueryStatus === 'all'
      ? contactQueriesCache
      : contactQueriesCache.filter(q => q.status === activeQueryStatus);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-table-state">No queries found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function (item) {
    const isNew = item.status === 'new';
    const toggleLabel = isNew ? 'Mark as Read' : 'Mark as New';
    const toggleStatus = isNew ? 'read' : 'new';
    const statusBadgeClass = isNew ? 'badge-typed' : 'badge-file';
    const statusLabel = isNew ? 'New' : 'Read';
    const subjectLabel = CONTACT_QUERY_SUBJECT_LABELS[item.subject] || item.subject;

    return '<tr>' +
        '<td>' + escapeHtml(item.full_name) + '</td>' +
        '<td>' + escapeHtml(item.email) + '<br><span class="admin-muted">' + escapeHtml(item.mobile_number) + '</span></td>' +
        '<td>' + escapeHtml(subjectLabel) + '</td>' +
        '<td style="max-width:280px; white-space:pre-wrap;">' + escapeHtml(item.message) + '</td>' +
        '<td>' + escapeHtml(formatQueryDate(item.created_at)) + '</td>' +
        '<td><span class="badge-source ' + statusBadgeClass + '">' + statusLabel + '</span></td>' +
        '<td>' +
        '<button class="btn btn-outline btn-sm" onclick="handleToggleQueryStatus(' + item.id + ', \'' + toggleStatus + '\')">' + toggleLabel + '</button> ' +
        '<button class="btn btn-danger btn-sm" onclick="handleDeleteQuery(' + item.id + ')">Delete</button>' +
        '</td>' +
        '</tr>';
  }).join('');
}

async function loadContactQueries() {
  const tbody = document.getElementById('contact-queries-table-body');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" class="empty-table-state">Loading queries...</td></tr>';

  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/contact-queries', {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (!res.ok) throw new Error('bad status');
    contactQueriesCache = await res.json();
    updateContactQueriesBadge();
    renderContactQueriesTable();
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-table-state" style="color:#c0392b;">Could not load queries. Is the backend server running?</td></tr>';
  }
}

async function handleToggleQueryStatus(id, newStatus) {
  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/contact-queries/' + id + '/status', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + getToken()
      },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) {
      showAlert('contact-queries-alert', 'Could not update this query.', 'error');
      return;
    }
    await loadContactQueries();
  } catch (err) {
    console.error(err);
    showAlert('contact-queries-alert', 'Could not reach the server. Please check that the backend is running (npm start in the slna-backend folder) and try again.', 'error');
  }
}

async function handleDeleteQuery(id) {
  const confirmed = await showSimpleConfirm({
    title: 'Delete Query',
    message: 'Are you sure you want to delete this query? This action cannot be undone.',
    confirmText: 'Delete Query'
  });
  if (!confirmed) return;
  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/contact-queries/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (!res.ok) {
      showAlert('contact-queries-alert', 'Could not delete this query. It may have already been removed.', 'error');
      return;
    }
    showAlert('contact-queries-alert', 'Query deleted.', 'success');
    loadContactQueries();
  } catch (err) {
    console.error(err);
    showAlert('contact-queries-alert', 'Could not reach the server. Please check that the backend is running (npm start in the slna-backend folder) and try again.', 'error');
  }
}

function initContactQueries() {
  document.querySelectorAll('[data-query-status]').forEach(function (button) {
    button.addEventListener('click', function () {
      activeQueryStatus = button.getAttribute('data-query-status');

      document.querySelectorAll('[data-query-status]').forEach(function (tab) {
        tab.classList.remove('active');
      });

      button.classList.add('active');
      renderContactQueriesTable();
    });
  });

  const refreshButton = document.getElementById('refresh-contact-queries');
  if (refreshButton) {
    refreshButton.addEventListener('click', loadContactQueries);
  }

  loadContactQueries();
}
