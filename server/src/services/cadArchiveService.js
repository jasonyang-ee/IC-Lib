import { crc32, inflateRaw } from 'node:zlib';
import { promisify } from 'node:util';
import { MAX_CAD_ARCHIVE_BYTES, MAX_CAD_ARCHIVE_ENTRIES } from '../constants/cadArchiveLimits.js';

const inflate = promisify(inflateRaw);

export class CadArchiveError extends Error {}

export function getBoundedArchiveEntries(zip) {
  const count = zip.getEntryCount();
  if (!Number.isSafeInteger(count) || count < 0 || count > MAX_CAD_ARCHIVE_ENTRIES) {
    throw new CadArchiveError(`Archive exceeds the ${MAX_CAD_ARCHIVE_ENTRIES}-entry limit`);
  }
  const entries = zip.getEntries();
  let totalBytes = 0;
  for (const entry of entries) {
    const size = entry.header.size;
    if (!Number.isSafeInteger(size) || size < 0) throw new CadArchiveError('Invalid archive entry size');
    totalBytes += size;
    if (totalBytes > MAX_CAD_ARCHIVE_BYTES) {
      throw new CadArchiveError(`Archive exceeds the ${MAX_CAD_ARCHIVE_BYTES / 1024 / 1024} MiB expanded-size limit`);
    }
  }
  return entries;
}

export async function readBoundedArchiveEntry(entry) {
  const { size, compressedSize, method, flags, crc } = entry.header;
  if (flags & 1) throw new CadArchiveError('Encrypted archives are not supported');
  if (method !== 0 && method !== 8) throw new CadArchiveError('Unsupported archive compression method');
  const compressed = entry.getCompressedData();
  if (compressed.length !== compressedSize) throw new CadArchiveError('Truncated archive entry');
  // Do not use getData(): header-only checks cannot bound a forged zero-size
  // DEFLATE entry, and older adm-zip versions preallocate the declared size.
  let data;
  try {
    data = method === 0 ? compressed : await inflate(compressed, { maxOutputLength: Math.max(1, size) });
  } catch {
    throw new CadArchiveError('Invalid archive data or expanded-size limit exceeded');
  }
  if (data.length !== size || crc32(data) !== crc) throw new CadArchiveError('Archive size or checksum mismatch');
  return data;
}
