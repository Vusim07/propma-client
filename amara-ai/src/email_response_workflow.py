from typing import Dict, Any
from src.utils.web_ref_extractor import extract_web_ref
from src.utils.template_manager import TemplateManager
from src.utils.validators import ResponseValidator
from tasks.email_response_agent import process_email_with_crew

# Example: In-memory templates (replace with DB fetch in production)
TEMPLATES = {
    "viewing_request": """Subject: Re: Property Viewing - {web_ref}\n\nDear {customer_name},\n\nThank you for your interest in {property_address}. I'd be delighted to arrange a viewing for you.\n\nThis {property_type} features {key_highlights} and is currently {availability_status}.\n\nTo proceed with your application or schedule a viewing, please use this secure link: {application_link}\n\nI look forward to showing you this wonderful property.\n\nBest regards,\n{agent_name}\n{agent_contact}\n""",
    "availability_check": """Subject: Re: Property Availability - {web_ref}\n\nDear {customer_name},\n\nThank you for your inquiry about {property_address}.\n\n{availability_message}\n\n{property_highlights}\n\nIf you'd like to proceed with an application, please use this link: {application_link}\n\nFeel free to contact me if you have any questions.\n\nBest regards,\n{agent_name}\n{agent_contact}\n""",
}

template_manager = TemplateManager(TEMPLATES)
validator = ResponseValidator()


def classify_inquiry_type(
    email_body: str, email_subject: str, agent_properties: list
) -> str:
    """
    Use CrewAI to classify the inquiry type (viewing_request, availability_check, general_info).
    Fallback to keyword-based classification if CrewAI is unavailable.
    """
    # Try CrewAI classification (if agent supports it)
    try:
        # This assumes process_email_with_crew returns a classification if asked
        ai_result = process_email_with_crew(
            email_content=email_body,
            email_subject=email_subject,
            agent_properties=agent_properties,
            workflow_actions={"classification_only": True},
        )
        if ai_result.get("classification"):
            return ai_result["classification"]
    except Exception:
        pass
    # Fallback: simple keyword-based
    text = f"{email_subject} {email_body}".lower()
    if "view" in text or "schedule" in text:
        return "viewing_request"
    if "available" in text or "availability" in text:
        return "availability_check"
    return "general_info"


def run_email_response_workflow(
    email_data: Dict[str, Any], agent_properties: list, workflow_actions: dict
) -> Dict[str, Any]:
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

    # Step 2: Find property by web_ref
    matched_property = next(
        (
            p
            for p in agent_properties
            if str(p.get("web_reference")) == extraction["web_ref"]
        ),
        None,
    )
    if not matched_property:
        return {
            "success": False,
            "reason": "property_not_found",
            "extraction": extraction,
        }

    # Step 3: Classify inquiry type (production: CrewAI or fallback)
    inquiry_type = classify_inquiry_type(
        email_data.get("body", ""), email_data.get("subject", ""), agent_properties
    )
    template = template_manager.get_template(inquiry_type)
    if not template:
        return {
            "success": False,
            "reason": "template_not_found",
            "inquiry_type": inquiry_type,
        }

    # Step 4: Generate response using CrewAI agent
    ai_result = process_email_with_crew(
        email_content=email_data.get("body", ""),
        email_subject=email_data.get("subject", ""),
        agent_properties=agent_properties,
        workflow_actions=workflow_actions,
    )
    response_text = ai_result.get("response", "")

    # Step 5: Multi-level validation (factual, tone, completeness, confidence)
    validation = validator.validate(
        response_text,
        {
            "property": matched_property,
            "email": email_data,
            "inquiry_type": inquiry_type,
        },
    )
    if (
        not validation["pass"]
        or validation.get("confidence", 0) < validator.min_confidence
    ):
        # Fallback: log and return for manual review
        return {
            "success": False,
            "reason": "validation_failed",
            "validation": validation,
        }

    # Step 6: Render template with variables
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
        "inquiry_type": inquiry_type,
    }
