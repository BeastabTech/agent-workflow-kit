---
name: api-design
description: Design or extend an HTTP API so clients do not break - resource naming, request and response shapes, one error format, pagination, filtering, idempotency keys, versioning and docs from the types. Use when adding or changing endpoints, writing an API contract, or reviewing an API for another team.
---

# API design

## Shape
- Nouns and plural resources: `GET /v1/items`, `POST /v1/items`, `GET /v1/items/{id}`, `PATCH /v1/items/{id}`.
- Keep the project's existing response envelope and error format. Do not invent a second one.
- Errors: stable machine `code`, human `message`, optional `details[]` per field. Right status codes (400 validation, 401 no auth, 403 no permission, 404 not found or not yours, 409 conflict, 422 business rule, 429 rate limit).
- Lists: paginated with a capped page size; return the total or a cursor; stable sort.
- Filters and search as query params; validate and whitelist sort fields.
- Times in ISO 8601 UTC; money as integer minor units plus currency.

## Compatibility
- Additive only: new optional request fields, new response fields. Never rename or remove a field, an enum value or a route clients use. Breaking change → new version or new route, and keep the old one.
- Unknown request fields: ignore or reject consistently with the rest of the API.

## Safety
- Auth and permission on every route; data scoped to the caller.
- Writes that clients may retry accept an `Idempotency-Key` or use a natural unique key.
- Rate limits on expensive or sensitive routes.

## Docs
Types or DTOs drive the API docs (OpenAPI). Every field has a description and example; every route lists its error responses. Check the rendered docs page.
