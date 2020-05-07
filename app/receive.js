import { struct } from 'pb-util';
import send from './send';
import utils from './utils';
import graphApi from './graph-api';
import mysql from '../config/mysql';

/**
 * Process message type card
 * @param {Object} messages
 * @param {Number} sender
 */
const handleCardMessages = (messages, sender) => {
    let elements = [];
    for (var m = 0; m < messages.length; m += 1) {
        let message = messages[m];

        let buttons = [];
        for (var b = 0; b < message.card.buttons.length; b += 1) {
            let isLink = message.card.buttons[b].postback.substring(0, 4) === 'http';
            let button;
            if (isLink) {
                button = {
                    type: 'web_url',
                    title: message.card.buttons[b].text,
                    url: message.card.buttons[b].postback
                };
            } else {
                button = {
                    type: 'postback',
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
    for (var i = 0; i < messages.length; i += 1) {
        if (
            previousType == 'card' &&
      (messages[i].message != 'card' || i == messages.length - 1)
        ) {
            timeout = (i - 1) * timeoutInterval;
            setTimeout(handleCardMessages.bind(null, cardTypes, sender), timeout);
            cardTypes = [];
            timeout = i * timeoutInterval;
            setTimeout(handleMessage.bind(null, messages[i], sender), timeout);
        } else if (messages[i].message == 'card' && i == messages.length - 1) {
            cardTypes.push(messages[i]);
            timeout = (i - 1) * timeoutInterval;
            setTimeout(handleCardMessages.bind(null, cardTypes, sender), timeout);
            cardTypes = [];
        } else if (messages[i].message == 'card') {
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


const handleMsgObj = {
    'text': (message, sender) => {
        message.text.text.forEach(text => {
            if (text !== '') {
                send.sendTextMessage(sender, text);
            }
        });
    },
    'quickReplies': (message, sender) => {
        let replies = [];
        message.quickReplies.quickReplies.forEach(text => {
            let reply = {
                content_type: 'text',
                title: text,
                payload: text
            };
            replies.push(reply);
        });
        return send.sendQuickReply(sender, message.quickReplies.title, replies);
    },
    'image': (message, sender) => {
        send.sendImageMessage(sender, message.image.imageUri);
    },
    'payload': (message, sender) => {
        const payload = struct.decode(message.payload);
        let verifyPerson = null;
    
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
    }
};

const handleMessage = (message, sender) => {
    handleMsgObj[message.message](message, sender);
};

/**
 * Process quick reply message
 * @param {*} senderID
 * @param {*} quickReply
 * @param {*} messageId
 */
const handleQuickReply = (senderID, quickReply, messageId) => {
    var quickReplyPayload = quickReply.payload;
    console.log(
        '⚡️ [BOT CONSILIO] Quick reply for message %s with payload %s',
        messageId,
        quickReplyPayload
    );

    send.sendToDialogFlow(senderID, quickReplyPayload);
};

/**
 * Process attachments
 * @param {*} messageAttachments
 * @param {Number} senderID
 */
const handleMessageAttachments = (messageAttachments, senderID) => {
    send.sendTextMessage(senderID, 'Recebi o anexo. Muito obrigado.');
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
    } else if (responseText == '' && !utils.isDefined(action)) {
        return false;
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
const handleDFAObj = {
    'input.welcome': async (sender, messages) => {
        // const user = utils.usersMap.get(sender);

        send.sendTypingOn(sender);
        // send.sendTextMessage(sender, `Olá ${user.first_name}!`);
        setTimeout(function() {
            handleMessages(messages, sender);
        }, 1000);
    },
    'input.phone': (sender, messages, contexts, parameters) => {
        send.sendTypingOn(sender);
        const phone = parameters.fields.phone.stringValue;

        mysql.execQuery(`UPDATE leads SET phone = '${phone}' WHERE senderID = '${sender}'`)
            .catch(err => {
                console.log('❌ ERRO: ', err);
            });
        setTimeout(function() {
            handleMessages(messages, sender);
        }, 1000);
    },
    'input.email': (sender, messages, contexts, parameters) => {
        send.sendTypingOn(sender);
        const email = parameters.fields.email.stringValue;

        mysql.execQuery(`UPDATE leads SET email = '${email}' WHERE senderID = '${sender}'`)
            .catch(err => {
                console.log('❌ ERRO: ', err);
            });

        setTimeout(function() {
            handleMessages(messages, sender);
        }, 1000);
    },
    'input.schedule': (sender, messages) => {
        send.sendTypingOn(sender);
        setTimeout(function() {
            handleMessages(messages, sender);
        }, 1000);
    },
    'input.unknown': (sender, messages) => {
        send.sendTypingOn(sender);
        handleMessages(messages, sender);
        setTimeout(function() {
            let text = 'Opps, talvez eu não tenha aprendido o suficiente 😔. \n\n' +
                    'Podemos tentar de novo, ou se preferir falar com um dos nossos humandos disponíveis 💜.';
            let replies = [
                {
                    'content_type': 'text',
                    'title': 'Falar com humano',
                    'payload': 'LIVE_AGENT'
                }
            ];
            send.sendQuickReply(sender, text, replies);
        }, 1000);
    },
    'default': (sender, messages) => {
        send.sendTypingOn(sender);
        handleMessages(messages, sender);
    }
};
const handleDialogFlowAction = (sender, action, messages, contexts, parameters) => {
    return (handleDFAObj[action] ? handleDFAObj[action] : handleDFAObj['default'])(sender, messages, contexts, parameters);
};

/**
 * Just logging message echoes to console
 * @param {Number} messageId
 * @param {Number} appId
 * @param {Object} metadata
 */
const handleEcho = (messageId, appId, metadata) => {
    console.log(
        '❌ [BOT CONSILIO] Received echo for message %s and app %d with metadata %s',
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
        '⚡️ [BOT CONSILIO] Received message for user %d and page %d at %d with message:',
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

const receivedPbObj = {
    'get_started': (senderID, payload) => {
        send.sendToDialogFlow(senderID, payload);
    },
    'view_site': (senderID, payload) => {
        send.sendTextMessage(senderID, payload);
    },
    'default': (senderID, payload) => {
        send.sendTextMessage(senderID, payload);
    }
};
const receivedPostback = event => {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfPostback = event.timestamp;

    var payload = event.postback.payload;

    console.log(
        '⚡️ [BOT CONSILIO] Received postback for user %d and page %d with payload \'%s\' ' +
      'at %d',
        senderID,
        recipientID,
        payload,
        timeOfPostback
    );

    return (receivedPbObj[payload] || receivedPbObj['default'])(senderID, payload);
};

/**
 * Received notification message read
 * @param {*} event
 */
const receivedMessageRead = event => {
    // var senderID = event.sender.id;
    // var recipientID = event.recipient.id;

    var watermark = event.read.watermark;
    var sequenceNumber = event.read.seq;

    console.log(
        '⚡️ [BOT CONSILIO] Received message read event for watermark %d and sequence ' +
      'number %d',
        watermark,
        sequenceNumber
    );
};

/**
 * Received notification authentication
 * @param {*} event
 */
const receivedAuthentication = event => {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfAuth = event.timestamp;

    var passThroughParam = event.optin.ref;

    console.log(
        '⚡️ [BOT CONSILIO] Received authentication for user %d and page %d with pass ' +
      'through param \'%s\' at %d',
        senderID,
        recipientID,
        passThroughParam,
        timeOfAuth
    );
    send.sendTextMessage(senderID, 'Autenticação realizada com sucesso!');
};

/**
 * Received account link
 * @param {*} event
 */
const receivedAccountLink = event => {
    var senderID = event.sender.id;
    // var recipientID = event.recipient.id;

    var status = event.account_linking.status;
    var authCode = event.account_linking.authorization_code;

    console.log(
        '⚡️ [BOT CONSILIO] Received account link event with for user %d with status %s ' +
      'and auth code %s ',
        senderID,
        status,
        authCode
    );
};

/**
 * Received devivery confirmation
 * @param {*} event
 */
const receivedDeliveryConfirmation = event => {
    // var senderID = event.sender.id;
    // var recipientID = event.recipient.id;
    var delivery = event.delivery;
    var messageIDs = delivery.mids;
    var watermark = delivery.watermark;
    // var sequenceNumber = delivery.seq;

    if (messageIDs) {
        messageIDs.forEach(function(messageID) {
            console.log(
                '⚡️ [BOT CONSILIO] Received delivery confirmation for message ID: %s',
                messageID
            );
        });
    }
    console.log(
        '⚡️ [BOT CONSILIO] All message before %d were delivered.',
        watermark
    );
};

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
