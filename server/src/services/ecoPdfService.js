import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { DEFAULT_ECO_PDF_HEADER } from './ecoSettingsService.js';
import { ECO_PIPELINE_TYPE_LABELS, getEcoPipelineTypes } from './ecoPipelineService.js';
import { assertSafeLeafName, resolvePathWithinBase } from '../utils/safeFsPaths.js';

// Colors
const COLORS = {
  primary: '#1a56db',
  green: '#15803d',
  red: '#b91c1c',
  yellow: '#a16207',
  purple: '#7e22ce',
  blue: '#1d4ed8',
  gray: '#4b5563',
  lightGray: '#e5e7eb',
  darkText: '#111827',
  mutedText: '#6b7280',
  headerBg: '#f3f4f6',
  white: '#ffffff',
  tableBorder: '#d1d5db',
};

const FONT_SIZE = {
  title: 16,
  subtitle: 11,
  heading: 10,
  body: 8.5,
  small: 7.5,
};

const PAGE = {
  width: 612,   // Letter width in points
  height: 792,  // Letter height in points
  marginLeft: 40,
  marginRight: 40,
  marginTop: 40,
  marginBottom: 50,
};

const contentWidth = PAGE.width - PAGE.marginLeft - PAGE.marginRight;

// Helper: draw a horizontal rule
const drawHR = (doc, y, width = contentWidth) => {
  doc
    .moveTo(PAGE.marginLeft, y)
    .lineTo(PAGE.marginLeft + width, y)
    .strokeColor(COLORS.lightGray)
    .lineWidth(0.5)
    .stroke();
};

// Helper: check if we need a new page
const checkPage = (doc, needed = 30) => {
  if (doc.y + needed > PAGE.height - PAGE.marginBottom) {
    doc.addPage();
    doc.y = PAGE.marginTop;
    return true;
  }
  return false;
};

// Helper: draw a section heading
const drawSectionHeading = (doc, title) => {
  checkPage(doc, 40);
  doc.y += 8;
  doc
    .fontSize(FONT_SIZE.heading)
    .font('Helvetica-Bold')
    .fillColor(COLORS.darkText)
    .text(title, PAGE.marginLeft, doc.y);
  doc.y += 3;
  drawHR(doc, doc.y);
  doc.y += 6;
};

