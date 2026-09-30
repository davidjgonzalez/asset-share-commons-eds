// ASC EDS Docs — site-wide JS

// ─── Active nav link ───────────────────────────────────────────────────────
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.site-nav__links a, .sidebar__nav a').forEach((link) => {
  const href = link.getAttribute('href');
  if (href && (href === currentPage || href.endsWith(`/${currentPage}`))) {
    link.classList.add('active');
  }
});

// ─── Sidebar active on scroll ──────────────────────────────────────────────
const headings = document.querySelectorAll('.content h2[id], .content h3[id]');
const sidebarLinks = document.querySelectorAll('.sidebar__nav a[href^="#"]');

if (headings.length && sidebarLinks.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        sidebarLinks.forEach((l) => l.classList.remove('active'));
        const active = document.querySelector(`.sidebar__nav a[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-60px 0px -70% 0px' });

  headings.forEach((h) => observer.observe(h));
}

// ─── Code block copy buttons ───────────────────────────────────────────────
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Inline markdown subset used in block examples: images, links, `code`.
const inline = (t) => esc(t)
  .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  .replace(/`([^`]+)`/g, '<code>$1</code>');

// One cell line becomes a heading, or a paragraph when the cell has several lines.
const cellLine = (line, multi) => {
  const h = line.match(/^(#{1,6})\s+(.*)$/);
  if (h) return `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
  return multi ? `<p>${inline(line)}</p>` : inline(line);
};

// Parses an ASCII block table (| name | ... |) into the HTML table da.live pastes as a block.
// Returns null when the text is not a block table. A row whose first cell is empty continues
// the previous row's last cell (how multi-line values like options are written).
const blockTableHtml = (text) => {
  const lines = text.trim().split('\n').filter((l) => l.trim().startsWith('|'));
  if (lines.length < 2) return null;
  const hasRule = /^\|[\s|:-]+\|$/.test(lines[1].trim());
  const split = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const cols = split(lines[0]).length;
  const name = split(lines[0])[0];
  if (!name || /^key$/i.test(name) || split(lines[0]).slice(1).some(Boolean)) return null;
  const rows = [];
  lines.slice(hasRule ? 2 : 1).forEach((l) => {
    const cells = split(l);
    const last = rows[rows.length - 1];
    if (!cells[0] && last && cells.slice(1).some(Boolean)) {
      cells.slice(1).forEach((c, i) => { if (c) last[i + 1].push(c); });
    } else {
      rows.push(cells.map((c) => (c ? [c] : [])));
    }
  });
  const body = rows.map((r) => {
    const tds = Array.from({ length: cols }, (_, i) => {
      const parts = r[i] || [];
      return `<td>${parts.map((p) => cellLine(p, parts.length > 1)).join('')}</td>`;
    });
    return `<tr>${tds.join('')}</tr>`;
  }).join('');
  return `<table><tbody><tr><td colspan="${cols}">${esc(name)}</td></tr>${body}</tbody></table>`;
};

const buttonStyle = (right) => [
  'position:absolute', 'top:8px', `right:${right}px`, 'padding:3px 10px',
  'font-size:0.75rem', 'background:#ffffff15', 'color:#cdd6f4',
  'border:1px solid #ffffff20', 'border-radius:4px', 'cursor:pointer',
  'font-family:inherit', 'transition:background 150ms',
].join(';');

const flash = (btn, label) => {
  const original = btn.textContent;
  btn.textContent = 'Copied!';
  btn.style.background = '#22c55e30';
  setTimeout(() => { btn.textContent = original; btn.style.background = '#ffffff15'; }, 1500);
  return label;
};

document.querySelectorAll('.content pre').forEach((pre) => {
  const text = (pre.querySelector('code')?.textContent || pre.textContent).trim();
  const btn = document.createElement('button');
  btn.textContent = 'Copy';
  btn.className = 'copy-btn';
  btn.style.cssText = buttonStyle(8);
  btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(text);
    flash(btn);
  });
  pre.style.position = 'relative';
  pre.appendChild(btn);

  const html = blockTableHtml(text);
  if (!html) return;
  const daBtn = document.createElement('button');
  daBtn.textContent = 'Copy for da.live';
  daBtn.className = 'copy-btn copy-btn--da';
  daBtn.title = 'Copies this block as a table. Paste it straight into a da.live page.';
  daBtn.style.cssText = buttonStyle(64);
  daBtn.addEventListener('click', async () => {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    })]);
    flash(daBtn);
  });
  pre.appendChild(daBtn);
});

// ─── Theme demo switcher ───────────────────────────────────────────────────
const swatches = document.querySelectorAll('.theme-swatch');
const demoFrame = document.getElementById('theme-demo-frame');

swatches.forEach((swatch) => {
  swatch.addEventListener('click', () => {
    swatches.forEach((s) => s.classList.remove('active'));
    swatch.classList.add('active');
    const theme = swatch.dataset.theme;
    if (demoFrame) {
      demoFrame.src = `theme-demo.html?theme=${theme}`;
    }
  });
});
