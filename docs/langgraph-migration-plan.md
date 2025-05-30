# 🧭 Migration Plan: Transitioning from CrewAI to LangGraph for Tenant Affordability Assessment

## 📄 Overview

This document outlines the migration strategy to transition from a CrewAI-based system to LangGraph for implementing an AI-powered affordability assessment system for tenant screening. The system analyzes tenant profiles, credit data, bank statements, and payslips to determine rental affordability.

## 🏗️ Current Architecture

- **Frontend**: React (Vite) + TypeScript
- **Backend**: Supabase (Auth/DB/Storage/Functions)
- **API Layer**: FastAPI `./amara-ai`
- **Existing Components**:

  - DocumentUpload
  - ScreeningResults
  - DetailedScreening
  - AffordabilityService

- **Database Schema**:

  - `screening_reports`
  - `credit_reports`
  - `documents`
  - `tenant_profiles`

## 🎯 Assessment Requirements

### Data Sources

- Tenant Profile (monthly income, employment status)
- Credit Bureau Data (mocked initially)
- Bank Statements (parsed via OCR)
- Payslips (parsed via OCR)

### Key Metrics

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

## 🔄 Migration Phases

### Phase 1: Analysis and Planning

- **Objective**: Understand the existing CrewAI setup and identify components for migration.
- **Actions**:

  - Review CrewAI agents, tasks, and workflows.
  - Map existing functionalities to LangGraph nodes and workflows.
  - Identify dependencies and integration points with Supabase and FastAPI.

### Phase 2: Environment Setup

- **Objective**: Prepare the development environment for LangGraph.
- **Actions**:

  - Install LangGraph and its dependencies.

    ```bash
    pip install langgraph
    ```

  - Set up a new Git branch for the migration.
  - Configure environment variables and secrets management.

### Phase 3: Refactoring Agents to LangGraph Nodes

- **Objective**: Convert CrewAI agents into LangGraph nodes.
- **Actions**:

  - Define LangGraph nodes for each functional component:

    - Document Parsing Node
    - Affordability Assessment Node
    - Credit Analysis Node
    - Email Handling Node

  - Implement state management using LangGraph's built-in mechanisms.
  - Ensure each node is modular and testable.

### Phase 4: Workflow Orchestration

- **Objective**: Establish the workflow using LangGraph's Directed Acyclic Graph (DAG) structure.
- **Actions**:

  - Define the sequence and conditional logic between nodes.
  - Implement error handling and fallback mechanisms.
  - Integrate with Supabase functions and FastAPI endpoints.

### Phase 5: Integration Testing

- **Objective**: Validate the new LangGraph-based system.
- **Actions**:

  - Develop unit tests for individual nodes.
  - Perform integration tests for the entire workflow.
  - Compare outputs with the existing CrewAI system to ensure consistency.

### Phase 6: Deployment

- **Objective**: Deploy the LangGraph-based system to production.
- **Actions**:

  - Containerize the application using Docker.
  - Set up CI/CD pipelines for automated deployment.
  - Monitor system performance and logs for any anomalies.

## 🛠️ Technical Considerations

- **State Management**: Utilize LangGraph's state management for maintaining context across nodes.
- **Scalability**: Design nodes to be stateless where possible to facilitate horizontal scaling.
- **Observability**: Integrate logging and monitoring tools to track system performance and errors.
- **Security**: Ensure secure handling of sensitive data, especially during document parsing and storage.

## 📚 Resources

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [FastAPI LangGraph Agent Template](https://github.com/wassim249/fastapi-langgraph-agent-production-ready-template)
