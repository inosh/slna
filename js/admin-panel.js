
// admin-panel.js -- Posts/deletes news and albums via the real backend API.
// UPDATED: friendlier error messages, including when the backend server
// itself is unreachable (not running, wrong port, etc.)

document.addEventListener('DOMContentLoaded', function () {
  const session = requireAuth();
  if (!session) return;
  document.getElementById('welcome-user').textContent = session.username + ' (' + session.role + ')';
  document.getElementById('logout-btn').addEventListener('click', logout);

  document.querySelectorAll('.main-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.main-tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.maintab).classList.add('active');
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
  document.getElementById('type-photo-input').addEventListener('change', function (e) {
    if (e.target.files.length) {
      const file = e.target.files[0];
      if (file.size > 15 * 1024 * 1024) {
        showAlert('type-alert', 'That photo is ' + (file.size / (1024*1024)).toFixed(1) + 'MB, which is over the 25MB limit. Please choose a smaller photo.', 'error');
        e.target.value = '';
        return;
      }
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
    formData.append('title', title);
    formData.append('event_date', event_date);
    formData.append('summary', summary);
    formData.append('body', body);
    if (typePhotoFile) formData.append('photo', typePhotoFile);

    try {
      const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/news/typed', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() },
        body: formData,
      });
      if (!res.ok) { showAlert('type-alert', await parseApiError(res), 'error'); return; }
      showAlert('type-alert', 'News item published.', 'success');
      typeForm.reset(); typePhotoFile = null;
      document.getElementById('type-photo-preview').innerHTML = '';
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

  document.getElementById('file-photo-input').addEventListener('change', function (e) {
    if (e.target.files.length) {
      const file = e.target.files[0];
      if (file.size > 15 * 1024 * 1024) {
        showAlert('file-alert', 'That photo is ' + (file.size / (1024*1024)).toFixed(1) + 'MB, which is over the 25MB limit. Please choose a smaller photo.', 'error');
        e.target.value = '';
        return;
      }
      filePhotoFile = file;
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

  fileForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!selectedDocument) { showAlert('file-alert', 'Please select a document to upload.', 'error'); return; }
    const title = document.getElementById('file-title').value.trim();
    const event_date = document.getElementById('file-date').value;
    const summary = document.getElementById('file-summary').value.trim();
    const body = document.getElementById('file-body-preview').value.trim();
    if (!title || !event_date) { showAlert('file-alert', 'Please provide a title and date.', 'error'); return; }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('event_date', event_date);
    formData.append('summary', summary);
    formData.append('body', body);
    formData.append('document', selectedDocument);
    if (filePhotoFile) formData.append('photo', filePhotoFile);

    try {
      const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/news/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + getToken() },
        body: formData,
      });
      if (!res.ok) { showAlert('file-alert', await parseApiError(res), 'error'); return; }
      showAlert('file-alert', 'News item published with attachment.', 'success');
      fileForm.reset(); fileNameDisplay.textContent = ''; selectedDocument = null; filePhotoFile = null;
      document.getElementById('file-photo-preview').innerHTML = '';
      loadAdminNewsTable();
    } catch (err) {
      showAlert('file-alert', networkErrorMessage(err), 'error');
    }
  });

  // ---- Albums ----
  let albumPhotoFiles = [];
  const albumPhotoInput = document.getElementById('album-photo-input');
  albumPhotoInput.addEventListener('change', function (e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const oversized = files.filter(f => f.size > 15 * 1024 * 1024);
    if (oversized.length > 0) {
      showAlert('album-alert', oversized.length + ' photo(s) are over the 25MB limit and were not added: ' + oversized.map(f => f.name).join(', '), 'error');
    }
    const validFiles = files.filter(f => f.size <= 15 * 1024 * 1024);

    albumPhotoFiles = albumPhotoFiles.concat(validFiles);
    renderAlbumPhotoPicker();
    albumPhotoInput.value = '';
  });

  function renderAlbumPhotoPicker() {
    const picker = document.getElementById('album-photo-picker');
    Promise.all(albumPhotoFiles.map(file => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    }))).then((dataUrls) => {
      picker.innerHTML = dataUrls.map((p, idx) =>
        '<div class="photo-picker-item"><img src="' + p + '"><button type="button" onclick="window._removeAlbumPhoto(' + idx + ')">X</button></div>'
      ).join('');
      const countEl = document.getElementById('album-photo-count');
      if (countEl) countEl.textContent = albumPhotoFiles.length + ' photo(s) selected';
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
      showAlert('album-alert', 'Photo album "' + title + '" published with ' + albumPhotoFiles.length + ' photo(s).', 'success');
      albumForm.reset(); albumPhotoFiles = []; renderAlbumPhotoPicker();
      loadAdminAlbumTable();
    } catch (err) {
      showAlert('album-alert', networkErrorMessage(err), 'error');
    }
  });

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
          application.nicNumber
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
            '</td>' +

            '<td>' +
            escapeHtml(application.nicNumber) +
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
            'SLNA-' +
            selectedApplication.membershipNumber +
            '-' +
            String(
                selectedApplication.nameWithInitials ||
                selectedApplication.fullName
            )
                .replace(/\./g, '')
                .trim()
                .replace(/\s+/g, '-') +
            '.pdf';

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

        const contentDisposition = response.headers.get(
            'Content-Disposition'
        );

        let filename =
            selectedApplication.membershipNumber +
            '-' +
            String(
                selectedApplication.nameWithInitials ||
                selectedApplication.fullName
            )
                .replace(/\./g, '')
                .replace(/\s+/g, '') +
            '-ID-Photo.jpg';

        if (contentDisposition) {
          const match = contentDisposition.match(
              /filename="?([^"]+)"?/i
          );

          if (match && match[1]) {
            filename = match[1];
          }
        }

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
  el.innerHTML = '<div class="alert alert-' + type + '">' + message + '</div>';
  setTimeout(() => { el.innerHTML = ''; }, 6000);
}

