// Interface glyphs are drawn as strokes so they stay crisp and share one weight.
const stroke = (body, className = '') => `<svg class="glyph${className ? ` ${className}` : ''}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const arrowUpRight = stroke('<path d="M5 11 11 5"/><path d="M6.2 5H11v4.8"/>', 'glyph-arrow');
// Inside the site the arrow points on (→); out of it, up and away (↗).
export const arrowRight = stroke('<path d="M3.5 8h9"/><path d="m9 4.5 3.5 3.5L9 11.5"/>', 'glyph-next');
export const arrowDown = stroke('<path d="M8 3.5v9"/><path d="m4.5 9 3.5 3.5L11.5 9"/>', 'glyph-down');
export const close = stroke('<path d="m4.5 4.5 7 7"/><path d="m11.5 4.5-7 7"/>', 'glyph-close');
export const plus = stroke('<path d="M8 3.5v9"/><path d="M3.5 8h9"/>', 'glyph-plus');
export const chevron = stroke('<path d="m4.5 6.5 3.5 3.5 3.5-3.5"/>', 'glyph-chevron');
export const copy = `<svg class="glyph glyph-copy" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><g class="glyph-copy__sheets"><rect x="5.5" y="5.5" width="7" height="7" rx="1.8"/><path d="M10.5 3.6V3.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3.5V9A1.5 1.5 0 0 0 4 10.5h.1"/></g><path class="glyph-copy__check" d="m3.8 8.4 2.7 2.7 5.7-6.2"/></svg>`;
export const asterisk = stroke('<path d="M8 2.5v11"/><path d="m3.24 5.25 9.52 5.5"/><path d="m3.24 10.75 9.52-5.5"/>', 'glyph-asterisk');
export const external = arrowUpRight;
export const arrow = `<span class="arrow" aria-hidden="true">${arrowRight}</span>`;
export const arrowOut = `<span class="arrow" aria-hidden="true">${arrowUpRight}</span>`;

