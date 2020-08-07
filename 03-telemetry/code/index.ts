import "./common";
import "./cosmos";
import { namespace, sendConnectionString } from "./eventHub";
import "./functionApp";

export const eventHubNamespace = namespace;
export const eventHubSendConnectionString = sendConnectionString;

// export EH_NAMESPACE=$(pulumi stack output eventHubNamespace) 
// export EVENT_HUB_CONNECTION_STRING="$(pulumi stack output eventHubSendConnectionString)"
// dotnet TelemetryGenerator/Serverless.Simulator.dll 