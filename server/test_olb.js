const CFB = require('cfb');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// PART 1: Parse the OLB file using cfb
// ============================================================
console.log('='.repeat(80));
console.log('PART 1: OLB FILE ANALYSIS');
console.log('='.repeat(80));

const olbPath = path.resolve(__dirname, '..', 'library', 'symbol', 'CL10B104KB8NNWC', 'ORCADCAPTUREOLB.OLB');
console.log(`\nParsing OLB file: ${olbPath}`);
console.log(`File size: ${fs.statSync(olbPath).size} bytes\n`);

const cfb = CFB.read(olbPath, { type: 'file' });

// List all entries
console.log('-'.repeat(80));
console.log('ALL ENTRIES IN OLB (OLE2 Compound File):');
console.log('-'.repeat(80));

function getEntryType(entry) {
  switch (entry.type) {
    case 0: return 'unknown';
    case 1: return 'storage';
    case 2: return 'stream';
    case 5: return 'root';
    default: return `type-${entry.type}`;
  }
}

function toHex(buf, maxBytes) {
  if (!buf || buf.length === 0) return '(empty)';
  const len = maxBytes ? Math.min(buf.length, maxBytes) : buf.length;
  const bytes = [];
  for (let i = 0; i < len; i++) {
    bytes.push(buf[i].toString(16).padStart(2, '0'));
  }
  // Group in rows of 16
  const rows = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const hexPart = bytes.slice(i, i + 16).join(' ');
    // ASCII part
    const asciiPart = [];
    for (let j = i; j < Math.min(i + 16, bytes.length); j++) {
      const b = buf[j];
      asciiPart.push(b >= 32 && b < 127 ? String.fromCharCode(b) : '.');
    }
    rows.push(`  ${i.toString(16).padStart(6, '0')}: ${hexPart.padEnd(48)} | ${asciiPart.join('')}`);
  }
  return rows.join('\n');
}

function toVisibleString(buf, maxBytes) {
  if (!buf || buf.length === 0) return '(empty)';
  const len = maxBytes ? Math.min(buf.length, maxBytes) : buf.length;
  let result = '';
  for (let i = 0; i < len; i++) {
    const b = buf[i];
    if (b >= 32 && b < 127) {
      result += String.fromCharCode(b);
    } else if (b === 0x0a || b === 0x0d) {
      result += '\n';
    } else {
      result += '.';
    }
  }
  return result;
}

// Sort entries by path for readability
const entries = cfb.FileIndex.slice().sort((a, b) => {
  const nameA = (a.name || '').toLowerCase();
  const nameB = (b.name || '').toLowerCase();
  return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
});

for (let i = 0; i < cfb.FileIndex.length; i++) {
  const entry = cfb.FileIndex[i];
  const fullName = cfb.FullPaths[i] || '(no path)';
  const entryType = getEntryType(entry);
  const size = entry.size || 0;
  const content = entry.content;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Entry #${i}`);
  console.log(`  Full Path : ${fullName}`);
  console.log(`  Name      : ${entry.name}`);
  console.log(`  Type      : ${entryType} (${entry.type})`);
  console.log(`  Size      : ${size} bytes`);
  console.log(`  Color     : ${entry.color}`);
  console.log(`  Start     : ${entry.start}`);
  if (entry.ct) console.log(`  Created   : ${entry.ct}`);
  if (entry.mt) console.log(`  Modified  : ${entry.mt}`);

  if (content && content.length > 0) {
    if (size < 500) {
      console.log(`  --- RAW HEX (full ${content.length} bytes) ---`);
      console.log(toHex(content));
      console.log(`  --- AS STRING ---`);
      console.log(`  ${toVisibleString(content)}`);
    } else {
      console.log(`  --- RAW HEX (first 200 of ${content.length} bytes) ---`);
      console.log(toHex(content, 200));
      console.log(`  --- VISIBLE ASCII STRINGS (first 200 bytes) ---`);
      console.log(`  ${toVisibleString(content, 200)}`);
    }
  } else if (entryType === 'stream') {
    console.log(`  (no content / empty stream)`);
  }
}

console.log(`\n\nTotal entries: ${cfb.FileIndex.length}`);

