import * as pulumi from "@pulumi/pulumi";
import * as eventhub from "@pulumi/azure-nextgen/eventhub/latest";
import { appName, location, resourceGroupName } from "./common";

const eventHubNamespace = new eventhub.Namespace(`${appName}-ns`, {
    resourceGroupName: resourceGroupName,
    namespaceName: `${appName}-ns`,
    location: location,
    sku: {
        name: "Standard",
    },
});

const eventHub = new eventhub.EventHub(`${appName}-eh`, {
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    eventHubName: `${appName}-eh`,
    messageRetentionInDays: 1,
    partitionCount: 4,
}, { parent: eventHubNamespace });

export const consumerGroupName = "dronetelemetry";
const consumerGroup = new eventhub.ConsumerGroup(consumerGroupName, {
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    eventHubName: eventHub.name,
    consumerGroupName: consumerGroupName,
}, { parent: eventHub });

export const namespace = eventHubNamespace.name;
export const name = eventHub.name;

const sendEventSourceKey = new eventhub.EventHubAuthorizationRule("send", {
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    eventHubName: eventHub.name,
    authorizationRuleName: "send",
    rights: ["send"],
}, { parent: eventHub });

const listenEventSourceKey = new eventhub.EventHubAuthorizationRule("listen", {
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    eventHubName: eventHub.name,
    authorizationRuleName: "listen",
    rights: ["listen"],
}, { parent: eventHub });

const sendKeys = pulumi.all([resourceGroupName, eventHubNamespace.name, eventHub.name, sendEventSourceKey.name])
    .apply(([resourceGroupName, namespaceName, eventHubName, authorizationRuleName]) =>
        eventhub.listEventHubKeys({
            resourceGroupName,
            namespaceName,
            eventHubName,
            authorizationRuleName,
        }));
export const sendConnectionString = sendKeys.primaryConnectionString;

const listenKeys = pulumi.all([resourceGroupName, eventHubNamespace.name, eventHub.name, listenEventSourceKey.name])
    .apply(([resourceGroupName, namespaceName, eventHubName, authorizationRuleName]) =>
        eventhub.listEventHubKeys({
            resourceGroupName,
            namespaceName,
            eventHubName,
            authorizationRuleName,
        }));
export const listenConnectionString = listenKeys.primaryConnectionString;
