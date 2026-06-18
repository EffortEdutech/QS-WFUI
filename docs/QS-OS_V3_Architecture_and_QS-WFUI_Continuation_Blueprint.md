# QS-OS Version 3 Architecture & QS-WFUI Continuation Blueprint

**Document status:** Working master blueprint  
**Architecture version:** Version 3  
**Prepared for:** EffortEdutech / QS-OS  
**Reference repo:** `https://github.com/EffortEdutech/QS-WFUI`  
**Current canonical demo:** BOQ-to-RFQ Workflow Builder  
**Important note:** This document maps the Version 3 architecture into the `QS-WFUI` graphic UI direction. The repository contents were not directly inspected in this session, so this blueprint avoids claiming existing file names or implementation details unless they were already part of prior QS-OS documentation.

---

## 1. Executive Summary

QS-OS has transformed from a simple workflow builder into a **Business Capability Platform**.

The first idea was:

```text
Workflow
  └── Nodes
```

The second idea was:

```text
Workflow
  └── Nodes
        └── Packs
```

The current Version 3 architecture is:

```text
Project
  └── Workflow
        └── Skills / Nodes
              ├── Capability Packs
              ├── Data Packs
              └── Core Services
```

This means QS-OS is no longer only a visual automation canvas. It is becoming an operating system for reusable business capabilities, where users build workflows using domain-aware skills rather than low-level technical nodes.

The first public demo remains:

```text
BOQ Upload
  ↓
Read / Clean BOQ
  ↓
AI Classify Trade
  ↓
Split Work Packages
  ↓
Generate RFQ
  ↓
Manager Approval
  ↓
Save / Export RFQ Documents
```

This demo should now be implemented as a Version 3 workflow using Skills from multiple Packs.

---

## 2. Core Product Definition

QS-OS is an **AI Business Capability Platform**.

Instead of connecting technical services with generic workflow nodes, QS-OS provides AI-powered business skills that encapsulate domain expertise, policies, validation rules, prompts, calculations, and best practices into reusable workflow components.

It enables non-developers to build intelligent business processes using concepts they already understand, while allowing developers to extend the platform with custom skills, packs, services, and data providers.

---

## 3. Version 3 Mental Model

### 3.1 Main hierarchy

```text
QS-OS Platform
│
├── Projects
│   └── Workflows
│       └── Skills / Nodes
│
├── Capability Packs
│   └── Skills / Nodes
│
├── Data Packs
│   └── Business Data / Market Data / Reference Data
│
├── Core Services
│   └── AI, OCR, Storage, Search, Auth, Audit, Execution, Notifications
│
├── Marketplace
│   ├── Capability Marketplace
│   └── Data Marketplace
│
└── Developer SDK
    ├── Skill SDK
    ├── Pack SDK
    └── Data Pack SDK
```

### 3.2 Key rule

A workflow does **not** contain packs directly.

A workflow contains skills/nodes.

Those skills/nodes are provided by packs.

A skill/node may call services and may consume data packs.

```text
Project
  ↓
Workflow
  ↓
Skill / Node
  ↑
Provided by Capability Pack
  ↓
Uses Core Services
  ↓
Reads Data Packs
```

---

## 4. Terminology Decision

The UI may still use the technical term **Node**, especially for developer familiarity and ComfyUI-style design.

However, the business concept should be **Skill**.

Recommended terminology:

| Concept | Developer Term | Business/User Term |
|---|---|---|
| Workflow block | Node | Skill |
| Node collection | Package | Capability Pack |
| Live or reference dataset | Dataset / Connector | Data Pack |
| Technical infrastructure | Service | Core Service |
| Workflow execution | Run | Execution |
| Workflow output | Artifact | Document / Result |

Recommended UI label:

```text
Skill Library
```

Instead of:

```text
Node Library
```

Internally, both may exist:

