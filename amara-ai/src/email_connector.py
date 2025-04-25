import json
import logging
from fastapi import APIRouter, Request, HTTPException
from typing import Dict, List, Any, Optional

# Import the email response agent
from tasks.email_response_agent import process_email

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()


class EmailProcessingRequest:
    def __init__(self, data: Dict[str, Any]):
        self.email_subject = data.get("email_subject", "")
        self.email_content = data.get("email_content", "")
        self.agent_properties = data.get("agent_properties", [])
        self.workflow_actions = data.get("workflow_actions", {})
        self.agent_name = data.get("agent_name", "Agent")

    def validate(self):
        """Validate the request payload"""
        errors = []

        if not self.email_subject:
            errors.append("email_subject is required")

        if not self.email_content:
            errors.append("email_content is required")

        if not self.agent_properties:
            errors.append("agent_properties is required and must be a non-empty array")

        if not isinstance(self.workflow_actions, dict):
            errors.append("workflow_actions must be an object")

        return errors


@router.post("/process-email")
async def handle_process_email(request: Request):
    """Handle email processing requests from the Supabase Edge Function"""
    try:
        # Parse the request body
        data = await request.json()

        # Create and validate the request
        req = EmailProcessingRequest(data)
        validation_errors = req.validate()

        if validation_errors:
            return {
                "success": False,
                "errors": validation_errors,
                "message": "Invalid request",
            }

        # Log the request
        logger.info(f"Processing email with subject: {req.email_subject}")

        # Process the email with Amara AI
        response_text = process_email(
            email_subject=req.email_subject,
            email_content=req.email_content,
            agent_properties=req.agent_properties,
            workflow_actions=req.workflow_actions,
            agent_name=req.agent_name,
        )

        # Return the generated response
        return {"success": True, "response_text": response_text}

    except Exception as e:
        logger.error(f"Error processing email: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing email: {str(e)}")


def register_routes(app):
    """Register routes with the FastAPI app"""
    app.include_router(router, prefix="/api", tags=["email"])
