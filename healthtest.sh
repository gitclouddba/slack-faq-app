#!/bin/bash -x

# requires environment variables REGION, PROJECT_ID, and SLACK_TOKEN

curl -v -ik "https://${REGION}-${PROJECT_ID}.cloudfunctions.net/slackFAQ/health" \
    -H "User-Agent: GoogleStackdriverMonitoring-UptimeChecks(https://cloud.google.com/monitoring)"

