# Lados V4 Pack Bundle Format

Phase 18 accepts `.ladosPack` files through the Marketplace Publish Pack tab and `POST /api/v1/registry/packs/submit`.

## Bundle Shape

A `.ladosPack` is a zip file with a `manifest.json` at the root or inside one top-level folder.

```text
my-pack-1.0.0.ladosPack
├── manifest.json
├── nodes/
│   └── example-node.js
├── README.md
└── CHANGELOG.md
```

The Phase 18 installer reads and registers only the manifest. Uploaded executor code is stored with the bundle but is not dynamically executed yet.

## manifest.json

```json
{
  "id": "vendor.invoice-pack",
  "displayName": "Invoice Pack",
  "version": "1.0.0",
  "author": "Vendor Name",
  "description": "Invoice workflow nodes for Lados.",
  "icon": "package",
  "color": "#2563EB",
  "tags": ["finance", "invoice"],
  "dependencies": [],
  "nodes": [
    {
      "type": "vendor.invoice-pack.read_invoice",
      "name": "Read Invoice",
      "description": "Reads invoice metadata.",
      "category": "registry",
      "inputs": [],
      "outputs": []
    }
  ]
}
```

Required fields: `id`, `version`, and at least one `nodes[].type`.

Rules:
- Pack IDs and node types must be namespaced, for example `vendor.invoice-pack`.
- Versions must be semver-like, for example `1.0.0`.
- Registry packs cannot register `approval.decide`.
- Maximum node declarations per bundle: 250.

## Registry Lifecycle

1. Author uploads a `.ladosPack` bundle.
2. API validates `manifest.json`, computes SHA-256, stores the bundle in private Supabase Storage bucket `lados-pack-bundles`.
3. API creates a `registry_packs` row with `is_verified = false`.
4. Owner/admin reviewer verifies the listing with `PATCH /registry/packs/:listingId/verify`.
5. Organizations install verified listings from the Marketplace Browse Registry tab.

## Execution Boundary

Phase 18 install upserts `packs` and `registered_nodes` from the manifest. It does not load uploaded JavaScript executors into the running API process. Dynamic third-party execution should wait for a sandboxed verifier/runtime boundary.
