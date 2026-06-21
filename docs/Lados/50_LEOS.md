# 50 LEOS

**Lados Enterprise Operating System — Government and Large-Scale Deployment Blueprint**

> LEOS is the enterprise and government tier of Lados. It is not yet built. This document is the strategic blueprint — a deferred design for when LCE V1 is stable and Contractor Edition is in production. Audience: leadership, enterprise architects, and government solution teams.

---

## 1. What LEOS Is

LEOS (Lados Enterprise Operating System) is the configuration of Lados Core Engine that runs large-scale construction project delivery — government agencies, national infrastructure programmes, and multi-contractor supply chains.

Where Contractor Edition solves the problem for one contractor on one phone, LEOS solves the problem for:

- A government agency (JKR, CIDB, CITP) managing 200+ active projects
- A Grade 7 main contractor managing 10 subcontractors on a single highway package
- A national infrastructure programme tracking RM 5 billion of works across 50 sites

LEOS is not a separate codebase. It is a solution layer on the same LCE engine — additional packs, additional resource types, additional permission levels, and a higher governance model.

---

## 2. Who Uses LEOS

| Role | Who | What they need |
|---|---|---|
| Programme Director | JKR / agency lead | Portfolio-level dashboard: all projects, total progress, financial exposure |
| Project Manager | Main contractor PM | Site-level: milestones, subcontractors, variations, certificates |
| QS (Quantity Surveyor) | Client QS or main contractor QS | BOQ, valuations, payment certificates, variation orders |
| Contract Manager | Both sides | Contract documents, correspondence log, dispute records |
| Subcontractor | Individual contractors | My packages, my claims, my progress, my payments |
| Site Supervisor | On-site | Daily progress, site diary, NCR, weather |
| Finance Controller | Head office | Cashflow forecast, payment status, retention summary |
| CIDB / Auditor | Government body | Compliance records, worker certifications, accident log |

---

## 3. LEOS Resource Model

LEOS introduces an additional layer of resource types above Contractor Edition:

### Programme Layer

| Resource Type | Description |
|---|---|
| Programme | A government infrastructure initiative (e.g. Pan Borneo Highway) |
| Contract | A formal contract (LOA, SPK) within a programme |
| Package | A scope subdivision of a contract |
| Milestone | A key delivery event with dates and criteria |
| Variation Order | A formally approved change to contract scope or price |

### Site Layer

| Resource Type | Description |
|---|---|
| SiteLocation | GPS-bounded zone within a project |
| SiteDiary | Daily record of site activities, weather, workforce |
| NCR | Non-Conformance Report |
| RFI | Request for Information |
| Submittal | Material/method/shop drawing submission |

### Financial Layer

| Resource Type | Description |
|---|---|
| BOQ | Bill of Quantities linked to a Package |
| ProgressClaim | Contractor's monthly valuation claim |
| InterimCertificate | QS-certified payment amount |
| FinalCertificate | Final settlement document |
| RetentionRelease | Instruction to release retention money |
| CashflowForecast | Projected monthly cashflow per contract |

### Compliance Layer

| Resource Type | Description |
|---|---|
| CIDBWorkerRecord | Worker CIDB card registration |
| HIRARC | Hazard identification and risk assessment |
| AccidentRecord | Site accident/incident report |
| InspectionRecord | Site inspection with outcome |

---

## 4. LEOS Workflow Library (Target)

### Progress and Claims

| Workflow | Trigger | Key Nodes |
|---|---|---|
| `qs.monthly_valuation` | Month end | Collect Progress Entries → QS Measurement → AI Draft Certificate → QS Review → Director Approval → Issue Certificate |
| `qs.variation_order` | VO instruction | Create VO → Estimate Cost → AI Review → Director Approval → Update BOQ → Notify Contractor |
| `contract.final_account` | Project completion | Aggregate All Certificates → QS Final Audit → AI Summary → Director Approval → Final Certificate |

### Site Management

| Workflow | Trigger | Key Nodes |
|---|---|---|
| `site.daily_diary` | Site supervisor (daily) | Record Activities → Weather Log → Workforce Count → Submit to PM |
| `site.ncr_raise` | Inspector | Create NCR → Assign to Contractor → Human Review → Close or Escalate |
| `site.rfi_respond` | Contractor raises | Create RFI → Route to Engineer → Human Response → Log |

### Compliance

| Workflow | Trigger | Key Nodes |
|---|---|---|
| `compliance.worker_registration` | New worker onsite | Verify CIDB Card → Photo Capture → Register → Notify PM |
| `compliance.accident_report` | Accident occurs | Create Incident Record → Route to DOSH → Human Certification |

