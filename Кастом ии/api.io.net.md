# API Documentation: io.net

## Test Request
```bash
# Set environment variables from .env
export $(grep -v '^#' "/workspaces/TEST/Кастом ии/.env" | xargs)

# Execute request
curl -X GET "https://api.intelligence.io.solutions/api/v1/models" \
  -H "Authorization: Bearer $IOINTELLIGENCE_API_KEY"
```
