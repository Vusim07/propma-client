from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from typing import Dict, List, Any, Optional
import json
import logging
import re
import rapidfuzz.fuzz as fuzz

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


@CrewBase
class EmailResponseCrew:
    """Crew for processing property inquiry emails and generating responses"""

    def __init__(
        self, email_content, email_subject, agent_properties, workflow_actions
    ):
        self.email_content = (
            email_content.lower()
        )  # Convert to lowercase for case-insensitive matching
        self.email_subject = (
            email_subject.lower()
        )  # Convert to lowercase for case-insensitive matching
        self.agent_properties = agent_properties
        self.workflow_actions = workflow_actions
        self.matched_property = None
        # Log initialization data
        logger.info("Initializing EmailResponseCrew")
        logger.info(f"Email subject: {self.email_subject}")
        logger.info(f"Email content: {self.email_content}")
        logger.info(f"Number of available properties: {len(agent_properties)}")
        logger.info(
            f"Properties to match against: {json.dumps(agent_properties, indent=2)}"
        )
        logger.info(f"Workflow actions: {json.dumps(workflow_actions, indent=2)}")

    @agent
    def email_analyzer(self):
        """Creates an agent that analyzes email content to identify property inquiries"""
        return Agent(
            role="Email Analyzer",
            goal="Extract property details from inquiry emails and match to existing properties",
            backstory="I am an expert at understanding customer inquiries and matching them to property listings by identifying property references, addresses, and web references in the email content",
            verbose=True,
        )

    @agent
    def response_writer(self):
        """Creates an agent that writes personalized responses to property inquiries"""
        return Agent(
            role="Response Writer",
            goal="Write personalized, helpful responses to property inquiries",
            backstory="I am skilled at crafting professional and engaging responses that convert inquiries to applications",
            verbose=True,
        )

    @agent
    def inquiry_classifier(self):
        """Classifies the inquiry type (viewing, availability, general info)"""
        return Agent(
            role="Inquiry Classifier",
            goal="Classify the type of property inquiry (viewing, availability, general info)",
            backstory="I am an expert at understanding the intent behind real estate emails.",
            verbose=True,
        )

    @agent
    def response_validator(self):
        """Validates the generated response for accuracy, tone, and completeness"""
        return Agent(
            role="Response Validator",
            goal="Ensure the generated response is accurate, professional, and complete",
            backstory="I am a detail-oriented QA specialist for real estate communications.",
            verbose=True,
        )

    @task
    def analyze_email_task(self) -> Task:
        """Task for analyzing email content"""
        property_info = []
        logger.info("Preparing property information for analysis")

        for prop in self.agent_properties:
            # Create a detailed string for each property
            info = {
                "id": prop["id"],
                "full_address": prop["address"],
                "suburb": prop.get("suburb", ""),
                "city": prop.get("city", ""),
                "web_reference": prop.get("web_reference", ""),
                "application_link": prop.get("application_link", ""),
                "description": prop.get("description", ""),
                "rent": prop.get("monthly_rent", 0),
            }
            property_info.append(info)
            logger.info(f"Prepared property info: {json.dumps(info, indent=2)}")

        return Task(
            description=f"""Analyze this email to identify which property is being inquired about:

Subject: {self.email_subject}

Content:
{self.email_content}

Match against these properties:
{json.dumps(property_info, indent=2)}

Important matching rules:
1. Match on exact web reference number (e.g. 'RR123456', case insensitive)
2. Match on full or partial address
3. Match on street name
4. Consider suburb/city combinations
5. Consider property descriptions

Output must be a valid JSON object with a 'property' key containing the matched property details.""",
            agent=self.email_analyzer(),
            expected_output="A JSON object with a 'property' key containing the matched property details.",
        )

    @task
    def generate_response_task(self) -> Task:
        """Task for generating a response with application link"""
        if not self.matched_property:
            raise ValueError("No property matched from email analysis")

        custom_message = self.workflow_actions.get("custom_message", "")
        return Task(
            description=f"Generate a professional response to the inquiry about {self.matched_property['address']}. Include the application link {self.matched_property['application_link']}. Base your response on this template if provided: {custom_message}",
            agent=self.response_writer(),
            expected_output="A JSON object with a 'response' key containing the reply message.",
        )

    @task
    def classify_inquiry_task(self) -> Task:
        """Task for classifying the inquiry type"""
        return Task(
            description=f"""Classify the following email as one of: viewing_request, availability_check, general_info.\n\nSubject: {self.email_subject}\nContent: {self.email_content}\n\nReturn a JSON object: {{'inquiry_type': ...}}""",
            agent=self.inquiry_classifier(),
            expected_output="A JSON object with an 'inquiry_type' key.",
        )

    @task
    def validate_response_task(self, response: dict) -> Task:
        """Task for validating the generated response"""
        return Task(
            description=f"""Validate the following response for factual accuracy, professional tone, and completeness.\n\nResponse: {json.dumps(response)}\n\nOriginal Email: {self.email_content}\n\nReturn a JSON object: {{'pass': true/false, 'confidence': 0.0-1.0, 'details': ...}}""",
            agent=self.response_validator(),
            expected_output="A JSON object with pass, confidence, and details.",
        )

    def process_task_output(self, task_name: str, output: Any) -> None:
        """Process task outputs and store necessary data"""
        if task_name == "analyze_email_task":
            logger.info(f"Processing task output for {task_name}")
            logger.info(f"Task output: {output}")

            # First try parsing the AI output
            if isinstance(output, dict) and "property" in output:
                logger.info("Found property in dictionary output")
                self.matched_property = output["property"]
            elif isinstance(output, str):
                try:
                    logger.info("Attempting to parse string output as JSON")
                    result = json.loads(output)
                    if "property" in result:
                        logger.info("Found property in parsed JSON")
                        self.matched_property = result["property"]
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse JSON: {e}")
                    pass  # We'll handle fallback matching below

            # If no match found yet, try direct matching
            if not self.matched_property:
                logger.info(
                    "No property matched from AI output, trying direct matching"
                )

                # Combine subject and content for matching
                combined_text = f"{self.email_subject} {self.email_content}".lower()
                logger.info(f"Combined text for matching: {combined_text}")

                for prop in self.agent_properties:
                    # Convert all values to lowercase for case-insensitive matching
                    web_ref = (prop.get("web_reference", "") or "").lower()
                    address = prop["address"].lower()
                    street_name = " ".join(prop["address"].split()[1:]).lower()

                    logger.info(
                        f"Checking property - Web Reference: {web_ref}, Address: {address}, Street: {street_name}"
                    )

                    # Try matching different patterns against combined text
                    if web_ref and re.search(
                        rf"\b{re.escape(web_ref)}\b", combined_text
                    ):
                        logger.info(f"Matched by web reference: {web_ref}")
                        self.matched_property = prop
                        break
                    elif fuzz.partial_ratio(address, combined_text) > 80:
                        logger.info(f"Matched by fuzzy address: {address}")
                        self.matched_property = prop
                        break
                    elif fuzz.partial_ratio(street_name, combined_text) > 80:
                        logger.info(f"Matched by fuzzy street name: {street_name}")
                        self.matched_property = prop
                        break

            if self.matched_property:
                logger.info(
                    f"Successfully matched property: {json.dumps(self.matched_property, indent=2)}"
                )
            else:
                logger.error("No property matched from email analysis")
                raise ValueError("No property matched from email analysis")

    @crew
    def crew(self) -> Crew:
        """Create the crew for email response generation with classification and validation"""
        analyze_task = self.analyze_email_task()
        classify_task = self.classify_inquiry_task()
        response_task = self.generate_response_task()

        def after_analysis(task_output):
            self.process_task_output("analyze_email_task", task_output)
            return classify_task

        def after_classification(task_output):
            # Optionally store classification result for downstream use
            self.inquiry_type = None
            if isinstance(task_output, dict) and "inquiry_type" in task_output:
                self.inquiry_type = task_output["inquiry_type"]
            elif isinstance(task_output, str):
                try:
                    result = json.loads(task_output)
                    if "inquiry_type" in result:
                        self.inquiry_type = result["inquiry_type"]
                except Exception:
                    pass
            return response_task

        def after_response(task_output):
            # Validate the response
            return self.validate_response_task(task_output)

        analyze_task.on_complete(after_analysis)
        classify_task.on_complete(after_classification)
        response_task.on_complete(after_response)

        return Crew(
            agents=[
                self.email_analyzer(),
                self.inquiry_classifier(),
                self.response_writer(),
                self.response_validator(),
            ],
            tasks=[analyze_task],
            process=Process.sequential,
            verbose=True,
        )


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
        # Ensure output is structured
        if isinstance(result, dict):
            if "response" in result and isinstance(result["response"], dict):
                return result
            # If only a string, wrap as body
            return {
                "response": {"subject": f"Re: {email_subject}", "body": str(result)},
                "error": None,
            }
        return {
            "response": {"subject": f"Re: {email_subject}", "body": str(result)},
            "error": None,
        }
    except Exception as e:
        logger.error(f"CrewAI email agent failed: {str(e)}")
        return {"response": "", "error": str(e)}
