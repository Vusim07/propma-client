# Amara AI - Rental Affordability Analysis

A FastAPI-based service that uses CrewAI and Azure OpenAI to analyze bank statements and assess rental affordability according to South African standards.

## Key Features

- AI-powered analysis of bank transactions to assess rental affordability
- Detailed financial metrics including income stability, expense patterns, and risk factors
- Fully containerized with Docker for easy deployment
- Integration with Azure OpenAI for state-of-the-art language models
- Structured according to CrewAI's best practices

## Project Structure

```
amara-ai/
│
├── src/
│   ├── affordability_crew/
│   │   ├── config/
│   │   │   ├── agents.yaml        # Agent configuration
│   │   │   └── tasks.yaml         # Tasks configuration
│   │   ├── __init__.py            # Package initialization
│   │   ├── config.py              # Environment configuration
│   │   ├── crew.py                # CrewAI implementation
│   │   └── run.py                 # Standalone runner
│   │
│   └── __init__.py                # Package initialization
│
├── static/                        # Static files for the web interface
│
├── .env                           # Environment variables (not in version control)
├── .gitignore                     # Git ignore file
├── Dockerfile                     # Docker configuration
├── docker-compose.yml             # Docker Compose configuration
├── main.py                        # FastAPI application
├── README.md                      # This file
└── requirements.txt               # Python dependencies
```

## Setup

### Prerequisites

- Python 3.10+
- Azure OpenAI API key and endpoint

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Azure OpenAI settings
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_API_VERSION=2024-08-01-preview
AZURE_OPENAI_ENDPOINT=https://your-azure-openai-endpoint.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
```

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/amara-ai.git
cd amara-ai
```

2. Create a virtual environment and install dependencies:

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Running the Application

#### Locally

```bash
python main.py
```

The API will be available at `http://localhost:8000`.

#### Using Docker Compose

```bash
docker-compose up -d
```

The API will be available at `http://localhost:8000`.

## API Endpoints

### POST /analyze-affordability

Analyzes bank transactions to assess rental affordability.

#### Request

```json
{
	"transactions": [
		{
			"description": "SALARY PAYMENT",
			"amount": 15000.0,
			"date": "01/10/2024",
			"type": "credit"
		},
		{
			"description": "RENT PAYMENT",
			"amount": 4500.0,
			"date": "05/10/2024",
			"type": "debit"
		}
	],
	"target_rent": 5000.0
}
```

#### Response

```json
{
  "can_afford": true,
  "confidence": 0.85,
  "risk_factors": ["Inconsistent income sources"],
  "recommendations": ["Consider reducing discretionary spending"],
  "metrics": {
    "rent_to_income_ratio": 0.33,
    "debt_to_income_ratio": 0.2,
    "disposable_income": 4500.0,
    "savings_rate": 0.1,
    "monthly_income": 15000.0,
    "monthly_expenses": 8000.0,
    "monthly_debt_payments": 3000.0
  },
  "transaction_analysis": {
    "income": [...],
    "essential_expenses": [...],
    "non_essential_expenses": [...],
    "savings": [...],
    "debt_payments": [...]
  }
}
```

### GET /health

Returns the health status of the service.

## Testing the Crew Independently

You can test the affordability analysis crew independently using the `run.py` script:

```bash
python -m src.affordability_crew.run --output output/result.json
```

## Email Workflow Integration

Amara AI can be configured to automatically respond to property inquiry emails using the workflow management system in the Propma client application.

### Overview

The integration flow works as follows:

1. Agents connect their email accounts (Gmail/Outlook) through the Workflow Management UI
2. Agents create workflows that define email filters and response actions
3. The backend email listener monitors connected inboxes for matching emails
4. When a match is found, Amara AI processes the email content to identify:
   - The specific property being inquired about
   - Relevant details needed to generate a personalized response
5. Amara AI then sends a response with:
   - A personalized message
   - The correct application link for the identified property
   - Additional information about the property