```ts
type SkillNode = {
  id: string;
  name: string;
  packId: string;
  category: string;
  inputs: SkillInput[];
  outputs: SkillOutput[];
  configSchema: object;
  runtime: RuntimeDefinition;
};
```

---

## 5. Project Layer

A **Project** is the business container.

For construction, a project may represent:

```text
Mini Stadium Gemas
Sunway Office Tower
Road Upgrade Package A
Hospital Development Phase 1
```

A project contains:

```text
Project
│
├── Project Info
├── Contracts
├── BOQ
├── Drawings
├── Documents
├── Suppliers
├── Team Members
├── Workflows
├── Executions
├── Approvals
├── Audit Logs
└── Generated Artifacts
```

In QS-WFUI, the project shell should become the top-level user environment.

Recommended UI:

```text
Top Bar:
Project Selector | Workflow Selector | Save | Run | Publish | Settings

Left Sidebar:
Project Modules

Main Area:
Workflow Canvas / Project Module Screen

Right Sidebar:
Properties / Inspector / AI Assistant

Bottom Drawer:
Execution Logs / Data Preview / Audit Trail
```

---

## 6. Workflow Layer

A **Workflow** is an orchestration of skills.

A workflow represents a business process.

Examples:

```text
Quantity Takeoff Workflow
Cost Estimation Workflow
BOQ-to-RFQ Workflow
Tender Evaluation Workflow
Progress Claim Workflow
Payment Certificate Workflow
Contract Review Workflow
Final Account Workflow
```

### 6.1 First public workflow

The first public demo should remain:

```text
BOQ-to-RFQ Workflow Builder
```

Version 3 representation:

```text
BOQ-to-RFQ Workflow
│
├── Upload BOQ
├── Read BOQ
├── Clean BOQ
├── AI Classify Trade
├── Split Work Packages
├── Match Suppliers
├── Generate RFQ
├── Approval Gate
├── Export RFQ
└── Save Artifacts
```

### 6.2 Which packs are used?

```text
Upload BOQ           ← Document Pack
Read BOQ             ← Document Pack
Clean BOQ            ← Document Pack / AI Pack
AI Classify Trade    ← AI Pack / Construction Pack
Split Work Packages  ← Procurement Pack
Match Suppliers      ← Supplier Data Pack + Procurement Pack
Generate RFQ         ← Procurement Pack + Document Pack
Approval Gate        ← Workflow Pack
Export RFQ           ← Reporting Pack / Document Pack
Save Artifacts       ← Storage Service
```

This is the main Version 3 breakthrough: one workflow uses multiple packs.

---

## 7. Skill / Node Layer

A **Skill** is the smallest reusable business capability in QS-OS.

Examples:

```text
Read BOQ
Detect Walls
Calculate Area
Estimate Concrete
Generate RFQ
Compare Quotes
Review Claim
Generate Payment Certificate
```

### 7.1 Skill anatomy

Every skill should have:

```text
Skill
│
├── Identity
│   ├── id
│   ├── name
│   ├── version
│   ├── packId
│   └── category
│
├── UI Definition
│   ├── icon
│   ├── color group
│   ├── form fields
│   ├── preview panel
│   └── help text
│
├── Input Ports
│
├── Output Ports
│
├── Configuration Schema
│
├── Runtime Handler
│
├── Validation Rules
│
├── Permissions
│
├── Audit Events
│
└── Test Fixtures
```

### 7.2 Example skill: Generate RFQ

```json
{
  "id": "procurement.generate-rfq",
  "name": "Generate RFQ",
  "packId": "procurement-pack",
  "version": "1.0.0",
  "category": "Procurement",
  "inputs": [
    { "name": "workPackage", "type": "work_package" },
    { "name": "supplierList", "type": "supplier[]" },
    { "name": "template", "type": "document_template" }
  ],
  "outputs": [
    { "name": "rfqDocument", "type": "document" },
    { "name": "rfqSummary", "type": "json" }
  ],
  "requiresApproval": false,
  "usesServices": ["document-service", "storage-service", "audit-service"],
  "usesDataPacks": ["supplier-pack"]
}
```

