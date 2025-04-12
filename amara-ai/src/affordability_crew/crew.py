from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
import json
import logging
import os

logger = logging.getLogger(__name__)


@CrewBase
class AffordabilityAnalysisCrew:
    """Crew for analyzing bank statements to assess rental affordability"""

    def __init__(self, transactions_data=None, target_rent=None):
        """Initialize with transaction data and target rent"""
        self.transactions_data = transactions_data
        self.target_rent = target_rent
        # Format context as a list of dictionaries for CrewAI's context format
        self.prepare_data()
        logger.info("AffordabilityAnalysisCrew initialized")

    def prepare_data(self):
        """Prepare data for task context as a list of dictionaries"""
        logger.info("Preparing data for task context")
        # In CrewAI, context needs to be a list of dictionaries
        self.context_data = [
            {
                "transactions": (
                    json.dumps(self.transactions_data, indent=2)
                    if self.transactions_data
                    else ""
                ),
                "target_rent": self.target_rent if self.target_rent else 0.0,
            }
        ]
        return self.context_data

    @agent
    def financial_analyst(self) -> Agent:
        """Create financial analyst agent for rental affordability assessment"""
        # Get the agent configuration from YAML
        config = self.agents_config["financial_analyst"]

        # Create the agent using CrewAI's default handling of LLMs
        # CrewAI will automatically handle the Azure OpenAI configuration
        # from the environment variables
        return Agent(
            role=config["role"],
            goal=config["goal"],
            backstory=config["backstory"],
            llm=config["llm"],
            verbose=True,
        )

    @task
    def affordability_analysis(self) -> Task:
        """Task for analyzing bank statements and assessing affordability"""
        # Make sure we have the latest context data
        context = self.prepare_data()

        # Format transactions data for the task
        transactions_str = (
            json.dumps(self.transactions_data, indent=2)
            if self.transactions_data
            else "[]"
        )
        target_rent = self.target_rent if self.target_rent else 0.0

        # Create task with custom description that directly includes the data
        task_config = self.tasks_config["affordability_analysis"].copy()

        # Replace variables in the description directly
        if isinstance(task_config.get("description"), str):
            task_config["description"] = (
                task_config["description"]
                .replace("{context[0]['transactions']}", transactions_str)
                .replace("{context[0]['target_rent']:.2f}", f"{target_rent:.2f}")
            )

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

    # This method will be called as a callback by the crew
    def process_results(self, event_name, **kwargs):
        """Process results after crew kickoff"""
        # Only process the final result when the crew is done
        result = None

        # When called as a callback, the result is in kwargs["final_result"]
        # When called directly, we expect event_name to be "crew_finished" and final_result in kwargs
        if event_name == "crew_finished":
            result = kwargs.get("final_result", "")
        else:
            # For other events or if final_result is not in kwargs, just return
            return None

        logger.info("Processing affordability analysis results")
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

            return analysis_data
        except Exception as e:
            logger.error(f"Error processing analysis result: {str(e)}")
            logger.error(f"Raw result: {result}")
            raise ValueError("Failed to parse analysis result")
