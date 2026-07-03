/**
 * ECIA / ISO 15434 vendor barcode decoder (Digikey DataMatrix, Mouser Code 128).
 *
 * Real label samples (scanners may emit literal "{GS}" text instead of control chars):
 * Digikey: [)>{RS}06{GS}PDS2431+-ND{GS}1PDS2431+{GS}30PDS2431+-ND{GS}KPI44272{GS}1K88732724
 *          {GS}10K107208362{GS}9D2343{GS}1T0007187692{GS}11K1{GS}4LPH{GS}Q10{GS}11ZPICK
 *          {GS}12Z1197428{GS}13Z999999{GS}20Z000...{RS}{EOT}
 * Mouser:  [)>{RS}06{GS}K4500016605{GS}14K008{GS}1PPWR220T-20-50R0F{GS}Q5{GS}11K086036559
 *          {GS}4LCR{GS}1VBourns{RS}{EOT}
 */

const GS = String.fromCharCode(29); // Group Separator (field delimiter)
const RS = String.fromCharCode(30); // Record Separator
const EOT = String.fromCharCode(4); // End of Transmission

/**
 * ECIA field-prefix table, matched longest-prefix-first so `1P` wins over `P`,
 * `30P` over `P`, `14K`/`11K`/`10K`/`1K` over `K`.
 * `keep: null` fields are recognized and discarded (order refs, dates, lots).
 */
const FIELD_PREFIXES = [
  { prefix: '30P', key: 'digikeyPN' }, // Digikey part number (Digikey-specific)
  { prefix: '14K', key: null }, // Mouser sales-order line (Mouser fingerprint)
  { prefix: '11K', key: null }, // invoice / packing-list number
  { prefix: '10K', key: null }, // invoice number
  { prefix: '1K', key: null }, // sales-order / PO reference
  { prefix: '1P', key: 'mfrPartNumber' }, // manufacturer part number
  { prefix: '1T', key: null }, // lot code
  { prefix: '9D', key: null }, // date code
  { prefix: '4L', key: null }, // country of origin
  { prefix: '1V', key: 'supplierName' }, // supplier / manufacturer name
  { prefix: 'P', key: 'customerPN' }, // customer or distributor part number
  { prefix: 'Q', key: 'quantityRaw' }, // quantity
  { prefix: 'K', key: null }, // order reference
];

const PADDING_FIELD_RE = /^\d+Z/; // 11ZPICK, 12Z..., 20Z000... padding/internal fields

/**
 * Normalize the raw scan: some readers send literal "{GS}"/"{RS}"/"{EOT}" text or
 * escaped "\x1d" sequences instead of the actual control characters.
 */
export const normalizeBarcodeText = (raw) => String(raw ?? '')
  .replace(/\{GS\}/gi, GS)
  .replace(/\{RS\}/gi, RS)
  .replace(/\{EOT\}/gi, EOT)
  .replace(/\\x1d/gi, GS)
  .replace(/\\x1e/gi, RS)
  .replace(/\\x04/gi, EOT);

/** True when the text looks like a multi-field ECIA/ISO-15434 payload. */
export const isEciaBarcode = (raw) => {
  const text = normalizeBarcodeText(raw);
  return text.includes(GS) || text.startsWith('[)>');
};

const stripEnvelope = (text) => text
  // eslint-disable-next-line no-control-regex
  .replace(/^\[\)>[\x1e]*06/, '')
  // eslint-disable-next-line no-control-regex
  .replace(/^[\x1e\x1d]+/, '')
  // eslint-disable-next-line no-control-regex
  .replace(/[\x1e\x04]+$/, '');

const matchField = (field) => {
  if (PADDING_FIELD_RE.test(field)) return null;

  for (const { prefix, key } of FIELD_PREFIXES) {
    if (field.startsWith(prefix) && field.length > prefix.length) {
      return { prefix, key, value: field.substring(prefix.length) };
    }
  }

  return null; // unrecognized field — deliberately NOT treated as an MPN
};

/**
 * Decode a vendor barcode scan.
 *
 * Multi-field ECIA payloads are parsed strictly by field prefix — there is no
 * unprefixed-field guessing (a Mouser label leading with a sales-order number
 * must not become the part number). Single-field scans (plain SKU/PN Code 128)
 * fall back to `searchTerm` = the whole trimmed string.
 *
 * @returns {{
 *   vendor: string|null, manufacturerPN: string|null, sku: string|null,
 *   digikeySKU: string|null, mouserSKU: string|null, manufacturerName: string|null,
 *   quantity: number|null, searchTerm: string|null, multiField: boolean, raw: string,
 * } | { error: string, raw: string }}
 */
export const decodeVendorBarcode = (raw) => {
  const rawText = String(raw ?? '');
  const text = normalizeBarcodeText(rawText).trim();

  if (!text) {
    return { error: 'Empty barcode scan.', raw: rawText };
  }

  if (!isEciaBarcode(text)) {
    // Single-field scan (e.g. Mouser Code 128 SKU strip): use it as a search term.
    // eslint-disable-next-line no-control-regex
    const value = text.replace(/[\x00-\x1f\x7f]/g, '').trim();

    if (!value || value.length > 100) {
      return { error: 'Could not read a part number or SKU from the barcode.', raw: rawText };
    }

    return {
      vendor: null,
      manufacturerPN: null,
      sku: value,
      digikeySKU: null,
      mouserSKU: null,
      manufacturerName: null,
      quantity: null,
      searchTerm: value,
      multiField: false,
      raw: rawText,
    };
  }

  const parsed = {};
  const seenPrefixes = new Set();

  stripEnvelope(text).split(GS).forEach((rawField) => {
    // eslint-disable-next-line no-control-regex
    const field = rawField.replace(/[\x1e\x04]+/g, '').trim();
    if (!field) return;

    const match = matchField(field);
    if (!match) return;

    seenPrefixes.add(match.prefix);
    if (match.key && parsed[match.key] === undefined) {
      parsed[match.key] = match.value;
    }
  });

  if (!parsed.mfrPartNumber) {
    return {
      error: 'Barcode has no manufacturer part number (1P) field. Please check the label format.',
      raw: rawText,
    };
  }

  let vendor = null;
  if (parsed.digikeyPN) {
    vendor = 'Digikey';
  } else if (seenPrefixes.has('14K')) {
    vendor = 'Mouser';
  } else if (parsed.supplierName) {
    vendor = parsed.supplierName;
  }

  const sku = parsed.digikeyPN || parsed.customerPN || null;
  const quantityMatch = parsed.quantityRaw?.match(/\d+/);

  return {
    vendor,
    manufacturerPN: parsed.mfrPartNumber,
    sku,
    digikeySKU: vendor === 'Digikey' ? sku : null,
    mouserSKU: vendor === 'Mouser' ? sku : null,
    manufacturerName: parsed.supplierName || null,
    quantity: quantityMatch ? parseInt(quantityMatch[0], 10) : null,
    searchTerm: parsed.mfrPartNumber,
    multiField: true,
    raw: rawText,
  };
};
