/**
 * SamacSys OLB Generator Service
 *
 * Converts SamacSys Capture XML files to OrCAD OLB library files using
 * the OrCAD Dbo TCL API. Generates a TCL script matching the XMATIC format
 * and executes it via tclsh with the OrCAD Dbo DLLs.
 *
 * Environment variables:
 *   ORCAD_TCLSH_PATH  - Path to tclsh.exe (defaults to example/olb/tcltk/tcltk/bin/tclsh.exe)
 *   ORCAD_DLL_DIR     - Directory containing orDb_Dll_Tcl64.dll and orDb_Dll64.dll
 *
 * Platform support:
 *   - Windows: Runs tclsh.exe directly with OrCAD DLLs
 *   - Linux/Docker: Runs tclsh.exe via Wine64, paths converted to Wine Z: drive
 *
 * Two execution modes:
 *   1. TCL execution (reliable): Generates TCL script, runs via tclsh + Dbo DLLs
 *   2. TCL script only (fallback): Generates TCL script for manual execution in OrCAD Capture
 */

import { XMLParser } from 'fast-xml-parser';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Platform Detection ─────────────────────────────────────────────────────

const IS_WINDOWS = process.platform === 'win32';

/**
 * Convert a native path to a Wine-compatible path (Z: drive prefix).
 * On Windows, returns the path unchanged.
 */
function toWinePath(nativePath) {
  if (IS_WINDOWS) return nativePath;
  // Wine maps Z: to the Linux root filesystem
  return 'Z:' + nativePath;
}

// ─── XML Parser Configuration ───────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseAttributeValue: true,
  trimValues: true,
});

// ─── OrCAD Tools Path Resolution ────────────────────────────────────────────

const EXAMPLE_OLB_DIR = path.resolve(__dirname, '../../../example/olb');

function getOrcadToolPaths() {
  const dllDir = process.env.ORCAD_DLL_DIR || EXAMPLE_OLB_DIR;

  // Look for tclsh.exe in order: env var, alongside DLLs, nested tcltk dir
  let tclshPath = process.env.ORCAD_TCLSH_PATH;
  if (!tclshPath) {
    const flatPath = path.join(dllDir, 'tclsh.exe');
    const nestedPath = path.join(EXAMPLE_OLB_DIR, 'tcltk', 'tcltk', 'bin', 'tclsh.exe');
    tclshPath = fs.existsSync(flatPath) ? flatPath : nestedPath;
  }

  return { tclshPath, dllDir };
}

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
          charSet: getAttr(font, 'charSet') ?? 0,
          outPrecision: getAttr(font, 'outPrecision') ?? 7,
          clipPrecision: getAttr(font, 'clipPrecision') ?? 0,
          quality: getAttr(font, 'quality') ?? 1,
          pitchAndFamily: getAttr(font, 'pitchAndFamily') ?? 16,
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
      charSet: 0,
      outPrecision: 7,
      clipPrecision: 0,
      quality: 1,
      pitchAndFamily: 16,
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
        color: getAttr(prop, 'color') ?? 48,
        displayType: getAttr(prop, 'displayType') ?? 1,
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

function getNestedVal(parent, childName) {
  const child = parent?.[childName];
  if (!child) return undefined;
  return getAttr(child, 'val');
}

function getNestedName(parent, childName) {
  const child = parent?.[childName];
  if (!child) return undefined;
  return getAttr(child, 'name');
}

/**
 * Escape a string for TCL brace quoting.
 * Uses {string} syntax which handles most special chars except unbalanced braces.
 */
