import os
import sys
import json
import logging
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import argparse

# Add the parent directory to sys.path to enable imports
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(parent_dir)

# Import the email processing module
from tasks.email_response_agent import process_email

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Mock functions for email service integration
# In a production environment, these would connect to Gmail/Outlook APIs
def get_new_emails(provider, access_token, since_timestamp):
    """Mock function to get new emails from a provider"""
    # In a real implementation, this would use the Gmail or Outlook API
    # to retrieve emails since the given timestamp
    logger.info(f"Getting new emails from {provider} since {since_timestamp}")

    # Mock data for testing
    if provider == "gmail":
        return [
            {
                "id": "email123",
                "subject": "Property Inquiry for RR3603605",
                "body": "Hi Sherika, is this unit still available or do you have any others similar to it?\n\n2 Bed Apartment In Cloverdene\nR 5 500 Per Month\nPrivate Property Ref: RR3603605",
                "from": "potential.tenant@example.com",
                "from_name": "John Smith",
                "timestamp": datetime.now().isoformat(),
            },
            {
                "id": "email124",
                "subject": "Available property on Main Street?",
                "body": "Hello, I saw your listing for the 3 bedroom house on Main Street and I'm very interested. Is it still available? I'd like to schedule a viewing this weekend if possible.\n\nThanks,\nMary Johnson",
                "from": "mary.johnson@example.com",
                "from_name": "Mary Johnson",
                "timestamp": datetime.now().isoformat(),
            },
        ]
    elif provider == "outlook":
        return [
            {
                "id": "email125",
                "subject": "Inquiry about the 1 bedroom apartment",
                "body": "I'm interested in the 1 bedroom apartment advertised. Could you please provide more details?\n\nRegards,\nDavid Wilson",
                "from": "david.wilson@example.com",
                "from_name": "David Wilson",
                "timestamp": datetime.now().isoformat(),
            }
        ]
    else:
        return []


def send_email_response(provider, access_token, to_email, subject, body):
    """Mock function to send email responses"""
    # In a real implementation, this would use the Gmail or Outlook API
    # to send the response email
    logger.info(f"Sending email via {provider} to {to_email}")
    logger.info(f"Subject: {subject}")
    logger.info(f"Body preview: {body[:100]}...")

    # For testing, let's just print the email
    return {
        "success": True,
        "message_id": f"resp_{datetime.now().timestamp()}",
        "timestamp": datetime.now().isoformat(),
    }


# Database interaction functions
# In a production environment, these would connect to your Supabase database
def get_agent_workflows(agent_id):
    """Mock function to get workflows for an agent"""
    # In a real implementation, this would query the database
    logger.info(f"Getting workflows for agent {agent_id}")

    # Mock data for testing
    return [
        {
            "id": "workflow1",
            "name": "Property Inquiry Response",
            "agent_id": agent_id,
            "is_active": True,
            "email_filter": {
                "subject_contains": ["property inquiry", "available", "interested"],
                "body_contains": ["available", "interested", "inquiry"],
            },
            "actions": {
                "send_application_link": True,
                "custom_message": "Thank you for your interest in our property. Please complete the application at the link below:",
            },
        }
    ]


def get_agent_properties(agent_id):
    """Mock function to get properties for an agent"""
    # In a real implementation, this would query the database
    logger.info(f"Getting properties for agent {agent_id}")

    # Mock data for testing
    return [
        {
            "id": "prop1",
            "address": "123 Main Street, Cityville",
            "city": "Cityville",
            "property_type": "Apartment",
            "bedrooms": 2,
            "bathrooms": 1,
            "monthly_rent": 5500,
            "application_link": "http://localhost:5173/apply/prop_1743022717719_uksv6uxm",
        },
        {
            "id": "prop2",
            "address": "456 Oak Avenue, Townsburg",
            "city": "Townsburg",
            "property_type": "House",
            "bedrooms": 3,
            "bathrooms": 2,
            "monthly_rent": 7500,
            "application_link": "http://localhost:5173/apply/prop_1743022718888_abcdefgh",
        },
        {
            "id": "prop3",
            "address": "789 Pine Street, Villageton",
            "city": "Villageton",
            "property_type": "Apartment",
            "bedrooms": 1,
            "bathrooms": 1,
            "monthly_rent": 3500,
            "application_link": "http://localhost:5173/apply/prop_1743022719999_ijklmnop",
        },
    ]


