from typing import Dict, Any, Optional, Set
import re
import logging
import json

logger = logging.getLogger(__name__)


# Example: Template manager for dynamic response templates
class TemplateManager:
    def __init__(
        self, templates: Dict[str, str], default_template: Optional[str] = None
    ):
        self.templates = templates
        self.logger = logger
        self.default_template = (
            default_template
            or """Hi,
Thank you for your inquiry. We will get back to you soon.
Best regards,
{agent_name}
{agent_contact}
"""
        )

    def get_template(self, inquiry_type: str) -> str:
        """Get template for inquiry type, or fallback to default."""
        self.logger.info(f"Getting template for inquiry type: {inquiry_type}")
        template = self.templates.get(inquiry_type) or self.default_template
        self.logger.debug(f"Selected template: {template}")
        return template

    def required_variables(self, template: str) -> Set[str]:
        """Find all {{variable}} placeholders in the template."""
        variables = set(re.findall(r"\{\{(.*?)\}\}", template))
        self.logger.debug(f"Required variables: {variables}")
        return variables

    def render_template(self, template: str, variables: Dict[str, Any]) -> str:
        """Render template with variables, handling both string and JSON responses."""
        try:
            self.logger.info("Starting template rendering...")
            self.logger.debug(f"Template: {template}")
            self.logger.debug(f"Variables: {variables}")

            # Validate all required variables are present
            required = self.required_variables(template)
            missing = [var for var in required if var not in variables]
            if missing:
                error_msg = f"Missing template variables: {', '.join(missing)}"
                self.logger.error(error_msg)
                raise ValueError(error_msg)

            # Handle both string and JSON responses
            if isinstance(template, str) and template.strip().startswith("{"):
                try:
                    # Try to parse as JSON first
                    template_dict = json.loads(template)
                    if isinstance(template_dict, dict) and "response" in template_dict:
                        # Handle CrewAI response format
                        response = template_dict["response"]
                        if isinstance(response, dict):
                            # Substitute variables in both subject and body
                            for key, value in variables.items():
                                if "subject" in response:
                                    response["subject"] = response["subject"].replace(
                                        f"{{{{{key}}}}}", str(value)
                                    )
                                if "body" in response:
                                    response["body"] = response["body"].replace(
                                        f"{{{{{key}}}}}", str(value)
                                    )
                            return json.dumps({"response": response})
                except json.JSONDecodeError:
                    # If not valid JSON, treat as regular template
                    pass

            # Regular template substitution
            result = template
            for key, value in variables.items():
                result = result.replace(f"{{{{{key}}}}}", str(value))

            self.logger.info("Template rendered successfully")
            return result

        except Exception as e:
            self.logger.error(f"Error rendering template: {str(e)}")
            raise

    def validate_template(self, template: str) -> bool:
        """Validate template format and placeholders."""
        try:
            self.logger.info("Validating template...")
            # Check for unclosed or malformed placeholders
            variables = self.required_variables(template)
            is_valid = all(re.match(r"^[a-zA-Z0-9_]+$", var) for var in variables)

            if not is_valid:
                self.logger.warning(
                    "Template validation failed: invalid variable names"
                )
            else:
                self.logger.info("Template validation passed")

            return is_valid
        except Exception as e:
            self.logger.error(f"Template validation error: {str(e)}")
            return False