---

## 5. LEOS Pack Composition

LEOS installs all Contractor Edition packs plus:

```
Contractor Edition (base)
  └── QS Pack           (BOQ, valuations, certificates, variations)
       └── Contract Pack     (contracts, correspondence, milestones)
            └── Programme Pack    (multi-project portfolio management)
                 └── Compliance Pack   (CIDB, HIRARC, NCR, accident log)
                      └── GIS Pack          (site boundaries, geofencing)
                           └── LEOS Dashboard    (programme-level metrics)
```

---

## 6. LEOS Permission Model

LEOS requires more granular permissions than Contractor Edition:

```
programme_level:
  - programme.view
  - programme.manage
  - contract.view
  - contract.manage

qs_level:
  - qs.measure
  - qs.certify_interim        # can issue Interim Certificate
  - qs.certify_final          # can issue Final Certificate
  - qs.approve_variation

contract_level:
  - contract.raise_claim
  - contract.view_certificate
  - contract.raise_rfi
  - contract.raise_ncr

site_level:
  - site.record_diary
  - site.raise_ncr
  - site.view_hirarc

compliance_level:
  - compliance.register_worker
  - compliance.report_accident
  - compliance.close_ncr
```

---

## 7. AI Guardrails at LEOS Scale

LEOS AI guardrails are identical to LCE and Contractor Edition — and even more critical because financial values are larger:

- AI cannot certify a payment — only a qualified QS can issue an Interim or Final Certificate
- AI cannot approve a Variation Order — requires Director sign-off
- AI can draft documents and suggest measurements — marked advisory until QS signs
- AI-generated BOQ classifications must be reviewed by the QS before becoming billing records
- All AI responses are logged in the output ledger with the resources they were based on
- Audit log entries for certification steps are court-admissible design targets (Phase 15)

**Non-negotiable regardless of scale, time pressure, or commercial urgency:**

> No AI output becomes a contract fact without human certification.

---

## 8. Scale Targets

| Metric | Contractor Edition | LEOS |
|---|---|---|
| Concurrent organisations | 1 | 1–10 (programme + contractors) |
| Concurrent projects | 1–5 | 50–500 |
| Resource records | < 100,000 | 1M–50M |
| Workflow runs/day | 10–200 | 1,000–100,000 |
| Node types | 100–200 | 800–1,500 |
| Workflows | 40–70 | 300+ |
| Users | 5–200 | 500–50,000 |
| Storage | GB-scale | TB-scale |

At LEOS scale, fire-and-forget async execution is replaced with a persistent job queue (Phase 12), and the Event Bus requires a message broker (Phase 14).

---

## 9. JKR Integration Target

JKR (Jabatan Kerja Raya) is a primary government client. LEOS is designed to integrate:

| JKR System | Integration type | LEOS side |
|---|---|---|
| e-Procurement (ePerolehan) | Webhook or batch import | Contract creation on LOA issue |
| CIDB card system | REST API lookup | Worker registration validation |
| SPAN / APAD GIS | Geofence data import | SiteLocation boundary data |
| JKR standard BOQ templates | Import | BOQ Pack template library |
| BIM / IFC models | Future | SiteLocation + element mapping |

---

## 10. Phase Gate: When LEOS Development Begins

LEOS development begins only when all of the following are true:

- [ ] Contractor Edition is in production with at least one paying contractor
- [ ] Resource Engine (Phase 3) is stable and tested
- [ ] Event Bus (Phase 4) is stable with at least one consumer
- [ ] Foundation Pack (Phase 7) is installable
- [ ] AI Runtime (Phase 10) is live with real grounding
- [ ] At least one government stakeholder (JKR, CIDB, CITP) has confirmed requirements

The LEOS blueprint above is a design target, not a commitment. Architecture decisions will be revisited when the phase gate is reached.

---

## 11. What Applies Now

Even though LEOS is deferred, the following decisions made today must remain compatible with LEOS:

| Decision | Why it matters for LEOS |
|---|---|
| `lados_resources` is multi-tenant by `organisation_id` | LEOS needs multi-org resource scoping |
| State machines are declared in manifests, not hard-coded | LEOS adds many more lifecycle states |
| Every node emits declared events | LEOS event volume requires pre-declaration for routing |
| AI cannot approve or certify | This rule is permanent at any scale |
| Audit log is append-only | LEOS audit records must be court-admissible |
| `published_version_id` locks execution to a snapshot | LEOS cannot allow live-draft execution at scale |

---

*Previous: [20 Contractor Edition](20_Contractor_Edition.md) · Start: [README](README.md)*
