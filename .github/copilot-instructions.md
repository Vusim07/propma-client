# Amara Context Guide

**Project Core Identity**  
AI-powered tenant screening & viewing appointment scheduling platform for South African real estate professionals. (See .`./pitch-deck.md` for context on the platform we are building. )

**Critical Technical Context**

- Frontend: React (Vite) + TypeScript
- State: Zustand stores
- Styling: Tailwind CSS + Shadcn UI components
- Backend: Supabase (Auth/DB/Storage)
- AI: CrewAI agents for document, affordability analysis, email automation response
- Key Compliance: POPI Act, South African Rental Housing Act

- **Essential Patterns**

1. File organization follows atomic design principles:

   - `/components/ui` for Shadcn primitives
   - `/stores` for Zustand state
   - `/services` for Supabase clients and schema definitions
   - `/supabase` for Supabase Edge Functions
   - `/amara-ai` for FastAPI for CrewAI agents

2. Security requirements:

   - Server-side OCR processing only with Azure Document Intelligence.
   - Row Level Security (RLS) on all Supabase queries
   - ZAR currency formatting for financial data
   - Write production ready code.

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
  4. Email analysis and response
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

Dont be lazy.

Dont change modify/change existing components layout or styling unless specified otherwise.

Dont move on from files without checking for lint errors first.



**Code completion/recommendations**
Make direct file modifications unless specified otherwise.

If you cannot find files/modules, search the codebase first before creating the file/components

Use latest versions of packages unless already defined in the `package.json` file

Reference `/amara-ai/a-practical-guide-to-building-agents.pdf` for best practices for building AI agents when working on the CrewAI code.

Maintain consistency in components/functions creation (e.g if there are already existing supabase functions, use their approach when creating/scafolding new functions)

Test your code.




```
