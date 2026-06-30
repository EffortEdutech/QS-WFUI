/**
 * @lados/pack-sdk — Node resolver types
 *
 * Defines the standard function signatures that every pack must implement
 * to integrate with the LADOS execution engine.
 */

import type { NodeContext, NodeExecuteResult } from '@lados/node-sdk';

/**
 * A single node executor function.
 * Receives execution context, returns a result promise.
 */
export type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

/**
 * A resolver that maps a node type string to its executor, or null if the
 * node type is not handled by this pack.
 *
 * @example
 * const resolver: NodeResolverFn = (nodeType) => nodes[nodeType] ?? null;
 */
export type NodeResolverFn = (nodeType: string) => NodeExecutor | null;

/**
 * Factory that accepts injected services and returns a NodeResolverFn.
 * Every pack should export a `resolveNode(services)` function matching this type.
 *
 * @example
 * export const resolveNode: PackResolverFactory<MyPackServices> =
 *   (services) => (nodeType) => nodes[nodeType]?.(services) ?? null;
 */
export type PackResolverFactory<TServices = Record<string, unknown>> =
  (services: TServices) => NodeResolverFn;
