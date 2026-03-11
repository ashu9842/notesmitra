# Tenant File Storage: Architecture & Flow Diagrams

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NOTESMITRA SYSTEM                              │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                     EXPRESS.JS SERVER                              │ │
│  │                                                                    │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │ │
│  │  │ Tenant       │  │ Tenant       │  │ Attach File Service      │ │ │
│  │  │ Resolver     │→ │ Context      │→ │ & Middleware             │ │ │
│  │  │ Middleware   │  │ Middleware   │  │ (file controls)          │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │ │
│  │         ↓                                      ↓                    │ │
│  │    Extract from       Set in             Attach service        │ │
│  │    subdomain/header   AsyncLocalStorage   to request            │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     UPLOAD FLOW                                  │  │
│  │                                                                  │  │
│  │  POST /notes/upload                                             │  │
│  │      ↓                                                           │  │
│  │  Multer (temp local file)                                       │  │
│  │      ↓                                                           │  │
│  │  uploadToCloud Middleware                                       │  │
│  │      ↓                                                           │  │
│  │  uploadToTenantFolder(filePath, tenantId, 'notes')             │  │
│  │      ↓                                                           │  │
│  │  Cloudinary API                                                 │  │
│  │      ↓                                                           │  │
│  │  Return publicId: notesmitra/{tenantId}/notes/file.pdf          │  │
│  │      ↓                                                           │  │
│  │  Save to Note model                                             │  │
│  │                                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     DOWNLOAD FLOW                                │  │
│  │                                                                  │  │
│  │  GET /notes/{noteId}/download                                   │  │
│  │      ↓                                                           │  │
│  │  findNote(noteId)                                               │  │
│  │      ↓                                                           │  │
│  │  Verify: note.tenantId == req.tenant.id  [CHECK 1]             │  │
│  │      ↓                                                           │  │
│  │  verifyFileOwnership Middleware                                 │  │
│  │      ↓                                                           │  │
│  │  fileAccessService.verifyFileAccess(publicId, tenantId)         │  │
│  │      ├─ Extract tenantId from publicId  [CHECK 2]              │  │
│  │      └─ Compare with request tenant  [CHECK 3]                 │  │
│  │      ↓                                                           │  │
│  │  generateTenantSignedUrl(publicId, tenantId, 3600)              │  │
│  │      ├─ Verify URL only for current tenant  [CHECK 4]          │  │
│  │      └─ Set 1-hour expiry                                       │  │
│  │      ↓                                                           │  │
│  │  Return signed URL + metadata                                   │  │
│  │      ↓                                                           │  │
│  │  User clicks → Cloudinary handles authentication                │  │
│  │      ↓                                                           │  │
│  │  User downloads file                                            │  │
│  │                                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
         ↓
    ┌────────────────────────────┐
    │   CLOUDINARY (Cloud)       │
    │                            │
    │   notesmitra/              │
    │   ├── tenantId1/           │
    │   │   └── notes/           │
    │   │       ├── file1.pdf    │
    │   │       └── file2.pdf    │
    │   │                        │
    │   ├── tenantId2/           │
    │   │   └── notes/           │
    │   │       └── file3.pdf    │
    │   │                        │
    │   └── tenantId3/           │
    │       └── notes/           │
    │           └── file4.pdf    │
    │                            │
    └────────────────────────────┘
```

## Data Flow Diagram

### Upload Sequence

```
┌─────────┐
│ Seller  │
│ (Tenant │
│   A)    │
└────┬────┘
     │ POST /notes/upload
     │ + PDF file
     │ + metadata
     ↓
┌─────────────────────────┐
│ tenantResolver          │
│ Extract tenant from     │
│ subdomain/header        │
│ req.tenant.id = "A"     │
└────┬────────────────────┘
     │
     ↓
┌─────────────────────────────────────┐
│ Multer Middleware                   │
│ Save to: ./uploads/temp/{uuid}.pdf  │
└────┬────────────────────────────────┘
     │
     ↓
┌─────────────────────────────────────┐
│ uploadToCloud Middleware            │
│ 1. Check: req.tenant.id exists      │
│ 2. Call uploadToTenantFolder        │
└────┬────────────────────────────────┘
     │
     ↓
