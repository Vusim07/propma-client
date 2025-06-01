# Real Estate Email Response AI Agent - Implementation Plan

## Architecture Overview

### System Flow

```
AWS SES → Supabase Webhook → Web_ref Extraction → Property Query → CrewAI Agent → Response Generation → Email Storage & Sending
```

### Core Components

1. **Enhanced Supabase Webhook Function**
2. **CrewAI Email Response Workflow**
3. **Multi-level Validation System**
4. **Fallback & Error Handling**

## Database Schema Extensions

### New Tables

```sql
-- Unprocessed emails for manual review
CREATE TABLE unprocessed_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_email_id UUID REFERENCES email_threads(id),
    reason TEXT NOT NULL, -- 'web_ref_not_found', 'property_not_found', 'validation_failed'
    extraction_attempt JSONB, -- Store what patterns were tried
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP NULL,
    resolved_by UUID NULL
);

-- Response templates
CREATE TABLE response_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inquiry_type TEXT NOT NULL, -- 'viewing_request', 'availability_check'
    template_content TEXT NOT NULL,
    variables JSONB, -- List of variables to be replaced
    created_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Agent performance tracking
CREATE TABLE agent_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_thread_id UUID REFERENCES email_threads(id),
    web_ref TEXT,
    inquiry_type TEXT,
    response_generated_at TIMESTAMP DEFAULT NOW(),
    validation_score DECIMAL(3,2), -- 0.00 to 1.00
    sent_successfully BOOLEAN DEFAULT FALSE,
    agent_confidence DECIMAL(3,2)
);
```

## CrewAI Implementation

### Agent Definitions

```python
class EmailResponseCrew:
    def __init__(self):
        self.email_classifier = Agent(
            role="Email Classification Specialist",
            goal="Accurately classify property inquiry emails and extract key requirements",
            backstory="Expert at understanding real estate inquiries and customer intent",
            tools=[EmailAnalysisTools()],
            verbose=True
        )

        self.property_context_agent = Agent(
            role="Property Information Specialist",
            goal="Enrich responses with accurate property data and context",
            backstory="Real estate expert who knows how to present property information effectively",
            tools=[PropertyDataTools()],
            verbose=True
        )

        self.response_generator = Agent(
            role="Professional Email Response Writer",
            goal="Generate contextual, professional email responses that convert inquiries",
            backstory="Experienced real estate communication specialist",
            tools=[ResponseGenerationTools()],
            verbose=True
        )

        self.response_validator = Agent(
            role="Quality Assurance Specialist",
            goal="Ensure responses are accurate, professional, and contain no errors",
            backstory="Detail-oriented professional ensuring customer communication excellence",
            tools=[ValidationTools()],
            verbose=True
        )
```

### Task Definitions

```python
class EmailResponseTasks:
    def classify_email_task(self, email_data):
        return Task(
            description=f"""
            Analyze the following email inquiry and classify it:

            Email Content: {email_data['body']}
            Subject: {email_data['subject']}

            Determine:
            1. Inquiry type (viewing_request, availability_check, general_info)
            2. Urgency level (high, medium, low)
            3. Key requirements mentioned
            4. Preferred contact method if specified

            Return structured classification data.
            """,
            agent=self.email_classifier,
            expected_output="JSON object with inquiry_type, urgency, requirements, and contact_preference"
        )

    def enrich_context_task(self, property_data, classification):
        return Task(
            description=f"""
            Using the property data and email classification, prepare response context:

            Property Data: {property_data}
            Classification: {classification}

            Prepare:
            1. Key property highlights relevant to inquiry
            2. Availability status and viewing options
            3. Application process information
            4. Contact details and next steps
            """,
            agent=self.property_context_agent,
            expected_output="Structured context data for response generation"
        )

    def generate_response_task(self, context_data, template):
        return Task(
            description=f"""
            Generate a professional email response using:

            Context: {context_data}
            Base Template: {template}

            Requirements:
            1. Professional but warm tone
            2. Include all relevant property information
            3. Clear call-to-action with application link
            4. Appropriate urgency based on classification
            5. No hallucinated information
            """,
            agent=self.response_generator,
            expected_output="Complete email response with subject and body"
        )

    def validate_response_task(self, response, original_data):
        return Task(
            description=f"""
            Validate the generated response against original data:

            Generated Response: {response}
            Original Property Data: {original_data}

            Check for:
            1. Factual accuracy
            2. Proper application link inclusion
            3. Professional tone
            4. No contradictions
            5. All requirements addressed

            Assign confidence score (0.0-1.0)
            """,
            agent=self.response_validator,
            expected_output="Validation report with pass/fail and confidence score"
        )
```

## Enhanced Supabase Webhook Function

