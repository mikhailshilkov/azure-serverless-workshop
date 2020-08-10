import * as azure from "@pulumi/azure";
import { appName, resourceGroupName } from "./common";

const eventHubNamespace = new azure.eventhub.EventHubNamespace(`${appName}-ns`, {
    resourceGroupName: resourceGroupName,
    sku: "Standard",    
});

const eventHub = new azure.eventhub.EventHub(`${appName}-eh`, {
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    messageRetention: 1,
    partitionCount: 4,
}, { parent: eventHubNamespace });

export const consumerGroupName = "dronetelemetry";
const consumerGroup = new azure.eventhub.ConsumerGroup(consumerGroupName, {
    name: consumerGroupName,
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    eventhubName: eventHub.name,
}, { parent: eventHub });

const sendEventSourceKey = new azure.eventhub.AuthorizationRule("send", {
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    eventhubName: eventHub.name,
    send: true,
}, { parent: eventHub });

const listenEventSourceKey = new azure.eventhub.AuthorizationRule("listen", {
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    eventhubName: eventHub.name,
    listen: true,
}, { parent: eventHub });

export const namespace = eventHubNamespace.name;
export const name = eventHub.name;
export const listenConnectionString = listenEventSourceKey.primaryConnectionString;
export const sendConnectionString = sendEventSourceKey.primaryConnectionString;
