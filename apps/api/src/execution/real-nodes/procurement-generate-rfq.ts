/**
 * Real implementation: procurement.generate_rfq
 *
 * Generates a Request for Quotation (RFQ) Word document (.docx) for each
 * trade work package, uploads it to Supabase Storage, and returns signed URLs
 * that expire in 2 hours (for immediate download after a workflow run).
 *
 * Output documents array can be detected by ExecutionLogPanel to render
 * clickable download links.
 *
 * Security note: AI is advisory only. This node produces procurement
 * documents for human review — it does not award or commit contracts.
 *
 * Sprint 9 (S9-003)
 */
import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  Packer,
  WidthType,
  BorderStyle,
  HeadingLevel,
  convertInchesToTwip,
  ShadingType,
} from 'docx';
import type { NodeContext, NodeExecuteResult } from '@qsos/execution-engine';
import type { LibraryService } from '../../library/library.service';
import type { WorkPackage } from './qs-split-work-package';
import type { ClassifiedItem } from './qs-classify-trade';

// ── Document colours ───────────────────────────────────────────────────────────

const BRAND_BLUE   = '1E3A5F';  // dark navy header
const HEADER_GREY  = 'E8EDF2';  // light blue-grey table header
const BORDER_COLOR = 'C5CDD6';
const WHITE        = 'FFFFFF';

// ── Helpers ────────────────────────────────────────────────────────────────────

function cell(
  text: string,
  opts: { bold?: boolean; shade?: boolean; center?: boolean; small?: boolean } = {},
): TableCell {
  return new TableCell({
    shading: opts.shade ? { type: ShadingType.SOLID, color: HEADER_GREY } : undefined,
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
      left:   { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
      right:  { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
    },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: opts.bold,
            size: opts.small ? 16 : 18, // half-points
          }),
        ],
      }),
    ],
  });
}

function spacer(lines = 1): Paragraph[] {
  return Array.from({ length: lines }, () =>
    new Paragraph({ children: [new TextRun({ text: '' })] }),
  );
}

