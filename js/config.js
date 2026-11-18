export const CATEGORIES = [
  { id: 'esfera', name: 'Esferas', symbol: '●', color: '#39b8ac' },
  { id: 'cubo', name: 'Cubos', symbol: '■', color: '#edac50' },
  { id: 'piramide', name: 'Pirámides', symbol: '▲', color: '#df7880' },
  { id: 'prisma', name: 'Prismas hexagonales', symbol: '⬡', color: '#7f91d8' }
];
// Cada estación apunta al origen. Metros, Y arriba; usuario estable en (0,0,0).
export const STATIONS = [-75, -25, 25, 75].map(deg => {
  const a = deg * Math.PI / 180;
  return { x: Math.sin(a) * 1.30, z: -Math.cos(a) * 1.30, angle: -a };
});
export const SETTINGS = { size: .055, stableSeconds: .8, linearThreshold: .065,
  angularThreshold: .35, step: 1 / 60, maxDelta: .05, substeps: 8,
  tableTop: .82, binBottom: .85, binTop: 1.13, binHalf: .19 };
export function stationPoint(i, x, y, z) {
  const s = STATIONS[i], c = Math.cos(s.angle), n = Math.sin(s.angle);
  return { x: s.x + c*x + n*z, y, z: s.z - n*x + c*z };
}
export function localPoint(i, p) {
  const s = STATIONS[i], c = Math.cos(s.angle), n = Math.sin(s.angle);
  return { x: c*(p.x-s.x)-n*(p.z-s.z), y: p.y, z: n*(p.x-s.x)+c*(p.z-s.z) };
}
export const timeText = seconds => `${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;
