# API Authentication Documentation

## Overview

This API implements a two-tier API key authentication system with Redis-backed rate limiting to secure protected endpoints.

## Authentication Types

### Internal Keys
Designed for first-party applications with origin-based validation. Requests must originate from pre-approved domains with configurable high-volume rate limits.

### External Keys
Intended for third-party integrations. No origin restrictions apply. Rate limits are configurable per key based on service tier requirements.

## Key Generation

Initialize database services:
```bash
npm run db-resume
```

Generate keys via Docker container:
```bash
# Internal key with origin whitelist
docker compose -f db/docker-compose.yml exec express npm run keygen generate "Application Name" internal -- --origins https://domain.com

# External key with rate limits
docker compose -f db/docker-compose.yml exec express npm run keygen generate "Client Name" external -- --rate-minute 100 --rate-day 50000
```

**Security Note:** API keys are displayed once at generation time and cannot be retrieved subsequently.

## Authentication Header

Include the API key in the Authorization header using Bearer token format:

```
Authorization: Bearer {API_KEY}
```

Example:
```bash
curl -H "Authorization: Bearer abc123..." \
  https://api.example.com/node/{address}/bonus-score-history/
```

## Rate Limiting

Rate limit information is provided in response headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit-Minute` | Maximum requests per minute |
| `X-RateLimit-Remaining-Minute` | Remaining requests this minute |
| `X-RateLimit-Limit-Day` | Maximum requests per day |
| `X-RateLimit-Remaining-Day` | Remaining requests today |

When rate limits are exceeded, the API returns HTTP 429 with a `Retry-After` header indicating the wait period in seconds.

## Key Management

List active keys:
```bash
docker compose -f db/docker-compose.yml exec express npm run keygen list
```

Modify key status:
```bash
docker compose -f db/docker-compose.yml exec express npm run keygen {enable|disable|delete} <key_id>
```

## Error Responses

| Status Code | Meaning | Resolution |
|-------------|---------|------------|
| 401 | Invalid or missing API key | Verify key is correct and enabled |
| 403 | Origin validation failed | Confirm request origin matches whitelist |
| 429 | Rate limit exceeded | Wait for period specified in Retry-After header |

## Technical Implementation

- **Storage:** PostgreSQL with bcrypt-hashed keys
- **Rate Limiting:** Redis (with in-memory fallback)
- **Validation:** Origin header verification for internal keys
- **Migration:** Auto-applied via `003-add-api-keys-table.sql`

---
