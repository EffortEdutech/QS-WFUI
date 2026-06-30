-- =============================================================================
-- Migration 0044 — Phase 9: Finance Pack — State Machines
--
-- Seeds system-default (org_id = NULL) state machine definitions for all
-- 3 finance resource types introduced in migration 0043.
--
-- AI guardrails (non-negotiable — enforced at node level, documented here):
--   finance_invoice   → approve: MUST be downstream of foundation.request_approval
--   finance_invoice   → paid:    MUST be downstream of foundation.request_approval
--   purchase_order    → approve: MUST be downstream of foundation.request_approval
--   retention_release → approve: MUST be downstream of foundation.request_approval
--   AI CANNOT transition any finance resource directly to 'approved' or 'paid'
-- =============================================================================

-- ── finance_invoice ───────────────────────────────────────────────────────────
--
-- Invoice lifecycle (construction IPC / PAM certificate context):
--   draft → submitted → verified → approved → paid
--                                 ↓
--                              rejected (from submitted | verified)

INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'finance_invoice', '{
  "initial": "draft",
  "states": {
    "draft":     { "label": "Draft",     "terminal": false, "color": "gray"   },
    "submitted": { "label": "Submitted", "terminal": false, "color": "blue"   },
    "verified":  { "label": "Verified",  "terminal": false, "color": "indigo" },
    "approved":  { "label": "Approved",  "terminal": false, "color": "green"  },
    "paid":      { "label": "Paid",      "terminal": true,  "color": "emerald"},
    "rejected":  { "label": "Rejected",  "terminal": true,  "color": "red"    }
  },
  "transitions": [
    { "from": "draft",     "to": "submitted", "label": "Submit for Verification" },
    { "from": "submitted", "to": "verified",  "label": "QS Verify"               },
    { "from": "submitted", "to": "rejected",  "label": "Reject Invoice"           },
    { "from": "verified",  "to": "approved",  "label": "PM Approve (Human)"       },
    { "from": "verified",  "to": "rejected",  "label": "Reject after Verification"},
    { "from": "approved",  "to": "paid",      "label": "Process Payment (Human)"  }
  ]
}')
ON CONFLICT DO NOTHING;

-- ── purchase_order ────────────────────────────────────────────────────────────
--
-- PO lifecycle:
--   draft → submitted → approved → issued → fulfilled
--                     ↓           ↓
--                  rejected     cancelled

INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'purchase_order', '{
  "initial": "draft",
  "states": {
    "draft":      { "label": "Draft",      "terminal": false, "color": "gray"   },
    "submitted":  { "label": "Submitted",  "terminal": false, "color": "blue"   },
    "approved":   { "label": "Approved",   "terminal": false, "color": "green"  },
    "issued":     { "label": "Issued",     "terminal": false, "color": "indigo" },
    "fulfilled":  { "label": "Fulfilled",  "terminal": true,  "color": "emerald"},
    "rejected":   { "label": "Rejected",   "terminal": true,  "color": "red"    },
    "cancelled":  { "label": "Cancelled",  "terminal": true,  "color": "gray"   }
  },
  "transitions": [
    { "from": "draft",     "to": "submitted", "label": "Submit PO"           },
    { "from": "submitted", "to": "approved",  "label": "Approve PO (Human)"  },
    { "from": "submitted", "to": "rejected",  "label": "Reject PO"           },
    { "from": "approved",  "to": "issued",    "label": "Issue to Supplier"   },
    { "from": "approved",  "to": "cancelled", "label": "Cancel before Issue" },
    { "from": "issued",    "to": "fulfilled", "label": "Mark Fulfilled"      },
    { "from": "issued",    "to": "cancelled", "label": "Cancel after Issue"  }
  ]
}')
ON CONFLICT DO NOTHING;

-- ── retention_release ─────────────────────────────────────────────────────────
--
-- Retention lifecycle (PAM/JKR context):
--   pending → claimed → approved → released
--                     ↓
--                   rejected

INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'retention_release', '{
  "initial": "pending",
  "states": {
    "pending":  { "label": "Pending",  "terminal": false, "color": "gray"   },
    "claimed":  { "label": "Claimed",  "terminal": false, "color": "blue"   },
    "approved": { "label": "Approved", "terminal": false, "color": "green"  },
    "released": { "label": "Released", "terminal": true,  "color": "emerald"},
    "rejected": { "label": "Rejected", "terminal": true,  "color": "red"    }
  },
  "transitions": [
    { "from": "pending",  "to": "claimed",  "label": "Claim Retention"         },
    { "from": "claimed",  "to": "approved", "label": "Approve Release (Human)" },
    { "from": "claimed",  "to": "rejected", "label": "Reject Claim"            },
    { "from": "approved", "to": "released", "label": "Release Payment (Human)" }
  ]
}')
ON CONFLICT DO NOTHING;
