const formatDateValue = (value) => {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? String(value) : parsedDate.toISOString();
};

const formatCadValue = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join('; ');
  }

  if (typeof value === 'string') {
    return value;
  }

  return '';
};

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const BOM_COLUMN_DEFINITIONS = Object.freeze([
  { id: 'part_number', label: 'Part Number', group: 'Core', getValue: (component) => component.part_number || '' },
  { id: 'manufacturer', label: 'Manufacturer', group: 'Core', getValue: (component) => component.manufacturer || '' },
  { id: 'manufacturer_pn', label: 'Manufacturer P/N', group: 'Core', getValue: (component) => component.manufacturer_pn || '' },
  { id: 'description', label: 'Description', group: 'Core', getValue: (component) => component.description || '' },
  { id: 'category', label: 'Category', group: 'Core', getValue: (component) => component.category || '' },
  { id: 'value', label: 'Value', group: 'Core', getValue: (component) => component.value || '' },
  { id: 'quantity', label: 'Quantity', group: 'Core', getValue: (component) => component.quantity || '' },
  { id: 'available_quantity', label: 'Available', group: 'Procurement', getValue: (component) => component.available_quantity || 0 },
  { id: 'location', label: 'Location', group: 'Procurement', getValue: (component) => component.location || '' },
  { id: 'approval_status', label: 'Status', group: 'Metadata', getValue: (component) => component.approval_status || component.status || '' },
  { id: 'part_type', label: 'Part Type', group: 'Metadata', getValue: (component) => component.part_type || '' },
  { id: 'package_size', label: 'Package Size', group: 'Metadata', getValue: (component) => component.package_size || '' },
  { id: 'datasheet_url', label: 'Datasheet URL', group: 'Metadata', getValue: (component) => component.datasheet_url || '' },
  { id: 'sub_category1', label: 'Sub Category 1', group: 'Metadata', getValue: (component) => component.sub_category1 || '' },
  { id: 'sub_category2', label: 'Sub Category 2', group: 'Metadata', getValue: (component) => component.sub_category2 || '' },
  { id: 'sub_category3', label: 'Sub Category 3', group: 'Metadata', getValue: (component) => component.sub_category3 || '' },
  { id: 'sub_category4', label: 'Sub Category 4', group: 'Metadata', getValue: (component) => component.sub_category4 || '' },
  { id: 'notes', label: 'Project Notes', group: 'Metadata', getValue: (component) => component.notes || '' },
  { id: 'created_at', label: 'Created At', group: 'Metadata', getValue: (component) => formatDateValue(component.created_at) },
  { id: 'pcb_footprint', label: 'PCB Footprint', group: 'CAD Files', getValue: (component) => formatCadValue(component.pcb_footprint) },
  { id: 'schematic', label: 'Schematic', group: 'CAD Files', getValue: (component) => formatCadValue(component.schematic) },
  { id: 'step_model', label: 'STEP Model', group: 'CAD Files', getValue: (component) => formatCadValue(component.step_model) },
  { id: 'pspice', label: 'PSpice', group: 'CAD Files', getValue: (component) => formatCadValue(component.pspice) },
  { id: 'pad_file', label: 'Pad File', group: 'CAD Files', getValue: (component) => formatCadValue(component.pad_file) },
  {
    id: 'distributors',
    label: 'Distributor Part Numbers',
    group: 'Procurement',
    description: 'Expands to one column per distributor using the distributor part number.',
  },
]);

export const DEFAULT_BOM_COLUMN_IDS = Object.freeze([
  'part_number',
  'manufacturer',
  'manufacturer_pn',
  'description',
  'category',
  'value',
  'quantity',
  'available_quantity',
  'location',
  'approval_status',
  'distributors',
]);

const bomColumnDefinitionMap = new Map(BOM_COLUMN_DEFINITIONS.map((definition) => [definition.id, definition]));

const sortTextValues = (left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' });

const collectDistributorNames = (components) => Array.from(new Set(
  components.flatMap((component) =>
    (component.distributors || [])
      .map((distributor) => distributor?.distributor_name)
      .filter(Boolean),
  ),
)).sort(sortTextValues);

const getMaxAlternativeCount = (components) => Math.max(
  0,
  ...components.map((component) => Array.isArray(component.alternatives) ? component.alternatives.length : 0),
);

const buildAlternativeHeaders = (maxAlternativeCount) => Array.from({ length: maxAlternativeCount }, (_, index) => [
  `Alternative${index + 1} Manufacturer`,
  `Alternative${index + 1} Manufacturer P/N`,
]).flat();

export const sanitizeBomColumnIds = (columnIds) => {
  if (!Array.isArray(columnIds)) {
    return [...DEFAULT_BOM_COLUMN_IDS];
  }

  const uniqueKnownIds = Array.from(new Set(
    columnIds.filter((columnId) => bomColumnDefinitionMap.has(columnId)),
  ));

  return uniqueKnownIds.length > 0 ? uniqueKnownIds : [...DEFAULT_BOM_COLUMN_IDS];
};

export const buildBomExportData = ({ project, components, selectedColumnIds }) => {
  const resolvedColumnIds = sanitizeBomColumnIds(selectedColumnIds);
  const distributorNames = collectDistributorNames(components);
  const maxAlternativeCount = getMaxAlternativeCount(components);

  const headers = resolvedColumnIds.flatMap((columnId) => {
    if (columnId === 'distributors') {
      return distributorNames.map((distributorName) => `Distributor-${distributorName}`);
    }

    return bomColumnDefinitionMap.get(columnId)?.label || columnId;
  });

  headers.push(...buildAlternativeHeaders(maxAlternativeCount));

  const rows = components.map((component) => {
    const row = resolvedColumnIds.flatMap((columnId) => {
      if (columnId === 'distributors') {
        return distributorNames.map((distributorName) => {
          const matchingDistributor = (component.distributors || []).find(
            (distributor) => distributor?.distributor_name === distributorName,
          );

          return matchingDistributor?.sku || '';
        });
      }

      const definition = bomColumnDefinitionMap.get(columnId);
      return definition ? definition.getValue(component) : '';
    });

    for (let index = 0; index < maxAlternativeCount; index += 1) {
      const alternative = component.alternatives?.[index];
      row.push(alternative?.manufacturer_name || '', alternative?.manufacturer_pn || '');
    }

    return row;
  });

  const summaryLines = [
    `Project: ${project?.name || ''}`,
    `Status: ${project?.status || ''}`,
    `Description: ${project?.description || ''}`,
    `Exported: ${new Date().toLocaleString()}`,
    '',
  ];

  return {
    headers,
    rows,
    summaryLines,
  };
};

export const buildBomCsvContent = ({ project, components, selectedColumnIds }) => {
  const { headers, rows, summaryLines } = buildBomExportData({
    project,
    components,
    selectedColumnIds,
  });

  return [
    ...summaryLines,
    headers.map(csvEscape).join(','),
    ...rows.map((row) => row.map(csvEscape).join(',')),
  ].join('\n');
};

export const buildBomFileName = (projectName) => {
  const safeName = String(projectName || 'project').replace(/[^a-z0-9]/gi, '_');
  const dateStamp = new Date().toISOString().split('T')[0];
  return `${safeName}_${dateStamp}.csv`;
};
