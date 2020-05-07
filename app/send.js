'use strict';
import dialogflow from 'dialogflow';
import config from '../config/variables';
import utils from './utils';
import receive from './receive';
import graphApi from './graph-api';

const credentials = {
    credentials: {
        private_key: config.GOOGLE_PRIVATE_KEY,
        client_email: config.GOOGLE_CLIENT_EMAIL
    }
};

const sessionClient = new dialogflow.SessionsClient(credentials);

/**
 * Send all messages to DialogFlow
 * @param {*} sender
 * @param {*} textString
 * @param {*} params
 */
const sendToDialogFlow = async (sender, textString, params) => {
    sendTypingOn(sender);
    
    const sessionPath = sessionClient.sessionPath(
        config.GOOGLE_PROJECT_ID,
        utils.sessionIds.get(sender)
    );

    try {
        const request = {
            session: sessionPath,
            queryInput: {
                text: {
                    text: textString,
                    languageCode: config.GOOGLE_LANGUAGE_CODE
                }
            },
            queryParams: {
                payload: {
                    data: params,
                }
            }
        };
        
        const responses = await sessionClient.detectIntent(request);
        const result = responses[0].queryResult;
        receive.handleDialogFlowResponse(sender, result);
    } catch (e) {
        console.log('❌ [BOT CONSILIO] Error in process message in Dialogflow:');
        console.log(e);
    }
};

/**
 * Send action typing on using the Service API
 * @param {Number} recipientId
 */
const sendTypingOn = recipientId => {
    var messageData = {
        recipient: {
            id: recipientId
        },
        sender_action: 'typing_on'
    };

    graphApi.sendCall(messageData);
};

/**
 * Send action typing off using the Service API
 * @param {Number} recipientId
 */
const sendTypingOff = recipientId => {
    var messageData = {
        recipient: {
            id: recipientId
        },
        sender_action: 'typing_off'
    };

    graphApi.sendCall(messageData);
};

/**
 * Send type text message using the Service API
 * @param {Number} recipientId
 * @param {String} text
 */
const sendTextMessage = (recipientId, text) => {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: text
        }
    };
    graphApi.sendCall(messageData);
};

/**
 * Send text message with persona
 * @param {Number} recipientId
 * @param {String} text
 * @param {Number} persona_id
 */
const sendTextWithPersona = (recipientId, text, persona_id) => {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: text,
            persona_id: persona_id
        }
    };
    graphApi.sendCall(messageData);
};

/**
 * Send type quick reply message using the Service API.
 * @param {Number} recipientId
 * @param {String} text
 */
const sendQuickReply = (recipientId, text, replies, metadata) => {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: text,
            metadata: utils.isDefined(metadata) ? metadata : '',
            quick_replies: replies
        }
    };

    graphApi.sendCall(messageData);
};

/**
 * Send type template generic message using the Service API.
 * @param {Number} recipientId
 * @param {Object} elements
 */
const sendGenericMessage = (recipientId, elements) => {
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: 'template',
                payload: {
                    template_type: 'generic',
                    elements: elements
                }
            }
        }
    };
    graphApi.sendCall(messageData);
};

export default {
    sendToDialogFlow,
    sendTypingOn,
    sendTypingOff,
    sendTextMessage,
    sendTextWithPersona,
    sendQuickReply,
    sendGenericMessage
};