function formatCurrency(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return '';
  return `${currency} ${value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr?: string, addDays?: number): string {
  try {
    const base = dateStr ? new Date(dateStr) : new Date();
    if (addDays) base.setDate(base.getDate() + addDays);
    return base.toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return dateStr ?? '';
  }
}

// ── DOCX builder ───────────────────────────────────────────────────────────────

function buildRfqDocument(
  pkg: WorkPackage,
  opts: {
    rfqTitle: string;
    projectName: string;
    rfqRef: string;
    issuedDate: string;
    closingDate: string;
    includeBoq: boolean;
  },
): Document {
  const { rfqTitle, projectName, rfqRef, issuedDate, closingDate, includeBoq } = opts;
  const { label, items, subtotal, currency } = pkg;

  const lineItems = includeBoq
    ? items.filter((it: ClassifiedItem) => !it.is_section_header)
    : [];

  // ── Header ────────────────────────────────────────────────────────────────────
  const titleBlock = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: 'REQUEST FOR QUOTATION',
          bold: true,
          size: 48,         // 24pt
          color: BRAND_BLUE,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
      children: [new TextRun({ text: rfqTitle, bold: true, size: 28, color: BRAND_BLUE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 400 },
      children: [
        new TextRun({ text: `Trade Package: ${label}`, size: 22, color: '555555' }),
      ],
    }),
  ];

  // ── Project info table ────────────────────────────────────────────────────────
  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell('RFQ Reference',  { bold: true, shade: true }),
          cell(rfqRef),
          cell('Date Issued',    { bold: true, shade: true }),
          cell(issuedDate),
        ],
      }),
      new TableRow({
        children: [
          cell('Project',        { bold: true, shade: true }),
          cell(projectName),
          cell('Response Due',   { bold: true, shade: true }),
          cell(closingDate),
        ],
      }),
      new TableRow({
        children: [
          cell('Trade Package',  { bold: true, shade: true }),
          cell(label),
          cell('Currency',       { bold: true, shade: true }),
          cell(currency),
        ],
      }),
    ],
  });

  // ── Scope section ─────────────────────────────────────────────────────────────
  const scopeSection = [
    ...spacer(),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: '1.  SCOPE OF WORKS', bold: true, size: 24, color: BRAND_BLUE })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: `You are invited to submit your best quotation for the following works forming part of ${projectName}. All works shall be carried out in accordance with the project specifications, drawings, and conditions listed herein.`,
          size: 20,
        }),
      ],
    }),
  ];

  // ── BOQ table ──────────────────────────────────────────────────────────────────
  const boqSection: (Paragraph | Table)[] = [];
  if (includeBoq && lineItems.length > 0) {
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        cell('Item No',        { bold: true, shade: true, center: true, small: true }),
        cell('Description',    { bold: true, shade: true, small: true }),
        cell('Unit',           { bold: true, shade: true, center: true, small: true }),
        cell('Qty',            { bold: true, shade: true, center: true, small: true }),
        cell(`Rate (${currency})`, { bold: true, shade: true, center: true, small: true }),
        cell(`Amount (${currency})`, { bold: true, shade: true, center: true, small: true }),
      ],
    });

    const dataRows = lineItems.map((it: ClassifiedItem) =>
      new TableRow({
        children: [
          cell(it.item_no ?? '',          { center: true, small: true }),
          cell(it.description ?? '',      { small: true }),
          cell(it.unit ?? '',             { center: true, small: true }),
          cell(it.qty != null ? String(it.qty) : '', { center: true, small: true }),
          cell('',                        { center: true, small: true }), // blank — contractor fills
          cell(it.amount != null ? it.amount.toFixed(2) : '', { center: true, small: true }),
        ],
      }),
    );

    const subtotalRow = new TableRow({
      children: [
        cell('',                          {}),
        cell('Indicative Sub-Total (for reference only)', { bold: true, small: true }),
        cell('',   {}),
        cell('',   {}),
        cell('',   {}),
        cell(subtotal > 0 ? subtotal.toFixed(2) : '', { bold: true, center: true, small: true }),
      ],
    });

    boqSection.push(
      ...spacer(),
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
        children: [new TextRun({ text: '2.  BILL OF QUANTITIES', bold: true, size: 24, color: BRAND_BLUE })],
      }),
      new Paragraph({
        spacing: { before: 0, after: 160 },
        children: [
          new TextRun({
            text: 'Prices in Rate column are to be completed by Contractor. The indicative amounts shown are for reference only and shall not be taken as the contract sum.',
            size: 18,
            italics: true,
            color: '666666',
          }),
        ],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...dataRows, subtotalRow],
        columnWidths: [900, 4000, 700, 700, 1200, 1200], // in DXA units
      }),
    );
  }

  // ── Terms section ──────────────────────────────────────────────────────────────
  const termsSection = [
    ...spacer(),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: includeBoq ? '3.  TERMS AND CONDITIONS' : '2.  TERMS AND CONDITIONS', bold: true, size: 24, color: BRAND_BLUE })],
    }),
    ...[
      `1. All prices shall be quoted in ${currency} and shall be inclusive of all materials, labour, plant, overhead, profit, and applicable taxes.`,
      '2. Quotations must remain valid for a minimum of 90 days from the date of submission.',
      `3. Completed quotations must be submitted no later than ${closingDate}.`,
      '4. The Employer reserves the right to accept or reject any or all quotations without assigning reasons.',
      '5. Sub-contracting of works shall not be permitted without prior written approval.',
      '6. All works shall comply with Malaysian Standard (MS), UBBL, and CIDB requirements.',
    ].map((term) =>
      new Paragraph({
        spacing: { before: 60, after: 60 },
        indent: { left: convertInchesToTwip(0.2) },
        children: [new TextRun({ text: term, size: 18 })],
      }),
    ),
  ];

  // ── Signature block ────────────────────────────────────────────────────────────
  const sigBlock = [
    ...spacer(2),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: 'Submitted by (Contractor):', bold: true, size: 18 })] }),
                ...spacer(3),
                new Paragraph({ children: [new TextRun({ text: '________________________________', size: 18 })] }),
                new Paragraph({ children: [new TextRun({ text: 'Name:   ________________________', size: 18 })] }),
                new Paragraph({ children: [new TextRun({ text: 'Title:    ________________________', size: 18 })] }),
                new Paragraph({ children: [new TextRun({ text: 'Date:    ________________________', size: 18 })] }),
              ],
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            }),
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: 'Received by (Employer):', bold: true, size: 18 })] }),
                ...spacer(3),
                new Paragraph({ children: [new TextRun({ text: '________________________________', size: 18 })] }),
                new Paragraph({ children: [new TextRun({ text: 'Name:   ________________________', size: 18 })] }),
                new Paragraph({ children: [new TextRun({ text: 'Title:    ________________________', size: 18 })] }),
                new Paragraph({ children: [new TextRun({ text: 'Date:    ________________________', size: 18 })] }),
              ],
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            }),
          ],
        }),
      ],
    }),
    ...spacer(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Generated by QS-OS Workflow Platform — ${new Date().toLocaleDateString('en-MY')} | AI-assisted, for human review only`,
          size: 14,
          color: 'AAAAAA',
          italics: true,
        }),
      ],
    }),
  ];

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top:    convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left:   convertInchesToTwip(1.25),
              right:  convertInchesToTwip(1.25),
            },
          },
        },
        children: [
          ...titleBlock,
          infoTable,
          ...scopeSection,
          ...boqSection,
          ...termsSection,
          ...sigBlock,
        ],
      },
    ],
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────

export interface RfqArtifact {
  trade: string;
  label: string;
  storage_path: string;
  url: string;
  size_bytes: number;
  package_value: number;
  currency: string;
  item_count: number;
}

