# AI-Powered Affordability Assessment Implementation Plan

## Overview

This document outlines the plan for implementing an AI-powered affordability assessment system for tenant screening. The system will analyze tenant profiles, credit data, bank statements, and payslips to determine rental affordability.

## Current Context

- Frontend: React (Vite) + TypeScript
- Backend: Supabase (Auth/DB/Storage)
- Existing Components: DocumentUpload, ScreeningResults, DetailedScreening
- Database Schema: Includes screening_reports, documents, tenant_profiles tables

## Assessment Requirements

### 1. Data Sources

- Tenant Profile (monthly income, employment status)
- Credit Bureau Data (mocked initially)
- Bank Statements (parsed via OCR)
- Payslips (parsed via OCR)

### 2. Key Metrics

- Rent-to-Income Ratio (target: ≤ 30%)
- Credit Score (SA credit scoring model)
- Income Stability (from bank statements)
- Employment Verification (from payslips)
- Debt-to-Income Ratio (from bank statements)
- Monthly Debt Obligations (from credit bureau)
  - Active loans
  - Credit card payments
  - Store accounts
  - Other recurring debt payments
- Account Payment History (from credit bureau)
  - Payment patterns
  - Missed/late payments
  - Default history
  - Account status
- Total Debt Service Ratio (TDSR)
  - Combined monthly debt payments
  - Including proposed rent
  - Target: ≤ 40% of gross income

## Implementation Approach

### Phase 1: Core Assessment Engine

#### 1.1 Supabase Edge Function Setup

- Create new edge function: `calculate-affordability`
- Implement TypeScript interface for assessment inputs/outputs
- Set up function triggers on document upload completion

#### 1.2 Assessment Algorithm

- Implement base affordability calculation
- Add credit score weighting
- Include income stability analysis
- Factor in debt obligations

#### 1.3 Data Processing Pipeline

- Document parsing and data extraction
- Data normalization and validation
- Risk scoring calculation
- Recommendation generation

### Phase 2: AI Enhancement

#### 2.1 Document Analysis

- Implement Azure Document Intelligence for OCR
- Create document type-specific parsers
- Extract key financial data points
- Validate document authenticity

#### 2.2 Pattern Recognition

- Analyze spending patterns from bank statements
- Identify income stability indicators
- Detect potential financial risks
- Calculate debt service ratios

#### 2.3 Decision Support

- Generate risk assessment scores
- Provide recommendation explanations
- Create tenant-specific insights
- Flag potential concerns

### Phase 3: Integration & Testing

#### 3.1 API Integration

- Create Supabase RPC functions
- Implement webhook handlers
- Set up async processing queues
- Add error handling and retries

#### 3.2 Frontend Updates

- Enhance ScreeningResults component
- Add detailed affordability breakdown
- Implement recommendation display
- Create interactive visualization

#### 3.3 Testing & Validation

- Unit tests for core algorithms
- Integration tests for document processing
- Performance testing
- Edge case handling

## Technical Stack Recommendation

### Core Components

1. **Supabase Edge Functions**

   - Primary processing engine
   - Async task handling
   - Data validation

2. **Azure Document Intelligence**

   - Document OCR
   - Structured data extraction
   - Document validation

3. **Custom TypeScript Modules**
   - Financial calculations
   - Risk assessment
   - Data normalization

### Why Not CrewAI?

While CrewAI is powerful for complex multi-agent systems, our requirements are more focused on:

- Structured data processing
- Financial calculations
- Document analysis
- Risk assessment

A simpler, more direct approach using Supabase Edge Functions and Azure Document Intelligence will be:

- More maintainable
- Easier to debug
- Better performance
- Lower complexity

## Implementation Tasks

### Week 1: Foundation

1. Set up Supabase Edge Function environment
2. Create base assessment algorithm
3. Implement document parsing pipeline
4. Set up Azure Document Intelligence integration

### Week 2: Core Features

1. Implement credit score integration
2. Create bank statement analyzer
3. Build payslip processor
4. Develop risk scoring system

### Week 3: AI Enhancement

1. Add pattern recognition
2. Implement anomaly detection
3. Create recommendation engine
4. Build explanation generator

### Week 4: Integration

1. Connect to frontend components
2. Implement real-time updates
3. Add error handling
4. Create monitoring system

## Success Metrics

- Processing time < 30 seconds
- Accuracy > 95% on test data
- False positive rate < 5%
- System uptime > 99.9%

## Next Steps

1. Review and approve this plan
2. Set up development environment
3. Begin with Week 1 tasks
4. Schedule weekly progress reviews

## Notes

- All financial calculations must comply with South African regulations
- Data privacy must follow POPI Act requirements
- System must be auditable and explainable
- Regular model validation and updates required
