from typing import Dict, Any, Optional, Set
import re


# Example: Template manager for dynamic response templates
class TemplateManager:
    def __init__(
        self, templates: Dict[str, str], default_template: Optional[str] = None
    ):
        self.templates = templates
        self.default_template = (
            default_template
            or """
        Dear {customer_name},
        Thank you for your inquiry. We will get back to you soon.
        Best regards,
        {agent_name}
        """
        )

    def get_template(self, inquiry_type: str) -> str:
        # Return template for inquiry_type, or fallback to default
        return self.templates.get(inquiry_type) or self.default_template

    def required_variables(self, template: str) -> Set[str]:
        # Find all {{variable}} placeholders in the template
        return set(re.findall(r"\{\{(.*?)\}\}", template))

    def render_template(self, template: str, variables: Dict[str, Any]) -> str:
        # Validate all required variables are present
        required = self.required_variables(template)
        missing = [var for var in required if var not in variables]
        if missing:
            raise ValueError(f"Missing template variables: {', '.join(missing)}")
        # Substitute variables
        for key, value in variables.items():
            template = template.replace(f"{{{{{key}}}}}", str(value))
        return template

    def validate_template(self, template: str) -> bool:
        # Check for unclosed or malformed placeholders
        return all(
            re.match(r"^[a-zA-Z0-9_]+$", var)
            for var in self.required_variables(template)
        )
