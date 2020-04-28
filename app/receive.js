import { struct } from "pb-util";
import send from "./send";
import graphApi from "./graph-api";
import utils from "./utils";
import { dialogflow } from "actions-on-google";

const app = dialogflow({debug: true});

/**
 * Process message type card
 * @param {Object} messages
 * @param {Number} sender
 */
const handleCardMessages = (messages, sender) => {
  let elements = [];
  for (var m = 0; m < messages.length; m++) {
    let message = messages[m];

    let buttons = [];
    for (var b = 0; b < message.card.buttons.length; b++) {
      let isLink = message.card.buttons[b].postback.substring(0, 4) === "http";
      let button;
      if (isLink) {
        button = {
          type: "web_url",
          title: message.card.buttons[b].text,
          url: message.card.buttons[b].postback
        };
      } else {
        button = {
          type: "postback",
          title: message.card.buttons[b].text,
          payload: message.card.buttons[b].postback
        };
      }
      buttons.push(button);
    }

    let element = {
      title: message.card.title,
      image_url: message.card.imageUri,
      subtitle: message.card.subtitle,
      buttons: buttons
    };
    elements.push(element);
  }
  send.sendGenericMessage(sender, elements);
};

/**
 * Process messages
 * @param {Object} messages
 * @param {Number} sender
 */
const handleMessages = (messages, sender) => {
  let timeoutInterval = 1100;
  let previousType;
  let cardTypes = [];
  let timeout = 0;
  for (var i = 0; i < messages.length; i++) {
    if (
      previousType == "card" &&
      (messages[i].message != "card" || i == messages.length - 1)
    ) {
      timeout = (i - 1) * timeoutInterval;
      setTimeout(handleCardMessages.bind(null, cardTypes, sender), timeout);
      cardTypes = [];
      timeout = i * timeoutInterval;
      setTimeout(handleMessage.bind(null, messages[i], sender), timeout);
    } else if (messages[i].message == "card" && i == messages.length - 1) {
      cardTypes.push(messages[i]);
      timeout = (i - 1) * timeoutInterval;
      setTimeout(handleCardMessages.bind(null, cardTypes, sender), timeout);
      cardTypes = [];
    } else if (messages[i].message == "card") {
      cardTypes.push(messages[i]);
    } else {
      timeout = i * timeoutInterval;
      setTimeout(handleMessage.bind(null, messages[i], sender), timeout);
    }
    previousType = messages[i].message;
  }
};

/**
 * Process single message
 * @param {Object} message
 * @param {Number} sender
 */
const handleMessage = (message, sender) => {
  switch (message.message) {
    case "text": //text
      message.text.text.forEach(text => {
        if (text !== "") {
          send.sendTextMessage(sender, text);
        }
      });
      break;
    case "quickReplies": //quick replies
      let replies = [];
      message.quickReplies.quickReplies.forEach(text => {
        let reply = {
          content_type: "text",
          title: text,
          payload: text
        };
        replies.push(reply);
      });
      send.sendQuickReply(sender, message.quickReplies.title, replies);
      break;
    case "image": //image
      send.sendImageMessage(sender, message.image.imageUri);
      break;
    case "payload": //payload
      const payload = struct.decode(message.payload);
      const verifyPerson = null;

      if (payload.facebook.payload) {
        verifyPerson = payload.facebook.person_true;
      }

      let messageData = {
        recipient: {
          id: sender
        },
        message: payload.facebook,
        verifyPerson
      };
      graphApi.sendCall(messageData);
      break;
  }
};

/**
 * Process quick reply message
 * @param {*} senderID
 * @param {*} quickReply
 * @param {*} messageId
 */
function handleQuickReply(senderID, quickReply, messageId) {
  var quickReplyPayload = quickReply.payload;
  console.log(
    "⚡️ [BOT CONSILIO] Quick reply for message %s with payload %s",
    messageId,
    quickReplyPayload
  );

  send.sendToDialogFlow(senderID, quickReplyPayload);
}

/**
 * Process attachments
 * @param {*} messageAttachments
 * @param {Number} senderID
 */
const handleMessageAttachments = (messageAttachments, senderID) => {
  send.sendTextMessage(senderID, "Recebi o anexo. Muito obrigado.");
};

/**
 * Process Dialogflow response
 * @param {Number} sender
 * @param {Object} response
 */
