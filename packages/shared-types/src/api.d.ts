export interface ApiResponse<T> {
    success: boolean;
    data: T | null;
    error: ApiError | null;
    meta?: ResponseMeta;
}
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
export interface ResponseMeta {
    timestamp?: string;
    total?: number;
    page?: number;
    pageSize?: number;
    sprint?: string;
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
}
//# sourceMappingURL=api.d.ts.map