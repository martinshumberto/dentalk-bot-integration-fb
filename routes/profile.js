"use strict";
import webhook from "../app/webhook";

export default function(app) {
  app.route("/profile").get(webhook.setProfile);
}
