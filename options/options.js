document.addEventListener('DOMContentLoaded', async () => {
  await loadSavedSettings();
  setupListeners();
});

async function loadSavedSettings() {
  const s = await chrome.storage.local.get(['baseUrl', 'apiKey', 'model', 'maxTokens']);
  if (s.baseUrl)    document.getElementById('baseUrl').value    = s.baseUrl;
  if (s.apiKey)     document.getElementById('apiKey').value     = s.apiKey;
  if (s.model)      document.getElementById('model').value      = s.model;
  if (s.maxTokens)  document.getElementById('maxTokens').value  = s.maxTokens;
}

function setupListeners() {
  document.getElementById('saveBtn').addEventListener('click',   saveSettings);
  document.getElementById('testBtn').addEventListener('click',   testConnection);
  document.getElementById('clearBtn').addEventListener('click',  clearSettings);
  document.getElementById('toggleKey').addEventListener('click', toggleKey);
}

async function saveSettings() {
  const baseUrl   = document.getElementById('baseUrl').value.trim();
  const apiKey    = document.getElementById('apiKey').value.trim();
  const model     = document.getElementById('model').value.trim() || 'gpt-3.5-turbo';
  const maxTokens = parseInt(document.getElementById('maxTokens').value) || 2000;

  if (!baseUrl) { showStatus('Base URL을 입력하세요.', 'error'); return; }
  if (!apiKey)  { showStatus('API Key를 입력하세요.', 'error'); return; }

  try { new URL(baseUrl); } catch {
    showStatus('올바른 URL 형식이 아닙니다. 예: http://server:8000', 'error');
    return;
  }

  await chrome.storage.local.set({ baseUrl, apiKey, model, maxTokens });
  showStatus('✓ 설정이 저장되었습니다.', 'success');
}

async function testConnection() {
  const baseUrl = document.getElementById('baseUrl').value.trim();
  const apiKey  = document.getElementById('apiKey').value.trim();
  const model   = document.getElementById('model').value.trim() || 'gpt-3.5-turbo';

  if (!baseUrl || !apiKey) {
    showStatus('Base URL과 API Key를 먼저 입력하세요.', 'error');
    return;
  }

  showStatus('연결 테스트 중...', 'info');

  try {
    const normalized = baseUrl.replace(/\/+$/, '');
    const endpoint   = normalized.endsWith('/v1')
      ? `${normalized}/chat/completions`
      : `${normalized}/v1/chat/completions`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
        stream: false
      })
    });

    if (res.ok) {
      showStatus('✓ 연결 성공! API가 정상적으로 응답합니다.', 'success');
    } else {
      let detail = res.statusText;
      try {
        const j = await res.json();
        detail = j?.error?.message || detail;
      } catch {}
      showStatus(`✗ 연결 실패 (${res.status}): ${detail}`, 'error');
    }
  } catch (err) {
    showStatus(`✗ 연결 오류: ${err.message}`, 'error');
  }
}

async function clearSettings() {
  if (!confirm('모든 설정을 초기화하시겠습니까?')) return;
  await chrome.storage.local.clear();
  ['baseUrl', 'apiKey', 'model', 'maxTokens'].forEach(id => {
    document.getElementById(id).value = '';
  });
  showStatus('설정이 초기화되었습니다.', 'info');
}

function toggleKey() {
  const input = document.getElementById('apiKey');
  const btn   = document.getElementById('toggleKey');
  if (input.type === 'password') {
    input.type       = 'text';
    btn.textContent  = '🙈';
  } else {
    input.type       = 'password';
    btn.textContent  = '👁';
  }
}

function showStatus(msg, type) {
  const el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.className   = `status-msg ${type}`;
  el.classList.remove('hidden');
  if (type === 'success') setTimeout(() => el.classList.add('hidden'), 3500);
}
