const CFB = require('cfb');
const fs = require('fs');
const path = require('path');

const refPath = path.resolve('f:/DevWeb/IC-Lib/example/olb/FT260S-R.OLB');
console.log('Reading:', refPath);
const rawBuf = fs.readFileSync(refPath);
console.log('File size:', rawBuf.length, 'bytes');
console.log('');

// Parse from buffer
const refOlb = CFB.read(rawBuf, {type: 'buffer'});

console.log('=== REFERENCE OLB (FT260S-R.OLB) - CFB Structure ===');
console.log('FileIndex entries:', refOlb.FileIndex.length);
console.log('');

refOlb.FileIndex.forEach((entry, i) => {
  const name = entry.name;
  const size = entry.size;
  const type = entry.type;  // 0=unknown, 1=storage(dir), 2=stream, 5=root
  const typeLabel = {0:'unknown', 1:'storage', 2:'stream', 5:'root'}[type] || type;
  const ct = entry.ct ? entry.ct.toISOString() : 'none';
  const mt = entry.mt ? entry.mt.toISOString() : 'none';

  console.log(`  [${i}] type=${type}(${typeLabel}) size=${size} name="${name}"`);
  console.log(`       created=${ct} modified=${mt}`);

  if (entry.content && entry.content.length > 0) {
    const buf = Buffer.from(entry.content);
    const showLen = Math.min(buf.length, 128);
    const hex = buf.slice(0, showLen).toString('hex').match(/.{2}/g).join(' ');
    console.log(`       first ${showLen} bytes hex:`);
    console.log(`       ${hex}`);

    // Try to show as ASCII where printable
    let ascii = '';
    for (let j = 0; j < showLen; j++) {
      const b = buf[j];
      ascii += (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
    }
    console.log(`       ascii: ${ascii}`);
  }
  console.log('');
});

// Show the full path structure
console.log('=== FULL PATH LISTING ===');
refOlb.FullPaths.forEach((fp, i) => {
  const entry = refOlb.FileIndex[i];
  const typeLabel = {0:'unknown', 1:'storage', 2:'stream', 5:'root'}[entry.type] || entry.type;
  console.log(`  [${i}] "${fp}" (${typeLabel}, size=${entry.size})`);
});

// Dump the raw bytes of the file header (first 512 bytes)
console.log('');
console.log('=== RAW FILE HEADER (first 512 bytes) ===');
const headerHex = rawBuf.slice(0, 512).toString('hex').match(/.{2}/g);
for (let row = 0; row < 32; row++) {
  const offset = (row * 16).toString(16).padStart(4, '0');
  const hexPart = headerHex.slice(row * 16, (row + 1) * 16).join(' ');
  let asciiPart = '';
  for (let c = row * 16; c < (row + 1) * 16 && c < 512; c++) {
    const b = rawBuf[c];
    asciiPart += (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
  }
  console.log(`  ${offset}: ${hexPart}  ${asciiPart}`);
}
