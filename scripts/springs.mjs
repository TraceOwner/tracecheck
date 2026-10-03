// Prints CSS `linear()` easings for the spring tokens in src/trace.css.
// Parameters follow SwiftUI: perceptual duration and bounce. The same model is
// integrated at runtime by src/spring.js, so CSS and JS motion share one feel.
const springs = {
  smooth: {duration: .5, bounce: 0},
  snappy: {duration: .42, bounce: .14},
  bouncy: {duration: .5, bounce: .3},
  gentle: {duration: .78, bounce: 0},
  press: {duration: .3, bounce: .22}
};

function curve({duration, bounce}) {
  const w0 = 2 * Math.PI / duration, zeta = 1 - bounce;
  const at = t => {
    if (zeta >= 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + zeta * w0 / wd * Math.sin(wd * t));
  };
  let settle = 0;
  for (let t = 0; t < 5; t += .001) if (Math.abs(1 - at(t)) > .0015) settle = t;
  const total = Math.ceil(settle * 100) / 100;
  const points = Array.from({length: 241}, (_, i) => [i / 240, at(i / 240 * total)]);
  points[points.length - 1][1] = 1;
  return {total, points: simplify(points, .0025)};
}

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  let index = 0, max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const expected = a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
    const distance = Math.abs(y - expected);
    if (distance > max) { max = distance; index = i; }
  }
  if (max <= tolerance) return [a, b];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}

for (const [name, spring] of Object.entries(springs)) {
  const {total, points} = curve(spring);
  const body = points.map(([t, x], i) => i === 0 ? '0' : i === points.length - 1 ? '1' : `${+x.toFixed(4)} ${+(t * 100).toFixed(1)}%`).join(', ');
  console.log(`  --spring-${name}:linear(${body});\n  --dur-${name}:${Math.round(total * 1000)}ms;`);
}
