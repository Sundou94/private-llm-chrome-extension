import { callLLM, loadSettings } from '../utils/llm.js';
import { chunkText, retrieveRelevantChunks } from '../utils/rag.js';
import { htmlToMarkdown } from '../utils/markdown.js';

// ── State ──────────────────────────────────────────────────────────────────
let settings = {};
let cachedContent = null;
let cachedChunks  = null;
let _summarizeTimer = null;

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  settings = await loadSettings();
  renderApiStatus();
  setupTabs();
  setupButtons();
});

// ── API status bar ─────────────────────────────────────────────────────────
function renderApiStatus() {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (settings.baseUrl && settings.apiKey) {
    dot.className    = 'status-dot ok';
    text.textContent = `연결됨: ${settings.model || 'gpt-3.5-turbo'}`;
  } else {
    dot.className    = 'status-dot error';
    text.textContent = 'API 미설정 — ⚙ 버튼을 눌러 설정하세요';
  }
}

// ── Tabs ───────────────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });
}

// ── Button wiring ──────────────────────────────────────────────────────────
function setupButtons() {
  document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 사이드 패널 고정 버튼
  document.getElementById('pinBtn')?.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.sidePanel.open({ windowId: tab.windowId });
      window.close();
    } catch (err) {
      console.error('사이드 패널 오류:', err);
    }
  });

  document.getElementById('summarizeBtn').addEventListener('click', handleSummarize);

  document.getElementById('askBtn').addEventListener('click', handleAsk);
  document.getElementById('questionInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); }
  });

  document.getElementById('exportBtn').addEventListener('click', handleExport);
}

// ── Content extraction ─────────────────────────────────────────────────────
async function getContent() {
  if (cachedContent) return cachedContent;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('현재 탭 정보를 가져올 수 없습니다.');

  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractFn
    });
  } catch {
    throw new Error('이 페이지에서는 내용을 추출할 수 없습니다. (chrome:// 또는 확장 페이지)');
  }

  const content = results?.[0]?.result;
  if (!content?.textContent) throw new Error('페이지에서 텍스트를 추출할 수 없습니다.');

  cachedContent = content;
  return cachedContent;
}

// 페이지 컨텍스트에서 실행되는 함수 — 외부 참조 불가
function extractFn() {
  const title      = document.title || '';
  const url        = location.href;
  const metaDesc   = document.querySelector('meta[name="description"]');
  const description = metaDesc?.content || '';

  const selectors = [
    'main', 'article', '[role="main"]',
    '#content', '#main', '.content',
    '.post-content', '.article-body', '.entry-content'
  ];
  let root = null;
  for (const sel of selectors) {
    root = document.querySelector(sel);
    if (root) break;
  }
  if (!root) root = document.body;

  const htmlContent = root.innerHTML;

  function getText(el) {
    let t = '';
    for (const node of el.childNodes) {
      if (node.nodeType === 3) {
        t += node.textContent;
      } else if (node.nodeType === 1) {
        const tag = node.tagName.toLowerCase();
        if (['script','style','noscript','nav','footer','aside','button','select','form'].includes(tag)) continue;
        const block = ['p','div','h1','h2','h3','h4','h5','h6','li','tr','dd','dt','blockquote','pre'].includes(tag);
        t += (block ? '\n' : '') + getText(node) + (block ? '\n' : '');
      }
    }
    return t;
  }

  const textContent = getText(root).replace(/\n{3,}/g, '\n\n').trim();
  return { title, url, description, htmlContent, textContent };
}

// ── 요약 인라인 타이머 ─────────────────────────────────────────────────────
function startSummarizeTimer() {
  const start     = Date.now();
  const labelEl   = document.getElementById('summarizeLabel');
  const loaderEl  = document.getElementById('summarizeLoader');
  const timerEl   = document.getElementById('summarizeTimer');

  labelEl.classList.add('hidden');
  loaderEl.classList.remove('hidden');
  timerEl.textContent = '(생각중.. 0초)';

  _summarizeTimer = setInterval(() => {
    const secs = Math.floor((Date.now() - start) / 1000);
    timerEl.textContent = `(생각중.. ${secs}초)`;
  }, 500);
}

function stopSummarizeTimer() {
  clearInterval(_summarizeTimer);
  _summarizeTimer = null;
  document.getElementById('summarizeLabel')?.classList.remove('hidden');
  document.getElementById('summarizeLoader')?.classList.add('hidden');
  document.getElementById('summarizeTimer').textContent = '(생각중.. 0초)';
}

