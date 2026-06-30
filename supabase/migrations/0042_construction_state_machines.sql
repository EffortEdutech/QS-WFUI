-- =============================================================================
-- Migration 0042 — Phase 7: Construction Pack — State Machines
--
-- Seeds system-default (org_id = NULL) state machine definitions for all
-- 6 construction resource types introduced in migration 0041.
--
-- State machine format (lados_state_machines.definition JSONB):
--   {
--     "initial": "<initial_state>",
--     "states":      { "<state>": { "label", "terminal", "color" } },
--     "transitions": [ { "from", "to", "label" } ]
--   }
-- =============================================================================

-- ── construction_project ─────────────────────────────────────────────────────
--
-- Lifecycle: draft → active → on_hold ⇌ active → completed
--                                        ↓
--                                     cancelled (from draft | active | on_hold)

INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'construction_project', '{
  "initial": "draft",
  "states": {
    "draft":     { "label": "Draft",     "terminal": false, "color": "gray"   },
    "active":    { "label": "Active",    "terminal": false, "color": "green"  },
    "on_hold":   { "label": "On Hold",   "terminal": false, "color": "yellow" },
    "completed": { "label": "Completed", "terminal": true,  "color": "blue"   },
    "cancelled": { "label": "Cancelled", "terminal": true,  "color": "red"    }
  },
  "transitions": [
    { "from": "draft",   "to": "active",    "label": "Activate"     },
    { "from": "active",  "to": "on_hold",   "label": "Put On Hold"  },
    { "from": "on_hold", "to": "active",    "label": "Resume"       },
    { "from": "active",  "to": "completed", "label": "Complete"     },
    { "from": "draft",   "to": "cancelled", "label": "Cancel"       },
    { "from": "active",  "to": "cancelled", "label": "Cancel"       },
    { "from": "on_hold", "to": "cancelled", "label": "Cancel"       }
  ]
}') ON CONFLICT DO NOTHING;

-- ── progress_claim ──────────────────────────────────────────────────────────
--
-- Lifecycle: draft → submitted → under_assessment → certified → paid
--                                                 ↘ rejected
--
-- AI guardrail: transition to "certified" must be downstream of
-- foundation.request_approval. construction.certify_progress_claim node
-- enforces this at the workflow level.

INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'progress_claim', '{
  "initial": "draft",
  "states": {
    "draft":            { "label": "Draft",            "terminal": false, "color": "gray"   },
    "submitted":        { "label": "Submitted",        "terminal": false, "color": "blue"   },
    "under_assessment": { "label": "Under Assessment", "terminal": false, "color": "yellow" },
    "certified":        { "label": "Certified",        "terminal": false, "color": "green"  },
    "paid":             { "label": "Paid",             "terminal": true,  "color": "green"  },
    "rejected":         { "label": "Rejected",         "terminal": true,  "color": "red"    }
  },
  "transitions": [
    { "from": "draft",            "to": "submitted",        "label": "Submit"           },
    { "from": "submitted",        "to": "under_assessment", "label": "Begin Assessment" },
    { "from": "under_assessment", "to": "certified",        "label": "Certify"          },
    { "from": "under_assessment", "to": "rejected",         "label": "Reject"           },
    { "from": "certified",        "to": "paid",             "label": "Mark Paid"        },
    { "from": "submitted",        "to": "rejected",         "label": "Reject"           }
  ]
}') ON CONFLICT DO NOTHING;

-- ── variation ───────────────────────────────────────────────────────────────
--
-- Lifecycle: draft → submitted → under_review → approved → executed
--                                             ↘ rejected
--
-- AI guardrail: transition to "approved" must be downstream of
-- foundation.request_approval. construction.approve_variation node
-- enforces this at the workflow level.

INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'variation', '{
  "initial": "draft",
  "states": {
    "draft":        { "label": "Draft",        "terminal": false, "color": "gray"   },
    "submitted":    { "label": "Submitted",    "terminal": false, "color": "blue"   },
    "under_review": { "label": "Under Review", "terminal": false, "color": "yellow" },
    "approved":     { "label": "Approved",     "terminal": false, "color": "green"  },
    "executed":     { "label": "Executed",     "terminal": true,  "color": "green"  },
    "rejected":     { "label": "Rejected",     "terminal": true,  "color": "red"    }
  },
  "transitions": [
    { "from": "draft",        "to": "submitted",    "label": "Submit"       },
    { "from": "submitted",    "to": "under_review", "label": "Begin Review" },
    { "from": "under_review", "to": "approved",     "label": "Approve"      },
    { "from": "under_review", "to": "rejected",     "label": "Reject"       },
    { "from": "approved",     "to": "executed",     "label": "Execute"      },
    { "from": "submitted",    "to": "rejected",     "label": "Reject"       }
  ]
}') ON CONFLICT DO NOTHING;

-- ── defect ──────────────────────────────────────────────────────────────────
--
-- Lifecycle: open → acknowledged → in_progress → resolved → closed
--                                                         ↘ disputed → in_progress

INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'defect', '{
  "initial": "open",
  "states": {
    "open":         { "label": "Open",         "terminal": false, "color": "red"    },
    "acknowledged": { "label": "Acknowledged", "terminal": false, "color": "yellow" },
    "in_progress":  { "label": "In Progress",  "terminal": false, "color": "blue"   },
    "resolved":     { "label": "Resolved",     "terminal": false, "color": "green"  },
    "closed":       { "label": "Closed",       "terminal": true,  "color": "gray"   },
    "disputed":     { "label": "Disputed",     "terminal": false, "color": "red"    }
  },
  "transitions": [
    { "from": "open",         "to": "acknowledged", "label": "Acknowledge"       },
    { "from": "acknowledged", "to": "in_progress",  "label": "Start Repair"      },
    { "from": "in_progress",  "to": "resolved",     "label": "Mark Resolved"     },
    { "from": "resolved",     "to": "closed",       "label": "Close"             },
    { "from": "resolved",     "to": "disputed",     "label": "Dispute"           },
    { "from": "disputed",     "to": "in_progress",  "label": "Reopen for Repair" },
    { "from": "disputed",     "to": "closed",       "label": "Close Dispute"     }
  ]
}') ON CONFLICT DO NOTHING;

-- ── boq ─────────────────────────────────────────────────────────────────────
--
-- Lifecycle: draft → submitted → approved
--                             ↘ revised → submitted
--                             ↘ rejected

INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'boq', '{
  "initial": "draft",
  "states": {
    "draft":     { "label": "Draft",     "terminal": false, "color": "gray"   },
    "submitted": { "label": "Submitted", "terminal": false, "color": "blue"   },
    "approved":  { "label": "Approved",  "terminal": false, "color": "green"  },
    "revised":   { "label": "Revised",   "terminal": false, "color": "yellow" },
    "rejected":  { "label": "Rejected",  "terminal": true,  "color": "red"    }
  },
  "transitions": [
    { "from": "draft",     "to": "submitted", "label": "Submit for Approval" },
    { "from": "submitted", "to": "approved",  "label": "Approve"             },
    { "from": "submitted", "to": "rejected",  "label": "Reject"              },
    { "from": "submitted", "to": "revised",   "label": "Send for Revision"   },
    { "from": "revised",   "to": "submitted", "label": "Resubmit"            },
    { "from": "approved",  "to": "revised",   "label": "Revise"              }
  ]
}') ON CONFLICT DO NOTHING;

-- ── site_inspection ─────────────────────────────────────────────────────────
--
-- Lifecycle: scheduled → in_progress → completed
--                                    ↘ failed

INSERT INTO lados_state_machines (org_id, resource_type, definition) VALUES
(NULL, 'site_inspection', '{
  "initial": "scheduled",
  "states": {
    "scheduled":   { "label": "Scheduled",   "terminal": false, "color": "blue"   },
    "in_progress": { "label": "In Progress", "terminal": false, "color": "yellow" },
    "completed":   { "label": "Completed",   "terminal": true,  "color": "green"  },
    "failed":      { "label": "Failed",      "terminal": true,  "color": "red"    }
  },
  "transitions": [
    { "from": "scheduled",   "to": "in_progress", "label": "Start Inspection" },
    { "from": "in_progress", "to": "completed",   "label": "Complete"         },
    { "from": "in_progress", "to": "failed",      "label": "Fail"             }
  ]
}') ON CONFLICT DO NOTHING;
