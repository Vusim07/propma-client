#!/bin/bash

# This script deploys all calendar-related Supabase Edge Functions
# and sets their environment variables individually instead of using JSON

# Instructions: 
# 1. Fill in your actual credentials below
# 2. Run this script with: bash deploy-calendar-functions.sh

# Set your Google OAuth credentials
GOOGLE_CLIENT_ID="673556639603-d09j7jreb70lbi3k0hjon1td10d6ne9r.apps.googleusercontent.com" # e.g. 673556639603-d09j7jreb70lbi3k0hjon1td10d6ne9r.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET="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"
GOOGLE_REDIRECT_URI="https://ixltqflrvgsirvrzgqtq.supabase.co/functions/v1/calendar-oauth"

# Set environment variables
echo "Setting Supabase environment variables..."
npx supabase secrets set GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID"
npx supabase secrets set GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET"
npx supabase secrets set GOOGLE_REDIRECT_URI="$GOOGLE_REDIRECT_URI"

# Deploy all calendar functions
echo "Deploying calendar functions..."
npx supabase functions deploy calendar-oauth
npx supabase functions deploy calendar-list
npx supabase functions deploy calendar-available-slots
npx supabase functions deploy calendar-create-event
npx supabase functions deploy calendar-set-default

echo "Deployment complete! Make sure you've updated your Google Cloud Console"
echo "to include the correct redirect URI: $GOOGLE_REDIRECT_URI" 