import * as functions from "./functionApp";

export const functionUrl = functions.functionUrl;

// curl "$(pulumi stack output functionUrl)drone-127"