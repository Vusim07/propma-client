# Email Workflow Processor

> **DEPRECATED**: This function is deprecated and will be removed in a future version.
> The email workflow system is being replaced with a new inbox system using @n.agentamara.com addresses.
>
> ## Migration Guide
>
> - New Implementation: New Inbox feature with dedicated email addresses
> - Key Changes:
>   - No more Gmail integration required
>   - Users get a dedicated @n.agentamara.com email address
>   - Simplified email handling for listing site inquiries
> - Contact: [Your team contact]

This Supabase Edge Function processes email workflows by checking for new emails that match workflow filters and generating AI-powered responses using Amara AI.

## Features

- Automatically checks new emails for agents with active workflows
- Matches emails against configured workflow filters
- Uses Amara AI to generate personalized responses with application links
- Logs all workflow activity for monitoring
- Supports both Gmail and Outlook email providers

## Deployment

Deploy this function to your Supabase project using the Supabase CLI:

```bash
supabase functions deploy email-workflow-processor --project-ref <your-project-ref>
```

## Usage

### Process All Agents' Workflows

To process workflows for all agents:

```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/email-workflow-processor \
  -H "Authorization: Bearer <SUPABASE_AUTH_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Process a Specific Agent's Workflows

To process workflows for a specific agent:

```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/email-workflow-processor \
  -H "Authorization: Bearer <SUPABASE_AUTH_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "your-agent-id", "provider": "gmail"}'
```

You can specify `"provider": "outlook"` to use Outlook instead of Gmail.

## Scheduling

To run the workflow processor automatically, set up a cron job or scheduler to call this function regularly. For example, to check emails every 5 minutes:

### Using GitHub Actions

```yaml
name: Process Email Workflows

on:
  schedule:
    - cron: '*/5 * * * *' # Every 5 minutes

jobs:
  process-workflows:
    runs-on: ubuntu-latest
    steps:
      - name: Process all workflows
        run: |
          curl -X POST https://<your-project-ref>.supabase.co/functions/v1/email-workflow-processor \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

## Integration with Amara AI

This function includes a placeholder for integrating with the Amara AI service. In a production environment, you should:

1. Implement the `processEmailWithAmaraAI` function to call your Amara AI endpoint
2. Update the interface to match your specific Amara AI response format
3. Configure proper error handling and retry logic

## Notes

- For development, the function uses mock email data
- In production, you'll need to implement the email provider integration
- Make sure the Supabase service role used has appropriate permissions