const handleDialogFlowResponse = (sender, response) => {
  let responseText = response.fulfillmentMessages.fulfillmentText;

  let messages = response.fulfillmentMessages;
  let action = response.action;
  let contexts = response.outputContexts;
  let parameters = response.parameters;

  var delay = 4000;

  if (utils.isDefined(action)) {
    send.sendTypingOn(sender);
    setTimeout(function() {
      send.sendTypingOff(sender);
      handleDialogFlowAction(sender, action, messages, contexts, parameters);
    }, delay);
  } else if (
    utils.isDefined(messages) &&
    ((messages.length == 1 && messages[0].type != 0) || messages.length > 1)
  ) {
    send.sendTypingOn(sender);
    setTimeout(function() {
      send.sendTypingOff(sender);
      handleMessages(messages, sender);
    }, delay);
  } else if (responseText == "" && !utils.isDefined(action)) {
  } else if (utils.isDefined(responseText)) {
    send.sendTypingOn(sender);
    setTimeout(function() {
      send.sendTypingOff(sender);
      send.sendTextMessage(sender, responseText);
    }, delay);
  }
};

/**
 * Process Dialogflow actions
 * @param {*} sender
 * @param {*} action
 * @param {*} messages
 * @param {*} contexts
 * @param {*} parameters
 */
const handleDialogFlowAction = (
  sender,
  action,
  messages,
  contexts,
  parameters
) => {
  switch (action) {
    case "input.welcome":
      let user = utils.usersMap.get(sender);

      send.sendTypingOn(sender);
      send.sendTextMessage(sender, "Olá " + user.first_name + "!");
      setTimeout(function() {
        handleMessages(messages, sender);
      }, 1000);
      break;

    default:
      handleMessages(messages, sender);
  }
};

/**
 * Just logging message echoes to console
 * @param {Number} messageId
 * @param {Number} appId
 * @param {Object} metadata
 */
const handleEcho = (messageId, appId, metadata) => {
  console.log(
    "❌ [BOT CONSILIO] Received echo for message %s and app %d with metadata %s",
    messageId,
    appId,
    metadata
  );
};

/**
 * Received message
 * @param {*} event
 */
const receivedMessage = event => {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  utils.setSessionandUser(senderID);
  console.log(
    "⚡️ [BOT CONSILIO] Received message for user %d and page %d at %d with message:",
    senderID,
    recipientID,
    timeOfMessage
  );

  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;

  if (isEcho) {
    handleEcho(messageId, appId, metadata);
    return;
  } else if (quickReply) {
    handleQuickReply(senderID, quickReply, messageId);
    return;
  }

  if (messageText) {
    send.sendToDialogFlow(senderID, messageText);
  } else if (messageAttachments) {
    handleMessageAttachments(messageAttachments, senderID);
  }
};

/**
 * Received post back
 * @param {*} event
 */
function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  var payload = event.postback.payload;

  //send.sendTextMessage(senderID, payload);

  switch (payload) {
    case "get_started":
      send.sendToDialogFlow(senderID, payload);
      break;
    case "view_site":
      send.sendTextMessage(senderID, payload);
      break;
    default:
      send.sendTextMessage(senderID, payload);
      break;
  }

  console.log(
    "⚡️ [BOT CONSILIO] Received postback for user %d and page %d with payload '%s' " +
      "at %d",
    senderID,
    recipientID,
    payload,
    timeOfPostback
  );
}

/**
 * Received notification message read
 * @param {*} event
 */
function receivedMessageRead(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;

  console.log(
    "⚡️ [BOT CONSILIO] Received message read event for watermark %d and sequence " +
      "number %d",
    watermark,
    sequenceNumber
  );
}

/**
 * Received notification authentication
 * @param {*} event
 */
function receivedAuthentication(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfAuth = event.timestamp;

  var passThroughParam = event.optin.ref;

  console.log(
    "⚡️ [BOT CONSILIO] Received authentication for user %d and page %d with pass " +
      "through param '%s' at %d",
    senderID,
    recipientID,
    passThroughParam,
    timeOfAuth
  );
  send.sendTextMessage(senderID, "Autenticação realizada com sucesso!");
}

/**
 * Received account link
 * @param {*} event
 */
function receivedAccountLink(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  var status = event.account_linking.status;
  var authCode = event.account_linking.authorization_code;

  console.log(
    "⚡️ [BOT CONSILIO] Received account link event with for user %d with status %s " +
      "and auth code %s ",
    senderID,
    status,
    authCode
  );
}

/**
 * Received devivery confirmation
 * @param {*} event
 */
function receivedDeliveryConfirmation(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log(
        "⚡️ [BOT CONSILIO] Received delivery confirmation for message ID: %s",
        messageID
      );
    });
  }
  console.log(
    "⚡️ [BOT CONSILIO] All message before %d were delivered.",
    watermark
  );
}

export default {
  handleCardMessages,
  handleMessages,
  handleMessage,
  handleQuickReply,
  handleMessageAttachments,
  handleDialogFlowResponse,
  handleDialogFlowAction,
  handleEcho,
  receivedMessage,
  receivedPostback,
  receivedMessageRead,
  receivedAuthentication,
  receivedAccountLink,
  receivedDeliveryConfirmation
};
