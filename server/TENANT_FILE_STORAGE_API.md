# Tenant File Storage API Reference

Complete API documentation for tenant-scoped file operations with examples.

## Base URL
```
http://localhost:5000/api
```

## Authentication

All endpoints require Bearer token:
```
Authorization: Bearer <jwt_token>
```

And tenant context:
```
x-tenant-id: <tenantId>
```

---

## Endpoints

### 1. Upload File

Upload a PDF file to tenant-scoped folder.

**Endpoint:** `POST /notes/upload`

**Authentication:** Required (Seller role)

**Tenant Context:** Required

**Headers:**
```
Authorization: Bearer <token>
x-tenant-id: <tenantId>
Content-Type: multipart/form-data
```

**Body (Form Data):**
```
file: <PDF file>
title: "Economics Notes"
description: "Chapter 1-3 comprehensive notes"
subject: "Economics"
semester: "Fall 2024"
price: 5.99
pages: 25
```

**cURL Example:**
```bash
curl -X POST http://localhost:5000/api/notes/upload \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "x-tenant-id: 507f1f77bcf86cd799439010" \
  -F "file=@economics_notes.pdf" \
  -F "title=Economics Notes" \
  -F "description=Comprehensive notes for Economics 101" \
  -F "subject=Economics" \
  -F "semester=Fall 2024" \
  -F "price=5.99" \
  -F "pages=25"
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Note uploaded successfully",
  "note": {
    "_id": "123abc456def",
    "title": "Economics Notes",
    "description": "Comprehensive notes...",
    "subject": "Economics",
    "semester": "Fall 2024",
    "price": 5.99,
    "pages": 25,
    "cloudinaryPublicId": "notesmitra/507f1f77bcf86cd799439010/notes/economics_abc123.pdf",
    "cloudinaryUrl": "https://res.cloudinary.com/....",
    "storageType": "cloudinary",
    "status": "pending_review",
    "tenantId": "507f1f77bcf86cd799439010",
    "uploadedAt": "2024-02-24T10:30:00Z",
    "qualityChecks": {
      "pageCount": true,
      "fileSize": true,
      "fileType": true,
      "hasTitle": true,
      "hasDescription": true
    }
  }
}
```

**Key Response Fields:**
- `note.cloudinaryPublicId`: Tenant-scoped file reference (format: `notesmitra/{tenantId}/notes/...`)
- `note.tenantId`: Confirms upload to user's tenant
- `note.storageType`: "cloudinary" (authenticated cloud storage)

**Error Responses:**

```json
{
  "success": false,
  "error": "Only PDF files are allowed"
}
```

```json
{
  "success": false,
  "error": "File size too large. Maximum size is 20MB"
}
```

```json
{
  "success": false,
  "error": "Upload limit exceeded for your plan. Your free plan allows 50 uploads."
}
```

---

### 2. Download File

Download a note with tenant-verified signed URL.

**Endpoint:** `GET /notes/:noteId/download`

**Authentication:** Required (Must have purchased)

**Tenant Context:** Required

**Headers:**
```
Authorization: Bearer <token>
x-tenant-id: <tenantId>
```

**URL Parameters:**
- `noteId`: MongoDB ID of the note

**cURL Example:**
```bash
curl -X GET http://localhost:5000/api/notes/507f1f77bcf86cd799439011/download \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "x-tenant-id: 507f1f77bcf86cd799439010"
```

**Success Response (200):**
```json
{
  "success": true,
  "downloadUrl": "https://res.cloudinary.com/....?signature=...&expires=...",
  "fileName": "economics_notes.pdf",
  "fileSize": 2048576,
  "expiresIn": 3600,
  "expiresAt": "2024-02-24T11:30:00Z",
  "tenantVerified": true,
  "message": "Tenant-scoped download URL generated successfully"
}
```

**Response Fields:**
- `downloadUrl`: Signed, time-limited download link (1 hour)
- `expiresIn`: Seconds until URL expires
- `expiresAt`: Timestamp when URL becomes invalid
- `tenantVerified`: Confirms URL is restricted to your tenant

**Error Responses:**

```json
{
  "success": false,
  "error": "Note not found in your tenant"
}
```
**Status:** 404 (Cross-tenant access attempt)

```json
{
  "success": false,
  "error": "You must purchase this note before downloading"
}
```
**Status:** 403

```json
{
  "success": false,
  "error": "Failed to generate download URL"
}
```
**Status:** 500

---

### 3. Get Note Details

Get note metadata including storage information.

**Endpoint:** `GET /notes/:noteId`

**Authentication:** Optional (Less info if not authenticated)

**Headers:**
```
Authorization: Bearer <token>
```

**cURL Example:**
```bash
curl -X GET http://localhost:5000/api/notes/507f1f77bcf86cd799439011 \
  -H "x-tenant-id: 507f1f77bcf86cd799439010"
```

