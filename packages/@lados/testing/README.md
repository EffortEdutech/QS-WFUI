# @lados/testing

Test utilities for LADOS V4 node executors.

## Installation

This package is a workspace-internal dependency. Add it to any test suite:

```json
{
  "devDependencies": {
    "@lados/testing": "workspace:*"
  }
}
```

Then run `pnpm install` from the repo root (Windows PowerShell).

---

## `createMockNodeContext`

Creates a fully-typed `NodeContext` with sensible defaults.
All logger calls are captured for assertion.

```typescript
import { createMockNodeContext } from '@lados/testing';

const { ctx, logs, infoLogs, errorLogs } = createMockNodeContext({
  config: { apiKey: 'test-key' },
  inputs: { contractId: 'c-001' },
  projectId: 'proj-abc',
});

const result = await myNodeExecutor(ctx);

// Assert on execution result
expect(result.status).toBe('success');

// Assert on captured logs
expect(infoLogs().length).toBeGreaterThan(0);
expect(errorLogs()).toHaveLength(0);
expect(logs[0]?.message).toContain('Processing');
```

### Override any field

```typescript
const { ctx } = createMockNodeContext({
  nodeId:   'my-node-123',
  nodeType: 'contractor.send-email',
  upstream: {
    'prev-node': { contractId: 'c-999', status: 'approved' },
  },
  variables: { orgSlug: 'acme' },
});
```

### Log levels

- `logs` — all levels in order
- `infoLogs()` — filtered to `info`
- `warnLogs()` — filtered to `warn`
- `errorLogs()` — filtered to `error`
- `resetLogs()` — clears the buffer between test steps

---

## `MockEventPublisher`

Records `LadosEvent` objects emitted during test execution.
Implement the `EventPublisher` interface for any service that publishes events.

```typescript
import { createMockNodeContext, MockEventPublisher } from '@lados/testing';

const { ctx } = createMockNodeContext({ inputs: { jobId: 'j-001' } });
const publisher = new MockEventPublisher();

// Pass publisher into the service under test
await myService.processJob(ctx, publisher);

// Assert event was published
publisher.assertPublished('contractor.job.completed');

// Inspect the event payload
const event = publisher.firstOfType('contractor.job.completed');
expect(event?.payload['jobId']).toBe('j-001');

// Assert count
publisher.assertCount(1);

// Get all events of a type
const warnings = publisher.byType('contractor.job.warning');
expect(warnings.length).toBe(0);

// Reset between steps
publisher.reset();
```

### API reference

| Method / Property | Description |
|---|---|
| `published` | All events in order (`LadosEvent[]`) |
| `count` | Number of events published |
| `lastEvent()` | Last event or `undefined` |
| `byType(type)` | Events matching event type |
| `firstOfType(type)` | First matching event or `undefined` |
| `assertPublished(type)` | Throws if type not found |
| `assertNotPublished(type)` | Throws if type was found |
| `assertCount(n)` | Throws if count ≠ n |
| `reset()` | Clears all recorded events |
