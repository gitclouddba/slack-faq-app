/**
 * Copyright 2018, Ross Oliver
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const Datastore = require('@google-cloud/datastore');
const datastore = new Datastore();

const createFaqTemplate = require('./createFaqDialog');
const axios = require('axios');
const qs = require('querystring');

/**
 * Verify that the webhook request came from Slack.
 *
 * @param {object} body The body of the request.
 * @param {string} body.token The Slack token to be verified.
 * Expect Slack token to be avaiable in SLACK_VERIFICATION_TOKEN environment variable
 */
function verifyWebhook (body) {
  if (!body || body.token !== process.env.SLACK_VERIFICATION_TOKEN) {
    var s = 'received token: ' + body.token + ' expected token: ' + process.env.SLACK_VERIFICATION_TOKEN
    console.log(s)
    const error = new Error('Invalid credentials');
    error.code = 401;
    throw error;
  }
}


/**
 * Receive a FAQ creation form
 *
 * Trigger this function by making a POST request with a payload to:
 * https://[YOUR_REGION].[YOUR_PROJECT_ID].cloudfunctions.net/recvFaqForm
 *
 * @example
 * curl -X POST "https://us-central1.your-project-id.cloudfunctions.net/recvFaqForm" --data '{"token":"[YOUR_SLACK_VERIFICATION_TOKEN]","text":"list"}'
 *
 * @param {object} req Cloud Function request object.
 * @param {object} req.body The request payload.
 * @param {string} req.body.token Slack's verification token.
 * @param {string} req.body.payload payload of the form interation
 * @param {object} res Cloud Function response object.
 */
function recvFaqForm (req, res) {
  return Promise.resolve()
    .then(() => {
      if (req.method !== 'POST') {
        const error = new Error('Only POST requests are accepted');
        error.code = 405;
        throw error;
      }

      const payload = JSON.parse(req.body.payload);

      // Verify that this request came from Slack
      verifyWebhook(payload);

      if ( payload.type != 'dialog_submission' ) {
        console.log("Error: got payload.type " + payload.type);
        const error = new Error('Not a dialog submission');
        error.code = 405;
        throw error;
      }

      console.log(payload);
      const tag = payload.submission.tag;
      const q = datastore.createQuery('slack-faq-entry')
                         .filter('tag',tag)
                         .order('version',{descending: true});
      return datastore
        .runQuery(q)
        .then(results => {
          const faqs = results[0];
          if (faqs.length > 0) {
	    const version = String(Number(faqs[0]['version']) + 1);
            console.log('Tag ' + tag + ' new version ' + version);
            return addFAQ(payload,version);
            // return '{"errors":[{"name":"tag","error":"The tag ' + tag + ' is already in use"}]}';
          } else {
            console.log('New tag ' + tag + ' is unused, calling addFAQ()');
            return addFAQ(payload,1);
          }
        })
    })
    .then((response) => {
      // Send the formatted message back to Slack
      res.send(response);
    })
    .catch((err) => {
      console.error(err);
      res.status(err.code || 500).send(err);
      return Promise.reject(err);
    })
}


/**
 * Receive a Slash Command request from Slack.
 *
 * Trigger this function by making a POST request with a payload to:
 * https://[YOUR_REGION].[YOUR_PROJECT_ID].cloudfunctions.net/slackFAQ
 *
 * @example
 * curl -X POST "https://us-central1.your-project-id.cloudfunctions.net/slackFAQ" --data '{"token":"[YOUR_SLACK_VERIFICATION_TOKEN]","text":"list"}'
 *
 * @param {object} req Cloud Function request object.
 * @param {object} req.body The request payload.
 * @param {string} req.body.token Slack's verification token.
 * @param {string} req.body.text text following /faq command
 * @param {object} res Cloud Function response object.
 */
