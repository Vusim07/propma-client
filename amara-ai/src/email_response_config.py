import os
import logging
import os
import logging
from dotenv import load_dotenv

# Configure logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Load environment variables
load_dotenv(verbose=True)

logger = logging.getLogger(__name__)


def check_env_vars():
    """Verify that all required environment variables are set"""
    required_vars = [
        "AZURE_OPENAI_API_KEY",
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_API_VERSION",
        "AZURE_OPENAI_DEPLOYMENT_NAME",
    ]

    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)

    if missing_vars:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing_vars)}"
        )

    # Fix URL format - ensure no trailing slash which can cause URL parsing issues
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    if endpoint and endpoint.endswith("/"):
        os.environ["AZURE_OPENAI_ENDPOINT"] = endpoint[:-1]
        logger.info("Removed trailing slash from AZURE_OPENAI_ENDPOINT")

    logger.info("Environment variables validated successfully")


def setup_azure_openai_env():
    """Setup environment variables for CrewAI to use Azure OpenAI"""
    # Set required environment variables for CrewAI to use Azure OpenAI
    os.environ["AZURE_API_KEY"] = os.getenv("AZURE_OPENAI_API_KEY", "")
    os.environ["AZURE_API_BASE"] = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    os.environ["AZURE_API_VERSION"] = os.getenv(
        "AZURE_OPENAI_API_VERSION", "2024-08-01-preview"
    )

    # Also set the OpenAI variables as CrewAI might use these too
    os.environ["OPENAI_API_KEY"] = os.getenv("AZURE_OPENAI_API_KEY", "")
    os.environ["OPENAI_API_BASE"] = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    os.environ["OPENAI_API_VERSION"] = os.getenv(
        "AZURE_OPENAI_API_VERSION", "2024-08-01-preview"
    )
    os.environ["OPENAI_API_TYPE"] = "azure"

    # Set system environment variable to tell CrewAI we're using Azure OpenAI
    os.environ["OPENAI_API_ENGINE"] = os.getenv(
        "AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini"
    )

    logger.info("Azure OpenAI environment variables set for CrewAI")


def log_env_vars():
    """Log environment variables without exposing sensitive data"""
    logger.info(
        f"Azure OpenAI API Key exists: {bool(os.getenv('AZURE_OPENAI_API_KEY'))}"
    )
    logger.info(f"Azure OpenAI Endpoint: {os.getenv('AZURE_OPENAI_ENDPOINT')}")
    logger.info(f"Azure OpenAI API Version: {os.getenv('AZURE_OPENAI_API_VERSION')}")
    logger.info(
        f"Azure OpenAI Deployment Name: {os.getenv('AZURE_OPENAI_DEPLOYMENT_NAME')}"
    )
    logger.info(f"OPENAI_API_TYPE: {os.getenv('OPENAI_API_TYPE')}")
    logger.info(f"OPENAI_API_ENGINE: {os.getenv('OPENAI_API_ENGINE')}")


def setup_config():
    """Setup Azure OpenAI configuration and validate settings"""
    logger.info("Setting up Azure OpenAI configuration...")

    # Required configuration
    required_vars = {
        "AZURE_OPENAI_API_KEY": "API key for authentication",
        "AZURE_OPENAI_API_VERSION": "API version (e.g., 2024-08-01-preview)",
        "AZURE_OPENAI_ENDPOINT": "Azure OpenAI endpoint URL",
        "AZURE_OPENAI_DEPLOYMENT_NAME": "Model deployment name",
    }

    # Validate all required variables
    missing_vars = []
    for var, description in required_vars.items():
        value = os.getenv(var)
        if not value:
            missing_vars.append(f"{var} ({description})")
        else:
            logger.info(f"{var} is configured")

    if missing_vars:
        error_msg = (
            f"Missing required Azure OpenAI configuration: {', '.join(missing_vars)}"
        )
        logger.error(error_msg)
        raise ValueError(error_msg)

    # Validate endpoint URL format
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    if not endpoint.startswith("https://") or not endpoint.endswith(
        ".openai.azure.com/"
    ):
        error_msg = f"Invalid Azure OpenAI endpoint format: {endpoint}"
        logger.error(error_msg)
        raise ValueError(error_msg)

    logger.info("Azure OpenAI configuration validated successfully")


def setup():
    """Setup and validate environment configuration"""
    try:
        check_env_vars()
        setup_azure_openai_env()
        log_env_vars()
        setup_config()
    except Exception as e:
        logger.error(f"Configuration error: {str(e)}")
        raise
