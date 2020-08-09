import "./api";
import "./functionApp";
import * as website from "./website";
import "./websiteFiles";

export const siteUrl = website.url;

// curl "$(pulumi stack output functionUrl)drone-127"