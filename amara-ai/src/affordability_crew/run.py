#!/usr/bin/env python3

import json
import logging
import argparse
import os
from pathlib import Path
from .crew import AffordabilityAnalysisCrew
from .config import setup_config

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Run affordability analysis on bank transactions"
    )
    parser.add_argument(
        "--input", type=str, help="Path to JSON file with transactions and target rent"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="affordability_analysis_result.json",
        help="Path to output JSON file for analysis results",
    )
    return parser.parse_args()


def load_input_data(input_path):
    """Load transaction data from JSON file"""
    try:
        with open(input_path, "r") as f:
            data = json.load(f)

        required_fields = ["transactions", "target_rent"]
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Input JSON missing required field: {field}")

        return data
    except Exception as e:
        logger.error(f"Error loading input data: {str(e)}")
        raise


def save_output_data(output_path, data):
    """Save analysis results to JSON file"""
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        with open(output_path, "w") as f:
            json.dump(data, f, indent=2)

        logger.info(f"Analysis results saved to {output_path}")
    except Exception as e:
        logger.error(f"Error saving output data: {str(e)}")
        raise


def validate_task_config():
    """Validate the task configuration"""
    try:
        # Setup environment configuration
        setup_config()

        # Sample data for testing
        sample_data = [
            {
                "description": "SALARY PAYMENT",
                "amount": "R 15000.00",
                "date": "01/10/2024",
                "type": "credit",
            }
        ]

        # Initialize crew with sample data
        crew_instance = AffordabilityAnalysisCrew(
            transactions_data=sample_data, target_rent=5000.0
        )

        # Get the context data
        context_data = crew_instance.prepare_data()
        logger.info(f"Context data format: {type(context_data)}")
        logger.info(f"Context data: {json.dumps(context_data, indent=2)}")

        # Create task to validate configuration
        task = crew_instance.affordability_analysis()

        # Log task details
        logger.info(f"Task created successfully with context: {task.context}")

        # Attempt to create the crew to validate everything
        crew = crew_instance.crew()
        logger.info("Crew created successfully")

        return True
    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        return False


def main():
    """Main function to run affordability analysis"""
    try:
        # Validate the task configuration
        validation_result = validate_task_config()
        if not validation_result:
            logger.warning(
                "Task configuration validation failed, proceeding with caution"
            )

        # Setup environment configuration
        setup_config()

        # Parse command line arguments
        args = parse_args()

        # Load input data
        if args.input:
            input_data = load_input_data(args.input)
        else:
            # Sample data for testing
            input_data = {
                "transactions": [
                    {
                        "description": "SALARY PAYMENT",
                        "amount": 15000.00,
                        "date": "01/10/2024",
                        "type": "credit",
                    },
                    {
                        "description": "RENT PAYMENT",
                        "amount": 4500.00,
                        "date": "05/10/2024",
                        "type": "debit",
                    },
                    {
                        "description": "GROCERY SHOPPING",
                        "amount": 1200.00,
                        "date": "10/10/2024",
                        "type": "debit",
                    },
                    {
                        "description": "CAR LOAN",
                        "amount": 2500.00,
                        "date": "15/10/2024",
                        "type": "debit",
                    },
                    {
                        "description": "ELECTRICITY BILL",
                        "amount": 800.00,
                        "date": "18/10/2024",
                        "type": "debit",
                    },
                    {
                        "description": "WATER BILL",
                        "amount": 400.00,
                        "date": "20/10/2024",
                        "type": "debit",
                    },
                    {
                        "description": "INTERNET BILL",
                        "amount": 600.00,
                        "date": "22/10/2024",
                        "type": "debit",
                    },
                    {
                        "description": "SAVINGS TRANSFER",
                        "amount": 1000.00,
                        "date": "25/10/2024",
                        "type": "debit",
                    },
                    {
                        "description": "ENTERTAINMENT",
                        "amount": 500.00,
                        "date": "28/10/2024",
                        "type": "debit",
                    },
                ],
                "target_rent": 5000.00,
            }
            logger.info("Using sample data for testing")

        # Initialize crew with input data
        crew_instance = AffordabilityAnalysisCrew(
            transactions_data=input_data["transactions"],
            target_rent=input_data["target_rent"],
        )

        # Run the crew
        logger.info("Starting affordability analysis")
        # Create the crew instance from the crew() function
        crew = crew_instance.crew()
        # Kickoff the actual crew instance
        raw_result = crew.kickoff()

        # Process the result to ensure it matches our expected format
        if hasattr(crew_instance, "process_results") and callable(
            crew_instance.process_results
        ):
            # Call process_results directly with the right event name
            result = crew_instance.process_results(
                "crew_finished", final_result=raw_result
            )
            if result is None:  # If process_results returns None, use the raw result
                result = raw_result
        else:
            result = raw_result

        # Save results to output file
        save_output_data(args.output, result)

        logger.info("Affordability analysis completed successfully")
    except Exception as e:
        logger.error(f"Error running affordability analysis: {str(e)}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
