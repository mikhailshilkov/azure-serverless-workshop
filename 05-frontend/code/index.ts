import * as functions from "./functionApp";
import * as website from "./website";
import "./websiteFiles";

export const functionUrl = functions.functionUrl;
export const siteUrl = website.url;

// curl "$(pulumi stack output functionUrl)drone-127"