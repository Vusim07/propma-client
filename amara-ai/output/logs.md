2025-06-07 02:59:21.248 | INFO:src.email_response_workflow:DEBUG: Extraction info: {'web_ref': 'RR4379658', 'source_site': 'site_1', 'found_in': 'subject'}, Normalized: RR4379658, Matched property: {'id': 'dc11889a-e21e-42a7-8c17-cc7b3a395131', 'web_reference': 'RR4379658', 'address': '175 304 Main Avenue, 304 Main Avenue', 'status': 'available', 'application_link': 'https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv', 'agent_id': '77dff4d2-f083-493b-9060-ab1220d8763a'}
2025-06-07 02:59:21.248 | INFO:tasks.email_response_agent:Creating EmailResponseCrew instance...
2025-06-07 02:59:21.248 | INFO:tasks.email_response_agent:Initializing EmailResponseCrew
2025-06-07 02:59:21.248 | INFO:tasks.email_response_agent:[Langfuse] Attempting to initialize Langfuse SDK...
2025-06-07 02:59:21.248 | 2025-06-07 00:59:21,247 - tasks.email_response_agent - INFO - Creating EmailResponseCrew instance...
2025-06-07 02:59:21.248 | 2025-06-07 00:59:21,248 - tasks.email_response_agent - INFO - Initializing EmailResponseCrew
2025-06-07 02:59:21.248 | 2025-06-07 00:59:21,248 - tasks.email_response_agent - INFO - [Langfuse] Attempting to initialize Langfuse SDK...
2025-06-07 02:59:21.422 | 2025-06-07 00:59:21,421 - tasks.email_response_agent - INFO - [Langfuse] Langfuse SDK initialized successfully.
2025-06-07 02:59:21.422 | INFO:tasks.email_response_agent:[Langfuse] Langfuse SDK initialized successfully.
2025-06-07 02:59:21.422 | 2025-06-07 00:59:21,422 - tasks.email_response_agent - INFO - Email subject: New Private Property enquiry (property RR4379658)
2025-06-07 02:59:21.422 | 2025-06-07 00:59:21,422 - tasks.email_response_agent - INFO - Email content: *New Property Enquiry on RR4379658*
2025-06-07 02:59:21.422 | 
2025-06-07 02:59:21.422 | Hi Nozipho, I'm interested in this unit. Is it still available?
2025-06-07 02:59:21.422 | 
2025-06-07 02:59:21.422 | 2 Bed Apartment In Ferndale
2025-06-07 02:59:21.422 | R 8250 Per Month
2025-06-07 02:59:21.422 | Private Property Ref: RR4379658
2025-06-07 02:59:21.422 | 2025-06-07 00:59:21,422 - tasks.email_response_agent - INFO - Number of available properties: 2
2025-06-07 02:59:21.423 | 2025-06-07 00:59:21,422 - tasks.email_response_agent - INFO - Workflow actions: {
2025-06-07 02:59:21.423 |   "agent_name": "Agent Amara",
2025-06-07 02:59:21.423 |   "agent_contact": "",
2025-06-07 02:59:21.423 |   "matched_property": {
2025-06-07 02:59:21.423 |     "id": "dc11889a-e21e-42a7-8c17-cc7b3a395131",
2025-06-07 02:59:21.423 |     "web_reference": "RR4379658",
2025-06-07 02:59:21.422 | INFO:tasks.email_response_agent:Email subject: New Private Property enquiry (property RR4379658)
2025-06-07 02:59:21.422 | INFO:tasks.email_response_agent:Email content: *New Property Enquiry on RR4379658*
2025-06-07 02:59:21.422 | 
2025-06-07 02:59:21.422 | Hi Nozipho, I'm interested in this unit. Is it still available?
2025-06-07 02:59:21.422 | 
2025-06-07 02:59:21.422 | 2 Bed Apartment In Ferndale
2025-06-07 02:59:21.422 | R 8250 Per Month
2025-06-07 02:59:21.422 | Private Property Ref: RR4379658
2025-06-07 02:59:21.422 | INFO:tasks.email_response_agent:Number of available properties: 2
2025-06-07 02:59:21.423 | INFO:tasks.email_response_agent:Workflow actions: {
2025-06-07 02:59:21.423 |   "agent_name": "Agent Amara",
2025-06-07 02:59:21.423 |   "agent_contact": "",
2025-06-07 02:59:21.423 |   "matched_property": {
2025-06-07 02:59:21.423 |     "id": "dc11889a-e21e-42a7-8c17-cc7b3a395131",
2025-06-07 02:59:21.423 |     "web_reference": "RR4379658",
2025-06-07 02:59:21.423 |     "address": "175 304 Main Avenue, 304 Main Avenue",
2025-06-07 02:59:21.423 |     "status": "available",
2025-06-07 02:59:21.423 |     "application_link": "https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv",
2025-06-07 02:59:21.423 |     "agent_id": "77dff4d2-f083-493b-9060-ab1220d8763a"
2025-06-07 02:59:21.423 |   },
2025-06-07 02:59:21.423 |   "classification_only": true
2025-06-07 02:59:21.423 | }
2025-06-07 02:59:21.423 | INFO:tasks.email_response_agent:Matched property provided: {
2025-06-07 02:59:21.423 |   "id": "dc11889a-e21e-42a7-8c17-cc7b3a395131",
2025-06-07 02:59:21.423 |   "web_reference": "RR4379658",
2025-06-07 02:59:21.423 |   "address": "175 304 Main Avenue, 304 Main Avenue",
2025-06-07 02:59:21.423 |   "status": "available",
2025-06-07 02:59:21.423 |   "application_link": "https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv",
2025-06-07 02:59:21.423 |   "agent_id": "77dff4d2-f083-493b-9060-ab1220d8763a"
2025-06-07 02:59:21.423 | }
2025-06-07 02:59:21.424 | INFO:tasks.email_response_agent:[OBSERVABILITY] {"timestamp": "2025-06-07T00:59:21.423458", "step": "initialization", "event_type": "info", "data": {"email_subject": "New Private Property enquiry (property RR4379658)", "email_content": "*New Property Enquiry on RR4379658*\n\nHi Nozipho, I'm interested in this unit. Is it still available?\n\n2 Bed Apartment In Ferndale\nR 8250 Per Month\nPrivate Property Ref: RR4379658", "matched_property": {"id": "dc11889a-e21e-42a7-8c17-cc7b3a395131", "web_reference": "RR4379658", "address": "175 304 Main Avenue, 304 Main Avenue", "status": "available", "application_link": "https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv", "agent_id": "77dff4d2-f083-493b-9060-ab1220d8763a"}, "agent_properties": [{"id": "c0c9c538-ca5b-458f-bb73-506d3748b274", "web_reference": "RR123456", "address": "30 Cloverdene Road", "status": "available", "application_link": "https://app.agentamara.com/apply/prop_1743022717719_uksv6uxm", "agent_id": "77dff4d2-f083-493b-9060-ab1220d8763a"}, {"id": "dc11889a-e21e-42a7-8c17-cc7b3a395131", "web_reference": "RR4379658", "address": "175 304 Main Avenue, 304 Main Avenue", "status": "available", "application_link": "https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv", "agent_id": "77dff4d2-f083-493b-9060-ab1220d8763a"}], "workflow_actions": {"agent_name": "Agent Amara", "agent_contact": "", "classification_only": true}}}
2025-06-07 02:59:21.424 | WARNING:tasks.email_response_agent:Langfuse trace logging failed: 'Langfuse' object has no attribute 'trace'
2025-06-07 02:59:21.423 |     "address": "175 304 Main Avenue, 304 Main Avenue",
2025-06-07 02:59:21.423 |     "status": "available",
2025-06-07 02:59:21.423 |     "application_link": "https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv",
2025-06-07 02:59:21.423 |     "agent_id": "77dff4d2-f083-493b-9060-ab1220d8763a"
2025-06-07 02:59:21.423 |   },
2025-06-07 02:59:21.423 |   "classification_only": true
2025-06-07 02:59:21.423 | }
2025-06-07 02:59:21.423 | 2025-06-07 00:59:21,423 - tasks.email_response_agent - INFO - Matched property provided: {
2025-06-07 02:59:21.423 |   "id": "dc11889a-e21e-42a7-8c17-cc7b3a395131",
2025-06-07 02:59:21.423 |   "web_reference": "RR4379658",
2025-06-07 02:59:21.423 |   "address": "175 304 Main Avenue, 304 Main Avenue",
2025-06-07 02:59:21.423 |   "status": "available",
2025-06-07 02:59:21.423 |   "application_link": "https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv",
2025-06-07 02:59:21.423 |   "agent_id": "77dff4d2-f083-493b-9060-ab1220d8763a"
2025-06-07 02:59:21.423 | }
2025-06-07 02:59:21.423 | 2025-06-07 00:59:21,423 - tasks.email_response_agent - INFO - [OBSERVABILITY] {"timestamp": "2025-06-07T00:59:21.423458", "step": "initialization", "event_type": "info", "data": {"email_subject": "New Private Property enquiry (property RR4379658)", "email_content": "*New Property Enquiry on RR4379658*\n\nHi Nozipho, I'm interested in this unit. Is it still available?\n\n2 Bed Apartment In Ferndale\nR 8250 Per Month\nPrivate Property Ref: RR4379658", "matched_property": {"id": "dc11889a-e21e-42a7-8c17-cc7b3a395131", "web_reference": "RR4379658", "address": "175 304 Main Avenue, 304 Main Avenue", "status": "available", "application_link": "https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv", "agent_id": "77dff4d2-f083-493b-9060-ab1220d8763a"}, "agent_properties": [{"id": "c0c9c538-ca5b-458f-bb73-506d3748b274", "web_reference": "RR123456", "address": "30 Cloverdene Road", "status": "available", "application_link": "https://app.agentamara.com/apply/prop_1743022717719_uksv6uxm", "agent_id": "77dff4d2-f083-493b-9060-ab1220d8763a"}, {"id": "dc11889a-e21e-42a7-8c17-cc7b3a395131", "web_reference": "RR4379658", "address": "175 304 Main Avenue, 304 Main Avenue", "status": "available", "application_link": "https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv", "agent_id": "77dff4d2-f083-493b-9060-ab1220d8763a"}], "workflow_actions": {"agent_name": "Agent Amara", "agent_contact": "", "classification_only": true}}}
2025-06-07 02:59:21.424 | 2025-06-07 00:59:21,424 - tasks.email_response_agent - WARNING - Langfuse trace logging failed: 'Langfuse' object has no attribute 'trace'
2025-06-07 02:59:21.432 | INFO:tasks.email_response_agent:Initializing crew...
2025-06-07 02:59:21.432 | INFO:tasks.email_response_agent:Creating classification task...
2025-06-07 02:59:21.432 | 2025-06-07 00:59:21,431 - tasks.email_response_agent - INFO - Initializing crew...
2025-06-07 02:59:21.432 | 2025-06-07 00:59:21,431 - tasks.email_response_agent - INFO - Creating classification task...
2025-06-07 02:59:21.432 | 2025-06-07 00:59:21,432 - tasks.email_response_agent - INFO - Task context created: [
2025-06-07 02:59:21.432 |   {
2025-06-07 02:59:21.432 |     "role": "system",
2025-06-07 02:59:21.432 |     "content": "You are an expert at classifying property inquiries.",
2025-06-07 02:59:21.432 |     "description": "System prompt for classification",
2025-06-07 02:59:21.432 |     "expected_output": "A valid JSON object containing the inquiry_type."
2025-06-07 02:59:21.432 |   },
2025-06-07 02:59:21.432 |   {
2025-06-07 02:59:21.432 |     "role": "user",
2025-06-07 02:59:21.432 |     "content": "Subject: New Private Property enquiry (property RR4379658)\nContent: *New Property Enquiry on RR4379658*\n\nHi Nozipho, I'm interested in this unit. Is it still available?\n\n2 Bed Apartment In Ferndale\nR 8250 Per Month\nPrivate Property Ref: RR4379658",
2025-06-07 02:59:21.432 |     "description": "Property inquiry details for classification",
2025-06-07 02:59:21.432 |     "expected_output": "A valid JSON object containing the inquiry_type."
2025-06-07 02:59:21.432 |   }
2025-06-07 02:59:21.432 | ]
2025-06-07 02:59:21.432 | INFO:tasks.email_response_agent:Task context created: [
2025-06-07 02:59:21.432 |   {
2025-06-07 02:59:21.432 |     "role": "system",
2025-06-07 02:59:21.432 |     "content": "You are an expert at classifying property inquiries.",
2025-06-07 02:59:21.432 |     "description": "System prompt for classification",
2025-06-07 02:59:21.432 |     "expected_output": "A valid JSON object containing the inquiry_type."
2025-06-07 02:59:21.432 |   },
2025-06-07 02:59:21.432 |   {
2025-06-07 02:59:21.433 |     "role": "user",
2025-06-07 02:59:21.433 |     "content": "Subject: New Private Property enquiry (property RR4379658)\nContent: *New Property Enquiry on RR4379658*\n\nHi Nozipho, I'm interested in this unit. Is it still available?\n\n2 Bed Apartment In Ferndale\nR 8250 Per Month\nPrivate Property Ref: RR4379658",
2025-06-07 02:59:21.433 |     "description": "Property inquiry details for classification",
2025-06-07 02:59:21.433 |     "expected_output": "A valid JSON object containing the inquiry_type."
2025-06-07 02:59:21.433 |   }
2025-06-07 02:59:21.433 | ]
2025-06-07 02:59:21.442 | INFO:tasks.email_response_agent:Classification task created successfully
2025-06-07 02:59:21.442 | INFO:tasks.email_response_agent:[OBSERVABILITY] {"timestamp": "2025-06-07T00:59:21.442030", "step": "task_creation", "event_type": "info", "data": {"task": "classify_inquiry", "context": [{"role": "system", "content": "You are an expert at classifying property inquiries.", "description": "System prompt for classification", "expected_output": "A valid JSON object containing the inquiry_type."}, {"role": "user", "content": "Subject: New Private Property enquiry (property RR4379658)\nContent: *New Property Enquiry on RR4379658*\n\nHi Nozipho, I'm interested in this unit. Is it still available?\n\n2 Bed Apartment In Ferndale\nR 8250 Per Month\nPrivate Property Ref: RR4379658", "description": "Property inquiry details for classification", "expected_output": "A valid JSON object containing the inquiry_type."}], "status": "success"}}
2025-06-07 02:59:21.442 | WARNING:tasks.email_response_agent:Langfuse trace logging failed: 'Langfuse' object has no attribute 'trace'
2025-06-07 02:59:21.442 | 2025-06-07 00:59:21,441 - tasks.email_response_agent - INFO - Classification task created successfully
2025-06-07 02:59:21.442 | 2025-06-07 00:59:21,442 - tasks.email_response_agent - INFO - [OBSERVABILITY] {"timestamp": "2025-06-07T00:59:21.442030", "step": "task_creation", "event_type": "info", "data": {"task": "classify_inquiry", "context": [{"role": "system", "content": "You are an expert at classifying property inquiries.", "description": "System prompt for classification", "expected_output": "A valid JSON object containing the inquiry_type."}, {"role": "user", "content": "Subject: New Private Property enquiry (property RR4379658)\nContent: *New Property Enquiry on RR4379658*\n\nHi Nozipho, I'm interested in this unit. Is it still available?\n\n2 Bed Apartment In Ferndale\nR 8250 Per Month\nPrivate Property Ref: RR4379658", "description": "Property inquiry details for classification", "expected_output": "A valid JSON object containing the inquiry_type."}], "status": "success"}}
2025-06-07 02:59:21.442 | 2025-06-07 00:59:21,442 - tasks.email_response_agent - WARNING - Langfuse trace logging failed: 'Langfuse' object has no attribute 'trace'
2025-06-07 02:59:21.443 | INFO:tasks.email_response_agent:Creating response generation task...
2025-06-07 02:59:21.443 | 2025-06-07 00:59:21,442 - tasks.email_response_agent - INFO - Creating response generation task...
2025-06-07 02:59:21.444 | 2025-06-07 00:59:21,443 - tasks.email_response_agent - INFO - Response task context created: [
2025-06-07 02:59:21.444 |   {
2025-06-07 02:59:21.444 |     "role": "system",
2025-06-07 02:59:21.444 |     "content": "You are an expert at writing professional property inquiry responses.",
2025-06-07 02:59:21.444 |     "description": "System prompt for response generation",
2025-06-07 02:59:21.444 |     "expected_output": "A valid JSON object with response.subject and response.body"
2025-06-07 02:59:21.444 |   },
2025-06-07 02:59:21.444 |   {
2025-06-07 02:59:21.444 |     "role": "user",
2025-06-07 02:59:21.444 |     "content": "Property Details: {\n  \"address\": \"175 304 Main Avenue, 304 Main Avenue\",\n  \"web_reference\": \"RR4379658\",\n  \"status\": \"available\",\n  \"application_link\": \"https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv\"\n}\nInquiry Type: None",
2025-06-07 02:59:21.444 |     "description": "Property details and inquiry type for response generation",
2025-06-07 02:59:21.444 |     "expected_output": "A valid JSON object with response.subject and response.body"
2025-06-07 02:59:21.444 |   }
2025-06-07 02:59:21.444 | ]
2025-06-07 02:59:21.444 | INFO:tasks.email_response_agent:Response task context created: [
2025-06-07 02:59:21.444 |   {
2025-06-07 02:59:21.444 |     "role": "system",
2025-06-07 02:59:21.444 |     "content": "You are an expert at writing professional property inquiry responses.",
2025-06-07 02:59:21.444 |     "description": "System prompt for response generation",
2025-06-07 02:59:21.444 |     "expected_output": "A valid JSON object with response.subject and response.body"
2025-06-07 02:59:21.444 |   },
2025-06-07 02:59:21.444 |   {
2025-06-07 02:59:21.444 |     "role": "user",
2025-06-07 02:59:21.444 |     "content": "Property Details: {\n  \"address\": \"175 304 Main Avenue, 304 Main Avenue\",\n  \"web_reference\": \"RR4379658\",\n  \"status\": \"available\",\n  \"application_link\": \"https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv\"\n}\nInquiry Type: None",
2025-06-07 02:59:21.444 |     "description": "Property details and inquiry type for response generation",
2025-06-07 02:59:21.444 |     "expected_output": "A valid JSON object with response.subject and response.body"
2025-06-07 02:59:21.444 |   }
2025-06-07 02:59:21.444 | ]
2025-06-07 02:59:21.450 | INFO:tasks.email_response_agent:Response generation task created successfully
2025-06-07 02:59:21.450 | INFO:tasks.email_response_agent:[OBSERVABILITY] {"timestamp": "2025-06-07T00:59:21.450037", "step": "task_creation", "event_type": "info", "data": {"task": "generate_response", "context": [{"role": "system", "content": "You are an expert at writing professional property inquiry responses.", "description": "System prompt for response generation", "expected_output": "A valid JSON object with response.subject and response.body"}, {"role": "user", "content": "Property Details: {\n  \"address\": \"175 304 Main Avenue, 304 Main Avenue\",\n  \"web_reference\": \"RR4379658\",\n  \"status\": \"available\",\n  \"application_link\": \"https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv\"\n}\nInquiry Type: None", "description": "Property details and inquiry type for response generation", "expected_output": "A valid JSON object with response.subject and response.body"}], "status": "success"}}
2025-06-07 02:59:21.450 | WARNING:tasks.email_response_agent:Langfuse trace logging failed: 'Langfuse' object has no attribute 'trace'
2025-06-07 02:59:21.450 | INFO:tasks.email_response_agent:Creating validation task...
2025-06-07 02:59:21.450 | 2025-06-07 00:59:21,449 - tasks.email_response_agent - INFO - Response generation task created successfully
2025-06-07 02:59:21.450 | 2025-06-07 00:59:21,450 - tasks.email_response_agent - INFO - [OBSERVABILITY] {"timestamp": "2025-06-07T00:59:21.450037", "step": "task_creation", "event_type": "info", "data": {"task": "generate_response", "context": [{"role": "system", "content": "You are an expert at writing professional property inquiry responses.", "description": "System prompt for response generation", "expected_output": "A valid JSON object with response.subject and response.body"}, {"role": "user", "content": "Property Details: {\n  \"address\": \"175 304 Main Avenue, 304 Main Avenue\",\n  \"web_reference\": \"RR4379658\",\n  \"status\": \"available\",\n  \"application_link\": \"https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv\"\n}\nInquiry Type: None", "description": "Property details and inquiry type for response generation", "expected_output": "A valid JSON object with response.subject and response.body"}], "status": "success"}}
2025-06-07 02:59:21.450 | 2025-06-07 00:59:21,450 - tasks.email_response_agent - WARNING - Langfuse trace logging failed: 'Langfuse' object has no attribute 'trace'
2025-06-07 02:59:21.450 | 2025-06-07 00:59:21,450 - tasks.email_response_agent - INFO - Creating validation task...
2025-06-07 02:59:21.451 | 2025-06-07 00:59:21,450 - tasks.email_response_agent - INFO - Validation task context created: [
2025-06-07 02:59:21.451 |   {
2025-06-07 02:59:21.451 |     "role": "system",
2025-06-07 02:59:21.451 |     "content": "You are an expert at validating property inquiry responses.",
2025-06-07 02:59:21.451 |     "description": "System prompt for response validation",
2025-06-07 02:59:21.451 |     "expected_output": "A valid JSON object with validation results"
2025-06-07 02:59:21.451 |   },
2025-06-07 02:59:21.451 |   {
2025-06-07 02:59:21.451 |     "role": "user",
2025-06-07 02:59:21.451 |     "content": "Property Details: {\n  \"id\": \"dc11889a-e21e-42a7-8c17-cc7b3a395131\",\n  \"web_reference\": \"RR4379658\",\n  \"address\": \"175 304 Main Avenue, 304 Main Avenue\",\n  \"status\": \"available\",\n  \"application_link\": \"https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv\",\n  \"agent_id\": \"77dff4d2-f083-493b-9060-ab1220d8763a\"\n}\nInquiry Type: None",
2025-06-07 02:59:21.451 |     "description": "Property details and inquiry type for validation",
2025-06-07 02:59:21.451 | INFO:tasks.email_response_agent:Validation task context created: [
2025-06-07 02:59:21.451 |   {
2025-06-07 02:59:21.451 |     "role": "system",
2025-06-07 02:59:21.451 |     "content": "You are an expert at validating property inquiry responses.",
2025-06-07 02:59:21.451 |     "description": "System prompt for response validation",
2025-06-07 02:59:21.451 |     "expected_output": "A valid JSON object with validation results"
2025-06-07 02:59:21.451 |   },
2025-06-07 02:59:21.451 |   {
2025-06-07 02:59:21.451 |     "role": "user",
2025-06-07 02:59:21.451 |     "content": "Property Details: {\n  \"id\": \"dc11889a-e21e-42a7-8c17-cc7b3a395131\",\n  \"web_reference\": \"RR4379658\",\n  \"address\": \"175 304 Main Avenue, 304 Main Avenue\",\n  \"status\": \"available\",\n  \"application_link\": \"https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv\",\n  \"agent_id\": \"77dff4d2-f083-493b-9060-ab1220d8763a\"\n}\nInquiry Type: None",
2025-06-07 02:59:21.451 |     "description": "Property details and inquiry type for validation",
2025-06-07 02:59:21.451 |     "expected_output": "A valid JSON object with validation results"
2025-06-07 02:59:21.451 |   }
2025-06-07 02:59:21.451 | ]
2025-06-07 02:59:21.451 |     "expected_output": "A valid JSON object with validation results"
2025-06-07 02:59:21.451 |   }
2025-06-07 02:59:21.451 | ]
2025-06-07 02:59:21.458 | INFO:tasks.email_response_agent:Validation task created successfully
2025-06-07 02:59:21.459 | INFO:tasks.email_response_agent:[OBSERVABILITY] {"timestamp": "2025-06-07T00:59:21.458556", "step": "task_creation", "event_type": "info", "data": {"task": "validate_response", "context": [{"role": "system", "content": "You are an expert at validating property inquiry responses.", "description": "System prompt for response validation", "expected_output": "A valid JSON object with validation results"}, {"role": "user", "content": "Property Details: {\n  \"id\": \"dc11889a-e21e-42a7-8c17-cc7b3a395131\",\n  \"web_reference\": \"RR4379658\",\n  \"address\": \"175 304 Main Avenue, 304 Main Avenue\",\n  \"status\": \"available\",\n  \"application_link\": \"https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv\",\n  \"agent_id\": \"77dff4d2-f083-493b-9060-ab1220d8763a\"\n}\nInquiry Type: None", "description": "Property details and inquiry type for validation", "expected_output": "A valid JSON object with validation results"}], "status": "success"}}
2025-06-07 02:59:21.459 | WARNING:tasks.email_response_agent:Langfuse trace logging failed: 'Langfuse' object has no attribute 'trace'
2025-06-07 02:59:21.459 | INFO:tasks.email_response_agent:Starting crew setup...
2025-06-07 02:59:21.460 | INFO:tasks.email_response_agent:Classification task created successfully
2025-06-07 02:59:21.460 | INFO:tasks.email_response_agent:Response task created successfully
2025-06-07 02:59:21.460 | INFO:tasks.email_response_agent:Validation task created successfully
2025-06-07 02:59:21.460 | INFO:tasks.email_response_agent:All agents created successfully
2025-06-07 02:59:21.458 | 2025-06-07 00:59:21,458 - tasks.email_response_agent - INFO - Validation task created successfully
2025-06-07 02:59:21.459 | 2025-06-07 00:59:21,458 - tasks.email_response_agent - INFO - [OBSERVABILITY] {"timestamp": "2025-06-07T00:59:21.458556", "step": "task_creation", "event_type": "info", "data": {"task": "validate_response", "context": [{"role": "system", "content": "You are an expert at validating property inquiry responses.", "description": "System prompt for response validation", "expected_output": "A valid JSON object with validation results"}, {"role": "user", "content": "Property Details: {\n  \"id\": \"dc11889a-e21e-42a7-8c17-cc7b3a395131\",\n  \"web_reference\": \"RR4379658\",\n  \"address\": \"175 304 Main Avenue, 304 Main Avenue\",\n  \"status\": \"available\",\n  \"application_link\": \"https://app.agentamara.com/apply/prop_1745768243927_4z4pw4yv\",\n  \"agent_id\": \"77dff4d2-f083-493b-9060-ab1220d8763a\"\n}\nInquiry Type: None", "description": "Property details and inquiry type for validation", "expected_output": "A valid JSON object with validation results"}], "status": "success"}}
2025-06-07 02:59:21.459 | 2025-06-07 00:59:21,458 - tasks.email_response_agent - WARNING - Langfuse trace logging failed: 'Langfuse' object has no attribute 'trace'
2025-06-07 02:59:21.459 | 2025-06-07 00:59:21,459 - tasks.email_response_agent - INFO - Starting crew setup...
2025-06-07 02:59:21.459 | 2025-06-07 00:59:21,459 - tasks.email_response_agent - INFO - Classification task created successfully
2025-06-07 02:59:21.460 | 2025-06-07 00:59:21,459 - tasks.email_response_agent - INFO - Response task created successfully
2025-06-07 02:59:21.460 | 2025-06-07 00:59:21,460 - tasks.email_response_agent - INFO - Validation task created successfully
2025-06-07 02:59:21.460 | 2025-06-07 00:59:21,460 - tasks.email_response_agent - INFO - All agents created successfully
2025-06-07 02:59:21.473 | INFO:tasks.email_response_agent:Created crew with 3 tasks
2025-06-07 02:59:21.474 | INFO:tasks.email_response_agent:[OBSERVABILITY] {"timestamp": "2025-06-07T00:59:21.473573", "step": "crew_creation", "event_type": "info", "data": {"num_tasks": 3, "agent_count": 3, "process_type": "sequential"}}
2025-06-07 02:59:21.473 | 2025-06-07 00:59:21,472 - tasks.email_response_agent - INFO - Created crew with 3 tasks
2025-06-07 02:59:21.474 | 2025-06-07 00:59:21,473 - tasks.email_response_agent - INFO - [OBSERVABILITY] {"timestamp": "2025-06-07T00:59:21.473573", "step": "crew_creation", "event_type": "info", "data": {"num_tasks": 3, "agent_count": 3, "process_type": "sequential"}}
2025-06-07 02:59:21.474 | 2025-06-07 00:59:21,473 - tasks.email_response_agent - WARNING - Langfuse trace logging failed: 'Langfuse' object has no attribute 'trace'
2025-06-07 02:59:21.474 | 2025-06-07 00:59:21,474 - tasks.email_response_agent - INFO - Starting crew execution...
2025-06-07 02:59:21.474 | WARNING:tasks.email_response_agent:Langfuse trace logging failed: 'Langfuse' object has no attribute 'trace'
2025-06-07 02:59:21.474 | INFO:tasks.email_response_agent:Starting crew execution...
2025-06-07 02:59:21.480 | ╭─────────────────────────── Crew Execution Started ───────────────────────────╮
2025-06-07 02:59:21.480 | │                                                                              │
2025-06-07 02:59:21.480 | │  Crew Execution Started                                                      │
2025-06-07 02:59:21.480 | │  Name: crew                                                                  │
2025-06-07 02:59:21.480 | │  ID: 7e041399-34ab-4089-9b0c-a179db053618                                    │
2025-06-07 02:59:21.480 | │                                                                              │
2025-06-07 02:59:21.480 | │                                                                              │
2025-06-07 02:59:21.480 | ╰──────────────────────────────────────────────────────────────────────────────╯
2025-06-07 02:59:21.481 | 
2025-06-07 02:59:21.538 | # Agent: Inquiry Classifier
2025-06-07 02:59:21.538 | ## Task: Classify the type of property inquiry from this email exchange.
2025-06-07 02:59:21.538 |                     Subject: New Private Property enquiry (property RR4379658)
2025-06-07 02:59:21.538 |                     Content: *New Property Enquiry on RR4379658*
2025-06-07 02:59:21.538 | 
2025-06-07 02:59:21.538 | Hi Nozipho, I'm interested in this unit. Is it still available?
2025-06-07 02:59:21.538 | 
2025-06-07 02:59:21.538 | 2 Bed Apartment In Ferndale
2025-06-07 02:59:21.538 | R 8250 Per Month
2025-06-07 02:59:21.538 | Private Property Ref: RR4379658
2025-06-07 02:59:21.538 |                     
2025-06-07 02:59:21.538 |                     Analyze the email content and determine if this is:
2025-06-07 02:59:21.538 |                     1. viewing_request: Customer wants to view the property
2025-06-07 02:59:21.538 |                     2. availability_check: Customer is asking about availability
2025-06-07 02:59:21.538 |                     3. general_info: General inquiry about the property
2025-06-07 02:59:21.538 |                     
2025-06-07 02:59:21.538 |                     IMPORTANT: Return ONLY a valid JSON object with this exact format:
2025-06-07 02:59:21.538 |                     {"inquiry_type": "viewing_request" | "availability_check" | "general_info"}
2025-06-07 02:59:21.561 | 00:59:21 - LiteLLM:INFO: utils.py:2827 - 
2025-06-07 02:59:21.561 | LiteLLM completion() model= gpt-4o-mini; provider = openai
2025-06-07 02:59:22.790 | 
2025-06-07 02:59:22.791 | 
2025-06-07 02:59:22.791 | 
2025-06-07 02:59:22.791 | 
2025-06-07 02:59:22.850 | 🚀 Crew: crew
2025-06-07 02:59:22.850 | └── 📋 Task: cc0916f6-74b7-4e13-8cd2-2291408d98b1
2025-06-07 02:59:22.850 |     Status: Executing Task...
2025-06-07 02:59:22.855 |     └── ❌ LLM Failed
2025-06-07 02:59:22.856 | 
2025-06-07 02:59:22.856 |  An unknown error occurred. Please check the details below.
2025-06-07 02:59:22.856 | 
2025-06-07 02:59:22.861 | 🚀 Crew: crew
2025-06-07 02:59:22.861 | └── 📋 Task: cc0916f6-74b7-4e13-8cd2-2291408d98b1
2025-06-07 02:59:22.861 |     Assigned to: Inquiry Classifier
2025-06-07 02:59:22.861 |     Status: ❌ Failed
2025-06-07 02:59:22.864 |     └── ❌ LLM Failed╭──────────────────────────────── Task Failure ────────────────────────────────╮
2025-06-07 02:59:22.864 | │                                                                              │
2025-06-07 02:59:22.864 | │  Task Failed                                                                 │
2025-06-07 02:59:22.864 | │  Name: cc0916f6-74b7-4e13-8cd2-2291408d98b1                                  │
2025-06-07 02:59:22.864 | │  Agent: Inquiry Classifier                                                   │
2025-06-07 02:59:22.864 | │                                                                              │
2025-06-07 02:59:22.864 | │                                                                              │
2025-06-07 02:59:22.864 | ╰──────────────────────────────────────────────────────────────────────────────╯
2025-06-07 02:59:22.864 | 
2025-06-07 02:59:22.867 | ╭──────────────────────────────── Crew Failure ────────────────────────────────╮
2025-06-07 02:59:22.867 | │                                                                              │
2025-06-07 02:59:22.867 | │  Crew Execution Failed                                                       │
2025-06-07 02:59:22.867 | │  Name: crew                                                                  │
2025-06-07 02:59:22.867 | │  ID: 7e041399-34ab-4089-9b0c-a179db053618                                    │
2025-06-07 02:59:22.867 | │                                                                              │
2025-06-07 02:59:22.867 | │                                                                              │
2025-06-07 02:59:22.867 | ╰──────────────────────────────────────────────────────────────────────────────╯
2025-06-07 02:59:22.867 | 
2025-06-07 02:59:22.906 | INFO:     172.19.0.1:50154 - "POST /api/v1/process-email HTTP/1.1" 500 Internal Server Error
2025-06-07 02:59:37.569 | 