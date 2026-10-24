**<Feature> — ready on <environment> (part 1 of N)**

**What changed:** <two lines>

**Flow**
1. <user action> → `POST <base URL>/v1/<path>`
2. ...

**`POST /v1/<path>`** — <what it does>
Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`

```bash
curl -X POST "<base URL>/v1/<path>" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"name":"TEST_item"}'
```

Request:
```jsonc
{
  "name": "TEST_item",   // string, required, 1-100 chars
  "note": "optional"     // string, optional
}
```

Response 201:
```jsonc
{
  "id": "6b1f…",         // string (uuid)
  "status": "ACTIVE"     // "ACTIVE" | "PAUSED"
}
```

Errors:
| Status | Code | When | UI should |
|---|---|---|---|
| 400 | VALIDATION_ERROR | bad input | show field errors |
| 403 | FORBIDDEN | no permission | hide the action |

**Types**
```ts
export interface Item { id: string; status: 'ACTIVE' | 'PAUSED' }
```

**Not live yet:** <list>

**More:** `<base URL>/docs`
