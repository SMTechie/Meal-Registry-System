// Lightweight users UI interactions: bulk selection, slide-over and QR regen
document.addEventListener('DOMContentLoaded', function () {
  const selectAll = document.getElementById('select-all');
  const rowSelects = Array.from(document.querySelectorAll('.row-select'));
  const bulkCount = document.getElementById('bulk-count');
  const slide = document.getElementById('user-slide');
  const slideClose = document.getElementById('slide-close');

  function updateBulkCount() {
    const selected = document.querySelectorAll('.row-select:checked').length;
    bulkCount.textContent = selected;
  }

  if (selectAll) {
    selectAll.addEventListener('change', function () {
      rowSelects.forEach(cb => cb.checked = selectAll.checked);
      updateBulkCount();
    });
  }

  rowSelects.forEach(cb => cb.addEventListener('change', updateBulkCount));

  // Slide-over: open when clicking on view profile (eye) icons
  document.querySelectorAll('.row-actions a[title="View profile"]').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const tr = btn.closest('tr');
      const userId = tr && tr.getAttribute('data-user-id');
      openSlide(userId, btn.href);
    });
  });

  function openSlide(userId, href) {
    if (!slide) return;
    slide.style.display = 'block';
    slide.setAttribute('aria-hidden', 'false');
    // fetch brief data for the slide (defer to server endpoint if available)
    fetch(href)
      .then(r => r.text())
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const main = doc.querySelector('.user-detail') || doc.querySelector('main') || doc.body;
        const content = document.getElementById('slide-content');
        const name = document.getElementById('slide-name');
        if (content) content.innerHTML = main.innerHTML;
        if (name) name.textContent = doc.querySelector('h1') ? doc.querySelector('h1').textContent : 'User';
        document.getElementById('slide-profile').setAttribute('href', href);
        document.getElementById('slide-edit').setAttribute('href', href.replace('/detail', '/edit'));
      })
      .catch(() => {
        const content = document.getElementById('slide-content');
        if (content) content.innerHTML = '<p class="muted-line">Failed to load details.</p>';
      });
  }

  if (slideClose) slideClose.addEventListener('click', function () {
    slide.style.display = 'none';
    slide.setAttribute('aria-hidden', 'true');
  });

  // Handle regenerate QR button: optimistic UI, POST to endpoint /users/<id>/regen_qr/
  document.querySelectorAll('button[data-action="regen"]').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const userId = btn.getAttribute('data-user');
      if (!confirm('Regenerate QR for this user? This will invalidate the previous credential.')) return;
      btn.disabled = true;
      fetch(`/users/${userId}/regen_qr/`, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
        .then(r => {
          if (!r.ok) throw new Error('Failed');
          return r.json();
        })
        .then(json => {
          // update the visible short code if provided
          const tr = document.querySelector(`tr[data-user-id="${userId}"]`);
          if (tr && json.short_code) {
            const strong = tr.querySelector('.code-bubble strong');
            if (strong) strong.textContent = json.short_code;
          }
          alert('QR regenerated');
        })
        .catch(() => alert('Failed to regenerate QR'))
        .finally(() => btn.disabled = false);
    });
  });
});