function tclStr(str) {
  const s = String(str);
  // If the string has unbalanced braces, use double-quote escaping instead
  const openCount = (s.match(/\{/g) || []).length;
  const closeCount = (s.match(/\}/g) || []).length;
  if (openCount !== closeCount) {
    return '"' + s.replace(/[\\"$[\]]/g, '\\$&') + '"';
  }
  return '{' + s + '}';
}

// ─── TCL Script Generation (XMATIC-compatible) ─────────────────────────────

/**
 * Generate a TCL script that uses OrCAD's Dbo API to create an OLB.
 * The output follows the exact same API call patterns as the XMATIC tool
 * used by SamacSys (reference: ft260s-r.tcl).
 *
 * Can be executed either:
 *   - Standalone via tclsh.exe after loading orDb_Dll_Tcl64.dll
 *   - In OrCAD Capture: Tools > TCL/Tk > Execute Script
 *
 * @param {Object} componentData - Output from parseCaptureXML()
 * @param {string} outputOlbPath - Target OLB file path
 * @param {Object} [options] - Options
 * @param {boolean} [options.standalone=false] - Include DLL load for standalone execution
 * @returns {string} TCL script content
 */
export function generateTCL(componentData, outputOlbPath, options = {}) {
  const { standalone = false } = options;
  const olbPath = outputOlbPath.replace(/\\/g, '/');
  const olbPathUpper = olbPath.toUpperCase();
  const L = []; // lines
  const pkgName = componentData.name;
  const cellName = componentData.cellName || pkgName;
  const normalName = pkgName + (componentData.viewSuffix || '.Normal');

  // ── String transform proc (matches XMATIC) ──
  L.push('  proc orTransformStrOut { pString } {');
  L.push('\tset pString [string map {__cdsOpenBrac__ \\{ } $pString]');
  L.push('\tset pString [string map {__cdsCloseBrac__ \\} } $pString]');
  L.push('\tset pString [string map {__cdsNewLine__ \\r\\n } $pString]');
  L.push('\tset pString [string map {__cdsSlashAtLast__ \\\\ } $pString]');
  L.push('\treturn $pString');
  L.push(' }');

  // ── Standalone DLL loading ──
  if (standalone) {
    L.push('');
    L.push('  # Load OrCAD Dbo DLL for standalone execution');
    L.push('  set dllPath [file join [pwd] orDb_Dll_Tcl64.dll]');
    L.push('  load $dllPath DboTclWriteBasic');
  }

  // ── Session creation ──
  L.push('  set mSession [DboTclHelper_sCreateSession]');
  L.push('  set mStatus [DboState]');

  // Try to get/open existing then create (matches XMATIC pattern)
  L.push(`  set lName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(olbPath.toLowerCase())}]]`);
  L.push('  $mSession GetLib $lName $mStatus');
  L.push(`  set lName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(olbPathUpper)}]]`);
  L.push('  set mLib [$mSession GetLib $lName $mStatus]');
  L.push(`  set lName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(olbPathUpper)}]]`);
  L.push('  set mLib [$mSession CreateLib $lName $mStatus]');
  L.push('  ');
  L.push(`  puts [::orTransformStrOut ${tclStr('INFO(ORDBDLL-1229): XMATIC : Creating Library..' + olbPathUpper)}]`);
  L.push('  set mStatusVal [$mStatus Failed]');
  L.push('  if {$mStatusVal == 1} exit');

  // ── Set 24 default fonts ──
  for (const font of componentData.defaultFonts) {
    const f = font;
    L.push(`      set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut ${tclStr(f.name)}] ${f.height} ${f.width} ${f.escapement} ${f.orientation} ${f.weight} ${f.italic} 0 ${f.charSet} ${f.outPrecision} ${f.clipPrecision} 0 ${f.quality} ${f.pitchAndFamily}]`);
    L.push(`      $mLib SetDefaultFont ${f.index} $pFont`);
    L.push('      set mStatusVal [$mStatus Failed]');
    L.push('      if {$mStatusVal == 1} exit');
  }

  // ── Library settings ──
  L.push('      set mStatusVal [$mStatus Failed]');
  L.push('      if {$mStatusVal == 1} exit');
  L.push('      $mLib SetDefaultPlacedInstIsPrimitive 0');
  L.push('      set mStatusVal [$mStatus Failed]');
  L.push('      if {$mStatusVal == 1} exit');
  L.push('      $mLib SetDefaultDrawnInstIsPrimitive 0');
  L.push('      set mStatusVal [$mStatus Failed]');
  L.push('      if {$mStatusVal == 1} exit');

  // ── Part field mappings (standard OrCAD defaults) ──
  const fieldMappings = [
    '1ST PART FIELD', '2ND PART FIELD', '3RD PART FIELD',
    '4TH PART FIELD', '5TH PART FIELD', '6TH PART FIELD',
    '7TH PART FIELD', 'PCB Footprint',
  ];
  for (let i = 0; i < fieldMappings.length; i++) {
    L.push(`      set lStr [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(fieldMappings[i])}]]`);
    L.push(`      $mLib SetPartFieldMapping ${i + 1} $lStr`);
    L.push('      set mStatusVal [$mStatus Failed]');
    L.push('      if {$mStatusVal == 1} exit');
  }

  // ── Package creation ──
  L.push('    ');
  L.push(`    puts [::orTransformStrOut ${tclStr('INFO(ORDBDLL-1229): XMATIC : Writing package..' + pkgName)}]`);
  L.push(`    set lPackageName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(pkgName)}]]`);
  L.push(`    set lSourceLibName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr('')}]]`);
  L.push('    set mPackage [$mLib NewPackage $lPackageName $mStatus]');
  L.push('    set mSourceLibName $lSourceLibName');
  L.push('    set mStatusVal [$mStatus Failed]');
  L.push('    if {$mStatusVal == 1} exit');

  // Set reference template and PCB footprint separately (matches XMATIC)
  L.push(`    set lRefDesPrefix [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(componentData.refdesPrefix)}]]`);
  L.push('    set mStatus [$mPackage SetReferenceTemplate $lRefDesPrefix]');
  L.push(`    set lPCBLib [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr('')}]]`);
  L.push('    set mStatus [$mPackage SetPCBLib $lPCBLib]');
  L.push(`    set lPCBFootprint [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(componentData.pcbFootprint)}]]`);
  L.push('    set mStatus [$mPackage SetPCBFootprint $lPCBFootprint]');
  L.push('    set mStatusVal [$mStatus Failed]');
  L.push('    if {$mStatusVal == 1} exit');

  // ── Cell creation ──
  L.push(`      set lPackageName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(pkgName)}]]`);
  L.push('      $mPackage GetName $lPackageName');
  L.push(`      set mCellName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(cellName)}]]`);
  L.push('      set mCell [$mLib NewCell $mCellName $mStatus]');
  L.push('      set mStatusVal [$mStatus Failed]');
  L.push('      if {$mStatusVal == 1} exit');

  // ── Part/Symbol creation ──
  L.push(`        set lName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(normalName)}]]`);
  L.push('        set mSymbol [$mLib NewPart $lName $mStatus]');
  L.push('        set lLibPart $mSymbol');
  L.push('        set mStatusVal [$mStatus Failed]');
  L.push('        if {$mStatusVal == 1} exit');
  L.push('        set mStatus [$mCell AddPart $mSymbol]');
  L.push('        set mStatusVal [$mStatus Failed]');
  L.push('        if {$mStatusVal == 1} exit');

  // Initial bounding box (small, then updated after content)
  L.push('        set BodyRect [DboTclHelper_sMakeCRect 0 0 50 50 ]');
  L.push('        set mStatus [$mSymbol SetBoundingBox $BodyRect]');
  L.push('        set mStatusVal [$mStatus Failed]');
  L.push('        if {$mStatusVal == 1} exit');

  // Set reference on LibPart
  L.push(`        set lRef [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(componentData.refdesPrefix)}]]`);
  L.push('        $mPackage GetReferenceTemplate $lRef');
  L.push('        set mStatus [$mSymbol SetReference $lRef]');
  L.push('        set mStatusVal [$mStatus Failed]');
  L.push('        if {$mStatusVal == 1} exit');

  // Set cell/package pointers
  L.push('        $lLibPart SetCellPtr $mCell');
  L.push('        $lLibPart SetPackagePtr $mPackage');
  L.push('        set mStatusVal [$mStatus Failed]');
  L.push('        if {$mStatusVal == 1} exit');

  // ── Display properties (Part Reference, Value) ──
  for (const dp of componentData.displayProps) {
    L.push('          ');
    L.push(`          puts [::orTransformStrOut ${tclStr('INFO(ORDBDLL-1229): XMATIC : Writing SymbolDisplayProp..' + dp.name)}]`);
    L.push(`          set lPropName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(dp.name)}]]`);
    L.push(`          set pLocation [DboTclHelper_sMakeCPoint ${dp.locX} ${dp.locY}]`);
    // Font used for display prop creation (uses prop name as face, then overridden)
    L.push(`          set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut ${tclStr(dp.name)}] 8 0 0 0 400 0 0 0 0 7 0 1 16]`);
    L.push(`          set mProp [$mSymbol NewDisplayProp $mStatus $lPropName $pLocation ${dp.rotation} $pFont ${dp.color}]`);
    if (dp.textJustification) {
      L.push(`          $mProp SetHorizontalTextJustification ${dp.textJustification}`);
    }
    L.push('          set mStatusVal [$mStatus Failed]');
    L.push('          if {$mStatusVal == 1} exit');
    // Set actual font (Arial) and formatting
    L.push('            set pFont [DboTclHelper_sMakeLOGFONT [::orTransformStrOut {Arial}] -9 4 0 0 400 0 0 0 0 7 0 1 16]');
    L.push('            set mStatus [$mProp SetFont $pFont]');
    L.push('            set mStatusVal [$mStatus Failed]');
    L.push('            if {$mStatusVal == 1} exit');
    L.push(`            set mStatus [$mProp SetColor ${dp.color}]`);
    L.push('            set mStatusVal [$mStatus Failed]');
    L.push('            if {$mStatusVal == 1} exit');
    L.push(`            set mStatus [$mProp SetDisplayType ${dp.displayType}]`);
    L.push('            set mStatusVal [$mStatus Failed]');
    L.push('            if {$mStatusVal == 1} exit');
  }

  // ── User properties ──
  for (const [key, value] of Object.entries(componentData.userProps)) {
    L.push('          ');
    L.push(`          puts [::orTransformStrOut ${tclStr('INFO(ORDBDLL-1229): XMATIC : Writing SymbolUserProp..' + key)}]`);
    L.push(`          set lPropName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(key)}]]`);
    L.push(`          set lPropValue [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(String(value))}]]`);
    L.push('          $mSymbol NewUserProp $lPropName $lPropValue $mStatus');
    L.push('          set mStatusVal [$mStatus Failed]');
    L.push('          if {$mStatusVal == 1} exit');
  }

  // ── Symbol color and final bounding box ──
  L.push(`          set mStatus [$mSymbol SetColor ${componentData.symbolColor}]`);
  L.push('          set mStatusVal [$mStatus Failed]');
  L.push('          if {$mStatusVal == 1} exit');
  const bb = componentData.symbolBBox;
  L.push(`          set pRect [DboTclHelper_sMakeCRect ${bb.x1} ${bb.y1} ${bb.x2} ${bb.y2} ]`);
  L.push('          set mStatus [$mSymbol SetBoundingBox $pRect]');
  L.push('          set mStatusVal [$mStatus Failed]');
  L.push('          if {$mStatusVal == 1} exit');

  // ── Visibility flags ──
  L.push(`          set mStatus [$lLibPart SetPinNumbersAreVisible ${componentData.isPinNumbersVisible}]`);
  L.push('          set mStatusVal [$mStatus Failed]');
  L.push('          if {$mStatusVal == 1} exit');
  L.push(`          set mStatus [$lLibPart SetPinNamesAreRotated ${componentData.isPinNamesRotated}]`);
  L.push('          set mStatusVal [$mStatus Failed]');
  L.push('          if {$mStatusVal == 1} exit');
  L.push(`          set mStatus [$lLibPart SetPinNamesAreVisible ${componentData.isPinNamesVisible}]`);
  L.push('          set mStatusVal [$mStatus Failed]');
  L.push('          if {$mStatusVal == 1} exit');

  // ── Contents lib/view settings ──
  L.push('          set lLibPart [DboSymbolToDboLibPart $mSymbol]');
  L.push(`          set lContentsLibName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr('')}]]`);
  L.push('          set mStatus [$lLibPart SetContentsLibName $lContentsLibName]');
  L.push('          set mStatusVal [$mStatus Failed]');
  L.push('          if {$mStatusVal == 1} exit');
  L.push('          set lLibPart [DboSymbolToDboLibPart $mSymbol]');
  L.push(`          set lContentsViewName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr('')}]]`);
  L.push('          set mStatus [$lLibPart SetContentsViewName $lContentsViewName]');
  L.push('          set mStatusVal [$mStatus Failed]');
  L.push('          if {$mStatusVal == 1} exit');
  L.push('          set lLibPart [DboSymbolToDboLibPart $mSymbol]');
  L.push('          set mStatus [$lLibPart SetContentsViewType 0]');
  L.push('          set mStatusVal [$mStatus Failed]');
  L.push('          if {$mStatusVal == 1} exit');

  // ── Part value and reference ──
  L.push('          set lLibPart [DboSymbolToDboLibPart $mSymbol]');
  L.push(`          set lPartValueName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(componentData.partValue)}]]`);
  L.push('          set mStatus [$lLibPart SetPartValue $lPartValueName]');
  L.push('          set mStatusVal [$mStatus Failed]');
  L.push('          if {$mStatusVal == 1} exit');
  L.push('          set lLibPart [DboSymbolToDboLibPart $mSymbol]');
  L.push(`          set lReferenceName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(componentData.reference)}]]`);
  L.push('          set mStatus [$lLibPart SetReference $lReferenceName]');
  L.push('          set mStatusVal [$mStatus Failed]');
  L.push('          if {$mStatusVal == 1} exit');

  // ── Lines (symbol body) ──
  for (const line of componentData.lines) {
    L.push(`          set pStart [DboTclHelper_sMakeCPoint ${line.x1} ${line.y1}]`);
    L.push(`          set pEnd [DboTclHelper_sMakeCPoint ${line.x2} ${line.y2}]`);
    L.push(`          $mSymbol NewLine $mStatus $pStart $pEnd ${line.lineStyle ?? 0} ${line.lineWidth ?? 0}`);
    L.push('          set mStatusVal [$mStatus Failed]');
    L.push('          if {$mStatusVal == 1} exit');
  }

  // ── Rectangles ──
  for (const rect of componentData.rects) {
    L.push(`          set pTL [DboTclHelper_sMakeCPoint ${rect.x1} ${rect.y1}]`);
    L.push(`          set pBR [DboTclHelper_sMakeCPoint ${rect.x2} ${rect.y2}]`);
    L.push(`          $mSymbol NewRect $mStatus $pTL $pBR ${rect.fillStyle ?? 0} ${rect.hatchStyle ?? 0} ${rect.lineStyle ?? 0} ${rect.lineWidth ?? 0}`);
    L.push('          set mStatusVal [$mStatus Failed]');
    L.push('          if {$mStatusVal == 1} exit');
  }

  // ── Pins ──
  for (const pin of componentData.pins) {
    L.push('          ');
    L.push(`          puts [::orTransformStrOut ${tclStr('INFO(ORDBDLL-1229): XMATIC : Writing PinScalar..' + pin.name)}]`);
    L.push(`          set lPinName [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(pin.name)}]]`);
    L.push(`          set pStart [DboTclHelper_sMakeCPoint ${pin.startX} ${pin.startY}]`);
    L.push(`          set pHotPoint [DboTclHelper_sMakeCPoint ${pin.hotptX} ${pin.hotptY}]`);
    L.push(`          set mPin [$mSymbol NewSymbolPinScalar $mStatus $lPinName ${pin.type} $pStart $pHotPoint ${pin.visible} ${pin.position}]`);
    L.push('          set mStatusVal [$mStatus Failed]');
    L.push('          if {$mStatusVal == 1} exit');
    // Pin flags (each with status check, matching XMATIC)
    L.push(`            set mStatus [$mPin SetIsLong ${pin.isLong ? 1 : 0}]`);
    L.push('            set mStatusVal [$mStatus Failed]');
    L.push('            if {$mStatusVal == 1} exit');
    L.push(`            set mStatus [$mPin SetIsClock ${pin.isClock ? 1 : 0}]`);
    L.push('            set mStatusVal [$mStatus Failed]');
    L.push('            if {$mStatusVal == 1} exit');
    L.push(`            set mStatus [$mPin SetIsDot ${pin.isDot ? 1 : 0}]`);
    L.push('            set mStatusVal [$mStatus Failed]');
    L.push('            if {$mStatusVal == 1} exit');
    L.push(`            set mStatus [$mPin SetIsLeftPointing ${pin.isLeftPointing ? 1 : 0}]`);
    L.push('            set mStatusVal [$mStatus Failed]');
    L.push('            if {$mStatusVal == 1} exit');
    L.push(`            set mStatus [$mPin SetIsRightPointing ${pin.isRightPointing ? 1 : 0}]`);
    L.push('            set mStatusVal [$mStatus Failed]');
    L.push('            if {$mStatusVal == 1} exit');
    L.push(`            set mStatus [$mPin SetIsNetStyle ${pin.isNetStyle ? 1 : 0}]`);
    L.push('            set mStatusVal [$mStatus Failed]');
    L.push('            if {$mStatusVal == 1} exit');
    L.push(`            set mStatus [$mPin SetIsNoConnect ${pin.isNoConnect ? 1 : 0}]`);
    L.push('            set mStatusVal [$mStatus Failed]');
    L.push('            if {$mStatusVal == 1} exit');
    L.push(`            set mStatus [$mPin SetIsGlobal ${pin.isGlobal ? 1 : 0}]`);
    L.push('            set mStatusVal [$mStatus Failed]');
    L.push('            if {$mStatusVal == 1} exit');
    L.push(`            set mStatus [$mPin SetIsNumberVisible ${pin.isNumberVisible ? 1 : 0}]`);
    L.push('            set mStatusVal [$mStatus Failed]');
    L.push('            if {$mStatusVal == 1} exit');
  }

  // ── Save part ──
  L.push('        set mStatus [$mLib SavePart $lLibPart]');
  L.push('        set mStatusVal [$mStatus Failed]');
  L.push('        if {$mStatusVal == 1} exit');

  // ── Physical part (device) with pin number mapping ──
  L.push(`        set lDesignator [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr('')}]]`);
  L.push('        set mDevice [$mPackage NewDevice $lDesignator 0 $mCell $mStatus]');
  L.push('        set mStatusVal [$mStatus Failed]');
  L.push('        if {$mStatusVal == 1} exit');

  for (const pn of componentData.pinNumbers) {
    L.push(`          set lPinNum [DboTclHelper_sMakeCString [::orTransformStrOut ${tclStr(pn.number)}]]`);
    L.push(`          set pPosition [DboTclHelper_sMakeInt ${pn.position}]`);
    L.push('          set mStatus [$mDevice NewPinNumber $lPinNum $pPosition]');
    L.push('          set mStatusVal [$mStatus Failed]');
    L.push('          if {$mStatusVal == 1} exit');
  }

  // ── Save package and library ──
  L.push('    set mStatus [$mLib SavePackageAll $mPackage]');
  L.push('    set mStatusVal [$mStatus Failed]');
  L.push('    if {$mStatusVal == 1} exit');
  L.push('  ');
  L.push(`  puts [::orTransformStrOut ${tclStr('INFO(ORDBDLL-1229): XMATIC : Saving Library..' + olbPathUpper)}]`);
  L.push('  set mStatus [$mSession SaveLib $mLib]');
  L.push('  set mStatusVal [$mStatus Failed]');
  L.push('  if {$mStatusVal == 1} exit');
  L.push('  DboTclHelper_sDeleteSession $mSession');
  L.push('  ');

  return L.join('\n');
}

// ─── TCL Execution ──────────────────────────────────────────────────────────

/**
 * Execute a TCL script using tclsh + OrCAD Dbo DLLs to generate an OLB file.
 * On Linux, uses Wine64 to run the Windows tclsh.exe.
 *
 * @param {string} tclScript - TCL script content
 * @param {string} tclFilePath - Path to save the temporary TCL script
 * @param {number} [timeoutMs=30000] - Execution timeout in milliseconds
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function executeTCL(tclScript, tclFilePath, timeoutMs = 30000) {
  const { tclshPath, dllDir } = getOrcadToolPaths();

  // Verify tclsh exists
  if (!fs.existsSync(tclshPath)) {
    throw new Error(`tclsh not found at: ${tclshPath}. Set ORCAD_TCLSH_PATH env variable.`);
  }

  // Write tcl script
  fs.writeFileSync(tclFilePath, tclScript, 'utf8');

  // Build environment
  const env = { ...process.env };

  try {
    let stdout, stderr;

    if (IS_WINDOWS) {
      // Windows: run tclsh.exe directly, add DLL dir to PATH
      env.PATH = dllDir + ';' + (env.PATH || '');
      ({ stdout, stderr } = await execFileAsync(tclshPath, [tclFilePath], {
        env,
        timeout: timeoutMs,
        cwd: dllDir,
      }));
    } else {
      // Linux: run tclsh.exe via Wine64
      env.WINEPREFIX = process.env.WINEPREFIX || '/tmp/wine-orcad';
      env.WINEDEBUG = process.env.WINEDEBUG || '-all';
      // Add DLL dir to Wine's PATH so Windows DLL loader finds dependencies
      env.WINEPATH = dllDir;
      // Set TCL_LIBRARY for flat directory layout (lib/tcl8.6 alongside tclsh.exe)
      const tclLibDir = path.join(path.dirname(tclshPath), 'lib', 'tcl8.6');
      if (fs.existsSync(tclLibDir)) {
        env.TCL_LIBRARY = toWinePath(tclLibDir);
      }

      ({ stdout, stderr } = await execFileAsync('wine64', [tclshPath, tclFilePath], {
        env,
        timeout: timeoutMs,
        cwd: dllDir,
      }));
    }

    return { stdout, stderr };
  } finally {
    // Clean up TCL script
    try { fs.unlinkSync(tclFilePath); } catch { /* ignore */ }
  }
}

