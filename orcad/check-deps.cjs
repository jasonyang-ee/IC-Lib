/**
 * OrCAD DLL Dependency Checker
 *
 * Scans all DLLs in this directory and reports any missing non-system dependencies.
 * Run with: node check-deps.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIR = __dirname;

// Windows system DLLs (always available, provided by OS or Wine)
const SYSTEM_DLLS = new Set([
  'kernel32.dll', 'user32.dll', 'gdi32.dll', 'advapi32.dll', 'shell32.dll',
  'ole32.dll', 'oleaut32.dll', 'comctl32.dll', 'comdlg32.dll', 'rpcrt4.dll',
  'ws2_32.dll', 'wsock32.dll', 'crypt32.dll', 'netapi32.dll', 'setupapi.dll',
  'wtsapi32.dll', 'version.dll', 'winhttp.dll', 'wininet.dll', 'wintrust.dll',
  'wldap32.dll', 'shlwapi.dll', 'iphlpapi.dll', 'gdiplus.dll', 'normaliz.dll',
  'dhcpcsvc.dll', 'bcrypt.dll', 'winmm.dll', 'imm32.dll', 'odbc32.dll',
  'oleacc.dll', 'userenv.dll', 'uxtheme.dll', 'winspool.drv', 'msimg32.dll',
  'psapi.dll', 'dbghelp.dll', 'secur32.dll', 'ntdll.dll',
]);

function isSystemDll(name) {
  const lower = name.toLowerCase();
  if (SYSTEM_DLLS.has(lower)) return true;
  if (lower.startsWith('api-ms-win-')) return true;
  if (lower.startsWith('ext-ms-')) return true;
  return false;
}

function getDeps(dllPath) {
  try {
    const out = execSync(`objdump -p "${dllPath}" 2>/dev/null`, { encoding: 'utf8', timeout: 10000 });
    const deps = [];
    for (const line of out.split('\n')) {
      const m = line.match(/DLL Name:\s+(.+)/);
      if (m) deps.push(m[1].trim());
    }
    return deps;
  } catch {
    return [];
  }
}

// Build map of available files (case-insensitive)
const available = new Map();
for (const f of fs.readdirSync(DIR)) {
  available.set(f.toLowerCase(), f);
}

// Check all DLLs
const allDeps = new Map();
const missing = new Set();

for (const [lowerName, fileName] of available) {
  if (!lowerName.endsWith('.dll')) continue;
  const deps = getDeps(path.join(DIR, fileName));
  for (const dep of deps) {
    const depLower = dep.toLowerCase();
    if (isSystemDll(depLower)) continue;
    if (!allDeps.has(depLower)) allDeps.set(depLower, []);
    allDeps.get(depLower).push(fileName);
    if (!available.has(depLower)) {
      missing.add(dep);
    }
  }
}

console.log('OrCAD DLL Dependency Check');
console.log('=========================');
console.log(`Directory: ${DIR}`);
console.log(`DLLs found: ${[...available.keys()].filter(k => k.endsWith('.dll')).length}`);
console.log('');

if (missing.size === 0) {
  console.log('All dependencies satisfied!');
} else {
  console.log(`Missing ${missing.size} DLL(s):`);
  console.log('');
  for (const dep of [...missing].sort()) {
    const neededBy = allDeps.get(dep.toLowerCase()) || [];
    console.log(`  ${dep}`);
    console.log(`    needed by: ${neededBy.join(', ')}`);
  }
  console.log('');
  console.log('Copy these DLLs from your Cadence/OrCAD installation');
  console.log('(typically in: C:\\Cadence\\SPB_XX.X\\tools\\bin\\)');
}