┌─────────────────────────────────────┐
│ uploadToTenantFolder()              │
│                                     │
│ folder = "notesmitra/{tenantId}/notes"
│ tags = ["tenant:A", "type:notes"]   │
│                                     │
│ POST to Cloudinary API              │
└────┬────────────────────────────────┘
     │
     ↓ (HTTP to Cloudinary)
     │
┌──────────────────────────────────────┐
│ Cloudinary Cloud                     │
│                                      │
│ Creates:                             │
│ notesmitra/A/notes/economics_123.pdf │
│                                      │
│ Returns:                             │
│ publicId: notesmitra/A/notes/ec_123  │
│ url: https://res.cloudinary...       │
└────┬───────────────────────────────┘
     │
     ↓
┌────────────────────────────────────┐
│ Server Response                    │
│                                    │
│ {                                  │
│   cloudinaryFile: {                │
│     publicId: "notesmitra/A/...",  │
│     url: "https://...",            │
│     tenantId: "A",                 │ ← Including tenant
│     folderPath: "notesmitra/A/notes"│
│   }                                │
│ }                                  │
└────┬───────────────────────────────┘
     │
     ↓
┌──────────────────────────────────┐
│ Controller saves Note            │
│                                  │
│ Note.create({                    │
│   cloudinaryPublicId: "...",     │
│   cloudinaryUrl: "...",          │
│   tenantId: "A",                 │ ← Saved in DB
│   storageType: "cloudinary"      │
│ })                               │
└──────────────────────────────────┘
```

### Download Sequence

```
┌─────────┐
│ Buyer   │
│ (Tenant │
│   A)    │
└────┬────┘
     │ GET /notes/123/download
     │ Authorization: Bearer token
     │ x-tenant-id: A
     ↓
┌──────────────────────────────┐
│ protect Middleware           │
│ Verify: user authenticated   │
│ req.user._id = "user_a"      │
└────┬─────────────────────────┘
     │
     ↓
┌──────────────────────────────┐
│ verifyFileOwnership          │
│ Middleware                   │
│                              │
│ 1. Get publicId from query   │
│ 2. Get tenantId from header  │
└────┬─────────────────────────┘
     │
     ↓
┌──────────────────────────────────────┐
│ noteController.downloadNote()        │
│                                      │
│ const note = Note.findById(id)       │
│                                      │
│ CHECK 1:                             │
│ if (note.tenantId != "A") {          │
│   throw "Note not in your tenant"    │
│ }                                    │
│                                      │
│ CHECK: Purchase verification         │
│ const purchase = Purchase.findOne({  │
│   buyerId, noteId, status: "completed"
│ })                                   │
│ if (!purchase) throw "Buy first"     │
└────┬─────────────────────────────────┘
     │
     ↓
┌────────────────────────────────────────────┐
│ fileAccessService.verifyFileAccess()       │
│                                            │
│ publicId: "notesmitra/A/notes/economics"  │
│ tenantId: "A"                             │
│                                            │
│ CHECK 2:                                   │
│ extracted = extract("notesmitra/A/...")   │
│ extracted = "A"                            │
│                                            │
│ CHECK 3:                                   │
│ if (extracted != "A") {                    │
│   throw "Cross-tenant access"              │
│ }                                          │
│                                            │
│ return { verified: true, tenantId: "A" }   │
└────┬───────────────────────────────────────┘
     │
     ↓
┌─────────────────────────────────────────┐
│ fileAccessService.generateTenantSignedUrl
│                                         │
│ Cloudinary signed URL generation        │
│                                         │
│ URL params:                             │
│ - publicId: "notesmitra/A/notes/..."   │
│ - sign_url: true                        │
│ - expires_at: now + 3600s               │
│ - resource_type: "auto"                 │
│ - type: "authenticated"                 │
│                                         │
│ CHECK 4:                                │
│ Verify tenant in URL generation         │
│ Only user "A" can use this URL           │
└────┬────────────────────────────────────┘
     │
     ↓
