# QS-OS Switch, Mute, Bypass & Group — Design Reference

**Document status:** Design reference and sprint input  
**Architecture version:** V3  
**Prepared:** 2026-06-18  
**Inputs:** rgthree ComfyUI custom nodes study + QS-OS Vol 4, 5, 6, 9 review  

---

## 1. What rgthree Taught Us

rgthree is the most sophisticated open-source node control system built on LiteGraph (the same engine ComfyUI uses). Their pattern for group/switch/mute/bypass is the clearest reference model available.

### 1.1 The four concepts in LiteGraph terms

| Concept | LiteGraph mode | What happens to data | Visual |
|---|---|---|---|
| **Active** | `LiteGraph.ALWAYS` | Node runs normally, outputs its result | Normal |
| **Muted** | `LiteGraph.NEVER` | Node is completely skipped. Downstream nodes receive `null` | Grayed out, 🔇 |
| **Bypassed** | `LiteGraph.ON_TRIGGER` | Node is skipped but its INPUT is passed through as OUTPUT transparently | Dashed border, → |
| **Grouped** | N/A (container) | Visual bounding box. Bulk mute/bypass all nodes inside | Colored frame |

### 1.2 Mute vs Bypass — the critical difference

```
Mute:
  Input → [🔇 Node] → null
                           ↓
                      downstream gets nothing

Bypass:
  Input → [→ Node] → Input (unchanged, passed through)
                           ↓
                      downstream gets the input as-is
```

**Mute** use case: "I want to stop this branch entirely. No data flows past this point."  
**Bypass** use case: "I want to skip this processing step but keep data flowing. The node is optional."

### 1.3 Switch (router) — different from mute/bypass

A Switch node is not about disabling — it is about **routing**. It actively directs data flow to one path or another based on a value or condition.

```
rgthree Switch pattern:
  Input → [Switch] → Output A  (selected)
                  ↘ Output B  (not selected, receives null)
```

This is a DATA-DRIVEN router. The selection is made by the node's logic, not by the user toggling something in the UI.

### 1.4 Group — visual + bulk control

A Group in rgthree is:
1. A visual bounding box containing related nodes
2. A target for bulk mute/bypass (Fast Groups Muter/Bypasser)
3. A unit of workflow organization that can be collapsed

The `toggleRestriction` property is particularly useful:
- `default` — any combination of groups can be active
- `max one` — enabling one group disables all others (radio-button style)
- `always one` — exactly one group must always be active (forced choice)

---

## 2. Current QS-OS State

### 2.1 What we built (Sprint 11–12)

Our current `SwitchNode` on the **Pipeline Canvas** works like this:

```
Workflow A → [◆ Switch] → Workflow B   (user chose path 0)
                        ↘ Workflow C   (marked skipped)
```

This is a **user-driven router** that:
- Pauses pipeline execution
- Shows `SwitchPathModal` asking the user to pick a path
- Follows the chosen path, marks unchosen subtrees as `skipped`
- Lives on the **Pipeline Canvas** (multi-workflow level)

**This is NOT the same as rgthree's Switch node.**  
Ours is a human decision gate between whole workflows. rgthree's Switch routes data between node outputs.

### 2.2 What the documentation already defined

**Vol 4 (Workflow JSON) already defined:**
- `ui.groups[]` — visual groups with `nodeIds` — noted as "visual only unless explicitly used by execution policy"
- `condition` on connections — `{ type: "expression", expression: "{{node.outputs.confidence}} >= 0.9" }`
- Branching via multiple outgoing connections from a decision node

**Vol 5 (Execution Engine) already defined:**
- Node execution policies including `route`, `skip`, `continue`
- `Exclusive decision nodes should run only one branch`
- Branch conditions must be logged

**Vol 9 (UI/UX) already defined:**
- Node state "Disabled: muted appearance" — mentioned but never implemented
- Group nodes — mentioned in canvas context menu actions, never implemented

### 2.3 The gap

We have the concepts documented but never built:
- ✗ Mute state on individual skill nodes  
- ✗ Bypass state on individual skill nodes  
- ✗ Skill Groups on the workflow canvas  
- ✗ Workflow-level Condition/Switch node (data-driven routing within a single workflow)  
- ✓ Pipeline-level SwitchNode (user-driven routing between workflows) — built Sprint 12

---

## 3. QS-OS Design: Four Distinct Concepts

Based on rgthree study + our existing documentation, QS-OS needs exactly four concepts, clearly separated:

---

### 3.1 Skill Node Mute

**What it is:** A temporary design-time toggle that disables a skill node on the workflow canvas.  
**Effect:** The node does not execute. Its output ports emit `null`. Downstream nodes receive null.  
**Use case:** Developer/designer testing. "I want to skip this AI step and test the rest of the workflow with no AI output."  
**Who uses it:** Workflow designers. Not visible to business users in production.  
**Persistence:** Saved in workflow JSON as `"mode": "muted"` on the node.  

```
Visual:   Grayed out node card. 🔇 icon in top-right corner. 
          Incoming/outgoing edges shown as dashed gray lines.
```

---

### 3.2 Skill Node Bypass