### 7.3 Example skill: Approval Gate

```json
{
  "id": "workflow.approval-gate",
  "name": "Approval Gate",
  "packId": "workflow-pack",
  "version": "1.0.0",
  "category": "Control",
  "inputs": [
    { "name": "itemForApproval", "type": "any" }
  ],
  "outputs": [
    { "name": "approvedItem", "type": "any" },
    { "name": "approvalDecision", "type": "approval_record" }
  ],
  "runtimeMode": "pause_until_human_decision",
  "usesServices": ["auth-service", "notification-service", "audit-service"]
}
```

---

## 8. Capability Packs

A **Capability Pack** is an installable collection of related business skills.

Capability Packs answer:

```text
What can QS-OS do?
```

Examples:

```text
Geometry Pack
Document Pack
AI Pack
Estimation Pack
Procurement Pack
Contract Pack
Finance Pack
Reporting Pack
Communication Pack
Workflow Pack
```

### 8.1 Pack structure

Recommended manifest:

```json
{
  "id": "procurement-pack",
  "name": "Procurement Pack",
  "version": "1.0.0",
  "description": "RFQ, supplier comparison, quotation evaluation, purchase order, and procurement approval skills.",
  "publisher": "EffortEdutech",
  "skills": [
    "procurement.generate-rfq",
    "procurement.compare-quotes",
    "procurement.rank-suppliers",
    "procurement.create-purchase-order"
  ],
  "dependencies": [
    "document-pack",
    "workflow-pack"
  ],
  "optionalDataPacks": [
    "supplier-pack",
    "price-intelligence-pack"
  ],
  "permissions": [
    "documents.write",
    "suppliers.read",
    "approvals.create"
  ]
}
```

### 8.2 Geometry Pack

```text
Geometry Pack
│
├── PDF Reader
├── CAD Reader
├── BIM Reader
├── Detect Scale
├── Detect Walls
├── Detect Doors
├── Detect Windows
├── Detect Columns
├── Detect Beams
├── Detect Slabs
├── Detect Rooms
├── Measure Length
├── Measure Area
├── Measure Volume
├── Polygon Calculator
├── Room Area Calculator
├── Roof Area Calculator
├── Earthwork Calculator
├── Quantity Validator
├── BOQ Mapper
└── AI Drawing Reviewer
```

### 8.3 Document Pack

```text
Document Pack
│
├── Upload Document
├── Read PDF
├── Read Excel
├── Read Word
├── OCR Document
├── Extract Tables
├── Clean Table
├── Convert to JSON
├── Generate Document
├── Export PDF
├── Export Excel
└── Save Document
```

### 8.4 Procurement Pack

```text
Procurement Pack
│
├── Create Work Package
├── Generate RFQ
├── Send RFQ
├── Receive Quotation
├── Compare Quotations
├── Technical Evaluation
├── Commercial Evaluation
├── Supplier Ranking
├── Award Recommendation
├── Purchase Requisition
├── Purchase Order
└── Procurement Approval
```

### 8.5 Estimation Pack

```text
Estimation Pack
│
├── BOQ Generator
├── Concrete Estimator
├── Reinforcement Estimator
├── Brickwork Estimator
├── Plaster Quantity
├── Painting Quantity
├── Ceiling Quantity
├── Tile Quantity
├── Roofing Quantity
├── Roadwork Estimator
├── Earthwork Estimator
└── Apply Preliminaries / Margin
```

### 8.6 Contract Pack

```text
Contract Pack
│
├── Contract Clause Extractor
├── Contract Review
├── Variation Order Evaluation
├── EOT Analysis
├── Progress Claim Review
├── Payment Certificate
├── Retention Calculation
├── Liquidated Damages Review
└── Final Account
```

