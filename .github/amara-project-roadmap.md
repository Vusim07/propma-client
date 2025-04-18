# Amara: Tenant Screening Platform Roadmap

## 1. Current Implementation Status

### Frontend Foundation

- ✅ Basic React/Vite setup with TypeScript
- ✅ Project structure following atomic design principles
- ✅ Tailwind CSS and Shadcn UI components configuration

### Core Application Structure

- ✅ Main application shell
- ✅ Basic routing setup
- ✅ Component organization

## 2. Missing Components & Implementation Tasks

### Supabase Backend (Priority: High)

- [x] Create Supabase project and configure environment
- [x] Design and implement database schema
  - [x] User tables (agents, admins)
  - [x] Tenant tables
  - [x] Property tables
  - [x] Application/screening tables
  - [x] Document storage tables
- [x] Set up authentication flows
  - [x] Email/password auth
  - [x] Magic link auth
  - [ ] Password reset flows
- [x] Configure Row Level Security (RLS) policies
- [x] Set up Storage buckets with appropriate permissions

### State Management (Priority: High)

- [x] Complete Zustand store implementation
  - [x] Auth store
  - [x] Agent store
  - [x] Tenant store
  - [x] Property store
  - [x] Application store

### Document Processing (Priority: Medium)

- [x] Replace TesseractJS with server-side OCR solution
  - [x] Create Supabase Edge Functions for OCR processing
  - [x] Integrate with cloud OCR service (options below)
- [x] Implement document upload/processing workflow
- [x] Add document verification status tracking

### AI Integration (Priority: Medium)

- [x] Set up CrewAI agent framework
- [x] Implement bank statement analysis agent
- [ ] Implement ID document validation agent
- [ ] Create rental affordability calculation agent
- [ ] Design agent coordination system

### Workflow Automation (Priority: Low)

- [ ] Configure n8n with Docker
- [ ] Design primary workflows:
  - [ ] Application submission notification
  - [ ] Document processing pipeline
  - [ ] Approval/rejection workflows
  - [ ] Payment reminders

### UI/UX Completion (Priority: Medium)

- [ ] Design and implement dashboard views
- [ ] Create tenant profile pages
- [ ] Build application review interface
- [x] Develop document upload/management UI
- [ ] Implement notification system

## 3. OCR Alternatives to TesseractJS

### Cloud OCR Services

### Implementation Approaches

1. **Supabase Edge Functions**

   - Create serverless functions for OCR processing
   - Call cloud OCR APIs from edge functions
   - Return processed results to client

2. **Netlify Functions**
   - Similar approach using Netlify's serverless environment
   - Good integration with frontend deployment

### Recommended OCR Approach

For compliance with POPI Act and security requirements, implement:

- Document upload to secure Supabase storage bucket
- Processing via Edge Function that calls Google Cloud Vision API
- Deletion of raw documents after processing (if not needed)
- Storage of extracted data in encrypted database fields
