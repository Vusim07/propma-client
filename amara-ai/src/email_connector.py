import logging
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Any, Dict
from tasks.email_response_agent import process_email_with_crew

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()


class EmailProcessRequest(BaseModel):
    agent_id: str
    workflow_id: str
    email_content: str
    email_subject: str
    email_from: str
    email_date: str
    agent_properties: list
    workflow_actions: dict


@router.post("/api/v1/process-email")
async def process_email(request: Request, payload: EmailProcessRequest):
    try:
        # Now passing both email content and subject
        ai_result = process_email_with_crew(
            email_content=payload.email_content,
            email_subject=payload.email_subject,
            agent_properties=payload.agent_properties,
            workflow_actions=payload.workflow_actions,
        )

        return {
            "response": ai_result.get("response", ""),
            "property": ai_result.get("property", {}),
        }
    except Exception as e:
        logger.error(f"Email processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def register_routes(app):
    app.include_router(router)