---

## 9. Data Packs

A **Data Pack** provides trusted business data.

Data Packs answer:

```text
What does QS-OS know?
```

Data Packs do not primarily execute workflows. They provide datasets, catalogues, reference rules, market prices, supplier records, standards, indexes, and knowledge bases.

Examples:

```text
Price Intelligence Pack
Supplier Pack
Material Catalogue Pack
Labour Rate Pack
Equipment Rental Pack
Construction Cost Index Pack
SMM Standards Pack
Building Code Pack
Contract Template Pack
Product Catalogue Pack
```

### 9.1 Price Intelligence Pack

```text
Price Intelligence Pack
│
├── Cement Prices
├── Steel Prices
├── Sand Prices
├── Aggregate Prices
├── Timber Prices
├── Paint Prices
├── Tile Prices
├── Plumbing Prices
├── Electrical Prices
├── Labour Rates
├── Equipment Rates
├── Price History
├── Price Confidence
└── Regional Adjustment
```

### 9.2 Supplier subscription model

The Price Pack becomes the beginning of a two-sided marketplace.

```text
Supplier subscribes
  ↓
Supplier maintains catalogue and prices
  ↓
QS-OS validates / scores / timestamps data
  ↓
Contractors and QS users access live market prices
  ↓
RFQ and estimation workflows use supplier data
```

Supplier profile:

```text
Supplier
│
├── Company Profile
├── Contact Persons
├── Product Catalogue
├── Price List
├── Stock Availability
├── Lead Time
├── Delivery Areas
├── Certifications
├── Payment Terms
├── Ratings
└── Past Performance
```

### 9.3 Example price record

```json
{
  "id": "price.steel-y12.supplier-abc.2026-06-18",
  "materialCode": "STEEL-Y12",
  "materialName": "High Yield Steel Bar Y12",
  "supplierId": "supplier-abc",
  "unit": "tonne",
  "price": 3420.00,
  "currency": "MYR",
  "region": "Selangor",
  "availableQuantity": 250,
  "leadTimeDays": 3,
  "validFrom": "2026-06-18",
  "validTo": "2026-06-30",
  "source": "supplier_submitted",
  "verificationStatus": "pending"
}
```

---

## 10. Core Services

Core Services provide platform infrastructure.

They are not usually visible to business users.

```text
Core Services
│
├── Execution Service
├── AI Service
├── OCR Service
├── Geometry Service
├── Document Service
├── Storage Service
├── Search Service
├── Authentication Service
├── Authorization Service
├── Notification Service
├── Audit Service
├── Memory Service
├── Embedding Service
├── Billing Service
└── Marketplace Service
```

### 10.1 Service usage example

```text
Read BOQ Skill
│
├── Document Service
├── OCR Service
├── AI Service
├── Storage Service
└── Audit Service
```

### 10.2 Why services matter

Skills should not directly implement platform infrastructure.

For example, a BOQ-reading skill should not directly manage authentication, storage, logging, OCR engines, or billing. It should call the relevant service.

This keeps skills reusable, testable, and easier for third-party developers to build.

---

## 11. QS-WFUI Product Mapping

The `QS-WFUI` repository should become the **graphic workflow interface** for QS-OS.

Its primary role:

```text
Visual builder for Project-based AI business workflows.
```

Recommended interface model:

```text
QS-WFUI
│
├── Project Shell
├── Workflow Canvas
├── Skill Library
├── Pack Manager
├── Data Pack Browser
├── Skill Inspector
├── Execution Console
├── Approval Inbox
├── Artifact Viewer
└── Marketplace Preview
```

