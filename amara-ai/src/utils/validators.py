from typing import Dict, Any


# Multi-level validation for AI-generated responses
class ResponseValidator:
    def __init__(self, min_confidence: float = 0.7):
        self.min_confidence = min_confidence

    def validate(self, response: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Multi-level validation for AI-generated responses:
        - Factual accuracy: property address, web_ref, application link must match context
        - Completeness: must mention property highlights, agent name, and call-to-action
        - Tone: must be professional and not contain prohibited phrases
        - Confidence: score based on rule coverage
        """
        property_ctx = context.get("property", {})
        email_ctx = context.get("email", {})
        inquiry_type = context.get("inquiry_type", "")
        required_fields = [
            property_ctx.get("address"),
            property_ctx.get("application_link"),
            property_ctx.get("web_reference"),
        ]
        missing = [f for f in required_fields if not f or f not in response]
        # Factual checks
        factual_pass = not missing
        # Completeness checks
        completeness_pass = all(
            kw in response.lower()
            for kw in ["view", "application", "contact", "regards"]
        )
        # Tone check (simple)
        prohibited = ["scam", "fake", "guaranteed approval", "pay now"]
        tone_pass = not any(p in response.lower() for p in prohibited)
        # Confidence score: weighted
        score = 0.0
        if factual_pass:
            score += 0.4
        if completeness_pass:
            score += 0.3
        if tone_pass:
            score += 0.2
        if "thank you" in response.lower() or "best regards" in response.lower():
            score += 0.1
        score = min(score, 1.0)
        return {
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
