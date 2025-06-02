from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


# Multi-level validation for AI-generated responses
class ResponseValidator:
    def __init__(self, min_confidence: float = 0.7):
        self.min_confidence = min_confidence
        self.logger = logger

    def validate(self, response: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Multi-level validation for AI-generated responses:
        - Factual accuracy: property address, web_ref, application link must match context
        - Completeness: must mention property highlights, agent name, and call-to-action
        - Tone: must be professional and not contain prohibited phrases
        - Confidence: score based on rule coverage
        """
        try:
            self.logger.info("Starting response validation...")
            self.logger.debug(f"Response to validate: {response}")
            self.logger.debug(f"Validation context: {context}")

            property_ctx = context.get("property", {})
            email_ctx = context.get("email", {})
            inquiry_type = context.get("inquiry_type", "")

            # Log validation parameters
            self.logger.info(f"Validating response for inquiry type: {inquiry_type}")
            self.logger.info(f"Property context: {property_ctx}")

            required_fields = [
                property_ctx.get("address"),
                property_ctx.get("application_link"),
                property_ctx.get("web_reference"),
            ]
            missing = [f for f in required_fields if not f or f not in response]

            # Factual checks
            factual_pass = not missing
            self.logger.info(
                f"Factual validation {'passed' if factual_pass else 'failed'}"
            )
            if missing:
                self.logger.warning(f"Missing required fields: {missing}")

            # Completeness checks
            required_keywords = {
                "viewing_request": [
                    "view",
                    "application",
                    "contact",
                    "regards",
                    "schedule",
                ],
                "availability_check": ["available", "status", "application", "contact"],
                "general_info": ["information", "details", "contact", "regards"],
            }
            keywords = required_keywords.get(
                inquiry_type, ["application", "contact", "regards"]
            )
            completeness_pass = all(kw in response.lower() for kw in keywords)
            self.logger.info(
                f"Completeness validation {'passed' if completeness_pass else 'failed'}"
            )

            # Tone check (enhanced)
            prohibited = [
                "scam",
                "fake",
                "guaranteed approval",
                "pay now",
                "urgent",
                "limited time",
                "act now",
                "exclusive offer",
            ]
            tone_pass = not any(p in response.lower() for p in prohibited)
            self.logger.info(f"Tone validation {'passed' if tone_pass else 'failed'}")

            # Confidence score: weighted with inquiry type consideration
            score = 0.0
            if factual_pass:
                score += 0.4
            if completeness_pass:
                score += 0.3
            if tone_pass:
                score += 0.2
            if "thank you" in response.lower() or "best regards" in response.lower():
                score += 0.1

            # Additional points for inquiry type specific elements
            if inquiry_type == "viewing_request" and "schedule" in response.lower():
                score += 0.1
            elif (
                inquiry_type == "availability_check" and "available" in response.lower()
            ):
                score += 0.1
            elif inquiry_type == "general_info" and "information" in response.lower():
                score += 0.1

            score = min(score, 1.0)
            self.logger.info(f"Final confidence score: {score}")

            validation_result = {
                "pass": score >= self.min_confidence,
                "confidence": round(score, 2),
                "details": {
                    "missing_fields": missing,
                    "factual_pass": factual_pass,
                    "completeness_pass": completeness_pass,
                    "tone_pass": tone_pass,
                    "inquiry_type": inquiry_type,
                },
            }

            self.logger.info(f"Validation complete. Result: {validation_result}")
            return validation_result

        except Exception as e:
            self.logger.error(f"Validation error: {str(e)}")
            return {
                "pass": False,
                "confidence": 0.0,
                "details": {
                    "error": str(e),
                    "factual_pass": False,
                    "completeness_pass": False,
                    "tone_pass": False,
                    "missing_fields": [],
                    "inquiry_type": inquiry_type,
                },
            }