┌──────────────────────────────────┐
│ Server Response                  │
│                                  │
│ {                                │
│   downloadUrl: "https://res...   │
│     ?signed_request=...          │
│     &expires_at=...",            │
│   expiresAt: "2024-02-24 11:30", │
│   expiresIn: 3600,               │
│   tenantVerified: true           │
│ }                                │
└────┬─────────────────────────────┘
     │
     ↓
┌──────────────────────────┐
│ Browser/Client           │
│                          │
│ Click download link      │
│ GET https://res...?...   │ ← Signed URL
└────┬─────────────────────┘
     │
     ↓ (HTTP to Cloudinary)
     │
┌────────────────────────────────────────┐
│ Cloudinary CDN                         │
│                                        │
│ Verify:                                │
│ 1. Signature valid?                    │
│ 2. Not expired?                        │
│ 3. Access authenticated?               │
│                                        │
│ All checks pass ✓                      │
│ Stream file to browser                 │
└────┬──────────────────────────────────┘
     │
     ↓
┌──────────────────────────────────┐
│ Browser                          │
│ Receives file: economics_123.pdf │
│ Save to Downloads                │
└──────────────────────────────────┘
```

### Cross-Tenant Access Attempt (Blocked)

```
┌────────┐
│ Hacker │
│(Tenant │
│  B)    │
└────┬───┘
     │ GET /notes/123/download
     │ Authorization: Bearer token_B
     │ x-tenant-id: B
     │ Strategy: Use publicId from Tenant A
     ↓
┌──────────────────────────────────┐
│ protect Middleware               │
│ ✓ User authenticated (Tenant B)  │
└────┬─────────────────────────────┘
     │
     ↓
┌────────────────────────────────────────────────┐
│ noteController.downloadNote()                  │
│                                                │
│ const note = Note.findById(id) // Tenant A note
│                                                │
│ ✗ CHECK 1 FAILED:                              │
│ if (note.tenantId != "B") {                    │
│   throw "Note not in your tenant"              │
│ }                                              │
│                                                │
│ Status: 404                                    │
│ Appears as "not found" to prevent info leak    │
│                                                │
│ Log: 🚨 Cross-tenant note access attempted    │
│      requestTenant: B                          │
│      noteTenant: A                             │
│      timestamp: 2024-02-24T10:45:00Z           │
└────────────────────────────────────────────────┘
```

## Security Verification Flow

```
REQUEST ARRIVES
    ↓
┌─────────────────────────────┐
│ CHECK 1: Database Level     │
│ note.tenantId == req.tenant │   ← Must match
│                             │
│ FAIL → 404 "Not found"      │   ← Info leak prevented
│ PASS → Continue             │
└────────────┬────────────────┘
             │
             ↓
┌─────────────────────────────┐
│ CHECK 2: Public ID Parsing  │
│ Extract from publicId format│
│ notesmitra/{ID}/notes/...   │
│                             │
│ FAIL → 400 "Invalid format" │   ← Catch early
│ PASS → Extract ID           │
└────────────┬────────────────┘
             │
             ↓
┌─────────────────────────────┐
│ CHECK 3: Tenant Comparison  │
│ extracted_id == req.tenant  │   ← Core verification
│                             │
│ FAIL → 403 "Access denied"  │   ← Log security event
│ PASS → Generate signed URL  │
└────────────┬────────────────┘
             │
             ↓
┌─────────────────────────────┐
│ CHECK 4: Signed URL Binding │
│ Include tenant context in   │
│ URL generation              │
│                             │
│ Only this tenant can use    │
│ Time-limited (1 hour)       │
│ Cryptographically signed    │
└─────────────────────────────┘
         ↓
    ✓ SECURE
```

## Tenant Isolation Visualization

```
BEFORE (No Tenant Isolation)
────────────────────────────

Cloudinary
└── notesmitra/
    └── notes/
        ├── file1.pdf     ← Any user can find
        ├── file2.pdf     ← Any user can find
        ├── file3.pdf     ← Any user can find
        └── file4.pdf     ← Any user can find

Risk: Without database checks, files could be guessed


AFTER (Tenant Isolation)
────────────────────────

