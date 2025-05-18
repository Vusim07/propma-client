from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from typing import List, Dict, Any, Optional
import re
import datetime
import json
import logging
import sys
import os
import traceback
from langfuse import Langfuse

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
        # Initialize Langfuse with debug logging
        self.langfuse = None
        logger.info("[Langfuse] Attempting to initialize Langfuse SDK...")
        logger.info(f"[Langfuse] LANGFUSE_HOST: {os.getenv('LANGFUSE_HOST')}")
        logger.info(
            f"[Langfuse] LANGFUSE_PUBLIC_KEY exists: {bool(os.getenv('LANGFUSE_PUBLIC_KEY'))}"
        )
        logger.info(
            f"[Langfuse] LANGFUSE_SECRET_KEY exists: {bool(os.getenv('LANGFUSE_SECRET_KEY'))}"
        )
        logger.info(f"[Langfuse] LANGFUSE_PROJECT: {os.getenv('LANGFUSE_PROJECT')}")
        logger.info(f"[Langfuse] LANGFUSE_DEBUG: {os.getenv('LANGFUSE_DEBUG')}")
        try:
            self.langfuse = Langfuse(
                public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
                secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
                host=os.getenv("LANGFUSE_HOST", "http://localhost:3000"),
                # Set debug to False to suppress verbose internal logs
                debug=False,
            )
            logger.info("[Langfuse] Langfuse SDK initialized successfully.")
        except Exception as e:
            logger.error(f"[Langfuse] Langfuse initialization failed: {e}")
        # Prepare data for context immediately
        self.prepare_data()
        logger.info("AffordabilityAnalysisCrew initialized with comprehensive data")

    # --- Observability/Monitoring Integration ---
    def log_observability_event(self, step: str, data: dict, event_type: str = "info"):
        """Log structured observability/monitoring events for AgentOps or future integrations."""
        log_entry = {
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "step": step,
            "event_type": event_type,
            "data": data,
        }
        logger.info(f"[OBSERVABILITY] {json.dumps(log_entry, default=str)}")
        # Langfuse trace logging
        if self.langfuse:
            try:
                trace = self.langfuse.trace(
                    name=step,
                    input=data,
                    metadata={"event_type": event_type},
                )
                # Try the correct method for Langfuse SDK
                if hasattr(trace, "flush"):
                    logger.info("[Langfuse] Calling trace.flush() to finalize trace.")
                    trace.flush(output=data)
                elif hasattr(trace, "finalize"):
                    logger.info(
                        "[Langfuse] Calling trace.finalize() to finalize trace."
                    )
                    trace.finalize(output=data)
                else:
                    logger.warning(
                        "[Langfuse] Trace object has no flush() or finalize() method. Trace may not be finalized."
                    )
            except Exception as e:
                logger.warning(f"Langfuse trace logging failed: {e}")

    def parse_net_income_from_payslip_text(self, payslip_text: str) -> float:
        """Extract net income from payslip OCR text using regex heuristics."""
        if not payslip_text:
            return 0.0
        # Try to find a line with 'Net Pay' and a number (robust to extra whitespace/newlines)
        lines = payslip_text.splitlines()
        for idx, line in enumerate(lines):
            if "net pay" in line.lower():
                # Look for a number on this line
                nums = re.findall(r"([\d\s,]+\.\d{2})", line)
                if nums:
                    try:
                        return float(nums[-1].replace(",", "").replace(" ", ""))
                    except Exception:
                        continue
                # Look in the next 1-2 lines for a number
                for offset in range(1, 3):
                    if idx + offset < len(lines):
                        nextline = lines[idx + offset]
                        nums = re.findall(r"([\d\s,]+\.\d{2})", nextline)
                        if nums:
                            try:
                                return float(nums[-1].replace(",", "").replace(" ", ""))
                            except Exception:
                                continue
        # Fallback: search for 'Net Pay' or 'Net Income' followed by a number anywhere
        patterns = [
            r"Net Pay\s*[:\-\n]?\s*R?([\d\s,]+\.\d{2})",
            r"Net Income\s*[:\-\n]?\s*R?([\d\s,]+\.\d{2})",
        ]
        for pat in patterns:
            match = re.search(pat, payslip_text, re.IGNORECASE)
            if match:
                val = match.group(1).replace(",", "").replace(" ", "")
                try:
                    return float(val)
                except Exception:
                    continue
        return 0.0

    def parse_transactions_from_bank_statement_text(self, statement_text: str) -> list:
        """Extract transactions from bank statement OCR text using regex heuristics."""
        if not statement_text:
            return []
        # South African bank statements often have: date, description, amount (may be on separate lines)
        # We'll look for a date, then scan forward for a negative/positive amount
        lines = statement_text.splitlines()
        transactions = []
        date_regex = re.compile(r"(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})")
        amount_regex = re.compile(r"(-?\s*R?\s*[\d\s,]+\.\d{2})")
        i = 0
        while i < len(lines):
            date_match = date_regex.search(lines[i])
            if date_match:
                date_str = date_match.group(1)
                # Look ahead for amount and description
                desc = []
                amount = None
                j = i + 1
                while j < len(lines) and j < i + 6:
                    amt_match = amount_regex.search(lines[j])
                    if amt_match:
                        amt_str = amt_match.group(1)
                        amt_str = (
                            amt_str.replace("R", "").replace(",", "").replace(" ", "")
                        )
                        try:
                            amount = float(amt_str)
                        except Exception:
                            amount = 0.0
                        break
                    else:
                        desc.append(lines[j].strip())
                    j += 1
                if amount is not None:
                    # Try to parse date to DD/MM/YYYY
                    try:
                        dt = datetime.datetime.strptime(date_str.strip(), "%d %b %Y")
                        date_fmt = dt.strftime("%d/%m/%Y")
                    except Exception:
                        date_fmt = date_str.strip()
                    tx_type = "debit" if amount < 0 else "credit"
                    transactions.append(
                        {
                            "date": date_fmt,
                            "description": " ".join(desc).strip(),
                            "amount": amount,
                            "type": tx_type,
                        }
                    )
                i = j
            else:
                i += 1
        return transactions

    def preprocess_financials(self):
        """Deterministically compute total net income, total expenses, debts, and apply the 30% rule."""
        logger.info("Preprocessing financial data for deterministic calculations")
        transactions = self.transactions_data or []
        payslip = self.payslip_data or {}
        credit = self.credit_report or {}
        # --- NEW: Parse from raw OCR text if structured data is missing ---
        # Payslip net income
        payslip_income = 0.0
        if isinstance(payslip, dict):
            payslip_income = float(
                payslip.get("netIncome") or payslip.get("net_income") or 0
            )
            if payslip_income == 0 and "text" in payslip:
                payslip_income = self.parse_net_income_from_payslip_text(
                    payslip["text"]
                )
        # Bank statement transactions
        if not transactions or len(transactions) == 0:
            # Try to parse from bank_statement_data OCR text
            bank_data = self.bank_statement_data
            if isinstance(bank_data, list):
                for doc in bank_data:
                    if isinstance(doc, dict) and "text" in doc:
                        parsed = self.parse_transactions_from_bank_statement_text(
                            doc["text"]
                        )
                        if parsed:
                            transactions.extend(parsed)
            elif isinstance(bank_data, dict) and "text" in bank_data:
                parsed = self.parse_transactions_from_bank_statement_text(
                    bank_data["text"]
                )
                if parsed:
                    transactions.extend(parsed)
        # Aggregate income and expenses from transactions
        total_income = 0.0
        total_expenses = 0.0
        for t in transactions:
            amt = float(t.get("amount", 0))
            # Outgoing: negative or type 'debit' or description with '-' or 'R' prefix
            if (
                str(t.get("type", "")).lower() == "debit"
                or str(t.get("description", "")).strip().startswith("-")
                or ("R" in str(t.get("description", "")) and amt < 0)
            ):
                total_expenses += abs(amt)
            else:
                total_income += amt
        # Payslip fallback
        if payslip_income > 0:
            total_income = max(total_income, payslip_income)
        # Credit report debts
        total_debt = 0.0
        if credit and "accountsSummary" in credit:
            total_debt = float(credit["accountsSummary"].get("negativeAccounts", 0))
        # 30% rule
        max_affordable_rent = 0.3 * total_income if total_income > 0 else 0
        can_afford = (
            self.target_rent is not None and self.target_rent <= max_affordable_rent
        )
        # Prepare audit trail
        audit = {
            "total_income": total_income,
            "total_expenses": total_expenses,
            "total_debt": total_debt,
            "max_affordable_rent": max_affordable_rent,
            "target_rent": self.target_rent,
            "can_afford": can_afford,
            "rule": "target_rent <= 0.3 * total_income",
        }
        self.log_observability_event("preprocessing", audit)
        logger.info(f"Preprocessing result: {audit}")
        return audit

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

        # Preprocess financials and add to context
        self.preprocessed = self.preprocess_financials()
        self.context_data["preprocessed"] = self.preprocessed

        # Log the keys present in the context
        logger.info(f"Context created with keys: {list(self.context_data.keys())}")

        # Optional: Log structure or type of complex data for debugging
        if self.bank_statement_data:
            logger.info(f"Bank statement data type: {type(self.bank_statement_data)}")
        if self.payslip_data:
            logger.info(f"Payslip data type: {type(self.payslip_data)}")

        self.log_observability_event("prepare_data", self.context_data)
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

        # Update task description to include preprocessed audit block and instruct LLM to only explain, not decide
        audit = context.get("preprocessed", {})
        audit_json = json.dumps(audit, indent=2)
        task_config["description"] += (
            "\n\nBelow is the result of deterministic preprocessing (do not override these values):\n"
            f"```json\n{audit_json}\n```\n"
            "You must use these values for your reasoning and recommendations. Do NOT change the can_afford value. "
            "Explain the result, cite the 30% rule, and provide actionable recommendations."
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

    def _map_agent_fields(
        self, final_data: dict, input_target_rent: float = 0.0
    ) -> dict:
        """Map agent synonyms to required schema fields and enforce target_rent as input value."""
        metrics = final_data.get("metrics", {})
        # Always set target_rent to the input value (not agent-calculated)
        metrics["target_rent"] = input_target_rent
        # Map affordable_rent -> target_rent (but always overwrite with input value)
        if "affordable_rent" in metrics:
            metrics.pop("affordable_rent")
        # Map monthly_expenses -> total_monthly_expenses
        if "monthly_expenses" in metrics:
            metrics["total_monthly_expenses"] = metrics.pop("monthly_expenses")
        # Map gross_monthly_income or net_monthly_income -> monthly_income
        if "gross_monthly_income" in metrics:
            metrics["monthly_income"] = metrics["gross_monthly_income"]
        elif "net_monthly_income" in metrics:
            metrics["monthly_income"] = metrics["net_monthly_income"]
        # Map total_debt_payments -> monthly_debt_payments
        if "total_debt_payments" in metrics:
            metrics["monthly_debt_payments"] = metrics["total_debt_payments"]
        final_data["metrics"] = metrics
        # Transaction analysis mapping (flattened to nested if needed)
        ta = final_data.get("transaction_analysis", {})
        # If agent used flat keys, map to nested structure
        if "income" in ta and isinstance(ta["income"], dict):
            ta.setdefault("incoming", {})
            if "salary" in ta["income"]:
                ta["incoming"]["salary_wages"] = [ta["income"]["salary"]]
            if "additional_income" in ta["income"]:
                ta["incoming"]["other_income"] = [ta["income"]["additional_income"]]
        if "expenses" in ta and isinstance(ta["expenses"], dict):
            ta.setdefault("outgoing", {})
            if "rent" in ta["expenses"]:
                ta["outgoing"]["current_rent"] = [ta["expenses"]["rent"]]
            if "utilities" in ta["expenses"]:
                ta["outgoing"]["essential_expenses"] = ta["outgoing"].get(
                    "essential_expenses", []
                ) + [ta["expenses"]["utilities"]]
            if "groceries" in ta["expenses"]:
                ta["outgoing"]["essential_expenses"] = ta["outgoing"].get(
                    "essential_expenses", []
                ) + [ta["expenses"]["groceries"]]
            if "transport" in ta["expenses"]:
                ta["outgoing"]["essential_expenses"] = ta["outgoing"].get(
                    "essential_expenses", []
                ) + [ta["expenses"]["transport"]]
            if "debt_payments" in ta["expenses"]:
                ta["outgoing"]["debt_payments"] = [ta["expenses"]["debt_payments"]]
            if "discretionary" in ta["expenses"]:
                ta["outgoing"]["non_essential_expenses"] = [
                    ta["expenses"]["discretionary"]
                ]
        final_data["transaction_analysis"] = ta
        return final_data

    def _validate_and_complete_output(self, final_data: dict) -> dict:
        """Validate output, enforce required fields, and handle missing_fields_notes. Robust to malformed agent output."""
        # Get the input target_rent from context if available
        input_target_rent = 0.0
        try:
            # Try to get from self.context_data (set during crew init)
            input_target_rent = float(self.context_data.get("target_rent", 0.0))
        except Exception:
            input_target_rent = 0.0
        # Map agent synonyms to required schema fields first, always enforce target_rent
        final_data = self._map_agent_fields(final_data, input_target_rent)

        # Define required fields and nested structure
        required_fields = [
            "can_afford",
            "confidence",
            "risk_factors",
            "recommendations",
            "metrics",
            "income_verification",
            "transaction_analysis",
            "missing_fields_notes",
        ]
        required_metrics = [
            "monthly_income",
            "total_monthly_expenses",
            "monthly_debt_payments",
            "current_rent_payment",
            "disposable_income",
            "rent_to_income_ratio",
            "debt_to_income_ratio",
            "savings_rate",
            "target_rent",
            "total_debt",
        ]
        required_income_verification = [
            "payslip_net_income",
            "verified_average_deposit",
            "is_verified",
            "confidence",
            "match_type",
            "stated_vs_documented_ratio",
            "notes",
        ]
        required_transaction_analysis = {
            "incoming": ["salary_wages", "other_income"],
            "outgoing": [
                "essential_expenses",
                "non_essential_expenses",
                "debt_payments",
                "savings_investments",
                "current_rent",
            ],
        }

        # Ensure missing_fields_notes exists and is a dict
        if not isinstance(final_data.get("missing_fields_notes"), dict):
            final_data["missing_fields_notes"] = {}
        notes = final_data["missing_fields_notes"]

        # Top-level fields: ensure correct type
        for field in required_fields:
            if field not in final_data or final_data[field] is None:
                if field in [
                    "metrics",
                    "income_verification",
                    "transaction_analysis",
                    "missing_fields_notes",
                ]:
                    final_data[field] = {}
                elif field in ["risk_factors", "recommendations"]:
                    final_data[field] = []
                else:
                    final_data[field] = 0
                notes[field] = "Missing from agent output. Filled with default value."

        # Metrics: ensure dict, then fill required fields
        metrics = final_data.get("metrics")
        if not isinstance(metrics, dict):
            metrics = {}
        for m in required_metrics:
            if m not in metrics or metrics[m] is None:
                metrics[m] = 0
                notes[f"metrics.{m}"] = "Missing or undetermined. Set to 0."
        final_data["metrics"] = metrics

        # Income verification: ensure dict, then fill required fields
        income_ver = final_data.get("income_verification")
        if not isinstance(income_ver, dict):
            income_ver = {}
        for f in required_income_verification:
            if f not in income_ver or income_ver[f] is None:
                if f in ["notes", "match_type"]:
                    income_ver[f] = ""
                elif f == "is_verified":
                    income_ver[f] = False
                elif f == "confidence":
                    income_ver[f] = 0.0
                else:
                    income_ver[f] = 0
                notes[f"income_verification.{f}"] = (
                    "Missing or undetermined. Set to default."
                )
        final_data["income_verification"] = income_ver

        # Transaction analysis: enforce nested structure
        ta = final_data.get("transaction_analysis")
        if not isinstance(ta, dict):
            ta = {}
        # Always use required nested keys
        for group, fields in required_transaction_analysis.items():
            if group not in ta or not isinstance(ta[group], dict):
                ta[group] = {}
            for f in fields:
                if f not in ta[group] or ta[group][f] is None:
                    ta[group][f] = []
                    notes[f"transaction_analysis.{group}.{f}"] = (
                        "Missing or undetermined. Set to empty list."
                    )
        final_data["transaction_analysis"] = ta

        # Remove notes for fields that are now present and valid
        to_remove = []
        for k in notes:
            parts = k.split(".")
            val = final_data
            try:
                for p in parts:
                    val = val[p] if isinstance(val, dict) else None
                if val not in (None, 0, [], "", False):
                    to_remove.append(k)
            except Exception:
                continue
        for k in to_remove:
            notes.pop(k)
        final_data["missing_fields_notes"] = notes
        return final_data

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
                    self.log_observability_event("llm_output", analysis_data)
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

            # Validate and complete output before returning
            final_data = self._validate_and_complete_output(final_data)
            logger.info(f"Final Processed Data being returned: {final_data}")
            logger.info(f"========== PROCESS RESULTS COMPLETED ==========")
            self.log_observability_event("process_results_end", final_data)
            return final_data

        except Exception as e:
            logger.error(f"========== PROCESS RESULTS FAILED ==========")
            logger.error(f"Unhandled exception during result processing: {str(e)}")
            logger.error(f"Exception type: {type(e).__name__}")
            logger.error(f"Stack trace: {traceback.format_exc()}")
            logger.error(f"Original raw result: {result}")
            return final_data
