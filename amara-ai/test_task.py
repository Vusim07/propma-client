#!/usr/bin/env python3
"""
Test script for Task creation in CrewAI
"""
import json
import logging
import os
from crewai import Task, Agent
from src.affordability_crew.config import setup_config
import yaml

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def load_config(config_path):
    """Load YAML configuration"""
    try:
        with open(config_path, "r") as f:
            return yaml.safe_load(f)
    except Exception as e:
        logger.error(f"Error loading config: {str(e)}")
        raise


def test_task_creation():
    """Test if we can create a Task with description and expected_output"""
    try:
        # Setup environment configuration
        setup_config()

        # Load agent config
        agent_config = load_config("src/affordability_crew/config/agents.yaml")
        if not agent_config or "financial_analyst" not in agent_config:
            raise ValueError("Failed to load agent configuration")

        logger.info(
            f"Using LLM from config: {agent_config['financial_analyst']['llm']}"
        )

        # Create a simple agent using the agent config
        agent = Agent(
            role=agent_config["financial_analyst"]["role"],
            goal=agent_config["financial_analyst"]["goal"],
            backstory=agent_config["financial_analyst"]["backstory"],
            llm=agent_config["financial_analyst"]["llm"],
            verbose=True,
        )

        # Sample data
        sample_transactions = [
            {
                "description": "SALARY PAYMENT",
                "amount": "R 15000.00",
                "date": "01/10/2024",
                "type": "credit",
            }
        ]
        target_rent = 5000.0

        # Create task directly
        task = Task(
            description=f"""
            Analyze South African bank transactions to assess affordability for a rental property with monthly rent of R{target_rent:.2f}.
            
            Transactions:
            {json.dumps(sample_transactions, indent=2)}
            
            Provide:
            1. Transaction categorization (income, essential expenses, non-essential expenses, savings, debt payments)
            2. Income stability assessment (consistency, sources, reliability)
            3. Expense patterns (fixed vs. variable, necessary vs. discretionary)
            4. Affordability recommendation (based on 30% rent-to-income ratio standard in South Africa)
            5. Risk factors (specific to South African rental market)
            6. Financial metrics (include debt-to-income ratio, savings rate, disposable income)
            
            Use South African financial standards and ensure all currency values are in ZAR (R).
            Format the response as a valid JSON object that matches the AffordabilityResponse schema.
            """,
            expected_output="""A valid JSON object with the expected structure""",
            agent=agent,
            output_file="output/direct_task_test.json",
        )

        logger.info("Task created successfully")
        logger.info(f"Task description: {task.description[:100]}...")
        logger.info(f"Task agent: {task.agent.role}")

        print("\nTest passed: Task creation is working correctly")
        return True

    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        return False


if __name__ == "__main__":
    result = test_task_creation()
    if not result:
        print("\nTest failed: There were errors in Task creation")
    exit(0 if result else 1)
