// A TRACE-specific radial mark: every ray leads to one deliberately displaced point.
const center = {x: 42, y: 42};
const rays = [-178, -151, -126, -101, -76, -51, -26, -1, 24, 49, 74, 99, 124, 149];

const segment = (degrees, index, animated) => {
  const radians = degrees * Math.PI / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const ox = center.x - 32;
  const oy = center.y - 32;
  const dot = ox * dx + oy * dy;
  const edge = -dot + Math.sqrt(dot * dot + 27 * 27 - ox * ox - oy * oy);
  const start = 4.8;
  const end = Math.max(start + 4, edge - (index % 4 === 0 ? 2 : 0));
  const point = distance => `${(center.x + dx * distance).toFixed(2)} ${(center.y + dy * distance).toFixed(2)}`;
  const length = end - start;
  return `<path${animated ? ` class="brand-ray" style="--ray-delay:${index * 45}ms;--idle-delay:${1500 + index * 115}ms;--ray-length:${length.toFixed(2)}"` : ''} d="M${point(start)} L${point(end)}"/>`;
};

export function brandMark({animated = true, className = ''} = {}) {
  const classAttribute = animated ? ` class="brand-symbol ${className}"` : '';
  const access = animated ? ' aria-hidden="true" focusable="false"' : '';
  return `<svg${classAttribute}${access} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><g fill="none" stroke="#eceef1" stroke-width="3" stroke-linecap="round">${rays.map((angle, index) => segment(angle, index, animated)).join('')}</g><circle class="brand-core" cx="42" cy="42" r="3.2" fill="#ffffff"/></svg>`;
}
