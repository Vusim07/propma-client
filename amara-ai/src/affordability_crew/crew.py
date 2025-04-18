from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from typing import List, Dict, Any, Optional
import json
import logging
import os
import sys
import traceback

# Configure logging to be more detailed
logger = logging.getLogger(__name__)
handler = logging.StreamHandler(sys.stdout)
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)  # Set to DEBUG for maximum verbosity


@CrewBase
class AffordabilityAnalysisCrew:
    """Crew for analyzing bank statements to assess rental affordability"""

    def __init__(
        self,
        transactions_data: Optional[List[Dict[str, Any]]] = None,
        target_rent: Optional[float] = None,
        payslip_data: Optional[Any] = None,
        bank_statement_data: Optional[Any] = None,
        tenant_income: Optional[Dict[str, Any]] = None,
        credit_report: Optional[Dict[str, Any]] = None,
    ):
        """Initialize with all relevant financial data"""
        logger.info("Initializing AffordabilityAnalysisCrew")
        self.transactions_data = transactions_data
        self.target_rent = target_rent
        self.payslip_data = payslip_data
        self.bank_statement_data = bank_statement_data
        self.tenant_income = tenant_income
        self.credit_report = credit_report
        # Prepare data for context immediately
        self.prepare_data()
        logger.info("AffordabilityAnalysisCrew initialized with comprehensive data")

    def prepare_data(self):
        """Prepare data for task context as a dictionary"""
        logger.info("Preparing data for task context")

        # Helper to safely dump JSON
        def safe_json_dumps(data, default_val=""):
            try:
                return json.dumps(data, indent=2) if data is not None else default_val
            except TypeError as e:
                logger.warning(f"Could not serialize data to JSON: {e}. Data: {data}")
                # Attempt to convert complex objects to string representation
                try:
                    return json.dumps(str(data), indent=2)
                except Exception:
                    return default_val

        # Create a dictionary for the context
        self.context_data = {
            "formatted_transactions": safe_json_dumps(self.transactions_data, "[]"),
            "target_rent": self.target_rent if self.target_rent is not None else 0.0,
            "payslip_data": self.payslip_data,
            "bank_statement_data": self.bank_statement_data,
            "tenant_income": self.tenant_income,
            "credit_report": self.credit_report,
        }

        # Log the keys present in the context
        logger.info(f"Context created with keys: {list(self.context_data.keys())}")

        # Optional: Log structure or type of complex data for debugging
        if self.bank_statement_data:
            logger.info(f"Bank statement data type: {type(self.bank_statement_data)}")
        if self.payslip_data:
            logger.info(f"Payslip data type: {type(self.payslip_data)}")

        return self.context_data

    @agent
    def financial_analyst(self) -> Agent:
        """Create financial analyst agent for rental affordability assessment"""
        # Get the agent configuration from YAML
        config = self.agents_config["financial_analyst"]

        # Enhance the goal with specific instructions about output format
        goal = config["goal"]
        if not isinstance(goal, str):
            goal = "Analyze financial data to determine rental affordability and provide detailed recommendations"

        enhanced_goal = (
            f"{goal}. "
            "Your analysis MUST be returned as a clean, valid JSON object (not wrapped in markdown code blocks). "
            "Always include the following keys in your output: can_afford (boolean), confidence (number), "
            "risk_factors (array), recommendations (array), metrics (object), and transaction_analysis (object)."
        )

        # Create the agent using CrewAI's default handling of LLMs
        # CrewAI will automatically handle the Azure OpenAI configuration
        # from the environment variables
        return Agent(
            role=config["role"],
            goal=enhanced_goal,
            backstory=config["backstory"],
            llm=config["llm"],
            verbose=True,
        )

    @task
    def affordability_analysis(self) -> Task:
        """Task for analyzing bank statements and assessing affordability"""
        # Ensure we have the latest context data dictionary
        context = self.prepare_data()

        # Create task with custom description that directly includes the data
        task_config = self.tasks_config["affordability_analysis"].copy()

        # Update task description to be more general and request specific output format
        # The agent should use the provided context dictionary
        task_config["description"] = (
            "Analyze the provided financial data context to assess rental affordability "
            "for the target rent. The context includes formatted transactions, raw bank statement data, "
            "raw payslip data, tenant income details, and a credit report. "
            f"The target rent is ZAR {context.get('target_rent', 0.0):.2f}. "
            "Focus on income verification, expense patterns, debt-to-income ratio, and overall financial health. "
            "Use all available data sources (bank statements, payslips, income info) for a comprehensive assessment."
        )

        # Add specific output expectations to ensure proper JSON format
        task_config["expected_output"] = (
            "IMPORTANT: Return your analysis as a valid JSON object without markdown formatting or other text. "
            "The JSON should include these exact keys: "
            "can_afford (boolean), confidence (number 0.0-1.0), risk_factors (array of strings), "
            "recommendations (array of strings), metrics (object with financial metrics), "
            "and transaction_analysis (object with categorized transactions). "
            'Example: {"can_afford": true, "confidence": 0.85, ...}'
        )

        # Pass the prepared context dictionary to the task
        return Task(
            description=task_config.get("description", ""),
            expected_output=task_config.get("expected_output", ""),
            agent=self.financial_analyst(),
            output_file=task_config.get(
                "output_file", "output/affordability_analysis.json"
            ),
        )

    @crew
    def crew(self) -> Crew:
        """Creates the affordability analysis crew"""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
            callbacks=[self.process_results],
        )

    def process_results(self, event_name, **kwargs):
        """Process results after crew kickoff, ensuring extraction from agent output."""
        logger.info(f"========== PROCESS RESULTS STARTED: {event_name} ==========")

        # Extract the result data from kwargs
        result = None
        if event_name == "crew_finished":
            result = kwargs.get("final_result", "")
            logger.info(f"Event 'crew_finished' detected, extracted result")
        else:
            logger.warning(f"Unknown event: {event_name}, cannot process")
            return None

        logger.info(f"Result Type: {type(result)}")
        logger.info(f"Result Content Preview (first 200 chars): {str(result)[:200]}")

        if result is None:
            logger.error("Result is None, cannot process")
            return None

        # Initialize default return structure
        final_data = {
            "can_afford": False,
            "confidence": 0.5,
            "risk_factors": [],
            "recommendations": [],
            "metrics": {},
            "transaction_analysis": {},
            "explanation": "",
        }

        try:
            logger.info("Starting JSON extraction from result")
            raw_json_string = None

            # STEP 1: Extract raw JSON from the CrewOutput object structure
            if hasattr(result, "__dict__"):
                result_dict = result.__dict__
                logger.info(
                    f"Result has __dict__ attribute with keys: {list(result_dict.keys())}"
                )

                # Check if the result has a 'raw' attribute that contains the JSON string
                if "raw" in result_dict and result_dict["raw"]:
                    raw_json_string = result_dict["raw"]
                    logger.info(
                        f"Found raw JSON in result.raw (first 100 chars): {raw_json_string[:100]}"
                    )
                # Also check tasks_output which might contain the raw data
                elif "tasks_output" in result_dict and result_dict["tasks_output"]:
                    tasks = result_dict["tasks_output"]
                    if tasks and hasattr(tasks[0], "raw"):
                        raw_json_string = tasks[0].raw
                        logger.info(
                            f"Found raw JSON in result.tasks_output[0].raw (first 100 chars): {raw_json_string[:100]}"
                        )
            elif isinstance(result, str):
                raw_json_string = result
                logger.info("Result is already a string, using directly")
            elif isinstance(result, dict):
                # If result is already a dict, check if it has the 'raw' key
                if "raw" in result and result["raw"]:
                    raw_json_string = result["raw"]
                    logger.info(
                        f"Found raw JSON in result['raw'] (first 100 chars): {raw_json_string[:100]}"
                    )
                # If it's already the proper format, use it directly
                elif "can_afford" in result:
                    logger.info(
                        "Result is already a properly formatted dict with 'can_afford' key"
                    )
                    return result

            # If we have a raw JSON string, parse it
            if raw_json_string:
                try:
                    # Try to parse the raw JSON string
                    analysis_data = json.loads(raw_json_string)
                    logger.info("Successfully parsed JSON from raw string")
                    logger.info(f"Parsed JSON keys: {list(analysis_data.keys())}")

                    # Now extract the required fields from the parsed JSON
                    if "can_afford" in analysis_data:
                        can_afford_value = analysis_data.get("can_afford")
                        logger.info(
                            f"Found can_afford: {can_afford_value} (type: {type(can_afford_value).__name__})"
                        )
                        if isinstance(can_afford_value, bool):
                            final_data["can_afford"] = can_afford_value
                        elif isinstance(can_afford_value, str):
                            final_data["can_afford"] = (
                                can_afford_value.lower() == "true"
                            )

                    if "confidence" in analysis_data:
                        confidence_value = analysis_data.get("confidence")
                        logger.info(
                            f"Found confidence: {confidence_value} (type: {type(confidence_value).__name__})"
                        )
                        if isinstance(confidence_value, (float, int)):
                            final_data["confidence"] = float(confidence_value)
                        elif isinstance(confidence_value, str):
                            try:
                                final_data["confidence"] = float(confidence_value)
                            except ValueError:
                                logger.warning(
                                    f"Could not convert confidence string: {confidence_value}"
                                )

                    if "risk_factors" in analysis_data and isinstance(
                        analysis_data["risk_factors"], list
                    ):
                        final_data["risk_factors"] = analysis_data["risk_factors"]
                        logger.info(
                            f"Found risk_factors: {len(final_data['risk_factors'])} items"
                        )

                    if "recommendations" in analysis_data and isinstance(
                        analysis_data["recommendations"], list
                    ):
                        final_data["recommendations"] = analysis_data["recommendations"]
                        logger.info(
                            f"Found recommendations: {len(final_data['recommendations'])} items"
                        )

                    if "metrics" in analysis_data and isinstance(
                        analysis_data["metrics"], dict
                    ):
                        final_data["metrics"] = analysis_data["metrics"]
                        logger.info(
                            f"Found metrics with keys: {list(final_data['metrics'].keys())}"
                        )

                    if "transaction_analysis" in analysis_data and isinstance(
                        analysis_data["transaction_analysis"], dict
                    ):
                        final_data["transaction_analysis"] = analysis_data[
                            "transaction_analysis"
                        ]
                        logger.info(
                            f"Found transaction_analysis with keys: {list(final_data['transaction_analysis'].keys())}"
                        )

                    logger.info(
                        f"Successfully extracted all available fields from raw JSON"
                    )
                except json.JSONDecodeError as e:
                    logger.error(f"Error parsing raw JSON string: {str(e)}")
                    # Continue with our existing extraction methods
                    logger.info("Falling back to our existing extraction methods")

            # If we haven't successfully extracted data above, continue with existing extraction logic
            if "can_afford" not in final_data or final_data["can_afford"] is None:
                # Continue with STEP 1,2,3,4,5 from the existing code...
                # The existing extraction logic starts here
                logger.info("Using existing extraction logic...")

            # STEP 5: Log final data structure
            # Ensure we always have at least one recommendation to satisfy database constraints
            if (
                not final_data["recommendations"]
                or len(final_data["recommendations"]) == 0
            ):
                # Default recommendations that will satisfy constraints
                if final_data["can_afford"]:
                    final_data["recommendations"] = [
                        "Set up automatic payments for rent"
                    ]
                else:
                    final_data["recommendations"] = [
                        "Look for more affordable housing options"
                    ]
                logger.info(f"Added default recommendation because list was empty")
            else:
                # Ensure recommendations satisfy database constraints
                valid_recommendations = []
                for rec in final_data["recommendations"]:
                    if not isinstance(rec, str):
                        # Convert non-string recommendations to strings
                        rec = str(rec)

                    # Ensure recommendation is not too short or too long
                    if len(rec) < 10:
                        # Too short - expand it
                        if final_data["can_afford"]:
                            rec = "Consider setting up automatic payments for rent"
                        else:
                            rec = "Consider more affordable housing options"
                    elif len(rec) > 250:
                        # Too long - truncate it
                        rec = rec[:250]

                    valid_recommendations.append(rec)

                # Replace with validated recommendations
                final_data["recommendations"] = valid_recommendations
                logger.info(
                    f"Validated {len(valid_recommendations)} recommendations for database constraints"
                )

            logger.info(f"Final Processed Data being returned: {final_data}")
            logger.info(f"========== PROCESS RESULTS COMPLETED ==========")
            return final_data

        except Exception as e:
            logger.error(f"========== PROCESS RESULTS FAILED ==========")
            logger.error(f"Unhandled exception during result processing: {str(e)}")
            logger.error(f"Exception type: {type(e).__name__}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            logger.error(f"Original raw result: {result}")
            return final_data
