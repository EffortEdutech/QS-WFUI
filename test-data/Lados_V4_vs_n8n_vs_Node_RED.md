# Lados V4 vs n8n vs Node-RED

## Architectural Comparison and Lessons for Lados V4

**Document ID:** LADOS-V4-COMP-002
**Version:** 1.0
**Status:** Reference Architecture Study
**Prepared For:** Lados V4 Architecture Freeze and Migration Blueprint
**Scope:** Lados V4, n8n, Node-RED
**Date:** 2026-06-29

---

## 1. Executive Summary

This document compares **Lados V4**, **n8n**, and **Node-RED** from an architectural and product-design perspective.

The purpose of this comparison is not to declare one platform superior to another. Each platform was created for a different primary purpose.

**n8n** is strongest as an integration and workflow automation platform. It focuses on connecting applications, APIs, credentials, triggers, and workflow actions.

**Node-RED** is strongest as an event-driven flow programming environment. It focuses on wiring nodes together to process messages, events, device data, and real-time automation flows.

**Lados V4** is designed as a metadata-driven automation platform built on the **Lados Core Engine (LCE)**, with strong emphasis on Workspaces, Resources, Packs, Node Manifest V2, visual workflow building, and enterprise-ready extensibility.

Lados V4 can learn from both platforms while maintaining its own architectural identity.

---

## 2. High-Level Comparison

| Area                  | Lados V4                                                           | n8n                                                  | Node-RED                                        |
| --------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------- |
| Primary Purpose       | Metadata-driven automation platform                                | Workflow automation and app integrations             | Event-driven flow programming                   |
| Core Architecture     | LCE: Workflow, Execution, Resource, Event, State, Security engines | Workflow execution engine with nodes and credentials | Flow runtime with nodes passing messages        |
| Workflow Model        | Workspace → Project → Workflow → Nodes → Connections               | Workflow → Trigger nodes → Action nodes              | Flow → Nodes → Wires → Messages                 |
| Node Definition       | Node Manifest V2 plus executor                                     | Node packages / node definitions                     | JavaScript nodes                                |
| Node UI               | Manifest-driven Inspector                                          | Per-node configuration forms                         | Per-node editor dialogs                         |
| Ports                 | Typed input and output ports                                       | Mostly implicit input/output flow                    | One input, multiple outputs by convention       |
| Parameters            | Declared in Node Manifest V2 UI Schema                             | Node-specific fields                                 | Node edit dialog fields                         |
| Resources             | Workspace Resources plus Resource Bindings                         | Credentials and static data                          | Config nodes, context, credentials              |
| Plugin Model          | Pack SDK                                                           | Community nodes / npm packages                       | Node modules via npm                            |
| Marketplace           | Native Pack Marketplace planned                                    | Community node ecosystem                             | Node-RED Library / npm ecosystem                |
| Execution Monitoring  | Execution Monitor, timeline, events, logs                          | Execution history and logs                           | Debug sidebar, runtime logs                     |
| State Model           | LCE State Engine plus frontend state engine                        | Internal workflow state                              | Runtime context and message flow                |
| Event Model           | LCE Event Bus                                                      | Workflow events and executions                       | Event/message-driven by design                  |
| Versioning            | Workflow JSON V2 plus workflow versions                            | Workflow JSON and platform history                   | Flow JSON, external versioning common           |
| Business Resources    | First-class platform concept                                       | Not primary model                                    | Not primary model                               |
| Approvals             | Native human-in-the-loop capability                                | Possible through integrations or custom workflows    | Possible but not native business approval model |
| Enterprise Governance | Designed into architecture                                         | Available in enterprise editions                     | Possible through deployment controls            |
| AI Role               | AI as Packs, Tools, Nodes, and Resources                           | AI nodes and integrations                            | Community AI nodes and custom flows             |
| Best Fit              | Enterprise automation platform and business workflow IDE           | API/app integration automation                       | IoT, device, event, and lightweight automation  |

---

## 3. Platform Philosophy

### 3.1 Lados V4

