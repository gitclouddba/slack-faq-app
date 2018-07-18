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


/**
 * Verify that the webhook request came from Slack.
 *
 * @param {object} body The body of the request.
 * @param {string} body.token The Slack token to be verified.
 * Expect Slack token to be avaiable in SLACK_TOKEN environment variable
 */
function verifyWebhook (body) {
  if (!body || body.token !== process.env.SLACK_TOKEN) {
    var s = 'received token: ' + body.token + ' expected token: ' + process.env.SLACK_TOKEN
    console.log(s)
    const error = new Error('Invalid credentials');
    error.code = 401;
    throw error;
  }
}


/**
 * Receive a Slash Command request from Slack.
 *
 * Trigger this function by making a POST request with a payload to:
 * https://[YOUR_REGION].[YOUR_PROJECT_ID].cloudfunctions.net/slackFAQ
 *
 * @example
 * curl -X POST "https://us-central1.your-project-id.cloudfunctions.net/kgSearch" --data '{"token":"[YOUR_SLACK_TOKEN]","text":"list"}'
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
        const error = new Error('Only POST requests are accepted');
        error.code = 405;
        throw error;
      }

      // Verify that this request came from Slack
      verifyWebhook(req.body);

      var cmd_list = req.body.text.split(' ')

      switch(cmd_list[0]) {
        case 'add':
          console.log('calling addFAQ()');
          return addFAQ();
        case 'list':
          console.log('calling listFAQs()');
          return listFAQs();
        case 'show':
          console.log('calling getFAQ()');
          return getFAQ(cmd_list[1]);
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
};


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


function addFAQ() {
  const faqKey = datastore.key('slack-faq-entry');
  const entity = {
    key: faqKey,
    data: [
      {
        name: 'updated',
        value: new Date().toJSON(),
      },
      {
        name: 'title',
        value: 'This is the title',
        excludeFromIndexes: true,
      },
      {
        name: 'content',
        value: 'This is the content',
        excludeFromIndexes: false,
      },
    ],
  };

  return datastore
    .save(entity)
    .then(() => {
      return formatSimpleMessage(`FAQ ${faqKey.id} created successfully.`);
    })
    .catch(err => {
      console.error('ERROR:', err);
    });
}


function getFAQ(tag) {
  const q = datastore
              .createQuery('slack-faq-entry')
              .filter('tag','=',tag);
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
