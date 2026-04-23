const MIGRATION_PATTERN = /^(?<sequenceNumber>\d+)_(?<description>[a-z0-9_]+)\.sql$/i;

function formatMigrationDescription(rawDescription) {
  return rawDescription.replace(/_/g, ' ');
}

export function parseMigrationFilename(filename) {
  const migrationMatch = filename.match(MIGRATION_PATTERN);

  if (migrationMatch?.groups) {
    return {
      sequenceNumber: Number(migrationMatch.groups.sequenceNumber),
      description: formatMigrationDescription(migrationMatch.groups.description),
    };
  }

  return {
    sequenceNumber: Number.MAX_SAFE_INTEGER,
    description: filename.replace(/\.sql$/i, '').replace(/_/g, ' '),
  };
}

export function compareMigrationFilenames(leftFilename, rightFilename) {
  const leftMetadata = parseMigrationFilename(leftFilename);
  const rightMetadata = parseMigrationFilename(rightFilename);

  if (leftMetadata.sequenceNumber !== rightMetadata.sequenceNumber) {
    return leftMetadata.sequenceNumber - rightMetadata.sequenceNumber;
  }

  return leftFilename.localeCompare(rightFilename);
}