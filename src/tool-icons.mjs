// Three small instruments. Each glyph is split into depth layers (back / mid /
// front) so the pointer can shift them at different rates, and every moving
// part has its own class for the select, hover and idle choreography.
const svg = (tool, body) => `<svg class="tool-glyph tool-glyph--${tool}" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">${body}</svg>`;

const icons = {
  powershell: svg('powershell',
    `<g class="tg-layer tg-back"><path class="tool-glyph__plate" d="M8.5 8.5h31l-4.8 29h-31l4.8-29Z"/><path class="tool-glyph__rim" d="M9.6 8.5h29.9M4.4 37.5h30.3"/><path class="tool-glyph__trace" d="M10 12h25"/></g>` +
    `<g class="tg-layer tg-front"><path class="tool-glyph__prompt" d="m15 18.5 6 5-6 5"/><path class="tool-glyph__run" d="M24 29h8"/></g>`),
  cmd: svg('cmd',
    `<g class="tg-layer tg-back"><rect class="tool-glyph__plate" x="5.5" y="9" width="37" height="30" rx="5"/><path class="tool-glyph__rim" d="M5.5 16.5h37"/><circle class="tool-glyph__dot" cx="10.5" cy="12.8" r="1.1"/><circle class="tool-glyph__dot" cx="14.3" cy="12.8" r="1.1"/><circle class="tool-glyph__dot" cx="18.1" cy="12.8" r="1.1"/></g>` +
    `<g class="tg-layer tg-front"><path class="tool-glyph__prompt" d="m12.5 23 5 4-5 4"/><path class="tool-glyph__run" d="M21 31h9"/><path class="tool-glyph__cursor" d="M33.5 24.5v7"/></g>`),
  manual: svg('manual',
    `<g class="tg-layer tg-back"><circle class="tool-glyph__node" cx="24" cy="24" r="15"/><path class="tool-glyph__ring" d="M24 5.5a18.5 18.5 0 1 1-18.5 18.5"/><path class="tool-glyph__arc" d="M6.1 19.5A18.5 18.5 0 0 1 19.5 6.1"/></g>` +
    `<g class="tg-layer tg-mid"><path class="tool-glyph__cross" d="M24 10v5m0 18v5M10 24h5m18 0h5"/></g>` +
    `<g class="tg-layer tg-front"><path class="tool-glyph__prompt" d="m18.2 24.3 4.2 4.2 7.7-9"/></g>`)
};

export const toolIcon = key => icons[key] || '';
