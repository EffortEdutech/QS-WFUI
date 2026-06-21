import type { RunnerOptions, ExecutionResult } from './types';
export declare class WorkflowRunner {
    private options;
    private aborted;
    constructor(options: RunnerOptions);
    abort(): void;
    run(): Promise<ExecutionResult>;
    private _resolveInputs;
}
export declare function runWorkflow(options: RunnerOptions): Promise<ExecutionResult>;
//# sourceMappingURL=runner.d.ts.map