**Success Response (200):**
```json
{
  "success": true,
  "note": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Economics Notes",
    "description": "...",
    "price": 5.99,
    "rating": 4.5,
    "downloads": 150,
    "fileSize": 2048576,
    "status": "approved",
    "cloudinaryPublicId": "notesmitra/507f1f77bcf86cd799439010/notes/...",
    "cloudinaryUrl": "https://res.cloudinary.com/...",
    "storageType": "cloudinary",
    "tenantId": "507f1f77bcf86cd799439010",
    "sellerId": {
      "_id": "507f1f...",
      "name": "John Doe",
      "email": "john@example.com"
    }
  }
}
```

---

### 4. List Notes (Seller's Notes)

List all notes uploaded by seller.

**Endpoint:** `GET /notes/my-uploads`

**Authentication:** Required (Seller role)

**Tenant Context:** Required

**Headers:**
```
Authorization: Bearer <token>
x-tenant-id: <tenantId>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 10)
- `status` (optional): Filter by status (pending_review, approved, rejected, failed_quality_check)

**cURL Example:**
```bash
curl -X GET "http://localhost:5000/api/notes/my-uploads?page=1&limit=10&status=approved" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "x-tenant-id: 507f1f77bcf86cd799439010"
```

**Success Response (200):**
```json
{
  "success": true,
  "notes": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "title": "Economics Notes",
      "status": "approved",
      "cloudinaryPublicId": "notesmitra/507f1f77bcf86cd799439010/notes/...",
      "downloads": 150,
      "uploadedAt": "2024-02-20T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

---

### 5. Delete Note

Delete a note and its file from tenant storage.

**Endpoint:** `DELETE /notes/:noteId`

**Authentication:** Required (Seller or Admin)

**Tenant Context:** Required

**Headers:**
```
Authorization: Bearer <token>
x-tenant-id: <tenantId>
```

**URL Parameters:**
- `noteId`: MongoDB ID of the note

**cURL Example:**
```bash
curl -X DELETE http://localhost:5000/api/notes/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "x-tenant-id: 507f1f77bcf86cd799439010"
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Note deleted successfully",
  "deletedNote": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Economics Notes",
    "cloudinaryPublicId": "notesmitra/507f1f77bcf86cd799439010/notes/...",
    "deletedAt": "2024-02-24T12:00:00Z"
  }
}
```

**Error Responses:**

```json
{
  "success": false,
  "error": "Note not found in your tenant"
}
```

```json
{
  "success": false,
  "error": "You do not have permission to delete this note"
}
```

---

## Frontend Integration Examples

### React Example: Upload Note

```javascript
async function uploadNote(file, noteData) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', noteData.title);
  formData.append('description', noteData.description);
  formData.append('subject', noteData.subject);
  formData.append('semester', noteData.semester);
  formData.append('price', noteData.price);
  formData.append('pages', noteData.pages);

  try {
    const response = await fetch('http://localhost:5000/api/notes/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId
      },
      body: formData
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✓ Note uploaded:', data.note.cloudinaryPublicId);
      console.log('✓ Folder:', data.note.folderPath);
      return data.note;
    } else {
      console.error('Upload failed:', data.error);
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}
```

### React Example: Download Note

```javascript
async function downloadNote(noteId) {
  try {
    const response = await fetch(
      `http://localhost:5000/api/notes/${noteId}/download`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-tenant-id': tenantId
        }
      }
    );

    const data = await response.json();

    if (data.success) {
      console.log('Download URL expires at:', data.expiresAt);
      
      // Create temporary link and trigger download
      const downloadLink = document.createElement('a');
      downloadLink.href = data.downloadUrl;
      downloadLink.download = data.fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Alert user about expiration
      const minutesLeft = Math.floor(data.expiresIn / 60);
      alert(`Download link expires in ${minutesLeft} minutes`);
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('Download error:', error);
    alert('Failed to download note: ' + error.message);
  }
}
```

### JavaScript: Check File Ownership Before Download

```javascript
async function verifyCanDownload(noteId) {
  try {
    // 1. Get note details
    const noteResponse = await fetch(`/api/notes/${noteId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId
      }
    });
    const noteData = await noteResponse.json();

    // 2. Check if user purchased
    const purchaseResponse = await fetch(`/api/purchases/check?noteId=${noteId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId
      }
    });
    const purchaseData = await purchaseResponse.json();

    if (!purchaseData.purchased) {
      alert('Please purchase this note first');
      return false;
    }

    // 3. Verify tenant ownership
    if (noteData.note.tenantId !== tenantId) {
      alert('Note not found in your tenant');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Verification error:', error);
    return false;
  }
}
```

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (upload successful) |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (no token) |
| 403 | Forbidden (cross-tenant or no purchase) |
| 404 | Not found (note deleted or cross-tenant access) |
| 500 | Server error |

---

## Error Codes

| Error | Meaning | Solution |
|-------|---------|----------|
| "Tenant not found in request" | Missing tenant context | Include `x-tenant-id` header |
| "Tenant ID not found" | Server misconfiguration | Check tenantResolver middleware |
| "Invalid file reference format" | Corrupted or fake publicId | Use publicId from upload response |
| "Note not found in your tenant" | Cross-tenant access attempt | Can't access other tenant's notes |
| "You must purchase this note" | Not a buyer of note | Purchase first before download |
| "Upload limit exceeded" | Plan limit reached | Upgrade plan for more uploads |
| "File size too large" | PDF > 20MB | Compress file before uploading |

---

## Security Considerations

### ✅ Protected

- **Cross-tenant file access**: Blocked at API level
- **Download URLs**: Time-limited and signed
- **File ownership**: Verified before serving
- **Audit logging**: All access logged
- **Public IDs**: Include tenant ID for verification

### ⚠️ Developer Responsibility

- Store tokens securely (not in localStorage)
- Use HTTPS in production only
- Validate file size on client before upload
- Handle URL expiration gracefully
- Refresh download links as needed

---

## Rate Limiting

Currently no rate limits. Recommended limits:

- Uploads: 10 per hour per tenant
- Downloads: 100 per hour per user
- File size: 20MB max

---

## Rate Limit Headers (When Implemented)

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1708866060
```

