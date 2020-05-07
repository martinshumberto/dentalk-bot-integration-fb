import config from '../config/variables';
import utils from './utils';
import profile from './profile';
import receive from './receive';
import graphApi from './graph-api';
import moment from 'moment';
import { google } from 'googleapis';

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

const calendarID = config.CALENDAR_ID;
const serviceAccount = {
    client_email: config.GOOGLE_CLIENT_EMAIL,
    private_key: config.GOOGLE_PRIVATE_KEY
};

const serviceAccountAuth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: 'https://www.googleapis.com/auth/calendar'
});

const calendar = google.calendar('v3');

const timeZoneOffset = '-03:00';

const verifyWebhook = async (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const challenge = req.query['hub.challenge'];
        const token = req.query['hub.verify_token'];

        if (mode && token) {
            if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
                console.log('⚡️ [BOT CONSILIO] Verify token passed.');
                res.status(200).send(challenge);
            } else {
                console.log('❌ [BOT CONSILIO] Webhook is not verified.');
                res.status(403);
            }
        }
    } catch (error) {
        console.log('❌ [BOT CONSILIO] Error in verify webhook ', error);
    }
};


function createCalendarEvent (dateTimeStart, dateTimeEnd) {
    return new Promise((resolve, reject) => {
        calendar.events.list({
            auth: serviceAccountAuth, // List events for time period
            calendarId: calendarID,
            timeMin: dateTimeStart.toISOString(),
            timeMax: dateTimeEnd.toISOString()
        }, (err, calendarResponse) => {
        // Check if there is a event already on the Calendar
            if (err || calendarResponse.data.items.length > 0) {
                reject(err || new Error('Requested time conflicts with another appointment'));
            } else {
                // Create event for the requested time period
                calendar.events.insert({ auth: serviceAccountAuth,
                    calendarId: calendarID,
                    description: 'Gynaecologist appointment',
                    resource: {summary: 'Agendamento avaliação',
                        start: {dateTime: dateTimeStart},
                        end: {dateTime: dateTimeEnd}}
                }, (err, event) => {
                    err ? reject(err) : resolve(event);
                }
                );
            }
        });
    });
}

const messageHandler = async (req, res) => {
    let senderID = null;
    try {
        let body = req.body;

        if (body.object === 'page') {
            body.entry.forEach(function(pageEntry) {
                // var pageID = pageEntry.id;
                // var timeOfEvent = pageEntry.time;

                let hookEvent = pageEntry.messaging[0];
                let senderPsid = hookEvent.sender.id;
                senderID = hookEvent.sender.id;

                console.log('SENDERID', senderID);

                utils.setSessionandUser(senderPsid);

                pageEntry.messaging.forEach(function(messagingEvent) {
                    if (messagingEvent.optin) {
                        receive.receivedAuthentication(messagingEvent);
                    } else if (messagingEvent.message) {
                        receive.receivedMessage(messagingEvent);
                    } else if (messagingEvent.delivery) {
                        receive.receivedDeliveryConfirmation(messagingEvent);
                    } else if (messagingEvent.postback) {
                        receive.receivedPostback(messagingEvent);
                    } else if (messagingEvent.read) {
                        receive.receivedMessageRead(messagingEvent);
                    } else if (messagingEvent.account_linking) {
                        receive.receivedAccountLink(messagingEvent);
                    } else {
                        console.log(
                            '❌ [BOT CONSILIO] Webhook received unknown messaging. Event: ',
                            messagingEvent
                        );
                    }
                });
            });

            res.status(200).send('⚡️ [BOT CONSILIO] Event receiving.');
        } 

        const action = req.body.queryResult && req.body.queryResult.action ? req.body.queryResult.action : null;
        const params = req.body.queryResult && req.body.queryResult.parameters ? req.body.queryResult.parameters : null;

        console.log('BOOOODY: ', body);

        if (action == 'input.welcome') {
            if (params) {
                for(let obj in req.body.queryResult.outputContexts){
                    req.body.queryResult.outputContexts[obj].parameters.name = 'DSIUASHDUASHDIUHA';
                    req.body.queryResult.outputContexts[obj].parameters['name.original'] = 'DSIUASHDUASHDIUHA';
                }
                return res.send(JSON.stringify({
                    parameters: { name: 'DSIUASHDUASHDIUHA' },
                    followupEventInput: {
                        name: 'welcome',
                        languageCode: 'pt-BR',
                        parameters: {
                            name: 'DSIUASHDUASHDIUHA'
                        }
                    },
                    outputContexts : req.body.queryResult.outputContexts
                })
                );
            }
        }
        if (action == 'input.schedule') {
            const dateTimeStart = new Date(Date.parse(params.date.split('T')[0] + 'T' + params.time.split('T')[1].split('-')[0] + timeZoneOffset));
            const dateTimeEnd = new Date(new Date(dateTimeStart).setHours(dateTimeStart.getHours() + 1));
            const appointmentTimeString = moment(dateTimeStart).locale('pt-br').format('LLLL');
    
            createCalendarEvent(dateTimeStart, dateTimeEnd).then((resp) => {
                console.log(`Agendamento feito com sucesso. ${appointmentTimeString} Está certo!.`, resp);
                return res.send(JSON.stringify({
                    fulfillmentText: `Agendamento realizado com sucesso. Seu horário ${appointmentTimeString} foi agendado.`,
                    fulfillmentMessages: [
                        {
                            text: {
                                text: [
                                    `Agendamento realizado com sucesso. Seu horário ${appointmentTimeString} foi agendado.`
                                ]
                            }
                        }
                    ],
                })
                );
            }).catch(err => {
                console.log(`${appointmentTimeString}, esse horário não está disponível.`, err);
                return res.send(JSON.stringify({
                    fulfillmentText: `Opps o horário ${appointmentTimeString}, não está disponível. Vamos tentar de novo?`,
                    fulfillmentMessages: [
                        {
                            text: {
                                text: [
                                    `Opps o horário ${appointmentTimeString}, não está disponível. Vamos tentar de novo?`
                                ]
                            }
                        }
                    ],
                })
                );
            }); 
        }

    } catch (error) {
        console.log('❌ [BOT CONSILIO] Error in post webhook. ', error);
    }
};

const setProfile = async (req, res) => {
    let token = req.query['verify_token'];
    let mode = req.query['mode'];

    if (!config.APP_URL.startsWith('https://')) {
        res
            .status(200)
            .send('❌ [BOT CONSILIO] ERROR - Need a proper API_URL in the .env file');
    }

    if (mode && token) {
        if (token === config.VERIFY_TOKEN) {
            if (mode == 'webhook' || mode == 'all') {
                profile.setWebhook();
                res.write(
                    `<p>Set app ${config.APP_ID} call to ${config.APP_URL}/webhook </p>`
                );
            }
            if (mode == 'profile' || mode == 'all') {
                profile.setThread();
                res.write(`<p>Set Messenger Profile of Page ${config.PAGE_ID}</p>`);
            }
            if (mode == 'nlp' || mode == 'all') {
                graphApi.callNLPConfigsAPI();
                res.write(`<p>Enable Built-in NLP for Page ${config.PAGE_ID}</p>`);
            }
            if (mode == 'domains' || mode == 'all') {
                profile.setWhitelistedDomains();
                res.write(`<p>Whitelisting domains: ${config.whitelistedDomains}</p>`);
            }
            if (mode == 'private-reply') {
                profile.setPageFeedWebhook();
                res.write('<p>Set Page Feed Webhook for Private Replies.</p>');
            }
            res.status(200).end();
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(404);
    }
};

export default { verifyWebhook, messageHandler, setProfile };