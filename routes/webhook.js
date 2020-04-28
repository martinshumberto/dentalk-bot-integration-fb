"use strict";
import webhook from "../app/webhook";

export default function(app) {
  app.route("/webhook").get(webhook.verifyWebhook);
  app.route("/webhook").post(webhook.messageHandler);
}
