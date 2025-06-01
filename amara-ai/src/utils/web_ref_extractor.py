import re
from typing import Optional, Dict

# Multi-pattern web reference extractor for property listing sites
WEB_REF_PATTERNS = {
    "site_1": r"RR\d{7}",  # e.g. RR4379658
    "site_2": r"(?<!RR)\b\d{9}\b",  # e.g. 114025265
}


def extract_web_ref(subject: str, body: str) -> Dict[str, Optional[str]]:
    """Extract web reference from subject or body using known patterns."""
    for text, found_in in [(subject, "subject"), (body, "body")]:
        for site, pattern in WEB_REF_PATTERNS.items():
            matches = re.findall(pattern, text)
            if matches:
                return {
                    "web_ref": matches[0],
                    "source_site": site,
                    "found_in": found_in,
                }
    return {"web_ref": None, "source_site": None, "found_in": None}
