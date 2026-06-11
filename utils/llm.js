export async function loadSettings() {
  return new Promise(resolve => {
    chrome.storage.local.get(['baseUrl', 'apiKey', 'model', 'maxTokens'], resolve);
  });
}

export async function callLLM(messages, settings) {
  const { baseUrl, apiKey, model, maxTokens } = settings;

  if (!baseUrl || !apiKey) {
    throw new Error('API 설정이 없습니다. ⚙ 버튼을 눌러 Base URL과 API Key를 입력하세요.');
  }

  const normalized = baseUrl.replace(/\/+$/, '');
  const endpoint = normalized.endsWith('/v1')
    ? `${normalized}/chat/completions`
    : `${normalized}/v1/chat/completions`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo',
        messages,
        max_tokens: parseInt(maxTokens) || 2000,
        temperature: 0.3,
        stream: false
      })
    });
  } catch (err) {
    throw new Error(`서버 연결 실패: ${err.message}`);
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errData = await response.json();
      detail = errData?.error?.message || detail;
    } catch {}
    throw new Error(`LLM API 오류 (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('LLM에서 유효한 응답을 받지 못했습니다.');
  }

  return content;
}
