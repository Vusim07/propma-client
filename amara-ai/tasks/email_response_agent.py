from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from typing import Dict, List, Any, Optional
import json
import logging
import re

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


@CrewBase
class EmailResponseCrew:
    """Crew for processing property inquiry emails and generating responses"""

    def __init__(
        self,
        email_content: str,
        email_subject: str,
        agent_properties: List[Dict[str, Any]],
        workflow_actions: Dict[str, Any],
        agent_name: str = "Agent",
    ):
        """Initialize the email response crew

        Args:
            email_content: The body of the email to process
            email_subject: The subject of the email
            agent_properties: List of properties managed by the agent
            workflow_actions: Actions defined in the workflow
            agent_name: The agent's name for personalization
        """
        self.email_content = email_content
        self.email_subject = email_subject
        self.agent_properties = agent_properties
        self.workflow_actions = workflow_actions
        self.agent_name = agent_name
        logger.info(
            f"Initialized EmailResponseCrew with {len(agent_properties)} properties"
        )

    @agent
    def email_analyzer(self) -> Agent:
        """Creates an agent that analyzes email content to identify property inquiries"""
        return Agent(
            role="Email Analyzer",
            goal="Extract property details from inquiry emails and match to existing properties",
            backstory="I am an expert at understanding customer inquiries and matching them to property listings. I can identify property references, extract key information, and determine which property a customer is interested in.",
            verbose=True,
        )

    @agent
    def response_writer(self) -> Agent:
        """Creates an agent that writes personalized responses to property inquiries"""
        return Agent(
            role="Response Writer",
            goal="Write personalized, helpful responses to property inquiries",
            backstory="I am skilled at crafting professional and engaging responses that convert inquiries to applications. I write clear, concise messages that build trust and encourage potential tenants to apply.",
            verbose=True,
        )

    @task
    def analyze_email_task(self) -> Task:
        """Task for analyzing email content to identify the property being inquired about"""

        # Format properties for easier matching
        properties_json = []
        for prop in self.agent_properties:
            property_summary = {
                "id": prop.get("id", ""),
                "address": prop.get("address", ""),
                "city": prop.get("city", ""),
                "suburb": prop.get("suburb", ""),
                "property_type": prop.get("property_type", ""),
                "bedrooms": prop.get("bedrooms", 0),
                "bathrooms": prop.get("bathrooms", 0),
                "monthly_rent": prop.get("monthly_rent", 0),
                "application_link": prop.get("application_link", ""),
            }
            properties_json.append(property_summary)

        properties_str = json.dumps(properties_json, indent=2)

        return Task(
            description=f"""
            Analyze the following email to identify which property is being inquired about.
            
            Email Subject: {self.email_subject}
            
            Email Content:
            {self.email_content}
            
            Available Properties:
            {properties_str}
            
            Look for any property references, addresses, or descriptions that match one of the available properties.
            Pay special attention to property IDs or reference numbers that might appear in the subject or body.
            
            Output your analysis as a valid JSON object with these fields:
            - matched_property_id: The ID of the matched property, or null if no match found
            - confidence: A number from 0.0 to 1.0 indicating confidence in the match
            - extracted_details: Key details extracted from the email (like preferred move-in dates, questions asked, etc.)
            - customer_name: The customer's name extracted from the email
            """,
            expected_output="JSON object with matched_property_id, confidence, extracted_details, and customer_name",
            agent=self.email_analyzer(),
        )

    @task
    def generate_response_task(self, analysis_result: str) -> Task:
        """Task for generating a response with application link"""

        # Parse the analysis result
        try:
            analysis = json.loads(analysis_result)
        except json.JSONDecodeError:
            # If the analysis isn't valid JSON, extract it using regex
            match = re.search(r"\{.*\}", analysis_result, re.DOTALL)
            if match:
                try:
                    analysis = json.loads(match.group(0))
                except:
                    analysis = {
                        "matched_property_id": None,
                        "confidence": 0,
                        "extracted_details": {},
                        "customer_name": "there",
                    }
            else:
                analysis = {
                    "matched_property_id": None,
                    "confidence": 0,
                    "extracted_details": {},
                    "customer_name": "there",
                }

        # Find the property details based on the matched ID
        matched_property = None
        for prop in self.agent_properties:
            if prop.get("id") == analysis.get("matched_property_id"):
                matched_property = prop
                break

        # Get custom message template
        custom_message = self.workflow_actions.get("custom_message", "")
        customer_name = analysis.get("customer_name", "there")

        if matched_property:
            # We have a match
            property_details = (
                f"- Address: {matched_property.get('address')}\n"
                f"- Type: {matched_property.get('property_type')}\n"
                f"- Bedrooms: {matched_property.get('bedrooms')}\n"
                f"- Bathrooms: {matched_property.get('bathrooms')}\n"
                f"- Monthly Rent: ${matched_property.get('monthly_rent')}"
            )

            application_link = matched_property.get("application_link", "")

            task_description = f"""
            Write a professional and personalized response to a property inquiry.
            
            Customer Name: {customer_name}
            
            Property Details:
            {property_details}
            
            Application Link: {application_link}
            
            Custom Message Template (if available):
            {custom_message}
            
            If the custom message template is provided, use it as a base but enhance it with property-specific details.
            If no template is provided, write a friendly, professional response that:
            1. Thanks the customer for their interest
            2. Confirms the property is available
            3. Provides key details about the property
            4. Encourages them to complete the application using the link
            5. Offers to answer any additional questions
            
            Sign the email from: {self.agent_name}
            
            Format your response as plain text that can be sent as an email body.
            """
        else:
            # No property match
            task_description = f"""
            Write a professional response to a property inquiry where we couldn't identify the specific property.
            
            Customer Name: {customer_name}
            
            Custom Message Template (if available):
            {custom_message}
            
            Write a friendly, professional response that:
            1. Thanks the customer for their interest
            2. Mentions that we weren't able to identify which specific property they're inquiring about
            3. Asks them to clarify which property they're interested in
            4. Provides a list of available properties (up to 3)
            5. Offers to answer any questions
            
            Available Properties (mention up to 3):
            ${", ".join([f"{p.get('address')} - {p.get('property_type')}" for p in self.agent_properties[:3]])}
            
            Sign the email from: {self.agent_name}
            
            Format your response as plain text that can be sent as an email body.
            """

        return Task(
            description=task_description,
            expected_output="Plain text email response",
            agent=self.response_writer(),
        )

    @crew
    def crew(self) -> Crew:
        """Create the crew for email response generation"""
        return Crew(
            agents=[self.email_analyzer(), self.response_writer()],
            tasks=[self.analyze_email_task(), self.generate_response_task()],
            process=Process.sequential,
            verbose=True,
        )


def process_email(
    email_subject: str,
    email_content: str,
    agent_properties: List[Dict[str, Any]],
    workflow_actions: Dict[str, Any],
    agent_name: str = "Agent",
) -> str:
    """Process an email and generate a response

    Args:
        email_subject: The subject of the email
        email_content: The body of the email
        agent_properties: List of properties managed by the agent
        workflow_actions: Actions from the workflow configuration
        agent_name: The agent's name for signing the email

    Returns:
        Generated email response text
    """
    try:
        # Create and run the crew
        crew = EmailResponseCrew(
            email_content=email_content,
            email_subject=email_subject,
            agent_properties=agent_properties,
            workflow_actions=workflow_actions,
            agent_name=agent_name,
        )

        result = crew.crew.kickoff()

        # Check if result is already a string
        if isinstance(result, str):
            return result

        # Otherwise try to extract the response from the result object
        if hasattr(result, "raw"):
            return result.raw

        # Handle unexpected result types
        logger.warning(f"Unexpected result type: {type(result)}")
        return "Thank you for your inquiry. One of our agents will get back to you shortly."

    except Exception as e:
        logger.error(f"Error processing email: {str(e)}")
        return "Thank you for your inquiry. One of our agents will get back to you shortly."
