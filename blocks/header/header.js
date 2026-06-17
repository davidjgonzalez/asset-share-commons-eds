import { getMetadata, loadBlock } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

export default async function decorate(block) {
  // Load nav fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);

  // Wrap in sticky container
  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Main navigation');

  // Get the 3 sections from fragment: brand, sections (search), tools
  const sections = Array.from(fragment.children);

  // 1. Brand / Logo section
  const brandSection = document.createElement('div');
  brandSection.className = 'nav-brand';
  if (sections[0]) {
    brandSection.append(...sections[0].children);
  } else {
    const title = getMetadata('og:title') || 'Asset Library';
    brandSection.innerHTML = `<a href="/">${title}</a>`;
  }
  nav.append(brandSection);

  // 2. Search section
  const searchSection = document.createElement('div');
  searchSection.className = 'nav-sections';
  if (sections[1]) {
    // Load any blocks in the search section
    const searchBlocks = sections[1].querySelectorAll('.block');
    for (const searchBlock of searchBlocks) {
      await loadBlock(searchBlock);
    }
    
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'search-bar-wrapper';
    searchWrapper.append(...sections[1].children);
    searchSection.append(searchWrapper);
  }
  nav.append(searchSection);

  // 3. Tools section
  const toolsSection = document.createElement('div');
  toolsSection.className = 'nav-tools';
  if (sections[2]) {
    // Load any blocks in the tools section
    const toolBlocks = sections[2].querySelectorAll('.block');
    for (const toolBlock of toolBlocks) {
      await loadBlock(toolBlock);
    }
    
    toolsSection.append(...sections[2].children);
  }
  nav.append(toolsSection);

  navWrapper.append(nav);
  block.innerHTML = '';
  block.append(navWrapper);
}
