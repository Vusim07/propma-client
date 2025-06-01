import logging
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Any, Dict
from src.email_response_workflow import run_email_response_workflow

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
        # Use the modular workflow for end-to-end processing
        workflow_result = run_email_response_workflow(
            email_data={
                "subject": payload.email_subject,
                "body": payload.email_content,
                "from": payload.email_from,
                "date": payload.email_date,
            },
            agent_properties=payload.agent_properties,
            workflow_actions=payload.workflow_actions,
        )
        if not workflow_result.get("success"):
            logger.error(f"Workflow failed: {workflow_result}")
            raise HTTPException(status_code=400, detail=workflow_result)
        return workflow_result
    except Exception as e:
        logger.error(f"Email processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def register_routes(app):
    app.include_router(router)
