/**
 * Flatten regular and archive upload responses into the staged file entries
 * consumed by ComponentFiles. The server-provided filename remains unchanged.
 */
export function collectCadUploadEntries(results) {
  const entries = [];
  for (const result of results) {
    if (result.type === 'archive' && result.extracted) {
      for (const extractedFile of result.extracted) {
        if (extractedFile.category && extractedFile.filename) {
          entries.push({
            category: extractedFile.category,
            filename: extractedFile.filename,
            tempFilename: extractedFile.tempFilename,
            type: extractedFile.category,
          });
        }
      }
    } else if (result.type && result.type !== 'archive' && !result.error && result.filename) {
      entries.push({
        category: result.type,
        filename: result.filename,
        tempFilename: result.tempFilename,
        type: result.type,
      });
    }
  }
  return entries;
}
