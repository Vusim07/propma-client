from crewai import Agent, Crew, Process, Task, LLM
from crewai.project import CrewBase, agent, crew, task  # <-- Added missing import
from typing import Dict, List, Any, Optional
import json
import logging
import os
import traceback
import sys
from datetime import datetime
from src.email_response_config import setup_config

# Configure logging
logger = logging.getLogger(__name__)
handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Setup Azure OpenAI configuration
setup_config()

# Setup Azure OpenAI LLM
azure_llm = LLM(
    model="azure/gpt-4o-mini",  # or your deployment name
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_base=os.getenv("AZURE_OPENAI_ENDPOINT"),
    api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
    temperature=0.7,
)


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

        # Only log to standard logger (Langfuse logging removed)
        # logger.info(f"[OBSERVABILITY] {json.dumps(log_entry, default=str)}")

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
            llm=azure_llm,
            tools=[],
            memory=False,
            max_rpm=5,
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
            llm=azure_llm,
            tools=[],
            memory=False,
            max_rpm=5,
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
            llm=azure_llm,
            tools=[],
            memory=False,
            max_rpm=5,
        )

    @task
    def classify_inquiry_task(self) -> Task:
        """Task for classifying the inquiry type"""
        try:
            context = [
                {
                    "role": "system",
                    "content": "You are an expert at classifying property inquiries.",
                    "description": "System prompt for classification",
                    "expected_output": "A valid JSON object containing the inquiry_type.",
                },
                {
                    "role": "user",
                    "content": f"Subject: {self.email_subject}\nContent: {self.email_content}",
                    "description": "Property inquiry details for classification",
                    "expected_output": "A valid JSON object containing the inquiry_type.",
                },
            ]

            logger.info(f"Task context created: {json.dumps(context, indent=2)}")

            try:
                task = Task(
                    description=f"""Classify the type of property inquiry from this email exchange.\nSubject: {self.email_subject}\nContent: {self.email_content}\n\nAnalyze the email content and determine if this is:\n1. viewing_request: Customer wants to view the property\n2. availability_check: Customer is asking about availability\n3. general_info: General inquiry about the property\n\nIMPORTANT: Return ONLY a valid JSON object with this exact format:\n{{"inquiry_type": "viewing_request" | "availability_check" | "general_info"}}""",
                    expected_output="A valid JSON object containing the inquiry_type.",
                    agent=self.inquiry_classifier(),
                    context=context,
                )
            except Exception as llm_error:
                logger.error(
                    f"LLM call failed in classify_inquiry_task: {str(llm_error)}"
                )
                # Removed faulty .llm_config access here as well.
                logger.error(f"Prompt context: {json.dumps(context, indent=2)}")
                logger.error(f"Stack trace: {traceback.format_exc()}")
                raise

            logger.info("Classification task created successfully")
            self.log_observability_event(
                "task_creation",
                {"task": "classify_inquiry", "context": context, "status": "success"},
            )

            return task

        except Exception as e:
            logger.error(f"Error creating classification task: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            self.log_observability_event(
                "task_creation_error",
                {
                    "task": "classify_inquiry",
                    "error": str(e),
                    "stack_trace": traceback.format_exc(),
                },
                "error",
            )
            raise

    @task
    def generate_response_task(self) -> Task:
        """Task for generating response with application link"""
        try:
            if not self.matched_property:
                raise ValueError("No matched_property provided to response task!")

            logger.info("Creating response generation task...")

            # Prepare property context
            property_context = {
                "address": self.matched_property["address"],
                "web_reference": self.matched_property["web_reference"],
                "status": self.matched_property["status"],
                "application_link": self.matched_property["application_link"],
            }

            # Create context as a list of dictionaries
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

            logger.info(
                f"Response task context created: {json.dumps(context, indent=2)}"
            )  # Get agent details from workflow actions
            agent_name = self.workflow_actions.get("agent_name", "Amara Agent")
            agent_contact = self.workflow_actions.get("agent_contact", "")

            task = Task(
                description=f"""Generate a professional, POPI-compliant response to this property inquiry.\n\nEmail Subject: {self.email_subject}\nEmail Content: {self.email_content}\nInquiry Type: {self.inquiry_type}\n\nProperty Details:\n{json.dumps(property_context, indent=2)}\n\nAgent Details:\nName: {agent_name}\nContact: {agent_contact}\n\nResponse Requirements (MUST INCLUDE ALL):\n1. Address: {property_context["address"]}\n2. Property reference: {property_context["web_reference"]}\n3. Application link: {property_context["application_link"]}\n4. Be friendly and professional\n5. Follow South African business etiquette\n6. Use "Hi" for greeting (not "Dear [Name]")\n7. Include agent name and contact in signature\n\nIMPORTANT: You MUST copy and paste the address, property reference, and application link EXACTLY as provided above into the response body. Do not paraphrase or omit them.\n\nEXAMPLE RESPONSE (format):\n{{\n    \"response\": {{\n        \"subject\": \"Re: Property Inquiry - {property_context["web_reference"]}\",\n        \"body\": \"Hi,\\n\\nThank you for your interest in the property at {property_context["address"]} (Reference: {property_context["web_reference"]}).\\n\\nThe property is available. You can schedule an appointment here: {property_context["application_link"]}\\n\\nBest regards,\\n{agent_name}\\n{agent_contact}\"\n    }}\n}}\n\nIMPORTANT: Return ONLY a valid JSON object with this exact format:\n{{\n    \"response\": {{\n        \"subject\": \"Re: ...\",\n        \"body\": \"Hi,\\n\\nThank you... [INCLUDE address, web reference, and application link here]\\n\\nBest regards,\\nAgent Amara on behalf of {agent_name}\\n{agent_contact}\"\n    }}\n}}""",
                expected_output="A valid JSON object with response.subject and response.body",
                agent=self.response_writer(),
                context=context,
            )

            logger.info("Response generation task created successfully")
            self.log_observability_event(
                "task_creation",
                {"task": "generate_response", "context": context, "status": "success"},
            )

            return task

        except Exception as e:
            logger.error(f"Error creating response generation task: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            self.log_observability_event(
                "task_creation_error",
                {
                    "task": "generate_response",
                    "error": str(e),
                    "stack_trace": traceback.format_exc(),
                },
                "error",
            )
            raise

    @task
    def validate_response_task(self) -> Task:
        """Task for validating the generated response"""
        try:
            if not self.matched_property:
                raise ValueError("No matched_property provided to validation task")

            logger.info("Creating validation task...")

            # Create context as a list of dictionaries
            context = [
                {
                    "role": "system",
                    "content": "You are an expert at validating property inquiry responses.",
                    "description": "System prompt for response validation",
                    "expected_output": "A valid JSON object with validation results",
                },
                {
                    "role": "user",
                    "content": f"Property Details: {json.dumps(self.matched_property, indent=2)}\nInquiry Type: {self.inquiry_type}",
                    "description": "Property details and inquiry type for validation",
                    "expected_output": "A valid JSON object with validation results",
                },
            ]

            logger.info(
                f"Validation task context created: {json.dumps(context, indent=2)}"
            )

            task = Task(
                description=f"""Validate this email response for accuracy, professionalism, and completeness.

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
                expected_output="A valid JSON object with validation results",
                agent=self.response_validator(),
                context=context,
            )

            logger.info("Validation task created successfully")
            self.log_observability_event(
                "task_creation",
                {"task": "validate_response", "context": context, "status": "success"},
            )

            return task

        except Exception as e:
            logger.error(f"Error creating validation task: {str(e)}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            self.log_observability_event(
                "task_creation_error",
                {
                    "task": "validate_response",
                    "error": str(e),
                    "stack_trace": traceback.format_exc(),
                },
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
                except Exception:
                    logger.warning("Result string could not be parsed as JSON")

            # Extract response from tasks_output if present
            if isinstance(result, dict):
                # If response is already present and non-empty, use it
                if result.get("response") and result["response"]:
                    final_data["response"] = result["response"]
                # Otherwise, try to extract from tasks_output
                elif "tasks_output" in result and isinstance(
                    result["tasks_output"], list
                ):
                    for task in result["tasks_output"]:
                        if (
                            task.get("name") == "generate_response_task"
                            and "raw" in task
                        ):
                            try:
                                raw_obj = json.loads(task["raw"])
                                if raw_obj.get("response"):
                                    final_data["response"] = raw_obj["response"]
                                    break
                            except Exception as e:
                                logger.warning(
                                    f"Failed to parse generate_response_task raw: {e}"
                                )
                # Fallback: if raw is present at top level
                elif "raw" in result:
                    try:
                        raw_obj = json.loads(result["raw"])
                        if raw_obj.get("response"):
                            final_data["response"] = raw_obj["response"]
                    except Exception as e:
                        logger.warning(f"Failed to parse top-level raw: {e}")

            # Validate required fields
            if final_data["response"]:
                final_data["success"] = True

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
            logger.info("Starting crew setup...")

            # Create tasks with error handling
            try:
                classify_task = self.classify_inquiry_task()
                logger.info("Classification task created successfully")
            except Exception as e:
                logger.error(f"Failed to create classification task: {str(e)}")
                raise

            try:
                response_task = self.generate_response_task()
                logger.info("Response task created successfully")
            except Exception as e:
                logger.error(f"Failed to create response task: {str(e)}")
                raise

            try:
                validate_task = self.validate_response_task()
                logger.info("Validation task created successfully")
            except Exception as e:
                logger.error(f"Failed to create validation task: {str(e)}")
                raise

            # Create agents with error handling
            try:
                agents = [
                    self.inquiry_classifier(),
                    self.response_writer(),
                    self.response_validator(),
                ]
                logger.info("All agents created successfully")
            except Exception as e:
                logger.error(f"Failed to create agents: {str(e)}")
                raise

            # Create the crew with sequential process
            crew = Crew(
                agents=agents,
                tasks=[classify_task, response_task, validate_task],
                process=Process.sequential,
                verbose=True,
                callbacks=[self.process_results],
                memory=False,  # Disable memory to avoid vector search issues
                max_rpm=10,  # Rate limiting for API calls
                cache=True,  # Enable caching for better performance
                temperature=0.7,  # Default temperature for the crew
                max_iterations=3,  # Maximum number of iterations for task completion
                timeout=300,  # Timeout in seconds for the entire crew execution
                retry_on_failure=True,  # Enable retry on task failure
                retry_attempts=2,  # Number of retry attempts
                observability=True,  # Enable detailed observability
            )

            logger.info(
                f"Created crew with {len([classify_task, response_task, validate_task])} tasks"
            )
            self.log_observability_event(
                "crew_creation",
                {
                    "num_tasks": len([classify_task, response_task, validate_task]),
                    "agent_count": len(agents),
                    "process_type": "sequential",
                },
            )

            return crew

        except Exception as e:
            error_msg = f"Error creating crew: {str(e)}"
            logger.error(error_msg)
            logger.error(f"Stack trace: {traceback.format_exc()}")
            self.log_observability_event(
                "crew_creation_error",
                {"error": str(e), "stack_trace": traceback.format_exc()},
                "error",
            )
            raise ValueError(error_msg)


def extract_inquiry_type_from_result(result):
    """Robustly extract inquiry_type from CrewAI output (CrewOutput, TaskOutput, dict, or str)."""
    # CrewOutput or TaskOutput object
    if hasattr(result, "raw"):
        try:
            data = json.loads(result.raw)
            if "inquiry_type" in data:
                return data["inquiry_type"]
        except Exception:
            pass
    # tasks_output list
    if hasattr(result, "tasks_output"):
        for task in result.tasks_output:
            if hasattr(task, "raw"):
                try:
                    data = json.loads(task.raw)
                    if "inquiry_type" in data:
                        return data["inquiry_type"]
                except Exception:
                    continue
    # dict
    if isinstance(result, dict):
        if "inquiry_type" in result:
            return result["inquiry_type"]
        if "raw" in result:
            try:
                data = json.loads(result["raw"])
                if "inquiry_type" in data:
                    return data["inquiry_type"]
            except Exception:
                pass
    # string
    if isinstance(result, str):
        try:
            data = json.loads(result)
            if "inquiry_type" in data:
                return data["inquiry_type"]
        except Exception:
            pass
    return None


def _ensure_serializable(obj):
    """Ensure the object is JSON serializable"""
    if hasattr(obj, "dict"):
        return obj.dict()
    elif hasattr(obj, "__dict__"):
        return obj.__dict__
    elif isinstance(obj, (list, tuple)):
        return [_ensure_serializable(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: _ensure_serializable(v) for k, v in obj.items()}
    return obj


def process_email_with_crew(
    email_content: str,
    email_subject: str,
    agent_properties: List[Dict[str, Any]],
    workflow_actions: Dict[str, Any],
) -> Dict[str, Any]:
    """Process an email and generate a response using CrewAI"""
    try:
        # Input validation
        if not email_content or not email_subject:
            raise ValueError("Missing required email content or subject")

        if not agent_properties:
            raise ValueError("No properties provided for agent")

        if not workflow_actions:
            raise ValueError("No workflow actions provided")

        logger.info("Creating EmailResponseCrew instance...")
        crew_instance = EmailResponseCrew(
            email_content=email_content,
            email_subject=email_subject,
            agent_properties=agent_properties,
            workflow_actions=workflow_actions,
        )

        logger.info("Initializing crew...")
        crew = crew_instance.crew()

        logger.info("Starting crew execution...")
        result = crew.kickoff()  # This runs all tasks in sequence

        # Convert result to serializable format
        serialized_result = _ensure_serializable(result)

        # Ensure we have a response object
        if not serialized_result.get("response"):
            for task in serialized_result.get("tasks_output", []):
                if task.get("name") == "generate_response_task":
                    try:
                        response_data = json.loads(task.get("raw", "{}"))
                        if "response" in response_data:
                            serialized_result["response"] = response_data["response"]
                            break
                    except:
                        continue

        logger.info(f"Serialized result: {json.dumps(serialized_result, indent=2)}")

        # Validate final output structure
        if not serialized_result.get("response"):
            logger.error("No response found in serialized result")
            return {
                "success": False,
                "error": "No response generated",
                "raw": serialized_result,
            }

        return serialized_result

    except ValueError as ve:
        logger.error(f"Validation error in email processing: {str(ve)}")
        return {
            "success": False,
            "error": str(ve),
            "response": {},
            "validation": None,
            "inquiry_type": None,
        }
    except Exception as e:
        error_msg = f"CrewAI email agent failed: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Stack trace: {traceback.format_exc()}")
        return {
            "success": False,
            "error": error_msg,
            "response": {},
            "validation": None,
            "inquiry_type": None,
        }
