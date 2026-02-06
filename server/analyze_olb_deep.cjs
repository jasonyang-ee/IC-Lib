const CFB = require('cfb');
const fs = require('fs');
const path = require('path');

const rawBuf = fs.readFileSync(path.resolve('f:/DevWeb/IC-Lib/example/olb/FT260S-R.OLB'));
const refOlb = CFB.read(rawBuf, {type: 'buffer'});

function hexDump(buf, label, maxBytes) {
  maxBytes = maxBytes || buf.length;
  const len = Math.min(buf.length, maxBytes);
  console.log('\n=== ' + label + ' (' + buf.length + ' bytes total, showing ' + len + ') ===');
  for (let row = 0; row * 16 < len; row++) {
    const offset = (row * 16).toString(16).padStart(4, '0');
    let hexPart = '';
    let asciiPart = '';
    for (let c = row * 16; c < Math.min((row + 1) * 16, len); c++) {
      const b = buf[c];
      hexPart += b.toString(16).padStart(2, '0') + ' ';
      asciiPart += (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
    }
    console.log('  ' + offset + ': ' + hexPart.padEnd(49) + ' ' + asciiPart);
  }
}

// Dump each meaningful stream
for (let i = 0; i < refOlb.FileIndex.length; i++) {
  const entry = refOlb.FileIndex[i];
  const fp = refOlb.FullPaths[i];
  if (entry.type === 2 && entry.content && entry.content.length > 0) {
    const buf = Buffer.from(entry.content);
    hexDump(buf, 'Stream: "' + fp + '" (entry[' + i + '] name="' + entry.name + '")', 512);
  }
}

// Analyze dir stream format
console.log('\n\n=== DIRECTORY STREAM FORMAT ANALYSIS ===');

function analyzeDirectoryStream(name, buf) {
  console.log('\n--- ' + name + ' (' + buf.length + ' bytes) ---');
  const magic = buf.slice(0, 4).toString('hex');
  const count = buf.readUInt16LE(4);
  console.log('  Magic: ' + magic);
  console.log('  Count: ' + count);
  
  if (count === 0) return;
  
  let pos = 6;
  for (let i = 0; i < count && pos < buf.length; i++) {
    // Format seems to be: uint16le nameLen, then name (null terminated), then extra data
    // OR: uint8 nameLen, uint8 padding, then name
    // Let's try: at pos, read uint8 as length, then skip 1 byte, then read that many chars
    const byte0 = buf[pos];
    const byte1 = buf[pos+1];
    console.log('  Entry ' + i + ': pos=' + pos + ' byte0=0x' + byte0.toString(16) + ' byte1=0x' + byte1.toString(16));
    
    // Try reading it as: uint16le = name length (including null)
    const nameLen16 = buf.readUInt16LE(pos);
    if (nameLen16 > 0 && nameLen16 < 256 && pos + 2 + nameLen16 <= buf.length) {
      const nameStr = buf.slice(pos + 2, pos + 2 + nameLen16 - 1).toString('ascii');
      console.log('    As uint16le name: len=' + nameLen16 + ' str="' + nameStr + '"');
      // Show trailing data after the name
      const afterName = pos + 2 + nameLen16;
      if (afterName < buf.length) {
        console.log('    After name data (' + (buf.length - afterName) + ' bytes): ' + 
          buf.slice(afterName).toString('hex').match(/.{2}/g).join(' '));
      }
    }
    break;
  }
}

for (const name of ['Cells Directory', 'Parts Directory', 'Views Directory', 
                     'Symbols Directory', 'Graphics Directory', 'Packages Directory', 
                     'ExportBlocks Directory']) {
  const idx = refOlb.FileIndex.findIndex(function(e) { return e.name === name; });
  if (idx >= 0) {
    analyzeDirectoryStream(name, Buffer.from(refOlb.FileIndex[idx].content));
  }
}

// Library stream analysis
console.log('\n\n=== LIBRARY STREAM DEEP ANALYSIS ===');
const libIdx = refOlb.FileIndex.findIndex(function(e) { return e.name === 'Library'; });
const libBuf = Buffer.from(refOlb.FileIndex[libIdx].content);
console.log('Total size: ' + libBuf.length + ' bytes');
console.log('Header (first 32 bytes): "' + libBuf.slice(0, 32).toString('ascii').replace(/\0/g, '\0') + '"');

// Byte-by-byte analysis after header
console.log('\nPost-header analysis:');
for (let off = 32; off < Math.min(libBuf.length, 120); off += 2) {
  const u16 = off + 1 < libBuf.length ? libBuf.readUInt16LE(off) : 0;
  const byte = libBuf[off];
  console.log('  offset ' + off + ': byte=0x' + byte.toString(16).padStart(2,'0') + 
    ' u16le=0x' + u16.toString(16).padStart(4,'0') + ' (' + u16 + ')');
}

// Find the OLB magic pattern b7988569 or 7f1f8569
console.log('\nSearching for magic patterns:');
for (let i = 0; i < libBuf.length - 3; i++) {
  const u32 = libBuf.readUInt32LE(i);
  if (u32 === 0x698598b7 || u32 === 0x69851f7f) {
    console.log('  Found 0x' + u32.toString(16) + ' at offset ' + i);
  }
}