async function loadAdminNewsTable() {
  const tbody = document.getElementById('news-table-body');
  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/news');
    if (!res.ok) throw new Error('bad status');
    const items = await res.json();
    if (items.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">No news items yet.</td></tr>'; return; }
    const apiOrigin = SLNA_CONFIG.API_BASE_URL.replace('/api', '');
    tbody.innerHTML = items.map(item => {
      const badgeClass = item.source === 'file' ? 'badge-file' : 'badge-typed';
      const badgeLabel = item.source === 'file' ? 'FILE UPLOAD' : 'TYPED';
      const thumb = item.photo_url ? '<img src="' + apiOrigin + item.photo_url + '" class="thumb-preview" style="width:40px;height:40px;">' : '-';
      return '<tr><td>' + thumb + '</td><td>' + item.title + '</td><td>' + item.event_date + '</td><td><span class="badge-source ' + badgeClass + '">' + badgeLabel + '</span></td><td>' + (item.file_name || '-') + '</td><td><button class="btn btn-danger btn-sm" onclick="handleDeleteNews(' + item.id + ')">Delete</button></td></tr>';
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#c0392b;">Could not load news. Is the backend server running?</td></tr>';
  }
}

async function handleDeleteNews(id) {
  if (!confirm('Delete this news item?')) return;
  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/news/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + getToken() },
    });
    if (!res.ok) { alert('Could not delete this item. It may have already been removed.'); return; }
    loadAdminNewsTable();
  } catch (err) {
    alert('Could not reach the server. Please check that the backend is running.');
  }
}

async function loadAdminAlbumTable() {
  const tbody = document.getElementById('album-table-body');
  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/albums');
    if (!res.ok) throw new Error('bad status');
    const albums = await res.json();
    if (albums.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#888;">No albums yet.</td></tr>'; return; }
    const apiOrigin = SLNA_CONFIG.API_BASE_URL.replace('/api', '');
    tbody.innerHTML = albums.map(album => {
      const thumb = album.cover_photo ? '<img src="' + apiOrigin + album.cover_photo + '" class="thumb-preview" style="width:40px;height:40px;">' : '-';
      return '<tr><td>' + thumb + '</td><td>' + album.title + '</td><td>' + album.photo_count + ' photos</td><td><button class="btn btn-danger btn-sm" onclick="handleDeleteAlbum(' + album.id + ')">Delete</button></td></tr>';
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#c0392b;">Could not load albums. Is the backend server running?</td></tr>';
  }
}

async function handleDeleteAlbum(id) {
  if (!confirm('Delete this album?')) return;
  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/albums/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + getToken() },
    });
    if (!res.ok) { alert('Could not delete this album. It may have already been removed.'); return; }
    loadAdminAlbumTable();
  } catch (err) {
    alert('Could not reach the server. Please check that the backend is running.');
  }
}
