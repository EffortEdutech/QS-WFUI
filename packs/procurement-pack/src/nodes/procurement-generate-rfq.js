"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realGenerateRfq = realGenerateRfq;
const docx_1 = require("docx");
const BRAND_BLUE = '1E3A5F';
const HEADER_GREY = 'E8EDF2';
const BORDER_COLOR = 'C5CDD6';
function cell(text, opts = {}) {
    return new docx_1.TableCell({
        shading: opts.shade ? { type: docx_1.ShadingType.SOLID, color: HEADER_GREY } : undefined,
        borders: {
            top: { style: docx_1.BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
            bottom: { style: docx_1.BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
            left: { style: docx_1.BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
            right: { style: docx_1.BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
        },
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [
            new docx_1.Paragraph({
                alignment: opts.center ? docx_1.AlignmentType.CENTER : docx_1.AlignmentType.LEFT,
                children: [
                    new docx_1.TextRun({ text, bold: opts.bold, size: opts.small ? 16 : 18 }),
                ],
            }),
        ],
    });
}
function spacer(lines = 1) {
    return Array.from({ length: lines }, () => new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: '' })] }));
}
function formatDate(dateStr, addDays) {
    try {
        const base = dateStr ? new Date(dateStr) : new Date();
        if (addDays)
            base.setDate(base.getDate() + addDays);
        return base.toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' });
    }
    catch {
        return dateStr ?? '';
    }
}
function buildRfqDocument(pkg, opts) {
    const { rfqTitle, projectName, rfqRef, issuedDate, closingDate, includeBoq } = opts;
    const { label, items, subtotal, currency } = pkg;
    const lineItems = includeBoq
        ? items.filter((it) => !it.is_section_header)
        : [];
    const titleBlock = [
        new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            spacing: { before: 0, after: 200 },
            children: [new docx_1.TextRun({ text: 'REQUEST FOR QUOTATION', bold: true, size: 48, color: BRAND_BLUE })],
        }),
        new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            spacing: { before: 0, after: 160 },
            children: [new docx_1.TextRun({ text: rfqTitle, bold: true, size: 28, color: BRAND_BLUE })],
        }),
        new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            spacing: { before: 0, after: 400 },
            children: [new docx_1.TextRun({ text: `Trade Package: ${label}`, size: 22, color: '555555' })],
        }),
    ];
    const infoTable = new docx_1.Table({
        width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
        rows: [
            new docx_1.TableRow({ children: [cell('RFQ Reference', { bold: true, shade: true }), cell(rfqRef), cell('Date Issued', { bold: true, shade: true }), cell(issuedDate)] }),
            new docx_1.TableRow({ children: [cell('Project', { bold: true, shade: true }), cell(projectName), cell('Response Due', { bold: true, shade: true }), cell(closingDate)] }),
            new docx_1.TableRow({ children: [cell('Trade Package', { bold: true, shade: true }), cell(label), cell('Currency', { bold: true, shade: true }), cell(currency)] }),
        ],
    });
    const scopeSection = [
        ...spacer(),
        new docx_1.Paragraph({
            heading: docx_1.HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
            children: [new docx_1.TextRun({ text: '1.  SCOPE OF WORKS', bold: true, size: 24, color: BRAND_BLUE })],
        }),
        new docx_1.Paragraph({
            spacing: { before: 0, after: 200 },
            children: [new docx_1.TextRun({
                    text: `You are invited to submit your best quotation for the following works forming part of ${projectName}. All works shall be carried out in accordance with the project specifications, drawings, and conditions listed herein.`,
                    size: 20,
                })],
        }),
    ];
    const boqSection = [];
    if (includeBoq && lineItems.length > 0) {
        const headerRow = new docx_1.TableRow({
            tableHeader: true,
            children: [
                cell('Item No', { bold: true, shade: true, center: true, small: true }),
                cell('Description', { bold: true, shade: true, small: true }),
                cell('Unit', { bold: true, shade: true, center: true, small: true }),
                cell('Qty', { bold: true, shade: true, center: true, small: true }),
                cell(`Rate (${currency})`, { bold: true, shade: true, center: true, small: true }),
                cell(`Amount (${currency})`, { bold: true, shade: true, center: true, small: true }),
            ],
        });
        const dataRows = lineItems.map((it) => new docx_1.TableRow({
            children: [
                cell(it.item_no ?? '', { center: true, small: true }),
                cell(it.description ?? '', { small: true }),
                cell(it.unit ?? '', { center: true, small: true }),
                cell(it.qty != null ? String(it.qty) : '', { center: true, small: true }),
                cell('', { center: true, small: true }),
                cell(it.amount != null ? it.amount.toFixed(2) : '', { center: true, small: true }),
            ],
        }));
        const subtotalRow = new docx_1.TableRow({
            children: [
                cell('', {}),
                cell('Indicative Sub-Total (for reference only)', { bold: true, small: true }),
                cell('', {}), cell('', {}), cell('', {}),
                cell(subtotal > 0 ? subtotal.toFixed(2) : '', { bold: true, center: true, small: true }),
            ],
        });
        boqSection.push(...spacer(), new docx_1.Paragraph({
            heading: docx_1.HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
            children: [new docx_1.TextRun({ text: '2.  BILL OF QUANTITIES', bold: true, size: 24, color: BRAND_BLUE })],
        }), new docx_1.Paragraph({
            spacing: { before: 0, after: 160 },
            children: [new docx_1.TextRun({
                    text: 'Prices in Rate column are to be completed by Contractor. The indicative amounts shown are for reference only.',
                    size: 18, italics: true, color: '666666',
                })],
        }), new docx_1.Table({
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows, subtotalRow],
            columnWidths: [900, 4000, 700, 700, 1200, 1200],
        }));
    }
    const sectionNum = includeBoq ? '3' : '2';
    const termsSection = [
        ...spacer(),
        new docx_1.Paragraph({
            heading: docx_1.HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
            children: [new docx_1.TextRun({ text: `${sectionNum}.  TERMS AND CONDITIONS`, bold: true, size: 24, color: BRAND_BLUE })],
        }),
        ...[
            `1. All prices shall be quoted in ${currency} and shall be inclusive of all materials, labour, plant, overhead, profit, and applicable taxes.`,
            '2. Quotations must remain valid for a minimum of 90 days from the date of submission.',
            `3. Completed quotations must be submitted no later than ${closingDate}.`,
            '4. The Employer reserves the right to accept or reject any or all quotations without assigning reasons.',
            '5. Sub-contracting of works shall not be permitted without prior written approval.',
            '6. All works shall comply with Malaysian Standard (MS), UBBL, and CIDB requirements.',
        ].map((term) => new docx_1.Paragraph({
            spacing: { before: 60, after: 60 },
            indent: { left: (0, docx_1.convertInchesToTwip)(0.2) },
            children: [new docx_1.TextRun({ text: term, size: 18 })],
        })),
    ];
    const sigBlock = [
        ...spacer(2),
        new docx_1.Table({
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: {
                top: { style: docx_1.BorderStyle.NONE }, bottom: { style: docx_1.BorderStyle.NONE },
                left: { style: docx_1.BorderStyle.NONE }, right: { style: docx_1.BorderStyle.NONE },
                insideHorizontal: { style: docx_1.BorderStyle.NONE }, insideVertical: { style: docx_1.BorderStyle.NONE },
            },
            rows: [
                new docx_1.TableRow({
                    children: [
                        new docx_1.TableCell({
                            borders: { top: { style: docx_1.BorderStyle.NONE }, bottom: { style: docx_1.BorderStyle.NONE }, left: { style: docx_1.BorderStyle.NONE }, right: { style: docx_1.BorderStyle.NONE } },
                            children: [
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Submitted by (Contractor):', bold: true, size: 18 })] }),
                                ...spacer(3),
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: '________________________________', size: 18 })] }),
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Name:   ________________________', size: 18 })] }),
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Date:    ________________________', size: 18 })] }),
                            ],
                        }),
                        new docx_1.TableCell({
                            borders: { top: { style: docx_1.BorderStyle.NONE }, bottom: { style: docx_1.BorderStyle.NONE }, left: { style: docx_1.BorderStyle.NONE }, right: { style: docx_1.BorderStyle.NONE } },
                            children: [
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Received by (Employer):', bold: true, size: 18 })] }),
                                ...spacer(3),
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: '________________________________', size: 18 })] }),
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Name:   ________________________', size: 18 })] }),
                                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: 'Date:    ________________________', size: 18 })] }),
                            ],
                        }),
                    ],
                }),
            ],
        }),
        ...spacer(),
        new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            children: [new docx_1.TextRun({
                    text: `Generated by Lados Workflow Platform — ${new Date().toLocaleDateString('en-MY')} | AI-assisted, for human review only`,
                    size: 14, color: 'AAAAAA', italics: true,
                })],
        }),
    ];
    return new docx_1.Document({
        styles: { default: { document: { run: { font: 'Calibri', size: 20 } } } },
        sections: [{
                properties: {
                    page: {
                        margin: {
                            top: (0, docx_1.convertInchesToTwip)(1),
                            bottom: (0, docx_1.convertInchesToTwip)(1),
                            left: (0, docx_1.convertInchesToTwip)(1.25),
                            right: (0, docx_1.convertInchesToTwip)(1.25),
                        },
                    },
                },
                children: [...titleBlock, infoTable, ...scopeSection, ...boqSection, ...termsSection, ...sigBlock],
            }],
    });
}
async function realGenerateRfq(ctx, libraryService) {
    const workPackages = ctx.inputs['work_packages'];
    if (!workPackages || workPackages.length === 0) {
        return {
            status: 'failure', outputs: {}, logs: [],
            error: { code: 'NO_WORK_PACKAGES', message: 'No work packages provided. Connect a Split Work Package node before Generate RFQ.' },
        };
    }
    const maxPackages = Math.max(1, Number(ctx.config['max_packages'] ?? 5));
    const projectName = ctx.config['project_name']?.trim() || 'Project';
    const rfqTitle = ctx.config['rfq_title']?.trim() || `RFQ — ${projectName}`;
    const closingDateCfg = ctx.config['closing_date'];
    const dueDateDays = Number(ctx.config['due_date_days'] ?? 14);
    const includeBoq = ctx.config['include_boq'] !== false;
    const issuedDate = formatDate();
    const closingDate = closingDateCfg ? formatDate(closingDateCfg) : formatDate(undefined, dueDateDays);
    const packagesToProcess = workPackages.slice(0, maxPackages);
    ctx.logger.info(`Generating RFQ DOCX for ${packagesToProcess.length} trade package(s)`);
    const artifacts = [];
    const errors = [];
    for (let i = 0; i < packagesToProcess.length; i++) {
        const pkg = packagesToProcess[i];
        const rfqRef = `RFQ-${pkg.trade.toUpperCase()}-${Date.now().toString().slice(-6)}`;
        ctx.logger.info(`[${i + 1}/${packagesToProcess.length}] Building ${pkg.label}...`);
        let buffer;
        try {
            const doc = buildRfqDocument(pkg, { rfqTitle, projectName, rfqRef, issuedDate, closingDate, includeBoq });
            buffer = await docx_1.Packer.toBuffer(doc);
            ctx.logger.info(`  DOCX built — ${(buffer.length / 1024).toFixed(1)} KB`);
        }
        catch (err) {
            const msg = `Failed to build DOCX for ${pkg.label}: ${err instanceof Error ? err.message : String(err)}`;
            ctx.logger.warn(msg);
            errors.push(msg);
            continue;
        }
        const safeTrade = pkg.trade.replace(/[^a-z0-9]/gi, '_');
        const storagePath = `artifacts/${ctx.organizationId}/${ctx.executionId}/${safeTrade}_${Date.now()}_rfq.docx`;
        try {
            await libraryService.uploadBuffer(buffer, storagePath, 'application/octet-stream');
            ctx.logger.info(`  Uploaded to: ${storagePath}`);
        }
        catch (err) {
            const msg = `Storage upload failed for ${pkg.label}: ${err instanceof Error ? err.message : String(err)}`;
            ctx.logger.warn(msg);
            errors.push(msg);
            continue;
        }
        let signedUrl;
        try {
            signedUrl = await libraryService.createSignedUrl(storagePath, 7200);
        }
        catch (err) {
            const msg = `Signed URL failed for ${pkg.label}: ${err instanceof Error ? err.message : String(err)}`;
            ctx.logger.warn(msg);
            errors.push(msg);
            continue;
        }
        artifacts.push({
            trade: pkg.trade,
            label: pkg.label,
            storage_path: storagePath,
            url: signedUrl,
            size_bytes: buffer.length,
            package_value: pkg.subtotal,
            currency: pkg.currency,
            item_count: pkg.line_item_count,
        });
    }
    if (artifacts.length === 0) {
        return {
            status: 'failure',
            outputs: { errors },
            logs: [],
            error: { code: 'ALL_PACKAGES_FAILED', message: `All ${packagesToProcess.length} packages failed. Errors: ${errors.join('; ')}` },
        };
    }
    const summary = `Generated ${artifacts.length} RFQ document${artifacts.length > 1 ? 's' : ''}: ${artifacts.map((a) => a.label).join(', ')}`;
    ctx.logger.info(summary);
    return {
        status: 'success',
        outputs: {
            documents: artifacts,
            document_count: artifacts.length,
            rfq_summary: {
                project_name: projectName,
                closing_date: closingDate,
                package_count: artifacts.length,
                packages: artifacts.map((a) => ({ trade: a.trade, label: a.label, items: a.item_count, value: a.package_value, currency: a.currency })),
            },
        },
        logs: [],
        summary,
    };
}
//# sourceMappingURL=procurement-generate-rfq.js.map