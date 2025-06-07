from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from typing import Dict, List, Any, Optional
import json
import logging
import os
import traceback
import sys
from langfuse import Langfuse
from datetime import datetime
from openai import AzureOpenAI
from src.email_response_config import setup_config

# Configure logging
logger = logging.getLogger(__name__)
handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter("%(asctime)s | %(name)s | %(levelname)s | %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Setup Azure OpenAI configuration
setup_config()


class AzureLLMConfig:
    """Helper class for Azure OpenAI configuration"""

    @classmethod
    def verify_config(cls):
        """Verify all required Azure config is present"""
        required_vars = {
            "AZURE_OPENAI_API_KEY": "API Key",
            "AZURE_OPENAI_ENDPOINT": "Endpoint URL",
            "AZURE_OPENAI_API_VERSION": "API Version",
            "AZURE_OPENAI_DEPLOYMENT_NAME": "Deployment Name",
        }

        missing = []
        for var, desc in required_vars.items():
            if not os.getenv(var):
                missing.append(f"{var} ({desc})")

        if missing:
            raise ValueError(f"Missing Azure OpenAI config: {', '.join(missing)}")

        # Verify endpoint format
        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        if not endpoint.startswith(("https://", "http://")):
            raise ValueError("Azure endpoint must start with https:// or http://")

    @classmethod
    def get_llm_config(cls):
        """Get standardized LLM config for all agents"""
        return {
            "temperature": 0.7,
            "max_tokens": 2000,
            "api_type": "azure",
            "api_key": os.getenv("AZURE_OPENAI_API_KEY"),
            "api_base": os.getenv("AZURE_OPENAI_ENDPOINT"),
            "api_version": os.getenv("AZURE_OPENAI_API_VERSION"),
            "deployment_name": os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
            "model": "gpt-4",  # Base model name
            "max_retries": 3,
            "timeout": 30,
        }

    @classmethod
    def test_connection(cls):
        """Test Azure OpenAI connection"""
        try:
            client = AzureOpenAI(
                api_key=os.getenv("AZURE_OPENAI_API_KEY"),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
                azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
            )
            deployments = client.deployments.list()
            logger.info(
                f"Connected to Azure OpenAI. Deployment count: {len(deployments.data)}"
            )
            return True
        except Exception as e:
            logger.error(f"Azure connection test failed: {str(e)}")
            return False


@CrewBase
class EmailResponseCrew:
    """Crew for processing property inquiry emails and generating responses"""

    def __init__(
        self, email_content, email_subject, agent_properties, workflow_actions
    ):
        # Verify Azure config before anything else
        try:
            AzureLLMConfig.verify_config()
            if not AzureLLMConfig.test_connection():
                raise ValueError("Azure OpenAI connection test failed")
        except Exception as e:
            logger.error(f"Configuration error: {str(e)}")
            raise

        logger.info("Initializing EmailResponseCrew")
        self.email_content = email_content.strip()
        self.email_subject = email_subject.strip()
        self.agent_properties = agent_properties
        self.workflow_actions = workflow_actions
        self.matched_property = workflow_actions.get("matched_property")
        self.inquiry_type = None

        # Initialize Langfuse
        self._init_langfuse()

        # Log initialization info
        logger.info(f"Processing email - Subject: {self.email_subject}")
        logger.info(
            f"Matched property: {self.matched_property.get('web_reference') if self.matched_property else 'None'}"
        )

    def _init_langfuse(self):
        """Initialize Langfuse observability"""
        self.langfuse = None
        if os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY"):
            try:
                self.langfuse = Langfuse(
                    public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
                    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
                    host=os.getenv("LANGFUSE_HOST", "http://localhost:3000"),
                    debug=False,
                )
                logger.info("Langfuse initialized successfully")
            except Exception as e:
                logger.warning(f"Langfuse init failed: {str(e)}")

    def log_observability_event(self, step: str, data: dict, event_type: str = "info"):
        """Log structured observability events"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "step": step,
            "event_type": event_type,
            "data": data,
        }
        logger.info(f"[OBSERVABILITY] {json.dumps(log_entry)}")

        if self.langfuse:
            try:
                trace = self.langfuse.trace(
                    name=step,
                    input=data,
                    metadata={"event_type": event_type},
                )
                trace.update(output=data)
            except Exception as e:
                logger.warning(f"Langfuse logging error: {str(e)}")

    @agent
    def inquiry_classifier(self) -> Agent:
        """Agent for classifying inquiry types"""
        return Agent(
            role="Inquiry Classifier",
            goal="Accurately classify property inquiries",
            backstory="Expert at understanding customer intent in real estate communications.",
            verbose=True,
            allow_delegation=False,
            llm_config=AzureLLMConfig.get_llm_config(),
            memory=False,
            max_rpm=5,
        )

    @agent
    def response_writer(self) -> Agent:
        """Agent for writing responses"""
        return Agent(
            role="Response Writer",
            goal="Write professional property inquiry responses",
            backstory="Skilled at crafting responses that convert inquiries to viewings.",
            verbose=True,
            allow_delegation=False,
            llm_config=AzureLLMConfig.get_llm_config(),
            memory=False,
            max_rpm=5,
        )

    @agent
    def response_validator(self) -> Agent:
        """Agent for validating responses"""
        return Agent(
            role="Response Validator",
            goal="Ensure responses are accurate and professional",
            backstory="Detail-oriented QA specialist for real estate communications.",
            verbose=True,
            allow_delegation=False,
            llm_config={**AzureLLMConfig.get_llm_config(), "temperature": 0.2},
            memory=False,
            max_rpm=5,
        )

    @task
    def classify_inquiry_task(self) -> Task:
        """Task for classifying the inquiry type"""
        try:
            prompt = f"""Classify this property inquiry:
            
            Subject: {self.email_subject}
            Content: {self.email_content}
            
            Categories:
            1. viewing_request - Customer wants to view the property
            2. availability_check - Asking about availability
            3. general_info - General inquiry
            
            Return JSON format: {{"inquiry_type": "<category>"}}"""

            task = Task(
                description=prompt,
                expected_output="JSON with inquiry_type",
                agent=self.inquiry_classifier(),
                context=[{"role": "user", "content": prompt}],
            )

            self.log_observability_event(
                "task_created", {"task": "classify_inquiry", "status": "success"}
            )
            return task

        except Exception as e:
            self.log_observability_event(
                "task_failed", {"task": "classify_inquiry", "error": str(e)}, "error"
            )
            logger.error(f"Task creation failed: {traceback.format_exc()}")
            raise

    @task
    def generate_response_task(self) -> Task:
        """Task for generating responses"""
        if not self.matched_property:
            raise ValueError("No matched property for response generation")

        try:
            prompt = f"""Generate response for:
            
            Property: {self.matched_property['address']}
            Reference: {self.matched_property['web_reference']}
            Inquiry: {self.email_content}
            
            Include:
            - Property details
            - Application link
            - Professional tone
            
            Return JSON format: {{"response": {{"subject": "...", "body": "..."}}}}"""

            task = Task(
                description=prompt,
                expected_output="JSON with email response",
                agent=self.response_writer(),
                context=[{"role": "user", "content": prompt}],
            )

            self.log_observability_event(
                "task_created", {"task": "generate_response", "status": "success"}
            )
            return task

        except Exception as e:
            self.log_observability_event(
                "task_failed", {"task": "generate_response", "error": str(e)}, "error"
            )
            logger.error(f"Response task failed: {traceback.format_exc()}")
            raise

    @crew
    def crew(self) -> Crew:
        """Create and configure the crew"""
        try:
            # Create tasks
            classify_task = self.classify_inquiry_task()
            response_task = self.generate_response_task()

            # Create crew
            crew = Crew(
                agents=[self.inquiry_classifier(), self.response_writer()],
                tasks=[classify_task, response_task],
                process=Process.sequential,
                verbose=True,
                memory=False,
                max_rpm=10,
            )

            self.log_observability_event(
                "crew_created", {"agents": 2, "tasks": 2, "status": "success"}
            )
            return crew

        except Exception as e:
            self.log_observability_event("crew_failed", {"error": str(e)}, "error")
            logger.error(f"Crew creation failed: {traceback.format_exc()}")
            raise


def process_email_with_crew(
    email_content, email_subject, agent_properties, workflow_actions
):
    """Main processing function"""
    try:
        # Input validation
        if not all([email_content, email_subject, agent_properties]):
            raise ValueError("Missing required input parameters")

        logger.info("Creating crew instance")
        crew_instance = EmailResponseCrew(
            email_content=email_content,
            email_subject=email_subject,
            agent_properties=agent_properties,
            workflow_actions=workflow_actions,
        )

        logger.info("Starting crew execution")
        result = crew_instance.crew().kickoff()

        # Process results
        if isinstance(result, dict):
            return {
                "success": True,
                "response": result.get("response"),
                "inquiry_type": result.get("inquiry_type"),
                "error": None,
            }
        return {
            "success": True,
            "response": {"subject": f"Re: {email_subject}", "body": str(result)},
            "inquiry_type": None,
            "error": None,
        }

    except Exception as e:
        logger.error(f"Processing failed: {traceback.format_exc()}")
        return {
            "success": False,
            "response": None,
            "inquiry_type": None,
            "error": str(e),
        }
