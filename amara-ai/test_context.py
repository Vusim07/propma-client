#!/usr/bin/env python3
"""
Test script for CrewAI context formatting
"""
import json
import logging
import os
from src.affordability_crew import AffordabilityAnalysisCrew
from src.affordability_crew.config import setup_config

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def test_crew_context_formatting():
    """Test if CrewAI can handle our context formatting"""
    try:
        # Setup environment configuration
        setup_config()

        # Create sample data
        sample_data = [
            {
                "description": "SALARY PAYMENT",
                "amount": "R 15000.00",
                "date": "01/10/2024",
                "type": "credit",
            },
            {
                "description": "RENT PAYMENT",
                "amount": "R 4500.00",
                "date": "05/10/2024",
                "type": "debit",
            },
        ]

        # Initialize crew with sample data
        crew_instance = AffordabilityAnalysisCrew(
            transactions_data=sample_data, target_rent=5000.0
        )

        # Get the context data
        context_data = crew_instance.prepare_data()
        logger.info(f"Context data type: {type(context_data)}")
        logger.info(f"Context data: {json.dumps(context_data, indent=2)}")

        # Try to access the affordability_analysis task
        try:
            task = crew_instance.affordability_analysis()
            logger.info(f"Task created successfully")
            logger.info(f"Task context type: {type(task.context)}")
            logger.info(f"Task context: {task.context}")

            # Print task description with variables rendered
            if hasattr(task, "description"):
                logger.info(f"Task description: {task.description}")

            # Try to create the crew
            crew = crew_instance.crew()
            logger.info(f"Crew created successfully")

            print("\nTest passed: CrewAI context formatting is working correctly")
            return True
        except Exception as e:
            logger.error(f"Error creating task or crew: {str(e)}")
            return False

    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        return False


if __name__ == "__main__":
    result = test_crew_context_formatting()
    if not result:
        print("\nTest failed: There were errors in CrewAI context formatting")
    exit(0 if result else 1)
