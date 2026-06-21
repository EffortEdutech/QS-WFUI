"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMockExecutor = getMockExecutor;
exports.hasMockFor = hasMockFor;
function success(outputs, summary) {
    return { status: 'success', outputs, summary: summary ?? 'OK', logs: [] };
}
function failure(code, message) {
    return {
        status: 'failure',
        outputs: {},
        logs: [],
        error: { code, message },
    };
}
function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
}
const mocks = {
    'core.manual_trigger': async (ctx) => {
        await delay(50);
        return success({ triggered_at: new Date().toISOString(), inputs: ctx.inputs }, 'Manual trigger fired');
    },
    'core.human_approval': async (_ctx) => {
        await delay(100);
        return success({ approved: true, approved_by: 'mock-approver', approved_at: new Date().toISOString() }, 'Auto-approved by mock');
    },
    'core.logger': async (ctx) => {
        await delay(20);
        const message = ctx.config['message'] ?? '(no message)';
        return success({ logged: true }, `Logged: ${message}`);
    },
    'document.upload_file': async (_ctx) => {
        await delay(80);
        return success({
            file_id: `mock-file-${Date.now()}`,
            file_name: 'mock_upload.xlsx',
            file_size_bytes: 204800,
            mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            storage_path: 'uploads/mock_upload.xlsx',
        }, 'File uploaded (mock)');
    },
    'document.read_excel': async (ctx) => {
        await delay(120);
        const fileId = ctx.inputs['file_id'] ?? ctx.config['file_path'] ?? 'mock';
        return success({
            file_id: fileId,
            sheets: ['BOQ'],
            row_count: 250,
            rows: [
                { row: 1, A: 'Item No', B: 'Description', C: 'Unit', D: 'Qty', E: 'Rate', F: 'Amount' },
                { row: 2, A: '1.1', B: 'Excavation in hard rock', C: 'm³', D: 150, E: 85.0, F: 12750.0 },
                { row: 3, A: '1.2', B: 'Backfilling with selected fill', C: 'm³', D: 120, E: 45.0, F: 5400.0 },
            ],
        }, `Read ${250} rows from Excel (mock)`);
    },
    'document.save_file': async (ctx) => {
        await delay(60);
        const fileName = ctx.config['file_name'] ?? 'output.xlsx';
        return success({
            saved: true,
            file_name: fileName,
            storage_path: `outputs/${fileName}`,
            size_bytes: 102400,
        }, `Saved ${fileName} (mock)`);
    },
    'qs.read_boq': async (ctx) => {
        await delay(150);
        const source = ctx.inputs['file_id'] ?? ctx.config['source'];
        return success({
            boq_id: `boq-${Date.now()}`,
            source,
            total_items: 48,
            total_value: 2_850_000.0,
            currency: 'MYR',
            trades: ['Civil', 'Structural', 'M&E', 'Finishing'],
            items: [
                { item_no: '1.1', description: 'Excavation in hard rock', unit: 'm³', qty: 150, rate: 85.0, amount: 12750.0, trade: 'Civil' },
                { item_no: '2.1', description: 'Reinforced concrete column', unit: 'm³', qty: 45, rate: 1200.0, amount: 54000.0, trade: 'Structural' },
            ],
        }, 'BOQ parsed: 48 items, MYR 2.85M (mock)');
    },
    'qs.clean_boq': async (ctx) => {
        await delay(200);
        const boq = ctx.inputs['boq'] ?? {};
        const itemCount = boq['total_items'] ?? 48;
        return success({
            ...boq,
            cleaned: true,
            issues_found: 3,
            issues_fixed: 3,
            total_items: itemCount,
            cleaning_log: [
                { row: 5, issue: 'Missing unit', fix: 'Inferred "m³" from description' },
                { row: 12, issue: 'Duplicate item number', fix: 'Renamed to 2.1a' },
                { row: 31, issue: 'Zero rate', fix: 'Flagged for review — not auto-fixed' },
            ],
        }, `BOQ cleaned: 3 issues found, 2 auto-fixed (mock)`);
    },
    'qs.classify_trade': async (ctx) => {
        await delay(300);
        const boq = ctx.inputs['boq'] ?? {};
        return success({
            ...boq,
            classified: true,
            classification_model: 'mock-classifier-v1',
            trades_found: ['Civil', 'Structural', 'Mechanical', 'Electrical', 'Finishing'],
            items_classified: boq['total_items'] ?? 48,
            confidence_avg: 0.94,
        }, 'Classified 48 items across 5 trades (mock)');
    },
    'qs.split_work_package': async (ctx) => {
        await delay(250);
        const boq = ctx.inputs['boq'] ?? {};
        const trades = boq['trades_found'] ?? ['Civil', 'Structural'];
        return success({
            work_packages: trades.map((trade, i) => ({
                id: `wp-${i + 1}`,
                trade,
                item_count: Math.floor(48 / trades.length),
                total_value: Math.floor(2_850_000 / trades.length),
                currency: 'MYR',
            })),
            total_packages: trades.length,
        }, `Split into ${trades.length} work packages (mock)`);
    },
    'procurement.generate_rfq': async (ctx) => {
        await delay(400);
        const packages = ctx.inputs['work_packages'] ?? [];
        const projectName = ctx.config['project_name'] ?? 'Mock Project';
        return success({
            rfq_id: `rfq-${Date.now()}`,
            project_name: projectName,
            rfq_count: packages.length || 1,
            rfqs: (packages.length ? packages : [{ id: 'wp-1', trade: 'General' }]).map((pkg, i) => ({
                rfq_number: `RFQ-${String(i + 1).padStart(3, '0')}`,
                trade: pkg['trade'] ?? 'General',
                file_path: `rfq/RFQ-${String(i + 1).padStart(3, '0')}.docx`,
                status: 'generated',
            })),
            generated_at: new Date().toISOString(),
        }, `Generated ${packages.length || 1} RFQ document(s) (mock)`);
    },
    'ai.classifier': async (ctx) => {
        await delay(500);
        const input = ctx.inputs['text'] ?? ctx.inputs['content'] ?? '(no input)';
        return success({
            classification: 'Civil Works',
            confidence: 0.91,
            alternatives: [
                { label: 'Structural Works', confidence: 0.06 },
                { label: 'M&E Works', confidence: 0.03 },
            ],
            model: 'mock-ai-classifier-v1',
            input_preview: String(input).substring(0, 80),
        }, 'Classified as "Civil Works" with 91% confidence (mock)');
    },
};
async function fallbackMockImpl(nodeType, ctx) {
    void ctx;
    await delay(50);
    return success({ executed: true, node_type: nodeType }, `[mock] ${nodeType} executed (no specific mock)`);
}
function getMockExecutor(nodeType) {
    const impl = mocks[nodeType];
    if (impl)
        return impl;
    return (ctx) => fallbackMockImpl(nodeType, ctx);
}
function hasMockFor(nodeType) {
    return nodeType in mocks;
}
//# sourceMappingURL=mock-registry.js.map