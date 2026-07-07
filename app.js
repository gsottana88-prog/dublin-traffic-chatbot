const isGitHubPages = window.location.hostname.includes('github.io');
const API_BASE = isGitHubPages
  ? 'https://dublin-traffic-chatbot.vercel.app'
  : '';

const elements = {
  start: document.getElementById('start'),
  finish: document.getElementById('finish'),
  send: document.getElementById('send-btn'),
  messages: document.getElementById('messages'),
  typing: document.getElementById('typing'),
};

function validate() {
  elements.send.disabled = !elements.start.value.trim() || !elements.finish.value.trim();
}

elements.start.addEventListener('input', validate);
elements.finish.addEventListener('input', validate);

elements.send.addEventListener('click', handleSubmit);

elements.start.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') elements.finish.focus();
});
elements.finish.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !elements.send.disabled) handleSubmit();
});

async function handleSubmit() {
  const start = elements.start.value.trim();
  const finish = elements.finish.value.trim();
  if (!start || !finish) return;

  addMessage(start, finish, 'user');
  elements.send.disabled = true;
  showTyping();

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, finish }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server error (${res.status})`);
    }

    const data = await res.json();
    hideTyping();
    addMessage(data.advice || data.error || 'No advice returned.', '', 'bot', data.source);
  } catch (err) {
    hideTyping();
    addMessage(`Sorry, I couldn't get traffic advice right now. ${err.message}`, '', 'error');
  } finally {
    elements.send.disabled = false;
    validate();
  }
}

function addMessage(text, address, role, source) {
  const div = document.createElement('div');
  div.className = `message ${role === 'error' ? 'bot' : role}`;

  if (role === 'user') {
    div.innerHTML = `
      <div class="avatar">Y</div>
      <div class="bubble">
        <p><strong>From:</strong> ${escapeHtml(address.split('\n')[0])}</p>
        <p><strong>To:</strong> ${escapeHtml(address.split('\n')[1])}</p>
      </div>`;
  } else {
    div.innerHTML = `
      <div class="avatar">
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="#3b82f6"/><path d="M16 6c-5 0-9 4-9 9s4 9 9 9 9-4 9-9-4-9-9-9zm0 16c-3.9 0-7-3.1-7-7s3.1-7 7-7 7 3.1 7 7-3.1 7-7 7z" fill="#fff"/><path d="M16 10l-1.5 3H12l2 2.5L13 18l3-1.5L19 18l-1-2.5 2-2.5h-2.5z" fill="#fff"/></svg>
      </div>
      <div class="bubble ${role === 'error' ? 'error-bubble' : ''}">
        <p>${escapeHtml(text)}</p>
        ${source ? `<div class="data-source">${escapeHtml(source)}</div>` : ''}
      </div>`;
  }

  elements.messages.appendChild(div);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function showTyping() {
  elements.typing.classList.remove('hidden');
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function hideTyping() {
  elements.typing.classList.add('hidden');
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}
