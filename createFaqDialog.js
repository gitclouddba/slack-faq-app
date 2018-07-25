module.exports = (triggerId, text) => {
  const form = {
    token: process.env.SLACK_ACCESS_TOKEN,
    trigger_id: triggerId,
    dialog: JSON.stringify({
      title: 'Create a new FAQ',
      callback_id: 'create-faq',
      submit_label: 'Submit',
      elements: [
        {
          label: 'Title',
          type: 'text',
          name: 'title',
          value: text,
          hint: 'One-line description of FAQ contents',
        },
        {
          label: 'Tag',
          type: 'text',
          name: 'tag',
          hint: 'Index word for this FAQ',
        },
        {
          label: 'Content',
          type: 'textarea',
          name: 'content',
          hint: 'Write the content of the FAQ here.  You can use Slack formatting',
        },
      ],
    }),
  };

  return form;
};