**What it is:** A toggle that skips a skill's processing but passes its primary input through as its primary output unchanged.  
**Effect:** The node does not execute. Its first output port receives the value of its first input port directly. Other output ports emit `null`.  
**Use case:** Optional processing. "Clean BOQ is optional — if I bypass it, the raw BOQ still flows to Classify Trade."  
**Who uses it:** Workflow designers. Can also be useful for business users who understand the step is optional.  
**Persistence:** Saved in workflow JSON as `"mode": "bypassed"` on the node.  

```
Visual:   Dashed border. → icon in top-right corner. 
          A straight passthrough arrow overlaid on the node.
          Edges shown as thin blue dashed lines.
```

---

### 3.3 Skill Group

**What it is:** A visual container that groups related skill nodes on the workflow canvas.  
**Effect on execution:** None by default (visual only). Can optionally bulk-mute or bulk-bypass all nodes inside.  
**Use case:** Organising complex workflows. "These five nodes form the RFQ Generation sub-process."  
**Bulk actions:** Right-click group → Mute Group / Bypass Group / Activate Group.  
**Collapse:** Groups can be collapsed to a single box labelled with the group name.  

```json
// Workflow JSON representation (Vol 4 already defines this):
{
  "ui": {
    "groups": [
      {
        "id": "group_rfq_generation",
        "name": "RFQ Generation",
        "color": "#8B5CF6",
        "nodeIds": ["node-split-wp", "node-gen-rfq", "node-approval"],
        "collapsed": false,
        "mode": "active"
      }
    ]
  }
}
```

---

### 3.4 Switch / Condition Node (Workflow-level, Data-driven)

**What it is:** A skill node that routes data flow based on a condition evaluated from upstream node outputs.  
**Effect:** Exactly one outgoing path receives the data. Other paths receive `null` (or are skipped by the execution engine).  
**Use case:** "If AI classification confidence is >= 0.9, go straight to Generate RFQ. If lower, route to Manual Review first."  
**Who decides:** The DATA decides (no user interaction during execution).  
**Lives on:** The **workflow canvas** (single workflow).  
**Different from Pipeline SwitchNode:** That one pauses for user input between whole workflows.  

```
Node type: workflow.condition
Visual: Diamond shape (◇) in teal/cyan color — distinct from Pipeline SwitchNode (◆ violet)
```

---

## 4. Distinguishing All Four Switch/Route Concepts

This is the most important table in this document. QS-OS has four different routing concepts that must never be confused:

| Concept | Canvas level | Decision maker | Data effect | Execution effect |
|---|---|---|---|---|
| **Skill Mute** | Workflow canvas | Designer (design time) | Outputs null | Node skipped, data cut |
| **Skill Bypass** | Workflow canvas | Designer (design time) | Input passed through | Node skipped, data continues |
| **Condition Node** | Workflow canvas | Data (runtime, automatic) | Routes to one branch | Other branches receive null |
| **Pipeline SwitchNode** | Pipeline canvas | User (runtime, human choice) | Chosen workflow runs | Unchosen workflows skipped |

```
Mental model:

Workflow Canvas:
  [Skill A] → [◇ Condition] → [Skill B]  (auto-routed by data)
                             ↘ [Skill C]  (null, skipped)

  [🔇 Muted Skill]  → null to downstream
  [→ Bypassed Skill] → input passed through

Pipeline Canvas:
  [Workflow 1] → [◆ Switch] → [Workflow 2]  (user chose)
                            ↘ [Workflow 3]  (skipped)
```

---

## 5. Condition Node — Design Specification

The **Condition Node** (`workflow.condition`) is the main new skill to design for Sprint 13 additions or a dedicated sprint.

### 5.1 Node anatomy

```
Inputs:
  • value (any)         — the value to evaluate
  • condition (string)  — expression config, e.g. "value >= 0.9"

Outputs:
  • true_path (any)     — forwards `value` if condition is true
  • false_path (any)    — forwards `value` if condition is false
```

### 5.2 Condition types

```
Simple comparison:    value >= 0.9
String match:         value == "approved"
Contains:             value includes "electrical"
Boolean:              value == true
Null check:           value != null
Confidence gate:      {{node_classify.outputs.confidence}} >= 0.9
AI output field:      {{node_classify.outputs.trade}} == "M&E"
```

### 5.3 Visual design

```
Shape:    Diamond (◇) — universal decision symbol
Color:    Teal (#0D9488) — distinct from:
            violet SwitchNode (Pipeline level)
            gray/blue regular skill nodes
Size:     Compact — 140×80px (smaller than regular nodes)
Handles:  Left: 1 input (value)
          Right top: true path output
          Right bottom: false path output
          Labels: "✓ True" / "✗ False"
```

### 5.4 Execution engine behaviour

```
1. Evaluate condition expression against input value
2. If true → forward value to true_path output, emit null on false_path
3. If false → forward value to false_path output, emit null on true_path  
4. Log condition evaluation result to execution_logs
5. Branch condition must include: expression, evaluated_value, result (true/false)
```

---

## 6. Mute & Bypass — Implementation Notes

