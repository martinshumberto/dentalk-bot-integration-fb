"use strict";
const uuid = require("uuid");
import graphAPI from "./graph-api";

/**
 * Define is undefined
 * @param {Object} obj
 */
const isDefined = obj => {
  if (typeof obj == "undefined") {
    return false;
  }
  if (!obj) {
    return false;
  }
  return obj != null;
};

/**
 * Set userid
 * @param {Number} senderID
 */
const sessionIds = new Map();
const usersMap = new Map();

const setSessionandUser = senderID => {
  if (!sessionIds.has(senderID)) {
    sessionIds.set(senderID, uuid.v4());
  }
  if (!usersMap.has(senderID)) {
    graphAPI.addUser(function(user) {
      usersMap.set(senderID, user);
    }, senderID);
  }
};

export default {
  isDefined,
  setSessionandUser,
  sessionIds,
  usersMap
};
