#!/bin/bash -x

# requires environment variables REGION, PROJECT_ID, and SLACK_TOKEN

curl -ik -X POST "https://${REGION}-${PROJECT_ID}.cloudfunctions.net/slackFAQ" \
    -H "Content-Type: application/json" \
    --data "{\"token\":\"${SLACK_VERIFICATION_TOKEN}\",\"text\":\"list\"}"

curl -ik -X POST "https://${REGION}-${PROJECT_ID}.cloudfunctions.net/slackFAQ" \
    -H "Content-Type: application/json" \
    --data "{\"token\":\"${SLACK_VERIFICATION_TOKEN}\",\"text\":\"show notfound\"}"

