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

## Implementation Phases

### Phase 1: Core Infrastructure & Database ✅

- [x] AWS SES Setup

  - [x] Domain verified: `n.agentamara.com`
  - [x] SPF + DKIM DNS records configured via Cloudflare
  - [x] Production SES access granted
  - [x] MAIL FROM domain configured: `bounce.n.agentamara.com`
  - [x] Receipt Rule Set for webhook routing

- [x] Supabase Database Setup
  - [x] Email tables creation and relationships
  - [x] RLS policies implementation
  - [x] Foreign key constraints
  - [x] Email address generation trigger

### Phase 2: Email Processing Infrastructure

- [x] AWS SES Webhook Implementation
- [x] Create Supabase Edge Function for SES notifications
- [x] Implement email receipt and storage
- [x] Set up authentication and security
- [x] Add error handling and retries

- [x] Email Response System
- [x] Create Supabase Edge Function for sending
- [x] Implement AWS SES integration
- [x] Add response tracking
- [x] Handle bounce notifications

### Phase 3: Frontend Enhancement

- [ ] Inbox UI Updates

  - [x] Property reference display
  - [x] Application status integration
  - [x] Viewing appointment features
  - [ ] AI suggestion management
  - [ ] Advanced filtering and sorting
  - [ ] Bulk actions implementation

- [ ] Email Management Features
  - [x] Retry/Resend functionality
  - [ ] Attachment handling improvements
  - [ ] Thread management enhancements
  - [x] Status tracking updates

### Phase 4: Integration & Testing

- [] System Integration

  - [x] AWS SES to Supabase flow
  - [ ] Application system integration
  - [ ] Viewing appointment system integration
  - [] Error handling and monitoring

- [ ] Testing Implementation
  - [ ] Unit tests for core functionality
  - [ ] Integration tests for system flows
  - [ ] End-to-end testing
  - [ ] Load testing and optimization

### Phase 5: AI & CrewAI Integration

- [ ] CrewAI Service Updates

  - [ ] Update email_response_agent.py
  - [ ] Implement property reference matching
  - [ ] Add viewing appointment logic
  - [ ] Integrate document requirements
  - [ ] Application link generation

- [ ] AI Processing Pipeline
  - [ ] Email content analysis
  - [ ] Response generation
  - [ ] Confidence scoring
  - [ ] Multi-language support

## Current Focus: Phase 2 - Email Processing Infrastructure

### Next Implementation Steps

1. ✅ Create Supabase Edge Function for SES webhook
2. ✅ Implement email receipt and storage
   - [x] Add AWS SES SDK to fetch full message content
   - [x] Handle email attachments detection
   - [x] Implement basic email parsing
   - [x] Store raw message content
3. ✅ Set up AWS SES integration for sending
4. ✅ Add basic error handling and logging

## Monitoring & Maintenance

### 🛡 Monitoring & Error Handling

- [x] Email delivery logging system
- [x] Support for tracking email status (received, sent, draft, archived, deleted, bounced, failed)
- [x] AI suggestion confidence scoring
- [x] Log delivery and bounce events from SES (via SNS or direct API call)
- [ ] Use Logflare or Supabase logs for function error tracking
- [x] Implement retry logic for failed deliveries

### 📦 DevOps / CI

- [x] Create `.env` variables for AWS SES keys and domains
- [ ] Add secure secrets to Supabase Edge runtime
- [ ] Document API usage & SES quotas

---

## New Features Implemented

1. **Unified Email Address System**

   - Support for both individual and team email addresses
   - Automatic email address generation via database trigger
   - Primary email address designation

2. **Enhanced Email Threading**

   - Thread-based conversation organization
   - Support for message threading and replies
   - Priority and follow-up tracking

3. **AI Integration**

   - AI suggestion system for responses
   - Confidence scoring for suggestions
   - Support for different suggestion types (follow-up, response, classification)

4. **Advanced Email Management**
   - Comprehensive status tracking
   - Attachment handling
   - Delivery logging
   - Support for both plain text and HTML content

---

## Notes

- **Subdomain Usage**: All user-generated email addresses are under `n.agentamara.com`
- **Fallback Routing**: Unmatched SES receipts go to a default handler
- **AI Response Timing**: Ensure latency between receipt and response is acceptable (use async queue if needed)
- **Team Support**: System now supports both individual agents and teams with shared email addresses
- **Data Security**: RLS policies ensure proper access control for all email data

---

## Final Goal

Users should be able to:

1. Use their unique Amara email (e.g., `team-alpha@n.agentamara.com`) on contact forms
2. Have inbound messages parsed, responded to, and logged automatically
3. View all correspondence in an intuitive UI
4. Leverage AI suggestions for efficient communication
5. Manage both individual and team email communications

This will streamline tenant communications and centralize audit trails for Amara clients.