// ─── High-Level API ─────────────────────────────────────────────────────────

/**
 * Convert a SamacSys Capture XML string to an OLB file.
 *
 * Attempts TCL-based conversion first (using tclsh + Dbo DLLs).
 * Falls back to generating just the TCL script + XML for manual conversion.
 *
 * @param {string} xmlContent - Raw XML string from Capture/<part>.xml
 * @param {string} targetDir - Directory to save the generated files
 * @param {string} [partName] - Override part name (defaults to name from XML)
 * @param {Object} [options] - Options
 * @param {boolean} [options.keepXml=true] - Whether to save the XML alongside
 * @returns {Object} { olbPath, olbFilename, xmlPath, tclPath, componentData, method }
 */
export async function convertCaptureXmlToOlb(xmlContent, targetDir, partName, options = {}) {
  const { keepXml = true } = options;

  const componentData = parseCaptureXML(xmlContent);
  const safeName = partName || componentData.name || 'UNKNOWN';

  // Save the original XML as fallback
  let xmlPath = null;
  if (keepXml) {
    xmlPath = path.join(targetDir, safeName + '.xml');
    fs.writeFileSync(xmlPath, xmlContent, 'utf8');
  }

  const olbPath = path.join(targetDir, safeName + '.olb');
  const tclPath = path.join(targetDir, safeName + '.tcl');

  // Generate TCL script with Wine-compatible paths on Linux
  // (tclsh.exe under Wine sees Windows paths via the Z: drive mapping)
  const tclOlbPath = toWinePath(olbPath);
  const tclScript = generateTCL(componentData, tclOlbPath, { standalone: true });

  // Try TCL-based conversion
  try {
    const { stdout, stderr } = await executeTCL(tclScript, tclPath);
    if (stderr) {
      console.warn('[OLB] TCL stderr:', stderr);
    }

    if (fs.existsSync(olbPath)) {
      const olbSize = fs.statSync(olbPath).size;
      console.log(`[OLB] TCL conversion: ${safeName}.olb (${olbSize}b) | ${componentData.pins.length} pins`);
      if (stdout) {
        console.log('[OLB] TCL output:', stdout.trim().split('\n').slice(-3).join(' | '));
      }
      return {
        olbPath,
        olbFilename: safeName + '.olb',
        xmlPath,
        tclPath: null,
        componentData,
        method: 'tcl',
      };
    }

    throw new Error('OLB file was not created by TCL script');
  } catch (err) {
    console.warn(`[OLB] TCL conversion failed: ${err.message}. Saving TCL script for manual use.`);

    // Save TCL script for user to run manually in OrCAD Capture
    const manualTcl = generateTCL(componentData, olbPath);
    fs.writeFileSync(tclPath, manualTcl, 'utf8');

    console.log(`[OLB] Fallback: saved ${safeName}.tcl for manual conversion | ${componentData.pins.length} pins`);

    return {
      olbPath: null,
      olbFilename: null,
      tclPath,
      tclFilename: safeName + '.tcl',
      xmlPath,
      componentData,
      method: 'tcl-script',
    };
  }
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
