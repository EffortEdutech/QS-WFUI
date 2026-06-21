# 04 LCE Platform

**Layer 2 — Engine: "How does Lados work?"**

> This document covers the platform layer: Resource Engine, Security, REST API, Storage, and Deployment. Audience: platform engineers building or operating LCE.

---

## 1. Resource Engine

### 1.1 Purpose

The Resource Engine is the universal business object layer. Every domain entity — Customer, Job, Vehicle, Invoice, Contract — is a typed Resource instance stored in a shared resource layer with consistent CRUD, relationship, history, and lifecycle management.

Without the Resource Engine, nodes produce and consume raw JSON. With it, nodes create, update, and query first-class business objects that have types, states, relationships, and auditable histories.

**Current status:** Not yet built (Phase 3). Business objects are currently individual Supabase tables in separate NestJS modules.

### 1.2 Core Schema

```sql
CREATE TABLE lados_resources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  resource_type   text NOT NULL,         -- 'Vehicle', 'Invoice', 'Job', etc.
  resource_key    text,                  -- human-readable key, e.g. 'INV-2026-001'
  title           text,
  status          text DEFAULT 'active',
  state           text,                  -- current state machine state
  data            jsonb DEFAULT '{}',    -- typed payload per resource_type
  relationships   jsonb DEFAULT '[]',    -- links to other resources
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  archived_at     timestamptz
);

CREATE INDEX idx_lados_resources_org_type
  ON lados_resources (organisation_id, resource_type);

CREATE INDEX idx_lados_resources_state
  ON lados_resources (resource_type, state)
  WHERE archived_at IS NULL;
```

### 1.3 Resource Engine Service

```typescript
interface ResourceEngine {
  createResource(type: string, data: unknown, orgId: string, userId: string): Promise<Resource>
  updateResource(id: string, data: Partial<unknown>, userId: string): Promise<Resource>
  findResource(id: string, orgId: string): Promise<Resource>
  searchResources(type: string, filters: ResourceFilter, orgId: string): Promise<Resource[]>
  archiveResource(id: string, userId: string): Promise<void>
  relateResources(sourceId: string, targetId: string, relationshipType: string): Promise<void>
  getResourceHistory(id: string): Promise<ResourceHistoryEntry[]>
  transitionState(id: string, toState: string, userId: string): Promise<Resource>
}
```

Every mutation emits a typed event and writes to `audit_log`.

### 1.4 Foundation Nodes (Resource Operations)

| Node | Description |
|---|---|
| `resource.create` | Create a resource instance |
| `resource.update` | Update resource fields |
| `resource.find` | Find by ID or filter |
| `resource.search` | Search by type and filter |
| `resource.archive` | Archive a resource |
| `resource.relate` | Link two resources |
| `resource.change_state` | Transition state via State Engine |

### 1.5 Contractor Edition Resource Types

| Resource Type | Key Data Fields |
|---|---|
| Customer | name, contactPerson, phone, address, paymentTerms |
| Job | customerId, jobType, location, material, ratePerTrip, startTime, estimatedTrips |
| Trip | jobId, vehicleId, driverId, loadedAt, deliveredAt, tripCount |
| Driver | name, licenseNo, phone, vehicleId |
| Vehicle | plateNo, type, capacity, insuranceExpiry, roadTaxExpiry, lastService |
| Equipment | type, serialNo, model, operatorId, hourlyRate |
| Operator | name, phone, certifications |
| FuelReceipt | vehicleId, driverId, amount, litres, station, receiptDate, aiExtracted |
| MaintenanceRecord | vehicleId, serviceType, mileage, cost, serviceDate, nextDueDate |
| Invoice | jobId, customerId, lineItems, subtotal, total, issuedDate, dueDate |
| Payment | invoiceId, amount, paymentDate, paymentMethod, reference |
| Expense | category, amount, description, date, receiptFileId |
| PayrollRun | periodStart, periodEnd, employees, grossTotal, netTotal, status |
| Document | fileName, fileType, fileSize, storagePath, linkedResourceId |

---

## 2. Security

### 2.1 Current State

Authentication and organisation membership are fully implemented. Fine-grained permission enforcement is partially implemented (Phase 6 target).

### 2.2 Authentication Flow

```
Client → Supabase Auth (email/password or magic link) → JWT
Client → API request with Bearer JWT
       → SupabaseJwtGuard validates token
       → @CurrentUser() decorator injects user
       → Service layer asserts membership
```

