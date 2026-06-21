"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computePaginationMeta = computePaginationMeta;
function computePaginationMeta(query, total) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const totalPages = Math.ceil(total / pageSize);
    return {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
    };
}
//# sourceMappingURL=pagination.js.map