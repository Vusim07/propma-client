from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from crewai import Agent, Task, Crew
from dotenv import load_dotenv
import os
import json
import logging
from openai import AzureOpenAI

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(verbose=True)

# Initialize FastAPI app
app = FastAPI(title="Propma AI Agents")

# Configure CORS for South African client domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Log environment variables (without exposing sensitive data)
logger.info(f"Azure OpenAI API Key exists: {bool(os.getenv('AZURE_OPENAI_API_KEY'))}")
logger.info(f"Azure OpenAI Endpoint: {os.getenv('AZURE_OPENAI_ENDPOINT')}")
logger.info(f"Azure OpenAI API Version: {os.getenv('AZURE_OPENAI_API_VERSION')}")
logger.info(
    f"Azure OpenAI Deployment Name: {os.getenv('AZURE_OPENAI_DEPLOYMENT_NAME')}"
)


# Initialize Azure OpenAI client with error handling
def get_azure_openai_client():
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

    if not api_key:
        raise ValueError("AZURE_OPENAI_API_KEY environment variable is not set")
    if not endpoint:
        raise ValueError("AZURE_OPENAI_ENDPOINT environment variable is not set")
    if not deployment:
        raise ValueError("AZURE_OPENAI_DEPLOYMENT_NAME environment variable is not set")

    try:
        return AzureOpenAI(
            api_key=api_key,
            api_version=api_version,
            azure_endpoint=endpoint,
            azure_deployment=deployment,
        )
    except Exception as e:
        logger.error(f"Failed to initialize Azure OpenAI client: {str(e)}")
        raise


class Transaction(BaseModel):
    description: str
    amount: float
    date: str  # Format: DD/MM/YYYY (South African format)
    type: str  # "credit" or "debit"


class AffordabilityRequest(BaseModel):
    transactions: List[Transaction]
    target_rent: float  # In ZAR


class AffordabilityResponse(BaseModel):
    can_afford: bool
    confidence: float  # 0.0 to 1.0
    risk_factors: List[str]
    recommendations: List[str]
    metrics: Dict[str, Any]  # Includes financial metrics
    transaction_analysis: Dict[str, Any]  # Categorized transactions


def create_bank_statement_agent(client):
    """Create a financial analyst agent for rental affordability assessment"""
    return Agent(
        role="Financial Analyst",
        goal="Analyze bank statements to assess rental affordability according to South African standards",
        backstory="""You are an expert financial analyst specializing in South African rental market affordability assessments. 
        You have extensive experience analyzing bank statements to determine financial stability and compliance with 
        South African rental practices. You understand typical South African income patterns, expenses, and banking behaviors.""",
        allow_delegation=False,
        llm=client,
    )


@app.post("/analyze-affordability", response_model=AffordabilityResponse)
async def analyze_affordability(
    request: AffordabilityRequest,
    client: AzureOpenAI = Depends(get_azure_openai_client),
):
    try:
        # Create the bank statement analysis agent
        analyst = create_bank_statement_agent(client)

        # Format transactions for better analysis
        formatted_transactions = []
        for t in request.transactions:
            formatted_transactions.append(
                {
                    "description": t.description,
                    "amount": f"R {t.amount:.2f}",  # South African Rand format
                    "date": t.date,  # DD/MM/YYYY
                    "type": t.type,
                }
            )

        # Create the analysis task
        analysis_task = Task(
            description=f"""
            Analyze these South African bank transactions to assess affordability for a rental property with monthly rent of R{request.target_rent:.2f}.
            
            Transactions:
            {json.dumps(formatted_transactions, indent=2)}
            
            Provide:
            1. Transaction categorization (income, essential expenses, non-essential expenses, savings, debt payments)
            2. Income stability assessment (consistency, sources, reliability)
            3. Expense patterns (fixed vs. variable, necessary vs. discretionary)
            4. Affordability recommendation (based on 30% rent-to-income ratio standard in South Africa)
            5. Risk factors (specific to South African rental market)
            6. Financial metrics (include debt-to-income ratio, savings rate, disposable income)
            
            Use South African financial standards and ensure all currency values are in ZAR (R).
            Format the response as a valid JSON object that matches the AffordabilityResponse schema.
            """,
            agent=analyst,
        )

        # Create and run the crew
        crew = Crew(agents=[analyst], tasks=[analysis_task], verbose=True)

        # Execute the analysis
        result = crew.kickoff()

        # Parse the JSON result
        try:
            if isinstance(result, str):
                # Extract JSON from the response if it's a string
                try:
                    # First try to parse the entire result as JSON
                    analysis_data = json.loads(result)
                except:
                    # If that fails, try to extract JSON from the text
                    import re

                    json_match = re.search(r"```json\s*([\s\S]*?)\s*```", result)
                    if json_match:
                        analysis_data = json.loads(json_match.group(1))
                    else:
                        raise ValueError("Could not extract JSON from the result")
            else:
                # If result is already a dict-like object
                analysis_data = result

            # Ensure all required fields are present
            for field in [
                "can_afford",
                "confidence",
                "risk_factors",
                "recommendations",
                "metrics",
                "transaction_analysis",
            ]:
                if field not in analysis_data:
                    analysis_data[field] = (
                        []
                        if field in ["risk_factors", "recommendations"]
                        else (
                            {}
                            if field in ["metrics", "transaction_analysis"]
                            else (False if field == "can_afford" else 0.0)
                        )
                    )

            return AffordabilityResponse(**analysis_data)

        except Exception as e:
            logger.error(f"Error parsing analysis result: {str(e)}")
            logger.error(f"Raw result: {result}")
            raise HTTPException(
                status_code=500, detail="Failed to parse analysis result"
            )

    except ValueError as e:
        # Handle missing environment variables
        logger.error(f"Configuration error: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Service configuration error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error in affordability analysis: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Affordability analysis error: {str(e)}"
        )


@app.get("/health")
async def health_check():
    """Health check endpoint to verify if the service is running"""
    return {"status": "healthy", "service": "amara-ai-affordability"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
