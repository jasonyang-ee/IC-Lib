// Keep the existing upload namespace so publication, scan and deletion agree.
// Fold case because deployments may use a case-insensitive shared filesystem.
export const cadFileLockKey = (fileType, fileName) => `cad-upload:${fileType}:${fileName.toLowerCase()}`;

export async function lockCadFileName(client, fileType, fileName) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [cadFileLockKey(fileType, fileName)]);
}

export async function lockCadFileNames(client, files) {
  const keys = [...new Set(files.map(file => cadFileLockKey(file.file_type, file.file_name)))].sort();
  for (const key of keys) {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
  }
}
