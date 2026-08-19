const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const loginView = $('#login-view');
const appView = $('#app-view');

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 3200);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    credentials: 'same-origin',
    ...opts,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function nameOf(u) {
  if (!u) return '—';
  if (u.username) return `@${u.username}`;
  return u.first_name || String(u.id);
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  } catch {
    return iso;
  }
}

async function showApp() {
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  await loadTab('dashboard');
}

function showLogin() {
  appView.classList.add('hidden');
  loginView.classList.remove('hidden');
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    await api('/api/login', {
      method: 'POST',
      body: { password: $('#password').value },
    });
    await showApp();
  } catch (err) {
    $('#login-error').textContent = err.message;
  }
});

$('#logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  showLogin();
});

$$('#nav button').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('#nav button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    $$('.tab').forEach((t) => t.classList.add('hidden'));
    $(`#tab-${tab}`).classList.remove('hidden');
    loadTab(tab);
  });
});

async function loadTab(tab) {
  try {
    if (tab === 'dashboard') await loadDashboard();
    if (tab === 'review') await loadReview();
    if (tab === 'users') await loadUsers();
    if (tab === 'ranking') await loadRanking();
    if (tab === 'tasks') await loadTasks();
    if (tab === 'onboarding') await loadOnboarding();
    if (tab === 'ledger') await loadLedger();
    if (tab === 'settings') await loadSettings();
    if (tab === 'broadcast') await previewBroadcastCount();
    if (tab === 'promo') await loadPromo();
  } catch (err) {
    toast(err.message);
    if (err.message === 'unauthorized') showLogin();
  }
}