### 11.1 Main screen layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Top Bar: Project | Workflow | Save | Run | Publish | User     │
├───────────────┬───────────────────────────────┬──────────────┤
│ Left Panel    │ Canvas                        │ Right Panel  │
│               │                               │              │
│ Skill Library │ Workflow Nodes / Connections  │ Inspector    │
│ Packs         │                               │ Config       │
│ Data Packs    │                               │ Validation   │
│ Templates     │                               │ Help         │
├───────────────┴───────────────────────────────┴──────────────┤
│ Bottom Drawer: Execution Logs | Data Preview | Audit | Output │
└──────────────────────────────────────────────────────────────┘
```

### 11.2 Left panel

```text
Left Panel
│
├── Search Skills
├── Capability Packs
│   ├── Document
│   ├── AI
│   ├── Procurement
│   ├── Reporting
│   └── Workflow
│
├── Data Packs
│   ├── Supplier Pack
│   ├── Price Pack
│   └── Material Catalogue Pack
│
└── Workflow Templates
    ├── BOQ-to-RFQ
    ├── Progress Claim
    └── Tender Comparison
```

### 11.3 Canvas

Canvas responsibilities:

```text
Canvas
│
├── Add Skill
├── Move Skill
├── Connect Skill Ports
├── Validate Connections
├── Show Data Flow
├── Show Errors
├── Show Approval Pauses
├── Show Execution Status
└── Save Workflow JSON
```

### 11.4 Right inspector

```text
Skill Inspector
│
├── Skill Name
├── Pack Name
├── Version
├── Description
├── Inputs
├── Outputs
├── Configuration Form
├── Validation Status
├── Required Permissions
├── Data Pack Dependencies
└── Test Run
```

### 11.5 Bottom drawer

```text
Bottom Drawer
│
├── Execution Logs
├── Node Output Preview
├── Document Artifacts
├── Data Preview
├── Approval Records
└── Audit Trail
```

---

## 12. Recommended Workflow JSON

Workflow JSON should become the portable representation of a QS-OS workflow.

```json
{
  "id": "workflow.boq-to-rfq.demo",
  "name": "BOQ-to-RFQ Demo Workflow",
  "version": "1.0.0",
  "projectId": "project.demo",
  "nodes": [
    {
      "id": "node-upload-boq",
      "skillId": "document.upload-file",
      "packId": "document-pack",
      "position": { "x": 100, "y": 100 },
      "config": {
        "acceptedFileTypes": [".xlsx", ".csv", ".pdf"]
      }
    },
    {
      "id": "node-read-boq",
      "skillId": "document.read-boq",
      "packId": "document-pack",
      "position": { "x": 360, "y": 100 },
      "config": {}
    },
    {
      "id": "node-classify-trade",
      "skillId": "ai.classify-boq-trade",
      "packId": "ai-pack",
      "position": { "x": 620, "y": 100 },
      "config": {
        "classificationStandard": "construction-trades"
      }
    },
    {
      "id": "node-generate-rfq",
      "skillId": "procurement.generate-rfq",
      "packId": "procurement-pack",
      "position": { "x": 880, "y": 100 },
      "config": {
        "templateId": "rfq-template-basic"
      }
    },
    {
      "id": "node-approval",
      "skillId": "workflow.approval-gate",
      "packId": "workflow-pack",
      "position": { "x": 1140, "y": 100 },
      "config": {
        "approverRole": "manager"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-upload-boq",
      "sourceHandle": "file",
      "target": "node-read-boq",
      "targetHandle": "file"
    },
    {
      "id": "edge-2",
      "source": "node-read-boq",
      "sourceHandle": "boqItems",
      "target": "node-classify-trade",
      "targetHandle": "items"
    },
    {
      "id": "edge-3",
      "source": "node-classify-trade",
      "sourceHandle": "classifiedItems",
      "target": "node-generate-rfq",
      "targetHandle": "workPackageItems"
    },
    {
      "id": "edge-4",
      "source": "node-generate-rfq",
      "sourceHandle": "rfqDocument",
      "target": "node-approval",
      "targetHandle": "itemForApproval"
    }
  ],
  "requiredPacks": [
    "document-pack@1.0.0",
    "ai-pack@1.0.0",
    "procurement-pack@1.0.0",
    "workflow-pack@1.0.0"
  ],
  "optionalDataPacks": [
    "supplier-pack@1.0.0",
    "price-intelligence-pack@1.0.0"
  ]
}
```

---

## 13. UI Component Structure Recommendation

For QS-WFUI, use this conceptual component structure.

```text
src/
│
├── app/
│   ├── AppShell
│   ├── ProjectShell
│   └── Routing
│
├── features/
│   ├── workflow-canvas/
│   │   ├── Canvas
│   │   ├── SkillNodeView
│   │   ├── EdgeView
│   │   ├── CanvasToolbar
│   │   └── CanvasValidation
│   │
│   ├── skill-library/
│   │   ├── SkillSearch
│   │   ├── SkillCategoryList
│   │   ├── PackSkillList
│   │   └── SkillCard
│   │
│   ├── inspector/
│   │   ├── SkillInspector
│   │   ├── ConfigForm
│   │   ├── InputOutputPanel
│   │   └── DependencyPanel
│   │
│   ├── packs/
│   │   ├── CapabilityPackBrowser
│   │   ├── PackDetail
│   │   └── PackInstallStatus
│   │
│   ├── data-packs/
│   │   ├── DataPackBrowser
│   │   ├── SupplierDirectory
│   │   ├── PriceCatalogue
│   │   └── MaterialCatalogue
│   │
│   ├── executions/
│   │   ├── ExecutionConsole
│   │   ├── ExecutionTimeline
│   │   ├── NodeOutputPreview
│   │   └── ArtifactViewer
│   │
│   └── approvals/
│       ├── ApprovalInbox
│       ├── ApprovalGateView
│       └── ApprovalDecisionForm
│
├── domain/
│   ├── project.types
│   ├── workflow.types
│   ├── skill.types
│   ├── pack.types
│   ├── datapack.types
│   └── execution.types
│
├── data/
│   ├── seedPacks
│   ├── seedSkills
│   ├── seedDataPacks
│   └── demoWorkflows
│
└── services/
    ├── workflowStore
    ├── packRegistry
    ├── skillRegistry
    ├── executionMockService
    └── artifactService
```

This is not mandatory, but it is a clean target structure for turning the graphic UI into a Version 3 product.

---

## 14. MVP Scope for QS-WFUI

### 14.1 Do first

```text
1. Project shell
2. Workflow canvas
3. Skill library
4. Pack-based skill grouping
5. Skill inspector
6. Workflow JSON save/load
7. BOQ-to-RFQ demo workflow template
8. Mock execution engine
9. Approval gate visual state
10. Execution log panel
```

### 14.2 Do not overbuild yet

Avoid building full AI, real supplier marketplace, real payment, real CAD/BIM geometry, or full permission complexity in the first UI milestone.

The first milestone should prove:

```text
Users understand how to build business workflows using skills from packs.
```

---

## 15. BOQ-to-RFQ Demo: Required Seed Packs and Skills

### 15.1 Document Pack

```text
Document Pack
│
├── Upload BOQ
├── Read Excel BOQ
├── Read PDF BOQ
├── Clean BOQ Table
└── Export RFQ Document
```

### 15.2 AI Pack

```text
AI Pack
│
├── Classify BOQ Trade
├── Summarize Work Package
├── Detect Missing BOQ Data
└── Suggest Supplier Category
```

### 15.3 Procurement Pack

```text
Procurement Pack
│
├── Create Work Package
├── Match Supplier Category
├── Generate RFQ
├── Compare Supplier Quotes
└── Award Recommendation
```

### 15.4 Workflow Pack

```text
Workflow Pack
│
├── Start
├── Approval Gate
├── Condition
├── Manual Review
└── End
```

### 15.5 Reporting Pack

```text
Reporting Pack
│
├── Generate Summary
├── Generate PDF
├── Generate Excel
└── Save Report
```

### 15.6 Supplier Data Pack

```text
Supplier Data Pack
│
├── Supplier Directory
├── Supplier Category
├── Supplier Contact
├── Delivery Region
└── Supplier Rating
```

### 15.7 Price Intelligence Data Pack

```text
Price Intelligence Pack
│
├── Material Price
├── Labour Rate
├── Equipment Rate
├── Price Validity
└── Historical Price
```

---

## 16. Recommended UI Labels

Use business-first language.

```text
Skill Library
Capability Packs
Data Packs
Workflow Canvas
Project Workspace
Run Workflow
Execution Log
Approval Required
Generated Documents
Business Data
```

Avoid exposing overly technical language in the main UI:

```text
HTTP request
Webhook
JSON parser
LLM prompt
Vector embedding
Database query
```

These can exist in developer mode, but should not dominate the business user experience.

---

## 17. Public Demo Storyboard

### Scene 1: Open Project

User opens:

```text
Demo Project: Office Renovation Package
```

### Scene 2: Open Workflow Builder

User selects:

```text
BOQ-to-RFQ Workflow
```

### Scene 3: Build Workflow

User drags:

```text
Upload BOQ → Read BOQ → AI Classify Trade → Generate RFQ → Approval Gate → Export RFQ
```

### Scene 4: Configure Skills

User selects `Generate RFQ` and configures:

```text
RFQ Template: Basic Supplier RFQ
Supplier Category: From AI Classification
Output Format: PDF + Excel
```

### Scene 5: Run Workflow

System shows:

```text
Uploading BOQ...
Reading BOQ...
Classifying trades...
Creating work packages...
Generating RFQ...
Waiting for approval...
```

### Scene 6: Approval

Manager approves generated RFQ.

### Scene 7: Output

System generates:

```text
RFQ Package - Electrical Works.pdf
RFQ Package - Plumbing Works.pdf
RFQ Summary.xlsx
Execution Audit Log
```

This demo communicates the full value of Version 3 without needing to build the entire construction ecosystem yet.

---

## 18. Data Pack Marketplace Vision

The Price Pack idea should evolve into a Data Marketplace.

```text
Data Marketplace
│
├── Supplier Pack
├── Price Intelligence Pack
├── Material Catalogue Pack
├── Labour Rate Pack
├── Equipment Rental Pack
├── Building Code Pack
├── SMM Rules Pack
├── Contract Template Pack
└── Cost Index Pack
```

### 18.1 Supplier-side business model

Suppliers subscribe to QS-OS to:

```text
Maintain company profile
Publish product catalogue
Publish current prices
Receive RFQs
Respond to quotations
Build ratings and trust
Access buyer demand signals
```

### 18.2 Buyer-side value

Contractors, QS teams, and developers use QS-OS to:

```text
Access current market prices
Find suppliers
Send RFQs
Compare quotations
Generate estimates
Track price history
Reduce procurement admin
```

### 18.3 Network effect

More suppliers improve price coverage.

More buyers increase RFQ opportunities.

More transactions improve data intelligence.

This moves QS-OS beyond software into a construction intelligence ecosystem.

---

## 19. Version 3 Architecture Diagram

```text
QS-OS Platform
│
├── Core Runtime
│   ├── Workflow Execution Engine
│   ├── Skill Runtime
│   ├── Pack Registry
│   ├── Data Pack Registry
│   ├── Permission Engine
│   └── Audit Engine
│
├── Core Services
│   ├── AI Service
│   ├── OCR Service
│   ├── Document Service
│   ├── Geometry Service
│   ├── Storage Service
│   ├── Search Service
│   ├── Notification Service
│   └── Billing Service
│
├── Capability Marketplace
│   ├── Document Pack
│   ├── AI Pack
│   ├── Geometry Pack
│   ├── Estimation Pack
│   ├── Procurement Pack
│   ├── Contract Pack
│   ├── Finance Pack
│   └── Reporting Pack
│
├── Data Marketplace
│   ├── Price Intelligence Pack
│   ├── Supplier Pack
│   ├── Material Catalogue Pack
│   ├── Labour Rate Pack
│   ├── Equipment Rental Pack
│   ├── SMM Standards Pack
│   └── Cost Index Pack
│
├── Workflow Designer
│   ├── Skill Library
│   ├── Canvas
│   ├── Inspector
│   ├── Execution Console
│   └── Artifact Viewer
│
└── Project Workspace
    ├── Project Data
    ├── Workflows
    ├── Documents
    ├── Approvals
    ├── Executions
    └── Audit Logs
```

---

## 20. Immediate Development Tasks for QS-WFUI

### Task 1: Rename concept layer

Keep the code flexible, but make the UI business-facing.

```text
Node → Skill
Node Library → Skill Library
Node Pack → Capability Pack
Data Source → Data Pack
```

### Task 2: Create seed registries

Create mock registry data for:

```text
Capability Packs
Skills
Data Packs
Workflow Templates
Demo Projects
```

### Task 3: Build pack-based skill library

The left panel should show skills grouped by pack.

```text
Document Pack
  Upload BOQ
  Read BOQ

AI Pack
  Classify BOQ Trade

Procurement Pack
  Generate RFQ
```

### Task 4: Implement Skill Inspector

When a user clicks a skill/node, the right panel should show:

```text
Skill name
Pack
Description
Inputs
Outputs
Config fields
Data dependencies
Validation status
```

### Task 5: Implement Workflow JSON export

Every visual workflow must be exportable as JSON.

This becomes the contract between:

```text
QS-WFUI frontend
QS-OS backend
Execution engine
Developer SDK
Marketplace
```

### Task 6: Add mock execution

For MVP UI, execution can be simulated.

```text
Pending → Running → Success → Waiting Approval → Approved → Completed
```

### Task 7: Build BOQ-to-RFQ template

Create one preloaded workflow template:

```text
Upload BOQ → Read BOQ → AI Classify Trade → Create Work Package → Generate RFQ → Approval Gate → Export RFQ
```

### Task 8: Add Data Pack preview

Add a simple screen for:

```text
Supplier Pack
Price Intelligence Pack
Material Catalogue Pack
```

This prepares the UI for the future marketplace.

---

## 21. MVP Acceptance Criteria

The UI milestone is successful when a user can:

```text
1. Open a project.
2. Open the BOQ-to-RFQ workflow.
3. See a canvas with business skills.
4. Browse skills by Capability Pack.
5. Add skills to the canvas.
6. Connect skills.
7. Configure a selected skill.
8. Save/export the workflow as JSON.
9. Run a mock execution.
10. See execution logs.
11. See an approval pause.
12. Approve the workflow.
13. See generated RFQ artifacts.
14. Understand that the workflow uses multiple packs and data packs.
```

---

## 22. Strategic Conclusion

Version 3 is the strongest QS-OS direction so far.

The winning concept is not:

```text
Another n8n
```

The winning concept is:

```text
An operating system for AI business capabilities.
```

The QS-WFUI repository should therefore become the first visible expression of that idea.

The UI should make users feel that they are not wiring APIs. They are assembling business skills:

```text
Read BOQ
Classify Trade
Generate RFQ
Request Approval
Export Documents
```

That is the product difference.

---

## 23. Recommended Next Document

The next detailed document should be:

```text
QS-OS Version 3 UI/UX Product Specification for QS-WFUI
```

It should define:

```text
Screens
Components
User flows
Canvas behavior
Skill library behavior
Pack manager behavior
Data pack browser behavior
Workflow JSON schema
Mock execution states
BOQ-to-RFQ demo acceptance criteria
```

This should become the direct handoff document for UI implementation in the public repository.