### Technical Implementation

#### Backend Email Listener Service

The email listener service can be implemented as a serverless function or a dedicated microservice that:

1. Authenticates with the email provider API (Gmail/Outlook)
2. Polls for new emails periodically
3. Filters emails based on the workflow configurations
4. Passes matching emails to the Amara AI processing pipeline

```python
# Example implementation of email listener (pseudocode)
def poll_inbox(email_provider, agent_id):
    # Get agent's workflows from database
    workflows = get_agent_workflows(agent_id)

    # Get new emails since last check
    emails = email_provider.get_new_emails()

    for email in emails:
        for workflow in workflows:
            if email_matches_workflow(email, workflow):
                # Process with Amara AI
                process_with_amara_ai(email, workflow, agent_id)
```

#### Amara AI Email Processing

To integrate with the email workflow, create a new agent in Amara AI that specializes in:

1. Extracting property information from emails
2. Matching the inquiry to specific properties in the database
3. Generating personalized responses

```python
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task

@CrewBase
class EmailResponseCrew:
    """Crew for processing property inquiry emails and generating responses"""

    def __init__(self, email_content, agent_properties, workflow_actions):
        self.email_content = email_content
        self.agent_properties = agent_properties
        self.workflow_actions = workflow_actions

    @agent
    def email_analyzer(self):
        """Creates an agent that analyzes email content to identify property inquiries"""
        return Agent(
            role="Email Analyzer",
            goal="Extract property details from inquiry emails and match to existing properties",
            backstory="I am an expert at understanding customer inquiries and matching them to property listings",
            verbose=True
        )

    @agent
    def response_writer(self):
        """Creates an agent that writes personalized responses to property inquiries"""
        return Agent(
            role="Response Writer",
            goal="Write personalized, helpful responses to property inquiries",
            backstory="I am skilled at crafting professional and engaging responses that convert inquiries to applications",
            verbose=True
        )

    @task
    def analyze_email_task(self):
        """Task for analyzing email content"""
        return Task(
            description=f"Analyze the following email content to identify which property is being inquired about:\n\n{self.email_content}\n\nMatch against these properties: {self.agent_properties}",
            agent=self.email_analyzer()
        )

    @task
    def generate_response_task(self, property_details):
        """Task for generating a response with application link"""
        custom_message = self.workflow_actions.get('custom_message', '')

        return Task(
            description=f"Generate a professional response to the inquiry about {property_details['address']}. Include the application link {property_details['application_link']}. Base your response on this template if provided: {custom_message}",
            agent=self.response_writer()
        )

    @crew
    def crew(self):
        return Crew(
            agents=[self.email_analyzer(), self.response_writer()],
            tasks=[self.analyze_email_task(), self.generate_response_task()],
            process=Process.sequential,
            verbose=True
        )
```

### Integration with Supabase

The integration between the email processing system and the Propma application database (Supabase) involves:

1. Storing workflow configurations in the `email_workflows` table
2. Recording workflow activity logs in the `workflow_logs` table
3. Retrieving property details and application links as needed

#### Database Schema

The required database tables are:

- `email_workflows` - Stores workflow configurations
- `workflow_logs` - Records workflow activity for monitoring and debugging
- `calendar_integrations` - Stores OAuth tokens for email/calendar providers

### Deployment

To deploy the email workflow system:

1. Deploy the email listener service as a serverless function (e.g., Supabase Edge Function)
2. Configure the email listener to run on a schedule (e.g., every 5 minutes)
3. Set up appropriate authentication for accessing the email APIs
4. Configure the Amara AI agents for email processing

### Testing

To test the email workflow integration:

1. Create a test workflow in the UI
2. Send a test email that matches the workflow filters
3. Verify that:
   - The email is processed correctly
   - The appropriate response is generated
   - The workflow activity is logged

## License

Copyright (c) 2025 Propma. All rights reserved.
