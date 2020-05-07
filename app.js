'use strict';

/*
 ** Import packages
 */
require('dotenv').config();
import express from 'express';
import bodyParser from 'body-parser';
import cors from './config/cors';
import config from './config/variables';
import mysql from './config/mysql';
import webhook from './app/webhook';

const app = express()
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({ extended: true }))
    .use(cors)
    .use(express.static(__dirname + '/static'));

config.checkEnv();


/*
 ** Routes configuration
 */

app.get('/profile', webhook.setProfile);
app.get('/webhook', webhook.verifyWebhook);
app.post('/webhook', webhook.messageHandler);

app.get('/leads', async (req, res) =>{
    const leads = await mysql.execQuery('SELECT * FROM leads');
    res.status(200).send(leads);
});

/*
 ** Middleware configuration
 */
app.listen(config.PORT, () => {
    console.log('⚡️ [BOT CONSILIO] Express server is listening.');

    if (
        config.APP_URL &&
        config.SITE_URL
    ) {
        console.log(
            '⚡️ [BOT CONSILIO] Make sure to set the both the Messenger profile ' +
        'and webhook by visiting:\n⚡️ [BOT CONSILIO] ' +
        config.APP_URL +
        '/profile?mode=all&verify_token=' +
        config.VERIFY_TOKEN
        );
    }
    if (config.PAGE_ID) {
        console.log('⚡️ [BOT CONSILIO] Test app by messaging:');
        console.log('⚡️ [BOT CONSILIO] https://m.me/' + config.PAGE_ID);
    }
});

/*
 ** Base view
 */
app.get('/', (req, res) => {
    res.send('⚡️[BOT CONSILIO] Hello world!');
});