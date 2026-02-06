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
 *
 * Three output modes are supported:
 *   1. OLB binary (best-effort, may need TCL fallback for full compatibility)
 *   2. TCL script (uses OrCAD's Dbo API - guaranteed compatible when run in OrCAD)
 *   3. XML preservation (OrCAD can import XML directly via File > Import Library)
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

// Standard Library stream header
const OLB_LIBRARY_HEADER = (() => {
  const header = Buffer.alloc(32, 0x20);
  header.write('OrCAD Windows Library', 0, 'ascii');
  header[31] = 0x00;
  return header;
})();

// ─── XML Parsing ────────────────────────────────────────────────────────────

/**
 * Parse a SamacSys Capture XML file and extract all component data
 * per the olb.xsd schema.
 *
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

  // ── Package-level attributes ──
  const pkgName = getAttr(pkg, 'name') || '';
  const pcbFootprint = getAttr(pkg, 'pcbFootprint') || '';
  const refdesPrefix = getAttr(pkg, 'refdesPrefix') || 'U';
  const alphabeticNumbering = getAttr(pkg, 'alphabeticNumbering') ?? 0;
  const isHomogeneous = getAttr(pkg, 'isHomogeneous') ?? 1;

  // ── LibPart and NormalView ──
  const libPart = pkg.LibPart;
  const cellName = getAttr(libPart, 'CellName') || pkgName;
  const normalView = libPart?.NormalView;
  const viewSuffix = getAttr(normalView, 'suffix') || '.Normal';

  // ── DefaultValues fonts ──
  const defaultFonts = [];
  const defaultValues = lib.DefaultValues;
  if (defaultValues) {
    const fonts = defaultValues.DefaultFont;
    if (fonts) {
      const fontArr = Array.isArray(fonts) ? fonts : [fonts];
      for (const font of fontArr) {
        defaultFonts.push({
          index: getAttr(font, 'index') ?? defaultFonts.length,
          name: getAttr(font, 'name') || 'Arial',
          height: getAttr(font, 'height') ?? -9,
          width: getAttr(font, 'width') ?? 4,
          weight: getAttr(font, 'weight') ?? 400,
          italic: getAttr(font, 'italic') ?? 0,
          escapement: getAttr(font, 'escapement') ?? 0,
          orientation: getAttr(font, 'orientation') ?? 0,
        });
      }
    }
  }
  // Fill to 24 fonts if fewer
  while (defaultFonts.length < 24) {
    defaultFonts.push({
      index: defaultFonts.length,
      name: 'Arial',
      height: -9,
      width: 4,
      weight: 400,
      italic: 0,
      escapement: 0,
      orientation: 0,
    });
  }

  // ── Symbol display properties (Part Reference, Value, etc.) ──
  const displayProps = [];
  const symDisplayProps = normalView?.SymbolDisplayProp;
  if (symDisplayProps) {
    const props = Array.isArray(symDisplayProps) ? symDisplayProps : [symDisplayProps];
    for (const prop of props) {
      displayProps.push({
        name: getAttr(prop, 'name') || '',
        locX: getAttr(prop, 'locX') ?? 0,
        locY: getAttr(prop, 'locY') ?? 0,
        rotation: getAttr(prop, 'rotation') ?? 0,
        textJustification: getAttr(prop, 'textJustification') ?? 0,
      });
    }
  }

  // ── User properties (Manufacturer, Part Number, Description, etc.) ──
  const userProps = {};
  const symUserProps = normalView?.SymbolUserProp;
  if (symUserProps) {
    const props = Array.isArray(symUserProps) ? symUserProps : [symUserProps];
    for (const prop of props) {
      const name = getAttr(prop, 'name');
      const val = getAttr(prop, 'val') ?? '';
      if (name) userProps[name] = val;
    }
  }

  // ── Symbol color and visibility flags ──
  const symbolColor = getNestedVal(normalView, 'SymbolColor') ?? 48;
  const isPinNumbersVisible = getNestedVal(normalView, 'IsPinNumbersVisible') ?? 1;
  const isPinNamesRotated = getNestedVal(normalView, 'IsPinNamesRotated') ?? 0;
  const isPinNamesVisible = getNestedVal(normalView, 'IsPinNamesVisible') ?? 1;

  // ── Part value and reference ──
  const partValue = getNestedName(normalView, 'PartValue') || pkgName;
  const reference = getNestedName(normalView, 'Reference') || refdesPrefix;

  // ── Symbol bounding box ──
  const bbox = normalView?.SymbolBBox;
  const symbolBBox = bbox ? {
    x1: getAttr(bbox, 'x1') ?? 0,
    y1: getAttr(bbox, 'y1') ?? 0,
    x2: getAttr(bbox, 'x2') ?? 0,
    y2: getAttr(bbox, 'y2') ?? 0,
  } : { x1: 0, y1: 0, x2: 100, y2: 100 };

  // ── Graphic lines ──
  const lines = [];
  const xmlLines = normalView?.Line;
  if (xmlLines) {
    const lineArr = Array.isArray(xmlLines) ? xmlLines : [xmlLines];
    for (const line of lineArr) {
      lines.push({
        x1: getAttr(line, 'x1') ?? 0,
        y1: getAttr(line, 'y1') ?? 0,
        x2: getAttr(line, 'x2') ?? 0,
        y2: getAttr(line, 'y2') ?? 0,
        lineStyle: getAttr(line, 'lineStyle') ?? 0,
        lineWidth: getAttr(line, 'lineWidth') ?? 0,
      });
    }
  }

  // ── Rectangles (some symbols use Rect instead of 4 Lines) ──
  const rects = [];
  const xmlRects = normalView?.Rect;
  if (xmlRects) {
    const rectArr = Array.isArray(xmlRects) ? xmlRects : [xmlRects];
    for (const rect of rectArr) {
      rects.push({
        x1: getAttr(rect, 'x1') ?? 0,
        y1: getAttr(rect, 'y1') ?? 0,
        x2: getAttr(rect, 'x2') ?? 0,
        y2: getAttr(rect, 'y2') ?? 0,
        fillStyle: getAttr(rect, 'fillStyle') ?? 0,
        hatchStyle: getAttr(rect, 'hatchStyle') ?? 0,
        lineStyle: getAttr(rect, 'lineStyle') ?? 0,
        lineWidth: getAttr(rect, 'lineWidth') ?? 0,
      });
    }
  }

  // ── Pins (SymbolPinScalar) with all flags per XSD ──
  const pins = [];
  const xmlPins = normalView?.SymbolPinScalar;
  if (xmlPins) {
    const pinArr = Array.isArray(xmlPins) ? xmlPins : [xmlPins];
    for (const pin of pinArr) {
      pins.push({
        name: getAttr(pin, 'name') || '',
        position: getAttr(pin, 'position') ?? 0,
        hotptX: getAttr(pin, 'hotptX') ?? 0,
        hotptY: getAttr(pin, 'hotptY') ?? 0,
        startX: getAttr(pin, 'startX') ?? 0,
        startY: getAttr(pin, 'startY') ?? 0,
        type: getAttr(pin, 'type') ?? 0,
        visible: getAttr(pin, 'visible') ?? 1,
        // All 9 pin flags from XSD
        isLong: getBoolChild(pin, 'IsLong'),
        isClock: getBoolChild(pin, 'IsClock'),
        isDot: getBoolChild(pin, 'IsDot'),
        isLeftPointing: getBoolChild(pin, 'IsLeftPointing'),
        isRightPointing: getBoolChild(pin, 'IsRightPointing'),
        isNetStyle: getBoolChild(pin, 'IsNetStyle'),
        isNoConnect: getBoolChild(pin, 'IsNoConnect'),
        isGlobal: getBoolChild(pin, 'IsGlobal'),
        isNumberVisible: getBoolChild(pin, 'IsNumberVisible', true),
      });
    }
  }

  // ── Physical pin number mapping ──
  const pinNumbers = [];
  const physPart = libPart?.PhysicalPart;
  if (physPart) {
    const pnums = physPart.PinNumber;
    if (pnums) {
      const pnArr = Array.isArray(pnums) ? pnums : [pnums];
      for (const pn of pnArr) {
        pinNumbers.push({
          number: String(getAttr(pn, 'number') ?? ''),
          position: getAttr(pn, 'position') ?? 0,
        });
      }
    }
  }

  return {
    name: pkgName,
    pcbFootprint,
    refdesPrefix,
    alphabeticNumbering,
    isHomogeneous,
    cellName,
    viewSuffix,
    defaultFonts,
    displayProps,
    userProps,
    symbolColor,
    isPinNumbersVisible,
    isPinNamesRotated,
    isPinNamesVisible,
    partValue,
    reference,
    symbolBBox,
    lines,
    rects,
    pins,
    pinNumbers,
  };
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function getAttr(obj, attrName) {
  if (!obj) return undefined;
  if (obj[`@_${attrName}`] !== undefined) return obj[`@_${attrName}`];
  if (obj.Defn && obj.Defn[`@_${attrName}`] !== undefined) return obj.Defn[`@_${attrName}`];
  if (obj[attrName] !== undefined) return obj[attrName];
  return undefined;
}

function getBoolChild(pin, childName, defaultVal = false) {
  const child = pin?.[childName];
  if (!child) return defaultVal;
  const val = getAttr(child, 'val') ?? getAttr(child?.Defn, 'val');
  return val === 1 || val === '1' || val === true;
}

/** Get val attribute from a nested element like <SymbolColor><Defn val="48"/></SymbolColor> */
function getNestedVal(parent, childName) {
  const child = parent?.[childName];
  if (!child) return undefined;
  return getAttr(child, 'val');
}

/** Get name attribute from a nested element like <PartValue><Defn name="FT260S-R"/></PartValue> */
function getNestedName(parent, childName) {
  const child = parent?.[childName];
  if (!child) return undefined;
  return getAttr(child, 'name');
}

// ─── OLB Binary Generation ─────────────────────────────────────────────────

/**
 * Build a directory stream buffer
 * Format: 4-byte magic + 2-byte LE count + null-terminated entry names
 */
function buildDirectoryStream(entryNames) {
  const parts = [DIR_MAGIC];
  const countBuf = Buffer.alloc(2);
  countBuf.writeUInt16LE(entryNames.length, 0);
  parts.push(countBuf);
  for (const name of entryNames) {
    parts.push(Buffer.from(name + '\0', 'ascii'));
  }
  return Buffer.concat(parts);
}

/**
 * Build the Library stream: header + font config + page settings
 */
function buildLibraryStream(componentData) {
  const parts = [];

  // Header: "OrCAD Windows Library"
  parts.push(OLB_LIBRARY_HEADER);

  // Version/config block
  const configBlock = Buffer.alloc(16, 0);
  configBlock.writeUInt32LE(0x00010004, 0); // version marker
  configBlock.writeUInt32LE(componentData.defaultFonts.length, 4); // font count
  parts.push(configBlock);

  // Font definitions from XML DefaultValues
  for (const font of componentData.defaultFonts) {
    const entry = Buffer.alloc(44, 0);
    entry.writeUInt32LE(font.index, 0);
    entry.write(font.name.substring(0, 31), 4, 'ascii');
    entry.writeInt32LE(font.height, 36);
    entry.writeUInt32LE(font.weight, 40);
    parts.push(entry);
  }

  // Page settings block
  const pageBlock = Buffer.alloc(48, 0);
  pageBlock.writeUInt32LE(1100, 0);
  pageBlock.writeUInt32LE(800, 4);
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
 * Build the Package data stream for a component.
 * Binary format (best-effort reverse engineering):
 *   header(16) + name + footprint + refdes + bbox(16) + lines + pins + pinNumbers + userProps
 */
function buildPackageStream(componentData) {
  const parts = [];

  // Package header
  const headerFlags = Buffer.alloc(16, 0);
  headerFlags.writeUInt32LE(0x01, 0);
  headerFlags.writeUInt32LE(componentData.pins.length, 4);
  headerFlags.writeUInt32LE(1, 8);
  headerFlags.writeUInt32LE(0, 12);
  parts.push(headerFlags);

  // Package name, PCB footprint, reference designator prefix
  parts.push(encodeString(componentData.name));
  parts.push(encodeString(componentData.pcbFootprint));
  parts.push(encodeString(componentData.refdesPrefix));

  // Symbol bounding box
  const bboxBuf = Buffer.alloc(16);
  bboxBuf.writeInt32LE(componentData.symbolBBox.x1, 0);
  bboxBuf.writeInt32LE(componentData.symbolBBox.y1, 4);
  bboxBuf.writeInt32LE(componentData.symbolBBox.x2, 8);
  bboxBuf.writeInt32LE(componentData.symbolBBox.y2, 12);
  parts.push(bboxBuf);

  // Graphic lines (including lines derived from Rect elements)
  const allLines = [...componentData.lines];
  // Convert rects to 4 lines each
  for (const rect of componentData.rects) {
    allLines.push({ x1: rect.x1, y1: rect.y1, x2: rect.x2, y2: rect.y1, lineStyle: rect.lineStyle, lineWidth: rect.lineWidth });
    allLines.push({ x1: rect.x2, y1: rect.y1, x2: rect.x2, y2: rect.y2, lineStyle: rect.lineStyle, lineWidth: rect.lineWidth });
    allLines.push({ x1: rect.x2, y1: rect.y2, x2: rect.x1, y2: rect.y2, lineStyle: rect.lineStyle, lineWidth: rect.lineWidth });
    allLines.push({ x1: rect.x1, y1: rect.y2, x2: rect.x1, y2: rect.y1, lineStyle: rect.lineStyle, lineWidth: rect.lineWidth });
  }

  const lineCountBuf = Buffer.alloc(4);
  lineCountBuf.writeUInt32LE(allLines.length, 0);
  parts.push(lineCountBuf);

  for (const line of allLines) {
    const lineBuf = Buffer.alloc(24);
    lineBuf.writeInt32LE(line.x1, 0);
    lineBuf.writeInt32LE(line.y1, 4);
    lineBuf.writeInt32LE(line.x2, 8);
    lineBuf.writeInt32LE(line.y2, 12);
    lineBuf.writeUInt32LE(line.lineStyle ?? 0, 16);
    lineBuf.writeUInt32LE(line.lineWidth ?? 0, 20);
    parts.push(lineBuf);
  }

  // Pin count + pin data
  const pinCountBuf = Buffer.alloc(4);
  pinCountBuf.writeUInt32LE(componentData.pins.length, 0);
  parts.push(pinCountBuf);

  for (const pin of componentData.pins) {
    parts.push(encodeString(pin.name));
    const pinBuf = Buffer.alloc(32);
    pinBuf.writeInt32LE(pin.hotptX, 0);
    pinBuf.writeInt32LE(pin.hotptY, 4);
    pinBuf.writeInt32LE(pin.startX, 8);
    pinBuf.writeInt32LE(pin.startY, 12);
    pinBuf.writeUInt32LE(pin.type, 16);
    pinBuf.writeUInt32LE(pin.position, 20);
    // Pin flags bitmap: visible(0), isClock(1), isDot(2), isLong(3),
    // isLeftPointing(4), isRightPointing(5), isNetStyle(6),
    // isNoConnect(7), isGlobal(8), isNumberVisible(9)
    let flags = 0;
    if (pin.visible) flags |= 0x001;
    if (pin.isClock) flags |= 0x002;
    if (pin.isDot) flags |= 0x004;
    if (pin.isLong) flags |= 0x008;
    if (pin.isLeftPointing) flags |= 0x010;
    if (pin.isRightPointing) flags |= 0x020;
    if (pin.isNetStyle) flags |= 0x040;
    if (pin.isNoConnect) flags |= 0x080;
    if (pin.isGlobal) flags |= 0x100;
    if (pin.isNumberVisible) flags |= 0x200;
    pinBuf.writeUInt32LE(flags, 24);
    pinBuf.writeUInt32LE(0, 28); // reserved
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
 * Generate an OLB (OLE2 compound file) from parsed component data.
 *
 * @param {Object} componentData - Output from parseCaptureXML()
 * @returns {Buffer} OLB file content
 */
export function generateOLB(componentData) {
  const partName = componentData.name;

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
  CFB.utils.cfb_add(cfbFile, '/Library', buildLibraryStream(componentData));

  // Add Cache stream (10 bytes of zeros)
  CFB.utils.cfb_add(cfbFile, '/Cache', Buffer.alloc(10, 0));

  // Add NetBundleMapData (4 bytes, LE uint32 = 2)
  const netMapBuf = Buffer.alloc(4);
  netMapBuf.writeUInt32LE(2, 0);
  CFB.utils.cfb_add(cfbFile, '/NetBundleMapData', netMapBuf);

  // Add directory streams
  const cellName = componentData.cellName || partName;
  const normalName = cellName + (componentData.viewSuffix || '.Normal');
  CFB.utils.cfb_add(cfbFile, '/Cells Directory', buildDirectoryStream([cellName]));
  CFB.utils.cfb_add(cfbFile, '/Parts Directory', buildDirectoryStream([normalName]));
  CFB.utils.cfb_add(cfbFile, '/Views Directory', buildDirectoryStream([]));
  CFB.utils.cfb_add(cfbFile, '/Symbols Directory', buildDirectoryStream([]));
  CFB.utils.cfb_add(cfbFile, '/Graphics Directory', buildDirectoryStream([]));
  CFB.utils.cfb_add(cfbFile, '/Packages Directory', buildDirectoryStream([partName]));
  CFB.utils.cfb_add(cfbFile, '/ExportBlocks Directory', buildDirectoryStream([]));

  // Add $Types$ streams (empty)
  CFB.utils.cfb_add(cfbFile, '/Graphics/$Types$', Buffer.alloc(0));
  CFB.utils.cfb_add(cfbFile, '/Symbols/$Types$', Buffer.alloc(0));

  // Add Package data stream
  CFB.utils.cfb_add(cfbFile, '/Packages/' + partName, buildPackageStream(componentData));

  // Write to buffer
  return Buffer.from(CFB.write(cfbFile, { type: 'buffer' }));
}

// ─── TCL Script Generation ──────────────────────────────────────────────────

/**
 * Generate a TCL script that uses OrCAD's Dbo API to create an OLB from parsed
 * component data. This is the reliable path for OLB creation - the generated
 * script can be executed in OrCAD Capture (Tools > TCL/Tk > Execute Script)
 * and will produce a guaranteed-valid OLB file.
 *
 * The output follows the same structure as the reference ft260s-r.tcl from
 * SamacSys's XMATIC tool.
 *
 * @param {Object} componentData - Output from parseCaptureXML()
 * @param {string} outputOlbPath - Target OLB file path (for the TCL to save to)
 * @returns {string} TCL script content
 */
export function generateTCL(componentData, outputOlbPath) {
  const olbPath = outputOlbPath.replace(/\\/g, '/');
  const L = []; // lines

  L.push('# Auto-generated TCL script for OrCAD Capture OLB creation');
  L.push('# Run in OrCAD Capture: Tools > TCL/Tk > Execute Script');
  L.push(`# Component: ${componentData.name}`);
  L.push(`# Pins: ${componentData.pins.length}`);
  L.push(`# PCB Footprint: ${componentData.pcbFootprint}`);
  L.push('');
  L.push('proc ::orTransformStrOut {str} { return $str }');
  L.push('');

  // Create library session
  L.push('set mSession [DboTclHelper_sCreateSession]');
  L.push(`set mLibPath [DboTclHelper_sMakeCString "${olbPath}"]`);
  L.push('set mLib [$mSession OpenLib $mLibPath $mStatus]');
  L.push('set mStatusVal [$mStatus Failed]');
  L.push('if {$mStatusVal == 1} {');
  L.push('  set mLib [$mSession CreateLib $mStatus $mLibPath]');
  L.push('  set mStatusVal [$mStatus Failed]');
  L.push('  if {$mStatusVal == 1} { puts "ERROR: Failed to create library"; exit }');
  L.push('}');
  L.push('');

  // Set fonts
  for (const font of componentData.defaultFonts) {
    L.push(`set mFontName [DboTclHelper_sMakeCString "${font.name}"]`);
    L.push(`set mStatus [$mLib SetDefaultFont ${font.index} $mFontName ${font.height} ${font.width} ${font.italic} ${font.weight}]`);
  }
  L.push('');

  // Create Package
  const pkgName = componentData.name;
  L.push(`puts "Creating Package: ${pkgName}"`);
  L.push(`set lPackageName [DboTclHelper_sMakeCString "${pkgName}"]`);
  L.push(`set lRefDes [DboTclHelper_sMakeCString "${componentData.refdesPrefix}"]`);
  L.push(`set lPCBFoot [DboTclHelper_sMakeCString "${componentData.pcbFootprint}"]`);
  L.push(`set mPackage [$mLib NewPackage $mStatus $lPackageName $lRefDes 0 0 $lPCBFoot]`);
  L.push('set mStatusVal [$mStatus Failed]');
  L.push('if {$mStatusVal == 1} exit');
  L.push('');

  // Create Cell and Symbol
  const cellName = componentData.cellName || pkgName;
  L.push(`set lCellName [DboTclHelper_sMakeCString "${cellName}"]`);
  L.push(`set mCell [$mPackage NewCell $mStatus $lCellName]`);
  L.push('set mStatusVal [$mStatus Failed]');
  L.push('if {$mStatusVal == 1} exit');
  L.push('');

  const normalName = pkgName + (componentData.viewSuffix || '.Normal');
  L.push(`set lSymName [DboTclHelper_sMakeCString "${normalName}"]`);
  L.push('set mLibPart [$mCell NewPart $mStatus $lSymName]');
  L.push('set mStatusVal [$mStatus Failed]');
  L.push('if {$mStatusVal == 1} exit');
  L.push('set mSymbol [$mLibPart NewSymbol $mStatus 0]');
  L.push('set mStatusVal [$mStatus Failed]');
  L.push('if {$mStatusVal == 1} exit');
  L.push('');

  // Set symbol bounding box
  const bb = componentData.symbolBBox;
  L.push(`set mStatus [$mSymbol SetBBox [DboTclHelper_sMakeCRect ${bb.x1} ${bb.y1} ${bb.x2} ${bb.y2}]]`);
  L.push('');

  // Display properties (Part Reference, Value)
  for (const dp of componentData.displayProps) {
    L.push(`set lPropName [DboTclHelper_sMakeCString "${dp.name}"]`);
    L.push(`set pLoc [DboTclHelper_sMakeCPoint ${dp.locX} ${dp.locY}]`);
    L.push(`set mStatus [$mSymbol NewSymbolDisplayProp $mStatus $lPropName $pLoc ${dp.rotation}]`);
    L.push('set mStatusVal [$mStatus Failed]');
    L.push('if {$mStatusVal == 1} exit');
  }
  L.push('');

  // User properties
  for (const [key, value] of Object.entries(componentData.userProps)) {
    const safeVal = String(value).replace(/"/g, '\\"');
    L.push(`set lPropName [DboTclHelper_sMakeCString "${key}"]`);
    L.push(`set lPropVal [DboTclHelper_sMakeCString "${safeVal}"]`);
    L.push('set mStatus [$mSymbol NewSymbolUserProp $mStatus $lPropName $lPropVal]');
    L.push('set mStatusVal [$mStatus Failed]');
    L.push('if {$mStatusVal == 1} exit');
  }
  L.push('');

  // Lines (symbol body)
  for (const line of componentData.lines) {
    L.push(`set pStart [DboTclHelper_sMakeCPoint ${line.x1} ${line.y1}]`);
    L.push(`set pEnd [DboTclHelper_sMakeCPoint ${line.x2} ${line.y2}]`);
    L.push(`set mStatus [$mSymbol NewSymbolLine $mStatus $pStart $pEnd ${line.lineStyle ?? 0} ${line.lineWidth ?? 0}]`);
    L.push('set mStatusVal [$mStatus Failed]');
    L.push('if {$mStatusVal == 1} exit');
  }

  // Rects
  for (const rect of componentData.rects) {
    L.push(`set pTL [DboTclHelper_sMakeCPoint ${rect.x1} ${rect.y1}]`);
    L.push(`set pBR [DboTclHelper_sMakeCPoint ${rect.x2} ${rect.y2}]`);
    L.push(`set mStatus [$mSymbol NewSymbolRect $mStatus $pTL $pBR ${rect.fillStyle ?? 0} ${rect.hatchStyle ?? 0} ${rect.lineStyle ?? 0} ${rect.lineWidth ?? 0}]`);
    L.push('set mStatusVal [$mStatus Failed]');
    L.push('if {$mStatusVal == 1} exit');
  }
  L.push('');

  // Pins
  for (const pin of componentData.pins) {
    const safeName = pin.name.replace(/"/g, '\\"');
    L.push(`puts "Writing PinScalar..${pin.name}"`);
    L.push(`set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut {${safeName}}]]`);
    L.push(`set pStart [DboTclHelper_sMakeCPoint ${pin.startX} ${pin.startY}]`);
    L.push(`set pHotPoint [DboTclHelper_sMakeCPoint ${pin.hotptX} ${pin.hotptY}]`);
    L.push(`set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName ${pin.type} $pStart $pHotPoint ${pin.visible} ${pin.position}]`);
    L.push('set mStatusVal [$mStatus Failed]');
    L.push('if {$mStatusVal == 1} exit');
    // Pin flags
    L.push(`  set mStatus [$mPin SetIsLong ${pin.isLong ? 1 : 0}]`);
    L.push(`  set mStatus [$mPin SetIsClock ${pin.isClock ? 1 : 0}]`);
    L.push(`  set mStatus [$mPin SetIsDot ${pin.isDot ? 1 : 0}]`);
    L.push(`  set mStatus [$mPin SetIsLeftPointing ${pin.isLeftPointing ? 1 : 0}]`);
    L.push(`  set mStatus [$mPin SetIsRightPointing ${pin.isRightPointing ? 1 : 0}]`);
    L.push(`  set mStatus [$mPin SetIsNetStyle ${pin.isNetStyle ? 1 : 0}]`);
    L.push(`  set mStatus [$mPin SetIsNoConnect ${pin.isNoConnect ? 1 : 0}]`);
    L.push(`  set mStatus [$mPin SetIsGlobal ${pin.isGlobal ? 1 : 0}]`);
    L.push(`  set mStatus [$mPin SetIsNumberVisible ${pin.isNumberVisible ? 1 : 0}]`);
    L.push('');
  }

  // Save part
  L.push('set mStatus [$mLib SavePart $mLibPart]');
  L.push('set mStatusVal [$mStatus Failed]');
  L.push('if {$mStatusVal == 1} exit');
  L.push('');

  // Physical part (device) with pin number mapping
  L.push('set lDesignator [DboTclHelper_sMakeCString ""]');
  L.push('set mDevice [$mPackage NewDevice $lDesignator 0 $mCell $mStatus]');
  L.push('set mStatusVal [$mStatus Failed]');
  L.push('if {$mStatusVal == 1} exit');

  for (const pn of componentData.pinNumbers) {
    L.push(`  set lPinNum [DboTclHelper_sMakeCString "${pn.number}"]`);
    L.push(`  set pPosition [DboTclHelper_sMakeInt ${pn.position}]`);
    L.push('  set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]');
    L.push('  set mStatusVal [$mStatus Failed]');
    L.push('  if {$mStatusVal == 1} exit');
  }
  L.push('');

  // Save package and library
  L.push('set mStatus [$mLib SavePackageAll $mPackage]');
  L.push('set mStatusVal [$mStatus Failed]');
  L.push('if {$mStatusVal == 1} exit');
  L.push('');
  L.push(`puts "Saving Library: ${olbPath}"`);
  L.push('set mStatus [$mSession SaveLib $mLib]');
  L.push('set mStatusVal [$mStatus Failed]');
  L.push('if {$mStatusVal == 1} exit');
  L.push('DboTclHelper_sDeleteSession $mSession');
  L.push('puts "Done."');

  return L.join('\n');
}

// ─── High-Level API ─────────────────────────────────────────────────────────

/**
 * Convert a SamacSys Capture XML string to OLB + XML files.
 *
 * Outputs:
 *   - <partName>.olb  - Binary OLB (OLE2 compound file)
 *   - <partName>.xml  - Original XML (OrCAD can import directly as fallback)
 *
 * @param {string} xmlContent - Raw XML string from Capture/<part>.xml
 * @param {string} targetDir - Directory to save the generated files
 * @param {string} [partName] - Override part name (defaults to name from XML)
 * @param {Object} [options] - Options
 * @param {boolean} [options.keepXml=true] - Whether to save the XML alongside
 * @returns {Object} { olbPath, olbFilename, tclPath, xmlPath, componentData }
 */
export function convertCaptureXmlToOlb(xmlContent, targetDir, partName, options = {}) {
  const { keepXml = true } = options;

  // Parse XML
  const componentData = parseCaptureXML(xmlContent);
  const safeName = partName || componentData.name || 'UNKNOWN';

  // Save the original XML as fallback
  let xmlPath = null;
  if (keepXml) {
    xmlPath = path.join(targetDir, safeName + '.xml');
    fs.writeFileSync(xmlPath, xmlContent, 'utf8');
  }

  // Generate and save OLB binary
  const olbBuffer = generateOLB(componentData);
  const olbPath = path.join(targetDir, safeName + '.olb');
  fs.writeFileSync(olbPath, olbBuffer);

  console.log(`[OLB] Generated: ${safeName}.olb (${olbBuffer.length}b), ${keepXml ? '.xml' : 'no xml'} | ${componentData.pins.length} pins`);

  return {
    olbPath,
    olbFilename: safeName + '.olb',
    xmlPath,
    componentData,
  };
}

/**
 * Check if an XML string is a valid SamacSys Capture XML (has <Lib> root with <Package>)
 * @param {string} xmlContent - Raw XML string
 * @returns {boolean}
 */
export function isCaptureXML(xmlContent) {
  try {
    const parsed = xmlParser.parse(xmlContent);
    return !!(parsed?.Lib?.Package);
  } catch {
    return false;
  }
}
