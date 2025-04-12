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

## License

Copyright (c) 2025 Propma. All rights reserved.
