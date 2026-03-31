---
layout: home
title: Home
permalink: /
---

<div class="hero">
  <div class="hero__eyebrow">AEM Edge Delivery Services</div>
  <h1 class="hero__title">
    Asset sharing,<br><span>done right. A WIP.</span>
  </h1>
  <p class="hero__subtitle">
    A production-ready EDS front-end for AEM DAM. Search, preview, download,
    and share assets — without writing backend code.
  </p>
  <div class="hero__actions">
    <a href="/quickstart" class="btn btn--primary btn--lg">Get Started →</a>
    <a href="/blocks" class="btn btn--outline btn--lg">View Blocks</a>
  </div>
  <div class="hero__screenshot">
    <img
      src="https://placehold.co/1000x560/111111/e91e8c?text=ASC+EDS+%E2%80%94+Search+%26+Browse+Interface&font=inter"
      alt="ASC EDS search and browse interface screenshot"
      loading="lazy"
    />
  </div>
</div>

<div class="highlights">
  <div class="highlights__inner">
    <div class="highlights__item">
      <div class="highlights__number">15+</div>
      <div class="highlights__label">Ready-to-use Blocks</div>
    </div>
    <div class="highlights__item">
      <div class="highlights__number">2</div>
      <div class="highlights__label">Search Providers</div>
    </div>
    <div class="highlights__item">
      <div class="highlights__number">0</div>
      <div class="highlights__label">Build Steps</div>
    </div>
    <div class="highlights__item">
      <div class="highlights__number">∞</div>
      <div class="highlights__label">Themeable</div>
    </div>
  </div>
</div>

<section class="features">
  <div class="features__eyebrow">Batteries included</div>
  <h2 class="features__title">Everything you need, nothing you don't</h2>
  <p class="features__subtitle">Drop blocks into your AEM document. Configure once. Ship fast.</p>
  <div class="features__grid">

    <div class="feature-card">
      <div class="feature-card__screenshot">
        <img
          src="https://placehold.co/480x240/111111/e91e8c?text=Search+%26+Filters&font=inter"
          alt="Search and filters screenshot"
          loading="lazy"
        />
      </div>
      <div class="feature-card__icon">🔍</div>
      <div class="feature-card__title">Powerful Search</div>
      <p class="feature-card__text">
        Full-text search with composable filters — by property, path, date range, and tags.
        Works with both QueryBuilder and DM OpenAPI providers.
      </p>
      <div class="feature-card__blocks">
        <span class="badge badge--pink">search-bar</span>
        <span class="badge badge--pink">search-property</span>
        <span class="badge badge--pink">search-path</span>
        <span class="badge badge--pink">search-date-range</span>
      </div>
    </div>

    <div class="feature-card">
      <div class="feature-card__screenshot">
        <img
          src="https://placehold.co/480x240/111111/9333ea?text=Asset+Detail+Modal&font=inter"
          alt="Asset details modal screenshot"
          loading="lazy"
        />
      </div>
      <div class="feature-card__icon">🖼️</div>
      <div class="feature-card__title">Asset Details</div>
      <p class="feature-card__text">
        URL-addressable modal with MIME-type-driven templates. Deep-link directly to any asset.
        Preview images, video, and PDFs inline.
      </p>
      <div class="feature-card__blocks">
        <span class="badge badge--purple">details-modal</span>
        <span class="badge badge--purple">details-preview</span>
        <span class="badge badge--purple">details-download</span>
        <span class="badge badge--purple">details-actions</span>
      </div>
    </div>

    <div class="feature-card">
      <div class="feature-card__screenshot">
        <img
          src="https://placehold.co/480x240/111111/22c55e?text=Collections+%26+Downloads&font=inter"
          alt="Collections and downloads screenshot"
          loading="lazy"
        />
      </div>
      <div class="feature-card__icon">📦</div>
      <div class="feature-card__title">Collections & Downloads</div>
      <p class="feature-card__text">
        Cart-style collection management. The download sheet shows per-asset thumbnails, a per-asset rendition switcher, and drag-and-drop to Finder, Photoshop, or any OS app.
      </p>
      <div class="feature-card__blocks">
        <span class="badge badge--green">stub</span>
        <span class="badge badge--green">sheet</span>
        <span class="badge badge--green">collections</span>
      </div>
    </div>

    <div class="feature-card">
      <div class="feature-card__screenshot">
        <img
          src="https://placehold.co/480x240/111111/c026d3?text=Themes+%26+CSS+Variables&font=inter"
          alt="Theming screenshot"
          loading="lazy"
        />
      </div>
      <div class="feature-card__icon">🎨</div>
      <div class="feature-card__title">Themeable</div>
      <p class="feature-card__text">
        CSS variable-based theming. Drop a theme file into <code>styles/themes/</code> and switch
        with a body attribute. Ships with dark, light, and high-contrast themes.
      </p>
      <div class="feature-card__blocks">
        <span class="badge badge--blue">dark</span>
        <span class="badge badge--blue">light</span>
        <span class="badge badge--blue">high-contrast</span>
      </div>
    </div>

    <div class="feature-card">
      <div class="feature-card__screenshot">
        <img
          src="https://placehold.co/480x240/111111/e91e8c?text=Renditions+%26+Downloads&font=inter"
          alt="Renditions screenshot"
          loading="lazy"
        />
      </div>
      <div class="feature-card__icon">📐</div>
      <div class="feature-card__title">Renditions</div>
      <p class="feature-card__text">
        Declarative rendition definitions. Configure once in <code>configurations.js</code>,
        expose only the sizes and formats your users need.
      </p>
      <div class="feature-card__blocks">
        <span class="badge badge--amber">original</span>
        <span class="badge badge--amber">web-optimized</span>
        <span class="badge badge--amber">custom</span>
      </div>
    </div>

    <div class="feature-card">
      <div class="feature-card__screenshot">
        <img
          src="https://placehold.co/480x240/111111/3b82f6?text=No+Build+Step+Required&font=inter"
          alt="No build step screenshot"
          loading="lazy"
        />
      </div>
      <div class="feature-card__icon">⚡</div>
      <div class="feature-card__title">No Build Step</div>
      <p class="feature-card__text">
        Vanilla ES modules, deployed via AEM's CDN. No webpack, no bundler, no CI pipeline
        just to ship a CSS change. Edit → push → live.
      </p>
      <div class="feature-card__blocks">
        <span class="badge badge--blue">EDS</span>
        <span class="badge badge--blue">CDN</span>
        <span class="badge badge--blue">ES modules</span>
      </div>
    </div>

  </div>
