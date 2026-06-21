export interface PaginationQuery {
    page?: number;
    pageSize?: number;
}
export interface PaginationMeta {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}
export declare function computePaginationMeta(query: PaginationQuery, total: number): PaginationMeta;
//# sourceMappingURL=pagination.d.ts.map