exports.slackFAQ = (req, res) => {
  return Promise.resolve()
    .then(() => {
      if (req.method !== 'POST') {
        if ( req.get("User-Agent") == "GoogleStackdriverMonitoring-UptimeChecks(https://cloud.google.com/monitoring)" ) {
          const healthResponse = { status: 'Ready' };
          return healthResponse;
        }
        else {
          const error = new Error('Only POST requests are accepted');
          error.code = 405;
          throw error;
        }
      }

      // Assume receiving form response if req.body contains a payload
      if ( req.body.payload ) {
        console.log("payload found, calling recfFaqForm");
        return recvFaqForm(req, res);
      }

      // Verify that this request came from Slack
      verifyWebhook(req.body);

      console.log(req.body);

      var cmd_list = req.body.text.split(' ')

      switch(cmd_list[0]) {
        case 'list':
          return listFAQs();
        case 'show':
          return getFAQ(cmd_list[1]);
        case 'add':
          const dialog = createFaqTemplate( req.body.trigger_id, req.body.text );
          return axios.post('https://slack.com/api/dialog.open', qs.stringify(dialog))
            .then(function(response) {
              console.log(response.data);
              if ( response.data.ok ) {
                return(formatSimpleMessage('Opened form for adding FAQ'));
              }
              else {
                return(formatSimpleMessage('Form open failed: ' + response.data.error));
              }
            })
            .catch(function(error) {
              console.log(error);
              return(formatSimpleMessage('Sorry, opening form for adding FAQ failed.'));
            });
        case "help":
          return getFAQ("help");
        default:
          if ( cmd_list[0].length > 0 ) {
            return getFAQ(cmd_list[0]);
          } else {
            return getFAQ("help");
          }
      }
    })
    .then((response) => {
      // Send the formatted message back to Slack
      res.json(response);
    })
    .catch((err) => {
      console.error(err);
      res.status(err.code || 500).send(err);
      return Promise.reject(err);
    });
}


function formatSimpleMessage (response) {
  // Prepare a rich Slack message
  // See https://api.slack.com/docs/message-formatting
  const slackMessage = {
    response_type: 'ephemeral',
    text: `${response}`,
    attachments: []
  };
  return slackMessage;
}


function listFAQs() {
  const q = datastore.createQuery('slack-faq-entry')
                     .order('version',{descending: true});
  return datastore
    .runQuery(q)
    .then(results => {
      const faqs = results[0];
      var content = '';
      faqs.forEach(faq => {
        content = content + '*' + faq['tag'] + ':* ' + faq['title'] + '\n';
      });
      return formatSimpleMessage(content);
    })
    .catch(err => {
      console.error('ERROR:',err);
      return formatSimpleMessage('Sorry, query failed');
    });
}


function addFAQ(payload,version) {
  const faqKey = datastore.key('slack-faq-entry');
  const entity = {
    key: faqKey,
    data: [
      {
        name: 'updated',
        value: new Date().toJSON(),
      },
      {
        name: 'tag',
        value: payload.submission.tag,
        excludeFromIndexes: false,
      },
      {
        name: 'title',
        value: payload.submission.title,
        excludeFromIndexes: false,
      },
      {
        name: 'content',
        value: payload.submission.content,
        excludeFromIndexes: false,
      },
      {
        name: 'author',
        value: payload.user.name,
        excludeFromIndexes: true,
      },
      {
        name: 'channel',
        value: payload.channel.name,
        excludeFromIndexes: true,
      },
      {
        name: 'version',
        value: version,
        excludeFromIndexes: false,
      },
    ],
  };

  return datastore
    .save(entity)
    .then(() => {
      return '';
    })
    .catch(err => {
      console.error('ERROR:', err);
      return '{"errors":[{"name":"content","error":"Failed to add FAQ to datastore"}]}';
    });
}


function getFAQ(tag) {
  const q = datastore.createQuery('slack-faq-entry')
                     .filter('tag',tag)
                     .order('version', {descending: true});
  return datastore
    .runQuery(q)
    .then(results => {
      const faqs = results[0];
      if (faqs.length > 0) {
        const content = faqs[0]['title'] + '\n' + faqs[0]['content'];
        return formatSimpleMessage(content);
      } else {
        return formatSimpleMessage("Sorry, I didn't find a FAQ with tag *" + tag + "*\nType */faq list* for all available FAQs");
      }
    })
    .catch(err => {
      console.error('ERROR:',err);
    });
}
