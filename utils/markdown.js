export function htmlToMarkdown(html, title, url) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  for (const tag of ['script', 'style', 'noscript', 'iframe', 'nav', 'footer', 'aside']) {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  }

  let md = '';
  if (title) md += `# ${title}\n\n`;
  if (url) md += `> 출처: ${url}\n\n---\n\n`;
  md += nodeToMd(doc.body);
  return md.replace(/\n{4,}/g, '\n\n\n').trim();
}

function nodeToMd(node) {
  if (!node) return '';
  let out = '';
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      out += child.textContent.replace(/[\t ]+/g, ' ');
    } else if (child.nodeType === 1) {
      out += elementToMd(child);
    }
  }
  return out;
}

function elementToMd(el) {
  const tag = el.tagName.toLowerCase();
  const inner = nodeToMd(el);
  const t = inner.trim();

  switch (tag) {
    case 'h1': return `\n\n# ${t}\n\n`;
    case 'h2': return `\n\n## ${t}\n\n`;
    case 'h3': return `\n\n### ${t}\n\n`;
    case 'h4': return `\n\n#### ${t}\n\n`;
    case 'h5': return `\n\n##### ${t}\n\n`;
    case 'h6': return `\n\n###### ${t}\n\n`;
    case 'p': return t ? `\n\n${t}\n\n` : '';
    case 'br': return '\n';
    case 'hr': return '\n\n---\n\n';
    case 'strong': case 'b': return t ? `**${t}**` : '';
    case 'em': case 'i': return t ? `*${t}*` : '';
    case 'del': case 's': return t ? `~~${t}~~` : '';
    case 'code': {
      if (el.parentElement?.tagName.toLowerCase() === 'pre') return el.textContent;
      return t ? `\`${t}\`` : '';
    }
    case 'pre': {
      const codeEl = el.querySelector('code');
      const lang = codeEl?.className?.match(/language-(\w+)/)?.[1] || '';
      const code = (codeEl || el).textContent.trim();
      return `\n\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
    }
    case 'a': {
      const href = el.getAttribute('href') || '';
      if (!t) return href;
      if (!href || href === t) return t;
      return `[${t}](${href})`;
    }
    case 'img': {
      const src = el.getAttribute('src') || '';
      const alt = el.getAttribute('alt') || '';
      return src ? `![${alt}](${src})` : '';
    }
    case 'ul': return `\n\n${listToMd(el, false)}\n\n`;
    case 'ol': return `\n\n${listToMd(el, true)}\n\n`;
    case 'li': return inner;
    case 'blockquote':
      return t ? `\n\n${t.split('\n').map(l => `> ${l}`).join('\n')}\n\n` : '';
    case 'table': return `\n\n${tableToMd(el)}\n\n`;
    case 'div': case 'section': case 'article': case 'main':
    case 'figure': case 'figcaption': case 'header':
      return t ? `\n\n${t}\n\n` : '';
    case 'script': case 'style': case 'noscript': case 'iframe':
    case 'nav': case 'footer': case 'aside': case 'button':
    case 'input': case 'select': case 'textarea': case 'form':
      return '';
    default: return inner;
  }
}

function listToMd(listEl, ordered) {
  let out = '';
  let n = 1;
  for (const child of listEl.children) {
    if (child.tagName.toLowerCase() !== 'li') continue;
    const marker = ordered ? `${n}.` : '-';
    const content = nodeToMd(child).trim();
    const lines = content.split('\n');
    out += `${marker} ${lines[0]}\n`;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) out += `   ${lines[i]}\n`;
    }
    n++;
  }
  return out;
}

function tableToMd(tableEl) {
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  if (!rows.length) return '';

  const data = rows.map(row =>
    Array.from(row.querySelectorAll('th, td')).map(cell =>
      nodeToMd(cell).trim().replace(/\|/g, '\\|').replace(/\n/g, ' ')
    )
  );

  if (!data.length || !data[0].length) return '';
  const cols = Math.max(...data.map(r => r.length));
  const norm = data.map(r => { while (r.length < cols) r.push(''); return r; });

  let out = `| ${norm[0].join(' | ')} |\n| ${norm[0].map(() => '---').join(' | ')} |\n`;
  for (let i = 1; i < norm.length; i++) {
    out += `| ${norm[i].join(' | ')} |\n`;
  }
  return out;
}