---

## Workflow Example: Complete Flow

### 1. User (Seller) Uploads File

```
POST /api/notes/upload
Content: file + metadata
Result: note._id, publicId (notesmitra/{tenantId}/notes/file.pdf)
```

### 2. Buyer Purchases Note

```
POST /api/purchases
Content: noteId
Result: Purchase created, access granted
```

### 3. Buyer Download Note

```
GET /api/notes/{noteId}/download
Result: Signed URL (expires in 1 hour)
```

### 4. Buyer Uses Signed URL

```
GET <signed_url>
Result: File downloaded from Cloudinary
```

### 5. Signed URL Expires

```
GET <expired_url>
Result: 403 Forbidden (URL expired)
Buyer must request new download URL from API
```

---

## FAQs

### Q: How long are download URLs valid?
**A:** Default 1 hour. User must request new URL after expiry.

### Q: Can I share a download URL with someone else?
**A:** Not recommended. URL is tenant-scoped and limited.

### Q: What happens if someone uses my download URL?
**A:** Cloudinary authenticates based on public ID (which includes your tenant ID). Other tenants cannot use it.

### Q: Can I upload files for other tenants?
**A:** No. Files always upload to your current tenant.

### Q: What if I need longer download links?
**A:** Contact support. Default is 1 hour. Can be configured per-tenant.

### Q: Are files encrypted?
**A:** Files are stored in authenticated Cloudinary folders. In transit via HTTPS. At rest by Cloudinary.

---

## Testing with Postman

### Environment Variables Setup

```json
{
  "base_url": "http://localhost:5000/api",
  "token": "...",
  "tenant_id": "507f1f77bcf86cd799439010",
  "note_id": "..."
}
```

### Upload Request

- **Method:** POST
- **URL:** `{{base_url}}/notes/upload`
- **Headers:** Authorization, x-tenant-id
- **Body:** form-data (file + metadata)

### Download Request

- **Method:** GET
- **URL:** `{{base_url}}/notes/{{note_id}}/download`
- **Headers:** Authorization, x-tenant-id

### Store Response Variables

```javascript
pm.environment.set("download_url", pm.response.json().downloadUrl);
pm.environment.set("note_id", pm.response.json().note._id);
```

---

## Troubleshooting

### Upload Returns "Tenant not found"
- Check `x-tenant-id` header is present
- Verify token is valid and authenticated
- Ensure tenantResolver middleware is first in chain

### Download Returns "Note not found in your tenant"
- Verify you're using correct noteId
- Check `x-tenant-id` matches your tenant
- Confirm note belongs to your tenant

### Signed URL Shows 403 Forbidden
- URL may have expired (valid 1 hour only)
- Request new download URL from API
- Check URL wasn't modified

### Cross-Tenant Access Attempt
- You cannot access files from other tenants
- Each tenant has isolated file storage
- This is secure by design

---

## Related Endpoints

Other related APIs (reference):

- `POST /api/purchases` - Purchase a note
- `GET /api/purchases/my-purchases` - List purchased notes
- `POST /api/wallet/recharge` - Add wallet funds
- `GET /api/notes` - Search marketplace notes

---

## Updates & Changelog

### v1.0.0 (Current)
- Tenant-scoped file uploads
- Cross-tenant access prevention
- Signed URL generation
- Access logging
- File deletion with verification

### Planned
- Batch file operations
- File sharing with temporary links
- Storage per-tenant limits
- Auto file archival