def get_agent_details(agent_id):
    """Mock function to get agent details"""
    # In a real implementation, this would query the database
    logger.info(f"Getting details for agent {agent_id}")

    # Mock data for testing
    return {
        "id": agent_id,
        "first_name": "Sherika",
        "last_name": "Johnson",
        "email": "sherika.johnson@example.com",
        "phone": "123-456-7890",
    }


def log_workflow_execution(
    workflow_id, email_data, status, action_taken=None, error_message=None
):
    """Mock function to log workflow execution"""
    # In a real implementation, this would insert into the database
    logger.info(f"Logging workflow execution: {workflow_id}, Status: {status}")
    if error_message:
        logger.error(f"Error: {error_message}")

    # In a real implementation, this would return the log ID
    return f"log_{datetime.now().timestamp()}"


def email_matches_workflow(email, workflow):
    """Check if an email matches the workflow filters"""
    email_subject = email.get("subject", "").lower()
    email_body = email.get("body", "").lower()

    # Get workflow filters
    subject_filters = [
        f.lower() for f in workflow.get("email_filter", {}).get("subject_contains", [])
    ]
    body_filters = [
        f.lower() for f in workflow.get("email_filter", {}).get("body_contains", [])
    ]

    # Check if any subject filter matches
    subject_match = (
        any(f in email_subject for f in subject_filters) if subject_filters else False
    )

    # Check if any body filter matches
    body_match = any(f in email_body for f in body_filters) if body_filters else False

    # Match if either subject or body matches
    return subject_match or body_match


def process_agent_inbox(agent_id, email_provider="gmail", dry_run=False):
    """Process an agent's inbox for matching emails"""
    logger.info(f"Processing inbox for agent {agent_id} using {email_provider}")

    # Get the agent's details
    agent = get_agent_details(agent_id)
    agent_name = f"{agent['first_name']} {agent['last_name']}"

    # Get the agent's workflows
    workflows = get_agent_workflows(agent_id)
    active_workflows = [w for w in workflows if w.get("is_active", False)]

    if not active_workflows:
        logger.info(f"No active workflows found for agent {agent_id}")
        return

    # Get the agent's properties
    properties = get_agent_properties(agent_id)

    # In a real implementation, get the access token from the database
    access_token = "mock_token"

    # Get emails from the last 24 hours
    since_time = (datetime.now() - timedelta(hours=24)).isoformat()
    new_emails = get_new_emails(email_provider, access_token, since_time)

    logger.info(f"Found {len(new_emails)} new emails for processing")

    for email in new_emails:
        for workflow in active_workflows:
            if email_matches_workflow(email, workflow):
                logger.info(f"Email {email['id']} matches workflow {workflow['id']}")

                try:
                    # Process the email with Amara AI
                    response_text = process_email(
                        email_subject=email["subject"],
                        email_content=email["body"],
                        agent_properties=properties,
                        workflow_actions=workflow["actions"],
                        agent_name=agent_name,
                    )

                    # Log the successful processing
                    log_workflow_execution(
                        workflow_id=workflow["id"],
                        email_data=email,
                        status="success",
                        action_taken="Generated response with Amara AI",
                    )

                    # Send the response if not a dry run
                    if not dry_run:
                        reply_subject = f"Re: {email['subject']}"
                        send_result = send_email_response(
                            provider=email_provider,
                            access_token=access_token,
                            to_email=email["from"],
                            subject=reply_subject,
                            body=response_text,
                        )

                        if send_result.get("success"):
                            logger.info(
                                f"Successfully sent response to {email['from']}"
                            )
                        else:
                            logger.error(
                                f"Failed to send response: {send_result.get('error')}"
                            )
                    else:
                        logger.info(f"DRY RUN: Would send response to {email['from']}")
                        logger.info("----- Response Preview -----")
                        logger.info(response_text)
                        logger.info("----------------------------")

                except Exception as e:
                    logger.error(f"Error processing email {email['id']}: {str(e)}")
                    log_workflow_execution(
                        workflow_id=workflow["id"],
                        email_data=email,
                        status="error",
                        error_message=str(e),
                    )

                # Only process the first matching workflow
                break


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process email workflows")
    parser.add_argument("agent_id", help="The ID of the agent to process")
    parser.add_argument(
        "--provider",
        choices=["gmail", "outlook"],
        default="gmail",
        help="Email provider",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Dry run without sending emails"
    )

    args = parser.parse_args()

    process_agent_inbox(args.agent_id, args.provider, args.dry_run)
