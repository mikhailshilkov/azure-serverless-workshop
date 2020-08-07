import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import { appName, resourceGroupName } from "./common";
import * as cosmos from "./cosmos";
import * as eventHub from "./eventHub";

const storageAccountType = {
    accountTier: "Standard",
    accountReplicationType: "LRS",
};

// Drone Telemetry storage account
const droneTelemetryStorageAccount = new azure.storage.Account(`${appName}sa`, {
    resourceGroupName: resourceGroupName,
    tags: {
        displayName: "Drone Telemetry Function App Storage",
    },    
    ...storageAccountType,
});

// Drone Telemetry DLQ storage account
const droneTelemetryDeadLetterStorageQueueAccount = new azure.storage.Account(`${appName}dlq`, {
    resourceGroupName: resourceGroupName,
    tags: {
        displayName: "Drone Telemetry DLQ",
    },    
    ...storageAccountType,
});

const droneTelemetryAppInsights = new azure.appinsights.Insights(`${appName}-ai`, {
    resourceGroupName: resourceGroupName,
    applicationType: "web",
});

const hostingPlan = new azure.appservice.Plan(`${appName}-asp`, {
    resourceGroupName: resourceGroupName,
    kind: "FunctionApp",
    sku: { tier: "Dynamic", size: "Y1" },
});

const droneTelemetryFunctionApp = new azure.appservice.FunctionApp(`${appName}-app`, {
    resourceGroupName: resourceGroupName,
    appServicePlanId: hostingPlan.id,
    appSettings: {
        APPINSIGHTS_INSTRUMENTATIONKEY: droneTelemetryAppInsights.instrumentationKey,
        APPLICATIONINSIGHTS_CONNECTION_STRING: pulumi.interpolate`InstrumentationKey=${droneTelemetryAppInsights.instrumentationKey}`,
        ApplicationInsightsAgent_EXTENSION_VERSION: "~2",
        COSMOSDB_CONNECTION_STRING: cosmos.connectionString,
        CosmosDBEndpoint: cosmos.endpoint,
        CosmosDBKey: cosmos.masterKey,
        COSMOSDB_DATABASE_NAME: cosmos.databaseName,
        COSMOSDB_DATABASE_COL: cosmos.collectionName,
        EventHubConnection: eventHub.listenConnectionString,
        EventHubConsumerGroup: eventHub.consumerGroupName,
        EventHubName: eventHub.name,
        DeadLetterStorage: droneTelemetryDeadLetterStorageQueueAccount.primaryConnectionString,
        WEBSITE_RUN_FROM_PACKAGE: "https://mikhailworkshop.blob.core.windows.net/zips/telemetryapp.zip",
    },
    storageAccountName: droneTelemetryStorageAccount.name,
    storageAccountAccessKey: droneTelemetryStorageAccount.primaryAccessKey,
    tags: {
        displayName: "Drone Telemetry Function App",
    },
    version: "~3",
});
