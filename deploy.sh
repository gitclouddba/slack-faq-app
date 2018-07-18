#!/bin/bash -x

# Deploy slackFAQ cloud function using gcloud tool

if [  -z "${SLACK_TOKEN}" ]
then
    echo "SLACK_TOKEN environment variable not set, aborting."
    exit 1
fi

gcloud beta functions deploy slackFAQ --trigger-http  --set-env-vars SLACK_TOKEN="${SLACK_TOKEN}"