Lados V4 is designed as a **platform**, not only a workflow editor.

Its core philosophy is:

```text
Workspace
  ├── Projects
  ├── Workflows
  ├── Resources
  ├── Packs
  ├── Templates
  ├── Executions
  └── Marketplace
```

Lados V4 treats the workflow as one important asset inside a larger workspace.

This enables:

* Reusable Resources
* Pack-based extensibility
* Workflow versioning
* Execution history
* Human approval workflows
* Metadata-driven UI
* Business object modeling
* Marketplace distribution
* Enterprise governance

---

### 3.2 n8n

n8n is primarily an automation and integration platform.

Its philosophy is centered around:

```text
Trigger
  ↓
Workflow
  ↓
Action Nodes
  ↓
External Apps / APIs
```

n8n is very strong when the main job is connecting applications, APIs, SaaS products, databases, webhooks, and automation steps.

---

### 3.3 Node-RED

Node-RED is primarily an event-driven flow programming tool.

Its philosophy is centered around:

```text
Event / Message
  ↓
Node
  ↓
Message
  ↓
Next Node
```

Node-RED is very strong for:

* IoT
* device integration
* MQTT
* hardware automation
* real-time event flows
* lightweight edge deployments
* custom JavaScript logic

---

## 4. Node Architecture Comparison

### 4.1 Lados V4 Node

```text
Node Manifest V2
  ├── Identity
  ├── Metadata
  ├── Input Ports
  ├── Output Ports
  ├── Parameters
  ├── UI Schema
  ├── Resource Requirements
  ├── Validation Rules
  ├── Documentation
  ├── Examples
  └── Executor
```

A Lados node is self-describing.

The UI, Inspector, Explorer, execution engine, marketplace, and documentation can all read the same manifest.

This makes Lados strongly metadata-driven.

---

### 4.2 n8n Node

An n8n node is typically an integration or operation. It provides fields for configuration and executes against data passed from previous nodes.

Typical examples include:

* Gmail nodes
* Slack nodes
* HTTP Request nodes
* If nodes
* Code nodes
* AI nodes

n8n nodes are highly practical and integration-focused.

---

### 4.3 Node-RED Node

A Node-RED node is a processing unit inside a flow. Nodes receive messages, process them, and send messages onward.

Typical examples include:

* Inject node
* Debug node
* Function node
* MQTT node
* HTTP node
* Switch node

Node-RED nodes are lightweight and event/message-oriented.

---

## 5. Resource Model Comparison

### 5.1 Lados V4

Lados V4 treats Resources as first-class workspace assets.

```text
Workspace Resources
  ├── Business Resources
  │   ├── Customers
  │   ├── Invoices
  │   ├── Jobs
  │   └── Materials
  │
  ├── AI Resources
  │   ├── Models
  │   ├── Knowledge Bases
  │   └── Prompt Templates
  │
  ├── Connections
  ├── Secrets
  ├── Templates
  └── Datasets
```

Workflows do not own Resources directly. Instead, workflows use **Resource Bindings**.

```text
Workspace Resource
  ↓
Workflow Binding
  ↓
Node Reference
```

This enables reuse, governance, central updates, and safer credential management.

---

### 5.2 n8n

n8n has a strong credentials model.

Credentials are used to authenticate nodes against external services. This is very effective for integrations.

However, n8n does not primarily model business entities such as customers, jobs, invoices, materials, approvals, or knowledge bases as platform-level Resources in the same way Lados V4 intends to.

---

### 5.3 Node-RED

Node-RED commonly uses:

* config nodes
* context storage
* credentials
* message payloads
* environment variables

This is flexible and lightweight, but it is not the same as a governed workspace resource model.

---

## 6. Execution Architecture

