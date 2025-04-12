#!/usr/bin/env python3
"""
Test script for CrewAI's native Azure OpenAI integration
"""
import os
import logging
from dotenv import load_dotenv
from crewai import Agent, Task, Crew, Process

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def setup_environment():
    """Setup environment variables for Azure OpenAI"""
    # Load .env file
    load_dotenv(verbose=True)

    # Setup Azure OpenAI environment variables for CrewAI
    # Set Azure OpenAI specific variables
    os.environ["AZURE_API_KEY"] = os.getenv("AZURE_OPENAI_API_KEY", "")
    os.environ["AZURE_API_BASE"] = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    os.environ["AZURE_API_VERSION"] = os.getenv(
        "AZURE_OPENAI_API_VERSION", "2024-08-01-preview"
    )

    # Set standard OpenAI variables pointing to Azure
    os.environ["OPENAI_API_KEY"] = os.getenv("AZURE_OPENAI_API_KEY", "")
    os.environ["OPENAI_API_BASE"] = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    os.environ["OPENAI_API_VERSION"] = os.getenv(
        "AZURE_OPENAI_API_VERSION", "2024-08-01-preview"
    )
    os.environ["OPENAI_API_TYPE"] = "azure"
    os.environ["OPENAI_API_ENGINE"] = os.getenv(
        "AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini"
    )

    # Log environment variables
    logger.info(f"OPENAI_API_TYPE: {os.getenv('OPENAI_API_TYPE')}")
    logger.info(f"OPENAI_API_VERSION: {os.getenv('OPENAI_API_VERSION')}")
    logger.info(f"OPENAI_API_BASE: {os.getenv('OPENAI_API_BASE')}")
    logger.info(f"OPENAI_API_KEY exists: {bool(os.getenv('OPENAI_API_KEY'))}")
    logger.info(f"OPENAI_API_ENGINE: {os.getenv('OPENAI_API_ENGINE')}")


def test_azure_integration():
    """Test CrewAI's native Azure OpenAI integration"""
    try:
        # Setup environment
        setup_environment()

        # Use the standard OpenAI model format
        model_name = "openai/gpt-4o-mini"
        logger.info(f"Using model: {model_name}")

        # Create a simple agent
        researcher = Agent(
            role="Financial Researcher",
            goal="Research financial topics",
            backstory="You are an expert financial researcher.",
            llm=model_name,
            verbose=True,
        )

        # Create a simple task
        research_task = Task(
            description="What is the current year?",
            expected_output="A simple answer stating the current year.",
            agent=researcher,
        )

        # Create a crew with the agent and task
        crew = Crew(
            agents=[researcher],
            tasks=[research_task],
            process=Process.sequential,
            verbose=True,
        )

        # Execute the crew
        logger.info("Executing crew...")
        result = crew.kickoff()
        logger.info(f"Result: {result}")

        print("\nTest passed: Successfully used CrewAI with Azure OpenAI")
        return True

    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        return False


if __name__ == "__main__":
    result = test_azure_integration()
    if not result:
        print("\nTest failed: Could not use CrewAI with Azure OpenAI")
    exit(0 if result else 1)
