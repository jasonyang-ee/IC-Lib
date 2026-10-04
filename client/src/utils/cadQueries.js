// A CAD write can change filenames, ownership, availability and derived part
// fields. Keep those cached read surfaces coherent across page navigation.
export const invalidateCadQueries = (queryClient) => Promise.all([
  'filesByType', 'fileLibraryStats', 'orphanFiles',
  'componentsByFile', 'cadFilesForComponent', 'sharingComponents',
  'categoryComponentsForFiles', 'available-cad-files', 'componentFiles',
  'components', 'componentDetails', 'componentAlternatives', 'componentSearch',
  'ecos', 'eco', 'report', 'dashboardStats', 'extendedStats', 'inventory', 'project',
  'projects', 'componentProjects', 'categoryBreakdown', 'lowStock', 'auditLog',
].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
