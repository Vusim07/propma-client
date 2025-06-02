from typing import Dict, Any
from src.utils.web_ref_extractor import extract_web_ref
from src.utils.template_manager import TemplateManager
from src.utils.validators import ResponseValidator
from tasks.email_response_agent import process_email_with_crew
from src.email_response_config import setup_config
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Setup Azure OpenAI configuration
setup_config()

# In-memory templates (replace with DB fetch in production)
TEMPLATES = {
    "viewing_request": """Subject: Re: Property Viewing - {web_ref}\n\nDear {customer_name},\n\nThank you for your interest in {property_address}. I'd be delighted to arrange a viewing for you.\n\nThis {property_type} features {key_highlights} and is currently {availability_status}.\n\nTo proceed with your application or schedule a viewing, please use this secure link: {application_link}\n\nI look forward to showing you this wonderful property.\n\nBest regards,\n{agent_name}\n{agent_contact}\n""",
    "availability_check": """Subject: Re: Property Availability - {web_ref}\n\nDear {customer_name},\n\nThank you for your inquiry about {property_address}.\n\n{availability_message}\n\n{property_highlights}\n\nIf you'd like to proceed with an application, please use this link: {application_link}\n\nFeel free to contact me if you have any questions.\n\nBest regards,\n{agent_name}\n{agent_contact}\n""",
}

template_manager = TemplateManager(TEMPLATES)
validator = ResponseValidator()


def run_email_response_workflow(
    email_data: Dict[str, Any], agent_properties: list, workflow_actions: dict
) -> Dict[str, Any]:
    """Run the email response workflow using CrewAI

    Args:
        email_data: Dictionary containing email details (subject, body, from, date)
        agent_properties: List of properties managed by the agent
        workflow_actions: Actions from the workflow configuration

    Returns:
        Dictionary containing the workflow results
    """
    try:
        # Step 1: Extract web reference
        extraction = extract_web_ref(
            email_data.get("subject", ""), email_data.get("body", "")
        )
        if not extraction["web_ref"]:
            return {
                "success": False,
                "reason": "web_ref_not_found",
                "extraction": extraction,
            }

        # Step 2: Find property by web_ref (normalize case and trim spaces)
        normalized_web_ref = extraction["web_ref"].strip().upper()
        matched_property = next(
            (
                p
                for p in agent_properties
                if str(p.get("web_reference", "")).strip().upper() == normalized_web_ref
            ),
            None,
        )
        logger.info(
            f"DEBUG: Extraction info: {extraction}, Normalized: {normalized_web_ref}, Matched property: {matched_property}"
        )
        if not matched_property:
            return {
                "success": False,
                "reason": "property_not_found",
                "extraction": extraction,
            }

        # Step 3: Process email with CrewAI
        # Pass matched_property to the agent for downstream use
        full_workflow_actions = {**workflow_actions}
        full_workflow_actions["matched_property"] = matched_property

        # First get classification
        classification_result = process_email_with_crew(
            email_content=email_data.get("body", ""),
            email_subject=email_data.get("subject", ""),
            agent_properties=agent_properties,
            workflow_actions={**full_workflow_actions, "classification_only": True},
        )

        if not classification_result.get("inquiry_type"):
            return {
                "success": False,
                "reason": "classification_failed",
                "classification": classification_result,
            }

        # Then get full response
        ai_result = process_email_with_crew(
            email_content=email_data.get("body", ""),
            email_subject=email_data.get("subject", ""),
            agent_properties=agent_properties,
            workflow_actions=full_workflow_actions,
        )

        response_text = ai_result.get("response", "")
        logger.info(f"DEBUG: AI agent response_text: {response_text}")

        # Step 4: Multi-level validation
        validation = validator.validate(
            response_text,
            {
                "property": matched_property,
                "email": email_data,
                "inquiry_type": classification_result.get("inquiry_type"),
            },
        )
        if (
            not validation["pass"]
            or validation.get("confidence", 0) < validator.min_confidence
        ):
            return {
                "success": False,
                "reason": "validation_failed",
                "validation": validation,
            }

        # Step 5: Render template with variables
        template = template_manager.get_template(
            classification_result.get("inquiry_type")
        )
        if not template:
            return {
                "success": False,
                "reason": "template_not_found",
                "inquiry_type": classification_result.get("inquiry_type"),
            }

        rendered = template_manager.render_template(
            template,
            {
                "customer_name": email_data.get("from", "Customer"),
                "property_address": matched_property.get("address", ""),
                "property_type": matched_property.get("type", ""),
                "key_highlights": matched_property.get("description", ""),
                "availability_status": matched_property.get("status", ""),
                "viewing_options": "Contact agent for available slots",
                "application_link": matched_property.get("application_link", ""),
                "agent_name": workflow_actions.get("agent_name", "Agent"),
                "agent_contact": workflow_actions.get("agent_contact", ""),
                "web_ref": extraction["web_ref"],
            },
        )

        return {
            "success": True,
            "response": rendered,
            "validation": validation,
            "ai_response": response_text,
            "property": matched_property,
            "web_ref": extraction["web_ref"],
            "inquiry_type": classification_result.get("inquiry_type"),
        }

    except Exception as e:
        logger.error(f"Email workflow failed: {str(e)}")
        return {
            "success": False,
            "reason": "workflow_error",
            "error": str(e),
        }
