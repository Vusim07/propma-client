# Affordability Agent Improvement Plan

**Goal:** Enhance the accuracy, reliability, and adherence to requirements for the CrewAI affordability analysis agent.

**Status Key:** `Pending`, `In Progress`, `Done`, `Blocked`

| Task ID    | Description                                               | Priority | Status    | Notes                                                                                                                                                      |
| :--------- | :-------------------------------------------------------- | :------- | :-------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IMP-01** | **Refine `financial_analyst` Task Prompt (`tasks.yaml`)** | High     | `Done`    | Added detailed steps for income verification (incl. fallback), transaction grouping, disposable income calc, and strict JSON output.                       |
| **IMP-02** | **Test Refined Prompt with Original Data**                | High     | `Done`    | Agent output significantly improved, adhering to structure and calculations. Income verification failed _correctly_ due to incomplete bank statement data. |
| **IMP-03** | **Implement Income Verification Fallback Logic**          | High     | `Done`    | Incorporated into the refined prompt (IMP-01). Agent correctly reported no match found based on logic.                                                     |
| **IMP-04** | **Enforce Strict JSON Output Format**                     | High     | `Done`    | Added explicit instructions and a full JSON example in `tasks.yaml` `expected_output`.                                                                     |
| **IMP-05** | **Prevent Data Hallucination**                            | High     | `Done`    | Added explicit instructions in `tasks.yaml` to _only_ use provided data and _not_ invent income/expenses.                                                  |
| **IMP-06** | **Correct Disposable Income Calculation**                 | High     | `Done`    | Added the precise formula `monthly_income - (total_monthly_expenses - current_rent_payment) - monthly_debt_payments` to `tasks.yaml`.                      |
| **IMP-07** | **Improve Transaction Categorization**                    | Medium   | `Done`    | Specified the required categories (Incoming/Outgoing -> Essential, Non-Essential, Debt, Savings, Current Rent) in `tasks.yaml`.                            |
| **IMP-08** | **Test with Diverse Data Sets**                           | Medium   | `Pending` | Gather more examples (different banks, payslip formats, income levels) and test the agent's robustness.                                                    |
| **IMP-09** | **Evaluate Multi-Agent QA Workflow**                      | Medium   | `Pending` | Less critical now after IMP-02 results, provided complete data is used. Re-evaluate after IMP-08.                                                          |
| **IMP-10** | **(If Needed) Implement QA Agent**                        | Low      | `Pending` | Define and implement a `quality_assurance_analyst` agent and task to verify the primary analyst's output against source data.                              |
| **IMP-11** | **(If Needed) Update Crew Structure for QA**              | Low      | `Pending` | Modify `crew.py` to incorporate the QA agent, potentially using a hierarchical process or sequential tasks with feedback loops.                            |

---

**Discussion on Multi-Agent QA Workflow:**

Your thought process is sound:

1.  **Extractor Agent:** Focuses purely on pulling structured data from documents.
2.  **QA Agent 1 (Extraction Verification):** Verifies the Extractor's output against the raw documents. Sends back for correction if needed.
3.  **Analyst Agent (Current `financial_analyst`):** Performs the affordability assessment using the _verified_ extracted data.
4.  **QA Agent 2 (Assessment Verification):** Verifies the Analyst's final report (metrics, logic, recommendations) against the verified data and rules. Sends back for correction if needed.

**Pros:**

- **Specialization:** Each agent focuses on a smaller, more manageable task.
- **Verification:** Explicit checks reduce errors and hallucinations.
- **Modularity:** Easier to swap out or improve individual agents.

**Cons:**

- **Complexity:** More agents and tasks to manage.
- **Latency:** Each handoff adds time to the overall process.
- **Cost:** More LLM calls increase operational costs.

**Recommendation:**

Let's first test the impact of the refined single-agent prompt (**IMP-02**). The detailed instructions might be enough to significantly improve accuracy. If inaccuracies or hallucinations persist (**IMP-08**), then implementing the multi-agent QA workflow (**IMP-09, IMP-10, IMP-11**) is the logical next step. We can start with just one QA agent verifying the final output before adding the extraction QA step if necessary.

**Update after IMP-02:** The single agent with refined prompt performs well when instructions are clear. The primary issue now is ensuring complete input data (e.g., bank statements covering salary deposits) for accurate verification and meaningful results. Focus should be on data quality/completeness before adding QA agent complexity.
