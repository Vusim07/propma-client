#!/usr/bin/env python3
"""
Test script for Propma AI Affordability Assessment API
"""
import json
import requests
from typing import List, Dict, Any

# API endpoint
API_URL = "http://localhost:8000/analyze-affordability"

# Test transaction data (South African context)
test_data = {
    "transactions": [
        {
            "description": "Salary Payment - ABC Corp",
            "amount": 15000.00,
            "date": "01/04/2025",  # DD/MM/YYYY format
            "type": "credit",
        },
        {
            "description": "Rent Payment",
            "amount": 4500.00,
            "date": "03/04/2025",
            "type": "debit",
        },
        {
            "description": "Shoprite",
            "amount": 1200.00,
            "date": "05/04/2025",
            "type": "debit",
        },
        {
            "description": "Vodacom",
            "amount": 799.00,
            "date": "07/04/2025",
            "type": "debit",
        },
        {
            "description": "Standard Bank Loan Payment",
            "amount": 2500.00,
            "date": "10/04/2025",
            "type": "debit",
        },
    ],
    "target_rent": 5000.00,  # ZAR
}


def test_affordability_endpoint():
    """
    Test the affordability assessment endpoint with sample data
    """
    print("Testing Propma AI Affordability Assessment API...")

    # Set proper headers
    headers = {"Content-Type": "application/json", "Accept": "application/json"}

    try:
        # Make the API request
        response = requests.post(
            API_URL, headers=headers, json=test_data  # Pass as JSON object, not string
        )

        # Print response status
        print(f"Status Code: {response.status_code}")

        # Handle different response scenarios
        if response.status_code == 200:
            result = response.json()
            print("\n----- AFFORDABILITY ASSESSMENT RESULTS -----")
            print(f"Can afford: {'Yes' if result.get('can_afford') else 'No'}")
            print(f"Confidence: {result.get('confidence', 0) * 100:.1f}%")

            print("\nRisk Factors:")
            for factor in result.get("risk_factors", []):
                print(f"- {factor}")

            print("\nRecommendations:")
            for rec in result.get("recommendations", []):
                print(f"- {rec}")

            print("\nKey Financial Metrics:")
            for key, value in result.get("metrics", {}).items():
                print(f"- {key}: {value}")

            print("\nDetailed JSON Response:")
            print(json.dumps(result, indent=2))
        else:
            print("Error Response:")
            print(response.text)

    except Exception as e:
        print(f"Error making API request: {str(e)}")


if __name__ == "__main__":
    test_affordability_endpoint()
