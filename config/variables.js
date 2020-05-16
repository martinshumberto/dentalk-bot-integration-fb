'use strict';

require('dotenv').config();

const ENV_VARS = [
    'PORT',
    'APP_URL',
    'SITE_URL',
    'NAME_COMPANY',
    'PAGE_ID',
    'APP_ID',
    'PAGE_ACCESS_TOKEN',
    'VERIFY_TOKEN',
    'GOOGLE_CLIENT_EMAIL',
    'GOOGLE_PROJECT_ID',
    'GOOGLE_LANGUAGE_CODE',
    'GOOGLE_PRIVATE_KEY',
    'CALENDAR_ID'
];

export default {
    mPlatformDomain: 'https://graph.facebook.com',
    mPlatformVersion: 'v3.2',

    PORT: process.env.PORT || 3000,

    APP_URL: process.env.APP_URL,
    SITE_URL: process.env.SITE_URL,
    NAME_COMPANY: process.env.NAME_COMPANY,

    PAGE_ID: process.env.PAGE_ID,
    APP_ID: process.env.APP_ID,
    APP_SECRET: process.env.APP_SECRET,
    PAGE_ACCESS_TOKEN: process.env.PAGE_ACCESS_TOKEN,
    VERIFY_TOKEN: process.env.VERIFY_TOKEN,

    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID,
    GOOGLE_LANGUAGE_CODE: process.env.GOOGLE_LANGUAGE_CODE,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
    
    CALENDAR_ID: process.env.CALENDAR_ID,
    

    get mPlatfom() {
        return this.mPlatformDomain + '/' + this.mPlatformVersion;
    },

    get webhookUrl() {
        return this.APP_URL + '/webhook';
    },

    get whitelistedDomains() {
        return [this.APP_URL, this.SITE_URL];
    },

    checkEnv: function() {
        ENV_VARS.forEach(function(key) {
            if (!process.env[key]) {
                console.log(
                    '❌ [BOT CONSILIO] WARNING: Missing the environment variable ' + key
                );
            } else {
                if (['APP_URL', 'SITE_URL'].includes(key)) {
                    const url = process.env[key];
                    if (!url.startsWith('https://')) {
                        console.log(
                            '❌ [BOT CONSILIO] WARNING: Your ' +
                key +
                ' does not begin with "https://"'
                        );
                    }
                }
            }
        });
    }
};
