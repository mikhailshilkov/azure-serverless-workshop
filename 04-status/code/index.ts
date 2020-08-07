import * as functions from "./functionApp";

export const url = functions.url;

// curl "$(pulumi stack output url)drone-127"