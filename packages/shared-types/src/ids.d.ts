declare const __brand: unique symbol;
type Brand<B> = {
    [__brand]: B;
};
type Branded<T, B> = T & Brand<B>;
export type OrganizationId = Branded<string, 'OrganizationId'>;
export type ProjectId = Branded<string, 'ProjectId'>;
export type WorkflowId = Branded<string, 'WorkflowId'>;
export type WorkflowVersionId = Branded<string, 'WorkflowVersionId'>;
export type NodeInstanceId = Branded<string, 'NodeInstanceId'>;
export type ExecutionId = Branded<string, 'ExecutionId'>;
export type UserId = Branded<string, 'UserId'>;
export type DocumentId = Branded<string, 'DocumentId'>;
export type PackId = Branded<string, 'PackId'>;
export type NodeTypeId = Branded<string, 'NodeTypeId'>;
export declare function asId<T extends Branded<string, unknown>>(raw: string): T;
export {};
//# sourceMappingURL=ids.d.ts.map