### 6.1 Node mode in workflow JSON

```json
{
  "id": "node-clean-boq",
  "type": "document.clean_boq",
  "mode": "active",    ← "active" | "muted" | "bypassed"
  "position": { "x": 360, "y": 100 },
  "config": {}
}
```

### 6.2 Canvas UI interaction

Right-click on a skill node → context menu:
```
✓ Activate    (if currently muted or bypassed)
🔇 Mute       (if currently active or bypassed)
→  Bypass     (if currently active or muted)
```

Or: a three-state toggle button on the node card itself (top-right, small).

### 6.3 Execution engine handling

```
Node mode check before execution:
  if mode == "muted"   → skip node, emit null on all outputs
  if mode == "bypassed" → skip node, pass input[0] → output[0], null on rest
  if mode == "active"  → execute normally
```

### 6.4 Persist in canvas node data

```typescript
// Extend WorkflowNodeData
interface WorkflowNodeData {
  // ... existing fields
  mode?: 'active' | 'muted' | 'bypassed';
}
```

---

## 7. Skill Group — Implementation Notes

### 7.1 Groups in React Flow

React Flow does not have a built-in group/container. Implementation options:

**Option A: Group node type** (recommended)
- A special `groupNode` React Flow node type
- Larger, background-colored, non-interactive box
- Other nodes can be positioned "inside" it visually
- Collapse/expand toggles the `hidden` prop on child nodes

**Option B: React Flow `parentNode`**
- React Flow supports `parentNode` on nodes — a node can declare another node as its parent
- Parent-relative positioning: when parent moves, children move with it
- This is the cleaner technical approach

### 7.2 Group JSON

Already defined in Vol 4 `ui.groups[]`. Add `mode` field:

```json
{
  "id": "group_rfq",
  "name": "RFQ Generation",
  "color": "#8B5CF6",
  "nodeIds": ["node-a", "node-b", "node-c"],
  "collapsed": false,
  "mode": "active"    ← "active" | "muted" | "bypassed"
}
```

### 7.3 Bulk mute/bypass

When a group's mode changes:
- Set all `nodeIds` in the group to the same mode
- Persist individual node modes (so "un-grouping" restores previous state)
- Show group mode indicator on group header

---

## 8. Sprint Plan Integration

These concepts map into the sprint plan as follows:

### Fits in Sprint 13 (surface changes only)

- Add `mode` field to `WorkflowNodeData` interface
- Right-click context menu on skill nodes: Mute / Bypass / Activate options
- Visual state: muted (grayed) and bypassed (dashed) node appearance
- Save `mode` in workflow JSON

### New sprint: Sprint 13b or Sprint 14 addition

- Condition Node (`workflow.condition`) — new node type on canvas
- Group container (React Flow `parentNode` approach)
- Group bulk mute/bypass controls
- Execution engine: handle `mode === 'muted'` and `mode === 'bypassed'`

### Later sprint (S16 or S17 area)

- Advanced Condition Node — expression builder UI
- Nested groups
- Group collapse/expand animation
- Fast Groups panel (rgthree-style: side panel listing all groups with toggle buttons)

---

## 9. Recommended additions to Master Sprint Plan

Add to `QS-OS_Master_Sprint_Plan_and_Checklist.md` under Sprint 13:

```
S13-XXX — Node execution modes (Mute / Bypass / Active)
  [ ] Add mode field to WorkflowNodeData
  [ ] Right-click context menu on canvas nodes
  [ ] Visual states for muted and bypassed nodes
  [ ] Save/load mode from workflow JSON

S13-XXX — Skill Group (visual only, no bulk control yet)
  [ ] GroupNode type in React Flow using parentNode
  [ ] Draw group around selected nodes (canvas toolbar button)
  [ ] Group name label + color picker
  [ ] Save/load groups in ui.groups[] workflow JSON
```

Add to Sprint 14:

```
S14-XXX — Condition Node (workflow.condition)
  [ ] Diamond-shaped node on canvas
  [ ] True/false output handles
  [ ] Expression config in Skill Inspector
  [ ] Execution engine: evaluate condition, route to correct output
  [ ] Log condition evaluation in execution_logs

S14-XXX — Group bulk controls
  [ ] Right-click group → Mute Group / Bypass Group / Activate Group
  [ ] Group mode indicator on header
  [ ] Execution engine: respect group mode
```

---

## 10. Summary: The QS-OS Control Vocabulary

```
SKILL NODE CONTROLS (Workflow Canvas):
  Active  — runs normally
  Muted   — completely disabled, outputs null
  Bypassed — skipped, input passed through as output

ROUTING (Workflow Canvas):
  Condition Node (◇ teal) — data-driven automatic routing
    "If confidence >= 0.9 → fast path, else → review path"

ROUTING (Pipeline Canvas):
  SwitchNode (◆ violet) — user-driven manual routing between workflows
    "Which workflow do you want to run next?"

ORGANISATION:
  Skill Group — visual container, bulk mute/bypass, collapse
```

These four controls give QS-OS designers the same power that rgthree gives ComfyUI users — but expressed in business-workflow language rather than image-generation pipeline language.