| Area                   | Lados V4                                   | n8n                                            | Node-RED                              |
| ---------------------- | ------------------------------------------ | ---------------------------------------------- | ------------------------------------- |
| Execution Type         | Workflow run with engine-managed lifecycle | Workflow execution                             | Event/message runtime                 |
| Runtime Model          | Execution Engine plus checkpoints and logs | Execution records and logs                     | Runtime message passing               |
| Human Approval         | Native concept in Lados architecture       | Can be modeled but not the central primitive   | Can be modeled but not native         |
| Pause / Resume         | Supported through workflow execution model | Supported depending on execution mode/features | Not the primary runtime model         |
| Execution History      | First-class                                | First-class                                    | Usually logs/debug/runtime history    |
| Long-running Workflows | Core design direction                      | Supported in automation context                | Less natural than event/message flows |

---

## 7. UI / UX Architecture

### 7.1 Lados V4

Lados V4 adopts a professional visual IDE model:

```text
Explorer
  ↓
Canvas
  ↓
Inspector
  ↓
Execution Monitor
```

Responsibilities are separated:

* **Explorer** discovers nodes, packs, workflows, resources, templates, and executions.
* **Canvas** visualizes workflow structure.
* **Inspector** configures selected nodes or workflows.
* **Execution Monitor** shows run status, logs, events, and timelines.

---

### 7.2 n8n

n8n focuses on a workflow editor optimized for automation building.

Its UI is strong for quickly adding nodes, connecting integrations, setting credentials, testing nodes, and viewing execution data.

---

### 7.3 Node-RED

Node-RED uses a flow editor optimized for dragging nodes, wiring them, editing node properties, and debugging messages.

It is efficient, lightweight, and mature for flow-based development.

---

## 8. Strengths of Each Platform

### 8.1 Lados V4 Strengths

* Metadata-driven architecture
* Node Manifest V2
* Workspace and Project hierarchy
* Business Resources
* Resource Bindings
* Pack SDK
* LCE engine architecture
* Native approvals
* Workflow versioning
* Execution observability
* Marketplace-ready platform model
* Strong separation between UI and engine

---

### 8.2 n8n Strengths

* Mature automation builder
* Strong SaaS/app integration ecosystem
* Easy webhook and trigger-based automation
* Practical workflow execution model
* Strong credential handling
* Large community and connector library
* Fast productivity for integration workflows

---

### 8.3 Node-RED Strengths

* Lightweight and efficient
* Excellent for IoT and device automation
* Event/message-driven architecture
* Easy to extend with JavaScript
* Strong MQTT and hardware ecosystem
* Runs well on edge devices and local environments
* Mature flow-based programming model

---

## 9. What Lados V4 Should Learn from n8n

Lados V4 should adopt or learn from:

1. Fast workflow creation.
2. Strong trigger/action mental model.
3. Clear execution history.
4. Practical credential management.
5. Large integration ecosystem mindset.
6. Easy node discovery.
7. Simple onboarding for automation builders.
8. Useful templates and examples.

Lados V4 should avoid becoming only an integration tool.

Its scope is broader: it must support business resources, AI resources, approvals, documents, packs, and metadata-driven workflows.

---

## 10. What Lados V4 Should Learn from Node-RED

Lados V4 should adopt or learn from:

1. Lightweight flow editing.
2. Message/event clarity.
3. Debugging simplicity.
4. Extensible node ecosystem.
5. Visual wiring interaction.
6. Runtime transparency.
7. Local and edge deployment mindset.
8. Simplicity of node authoring.

Lados V4 should avoid becoming too low-level.

Its users should not always need to think in raw messages, payloads, or JavaScript functions.

---

## 11. What Lados V4 Should Deliberately Do Differently

### 11.1 Use Node Manifest V2 as the Single Source of Truth

Every node should describe:

* what it does
* what it needs
* what it produces
* how it is configured
* how it should be rendered
* which resources it requires
* what examples it provides

This enables metadata-driven UI.

---

### 11.2 Treat Resources as First-Class Assets

Resources should not be hidden inside node configuration.

They should be reusable workspace assets.

---

### 11.3 Separate Explorer, Canvas, Inspector, and Execution Monitor

The workflow builder should scale like a professional IDE.

---

### 11.4 Make Packs the Distribution Unit

