'use strict';
const uuid = require('uuid');
import graphAPI from './graph-api';

/**
 * Define is undefined
 * @param {Object} obj
 */
const isDefined = obj => {
    if (typeof obj == 'undefined') {
        return false;
    }
    if (!obj) {
        return false;
    }
    return obj != null;
};

/**
 * Resolve after x time
 * @param {*} x 
 */
const resolveAfterXSeconds = async (x) => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(x);
        }, x * 1000);
    });
};

/**
 * Set userid
 * @param {Number} senderID
 */
const sessionIds = new Map();
const usersMap = new Map();

const setSessionandUser = senderID => {
    return new Promise(function(resolve, reject) {
        if (!sessionIds.has(senderID)) {
            sessionIds.set(senderID, uuid.v4());
        }
        if (!usersMap.has(senderID)) {
            try {
                graphAPI.addUser(function(user) {
                    resolve(usersMap.set(senderID, user));
                }, senderID);
            } catch (err) {
                reject(err);
            }
        }
    });
};

export default {
    isDefined,
    setSessionandUser,
    resolveAfterXSeconds,
    sessionIds,
    usersMap
};
