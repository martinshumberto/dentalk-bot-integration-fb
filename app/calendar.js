'use strict';
import config from '../config/variables';
import moment from 'moment';
import { google } from 'googleapis';

const serviceAccountAuth = new google.auth.JWT({
    email: config.GOOGLE_CLIENT_EMAIL,
    key: config.GOOGLE_PRIVATE_KEY,
    scopes: 'https://www.googleapis.com/auth/calendar'
});

const calendar = google.calendar('v3');
const timeZoneOffset = '-03:00';

const createCalendarEvent = (dateTimeStart, dateTimeEnd, userDB) => {
    return new Promise((resolve, reject) => {
        calendar.events.list({
            auth: serviceAccountAuth,
            calendarId: config.CALENDAR_ID,
            timeMin: dateTimeStart.toISOString(),
            timeMax: dateTimeEnd.toISOString()
        }, (err, calendarResponse) => {
            if (err || calendarResponse.data.items.length > 0) {
                reject(err || new Error('O horário solicitado entra em conflito com outro compromisso.'));
            } else {
                calendar.events.insert({ auth: serviceAccountAuth,
                    calendarId: config.CALENDAR_ID,
                    resource: {
                        summary: `${userDB[0].first_name}`,
                        description: `Nome do paciente: ${userDB[0].first_name} ${userDB[0].last_name} \nTelefone: ${userDB[0].phone} ${userDB[0].phone} \nE-mail: ${userDB[0].email} ${userDB[0].email} \n\nAgendamento realizado em: Facebook - ${moment().format('DD/MM/YYYY HH:mm')}`,
                        start: {dateTime: dateTimeStart},
                        end: {dateTime: dateTimeEnd}
                    }
                }, (err, event) => {
                    err ? reject(err) : resolve(event);
                }
                );
            }
        });
    });
};
const currentlyOpen = () => {
    let date = new Date();
    date.setHours(date.getHours() + parseInt(timeZoneOffset.split(':')[0]));
    date.setMinutes(date.getMinutes() + parseInt(timeZoneOffset.split(':')[0][0] + timeZoneOffset.split(':')[1]));

    return date.getDay() >= 1 &&
        date.getDay() <= 5 &&
        date.getHours() >= 8 &&
        date.getHours() <= 18;
};

export default { createCalendarEvent, currentlyOpen };