Packs should contain:

* nodes
* resources
* templates
* documentation
* examples
* marketplace metadata
* permissions

---

### 11.5 Keep the Engine Generic

LCE should not be tied to any single business domain.

The platform should remain generic while Packs provide domain-specific behavior.

---

## 12. Best-Fit Use Case Matrix

| Use Case                       |  Lados V4 |       n8n |  Node-RED |
| ------------------------------ | --------: | --------: | --------: |
| SaaS app automation            |      High | Very High |    Medium |
| IoT / hardware automation      |    Medium |       Low | Very High |
| Business workflow platform     | Very High |      High |    Medium |
| AI workflow orchestration      |      High |      High |    Medium |
| Human approval workflows       | Very High |    Medium |       Low |
| Enterprise resource governance | Very High |    Medium |       Low |
| Custom business domain Packs   | Very High |    Medium |    Medium |
| Edge deployment                |    Medium |    Medium | Very High |
| Citizen automation             |    Medium |      High |    Medium |
| Developer flow programming     |    Medium |    Medium | Very High |
| Marketplace ecosystem          |      High |      High |      High |
| Visual node UX                 |      High |      High |      High |

---

## 13. Recommended Lados V4 Architecture Decisions

| Decision                                  | Rationale                                                        |
| ----------------------------------------- | ---------------------------------------------------------------- |
| Adopt Node Manifest V2                    | Enables metadata-driven UI and stronger node contracts           |
| Keep Workflow JSON V2                     | Provides stable workflow serialization                           |
| Keep LCE generic                          | Prevents domain lock-in                                          |
| Use Packs as extension units              | Supports marketplace and modular growth                          |
| Use Workspace Resources                   | Enables reuse, governance, and safer configuration               |
| Use Resource Bindings                     | Prevents nodes from owning sensitive or duplicated resource data |
| Build Explorer plus Canvas plus Inspector | Scales better than canvas-only editing                           |
| Add Execution Monitor                     | Makes runtime observable                                         |
| Add frontend State Engine                 | Reduces UI coupling                                              |
| Add Event Bus                             | Enables synchronized UI and runtime updates                      |
| Keep AI as Packs and Tools                | Avoids special-case AI architecture                              |

---

## 14. Final Conclusion

Lados V4 should not try to become a clone of n8n or Node-RED.

Instead:

* It should learn from **n8n's strength in integrations, credentials, and workflow automation**.
* It should learn from **Node-RED's strength in event-driven flows, lightweight node wiring, and extensibility**.
* It should preserve its own identity as a **metadata-driven automation platform built on the Lados Core Engine**.

The most important distinction is this:

```text
n8n connects apps.

Node-RED wires events.

Lados V4 manages workflows, resources, packs, and executions inside a governed workspace platform.
```

This gives Lados V4 a clear architectural identity and a strong foundation for long-term growth.

---

## 15. Reference Sources

The following public documentation sources are recommended background references:

* n8n Documentation: https://docs.n8n.io/
* n8n Credentials Documentation: https://docs.n8n.io/credentials/
* n8n First Workflow Tutorial: https://docs.n8n.io/try-it-out/tutorial-first-workflow/
* Node-RED Documentation: https://nodered.org/docs/
* Node-RED Concepts: https://nodered.org/docs/user-guide/concepts
* Node-RED Developing Flows: https://nodered.org/docs/developing-flows/
* Node-RED Function Node Documentation: https://nodered.org/docs/user-guide/writing-functions
* Node-RED Library: https://flows.nodered.org/

---

## 16. Suggested Placement in Lados Documentation

This document should be stored as:

```text
Lados-V4-Documentation/
└── Appendices/
    └── Appendix G - Lados V4 vs n8n vs Node-RED.md
```

It should be referenced by:

* Lados V4 Architecture Freeze and Migration Blueprint
* Lados V4 Product Blueprint
* Lados V4 Workflow Builder Architecture
* Lados V4 Pack Marketplace Specification
* Lados Core Engine documentation