```python
# supabase/functions/email-response-handler/main.py

import asyncio
import re
import json
from supabase import create_client
from email_response_crew import EmailResponseWorkflow

class EmailResponseHandler:
    def __init__(self):
        self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.crew_workflow = EmailResponseWorkflow()

    def extract_web_ref(self, subject: str, body: str) -> dict:
        """Extract web reference using multiple patterns"""
        patterns = {
            'site_1': r'RR\d{7}',  # RR4379658
            'site_2': r'(?<!RR)\b\d{9}\b'  # 114025265
        }

        # Try subject first, then body
        for text in [subject, body]:
            for site, pattern in patterns.items():
                matches = re.findall(pattern, text)
                if matches:
                    return {
                        'web_ref': matches[0],
                        'source_site': site,
                        'found_in': 'subject' if text == subject else 'body'
                    }

        return {'web_ref': None, 'source_site': None, 'found_in': None}

    async def get_property_data(self, web_ref: str) -> dict:
        """Fetch property data from database"""
        result = self.supabase.table('properties').select('*').eq('web_ref', web_ref).execute()
        return result.data[0] if result.data else None

    async def get_response_template(self, inquiry_type: str) -> str:
        """Fetch appropriate response template"""
        result = self.supabase.table('response_templates').select('template_content').eq('inquiry_type', inquiry_type).eq('is_active', True).execute()
        return result.data[0]['template_content'] if result.data else self.get_default_template()

    def get_default_template(self) -> str:
        return """
        Dear {customer_name},

        Thank you for your inquiry about {property_address}.

        {property_status_message}

        {call_to_action}

        To proceed with your application, please use this link: {application_link}

        Best regards,
        {agent_name}
        """

    async def handle_unprocessed_email(self, email_data: dict, reason: str, extraction_attempt: dict):
        """Store unprocessed email for manual review"""
        await self.supabase.table('unprocessed_emails').insert({
            'original_email_id': email_data['id'],
            'reason': reason,
            'extraction_attempt': extraction_attempt
        }).execute()

        # Send notification to agents (implement your notification system)
        await self.send_agent_notification(email_data, reason)

    async def process_email(self, email_data: dict) -> dict:
        """Main email processing function"""
        try:
            # Extract web reference
            extraction_result = self.extract_web_ref(
                email_data['subject'],
                email_data['body']
            )

            if not extraction_result['web_ref']:
                await self.handle_unprocessed_email(
                    email_data,
                    'web_ref_not_found',
                    extraction_result
                )
                return {'success': False, 'reason': 'web_ref_not_found'}

            # Get property data
            property_data = await self.get_property_data(extraction_result['web_ref'])

            if not property_data:
                await self.handle_unprocessed_email(
                    email_data,
                    'property_not_found',
                    extraction_result
                )
                return {'success': False, 'reason': 'property_not_found'}

            # Process through CrewAI workflow
            workflow_input = {
                'email_data': email_data,
                'property_data': property_data,
                'web_ref': extraction_result['web_ref']
            }

            response_result = await self.crew_workflow.run(workflow_input)

            if response_result['validation_score'] < 0.7:  # Validation threshold
                await self.handle_unprocessed_email(
                    email_data,
                    'validation_failed',
                    {'validation_score': response_result['validation_score']}
                )
                return {'success': False, 'reason': 'validation_failed'}

            # Store response and send email
            await self.store_and_send_response(email_data, response_result, property_data)

            return {'success': True, 'response_id': response_result['id']}

        except Exception as e:
            await self.handle_unprocessed_email(
                email_data,
                'processing_error',
                {'error': str(e)}
            )
            return {'success': False, 'reason': 'processing_error', 'error': str(e)}
```

## Response Templates

### Viewing Request Template

```
Subject: Re: Property Viewing - {web_ref}

Dear {customer_name},

Thank you for your interest in {property_address}. I'd be delighted to arrange a viewing for you.

This {property_type} features {key_highlights} and is currently {availability_status}.

Available viewing slots:
- {viewing_options}

To proceed with your application or schedule a viewing, please use this secure link: {application_link}

I look forward to showing you this wonderful property.

Best regards,
{agent_name}
{agent_contact}
```

### Availability Check Template

```
Subject: Re: Property Availability - {web_ref}

Dear {customer_name},

Thank you for your inquiry about {property_address}.

{availability_message}

{property_highlights}

If you'd like to proceed with an application, please use this link: {application_link}

Feel free to contact me if you have any questions.

Best regards,
{agent_name}
{agent_contact}
```

## Validation Framework

### Multi-Level Validation Checks

```python
class ResponseValidator:
    def __init__(self):
        self.validation_rules = {
            'required_elements': [
                'application_link',
                'property_address',
                'agent_contact'
            ],
            'forbidden_phrases': [
                'I don\'t know',
                'I\'m not sure',
                'maybe',
                'probably'
            ],
            'tone_indicators': [
                'professional_greeting',
                'clear_call_to_action',
                'contact_information'
            ]
        }

    def validate_content(self, response: str, property_data: dict) -> dict:
        """Comprehensive response validation"""
        score = 1.0
        issues = []

        # Check required elements
        for element in self.validation_rules['required_elements']:
            if f"{{{element}}}" in response or property_data.get(element) in response:
                continue
            else:
                score -= 0.2
                issues.append(f"Missing {element}")

        # Check for forbidden phrases
        for phrase in self.validation_rules['forbidden_phrases']:
            if phrase.lower() in response.lower():
                score -= 0.3
                issues.append(f"Contains uncertain language: {phrase}")

        # Validate application link format
        if not self.validate_application_link(response, property_data):
            score -= 0.3
            issues.append("Invalid or missing application link")

        return {
            'validation_score': max(0.0, score),
            'issues': issues,
            'passed': score >= 0.7
        }

    def validate_application_link(self, response: str, property_data: dict) -> bool:
        """Validate application link is present and properly formatted"""
        expected_link = property_data.get('application_link')
        return expected_link and expected_link in response
```

