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

# Configure logging
logger = logging.getLogger(__name__)
handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)


@CrewBase
class EmailResponseCrew:
    """Crew for processing property inquiry emails and generating responses"""

    def __init__(
        self, email_content, email_subject, agent_properties, workflow_actions
    ):
        logger.info("Initializing EmailResponseCrew")
        self.email_content = email_content.strip()
        self.email_subject = email_subject.strip()
        self.agent_properties = agent_properties
        self.workflow_actions = workflow_actions
        self.matched_property = workflow_actions.get("matched_property")
        self.inquiry_type = None

        # Initialize Langfuse with debug logging
        self.langfuse = None
        logger.info("[Langfuse] Attempting to initialize Langfuse SDK...")
        try:
            self.langfuse = Langfuse(
                public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
                secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
                host=os.getenv("LANGFUSE_HOST", "http://localhost:3000"),
                debug=False,
            )
            logger.info("[Langfuse] Langfuse SDK initialized successfully.")
        except Exception as e:
            logger.error(f"[Langfuse] Langfuse initialization failed: {e}")

        # Log initialization info
        logger.info(f"Email subject: {self.email_subject}")
        logger.info(f"Email content: {self.email_content}")
        logger.info(f"Number of available properties: {len(agent_properties)}")
        logger.info(f"Workflow actions: {json.dumps(workflow_actions, indent=2)}")

        if self.matched_property:
            logger.info(
                f"Matched property provided: {json.dumps(self.matched_property, indent=2)}"
            )
        else:
            logger.warning("No matched_property provided in workflow_actions!")

        # Prepare initial context
        self.context_data = self._prepare_context()
        self.log_observability_event("initialization", self.context_data)

    def _prepare_context(self) -> dict:
        """Prepare context data for tasks"""
        return {
            "email_subject": self.email_subject,
            "email_content": self.email_content,
            "matched_property": self.matched_property,
            "agent_properties": self.agent_properties,
            "workflow_actions": {
                k: v
                for k, v in self.workflow_actions.items()
                if k not in ["matched_property"]
            },
        }

    def log_observability_event(self, step: str, data: dict, event_type: str = "info"):
        """Log structured observability/monitoring events"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "step": step,
            "event_type": event_type,
            "data": data,
        }
        logger.info(f"[OBSERVABILITY] {json.dumps(log_entry, default=str)}")
        if self.langfuse:
            try:
                trace = self.langfuse.trace(
                    name=step,
                    input=data,
                    metadata={"event_type": event_type},
                )
                if hasattr(trace, "flush"):
                    trace.flush(output=data)
                elif hasattr(trace, "finalize"):
                    trace.finalize(output=data)
            except Exception as e:
                logger.warning(f"Langfuse trace logging failed: {e}")

    @agent
    def response_writer(self) -> Agent:
        """Agent for writing personalized responses to property inquiries"""
        return Agent(
            role="Response Writer",
            goal="Write personalized, helpful responses to property inquiries",
            backstory="""I am an expert real estate agent skilled at crafting professional and engaging 
                     responses that convert inquiries to viewings and applications. I am familiar with 
                     South African real estate standards and POPI Act compliance.""",
            verbose=True,
            allow_delegation=False,
        )

    @agent
    def inquiry_classifier(self) -> Agent:
        """Agent for classifying inquiry types"""
        return Agent(
            role="Inquiry Classifier",
            goal="Accurately classify the type of property inquiry",
            backstory="""I am an expert at understanding customer intent in real estate emails.
                     I can determine if they want to view a property, check availability, or need general info.""",
            verbose=True,
            allow_delegation=False,
        )

    @agent
    def response_validator(self) -> Agent:
        """Agent for validating generated responses"""
        return Agent(
            role="Response Validator",
            goal="Ensure responses are accurate, professional, and complete",
            backstory="""I am a detail-oriented QA specialist who ensures all responses are factually correct,
                     professionally written, and include all required information.""",
            verbose=True,
            allow_delegation=False,
        )

    @task
    def classify_inquiry_task(self) -> Task:
        """Task for classifying the inquiry type"""
        try:
            task_config = {
                "description": f"""Classify the type of property inquiry from this email exchange.
                    Subject: {self.email_subject}
                    Content: {self.email_content}
                    
                    Analyze the email content and determine if this is:
                    1. viewing_request: Customer wants to view the property
                    2. availability_check: Customer is asking about availability
                    3. general_info: General inquiry about the property
                    
                    IMPORTANT: Return ONLY a valid JSON object with this exact format:
                    {{"inquiry_type": "viewing_request" | "availability_check" | "general_info"}}""",
                "expected_output": "A valid JSON object containing the inquiry_type.",
            }

            logger.info("Creating classification task with config")
            self.log_observability_event(
                "task_creation", {"task": "classify_inquiry", "config": task_config}
            )

            # Create context as a list of properly formatted items
            context = [
                {
                    "role": "system",
                    "content": "You are an expert at classifying property inquiries.",
                    "description": "System prompt for inquiry classification",
                    "expected_output": "A valid JSON object containing the inquiry_type.",
                },
                {
                    "role": "user",
                    "content": f"Subject: {self.email_subject}\nContent: {self.email_content}",
                    "description": "Email content to classify",
                    "expected_output": "A valid JSON object containing the inquiry_type.",
                },
            ]

            return Task(
                description=task_config["description"],
                expected_output=task_config["expected_output"],
                agent=self.inquiry_classifier(),
                context=context,
            )
        except Exception as e:
            logger.error(f"Error creating classification task: {str(e)}")
            self.log_observability_event(
                "task_creation_error",
                {"task": "classify_inquiry", "error": str(e)},
                "error",
            )
            raise

    @task
    def generate_response_task(self) -> Task:
        """Task for generating response with application link"""
        try:
            if not self.matched_property:
                raise ValueError("No matched_property provided to response task!")

            # Prepare property context
            property_context = {
                "address": self.matched_property["address"],
                "web_reference": self.matched_property["web_reference"],
                "status": self.matched_property["status"],
                "application_link": self.matched_property["application_link"],
            }

            task_config = {
                "description": f"""Generate a professional, POPI-compliant response to this property inquiry.
                    
                    Email Subject: {self.email_subject}
                    Email Content: {self.email_content}
                    Inquiry Type: {self.inquiry_type}
                    
                    Property Details:
                    {json.dumps(property_context, indent=2)}
                    
                    Response Requirements (MUST INCLUDE ALL):
                    1. Address: {property_context["address"]}
                    2. Property reference: {property_context["web_reference"]}
                    3. Application link: {property_context["application_link"]}
                    4. Be friendly and professional
                    5. Follow South African business etiquette
                    
                    IMPORTANT: Return ONLY a valid JSON object with this exact format:
                    {{
                        "response": {{
                            "subject": "Re: ...",
                            "body": "Dear [Name],\\n\\nThank you..."
                        }}
                    }}""",
                "expected_output": "A valid JSON object with response.subject and response.body",
            }

            logger.info("Creating response generation task with config")
            self.log_observability_event(
                "task_creation", {"task": "generate_response", "config": task_config}
            )

            # Create context as a list of properly formatted items
            context = [
                {
                    "role": "system",
                    "content": "You are an expert at writing professional property inquiry responses.",
                    "description": "System prompt for response generation",
                    "expected_output": "A valid JSON object with response.subject and response.body",
                },
                {
                    "role": "user",
                    "content": f"Property Details: {json.dumps(property_context, indent=2)}\nInquiry Type: {self.inquiry_type}",
                    "description": "Property details and inquiry type for response generation",
                    "expected_output": "A valid JSON object with response.subject and response.body",
                },
            ]

            return Task(
                description=task_config["description"],
                expected_output=task_config["expected_output"],
                agent=self.response_writer(),
                context=context,
            )
        except Exception as e:
            logger.error(f"Error creating response generation task: {str(e)}")
            self.log_observability_event(
                "task_creation_error",
                {"task": "generate_response", "error": str(e)},
                "error",
            )
            raise

    @task
    def validate_response_task(self) -> Task:
        """Task for validating the generated response"""
        try:
            if not self.matched_property:
                raise ValueError("No matched_property provided to validation task")

            task_config = {
                "description": f"""Validate this email response for accuracy, professionalism, and completeness.

                    Original Email: 
                    {self.email_content}

                    Property Details:
                    {json.dumps(self.matched_property, indent=2)}

                    Validation Requirements:
                    1. Address included: {self.matched_property["address"]}
                    2. Property reference included: {self.matched_property["web_reference"]}
                    3. Application link included: {self.matched_property["application_link"]}

                    IMPORTANT: Return ONLY a valid JSON object with this exact format:
                    {{
                        "pass": true/false,
                        "confidence": 0.0-1.0,
                        "details": {{
                            "factual_pass": true/false,
                            "completeness_pass": true/false,
                            "tone_pass": true/false,
                            "missing_fields": [...],
                            "inquiry_type": "{self.inquiry_type}"
                        }}
                    }}""",
                "expected_output": "A valid JSON object with validation results",
            }

            logger.info("Creating validation task with config")
            self.log_observability_event(
                "task_creation", {"task": "validate_response", "config": task_config}
            )

            # Create context as a list of items
            context = [
                {
                    "role": "system",
                    "content": "You are an expert at validating property inquiry responses.",
                },
                {
                    "role": "user",
                    "content": f"Property Details: {json.dumps(self.matched_property, indent=2)}\nInquiry Type: {self.inquiry_type}",
                },
            ]

            return Task(
                description=task_config["description"],
                expected_output=task_config["expected_output"],
                agent=self.response_validator(),
                context=context,
            )
        except Exception as e:
            logger.error(f"Error creating validation task: {str(e)}")
            self.log_observability_event(
                "task_creation_error",
                {"task": "validate_response", "error": str(e)},
                "error",
            )
            raise

    def process_results(self, event_name: str, **kwargs) -> Dict[str, Any]:
        """Process results after crew kickoff, handling extraction and validation"""
        logger.info(f"========== PROCESS RESULTS STARTED: {event_name} ==========")

        result = kwargs.get("final_result") if event_name == "crew_finished" else None
        if not result:
            logger.warning(f"No result to process for event {event_name}")
            return None

        logger.info(f"Result Type: {type(result)}")
        logger.info(f"Result Preview: {str(result)[:200]}")

        # Initialize default structure
        final_data = {
            "success": False,
            "response": None,
            "validation": {
                "pass": False,
                "confidence": 0.0,
                "details": {
                    "factual_pass": False,
                    "completeness_pass": False,
                    "tone_pass": False,
                    "missing_fields": [],
                    "inquiry_type": None,
                },
            },
        }

        try:
            # Parse raw result if it's a string
            if isinstance(result, str):
                try:
                    result = json.loads(result)
                except json.JSONDecodeError:
                    logger.error("Failed to parse result as JSON")
                    result = {"response": result}

            # Extract response
            if isinstance(result, dict):
                if "response" in result:
                    final_data["response"] = result["response"]
                    logger.info("Successfully extracted response")

                # Extract validation if present
                if "validation" in result:
                    final_data["validation"] = result["validation"]
                    logger.info("Successfully extracted validation")

                # Set success based on validation
                final_data["success"] = (
                    final_data["validation"]["pass"]
                    and final_data["validation"]["confidence"] >= 0.7
                )

            # Validate required fields
            if final_data["response"]:
                logger.info("Validating response completeness...")
                required_fields = [
                    self.matched_property["address"],
                    self.matched_property["application_link"],
                    self.matched_property["web_reference"],
                ]
                missing = []
                response_text = str(final_data["response"])
                for field in required_fields:
                    if field not in response_text:
                        missing.append(field)
                if missing:
                    final_data["validation"]["details"]["missing_fields"] = missing
                    final_data["validation"]["pass"] = False
                    final_data["success"] = False
                    logger.warning(f"Missing required fields: {missing}")

            # Add inquiry type
            final_data["validation"]["details"]["inquiry_type"] = self.inquiry_type

            logger.info(f"Final processed data: {json.dumps(final_data, indent=2)}")
            self.log_observability_event("process_results_end", final_data)
            return final_data

        except Exception as e:
            logger.error(f"Error processing results: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            return final_data

    @crew
    def crew(self) -> Crew:
        """Create the crew with proper task chaining and process management"""
        try:
            # Create tasks
            classify_task = self.classify_inquiry_task()
            response_task = self.generate_response_task()
            validate_task = self.validate_response_task()

            # Create the crew with sequential process
            crew = Crew(
                agents=[
                    self.inquiry_classifier(),
                    self.response_writer(),
                    self.response_validator(),
                ],
                tasks=[classify_task, response_task, validate_task],
                process=Process.sequential,
                verbose=True,
                callbacks=[self.process_results],
            )

            logger.info(f"Created crew with 3 tasks")
            self.log_observability_event("crew_creation", {"num_tasks": 3})
            return crew
        except Exception as e:
            logger.error(f"Error creating crew: {str(e)}")
            self.log_observability_event(
                "crew_creation_error", {"error": str(e)}, "error"
            )
            raise


def process_email_with_crew(
    email_content: str,
    email_subject: str,
    agent_properties: List[Dict[str, Any]],
    workflow_actions: Dict[str, Any],
) -> Dict[str, Any]:
    """Process an email and generate a response using CrewAI

    Args:
        email_content: The body of the email
        email_subject: The subject of the email
        agent_properties: List of properties managed by the agent
        workflow_actions: Actions from the workflow configuration

    Returns:
        Generated email response and additional details
    """
    try:
        crew_instance = EmailResponseCrew(
            email_content=email_content,
            email_subject=email_subject,
            agent_properties=agent_properties,
            workflow_actions=workflow_actions,
        )
        crew = crew_instance.crew()
        result = crew.kickoff()

        # Handle different result formats
        if isinstance(result, dict):
            if workflow_actions.get("classification_only"):
                return result

            if "response" in result:
                if isinstance(result["response"], dict):
                    return {
                        "response": result["response"],
                        "inquiry_type": crew_instance.inquiry_type,
                        "error": None,
                    }
                return {
                    "response": {
                        "subject": f"Re: {email_subject}",
                        "body": result["response"],
                    },
                    "inquiry_type": crew_instance.inquiry_type,
                    "error": None,
                }

        # Handle string or other response types
        return {
            "response": {"subject": f"Re: {email_subject}", "body": str(result)},
            "inquiry_type": crew_instance.inquiry_type,
            "error": None,
        }
    except Exception as e:
        logger.error(f"CrewAI email agent failed: {str(e)}")
        return {"response": "", "error": str(e), "inquiry_type": None}
