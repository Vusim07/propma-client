# Amara Context Guide

**Project Core Identity**  
AI-powered tenant screening platform for South African real estate professionals

**Critical Technical Context**

- Frontend: React (Vite) + TypeScript
- State: Zustand stores
- Styling: Tailwind CSS + Shadcn UI components
- Backend: Supabase (Auth/DB/Storage)
- AI: CrewAI agents for document analysis
- Key Compliance: POPI Act, South African Rental Housing Act
-

**Essential Patterns**

1. File organization follows atomic design principles:

   - `/components/ui` for Shadcn primitives
   - `/stores` for Zustand state
   - `/services` for Supabase/CrewAI clients

2. Security requirements:

   - Server-side OCR processing only with Azure Document Intelligence.
   - Row Level Security (RLS) on all Supabase queries
   - ZAR currency formatting for financial data
   - Write code for production implementation.

3. Performance constraints:
   - Core Web Vitals targets (LCP < 2.5s)
   - <500KB initial load bundle
   - Offline-first document uploads

**Regional Specificity**

- Date format: DD/MM/YYYY
- Currency: ZAR (R) symbol placement
- Address format: SA provincial structure
- Compliance: POPI Act data handling

**AI Implementation**

- CrewAI agents process:
  1. Bank statement analysis
  2. ID document validation
  3. Rental affordability calculation
- Azure Document Intelligence for OCR limited to:
  - PDFs under 5MB
  - PNG/JPG images

**Common Patterns**

```tsx
// Typical Zustand store
interface TenantStore {
  applications: Tenant[];
  fetch: (agentId: string) => Promise<void>;
}

// Standard API call
const { data } = await supabase
  .from('screening_reports')
  .select('*')
  .eq('agent_id', userId);

**Avoidance Patterns**

Browser alert() dialogs

Inline style attributes

Uncontrolled form inputs

Complex component nesting

Simulating operations unless necessary.

```