// ── Summarize ──────────────────────────────────────────────────────────────
async function handleSummarize() {
  const btn    = document.getElementById('summarizeBtn');
  const result = document.getElementById('summaryResult');
  const errBox = document.getElementById('summaryError');

  result.classList.add('hidden');
  errBox.classList.add('hidden');
  btn.disabled = true;
  startSummarizeTimer();          // ← 버튼 내 인라인 타이머 시작

  try {
    const content = await getContent();
    const maxChars = 6000;
    const body = content.textContent.length > maxChars
      ? content.textContent.slice(0, maxChars) + '\n\n...(이하 생략)'
      : content.textContent;

    const summary = await callLLM([
      {
        role: 'system',
        content: '당신은 웹페이지 내용을 명확하고 구조적으로 요약하는 어시스턴트입니다. 한국어로 답변하세요.'
      },
      {
        role: 'user',
        content: `다음 웹페이지를 핵심만 간결하게 요약해주세요.\n\n제목: ${content.title}\n\n내용:\n${body}`
      }
    ], settings);

    result.textContent = summary;
    result.classList.remove('hidden');
    addCopyBtn(result, summary);
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove('hidden');
  } finally {
    stopSummarizeTimer();          // ← 버튼 텍스트 복원
    btn.disabled = false;
  }
}

// ── Q&A (RAG) ──────────────────────────────────────────────────────────────
async function handleAsk() {
  const input    = document.getElementById('questionInput');
  const askBtn   = document.getElementById('askBtn');
  const errBox   = document.getElementById('qaError');
  const question = input.value.trim();
  if (!question) return;

  errBox.classList.add('hidden');
  askBtn.disabled = true;
  input.disabled  = true;
  showLoading('질문 처리 중...');

  try {
    const content = await getContent();

    if (!cachedChunks) {
      cachedChunks = chunkText(content.textContent);
    }

    updateLoading('관련 내용 검색 중...');
    const relevant = retrieveRelevantChunks(question, cachedChunks);
    const context  = relevant.join('\n\n---\n\n');

    updateLoading('LLM 응답 대기 중...');
    const answer = await callLLM([
      {
        role: 'system',
        content: '당신은 제공된 문서 내용만을 바탕으로 질문에 답변하는 어시스턴트입니다. 문서에 없는 내용은 "해당 내용을 문서에서 찾을 수 없습니다"라고 답변하세요. 한국어로 답변하세요.'
      },
      {
        role: 'user',
        content: `[관련 문서 내용]\n${context}\n\n[질문]\n${question}`
      }
    ], settings);

    addChatItem(question, answer);
    input.value = '';
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove('hidden');
  } finally {
    hideLoading();
    askBtn.disabled = false;
    input.disabled  = false;
    input.focus();
  }
}

function addChatItem(question, answer) {
  const history = document.getElementById('chatHistory');
  const item = document.createElement('div');
  item.className = 'chat-item';

  const q = document.createElement('div');
  q.className   = 'chat-q';
  q.textContent = question;

  const a = document.createElement('div');
  a.className   = 'chat-a';
  a.textContent = answer;

  item.appendChild(q);
  item.appendChild(a);
  history.prepend(item);
}

// ── Export ─────────────────────────────────────────────────────────────────
async function handleExport() {
  const btn      = document.getElementById('exportBtn');
  const resultEl = document.getElementById('exportResult');
  const errBox   = document.getElementById('exportError');

  resultEl.classList.add('hidden');
  errBox.classList.add('hidden');
  btn.disabled = true;
  showLoading('Markdown 변환 중...');

  try {
    const content  = await getContent();
    const withMeta = document.getElementById('includeMetadata').checked;

    let md = '';
    if (withMeta) {
      const now = new Date().toLocaleString('ko-KR');
      md += `---\ntitle: ${content.title}\nurl: ${content.url}\nexported: ${now}\n---\n\n`;
    }
    md += htmlToMarkdown(content.htmlContent, content.title, content.url);

    const filename = (content.title || 'page')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 100) + '.md';

    const blob    = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    await chrome.downloads.download({ url: blobUrl, filename, saveAs: false });
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

    resultEl.className   = 'success-msg';
    resultEl.textContent = `✓ "${filename}" 파일이 다운로드 폴더에 저장되었습니다.`;
    resultEl.classList.remove('hidden');
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove('hidden');
  } finally {
    hideLoading();
    btn.disabled = false;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function showLoading(text) {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('loadingText').textContent = text || '처리 중...';
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

function updateLoading(text) {
  document.getElementById('loadingText').textContent = text;
}

function addCopyBtn(container, text) {
  container.querySelector('.copy-btn')?.remove();
  const btn = document.createElement('button');
  btn.className   = 'copy-btn';
  btn.textContent = '📋 복사';
  btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(text);
    btn.textContent = '✓ 복사됨';
    setTimeout(() => { btn.textContent = '📋 복사'; }, 1500);
  });
  container.appendChild(btn);
}