</section>

<div class="screenshot-banner">
  <div class="screenshot-banner__grid">
    <div class="screenshot-banner__text">
      <div class="screenshot-banner__eyebrow">Search Providers</div>
      <h2 class="screenshot-banner__title">QueryBuilder or OpenAPI — your call</h2>
      <p class="screenshot-banner__body">
        Switch your entire search backend with one line of config. Use AEM's classic
        QueryBuilder or plug in the new Dynamic Media OpenAPI Search — no block rewrites needed.
      </p>
      <a href="/developer#search-provider" class="btn btn--ghost">Learn about providers →</a>
    </div>
    <div class="screenshot-banner__image">
      <img
        src="https://placehold.co/560x360/111111/e91e8c?text=Search+Provider+Config&font=inter"
        alt="Search provider configuration screenshot"
        loading="lazy"
      />
    </div>
  </div>
</div>

<div class="screenshot-banner" style="margin-top: 0; padding-top: 0;">
  <div class="screenshot-banner__grid screenshot-banner__grid--reverse">
    <div class="screenshot-banner__text">
      <div class="screenshot-banner__eyebrow">Single Config File</div>
      <h2 class="screenshot-banner__title">One file. All the configuration.</h2>
      <p class="screenshot-banner__body">
        <code>scripts/configurations.js</code> is the only file you need to touch.
        AEM host, search provider, renditions, asset detail templates — all in one place,
        fully typed.
      </p>
      <a href="/quickstart" class="btn btn--ghost">See Quick Start →</a>
    </div>
    <div class="screenshot-banner__image">
      <img
        src="https://placehold.co/560x360/111111/9333ea?text=configurations.js&font=inter"
        alt="configurations.js screenshot"
        loading="lazy"
      />
    </div>
  </div>
</div>

<section class="cta-section">
  <h2 class="cta-section__title">Ready to ship?</h2>
  <p class="cta-section__subtitle">
    Fork the repo, connect to your AEM environment, and you're live in minutes.
  </p>
  <div class="cta-section__actions">
    <a href="/quickstart" class="btn btn--primary btn--lg">Get Started →</a>
    <a href="https://github.com/davidjgonzalez/asset-share-commons-eds" class="btn btn--outline btn--lg" target="_blank" rel="noopener">View on GitHub</a>
  </div>
</section>
