Place real prescription fixtures here for regression testing.

How to use:
1. Add de-identified image/PDF files in this folder (`.png`, `.jpg`, `.jpeg`, `.webp`, `.pdf`).
2. Create `manifest.json` in the same folder using the schema below.
3. Run:
   - `npm run test:scan-regression` (from `backend/`)

`manifest.json` example:
```json
[
  {
    "id": "real-001",
    "file": "sample-prescription-1.jpg",
    "expected": ["Paracetamol", "Amoxicillin"],
    "minRecall": 0.5
  },
  {
    "id": "real-002",
    "file": "sample-prescription-2.pdf",
    "expected": ["Metformin", "Atorvastatin"]
  }
]
```

Notes:
- Keep fixtures de-identified (no patient PII/PHI).
- `minRecall` defaults to `0.5` if omitted.
- Real fixtures are optional; synthetic fixtures are always tested.
