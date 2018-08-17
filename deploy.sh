#!/bin/bash

# Deploy slackFAQ cloud function using gcloud tool

if [  -z "${SLACK_ACCESS_TOKEN}" ]
then
    echo "SLACK_ACCESS_TOKEN environment variable not set, aborting."
    exit 1
fi
if [  -z "${SLACK_VERIFICATION_TOKEN}" ]
then
    echo "SLACK_VERIFICATION_TOKEN environment variable not set, aborting."
    exit 1
fi

gcloud beta functions deploy slackFAQ --trigger-http  \
  --set-env-vars "SLACK_VERIFICATION_TOKEN=${SLACK_VERIFICATION_TOKEN},SLACK_ACCESS_TOKEN=${SLACK_ACCESS_TOKEN}"

#gcloud beta functions deploy recvFaqForm --trigger-http  \
#  --set-env-vars "SLACK_VERIFICATION_TOKEN=${SLACK_VERIFICATION_TOKEN},SLACK_ACCESS_TOKEN=${SLACK_ACCESS_TOKEN}"