The JWT is stateless. No session storage on the server.

### 2.3 Organisation Membership

Every protected action asserts that the requesting user is a member of the relevant organisation:

```typescript
private async assertMembership(orgId: string, userId: string, roles?: string[]) {
  const { data: member } = await this.supabase.admin
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!member) throw new NotFoundException('Access denied');
  if (roles && !roles.includes(member.role)) throw new ForbiddenException('Insufficient role');
}
```

### 2.4 Current Roles

| Role | Capabilities |
|---|---|
| owner | All operations including billing and user management |
| admin | All operations except billing and role management |
| member | Execute assigned tasks, upload documents, view resources |

### 2.5 Contractor Edition Target Roles (Phase 6)

| Role | Capabilities |
|---|---|
| Owner | Full access — jobs, fleet, finance, payroll, AI assistant |
| Admin | Operational management without billing |
| Member | General office tasks |
| Driver | View assigned jobs, record trip events |
| Operator | View assigned equipment jobs, record hours |

### 2.6 Permission Model (Phase 6)

```typescript
interface PermissionPolicy {
  action: string;                // 'invoice.approve', 'fleet.assign'
  requiredRole?: string[];       // any of these roles grants the action
  requiredState?: string[];      // resource must be in one of these states
  requiresApproval?: boolean;    // triggers an approval workflow
}
```

The `SecurityEngine` service evaluates policies before every node execution, state transition, and resource mutation.

### 2.7 Security Guardrails (Non-Negotiable)

- AI cannot approve, certify, or release payment
- AI cannot create final commercial facts without human acceptance
- Workflow execution requires a published version
- Every resource mutation records actor and timestamp
- Organisation data is always scoped by `organisation_id`

---

## 3. REST API

### 3.1 Base URL

```
http://localhost:4000/api/v1    (development)
https://api.lados.io/api/v1     (production — future)
```

### 3.2 Authentication

```
Authorization: Bearer <supabase_access_token>
```

### 3.3 Response Envelope

```json
{ "success": true,  "data": { ... }, "error": null }
{ "success": false, "data": null, "error": "Human-readable message" }
```

### 3.4 Endpoints

**Organisations**

| Method | Path | Description |
|---|---|---|
| GET | `/organizations` | List user's orgs |
| POST | `/organizations` | Create org |
| GET | `/organizations/:id` | Get org |
| GET | `/organizations/:id/members` | List members |
| POST | `/organizations/:id/members` | Invite member |

**Projects**

| Method | Path | Description |
|---|---|---|
| GET | `/projects` | List all projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project |
| PATCH | `/projects/:id` | Update project |

