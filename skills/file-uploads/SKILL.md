---
name: file-uploads
description: Handle user file uploads and object storage safely - one storage service for the whole app, private buckets with signed URLs, size and type checks by content not name, safe file names, image resizing, virus scanning when needed, metadata in the database and cleanup. Use when adding uploads, avatars, attachments, media, exports or anything stored in S3, GCS, R2 or similar.
---

# File uploads and storage

## Design
- **One storage module** in the shared code (`upload`, `getSignedUrl`, `delete`, `copyFromUrl`). Features call it; nobody talks to the bucket SDK directly. Write which service is used for what in `docs/context/`.
- **Private by default.** Serve files through short-lived signed URLs (minutes) or an auth-checked proxy. Public buckets only for truly public assets.
- **Direct-to-bucket uploads** (presigned PUT/POST) for large files; the server issues the URL after an auth check and records the pending object.
- **Database row per file**: id, owner/tenant, storage key, content type, size, checksum, created/deleted timestamps. Never trust a client-sent URL or key.

## Validation
- Limit size on the server and in the presigned policy.
- Check the type from the content (magic bytes), not the extension or the client's `Content-Type`. Allow-list types.
- Generate the storage key yourself (`<tenant>/<entity>/<uuid>.<ext>`); never use the user's file name in the path. Keep the original name only as metadata, sanitised.
- Images: strip metadata (location), resize to the sizes the UI needs, convert to a modern format; never render user SVG inline.
- Scan files that other users download (documents, archives) if the risk warrants it.

## Lifecycle
- Soft-delete the row, delete the object in a background job; lifecycle rules for temporary uploads.
- Copy external media into your own bucket instead of hot-linking (with a size limit and a timeout, and only from allowed hosts to avoid SSRF).
- Tests: wrong type renamed to an allowed extension, oversize file, another user's file id, expired URL.
