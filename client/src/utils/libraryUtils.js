// Part number utilities for parsing and formatting component part numbers

// Parse part number to extract prefix and number (e.g., "IC-00001" -> { prefix: "IC", number: 1, leadingZeros: 5 })
export const parsePartNumber = (partNumber) => {
  if (!partNumber || typeof partNumber !== 'string') return null;
  const match = partNumber.match(/^([A-Z]+)-(\d+)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    number: parseInt(match[2], 10),
    leadingZeros: match[2].length
  };
};

// Format part number with leading zeros (e.g., ("IC", 1, 5) -> "IC-00001")
export const formatPartNumber = (prefix, number, leadingZeros) => {
  return `${prefix}-${String(number).padStart(leadingZeros, '0')}`;
};

// Sanitize specification value by removing unit characters if they match
export const sanitizeSpecValue = (specValue, unit) => {
  if (!specValue || !unit) return specValue;
  const value = String(specValue).trim();
  const unitStr = String(unit).trim();
  if (!unitStr) return value;
  if (value.endsWith(unitStr)) {
    return value.substring(0, value.length - unitStr.length).trim();
  }
  return value;
};

// Map vendor specifications to component specifications using mapping_spec_names
export const mapVendorSpecifications = (vendorSpecs, categorySpecs) => {
  if (!vendorSpecs || !categorySpecs || categorySpecs.length === 0) {
    return categorySpecs;
  }

  // Create a map of vendor spec name to value (case-insensitive)
  const vendorSpecMap = {};
  Object.entries(vendorSpecs).forEach(([key, value]) => {
    const specValue = typeof value === 'object' && value !== null ? value.value : value;
    if (specValue) {
      vendorSpecMap[key.toLowerCase().trim()] = String(specValue);
    }
  });

  // Map category specs with vendor values where mapping_spec_names exists
  return categorySpecs.map(spec => {
    let mappedValue = spec.spec_value || '';

    const mappings = Array.isArray(spec.mapping_spec_names)
      ? spec.mapping_spec_names
      : (spec.mapping_spec_name ? [spec.mapping_spec_name] : []);

    if (mappings.length > 0) {
      for (const mapping of mappings) {
        if (mapping && mapping.trim() !== '') {
          const mappingKey = mapping.toLowerCase().trim();
          if (vendorSpecMap[mappingKey]) {
            const rawValue = vendorSpecMap[mappingKey];
            mappedValue = sanitizeSpecValue(rawValue, spec.unit);
            break;
          }
        }
      }
    }

    return {
      ...spec,
      spec_value: mappedValue
    };
  });
};

// Copy text to clipboard with fallback for browsers without Clipboard API
export const copyToClipboard = (text, onSuccess, onError) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch((err) => {
      console.error('Failed to copy text:', err);
      fallbackCopyToClipboard(text, onSuccess, onError);
    });
  } else {
    fallbackCopyToClipboard(text, onSuccess, onError);
  }
};

// Fallback clipboard method using textarea
const fallbackCopyToClipboard = (text, onSuccess, onError) => {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      onSuccess();
    } else if (onError) {
      onError('Failed to copy to clipboard. Please copy manually.');
    }
  } catch (err) {
    console.error('Fallback copy failed:', err);
    if (onError) {
      onError('Failed to copy to clipboard. Please copy manually.');
    }
  }
};

// Normalize distributors array to ensure all 4 standard distributors exist
export const normalizeDistributors = (existingDistributors, allDistributors) => {
  if (!allDistributors) return existingDistributors || [];
  return allDistributors.map(dist => {
    const existing = existingDistributors?.find(d => d.distributor_id === dist.id);
    if (existing) return existing;
    return {
      distributor_id: dist.id,
      distributor_name: dist.name,
      sku: '',
      url: '',
      in_stock: false,
      price_breaks: []
    };
  });
};
