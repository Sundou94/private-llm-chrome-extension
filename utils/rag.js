export function chunkText(text, chunkSize = 400, overlap = 80) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chunks = [];
  if (words.length === 0) return chunks;

  let i = 0;
  while (i < words.length) {
    const end = Math.min(i + chunkSize, words.length);
    chunks.push(words.slice(i, end).join(' '));
    if (end === words.length) break;
    i += chunkSize - overlap;
  }
  return chunks;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

export function retrieveRelevantChunks(query, chunks, topK = 4) {
  if (chunks.length === 0) return [];
  if (chunks.length <= topK) return chunks;

  const docCount = chunks.length;
  const chunkTokens = chunks.map(tokenize);

  const df = {};
  for (const tokens of chunkTokens) {
    for (const token of new Set(tokens)) {
      df[token] = (df[token] || 0) + 1;
    }
  }

  function toVec(tokens) {
    const tf = {};
    for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
    const vec = {};
    for (const [t, c] of Object.entries(tf)) {
      const idf = Math.log((docCount + 1) / ((df[t] || 0) + 1)) + 1;
      vec[t] = (c / tokens.length) * idf;
    }
    return vec;
  }

  function cosineSim(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const av = a[k] || 0, bv = b[k] || 0;
      dot += av * bv; na += av * av; nb += bv * bv;
    }
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }

  const qVec = toVec(tokenize(query));

  const scored = chunkTokens.map((tokens, i) => ({
    chunk: chunks[i],
    score: cosineSim(qVec, toVec(tokens))
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map(s => s.chunk);
}
