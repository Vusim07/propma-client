from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Union
import os
import json
import logging

# Import the refactored CrewAI components and config
from src.affordability_crew import AffordabilityAnalysisCrew
from src.affordability_crew.config import setup_config

# Import email connector module
from src.email_connector import register_routes

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize environment configuration
try:
    setup_config()
except Exception as e:
    logger.error(f"Failed to setup configuration: {str(e)}")
    # We'll continue and let individual API endpoints handle the errors

# Initialize FastAPI app
app = FastAPI(
    title="Amara AI API",
    description="AI-powered tenant screening & viewing appointment scheduling platform",
    version="1.0.0",
)

# Configure CORS for South African client domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register email connector routes
register_routes(app)

# Mount static files directory
try:
    app.mount("/static", StaticFiles(directory="static"), name="static")
    logger.info("Static files directory mounted successfully")
except Exception as e:
    logger.warning(f"Could not mount static files directory: {e}")


# Define data models
class Transaction(BaseModel):
    description: str
    amount: float
    date: str  # Format: DD/MM/YYYY (South African format)
    type: str  # "credit" or "debit"


class AffordabilityRequest(BaseModel):
    transactions: List[Transaction]
    target_rent: float  # In ZAR
    # Allow raw JSON data for payslips and bank statements
    payslip_data: Optional[Union[List, Dict[str, Any]]] = None
    bank_statement_data: Optional[Union[List, Dict[str, Any]]] = None
    # Keep other optional fields from affordabilityService.ts for consistency
    tenant_income: Optional[Dict[str, Any]] = None
    credit_report: Optional[Dict[str, Any]] = None
    analysis_type: Optional[str] = "comprehensive"  # Default to comprehensive


class AffordabilityResponse(BaseModel):
    can_afford: bool
    confidence: float  # 0.0 to 1.0
    risk_factors: List[str]
    recommendations: List[str]
    metrics: Dict[str, Any]  # Includes financial metrics
    transaction_analysis: Dict[str, Any]  # Categorized transactions


# Root endpoint redirects to test client
@app.get("/", response_class=HTMLResponse)
async def root():
    try:
        with open("static/index.html", "r") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(
            content="<html><body><h1>API is running</h1><p>Test client not found. Access /docs for API documentation.</p></body></html>"
        )


@app.post("/analyze-affordability", response_model=AffordabilityResponse)
async def analyze_affordability(request: AffordabilityRequest):
    try:
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

        # Initialize crew with all relevant data
        crew_instance = AffordabilityAnalysisCrew(
            transactions_data=formatted_transactions,  # Keep formatted for potential backward compatibility or simple analysis
            target_rent=request.target_rent,
            payslip_data=request.payslip_data,  # Pass raw payslip data
            bank_statement_data=request.bank_statement_data,  # Pass raw bank statement data
            tenant_income=request.tenant_income,  # Pass tenant income data
            credit_report=request.credit_report,  # Pass credit report data
        )

        # Execute the analysis using the crew
        try:
            # Create the crew instance - crew() is a function that returns the crew
            crew = crew_instance.crew()
            # Now kickoff the actual crew instance
            raw_result = crew.kickoff()

            # Process the result to ensure it matches our expected format
            # The process_results method in the crew handles parsing and validation
            if hasattr(crew_instance, "process_results") and callable(
                crew_instance.process_results
            ):
                # Call process_results directly with the right event name to match the callback
                result = crew_instance.process_results(
                    "crew_finished", final_result=raw_result
                )
                if (
                    result is None
                ):  # If process_results returns None, use the raw result
                    result = raw_result
            else:
                result = raw_result

            return AffordabilityResponse(**result)
        except Exception as e:
            logger.error(f"Error in affordability analysis: {str(e)}")
            raise HTTPException(
                status_code=500, detail=f"Affordability analysis error: {str(e)}"
            )

    except ValueError as e:
        # Handle missing environment variables or other value errors
        logger.error(f"Configuration error: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Service configuration error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error in affordability analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/debug-crew-config")
async def debug_crew_config():
    """Debug endpoint to check the crew configuration"""
    try:
        # Create a sample crew instance
        sample_data = [
            {
                "description": "SALARY PAYMENT",
                "amount": 15000.00,
                "date": "01/10/2024",
                "type": "credit",
            }
        ]

        # Initialize crew with sample data
        crew_instance = AffordabilityAnalysisCrew(
            transactions_data=sample_data,
            target_rent=5000.0,
            # Add sample raw data if useful for debugging
            payslip_data={"employer": "Debug Inc.", "net_income": 10000},
            bank_statement_data=[{"description": "DEBIT ORDER", "amount": -500}],
            tenant_income={
                "statedMonthlyIncome": 15000,
                "employmentStatus": "employed",
            },
            credit_report={"creditScore": 700},
        )

        # Get the context data
        context_data = crew_instance.prepare_data()

        # Get task configuration
        task_config = (
            crew_instance.tasks_config["affordability_analysis"]
            if hasattr(crew_instance, "tasks_config")
            else None
        )

        # Return debug information
        return {
            "context_data": context_data,
            "task_description": task_config.get("description") if task_config else None,
            "agents_config": (
                crew_instance.agents_config
                if hasattr(crew_instance, "agents_config")
                else None
            ),
        }
    except Exception as e:
        logger.error(f"Error in debug endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Debug error: {str(e)}")


# Start the server directly when the script is run
if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    # Use reload=True for development
    uvicorn.run(app, host=host, port=port)
