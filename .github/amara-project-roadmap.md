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

- [ ] Create Supabase project and configure environment
- [ ] Design and implement database schema
  - [ ] User tables (agents, admins)
  - [ ] Tenant tables
  - [ ] Property tables
  - [ ] Application/screening tables
  - [ ] Document storage tables
- [ ] Set up authentication flows
  - [ ] Email/password auth
  - [ ] Magic link auth
  - [ ] Password reset flows
- [ ] Configure Row Level Security (RLS) policies
- [ ] Set up Storage buckets with appropriate permissions

### State Management (Priority: High)

- [ ] Complete Zustand store implementation
  - [ ] Auth store
  - [ ] Agent store
  - [ ] Tenant store
  - [ ] Property store
  - [ ] Application store

### Document Processing (Priority: Medium)

- [ ] Replace TesseractJS with server-side OCR solution
  - [ ] Create Supabase Edge Functions for OCR processing
  - [ ] Integrate with cloud OCR service (options below)
- [ ] Implement document upload/processing workflow
- [ ] Add document verification status tracking

### AI Integration (Priority: Medium)

- [ ] Set up CrewAI agent framework
- [ ] Implement bank statement analysis agent
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
- [ ] Develop document upload/management UI
- [ ] Implement notification system

## 3. OCR Alternatives to TesseractJS

### Cloud OCR Services

1. **Google Cloud Vision API**

   - Highly accurate text recognition
   - Supports multiple languages
   - Document structure understanding

2. **AWS Textract**

   - Specialized for forms and tables
   - Extracts key-value pairs
   - Good for structured documents

3. **Azure Computer Vision**
   - Strong at general OCR tasks
   - Good multi-language support
   - Competitive pricing

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