// Summary table
console.log('\n' + '-'.repeat(80));
console.log('SUMMARY TABLE:');
console.log('-'.repeat(80));
console.log(`${'#'.padStart(4)} | ${'Type'.padEnd(8)} | ${'Size'.padStart(10)} | Full Path`);
console.log('-'.repeat(80));
for (let i = 0; i < cfb.FileIndex.length; i++) {
  const entry = cfb.FileIndex[i];
  const fullName = cfb.FullPaths[i] || '(no path)';
  const entryType = getEntryType(entry);
  const size = entry.size || 0;
  console.log(`${String(i).padStart(4)} | ${entryType.padEnd(8)} | ${String(size).padStart(10)} | ${fullName}`);
}


// ============================================================
// PART 2: Extract and examine XML from ZIP
// ============================================================
console.log('\n\n' + '='.repeat(80));
console.log('PART 2: SAMACSYS CAPTURE XML ANALYSIS');
console.log('='.repeat(80));

const AdmZip = require('adm-zip');
const zipPath = path.resolve(__dirname, '..', 'example', 'SamacSys', 'LIB_STM32G484QET6TR.zip');
console.log(`\nExamining ZIP: ${zipPath}\n`);

const zip = new AdmZip(zipPath);
const zipEntries = zip.getEntries();

// List all entries in zip
console.log('All ZIP entries:');
zipEntries.forEach(e => {
  console.log(`  ${e.entryName} (${e.header.size} bytes)`);
});

// Find Capture XML
let captureXmlEntry = null;
for (const entry of zipEntries) {
  if (entry.entryName.match(/Capture\/.*\.xml$/i) || entry.entryName.match(/Capture\\.*\.xml$/i)) {
    captureXmlEntry = entry;
    break;
  }
}

if (!captureXmlEntry) {
  // Try broader search
  for (const entry of zipEntries) {
    if (entry.entryName.match(/\.xml$/i) && entry.entryName.toLowerCase().includes('capture')) {
      captureXmlEntry = entry;
      break;
    }
  }
}

if (!captureXmlEntry) {
  // Just find any XML
  for (const entry of zipEntries) {
    if (entry.entryName.match(/\.xml$/i)) {
      console.log(`\nNo Capture/*.xml found, using: ${entry.entryName}`);
      captureXmlEntry = entry;
      break;
    }
  }
}

if (captureXmlEntry) {
  console.log(`\nExtracted XML: ${captureXmlEntry.entryName}`);
  console.log(`Size: ${captureXmlEntry.header.size} bytes`);

  const xmlContent = captureXmlEntry.getData().toString('utf8');
  const lines = xmlContent.split('\n');

  console.log(`\nTotal lines in XML: ${lines.length}`);
  console.log('\n' + '-'.repeat(80));
  console.log(`FIRST 200 LINES OF XML:`);
  console.log('-'.repeat(80));
  for (let i = 0; i < Math.min(200, lines.length); i++) {
    console.log(`${String(i + 1).padStart(4)}: ${lines[i]}`);
  }

  // Summary of top-level XML elements
  console.log('\n' + '-'.repeat(80));
  console.log('TOP-LEVEL XML ELEMENTS SUMMARY:');
  console.log('-'.repeat(80));

  // Simple regex-based extraction of top-level tags
  // Find the root element first
  const rootMatch = xmlContent.match(/<([a-zA-Z_][\w.-]*)[^>]*>/);
  if (rootMatch) {
    console.log(`Root element: <${rootMatch[1]}>`);
  }

  // Get all unique element names at various levels
  const tagPattern = /<([a-zA-Z_][\w.-]*)[^/>]*(?:\/>|>)/g;
  const tagCounts = {};
  let match;
  while ((match = tagPattern.exec(xmlContent)) !== null) {
    const tag = match[1];
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }

  console.log('\nAll XML element names and their occurrence counts:');
  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sortedTags) {
    console.log(`  <${tag}> : ${count} occurrences`);
  }

  // Find top-level children (children of root element)
  if (rootMatch) {
    const rootTag = rootMatch[1];
    // Rough approach: find elements that are direct children of root
    // Look for elements at indentation level 1 (2 spaces or 1 tab)
    const topLevelChildren = new Set();
    const childPattern = new RegExp(`^\\s{0,4}<([a-zA-Z_][\\w.-]*)`, 'gm');
    let childMatch;
    while ((childMatch = childPattern.exec(xmlContent)) !== null) {
      if (childMatch[1] !== rootTag && childMatch[1] !== '?xml') {
        topLevelChildren.add(childMatch[1]);
      }
    }
    console.log(`\nElements near root level: ${[...topLevelChildren].join(', ')}`);
  }
} else {
  console.log('\nNo XML files found in ZIP!');
}

console.log('\n' + '='.repeat(80));
console.log('ANALYSIS COMPLETE');
console.log('='.repeat(80));
