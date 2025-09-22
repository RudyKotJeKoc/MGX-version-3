/**
 * Radio Adamowo - Komentarze (MVP, localStorage)
 * - Brak backendu; komentarze widoczne tylko lokalnie
 * - Walidacja anty-spam: min. 60s między wpisami, 5–200 znaków, duplikaty w oknie 15 min
 * - Sanitizacja: renderowanie przez textContent (bez HTML)
 */

const STORAGE_KEY = 'ra_comments';
const LAST_TS_KEY = 'ra_comments_last_ts';
const RATE_LIMIT_SECONDS = 60;
const DUPLICATE_WINDOW_MIN = 15;
const MAX_COMMENTS = 200;

/** @returns {Array<{id:string,author:string,message:string,timestamp:number}>} */
function loadComments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter(Boolean);
  } catch (e) {
    console.warn('Cannot parse comments from localStorage', e);
    return [];
  }
}

/** @param {Array} comments */
function saveComments(comments) {
  try {
    const sliced = comments.slice(0, MAX_COMMENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sliced));
  } catch (e) {
    console.warn('Cannot save comments to localStorage', e);
  }
}

function getLastSubmitTs() {
  const v = localStorage.getItem(LAST_TS_KEY);
  return v ? Number(v) : 0;
}

function setLastSubmitTs(ts) {
  localStorage.setItem(LAST_TS_KEY, String(ts));
}

function trim(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function now() {
  return Date.now();
}

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function showError(msgEl, msg) {
  msgEl.textContent = msg;
  msgEl.classList.remove('hidden');
}

function clearError(msgEl) {
  msgEl.textContent = '';
  msgEl.classList.add('hidden');
}

/** @param {HTMLUListElement} listEl */
function renderComments(listEl, comments) {
  listEl.setAttribute('aria-busy', 'true');
  listEl.innerHTML = '';

  const sorted = [...comments].sort((a, b) => b.timestamp - a.timestamp);
  for (const c of sorted) {
    const li = document.createElement('li');
    li.className = 'bg-gray-900 p-4 rounded border border-gray-700';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-2';

    const author = document.createElement('strong');
    author.className = 'text-amber-400';
    author.textContent = c.author;

    const time = document.createElement('time');
    time.className = 'text-xs text-gray-400';
    time.dateTime = new Date(c.timestamp).toISOString();
    time.textContent = formatDate(c.timestamp);

    header.appendChild(author);
    header.appendChild(time);

    const msg = document.createElement('p');
    msg.className = 'text-gray-200';
    msg.textContent = c.message;

    li.appendChild(header);
    li.appendChild(msg);
    listEl.appendChild(li);
  }

  listEl.setAttribute('aria-busy', 'false');
}

function generateId() {
  return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function isDuplicate(comments, author, message, ts) {
  const windowMs = DUPLICATE_WINDOW_MIN * 60 * 1000;
  const from = ts - windowMs;
  const targetMsg = message.toLowerCase();
  const targetAuthor = author.toLowerCase();
  return comments.some(
    c =>
      c.timestamp >= from &&
      c.author.toLowerCase() === targetAuthor &&
      c.message.toLowerCase() === targetMsg
  );
}

function attachAnalyticsHook(author, ts, message) {
  try {
    if (window.pluginManager && typeof window.pluginManager.executeHook === 'function') {
      window.pluginManager.executeHook('comment.added', {
        name: author,
        date: formatDate(ts),
        text: message
      });
    }
  } catch (e) {
    console.warn('Analytics hook for comment.added failed', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('comment-form');
  const listEl = document.getElementById('comments-list');
  const authorEl = document.getElementById('comment-author');
  const messageEl = document.getElementById('comment-message');
  const errorEl = document.getElementById('comment-error');

  if (!form || !listEl || !authorEl || !messageEl) {
    console.warn('Comments UI not found on this page');
    return;
  }

  let comments = loadComments();
  renderComments(listEl, comments);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError(errorEl);

    const author = trim(authorEl.value);
    const message = trim(messageEl.value);
    const ts = now();

    // Validation
    if (author.length < 2 || author.length > 32) {
      showError(errorEl, 'Imię/Nick powinien mieć 2–32 znaki.');
      authorEl.focus();
      return;
    }
    if (message.length < 5 || message.length > 200) {
      showError(errorEl, 'Treść powinna mieć 5–200 znaków.');
      messageEl.focus();
      return;
    }

    // Rate limit
    const lastTs = getLastSubmitTs();
    const diff = Math.floor((ts - lastTs) / 1000);
    if (diff < RATE_LIMIT_SECONDS) {
      showError(errorEl, `Zwolnij 🙂 Możesz dodać kolejny komentarz za ${RATE_LIMIT_SECONDS - diff}s.`);
      return;
    }

    // Duplicate
    if (isDuplicate(comments, author, message, ts)) {
      showError(errorEl, 'Wygląda na duplikat. Spróbuj sformułować myśl inaczej.');
      return;
    }

    // Save
    const newComment = { id: generateId(), author, message, timestamp: ts };
    comments = [newComment, ...comments].slice(0, MAX_COMMENTS);
    saveComments(comments);
    setLastSubmitTs(ts);

    // Render
    renderComments(listEl, comments);

    // Reset form
    form.reset();
    authorEl.blur();
    messageEl.blur();

    // Analytics/Notifications
    attachAnalyticsHook(author, ts, message);
  });
});