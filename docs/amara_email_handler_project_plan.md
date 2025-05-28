# Project Plan: AI Email Handler for Amara using AWS SES & Supabase Edge Functions

## Overview

The goal of this implementation is to create a scalable, automated email handling system for **Amara** (agentamara.com) that enables:

- Programmatic generation of unique email addresses per team/user (e.g., `firstname-fc780ach08s08@n.agentamara.com`)
- Receiving and analyzing inbound emails sent to these addresses
- Sending AI-generated responses
- Viewing a log of all email correspondence in an "Inbox" UI
- Monitoring errors and bounces to maintain reliability

This system leverages **AWS SES** for email delivery and receipt, **Supabase Edge Functions** for processing, and a **Vite + React** frontend for UI.

---

## Tech Stack

- **Frontend**: Vite + React
- **Backend**: Supabase Edge Functions (TypeScript)
- **Email Service**: AWS SES (Amazon Simple Email Service)
- **Auth & Data**: Supabase (PostgreSQL + Auth)
- **DNS**: Cloudflare

---

## Implementation Checklist

### ✅ AWS SES Setup

- [x] Domain verified: `n.agentamara.com`
- [x] SPF + DKIM DNS records configured via Cloudflare
- [x] Production SES access granted
- [x] MAIL FROM domain configured (optional): `bounce.n.agentamara.com`
- [] Receipt Rule Set created to invoke Lambda (eventually routed to Supabase)

### ⛏ Supabase Setup

- [ ] Supabase tables for Amara Inbox (`emails`, `threads`)
- [ ] Update users table with amara_email_username column
- [ ] Supabase Edge Function to receive and parse email from SES webhook (via API Gateway proxy if needed)
- [ ] Supabase storage setup for storing raw email contents or attachments

### 🧠 Email Processing

- [ ] Parse incoming emails using/update existing functions/amara-ai (for content analysis)
- [ ] Generate response using Amara’s AI logic
- [ ] Send email via SES from team-specific email addresses (using AWS SDK in Edge Function)
- [ ] Log outgoing emails to Supabase `emails` table

### 🧾 Frontend Inbox UI

- [x] Inbox page listing emails (sent and received)
- [ ] Filter by team, date, status
- [x] Email detail view (including analysis / response)
- [ ] Retry/Resend options for failed messages

### 🛡 Monitoring & Error Handling

- [ ] Log delivery and bounce events from SES (via SNS or direct API call)
- [ ] Use Logflare or Supabase logs for function error tracking
- [ ] Implement retry logic for failed deliveries

### 📦 DevOps / CI

- [x] Create `.env` variables for AWS SES keys and domains
- [ ] Add secure secrets to Supabase Edge runtime
- [ ] Document API usage & SES quotas

---

## Notes

- **Subdomain Usage**: All user-generated email addresses are under `n.agentamara.com`
- **Fallback Routing**: Unmatched SES receipts go to a default handler
- **AI Response Timing**: Ensure latency between receipt and response is acceptable (use async queue if needed)

---

## Final Goal

Users should be able to:

1. Use their unique Amara email (e.g., `team-alpha@n.agentamara.com`) on contact forms
2. Have inbound messages parsed, responded to, and logged automatically
3. View all correspondence in an intuitive UI

This will streamline tenant communications and centralize audit trails for Amara clients.
