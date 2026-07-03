import { describe, expect, it } from 'vitest';
import { decodeVendorBarcode, isEciaBarcode, normalizeBarcodeText } from '../utils/vendorBarcode';

const GS = String.fromCharCode(29);
const RS = String.fromCharCode(30);
const EOT = String.fromCharCode(4);

// Real Digikey DataMatrix label (literal-text control chars, as some scanners emit)
const DIGIKEY_LITERAL = '[)>{RS}06{GS}PDS2431+-ND{GS}1PDS2431+{GS}30PDS2431+-ND{GS}KPI44272{GS}1K88732724{GS}10K107208362{GS}9D2343{GS}1T0007187692{GS}11K1{GS}4LPH{GS}Q10{GS}11ZPICK{GS}12Z1197428{GS}13Z999999{GS}20Z0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000{RS}{EOT}';

// Real Mouser label — leads with a sales order (K) field, no 30P/P fields
const MOUSER_LITERAL = '[)>{RS}06{GS}K4500016605{GS}14K008{GS}1PPWR220T-20-50R0F{GS}Q5{GS}11K086036559{GS}4LCR{GS}1VBourns{RS}{EOT}';

const withControlChars = (literal) => literal
  .replaceAll('{GS}', GS)
  .replaceAll('{RS}', RS)
  .replaceAll('{EOT}', EOT);

describe('normalizeBarcodeText', () => {
  it('converts literal {GS}/{RS}/{EOT} and escaped \\x sequences to control chars', () => {
    expect(normalizeBarcodeText('a{GS}b{RS}c{EOT}')).toBe(`a${GS}b${RS}c${EOT}`);
    expect(normalizeBarcodeText('a\\x1db\\x1ec\\x04')).toBe(`a${GS}b${RS}c${EOT}`);
  });
});

describe('isEciaBarcode', () => {
  it('detects multi-field payloads in literal and control-char form', () => {
    expect(isEciaBarcode(DIGIKEY_LITERAL)).toBe(true);
    expect(isEciaBarcode(withControlChars(MOUSER_LITERAL))).toBe(true);
    expect(isEciaBarcode('511-STM32F407VGT6')).toBe(false);
  });
});

describe('decodeVendorBarcode', () => {
  it('decodes the Digikey sample label (literal control chars)', () => {
    const result = decodeVendorBarcode(DIGIKEY_LITERAL);

    expect(result.error).toBeUndefined();
    expect(result.vendor).toBe('Digikey');
    expect(result.manufacturerPN).toBe('DS2431+');
    expect(result.digikeySKU).toBe('DS2431+-ND');
    expect(result.sku).toBe('DS2431+-ND');
    expect(result.quantity).toBe(10);
    expect(result.searchTerm).toBe('DS2431+');
    expect(result.multiField).toBe(true);
  });

  it('decodes the Digikey sample with real control characters', () => {
    const result = decodeVendorBarcode(withControlChars(DIGIKEY_LITERAL));

    expect(result.error).toBeUndefined();
    expect(result.manufacturerPN).toBe('DS2431+');
    expect(result.quantity).toBe(10);
  });

  it('decodes the Mouser sample without mistaking the sales order for the MPN', () => {
    const result = decodeVendorBarcode(MOUSER_LITERAL);

    expect(result.error).toBeUndefined();
    expect(result.vendor).toBe('Mouser');
    expect(result.manufacturerPN).toBe('PWR220T-20-50R0F');
    expect(result.manufacturerName).toBe('Bourns');
    expect(result.quantity).toBe(5);
    expect(result.searchTerm).toBe('PWR220T-20-50R0F');
    // Order references (K/1K/10K/11K/14K) must never surface as part data
    expect(result.manufacturerPN).not.toContain('4500016605');
  });

  it('rejects a multi-field barcode without a 1P field instead of guessing', () => {
    const result = decodeVendorBarcode('[)>{RS}06{GS}K4500016605{GS}14K008{GS}Q5{RS}{EOT}');

    expect(result.error).toMatch(/1P/);
    expect(result.manufacturerPN).toBeUndefined();
  });

  it('treats a single-field scan as a search term (SKU-only Code 128)', () => {
    const result = decodeVendorBarcode('81-PWR220T2050R0F');

    expect(result.error).toBeUndefined();
    expect(result.multiField).toBe(false);
    expect(result.searchTerm).toBe('81-PWR220T2050R0F');
    expect(result.sku).toBe('81-PWR220T2050R0F');
    expect(result.manufacturerPN).toBeNull();
    expect(result.vendor).toBeNull();
  });

  it('discards nZ padding, lot, date, and country fields', () => {
    const result = decodeVendorBarcode('[)>{RS}06{GS}1PABC-123{GS}1T555{GS}9D2343{GS}4LPH{GS}11ZPICK{GS}20Z000{RS}{EOT}');

    expect(result.error).toBeUndefined();
    expect(result.manufacturerPN).toBe('ABC-123');
    expect(result.quantity).toBeNull();
  });

  it('prefers 1P over P and 30P over P via longest-prefix matching', () => {
    const result = decodeVendorBarcode('[)>{RS}06{GS}P296-1234-1-ND{GS}1PTPS7A4700RGWT{GS}Q25{RS}{EOT}');

    expect(result.manufacturerPN).toBe('TPS7A4700RGWT');
    expect(result.sku).toBe('296-1234-1-ND');
    expect(result.quantity).toBe(25);
  });

  it('errors on empty or control-character-only input', () => {
    expect(decodeVendorBarcode('').error).toBeTruthy();
    expect(decodeVendorBarcode(`${GS}${RS}${EOT}`).error).toBeTruthy();
  });
});
