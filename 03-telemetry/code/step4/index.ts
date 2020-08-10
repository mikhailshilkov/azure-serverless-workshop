import "./common";
import "./cosmos";
import { namespace, sendConnectionString } from "./eventHub";
import "./functionApp";

export const eventHubNamespace = namespace;
export const eventHubSendConnectionString = sendConnectionString;