## GitHub Copilot Implementation Prompt

```markdown
# GitHub Copilot Implementation Prompt

You are implementing a production-ready AI agent system for real estate email responses using CrewAI. The system processes property inquiries from listing sites and generates professional email responses.

## Key Requirements:

1. **CrewAI Integration**: Create 4 specialized agents (EmailClassifier, PropertyContext, ResponseGenerator, ResponseValidator)
2. **Web Reference Extraction**: Multi-pattern regex for different listing sites (RR4379658 format and 114025265 format)
3. **Template System**: Hybrid approach using base templates enhanced by AI
4. **Validation Framework**: Multi-level validation with 0.7 minimum confidence threshold
5. **Error Handling**: Comprehensive fallback system with manual review queue
6. **Database Integration**: Supabase integration with proper error handling
7. **Production Readiness**: Include logging, monitoring, and performance optimization

## Implementation Focus Areas:

### 1. Agent Architecture

- Implement specialized agents with clear roles and responsibilities
- Use proper tool integration for database queries and email analysis
- Implement task chaining with proper data flow between agents

### 2. Validation System

- Multi-level content validation (data accuracy, tone, completeness)
- Confidence scoring system (0.0-1.0 scale)
- Automatic fallback to manual review for low-confidence responses

### 3. Error Handling & Monitoring

- Comprehensive try-catch blocks with specific error types
- Structured logging for debugging and performance monitoring
- Automatic retry logic with exponential backoff
- Dead letter queue for failed processing

### 4. Database Operations

- Efficient property data retrieval with proper indexing
- Transaction management for response storage
- Connection pooling and query optimization
- Proper SQL injection prevention

### 5. Template Management

- Dynamic template selection based on inquiry type
- Variable substitution with validation
- Template versioning and A/B testing capability

### 6. Performance Optimization

- Async/await patterns for concurrent processing
- Caching strategies for frequently accessed data
- Response time monitoring and optimization
- Memory management for large email volumes

## Code Structure:
```

/email_response_system/
├── agents/
│ ├── **init**.py
│ ├── email_classifier.py
│ ├── property_context.py
│ ├── response_generator.py
│ └── response_validator.py
├── tools/
│ ├── **init**.py
│ ├── email_analysis_tools.py
│ ├── property_data_tools.py
│ └── validation_tools.py
├── workflows/
│ ├── **init**.py
│ └── email_response_workflow.py
├── utils/
│ ├── **init**.py
│ ├── web_ref_extractor.py
│ ├── template_manager.py
│ └── validators.py
├── config/
│ ├── **init**.py
│ └── settings.py
└── main.py

```

## Implementation Priority:
1. Start with web reference extraction utility (critical path)
2. Implement database integration layer
3. Build CrewAI agents and workflow
4. Add validation framework
5. Implement error handling and monitoring
6. Add performance optimization and caching

Generate production-ready Python code with proper error handling, logging, type hints, and comprehensive documentation. Include unit tests where appropriate.
```

## Production Recommendations

### 1. Template Granularity

**Recommendation**: **Inquiry-type based templates** with AI enhancement

- Base templates for: viewing_request, availability_check, general_info
- AI adds property-specific context and natural language variation
- Easier to maintain and validate than property-type combinations

### 2. Validation Failure Handling

**Recommendation**: **Three-tier retry system**

1. **First failure**: Retry with simplified template
2. **Second failure**: Use minimal safe template
3. **Final failure**: Route to manual review queue

### 3. Agent Integration

**Recommendation**: **Separate crews sharing infrastructure**

- EmailResponseCrew (new) + AffordabilityAssessmentCrew (existing)
- Shared tools, database connections, and configuration
- Independent scaling and monitoring

### 4. Performance Requirements

**Recommendation**: **< 30 seconds end-to-end processing**

- Email classification: < 5 seconds
- Property data retrieval: < 2 seconds
- Response generation: < 15 seconds
- Validation and sending: < 8 seconds

### 5. Testing Strategy

**Recommendation**: **Multi-environment testing approach**

- **Development**: Mock data and responses
- **Staging**: Real property data, test email addresses
- **Production**: Gradual rollout with monitoring dashboard
- **A/B Testing**: Template performance comparison

## Success Metrics

- **Response Time**: < 30 seconds average
- **Accuracy Rate**: > 95% validation pass rate
- **Customer Satisfaction**: Track email engagement rates
- **Manual Review Rate**: < 5% of total emails
- **System Uptime**: > 99.5% availability

## Next Steps

1. **Phase 1**: Implement core workflow with basic templates
2. **Phase 2**: Add advanced validation and error handling
3. **Phase 3**: Implement monitoring and optimization
4. **Phase 4**: Add A/B testing and template refinement
