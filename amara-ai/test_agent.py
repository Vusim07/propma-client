#!/usr/bin/env python3
"""
Test script for creating and using an Agent with Azure OpenAI
"""
import os
import logging
from dotenv import load_dotenv
from crewai import Agent
from src.affordability_crew.config import setup_config

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def test_agent_creation():
    """Test if we can create and use an Agent with Azure OpenAI"""
    try:
        # Setup environment configuration
        setup_config()

        # Create a simple agent
        agent = Agent(
            role="Financial Researcher",
            goal="Research financial topics",
            backstory="You are an expert financial researcher.",
            llm="openai/gpt-4o-mini",
            verbose=True,
        )

        # Log that agent was successfully created
        logger.info("Agent created successfully")

        # Try to use the agent directly
        try:
            # Simple question to test if the agent works
            response = agent.ask("What is the current year?")
            logger.info(f"Agent response: {response}")

            print(
                "\nTest passed: Successfully created and used an Agent with Azure OpenAI"
            )
            return True

        except Exception as e:
            logger.error(f"Agent ask failed: {str(e)}")
            return False

    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        return False


if __name__ == "__main__":
    result = test_agent_creation()
    if not result:
        print("\nTest failed: Could not create and use an Agent with Azure OpenAI")
    exit(0 if result else 1)
