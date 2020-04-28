import config from "../config/variables";
import utils from "./utils";
import profile from "./profile";
import receive from "./receive";
import graphApi from "./graph-api";

const verifyWebhook = async (req, res, next) => {
  try {
    const mode = req.query["hub.mode"];
    const challenge = req.query["hub.challenge"];
    const token = req.query["hub.verify_token"];

    if (mode && token) {
      if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
        console.log("⚡️ [BOT CONSILIO] Verify token passed.");
        res.status(200).send(challenge);
      } else {
        console.log("❌ [BOT CONSILIO] Webhook is not verified.");
        res.status(403);
      }
    }
  } catch (error) {
    console.log("❌ [BOT CONSILIO] Error in verify webhook ", error);
  }
};

const messageHandler = async (req, res, next) => {
  try {
    let body = req.body;

    if (body.object === "page") {
      body.entry.forEach(function(pageEntry) {
        var pageID = pageEntry.id;
        var timeOfEvent = pageEntry.time;

        let hookEvent = pageEntry.messaging[0];
        let senderPsid = hookEvent.sender.id;

        utils.setSessionandUser(senderPsid);

        pageEntry.messaging.forEach(function(messagingEvent) {
          if (messagingEvent.optin) {
            receive.receivedAuthentication(messagingEvent);
          } else if (messagingEvent.message) {
            receive.receivedMessage(messagingEvent);
          } else if (messagingEvent.delivery) {
            receive.receivedDeliveryConfirmation(messagingEvent); // listening for all messages
          } else if (messagingEvent.postback) {
            receive.receivedPostback(messagingEvent); // usually a click on a botton, menu, structured message
          } else if (messagingEvent.read) {
            receive.receivedMessageRead(messagingEvent);
          } else if (messagingEvent.account_linking) {
            receive.receivedAccountLink(messagingEvent);
          } else {
            console.log(
              "❌ [BOT CONSILIO] Webhook received unknown messaging. Event: ",
              messagingEvent
            );
          }
        });
      });

      res.status(200).send("⚡️ [BOT CONSILIO] Event receiving.");
    }
  } catch (error) {
    console.log("❌ [BOT CONSILIO] Error in post webhook. ", error);
  }
};

const setProfile = async (req, res, next) => {
  let token = req.query["verify_token"];
  let mode = req.query["mode"];

  if (!config.APP_URL.startsWith("https://")) {
    res
      .status(200)
      .send("❌ [BOT CONSILIO] ERROR - Need a proper API_URL in the .env file");
  }

  if (mode && token) {
    if (token === config.VERIFY_TOKEN) {
      if (mode == "webhook" || mode == "all") {
        profile.setWebhook();
        res.write(
          `<p>Set app ${config.APP_ID} call to ${config.APP_URL}/webhook </p>`
        );
      }
      if (mode == "profile" || mode == "all") {
        profile.setThread();
        res.write(`<p>Set Messenger Profile of Page ${config.PAGE_ID}</p>`);
      }
      if (mode == "nlp" || mode == "all") {
        graphApi.callNLPConfigsAPI();
        res.write(`<p>Enable Built-in NLP for Page ${config.PAGE_ID}</p>`);
      }
      if (mode == "domains" || mode == "all") {
        profile.setWhitelistedDomains();
        res.write(`<p>Whitelisting domains: ${config.whitelistedDomains}</p>`);
      }
      if (mode == "private-reply") {
        profile.setPageFeedWebhook();
        res.write(`<p>Set Page Feed Webhook for Private Replies.</p>`);
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