Cloudinary
└── notesmitra/
    ├── 507f1f77bcf86cd799439010/  ← Tenant A
    │   └── notes/
    │       ├── file1.pdf  ← Only Tenant A users
    │       └── file2.pdf
    │
    ├── 507f1f77bcf86cd799439011/  ← Tenant B
    │   └── notes/
    │       └── file3.pdf  ← Only Tenant B users
    │
    └── 507f1f77bcf86cd799439012/  ← Tenant C
        └── notes/
            └── file4.pdf  ← Only Tenant C users

Benefit:
✓ Folder structure enforces isolation
✓ Easy to verify tenant ownership
✓ Audit trails per tenant
✓ Simple backup/restore per tenant
```

## Middleware Execution Order

```
HTTP REQUEST
    ↓
┌─────────────────────────────────────┐
│ 1. tenantResolverMiddleware         │
│    Extract tenant from:             │
│    - Subdomain: college.app.com     │
│    - Header: x-tenant-id            │
│    Result: req.tenant = {...}       │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ 2. tenantContextMiddleware          │
│    Set AsyncLocalStorage            │
│    getTenantContext() = req.tenant   │
│    ALL queries now filtered by       │
│    tenantId automatically            │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ 3. attachFileService                │
│    req.fileAccessService =          │
│      fileAccessService instance     │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ 4. logFileAccess                    │
│    Intercept res.json()             │
│    Log all file operations          │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ 5. validatePublicIdFormat           │
│    Check all publicIds:             │
│    - Format: notesmitra/{id}/...    │
│    - Tenant match: {id} == tenant   │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ 6. express.json()                   │
│    Parse JSON bodies                │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ 7. Route Handlers                   │
│    Now safe to use:                 │
│    - req.tenant (set by step 1)     │
│    - Tenant context (step 2)        │
│    - File service (step 3)          │
│    - Validated IDs (step 5)         │
└─────────────────────────────────────┘
```

## Error Flow Diagram

```
FILE ACCESS REQUEST
    ↓
┌─────────────────────┐
│ Database Check      │
└────┬────────────────┘
     │
     ├─→ FAIL: 404 "Not found"
     │   (Also could be: not exists, deleted, etc.)
     │
     └─→ PASS
         ↓
    ┌─────────────────────┐
    │ Public ID Format    │
    └────┬────────────────┘
         │
         ├─→ FAIL: 400 "Invalid format"
         │
         └─→ PASS
             ↓
         ┌──────────────────────┐
         │ Tenant Comparison    │
         └────┬─────────────────┘
              │
              ├─→ FAIL: 403 "Access denied"
              │         (Also log alert)
              │
              └─→ PASS
                  ↓
              ┌──────────────────────┐
              │ Purchase Check       │
              └────┬─────────────────┘
                   │
                   ├─→ FAIL: 403 "Buy first"
                   │
                   └─→ PASS
                       ↓
                   ┌──────────────────────┐
                   │ Generate Signed URL  │
                   └────┬─────────────────┘
                        │
                        └─→ SUCCESS
                            ↓
                        ┌──────────────────┐
                        │ Return URL       │
                        └──────────────────┘
```

## Security Layers Summary

```
LAYER 1: UPLOAD
├─ Tenant from request context
├─ Create: notesmitra/{tenantId}/notes/
├─ Tag files with tenant ID
└─ Return publicId with tenant

LAYER 2: STORAGE
├─ Folder structure enforces isolation
├─ Only tenant users see their path
├─ Files in other folders not accessible
└─ Cloudinary handles auth

LAYER 3: DATABASE
├─ Note model includes tenantId
├─ Query filters by tenant automatically
├─ Cross-tenant noteIds fail DB check
└─ Can't bypass database layer

LAYER 4: DOWNLOAD
├─ Extract tenantId from publicId
├─ Compare with request tenant
├─ Generate tenant-scoped signed URL
├─ URL includes tenant context
└─ Cloudinary validates auth

LAYER 5: AUDIT
├─ Log all access attempts
├─ Track failed attempts
├─ Alert on cross-tenant tries
└─ Traceable for forensics
```

---

These diagrams show:
1. **System Architecture**: How components connect
2. **Upload Flow**: File path creation with tenant context
3. **Download Flow**: Multi-layer verification
4. **Cross-Tenant Attack**: How it's prevented
5. **Security Layers**: Defense in depth
