// ASC Core — do not edit. Customize via scripts/asc/configurations.js

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
