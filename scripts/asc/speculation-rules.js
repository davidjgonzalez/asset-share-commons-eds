/** @owner user */
export function registerSpeculationRules() {
  const script = document.createElement('script');
  script.type = 'speculationrules';
  script.textContent = JSON.stringify({
    prefetch: [{
      source: 'document',
      where: { and: [{ href_matches: '/*' }, { not: { href_matches: '/actions/*' } }] },
      eagerness: 'moderate',
    }],
  });
  document.head.append(script);
}
