export const buildCadHealthRows = (stats = {}) => {
  const total = Number(stats.totalComponents || 0);
  return [
    ['symbol', 'Schematic', 'Schematic'], ['footprint', 'Footprint', 'Footprints'],
    ['pad', 'Pad', 'Pad'], ['model', '3D Model', '3DModel'], ['pspice', 'PSpice', 'Pspice'],
  ].map(([fileType, type, field]) => {
    const undefinedCount = Number(stats[`undefined${field}`] || 0);
    const missingCount = Number(stats[`missing${field}`] || 0);
    const healthy = Number(stats.healthyCad?.[fileType] ?? Math.max(0, total - undefinedCount - missingCount));
    return { type, undefined_count: undefinedCount, missing_count: missingCount, health: total > 0 ? healthy / total * 100 : 0 };
  });
};
