#!/usr/bin/env python3
"""
Test script for Azure OpenAI API integration without litellm
"""
import os
import logging
from dotenv import load_dotenv
from openai import AzureOpenAI
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def test_azure_openai():
    """Test direct integration with Azure OpenAI"""
    try:
        # Load environment variables
        load_dotenv(verbose=True)

        # Get Azure OpenAI credentials
        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        api_base = os.getenv("AZURE_OPENAI_ENDPOINT")
        api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")
        deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

        # Log configuration (without exposing the API key)
        logger.info(f"API Key exists: {bool(api_key)}")
        logger.info(f"API Base: {api_base}")
        logger.info(f"API Version: {api_version}")
        logger.info(f"Deployment: {deployment}")

        # Fix URL format - ensure no trailing slash
        if api_base and api_base.endswith("/"):
            api_base = api_base[:-1]

        # Also set OpenAI environment variables for CrewAI
        os.environ["OPENAI_API_TYPE"] = "azure"
        os.environ["OPENAI_API_VERSION"] = api_version
        os.environ["OPENAI_API_BASE"] = api_base
        os.environ["OPENAI_API_KEY"] = api_key

        # Initialize Azure OpenAI client
        client = AzureOpenAI(
            api_key=api_key,
            api_version=api_version,
            azure_endpoint=api_base,
        )

        try:
            # Make a test completion call
            response = client.chat.completions.create(
                model=deployment,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Say hello world"},
                ],
                temperature=0.7,
                max_tokens=100,
            )

            # Log success
            logger.info(f"API call successful")
            logger.info(f"Response: {response.choices[0].message.content}")

            print("\nTest passed: Successfully connected to Azure OpenAI")
            return True

        except Exception as e:
            logger.error(f"API call failed: {str(e)}")
            return False

    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        return False


if __name__ == "__main__":
    result = test_azure_openai()
    if not result:
        print("\nTest failed: Could not connect to Azure OpenAI")
    exit(0 if result else 1)
