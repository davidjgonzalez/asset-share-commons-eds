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

// ─── Code block copy button ────────────────────────────────────────────────
document.querySelectorAll('.content pre').forEach((pre) => {
  const btn = document.createElement('button');
  btn.textContent = 'Copy';
  btn.className = 'copy-btn';
  btn.style.cssText = [
    'position:absolute', 'top:8px', 'right:8px', 'padding:3px 10px',
    'font-size:0.75rem', 'background:#ffffff15', 'color:#cdd6f4',
    'border:1px solid #ffffff20', 'border-radius:4px', 'cursor:pointer',
    'font-family:inherit', 'transition:background 150ms',
  ].join(';');

  btn.addEventListener('click', async () => {
    const code = pre.querySelector('code')?.textContent || pre.textContent;
    await navigator.clipboard.writeText(code.trim());
    btn.textContent = 'Copied!';
    btn.style.background = '#22c55e30';
    setTimeout(() => { btn.textContent = 'Copy'; btn.style.background = '#ffffff15'; }, 1500);
  });

  pre.style.position = 'relative';
  pre.appendChild(btn);
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