async function loadDashboard() {
  const d = await api('/api/dashboard');
  $('#dash-cards').innerHTML = [
    ['Участников', d.users],
    ['В канале', d.joined],
    ['На проверке', d.pending],
    ['Активных заданий', d.tasks],
  ]
    .map(
      ([lbl, val]) =>
        `<div class="card"><div class="val">${val}</div><div class="lbl">${lbl}</div></div>`,
    )
    .join('');
  const s = d.settings;
  $('#dash-settings').textContent = s
    ? `Старт: ${fmtDate(s.marathon_start_at)} · channel ${s.channel_id} · discussion ${s.discussion_group_id}`
    : 'Настройки не найдены';
  const badge = $('#badge-pending');
  if (d.pending > 0) {
    badge.textContent = d.pending;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

$('#review-status').addEventListener('change', () => loadReview());

const hiddenReviewIds = new Set();

async function loadReview() {
  const status = $('#review-status').value;
  const { submissions } = await api(`/api/submissions?status=${status}`);
  const box = $('#review-list');

  const visible = submissions.filter((s) => !hiddenReviewIds.has(s.id));
  const hiddenCount = submissions.length - visible.length;

  if (!visible.length) {
    box.innerHTML = submissions.length
      ? `<div class="panel muted">Все скрыты (${hiddenCount}). <button class="sm ghost" id="review-show-all">Показать все</button></div>`
      : `<div class="panel muted">Пусто</div>`;
    const showAll = $('#review-show-all');
    if (showAll) showAll.addEventListener('click', () => { hiddenReviewIds.clear(); loadReview(); });
    return;
  }

  box.innerHTML = (hiddenCount > 0
    ? `<div class="panel muted" style="margin-bottom:8px">Скрыто: ${hiddenCount} · <button class="sm ghost" id="review-show-all">Показать все</button></div>`
    : '') + visible
    .map((s) => {
      const task = s.tasks || {};
      const user = s.users || {};
      const actions =
        s.status === 'pending'
          ? `<div class="actions">
              <button class="sm ok" data-act="approve3" data-id="${s.id}">+3</button>
              <button class="sm ok" data-act="approve10" data-id="${s.id}">+10</button>
              <button class="sm ok" data-act="approve20" data-id="${s.id}">+20</button>
              <button class="sm ok" data-act="approve40" data-id="${s.id}">+40</button>
              <button class="sm danger" data-act="reject" data-id="${s.id}">На доработку</button>
              <button class="sm ghost" data-act="hide" data-id="${s.id}">Скрыть</button>
            </div>`
          : `<p class="muted tiny">${s.status}${s.points_awarded != null ? ` · +${s.points_awarded}` : ''}</p>`;
      return `<article class="item" data-item-id="${s.id}">
        <div class="item-head">
          <div>
            <strong>${task.label || 'Задание'} — ${task.description || ''}</strong>
            <div class="muted tiny">${nameOf(user)} · id ${s.user_id} · ${fmtDate(s.submitted_at)}</div>
          </div>
          <a class="mono muted" href="${task.channel_post_link || '#'}" target="_blank" rel="noopener">пост</a>
        </div>
        <div class="comment">${escapeHtml(s.comment_text || '')}</div>
        ${actions}
      </article>`;
    })
    .join('');

  const showAll = $('#review-show-all');
  if (showAll) showAll.addEventListener('click', () => { hiddenReviewIds.clear(); loadReview(); });

  box.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const action = btn.dataset.act;

      if (action === 'hide') {
        hiddenReviewIds.add(id);
        btn.closest('article').remove();
        const remaining = box.querySelectorAll('article').length;
        if (remaining === 0) loadReview();
        return;
      }

      let feedback = null;
      if (action === 'reject') {
        feedback = prompt('Комментарий для участника (необязательно):') || null;
      }
      try {
        await api(`/api/submissions/${id}/review`, {
          method: 'POST',
          body: { action, feedback },
        });
        toast('Сохранено');
        hiddenReviewIds.delete(id);
        await loadReview();
        await loadDashboard();
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let usersTimer;
$('#users-q').addEventListener('input', () => {
  clearTimeout(usersTimer);
  usersTimer = setTimeout(() => loadUsers(), 250);
});

async function loadUsers() {
  const q = $('#users-q').value.trim();
  const { users } = await api(`/api/users?q=${encodeURIComponent(q)}`);
  $('#users-tbody').innerHTML = users
    .map(
      (u) => `<tr>
      <td class="mono">${u.id}</td>
      <td>${escapeHtml(nameOf(u))}</td>
      <td class="mono">${u.total_points}</td>
      <td>${u.joined_channel_at ? '✅ ' + fmtDate(u.joined_channel_at) : '—'}</td>
      <td class="mono">${u.onboarding_step}</td>
      <td class="actions">
        <button class="sm" data-points="${u.id}">± баллы</button>
        <button class="sm ghost" data-join="${u.id}" data-joined="${u.joined_channel_at ? '1' : '0'}">
          ${u.joined_channel_at ? 'Снять канал' : 'Отметить канал'}
        </button>
      </td>
    </tr>`,
    )
    .join('');

  $$('#users-tbody [data-points]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const raw = prompt('Начислить баллов (можно отрицательное):');
      if (raw == null || raw === '') return;
      const points = Number(raw);
      if (!Number.isInteger(points) || points === 0) {
        toast('Нужно целое ≠ 0');
        return;
      }
      try {
        const r = await api(`/api/users/${btn.dataset.points}/points`, {
          method: 'POST',
          body: { points },
        });
        toast(`Новый баланс: ${r.newTotal}`);
        await loadUsers();
      } catch (err) {
        toast(err.message);
      }
    });
  });

  $$('#users-tbody [data-join]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const joined = btn.dataset.joined !== '1';
      try {
        await api(`/api/users/${btn.dataset.join}/joined`, {
          method: 'POST',
          body: { joined },
        });
        await loadUsers();
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

async function loadRanking() {
  const { ranking } = await api('/api/ranking');
  $('#ranking-tbody').innerHTML = ranking
    .map(
      (u) => `<tr>
      <td class="mono">${u.rank}</td>
      <td>${escapeHtml(nameOf(u))}</td>
      <td class="mono">${u.total_points}</td>
      <td>${u.joined_channel_at ? '✅' : '—'}</td>
    </tr>`,
    )
    .join('');
}

let tasksHidePending = false;

async function loadTasks() {
  const { tasks } = await api('/api/tasks');
  const filterBtn = $('#tasks-filter-btn');
  if (filterBtn) {
    filterBtn.textContent = tasksHidePending
      ? 'Показать все задания'
      : 'Скрыть задания на проверке';
    filterBtn.classList.toggle('ghost', !tasksHidePending);
  }

  const visible = tasksHidePending ? tasks.filter((t) => t.pending_count === 0) : tasks;

  $('#tasks-list').innerHTML = visible
    .map(
      (t) => `<article class="item">
      <div class="item-head">
        <div>
          <strong>${t.label}</strong> · ${t.type === 'pre' ? 'ПДЗ' : 'ДЗ'}
          ${t.is_active ? '' : ' · <span class="error">выкл</span>'}
          ${t.pending_count > 0 ? ` · <span class="badge" style="background:var(--warning,#f59e0b)">${t.pending_count} на проверке</span>` : ''}
          <div class="muted">${escapeHtml(t.description)}</div>
          <div class="mono muted tiny">msg ${t.channel_message_id} · disc ${t.discussion_message_id ?? '—'}</div>
        </div>
        <a href="${t.channel_post_link}" target="_blank" rel="noopener">пост</a>
      </div>
      <div class="actions">
        <button class="sm ghost" data-toggle="${t.id}" data-active="${t.is_active ? '1' : '0'}">
          ${t.is_active ? 'Выключить' : 'Включить'}
        </button>
      </div>
    </article>`,
    )
    .join('');

  $$('#tasks-list [data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/api/tasks/${btn.dataset.toggle}`, {
          method: 'PATCH',
          body: { is_active: btn.dataset.active !== '1' },
        });
        await loadTasks();
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

$('#task-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  $('#task-form-msg').textContent = '';
  try {
    const r = await api('/api/tasks', {
      method: 'POST',
      body: {
        type: fd.get('type'),
        description: fd.get('description'),
        channel_post_link: fd.get('channel_post_link'),
      },
    });
    $('#task-form-msg').textContent = `Создано: ${r.task.label}`;
    e.target.reset();
    await loadTasks();
  } catch (err) {
    $('#task-form-msg').textContent = err.message;
  }
});

$('#bcast-audience').addEventListener('change', () => {
  const v = $('#bcast-audience').value;
  $('#bcast-n-wrap').classList.toggle('hidden', v === 'all');
});

async function previewBroadcastCount() {
  const audience = $('#bcast-audience').value;
  const n = Number($('#broadcast-form [name=n]').value || 0);
  try {
    const r = await api('/api/broadcast/preview-count', {
      method: 'POST',
      body: { audience, n },
    });
    $('#bcast-count').textContent = r.count;
  } catch {
    $('#bcast-count').textContent = '—';
  }
}

$('#bcast-preview').addEventListener('click', previewBroadcastCount);

$('#broadcast-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!confirm('Запустить рассылку?')) return;
  const form = e.target;
  const fd = new FormData(form);
  $('#bcast-msg').textContent = 'Отправка…';
  try {
    const res = await fetch('/api/broadcast', {
      method: 'POST',
      credentials: 'same-origin',
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    $('#bcast-msg').textContent =
      `Запущено для ${data.total} получателей` +
      (data.withPhoto ? ' (с картинкой)' : '') +
      '. Итог — в консоли сервера админки.';
    toast('Рассылка запущена');
    form.reset();
    $('#bcast-n-wrap').classList.add('hidden');
  } catch (err) {
    $('#bcast-msg').textContent = err.message;
  }
});

async function loadOnboarding() {
  const { messages } = await api('/api/onboarding');
  $('#onboarding-list').innerHTML = messages
    .map(
      (m) => `<article class="item" data-ob="${m.id}">
      <div class="item-head">
        <strong>Шаг ${m.step_order}</strong>
        <span class="muted tiny">delay ${m.delay_seconds}с · ${m.media_type || 'текст'}${m.only_if_not_joined ? ' · только без канала' : ''}</span>
      </div>
      <label class="muted">Текст (HTML)
        <textarea rows="6">${escapeHtml(m.text)}</textarea>
      </label>
      <div class="actions" style="align-items:end">
        <label class="muted">Задержка, сек
          <input type="number" class="ob-delay" value="${m.delay_seconds}" style="width:100px" />
        </label>
        <label class="muted" style="display:flex;gap:8px;align-items:center">
          <input type="checkbox" class="ob-gate" ${m.only_if_not_joined ? 'checked' : ''} />
          Не слать, если уже в канале
        </label>
        <button class="sm" data-save-ob="${m.id}">Сохранить</button>
      </div>
    </article>`,
    )
    .join('');

  $$('[data-save-ob]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.item');
      try {
        await api(`/api/onboarding/${btn.dataset.saveOb}`, {
          method: 'PATCH',
          body: {
            text: $('textarea', card).value,
            delay_seconds: Number($('.ob-delay', card).value),
            only_if_not_joined: $('.ob-gate', card).checked,
          },
        });
        toast('Шаг сохранён');
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

let ledgerTimer;
$('#ledger-user').addEventListener('input', () => {
  clearTimeout(ledgerTimer);
  ledgerTimer = setTimeout(() => loadLedger(), 250);
});

async function loadLedger() {
  const userId = $('#ledger-user').value.trim();
  const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  const { ledger } = await api(`/api/ledger${qs}`);
  $('#ledger-tbody').innerHTML = ledger
    .map(
      (r) => `<tr>
      <td class="mono">${fmtDate(r.created_at)}</td>
      <td class="mono">${r.user_id}</td>
      <td class="mono">${r.points > 0 ? '+' : ''}${r.points}</td>
      <td>${r.reason}</td>
      <td class="mono">${r.admin_id ?? '—'}</td>
    </tr>`,
    )
    .join('');
}

async function loadSettings() {
  const { settings } = await api('/api/settings');
  if (!settings) return;
  const form = $('#settings-form');
  form.marathon_start_at.value = settings.marathon_start_at || '';
  form.channel_id.value = settings.channel_id || '';
  form.discussion_group_id.value = settings.discussion_group_id || '';
  form.channel_invite_link.value = settings.channel_invite_link || '';
}

$('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await api('/api/settings', {
      method: 'PUT',
      body: {
        marathon_start_at: fd.get('marathon_start_at'),
        channel_id: fd.get('channel_id'),
        discussion_group_id: fd.get('discussion_group_id'),
        channel_invite_link: fd.get('channel_invite_link'),
      },
    });
    $('#settings-msg').textContent = 'Сохранено';
    toast('Настройки обновлены');
  } catch (err) {
    $('#settings-msg').textContent = err.message;
  }
});

// ── Промо-коды ───────────────────────────────────────────────────────────────

async function loadPromo() {
  const { codes } = await api('/api/promo-codes');
  const box = $('#promo-list');
  if (!codes.length) {
    box.innerHTML = '<div class="panel muted">Промо-кодов пока нет</div>';
  } else {
    box.innerHTML = codes
      .map(
        (c) => `<article class="item">
        <div class="item-head">
          <div>
            <strong class="mono">${escapeHtml(c.code)}</strong>
            &nbsp;·&nbsp;<span class="ok">+${c.points} баллов</span>
            ${!c.is_active ? ' · <span class="error">выкл</span>' : ''}
          </div>
          <div class="muted tiny">
            Использований: ${c.used_count}${c.max_uses > 0 ? ' / ' + c.max_uses : ' (∞)'}
          </div>
        </div>
        <div class="actions">
          <button class="sm ghost" data-promo-toggle="${c.id}" data-active="${c.is_active ? '1' : '0'}">
            ${c.is_active ? 'Выключить' : 'Включить'}
          </button>
          <button class="sm danger" data-promo-del="${c.id}">Удалить</button>
        </div>
      </article>`,
      )
      .join('');
  }

  $$('[data-promo-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await api(`/api/promo-codes/${btn.dataset.promoToggle}`, {
          method: 'PATCH',
          body: { is_active: btn.dataset.active !== '1' },
        });
        await loadPromo();
      } catch (err) {
        toast(err.message);
      }
    });
  });

  $$('[data-promo-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Удалить этот промо-код?')) return;
      try {
        await api(`/api/promo-codes/${btn.dataset.promoDel}`, { method: 'DELETE' });
        toast('Удалено');
        await loadPromo();
      } catch (err) {
        toast(err.message);
      }
    });
  });
}

$('#promo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  $('#promo-form-msg').textContent = '';
  const code = String(fd.get('code') || '').trim();
  const points = Number(fd.get('points'));
  const maxUses = Number(fd.get('max_uses') || 0);
  if (!code || /\s/.test(code)) {
    $('#promo-form-msg').textContent = 'Ключ — одно слово без пробелов';
    return;
  }
  if (!Number.isInteger(points) || points <= 0) {
    $('#promo-form-msg').textContent = 'Баллы — целое > 0';
    return;
  }
  try {
    const r = await api('/api/promo-codes', {
      method: 'POST',
      body: { code, points, max_uses: maxUses },
    });
    $('#promo-form-msg').textContent = `Создан: ${r.code.code}`;
    e.target.reset();
    await loadPromo();
  } catch (err) {
    $('#promo-form-msg').textContent = err.message;
  }
});

// ── Tasks filter ──────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'tasks-filter-btn') {
    tasksHidePending = !tasksHidePending;
    loadTasks().catch(() => {});
  }
});

(async function init() {
  try {
    const me = await api('/api/me');
    if (me.authenticated) await showApp();
    else showLogin();
  } catch {
    showLogin();
  }
})();