export async function realGenerateRfq(
  ctx: NodeContext,
  libraryService: LibraryService,
): Promise<NodeExecuteResult> {
  const workPackages = ctx.inputs['work_packages'] as WorkPackage[] | undefined;

  if (!workPackages || workPackages.length === 0) {
    return {
      status: 'failure',
      outputs: {},
      logs: [],
      error: {
        code: 'NO_WORK_PACKAGES',
        message: 'No work packages provided. Connect a Split Work Package node before Generate RFQ.',
      },
    };
  }

  const maxPackages = Math.max(1, Number(ctx.config['max_packages'] ?? 5));
  const projectName = (ctx.config['project_name'] as string | undefined)?.trim() || 'Project';
  const rfqTitle    = (ctx.config['rfq_title']    as string | undefined)?.trim() || `RFQ — ${projectName}`;
  const closingDateCfg = ctx.config['closing_date'] as string | undefined;
  const dueDateDays    = Number(ctx.config['due_date_days'] ?? 14);
  const includeBoq     = ctx.config['include_boq'] !== false;

  const issuedDate  = formatDate();
  const closingDate = closingDateCfg ? formatDate(closingDateCfg) : formatDate(undefined, dueDateDays);

  const packagesToProcess = workPackages.slice(0, maxPackages);
  ctx.logger.info(
    `Generating RFQ DOCX for ${packagesToProcess.length} trade package(s) (max ${maxPackages})`,
  );

  const artifacts: RfqArtifact[] = [];
  const errors: string[] = [];

  for (let i = 0; i < packagesToProcess.length; i++) {
    const pkg = packagesToProcess[i];
    const rfqRef = `RFQ-${pkg.trade.toUpperCase()}-${Date.now().toString().slice(-6)}`;

    ctx.logger.info(`[${i + 1}/${packagesToProcess.length}] Building ${pkg.label}...`);

    let buffer: Buffer;
    try {
      const doc = buildRfqDocument(pkg, {
        rfqTitle,
        projectName,
        rfqRef,
        issuedDate,
        closingDate,
        includeBoq,
      });
      buffer = await Packer.toBuffer(doc);
      ctx.logger.info(`  DOCX built — ${(buffer.length / 1024).toFixed(1)} KB`);
    } catch (err: unknown) {
      const msg = `Failed to build DOCX for ${pkg.label}: ${err instanceof Error ? err.message : String(err)}`;
      ctx.logger.warn(msg);
      errors.push(msg);
      continue;
    }

    // Upload to Supabase Storage
    const safeTrade  = pkg.trade.replace(/[^a-z0-9]/gi, '_');
    const timestamp  = Date.now();
    const storagePath = `artifacts/${ctx.organizationId}/${ctx.executionId}/${safeTrade}_${timestamp}_rfq.docx`;

    try {
      // Upload as octet-stream — bucket MIME allowlist doesn't include docx yet.
      // Run the SQL in migration 0009 notes to add the proper MIME type.
      // File content is unchanged: it is still a valid .docx.
      await libraryService.uploadBuffer(
        buffer,
        storagePath,
        'application/octet-stream',
      );
      ctx.logger.info(`  Uploaded to: ${storagePath}`);
    } catch (err: unknown) {
      const msg = `Storage upload failed for ${pkg.label}: ${err instanceof Error ? err.message : String(err)}`;
      ctx.logger.warn(msg);
      errors.push(msg);
      continue;
    }

    // Get signed URL (2-hour expiry)
    let signedUrl: string;
    try {
      signedUrl = await libraryService.createSignedUrl(storagePath, 7200);
    } catch (err: unknown) {
      const msg = `Signed URL failed for ${pkg.label}: ${err instanceof Error ? err.message : String(err)}`;
      ctx.logger.warn(msg);
      errors.push(msg);
      continue;
    }

    artifacts.push({
      trade:         pkg.trade,
      label:         pkg.label,
      storage_path:  storagePath,
      url:           signedUrl,
      size_bytes:    buffer.length,
      package_value: pkg.subtotal,
      currency:      pkg.currency,
      item_count:    pkg.line_item_count,
    });
  }

  if (artifacts.length === 0) {
    return {
      status: 'failure',
      outputs: { errors },
      logs: [],
      error: {
        code: 'ALL_PACKAGES_FAILED',
        message: `All ${packagesToProcess.length} packages failed to generate. Errors: ${errors.join('; ')}`,
      },
    };
  }

  const summary = `Generated ${artifacts.length} RFQ document${artifacts.length > 1 ? 's' : ''}: ${artifacts.map((a) => a.label).join(', ')}`;
  ctx.logger.info(summary);

  return {
    status: 'success',
    outputs: {
      documents:        artifacts,    // ExecutionLogPanel detects this for download links
      document_count:   artifacts.length,
      rfq_summary: {
        project_name:    projectName,
        closing_date:    closingDate,
        package_count:   artifacts.length,
        packages:        artifacts.map((a) => ({
          trade:  a.trade,
          label:  a.label,
          items:  a.item_count,
          value:  a.package_value,
          currency: a.currency,
        })),
      },
    },
    logs: [],
    summary,
  };
}
