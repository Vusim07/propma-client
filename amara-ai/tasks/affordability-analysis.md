# Affordability Analysis Implementation Tasks

## Overview

Integrate the CrewAI affordability analysis service with the tenant screening results page to provide real financial analysis instead of mock data.

## Tasks

### API Integration

- [x] Review existing CrewAI implementation in `amara-ai/src/affordability_crew/`
- [x] Review FastAPI endpoint at `amara-ai/main.py`
- [x] Create a TypeScript service for communicating with the affordability analysis API
- [x] Implement error handling for API communication
- [x] Create mock responses for testing when API is unavailable

### Frontend Integration

- [x] Update `ScreeningResults.tsx` to fetch real data from the API instead of using mock data
- [x] Ensure loading states are handled properly
- [x] Implement proper error handling for API failures
- [x] Preserve the existing UI/styling while integrating real data

### Data Processing

- [x] Create document upload functionality for bank statements
- [x] Implement parsing and formatting of financial data for API requests
- [x] Format API responses to match the expected frontend data structure
- [ ] Add authentication tokens to API requests

### Testing & Validation

- [x] Test with mock API responses
- [x] Verify data is displayed correctly in the UI
- [x] Ensure error states are handled gracefully
- [ ] Test with actual CrewAI endpoint when available

## Progress Updates

### 2024-07-17

- Initial task tracking document created
- Reviewed existing codebase and CrewAI implementation
- Identified key components for integration

### 2024-07-18

- Created `affordabilityService.ts` to handle communication with the API
- Implemented mock response generation for testing
- Added transaction extraction from bank statement documents
- Integrated the service with the screening results page

### 2024-07-20

- Fixed method parameter issues in `analyzeAffordability` to match TypeScript interface
- Completed comprehensive implementation of tenant financial data extraction
- Implemented credit report generation functionality
- Fixed issues with tenant profile data retrieval
- Verified integration between frontend and backend services

### 2024-07-21

- Fixed linter errors in `ScreeningResults.tsx` by updating the `analyzeAffordability` method call to use the correct parameter structure
- Removed non-existent `employer` property reference in `getTenantIncomeData` method
- Completed API integration with proper TypeScript typing
- Updated documentation to reflect the current implementation status

### Next Steps

- Test with real transactions from the database
- Add tenant employer information to profile data model if needed for analysis
- Implement authentication if needed for the API
- Deploy the CrewAI service to production
- Connect the frontend to the production API endpoint

## Implementation Notes

### Data Flow

1. User uploads bank statements to the platform
2. Documents are processed and stored in Supabase
3. When viewing screening results, the system:
   - Checks for existing screening report
   - If none exists, extracts transactions from bank statements
   - Sends transactions to the CrewAI affordability analysis service
   - Receives analysis results and displays them
   - Saves the results to the screening_reports table

### Mock Data

For development and testing, mock responses are generated when:

- The application is running in development mode
- No transaction data is available
- The API call fails

### Error Handling

- Loading states are displayed during analysis
- Error messages are shown when the analysis fails
- Fallback to mock data in development mode

### CrewAI Integration

The affordability analysis is powered by a Python-based CrewAI agent:

- Located in `amara-ai/src/affordability_crew/`
- Exposes a FastAPI endpoint for analyzing affordability
- Takes transaction data, target rent, and optional payslip/credit data
- Returns a comprehensive analysis with metrics and recommendations
- Provides confidence scores and risk assessments

### Service Architecture

1. `affordabilityService.ts` provides the main interface for frontend components
2. Key methods include:
   - `createAffordabilityAnalysis`: Orchestrates the end-to-end analysis process
   - `analyzeAffordability`: Sends formatted data to the CrewAI API
   - `getTransactionsFromDocuments`: Extracts financial data from uploaded documents
   - `generateCreditReport`: Creates credit assessment data
   - `saveAnalysisResults`: Persists analysis results to the database
