'use strict';
import mysql from '../config/mysql';
import utils from './utils';
import calendar from './calendar';
import moment from 'moment';
import { WebhookClient } from 'dialogflow-fulfillment';
import { Payload } from 'dialogflow-fulfillment';

process.env.DEBUG = 'dialogflow:debug';

const messageHandler = async (req, res) => {
    const agent = new WebhookClient({request: req, response: res});

    console.log('REQUEST HANDLER: ', req.body);
    console.log('RESPONSE HANDLER: ', res.body);

    const senderID = req.body.originalDetectIntentRequest.payload.data ? req.body.originalDetectIntentRequest.payload.data.sender.id : null;
    const fulfillmentText = req.body.queryResult.fulfillmentText;

    await utils.setSessionandUser(senderID);
    const user = await utils.usersMap.get(senderID);
    const userDB = await mysql.execQuery(`SELECT * FROM leads WHERE senderID= '${user.id}'`).catch(err => {
        console.log('❌ ERRO: ', err);
    });
    
    const action = agent.action;
    const parameters = agent.parameters;

    /**
     * ACTIONS
     */

    if (action == 'input.phone') {
        const phone = parameters.fields.phone.stringValue;
        mysql.execQuery(`UPDATE leads SET phone = '${phone}' WHERE senderID = '${senderID}'`)
            .catch(err => {
                console.log('❌ ERRO: ', err);
            });
    }
    if (action == 'input.email') {
        const email = parameters.fields.email.stringValue;
        mysql.execQuery(`UPDATE leads SET email = '${email}' WHERE senderID = '${senderID}'`)
            .catch(err => {
                console.log('❌ ERRO: ', err);
            });
    }

    /**
     * INTENTS
     */

    function welcome (agent) {

        if(agent.query == 'FACEBOOK_WELCOME') {
            const payload = {
                'fulfillmentMessages': [
                    {
                        'platform':'FACEBOOK',
                        'text':{
                            'text':[`Olá ${userDB[0].first_name}`]
                        },
                        'message':'text'
                    },
                ],
                'fulfillmentText': `Olá ${userDB[0].first_name}`,
                'facebook': {
                    'text': 'Antes de começarmos, me informe o seu número de celular:',
                    'quick_replies': [
                        {
                            'title': 'user_phone_number',
                            'payload': 'user_phone_number',
                            'content_type': 'user_phone_number'
                        }
                    ]
                }
            };
            agent.add(`Olá ${userDB[0].first_name}`);
            agent.add('Sou a Lary, a atendente virtual da Clínica Dentalk!');
            agent.add('Aqui acreditamos que sorrisos renovados transformam vidas!');
            agent.add(new Payload(agent.FACEBOOK, payload, {rawPayload: false, sendAsMessage: true}));
        } else {
            console.log('QUER RESULT fulfillmentMessages', req.body.queryResult.fulfillmentMessages);
            const payload = {
                'facebook': {
                    'text': 'Antes de começarmos, me informe o seu número de celular:',
                    'quick_replies': [
                        {
                            'title': 'user_phone_number',
                            'payload': 'user_phone_number',
                            'content_type': 'user_phone_number'
                        }
                    ]
                },
                'payload': {
                    'facebook': {
                        'text': 'Teste',
                        'quick_replies': [
                            {
                                'title': 'user_phone_number',
                                'payload': 'user_phone_number',
                                'content_type': 'user_phone_number'
                            }
                        ]
                    },
                }
            };
            agent.add(new Payload(agent.FACEBOOK, payload, {rawPayload: true, sendAsMessage: true}));
            agent.add(`Olá ${userDB[0].first_name}`);
            agent.add('Estou feliz em te ver por aqui de novo, em que posso te ajudar hoje?');
        }
        
        // if (user.first_name !== '' && user.last_name !== '') {
        //     for (let response of agent.consoleMessages) agent.add(response);
        //     agent.add('TESTANDO');
        //     console.log('RODOU DENTRO');
        // } else {
        //     console.log('RODOU FORA');
        //     for (let response of agent.consoleMessages) agent.add(response);
        //     agent.setFollowupEvent({ 
        //         'name': 'welcome', 
        //         'parameters' : { 
        //             'first_name': user.first_name, 
        //             'last_name': user.last_name,
        //             'phone': userDB.phone,
        //             'email': userDB.email
        //         }
        //     });
        //     return false;
        // }
    }
    async function phone (agent) {
        for (let response of agent.consoleMessages) agent.add(response);
        const [phone, email] = [agent.parameters['phone']];

        let missingSlots = [];
        if (!phone) { missingSlots.push('phone'); }

        if (missingSlots.length === 1){
            agent.add(`Looks like you didn't provide a ${missingSlots[0]}`);
        } else {
            agent.add(`So according to ${phone}, ${email} and now flourishes in over 361 regions.`);
        }
    }
    function hours (agent) {
        if (calendar.currentlyOpen()) {
            for (let response of agent.consoleMessages) agent.add(response);
            agent.add('Estamos abertos agora! Fechamos hoje às 18h.');
        } else {
            for (let response of agent.consoleMessages) agent.add(response);
            agent.add('No momento, estamos fechados, mas abrimos todos os dias da semana às 9h!');
        }
    }
    function schedule (agent) {
        agent.setFollowupEvent('schedule');
        console.log('PARAMS', agent.parameters);

        console.log('ENTROU AQUI');

        const dateTimeStart = new Date(Date.parse(agent.parameters.date.split('T')[0] + 'T' + agent.parameters.time.split('T')[1].split('-')[0] + '-03:00'));
        const dateTimeEnd = new Date(new Date(dateTimeStart).setHours(dateTimeStart.getHours() + 1));
        const appointmentTimeString = moment(dateTimeStart).locale('pt-br').format('LLLL');

        console.log('ENTROU AQUI 2');

        if (userDB[0].first_name && userDB[0].last_name && userDB[0].phone && userDB[0].email) {
            calendar.createCalendarEvent(dateTimeStart, dateTimeEnd, userDB).then(() => {
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
                }));
            }).catch(() => {
                return res.send(JSON.stringify({
                    fulfillmentText: `Opps o horário ${appointmentTimeString} não está disponível. Vamos tentar outra data e/ou horário?`,
                    fulfillmentMessages: [
                        {
                            text: {
                                text: [
                                    `Opps o horário ${appointmentTimeString} não está disponível. Vamos tentar outra data e/ou horário?`
                                ]
                            }
                        }
                    ],
                })
                );
            }); 
        } else {
            console.log('PASSOU AQUI RETURN');
            for (let response of agent.consoleMessages) agent.add(response);
            return agent.setFollowupEvent('welcome');
        }
        
    }

    /**
     * HANDLE REQUEST
     */

    let intentMap = new Map();
    intentMap.set('none', agent => {
        agent.add(fulfillmentText);
    });
    intentMap.set('welcome', welcome);
    intentMap.set('phone', phone);
    intentMap.set('schedule', schedule);
    intentMap.set('hours', hours);
    agent.handleRequest(intentMap);
};


export default { messageHandler };