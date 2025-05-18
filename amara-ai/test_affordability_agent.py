#!/usr/bin/env python3
"""
Test script for the AffordabilityAnalysisCrew pipeline with deterministic logic and LLM explanation.
"""
import logging
from src.affordability_crew.crew import AffordabilityAnalysisCrew
from src.affordability_crew.config import setup_config


def sample_input():
    # Example realistic input (ZAR, South African context)
    transactions = [
        {
            "description": "Salary",
            "amount": 25000,
            "date": "01/04/2025",
            "type": "credit",
        },
        {
            "description": "- R256.90",
            "amount": -256.90,
            "date": "02/04/2025",
            "type": "debit",
        },
        {
            "description": "- R1200.00",
            "amount": -1200.00,
            "date": "03/04/2025",
            "type": "debit",
        },
        {
            "description": "- R8000.00",
            "amount": -8000.00,
            "date": "05/04/2025",
            "type": "debit",
        },
    ]
    payslip = {
        "employer": "Acme Corp",
        "employeeName": "John Doe",
        "netIncome": 25000,
        "incomeFrequency": "monthly",
    }
    credit_report = {
        "creditScore": 650,
        "reportDate": "01/04/2025",
        "accountsSummary": {
            "totalAccounts": 3,
            "accountsInGoodStanding": 2,
            "negativeAccounts": 1,
        },
    }
    target_rent = 7000  # ZAR
    return transactions, payslip, credit_report, target_rent


def test_affordability_agent():
    setup_config()
    transactions, payslip, credit_report, target_rent = sample_input()
    crew = AffordabilityAnalysisCrew(
        transactions_data=transactions,
        target_rent=target_rent,
        payslip_data=payslip,
        credit_report=credit_report,
    )
    # Run the pipeline (simulate the main task)
    context = crew.prepare_data()
    audit = context["preprocessed"]
    print("Deterministic audit block:", audit)
    # Run the pipeline using Crew's kickoff method
    crew_instance = crew.crew()  # This creates the Crew object with agents and tasks
    result = crew_instance.kickoff()
    # Extract the agent's output dict from CrewOutput
    agent_output = None
    if hasattr(result, "final_result") and result.final_result:
        agent_output = result.final_result
    elif hasattr(result, "raw") and result.raw:
        import json

        agent_output = json.loads(result.raw)
    elif hasattr(result, "tasks_output") and result.tasks_output:
        import json

        agent_output = json.loads(result.tasks_output[0].raw)
    else:
        raise RuntimeError("Could not extract agent output from CrewOutput.")

    print("\nAgent output:", agent_output)
    # Assert deterministic can_afford is respected
    assert (
        agent_output["can_afford"] == audit["can_afford"]
    ), "LLM overrode deterministic can_afford!"
    print("\nTest passed: Deterministic logic enforced, LLM only explained.")


if __name__ == "__main__":
    test_affordability_agent()