**Workflows**

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:pId/workflows` | List workflows |
| POST | `/projects/:pId/workflows` | Create workflow |
| GET | `/projects/:pId/workflows/:id` | Get workflow |
| PATCH | `/projects/:pId/workflows/:id` | Update metadata |
| PUT | `/projects/:pId/workflows/:id/definition` | Canvas auto-save |
| POST | `/projects/:pId/workflows/:id/publish` | Publish version |
| GET | `/projects/:pId/workflows/:id/export` | Export bundle |
| POST | `/projects/:pId/workflows/import` | Import bundle |
| POST | `/projects/:pId/workflows/:id/versions` | Snapshot version |
| GET | `/projects/:pId/workflows/:id/versions` | List versions |
| POST | `/projects/:pId/workflows/:id/versions/:vId/restore` | Restore version |
| DELETE | `/projects/:pId/workflows/:id` | Delete workflow |

**Execution**

| Method | Path | Description |
|---|---|---|
| POST | `/workflows/:id/trigger` | Trigger run (returns runId immediately) |
| GET | `/runs/:runId` | Poll run status |
| GET | `/runs/:runId/logs` | Get per-node logs |
| GET | `/workflows/:id/runs` | List runs for workflow |

**Approvals (Phase 1)**

| Method | Path | Description |
|---|---|---|
| GET | `/approvals` | List pending tasks for current user |
| GET | `/approvals/run/:runId` | List tasks for a run |
| GET | `/approvals/:taskId` | Get single task |
| POST | `/approvals/:taskId/decide` | Approve or reject — body: `{ decision, comments? }` |

**Nodes & Packs**

| Method | Path | Description |
|---|---|---|
| GET | `/nodes` | List registered nodes |
| GET | `/nodes/:type` | Get node manifest |
| GET | `/packs` | List installed packs |
| GET | `/packs/:id` | Get pack detail |

**Files**

| Method | Path | Description |
|---|---|---|
| POST | `/files/upload` | Upload file to Supabase Storage |
| GET | `/files/:id` | Get file metadata + signed URL |

**Suppliers / RFQ / Quotations**

| Method | Path | Description |
|---|---|---|
| GET/POST | `/suppliers` | List / create supplier |
| GET/PATCH/DELETE | `/suppliers/:id` | Manage supplier |
| POST | `/rfq-distributions` | Distribute RFQ |
| GET | `/projects/:id/quotations` | List quotations |

### 3.5 Error Codes

| HTTP | Meaning |
|---|---|
| 400 | Validation failed or business rule violation |
| 401 | Missing or invalid JWT |
| 403 | Not authorised (membership check failed) |
| 404 | Resource not found |
| 409 | Conflict (duplicate key, invalid state) |
| 500 | Internal server error |

---

## 4. Storage

### 4.1 Supabase Storage Buckets

| Bucket | Contents |
|---|---|
| `documents` | User-uploaded documents (PDF, Excel, Word) |
| `rfq-packages` | Generated RFQ ZIP archives |
| `receipts` | Fuel receipt and expense images |
| `exports` | Workflow export bundles |

### 4.2 FileService

```typescript
interface FileService {
  uploadFile(file: Express.Multer.File, orgId: string, userId: string): Promise<FileRecord>
  getSignedUrl(fileId: string, expiresIn?: number): Promise<string>
  deleteFile(fileId: string): Promise<void>
}
```

Files are stored at `{bucket}/{orgId}/{uuid}.{ext}`. Metadata persists to a `files` table.

Signed URL default expiry: **2 hours**. No public bucket access.

### 4.3 Document Library

`LibraryService` provides per-project document management: list by project, add reference, remove reference (does not delete the file), and get file with signed URL.

### 4.4 Storage Guardrails

- All URLs are signed — no public bucket access
- Files are scoped to `orgId` — cross-tenant access is blocked
- AI-extracted content is stored in the database, not re-read from Storage per request
- Receipt images remain accessible until the expense is reconciled and archived

---

## 5. Deployment

### 5.1 Development Setup

```bash
# Prerequisites: Node.js 20+, pnpm 9+, Supabase CLI

pnpm install          # install all workspace dependencies
supabase start        # start local Supabase stack
supabase db push      # apply all migrations
pnpm dev              # start API (4000) + web (3000) concurrently
```

### 5.2 Environment Variables

`apps/api/.env.local`:
```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
OPENAI_API_KEY=<openai_key>
NODE_ENV=development
```

`apps/web/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

### 5.3 Database Migrations

```bash
# Apply all pending migrations
supabase db push

# Regenerate TypeScript types from schema
supabase gen types typescript --local > packages/shared-types/src/supabase.ts
```

Migration naming: `NNNN_description.sql` — sequential, applied in order.

### 5.4 Production Build

```bash
# Build packages first (dist/ must be up to date)
pnpm turbo build --filter='./packages/*' --filter='./packs/*'

# Build apps
pnpm turbo build --filter='./apps/*'
```

### 5.5 Phase 1 Migration (0026)

Apply before running the Phase 1 API:

```sql
-- Pause/resume checkpoint fields
ALTER TABLE execution_runs
  ADD COLUMN IF NOT EXISTS paused_at_node_id  text,
  ADD COLUMN IF NOT EXISTS checkpoint_outputs jsonb DEFAULT '{}';

-- Workflow publish tracking
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS published_version_id uuid REFERENCES workflow_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at          timestamptz,
  ADD COLUMN IF NOT EXISTS published_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Fast pending approval lookups
CREATE INDEX IF NOT EXISTS idx_approval_tasks_run_status
  ON approval_tasks (execution_id, status) WHERE status = 'pending';
```

### 5.6 Production Considerations

- Service role key must never be exposed to the browser
- Supabase RLS is defence-in-depth, not the primary enforcement layer
- Fire-and-forget async execution (Phase 1) is MVP — replace with job queue before production traffic (Phase 12)
- Workflow runs that modify financial records must be idempotent — runner must be safe to replay after process crash

---

*Previous: [03 LCE SDK](03_LCE_SDK.md) · Next: [05 LCE Intelligence](05_LCE_Intelligence.md)*
