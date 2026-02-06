/**
 * SamacSys OLB Generator Service
 *
 * Parses SamacSys Capture XML files and generates OrCAD OLB (OLE2 compound) files.
 *
 * The Capture XML (found in SamacSys ZIPs at Capture/<PartName>.xml) is a complete
 * XML serialization of an OrCAD OLB library conforming to Cadence's olb.xsd schema.
 * It contains all pin definitions, symbol graphics, component properties, and
 * physical pin-to-pad mappings.
 *
 * The OLB format is an OLE2 (COM Structured Storage) compound file with these streams:
 *   - Library:          Header "OrCAD Windows Library" + font/config data
 *   - Cache:            10 bytes of zeros
 *   - NetBundleMapData: 4 bytes (LE uint32 = 2)
 *   - Directory streams: Magic 7f1f8569 + entry count + null-terminated entry names
 *   - Packages/<name>:  Binary-encoded package data (pins, graphics, properties)
 *   - Storage folders:  Cells/, Parts/, Views/, Symbols/, Graphics/, Packages/, ExportBlocks/
 */

import { XMLParser } from 'fast-xml-parser';
import CFB from 'cfb';
import fs from 'fs';
import path from 'path';

// ─── XML Parser Configuration ───────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseAttributeValue: true,
  trimValues: true,
});

// ─── OLB Binary Constants ───────────────────────────────────────────────────

// Directory stream magic bytes
const DIR_MAGIC = Buffer.from([0x7f, 0x1f, 0x85, 0x69]);

// Standard Library stream header (from reverse-engineering existing OLB files)
// "OrCAD Windows Library" padded to 32 bytes, followed by standard font/config block
const OLB_LIBRARY_HEADER = (() => {
  const header = Buffer.alloc(32, 0x20); // 32 bytes padded with spaces
  header.write('OrCAD Windows Library', 0, 'ascii');
  header[31] = 0x00; // null terminator
  return header;
})();

// Standard font definitions block (24 fonts, extracted from reference OLB)
// This is the default font configuration used by OrCAD Capture
const DEFAULT_FONT_CONFIG = (() => {
  // Minimal font config with Arial as default
  // Each font entry: index(4) + name(32) + size(4) + flags(4) = 44 bytes
  const fonts = [];
  const fontNames = [
    'Arial', 'Arial', 'Arial', 'Arial', 'Arial', 'Arial',
    'Arial', 'Arial', 'Arial', 'Arial', 'Arial', 'Arial',
    'Arial', 'Arial', 'Arial', 'Arial', 'Arial', 'Arial',
    'Arial', 'Arial', 'Arial', 'Arial', 'Arial', 'Arial',
  ];
  const fontSizes = [
    10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
    10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
  ];

  for (let i = 0; i < 24; i++) {
    const entry = Buffer.alloc(44, 0);
    entry.writeUInt32LE(i, 0);
    entry.write(fontNames[i], 4, 'ascii');
    entry.writeUInt32LE(fontSizes[i], 36);
    entry.writeUInt32LE(0, 40); // flags
    fonts.push(entry);
  }
  return Buffer.concat(fonts);
})();

// ─── XML Parsing ────────────────────────────────────────────────────────────

/**
 * Parse a SamacSys Capture XML file and extract component data
 * @param {string} xmlContent - Raw XML string from Capture/<part>.xml
 * @returns {Object} Parsed component data
 */