// Helper: draw a simple table
const drawTable = (doc, headers, rows, colWidths) => {
  const tableX = PAGE.marginLeft;
  const rowHeight = 16;
  const cellPadding = 4;

  const drawHeaderRow = () => {
    const headerY = doc.y;
    doc.rect(tableX, headerY, contentWidth, rowHeight).fill(COLORS.headerBg);

    let headerX = tableX;
    for (let i = 0; i < headers.length; i++) {
      doc
        .fontSize(FONT_SIZE.small)
        .font('Helvetica-Bold')
        .fillColor(COLORS.gray)
        .text(headers[i], headerX + cellPadding, headerY + 4, {
          width: colWidths[i] - cellPadding * 2,
          lineBreak: false,
        });
      headerX += colWidths[i];
    }

    doc.y = headerY + rowHeight;
  };

  // Header row
  checkPage(doc, rowHeight * 2);
  drawHeaderRow();

  // Data rows
  for (const row of rows) {
    // Calculate row height based on content
    let maxHeight = rowHeight;
    const cellHeights = [];
    for (let i = 0; i < row.length; i++) {
      const text = String(row[i] || '');
      const h = doc.heightOfString(text, {
        width: colWidths[i] - cellPadding * 2,
        fontSize: FONT_SIZE.body,
      });
      cellHeights.push(Math.max(rowHeight, h + 8));
      maxHeight = Math.max(maxHeight, cellHeights[i]);
    }

    if (doc.y + maxHeight > PAGE.height - PAGE.marginBottom) {
      doc.addPage();
      doc.y = PAGE.marginTop;
      drawHeaderRow();
    }

    // Draw bottom border
    const rowY = doc.y;
    doc
      .moveTo(tableX, rowY + maxHeight)
      .lineTo(tableX + contentWidth, rowY + maxHeight)
      .strokeColor(COLORS.lightGray)
      .lineWidth(0.3)
      .stroke();

    let x = tableX;
    for (let i = 0; i < row.length; i++) {
      const text = String(row[i] ?? '-');
      doc
        .fontSize(FONT_SIZE.body)
        .font(i === 0 ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(COLORS.darkText)
        .text(text, x + cellPadding, rowY + 4, {
          width: colWidths[i] - cellPadding * 2,
          lineBreak: true,
        });
      x += colWidths[i];
    }
    doc.y = rowY + maxHeight;
  }

  doc.y += 4;
};

// Helper: get status badge text
const getStatusLabel = (status) => {
  const labels = {
    pending: 'PENDING',
    in_review: 'IN REVIEW',
    approved: 'APPROVED',
    rejected: 'REJECTED',
  };
  return labels[status] || status?.toUpperCase() || 'UNKNOWN';
};

const getStatusColor = (status) => {
  const colors = {
    pending: COLORS.yellow,
    in_review: COLORS.blue,
    approved: COLORS.green,
    rejected: COLORS.red,
  };
  return colors[status] || COLORS.gray;
};

const getApprovalStatusLabel = (status) => {
  const labels = {
    production: 'Production',
    archived: 'Archived',
    prototype: 'Prototype',
    reviewing: 'Reviewing',
    new: 'New',
  };
  return labels[status] || status || '';
};

const formatFieldName = (field) => {
  if (field === 'category_id') return 'Category';
  if (field === 'manufacturer_id') return 'Manufacturer';
  if (field === '_status_proposal') return 'Status Change';
  if (field === 'manufacturer_pn') return "Manufacturer's P/N";
  if (field === 'pcb_footprint') return 'PCB Footprint';
  if (field === 'package_size') return 'Package Size';
  if (field === 'datasheet_url') return 'Datasheet URL';
  return field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const createEcoPdfDocument = (ecoData, headerText) => new PDFDocument({
  size: 'LETTER',
  margins: {
    top: PAGE.marginTop,
    bottom: PAGE.marginBottom,
    left: PAGE.marginLeft,
    right: PAGE.marginRight,
  },
  info: {
    Title: `ECO ${ecoData.eco_number}`,
    Author: 'IC-Lib',
    Subject: `${headerText} - ${ecoData.eco_number}`,
  },
  bufferPages: true,
});

/**
 * Generate a PDF document for an ECO order.
 * @param {Object} ecoData - Full ECO data from getECOById (with changes, distributors, etc.)
 * @param {Object} options - Optional settings (logoFilename, etc.)
 * @returns {PDFDocument} - A PDFKit document stream
 */
export const generateECOPdf = (ecoData, options = {}) => {
  const headerText = typeof options.headerText === 'string' && options.headerText.trim().length > 0
    ? options.headerText.trim()
    : DEFAULT_ECO_PDF_HEADER;

  const doc = options.document || createEcoPdfDocument(ecoData, headerText);

  // ===== LOGO =====
  let headerStartY = PAGE.marginTop;

  if (options.logoFilename) {
    const imageDir = process.env.NODE_ENV === 'production'
      ? '/app/image'
      : path.join(process.cwd(), '..', 'image');

    try {
      const safeLogoFilename = assertSafeLeafName(options.logoFilename, 'logoFilename');
      const logoPath = resolvePathWithinBase(imageDir, safeLogoFilename);
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, PAGE.marginLeft, PAGE.marginTop, { height: 40 });
        headerStartY = PAGE.marginTop + 48; // shift title below logo
      }
    } catch (err) {
      console.warn('ECO PDF logo not found or unreadable:', err.message);
    }
  }

  // ===== HEADER =====
  // Page title
  doc
    .fontSize(FONT_SIZE.title)
    .font('Helvetica-Bold')
    .fillColor(COLORS.darkText)
    .text(headerText, PAGE.marginLeft, headerStartY);

  doc.y = headerStartY + 30;

  // ECO number
  doc
    .fontSize(FONT_SIZE.subtitle + 2)
    .font('Helvetica-Bold')
    .fillColor(COLORS.darkText)
    .text(ecoData.eco_number, PAGE.marginLeft, doc.y);

  // Status badge
  const statusColor = getStatusColor(ecoData.status);
  const statusText = getStatusLabel(ecoData.status);
  const statusX = PAGE.width - PAGE.marginRight - 80;
  doc
    .rect(statusX, headerStartY, 80, 18)
    .fill(statusColor);
  doc
    .fontSize(FONT_SIZE.body)
    .font('Helvetica-Bold')
    .fillColor(COLORS.white)
    .text(statusText, statusX, headerStartY + 5, { width: 80, align: 'center', lineBreak: false });

  doc.y = headerStartY + 50;

  // Part info
  const renderMetaLine = (line) => {
    doc
      .fontSize(FONT_SIZE.subtitle)
      .font('Helvetica')
      .fillColor(COLORS.gray)
      .text(line, PAGE.marginLeft, doc.y);
    doc.y += 2;
  };

  if (ecoData.component_part_number || ecoData.part_number) {
    renderMetaLine(`Part Number: ${ecoData.component_part_number || ecoData.part_number}`);
  }
  if (ecoData.component_description) {
    renderMetaLine(`Description: ${ecoData.component_description}`);
  }

  // Extra gap between part info and initiator info
  doc.y += 6;

  renderMetaLine(`Initiated By: ${ecoData.initiated_by_name || 'Unknown'}`);
  if (ecoData.created_at) {
    renderMetaLine(`Date: ${new Date(ecoData.created_at).toLocaleString()}`);
  }
  // "Approved By" removed — redundant with Approval Progress table

  // ECO tags
  const pipelineTags = getEcoPipelineTypes(ecoData);
  if (pipelineTags.length > 0) {
    renderMetaLine(`Tags: ${pipelineTags.map((pipelineType) => ECO_PIPELINE_TYPE_LABELS[pipelineType] || pipelineType).join(', ')}`);
  }

  // Notes
  if (ecoData.notes) {
    doc.y += 4;
    doc
      .fontSize(FONT_SIZE.body)
      .font('Helvetica-Oblique')
      .fillColor(COLORS.mutedText)
      .text(`Notes: ${ecoData.notes}`, PAGE.marginLeft, doc.y, { width: contentWidth });
  }

  // Rejection reason
  if (ecoData.rejection_reason) {
    doc.y += 4;
    doc
      .fontSize(FONT_SIZE.body)
      .font('Helvetica-Bold')
      .fillColor(COLORS.red)
      .text(`Rejection Reason: ${ecoData.rejection_reason}`, PAGE.marginLeft, doc.y, { width: contentWidth });
  }

  doc.y += 6;
  drawHR(doc, doc.y);
  doc.y += 8;

  // ===== APPROVAL PROGRESS =====
  if (ecoData.stages && ecoData.stages.length > 0) {
    drawSectionHeading(doc, 'Approval Progress');

    const stageHeaders = ['Stage', 'Approvals', 'Assigned', 'Status'];
    const stageColWidths = [contentWidth * 0.25, contentWidth * 0.15, contentWidth * 0.35, contentWidth * 0.25];
    const stageRows = ecoData.stages.map(stage => {
      const isComplete = parseInt(stage.approval_count) >= stage.required_approvals;
      const isCurrent = ecoData.current_stage_order === stage.stage_order;
      const isPast = stage.stage_order < (ecoData.current_stage_order ?? Infinity);
      const approvers = stage.assigned_approvers
        ?.map(a => a.display_name || '-')
        .join(', ') || '-';
      let status = 'Pending';
      if (isPast || isComplete) status = 'Complete';
      if (isCurrent && !isComplete) status = 'Current';
      if (ecoData.status === 'rejected' && isCurrent) status = 'Rejected';
      return [
        stage.stage_name,
        `${stage.approval_count}/${stage.required_approvals}`,
        approvers,
        status,
      ];
    });
    drawTable(doc, stageHeaders, stageRows, stageColWidths);

    // Vote history
    if (ecoData.approvals && ecoData.approvals.length > 0) {
      doc.y += 2;
      doc
        .fontSize(FONT_SIZE.small)
        .font('Helvetica-Bold')
        .fillColor(COLORS.gray)
        .text('Vote History', PAGE.marginLeft, doc.y);
      doc.y += 4;

      const voteHeaders = ['Stage', 'User', 'Role', 'Decision', 'Comments', 'Date'];
      const voteColWidths = [
        contentWidth * 0.16, contentWidth * 0.13, contentWidth * 0.10,
        contentWidth * 0.10, contentWidth * 0.31, contentWidth * 0.20];
      const voteRows = ecoData.approvals.map(a => [
        a.stage_name || '-',
        a.user_name || '-',
        a.user_role || '-',
        a.decision || '-',
        a.comments || '-',
        a.created_at ? new Date(a.created_at).toLocaleString() : '-',
      ]);
      drawTable(doc, voteHeaders, voteRows, voteColWidths);
    }
  }

  // ===== COMPONENT CHANGES =====
  if (ecoData.changes && ecoData.changes.length > 0) {
    drawSectionHeading(doc, 'Component Changes');

    const changeHeaders = ['Field', 'Old Value', 'New Value'];
    const changeColWidths = [contentWidth * 0.25, contentWidth * 0.375, contentWidth * 0.375];
    const changeRows = ecoData.changes.map(c => {
      let oldVal = c.old_value || '';
      let newVal = c.new_value || '';

      if (c.field_name === 'category_id') {
        oldVal = c.old_category_name || oldVal;
        newVal = c.new_category_name || newVal;
      } else if (c.field_name === 'manufacturer_id') {
        oldVal = c.old_manufacturer_name || oldVal;
        newVal = c.new_manufacturer_name || newVal;
      } else if (c.field_name === '_status_proposal') {
        oldVal = getApprovalStatusLabel(oldVal);
        newVal = getApprovalStatusLabel(newVal);
      }

      return [formatFieldName(c.field_name), oldVal, newVal];
    });
    drawTable(doc, changeHeaders, changeRows, changeColWidths);
  }

  // ===== SPECIFICATION CHANGES =====
  if (ecoData.specifications && ecoData.specifications.length > 0) {
    drawSectionHeading(doc, 'Specification Changes');

    const specHeaders = ['Specification', 'Old Value', 'New Value'];
    const specColWidths = [contentWidth * 0.30, contentWidth * 0.35, contentWidth * 0.35];
    const specRows = ecoData.specifications.map(s => [
      `${s.spec_name || '-'}${s.unit ? ` (${s.unit})` : ''}`,
      s.old_value || '-',
      s.new_value || '-',
    ]);
    drawTable(doc, specHeaders, specRows, specColWidths);
  }

  // ===== DISTRIBUTOR CHANGES =====
  if (ecoData.distributors && ecoData.distributors.length > 0) {
    drawSectionHeading(doc, 'Distributor Changes');

    const distHeaders = ['Action', 'Distributor', 'SKU', 'URL'];
    const distColWidths = [contentWidth * 0.12, contentWidth * 0.25, contentWidth * 0.25, contentWidth * 0.38];
    const distRows = ecoData.distributors.map(d => [
      d.action?.toUpperCase() || '-',
      d.distributor_name || '-',
      d.sku || '-',
      d.url || '-',
    ]);
    drawTable(doc, distHeaders, distRows, distColWidths);
  }

  // ===== ALTERNATIVE PARTS CHANGES =====
  if (ecoData.alternatives && ecoData.alternatives.length > 0) {
    drawSectionHeading(doc, 'Alternative Parts Changes');

    for (const alt of ecoData.alternatives) {
      checkPage(doc, 40);

      // Action badge + manufacturer
      const actionLabel = (alt.action || '').toUpperCase();
      const actionColor = alt.action === 'add' ? COLORS.green : alt.action === 'delete' ? COLORS.red : COLORS.blue;

      doc
        .fontSize(FONT_SIZE.body)
        .font('Helvetica-Bold')
        .fillColor(actionColor)
        .text(`[${actionLabel}]`, PAGE.marginLeft, doc.y, { continued: true })
        .fillColor(COLORS.darkText)
        .text(`  ${alt.manufacturer_name || 'Unknown'} — MFG P/N: ${alt.manufacturer_pn || '-'}`);

      // Previous info for updates/deletes
      if (alt.action !== 'add' && alt.existing_manufacturer_name) {
        doc
          .fontSize(FONT_SIZE.small)
          .font('Helvetica')
          .fillColor(COLORS.mutedText)
          .text(`Previous: ${alt.existing_manufacturer_name} / ${alt.existing_manufacturer_pn || '-'}`, PAGE.marginLeft + 12, doc.y);
      }

      // Nested distributors
      const altDists = Array.isArray(alt.distributors) ? alt.distributors : [];
      if (altDists.length > 0) {
        doc.y += 2;
        doc
          .fontSize(FONT_SIZE.small)
          .font('Helvetica-Bold')
          .fillColor(COLORS.gray)
          .text('Distributors:', PAGE.marginLeft + 12, doc.y);
        doc.y += 2;

        for (const dist of altDists) {
          checkPage(doc, 14);
          const dActionColor = dist.action === 'add' ? COLORS.green : dist.action === 'delete' ? COLORS.red : COLORS.blue;
          doc
            .fontSize(FONT_SIZE.small)
            .font('Helvetica')
            .fillColor(dActionColor)
            .text(`[${(dist.action || '').toUpperCase()}]`, PAGE.marginLeft + 20, doc.y, { continued: true })
            .fillColor(COLORS.darkText)
            .text(`  ${dist.distributor_name || 'Distributor'}${dist.sku ? ` | SKU: ${dist.sku}` : ''}${dist.url ? ` | ${dist.url}` : ''}`);
        }
      }

      doc.y += 6;
      drawHR(doc, doc.y, contentWidth - 20);
      doc.y += 4;
    }
  }

  // ===== CAD FILE CHANGES =====
  if (ecoData.cad_files && ecoData.cad_files.length > 0) {
    drawSectionHeading(doc, 'CAD File Changes');

    const cadHeaders = ['Action', 'File Name', 'File Type'];
    const cadColWidths = [contentWidth * 0.15, contentWidth * 0.55, contentWidth * 0.30];
    const cadRows = ecoData.cad_files.map(cf => [
      (cf.action || '').toUpperCase(),
      cf.file_name || cf.existing_file_name || '-',
      cf.file_type || cf.existing_file_type || '-',
    ]);
    drawTable(doc, cadHeaders, cadRows, cadColWidths);
  }

  // ===== REJECTION HISTORY =====
  if (ecoData.rejection_history && ecoData.rejection_history.length > 0) {
    drawSectionHeading(doc, 'Rejection History');

    for (const parentEco of ecoData.rejection_history) {
      checkPage(doc, 60);

      // Parent ECO header
      doc
        .fontSize(FONT_SIZE.body + 1)
        .font('Helvetica-Bold')
        .fillColor(COLORS.red)
        .text(parentEco.eco_number, PAGE.marginLeft, doc.y, { lineBreak: false });

      const dateStr = parentEco.created_at
        ? `  (${new Date(parentEco.created_at).toLocaleString()})`
        : '';
      doc
        .fontSize(FONT_SIZE.small)
        .font('Helvetica')
        .fillColor(COLORS.mutedText)
        .text(dateStr, { lineBreak: true });

      doc.y += 2;

      // Rejected by info
      if (parentEco.approved_by_name) {
        doc
          .fontSize(FONT_SIZE.small)
          .font('Helvetica')
          .fillColor(COLORS.red)
          .text(
            `Rejected by: ${parentEco.approved_by_name}${parentEco.approved_at ? ` on ${new Date(parentEco.approved_at).toLocaleString()}` : ''}`,
            PAGE.marginLeft, doc.y,
          );
      }

      // Rejection reason
      if (parentEco.rejection_reason) {
        doc.y += 2;
        doc
          .fontSize(FONT_SIZE.small)
          .font('Helvetica-Oblique')
          .fillColor(COLORS.darkText)
          .text(`Reason: ${parentEco.rejection_reason}`, PAGE.marginLeft, doc.y, { width: contentWidth });
      }

      // Component changes table (with resolved names)
      if (parentEco.changes && parentEco.changes.length > 0) {
        doc.y += 4;
        const changeHeaders = ['Field', 'Old Value', 'New Value'];
        const changeColWidths = [contentWidth * 0.25, contentWidth * 0.375, contentWidth * 0.375];
        const changeRows = parentEco.changes.map(c => {
          let oldVal = c.old_value || '-';
          let newVal = c.new_value || '-';
          if (c.field_name === 'category_id') {
            oldVal = c.old_category_name || oldVal;
            newVal = c.new_category_name || newVal;
          } else if (c.field_name === 'manufacturer_id') {
            oldVal = c.old_manufacturer_name || oldVal;
            newVal = c.new_manufacturer_name || newVal;
          } else if (c.field_name === '_status_proposal') {
            oldVal = getApprovalStatusLabel(oldVal);
            newVal = getApprovalStatusLabel(newVal);
          }
          return [formatFieldName(c.field_name), oldVal, newVal];
        });
        drawTable(doc, changeHeaders, changeRows, changeColWidths);
      }

      // Specification changes table
      if (parentEco.specifications && parentEco.specifications.length > 0) {
        doc.y += 4;
        checkPage(doc, 30);
        doc
          .fontSize(FONT_SIZE.small)
          .font('Helvetica-Bold')
          .fillColor(COLORS.darkText)
          .text('Specification Changes:', PAGE.marginLeft, doc.y);
        doc.y += 2;
        const specHeaders = ['Specification', 'Old Value', 'New Value'];
        const specColWidths = [contentWidth * 0.30, contentWidth * 0.35, contentWidth * 0.35];
        const specRows = parentEco.specifications.map(s => [
          `${s.spec_name || '-'}${s.unit ? ` (${s.unit})` : ''}`,
          s.old_value || '-',
          s.new_value || '-',
        ]);
        drawTable(doc, specHeaders, specRows, specColWidths);
      }

      // Distributor changes table
      if (parentEco.distributors && parentEco.distributors.length > 0) {
        doc.y += 4;
        checkPage(doc, 30);
        doc
          .fontSize(FONT_SIZE.small)
          .font('Helvetica-Bold')
          .fillColor(COLORS.darkText)
          .text('Distributor Changes:', PAGE.marginLeft, doc.y);
        doc.y += 2;
        const distHeaders = ['Action', 'Distributor', 'SKU', 'URL'];
        const distColWidths = [contentWidth * 0.12, contentWidth * 0.25, contentWidth * 0.25, contentWidth * 0.38];
        const distRows = parentEco.distributors.map(d => [
          d.action?.toUpperCase() || '-',
          d.distributor_name || '-',
          d.sku || '-',
          d.url || '-',
        ]);
        drawTable(doc, distHeaders, distRows, distColWidths);
      }

      // Alternative parts changes
      if (parentEco.alternatives && parentEco.alternatives.length > 0) {
        doc.y += 4;
        checkPage(doc, 30);
        doc
          .fontSize(FONT_SIZE.small)
          .font('Helvetica-Bold')
          .fillColor(COLORS.darkText)
          .text('Alternative Parts Changes:', PAGE.marginLeft, doc.y);
        doc.y += 4;

        for (const alt of parentEco.alternatives) {
          checkPage(doc, 30);
          const actionLabel = (alt.action || '').toUpperCase();
          const actionColor = alt.action === 'add' ? COLORS.green : alt.action === 'delete' ? COLORS.red : COLORS.blue;

          doc
            .fontSize(FONT_SIZE.small)
            .font('Helvetica-Bold')
            .fillColor(actionColor)
            .text(`[${actionLabel}]`, PAGE.marginLeft + 8, doc.y, { continued: true })
            .fillColor(COLORS.darkText)
            .text(`  ${alt.manufacturer_name || 'Unknown'} — MFG P/N: ${alt.manufacturer_pn || '-'}`);

          if (alt.action !== 'add' && alt.existing_manufacturer_name) {
            doc
              .fontSize(FONT_SIZE.small)
              .font('Helvetica')
              .fillColor(COLORS.mutedText)
              .text(`Previous: ${alt.existing_manufacturer_name} / ${alt.existing_manufacturer_pn || '-'}`, PAGE.marginLeft + 16, doc.y);
          }

          const altDists = Array.isArray(alt.distributors) ? alt.distributors : [];
          if (altDists.length > 0) {
            for (const dist of altDists) {
              checkPage(doc, 12);
              const dColor = dist.action === 'add' ? COLORS.green : dist.action === 'delete' ? COLORS.red : COLORS.blue;
              doc
                .fontSize(FONT_SIZE.small)
                .font('Helvetica')
                .fillColor(dColor)
                .text(`[${(dist.action || '').toUpperCase()}]`, PAGE.marginLeft + 20, doc.y, { continued: true })
                .fillColor(COLORS.darkText)
                .text(`  ${dist.distributor_name || 'Distributor'}${dist.sku ? ` | SKU: ${dist.sku}` : ''}${dist.url ? ` | ${dist.url}` : ''}`);
            }
          }
          doc.y += 3;
        }
      }

      // CAD file changes
      if (parentEco.cad_files && parentEco.cad_files.length > 0) {
        doc.y += 4;
        checkPage(doc, 30);
        doc
          .fontSize(FONT_SIZE.small)
          .font('Helvetica-Bold')
          .fillColor(COLORS.darkText)
          .text('CAD File Changes:', PAGE.marginLeft, doc.y);
        doc.y += 2;
        const cadHeaders = ['Action', 'File Name', 'File Type'];
        const cadColWidths = [contentWidth * 0.15, contentWidth * 0.55, contentWidth * 0.30];
        const cadRows = parentEco.cad_files.map(cf => [
          (cf.action || '').toUpperCase(),
          cf.file_name || cf.existing_file_name || '-',
          cf.file_type || cf.existing_file_type || '-',
        ]);
        drawTable(doc, cadHeaders, cadRows, cadColWidths);
      }

      // Votes
      if (parentEco.approvals && parentEco.approvals.length > 0) {
        doc.y += 2;
        parentEco.approvals.forEach(vote => {
          checkPage(doc, 12);
          doc
            .fontSize(FONT_SIZE.small)
            .font('Helvetica')
            .fillColor(vote.decision === 'approved' ? COLORS.green : COLORS.red)
            .text(
              `${vote.user_name} — ${vote.decision}${vote.user_role ? ` (${vote.user_role})` : ''}${vote.comments ? `: ${vote.comments}` : ''}`,
              PAGE.marginLeft, doc.y, { width: contentWidth },
            );
        });
      }

      doc.y += 6;
      drawHR(doc, doc.y);
      doc.y += 6;
    }
  }

  // ===== FOOTER on all pages =====
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    const footerY = PAGE.height - PAGE.marginBottom + 10;

    doc
      .fontSize(FONT_SIZE.small)
      .font('Helvetica')
      .fillColor(COLORS.mutedText);

    // Left-aligned timestamp
    doc.text(
      `Generated: ${new Date().toLocaleString()}`,
      PAGE.marginLeft,
      footerY,
      { lineBreak: false },
    );

    // Right-aligned page number (manual positioning)
    const pageText = `Page ${i + 1} of ${pages.count}`;
    const pageTextWidth = doc.widthOfString(pageText);
    doc.text(
      pageText,
      PAGE.width - PAGE.marginRight - pageTextWidth,
      footerY,
      { lineBreak: false },
    );
  }

  if (options.autoEnd !== false) {
    doc.end();
  }
  return doc;
};

export const generateECOPdfBuffer = async (ecoData, options = {}) => {
  const headerText = typeof options.headerText === 'string' && options.headerText.trim().length > 0
    ? options.headerText.trim()
    : DEFAULT_ECO_PDF_HEADER;
  const doc = createEcoPdfDocument(ecoData, headerText);
  const chunks = [];

  const bufferPromise = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  generateECOPdf(ecoData, { ...options, document: doc });
  return bufferPromise;
};