export function parseCaptureXML(xmlContent) {
  const parsed = xmlParser.parse(xmlContent);
  const lib = parsed.Lib;
  if (!lib) {
    throw new Error('Invalid Capture XML: missing <Lib> root element');
  }

  const pkg = lib.Package;
  if (!pkg) {
    throw new Error('Invalid Capture XML: missing <Package> element');
  }

  const defn = pkg.Defn?.['@_name'] ? pkg.Defn : (pkg.Defn?.Defn || pkg.Defn);
  const pkgName = getAttr(pkg, 'name') || getAttr(defn, 'name');
  const pcbFootprint = getAttr(pkg, 'pcbFootprint') || getAttr(defn, 'pcbFootprint') || '';
  const refdesPrefix = getAttr(pkg, 'refdesPrefix') || getAttr(defn, 'refdesPrefix') || 'U';

  // Extract LibPart > NormalView data
  const libPart = pkg.LibPart;
  const normalView = libPart?.NormalView;

  // Extract user properties (Manufacturer, Part Number, Description, etc.)
  const userProps = {};
  const symUserProps = normalView?.SymbolUserProp;
  if (symUserProps) {
    const props = Array.isArray(symUserProps) ? symUserProps : [symUserProps];
    for (const prop of props) {
      const name = getAttr(prop, 'name') || getAttr(prop?.Defn, 'name');
      const val = getAttr(prop, 'val') || getAttr(prop?.Defn, 'val') || '';
      if (name) userProps[name] = val;
    }
  }

  // Extract symbol bounding box
  const bbox = normalView?.SymbolBBox;
  const symbolBBox = bbox ? {
    x1: getAttr(bbox, 'x1') || getAttr(bbox?.Defn, 'x1') || 0,
    y1: getAttr(bbox, 'y1') || getAttr(bbox?.Defn, 'y1') || 0,
    x2: getAttr(bbox, 'x2') || getAttr(bbox?.Defn, 'x2') || 0,
    y2: getAttr(bbox, 'y2') || getAttr(bbox?.Defn, 'y2') || 0,
  } : { x1: 0, y1: 0, x2: 100, y2: 100 };

  // Extract graphic lines (symbol body outline)
  const lines = [];
  const xmlLines = normalView?.Line;
  if (xmlLines) {
    const lineArr = Array.isArray(xmlLines) ? xmlLines : [xmlLines];
    for (const line of lineArr) {
      lines.push({
        x1: getAttr(line, 'x1') || getAttr(line?.Defn, 'x1') || 0,
        y1: getAttr(line, 'y1') || getAttr(line?.Defn, 'y1') || 0,
        x2: getAttr(line, 'x2') || getAttr(line?.Defn, 'x2') || 0,
        y2: getAttr(line, 'y2') || getAttr(line?.Defn, 'y2') || 0,
      });
    }
  }

  // Extract pins
  const pins = [];
  const xmlPins = normalView?.SymbolPinScalar;
  if (xmlPins) {
    const pinArr = Array.isArray(xmlPins) ? xmlPins : [xmlPins];
    for (const pin of pinArr) {
      const pinDefn = pin.Defn || pin;
      pins.push({
        name: getAttr(pin, 'name') || getAttr(pinDefn, 'name') || '',
        position: getAttr(pin, 'position') ?? getAttr(pinDefn, 'position') ?? 0,
        hotptX: getAttr(pin, 'hotptX') ?? getAttr(pinDefn, 'hotptX') ?? 0,
        hotptY: getAttr(pin, 'hotptY') ?? getAttr(pinDefn, 'hotptY') ?? 0,
        startX: getAttr(pin, 'startX') ?? getAttr(pinDefn, 'startX') ?? 0,
        startY: getAttr(pin, 'startY') ?? getAttr(pinDefn, 'startY') ?? 0,
        type: getAttr(pin, 'type') ?? getAttr(pinDefn, 'type') ?? 0,
        visible: getAttr(pin, 'visible') ?? getAttr(pinDefn, 'visible') ?? 1,
        isClock: getBoolChild(pin, 'IsClock'),
        isDot: getBoolChild(pin, 'IsDot'),
        isLong: getBoolChild(pin, 'IsLong'),
      });
    }
  }

  // Extract physical pin number mapping
  const pinNumbers = [];
  const physPart = normalView?.PhysicalPart || libPart?.PhysicalPart;
  if (physPart) {
    const pnums = physPart.PinNumber;
    if (pnums) {
      const pnArr = Array.isArray(pnums) ? pnums : [pnums];
      for (const pn of pnArr) {
        pinNumbers.push({
          number: getAttr(pn, 'number') || getAttr(pn?.Defn, 'number') || '',
          position: getAttr(pn, 'position') ?? getAttr(pn?.Defn, 'position') ?? 0,
        });
      }
    }
  }

  return {
    name: pkgName || '',
    pcbFootprint,
    refdesPrefix,
    userProps,
    symbolBBox,
    lines,
    pins,
    pinNumbers,
  };
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function getAttr(obj, attrName) {
  if (!obj) return undefined;
  // Try prefixed attribute first (from XMLParser with attributeNamePrefix)
  if (obj[`@_${attrName}`] !== undefined) return obj[`@_${attrName}`];
  // Try Defn child
  if (obj.Defn && obj.Defn[`@_${attrName}`] !== undefined) return obj.Defn[`@_${attrName}`];
  // Try direct property
  if (obj[attrName] !== undefined) return obj[attrName];
  return undefined;
}

function getBoolChild(pin, childName) {
  const child = pin?.[childName];
  if (!child) return false;
  const val = getAttr(child, 'val') ?? getAttr(child?.Defn, 'val');
  return val === 1 || val === '1' || val === true;
}

// ─── OLB Generation ────────────────────────────────────────────────────────

/**
 * Build a directory stream buffer
 * Format: 4-byte magic + 2-byte count + null-terminated entry names
 */
function buildDirectoryStream(entryNames) {
  const parts = [DIR_MAGIC];
  const countBuf = Buffer.alloc(2);
  countBuf.writeUInt16LE(entryNames.length, 0);
  parts.push(countBuf);

  for (const name of entryNames) {
    const nameBuf = Buffer.from(name + '\0', 'ascii');
    parts.push(nameBuf);
  }

  return Buffer.concat(parts);
}

/**
 * Build the Library stream containing header + font config
 */
function buildLibraryStream(componentData) {
  const parts = [];

  // Header: "OrCAD Windows Library" padded to 32 bytes
  parts.push(OLB_LIBRARY_HEADER);

  // Version / config block
  const configBlock = Buffer.alloc(16, 0);
  configBlock.writeUInt32LE(0x00010004, 0); // version marker
  configBlock.writeUInt32LE(24, 4); // font count
  configBlock.writeUInt32LE(0, 8);
  configBlock.writeUInt32LE(0, 12);
  parts.push(configBlock);

  // Font definitions
  parts.push(DEFAULT_FONT_CONFIG);

  // Page settings block (default A4-ish)
  const pageBlock = Buffer.alloc(48, 0);
  pageBlock.writeUInt32LE(1100, 0);  // width
  pageBlock.writeUInt32LE(800, 4);   // height
  parts.push(pageBlock);

  return Buffer.concat(parts);
}

/**
 * Encode a string as length-prefixed binary (2-byte LE length + ascii + null)
 */
function encodeString(str) {
  const strBuf = Buffer.from(str + '\0', 'ascii');
  const lenBuf = Buffer.alloc(2);
  lenBuf.writeUInt16LE(strBuf.length, 0);
  return Buffer.concat([lenBuf, strBuf]);
}

/**
 * Build the Package data stream for a component
 * This is a best-effort encoding based on reverse-engineering.
 * The format encodes: part name, pcb footprint, refdes prefix,
 * pin data, symbol graphics, and user properties.
 */
function buildPackageStream(componentData) {
  const parts = [];

  // Package header
  const headerFlags = Buffer.alloc(16, 0);
  headerFlags.writeUInt32LE(0x01, 0);   // version
  headerFlags.writeUInt32LE(componentData.pins.length, 4); // pin count
  headerFlags.writeUInt32LE(1, 8);      // part count (homogeneous)
  headerFlags.writeUInt32LE(0, 12);     // flags
  parts.push(headerFlags);

  // Package name
  parts.push(encodeString(componentData.name));

  // PCB footprint reference
  parts.push(encodeString(componentData.pcbFootprint));

  // Reference designator prefix
  parts.push(encodeString(componentData.refdesPrefix));

  // Symbol bounding box
  const bboxBuf = Buffer.alloc(16);
  bboxBuf.writeInt32LE(componentData.symbolBBox.x1, 0);
  bboxBuf.writeInt32LE(componentData.symbolBBox.y1, 4);
  bboxBuf.writeInt32LE(componentData.symbolBBox.x2, 8);
  bboxBuf.writeInt32LE(componentData.symbolBBox.y2, 12);
  parts.push(bboxBuf);

  // Graphic lines count + data
  const lineCountBuf = Buffer.alloc(4);
  lineCountBuf.writeUInt32LE(componentData.lines.length, 0);
  parts.push(lineCountBuf);

  for (const line of componentData.lines) {
    const lineBuf = Buffer.alloc(20);
    lineBuf.writeInt32LE(line.x1, 0);
    lineBuf.writeInt32LE(line.y1, 4);
    lineBuf.writeInt32LE(line.x2, 8);
    lineBuf.writeInt32LE(line.y2, 12);
    lineBuf.writeUInt32LE(0, 16); // line style
    parts.push(lineBuf);
  }

  // Pin count + pin data
  const pinCountBuf = Buffer.alloc(4);
  pinCountBuf.writeUInt32LE(componentData.pins.length, 0);
  parts.push(pinCountBuf);

  for (const pin of componentData.pins) {
    // Pin name
    parts.push(encodeString(pin.name));
    // Pin coordinates and type
    const pinBuf = Buffer.alloc(28);
    pinBuf.writeInt32LE(pin.hotptX, 0);
    pinBuf.writeInt32LE(pin.hotptY, 4);
    pinBuf.writeInt32LE(pin.startX, 8);
    pinBuf.writeInt32LE(pin.startY, 12);
    pinBuf.writeUInt32LE(pin.type, 16);
    pinBuf.writeUInt32LE(pin.position, 20);
    // Pin flags: visible, isClock, isDot, isLong
    let flags = 0;
    if (pin.visible) flags |= 0x01;
    if (pin.isClock) flags |= 0x02;
    if (pin.isDot) flags |= 0x04;
    if (pin.isLong) flags |= 0x08;
    pinBuf.writeUInt32LE(flags, 24);
    parts.push(pinBuf);
  }

  // Pin number mapping
  const pnCountBuf = Buffer.alloc(4);
  pnCountBuf.writeUInt32LE(componentData.pinNumbers.length, 0);
  parts.push(pnCountBuf);

  for (const pn of componentData.pinNumbers) {
    parts.push(encodeString(String(pn.number)));
    const posBuf = Buffer.alloc(4);
    posBuf.writeUInt32LE(pn.position, 0);
    parts.push(posBuf);
  }

  // User properties
  const propEntries = Object.entries(componentData.userProps);
  const propCountBuf = Buffer.alloc(4);
  propCountBuf.writeUInt32LE(propEntries.length, 0);
  parts.push(propCountBuf);

  for (const [key, value] of propEntries) {
    parts.push(encodeString(key));
    parts.push(encodeString(String(value)));
  }

  return Buffer.concat(parts);
}

/**
 * Generate an OLB (OLE2 compound file) from parsed component data
 * @param {Object} componentData - Output from parseCaptureXML()
 * @returns {Buffer} OLB file content
 */
export function generateOLB(componentData) {
  const partName = componentData.name;
  const cellNameA = partName + 'A';
  const cellNameB = partName + 'B';
  const partNameNormalA = cellNameA + '.Normal';
  const partNameNormalB = cellNameB + '.Normal';

  // Create new OLE2 compound file
  const cfbFile = CFB.utils.cfb_new();

  // Add storage directories
  CFB.utils.cfb_add(cfbFile, '/Cells', null, { type: 1 });
  CFB.utils.cfb_add(cfbFile, '/Parts', null, { type: 1 });
  CFB.utils.cfb_add(cfbFile, '/Views', null, { type: 1 });
  CFB.utils.cfb_add(cfbFile, '/Symbols', null, { type: 1 });
  CFB.utils.cfb_add(cfbFile, '/Graphics', null, { type: 1 });
  CFB.utils.cfb_add(cfbFile, '/Packages', null, { type: 1 });
  CFB.utils.cfb_add(cfbFile, '/ExportBlocks', null, { type: 1 });

  // Add Library stream
  const libraryStream = buildLibraryStream(componentData);
  CFB.utils.cfb_add(cfbFile, '/Library', libraryStream);

  // Add Cache stream (10 bytes of zeros)
  CFB.utils.cfb_add(cfbFile, '/Cache', Buffer.alloc(10, 0));

  // Add NetBundleMapData (4 bytes, LE uint32 = 2)
  const netMapBuf = Buffer.alloc(4);
  netMapBuf.writeUInt32LE(2, 0);
  CFB.utils.cfb_add(cfbFile, '/NetBundleMapData', netMapBuf);

  // Add directory streams
  CFB.utils.cfb_add(cfbFile, '/Cells Directory', buildDirectoryStream([cellNameA]));
  CFB.utils.cfb_add(cfbFile, '/Parts Directory', buildDirectoryStream([partNameNormalA]));
  CFB.utils.cfb_add(cfbFile, '/Views Directory', buildDirectoryStream([]));
  CFB.utils.cfb_add(cfbFile, '/Symbols Directory', buildDirectoryStream([]));
  CFB.utils.cfb_add(cfbFile, '/Graphics Directory', buildDirectoryStream([]));
  CFB.utils.cfb_add(cfbFile, '/Packages Directory', buildDirectoryStream([partName]));
  CFB.utils.cfb_add(cfbFile, '/ExportBlocks Directory', buildDirectoryStream([]));

  // Add $Types$ streams (empty)
  CFB.utils.cfb_add(cfbFile, '/Graphics/$Types$', Buffer.alloc(0));
  CFB.utils.cfb_add(cfbFile, '/Symbols/$Types$', Buffer.alloc(0));

  // Add Package data stream
  const packageData = buildPackageStream(componentData);
  CFB.utils.cfb_add(cfbFile, '/Packages/' + partName, packageData);

  // Write to buffer
  return Buffer.from(CFB.write(cfbFile, { type: 'buffer' }));
}

/**
 * Process a SamacSys Capture XML file:
 * 1. Parse the XML to extract component data
 * 2. Generate an OLB file
 * 3. Save both XML and OLB to the target directory
 *
 * @param {string} xmlContent - Raw XML string
 * @param {string} targetDir - Directory to save the generated files
 * @param {string} partName - Component part name (for filename)
 * @returns {Object} { olbPath, xmlPath, componentData }
 */
export function processCapturXML(xmlContent, targetDir, partName) {
  // Parse XML
  const componentData = parseCaptureXML(xmlContent);
  const safeName = partName || componentData.name || 'UNKNOWN';

  // Save the original XML (OrCAD can import this directly via File > Import)
  const xmlPath = path.join(targetDir, safeName + '.xml');
  fs.writeFileSync(xmlPath, xmlContent, 'utf8');

  // Generate and save OLB
  let olbPath = null;
  try {
    const olbBuffer = generateOLB(componentData);
    olbPath = path.join(targetDir, safeName + '.olb');
    fs.writeFileSync(olbPath, olbBuffer);
    console.log(`[OLB] Generated OLB: ${olbPath} (${olbBuffer.length} bytes)`);
  } catch (err) {
    console.error(`[OLB] Failed to generate OLB for ${safeName}:`, err.message);
    // XML is still saved as fallback
  }

  return {
    olbPath,
    xmlPath,
    componentData,
  };
}

/**
 * Generate a TCL batch script for OrCAD Capture to import multiple XML files into OLBs.
 * This is for users who want to use OrCAD's native XML import for guaranteed compatibility.
 *
 * @param {Array<{xmlPath: string, olbPath: string}>} files - List of XML files to process
 * @returns {string} TCL script content
 */
export function generateBatchImportTCL(files) {
  const lines = [
    '# Auto-generated TCL script for OrCAD Capture XML-to-OLB batch import',
    '# Run this script in OrCAD Capture: Tools > TCL/Tk > Execute Script',
    '#',
    '# This script imports SamacSys Capture XML files and saves them as OLB libraries.',
    '',
  ];

  for (const file of files) {
    const xmlPath = file.xmlPath.replace(/\\/g, '/');
    const olbPath = file.olbPath.replace(/\\/g, '/');
    lines.push(`# Import: ${path.basename(xmlPath)}`);
    lines.push(`set xmlFile "${xmlPath}"`);
    lines.push(`set olbFile "${olbPath}"`);
    lines.push('if {[file exists $xmlFile]} {');
    lines.push('  ::Capture::OpenLibrary $xmlFile');
    lines.push('  ::Capture::SaveAs $olbFile');
    lines.push('  ::Capture::CloseLibrary');
    lines.push('}');
    lines.push('');
  }

  lines.push('puts "Batch import complete."');
  return lines.join('\n');
}
