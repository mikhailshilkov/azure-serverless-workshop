import * as pulumi from "@pulumi/pulumi";
import * as insights from "@pulumi/azure-nextgen/insights/latest";
import * as storage from "@pulumi/azure-nextgen/storage/latest";
import * as web from "@pulumi/azure-nextgen/web/latest";
import { appName, location, resourceGroupName } from "./common";
import * as cosmos from "./cosmos";
import * as eventHub from "./eventHub";

const storageAccountType = {
    resourceGroupName: resourceGroupName,
    location: location,
    sku: {
        name: "Standard_LRS",
    },
    kind: "StorageV2",
};

function getStorageConnectionString(account: storage.StorageAccount): pulumi.Output<string> {
    const keys = pulumi.all([resourceGroupName, account.name]).apply(([resourceGroupName, accountName]) =>
        storage.listStorageAccountKeys({ resourceGroupName, accountName }));
    const key = keys.keys[0].value;
    return pulumi.interpolate`DefaultEndpointsProtocol=https;AccountName=${account.name};AccountKey=${key}`;
}

// Drone Telemetry storage account
const droneTelemetryStorageAccount = new storage.StorageAccount(`${appName}sa`, {
    accountName: `${appName}funcappsa`,
    tags: {
        displayName: "Drone Telemetry Function App Storage",
    },    
    ...storageAccountType,
});

// Drone Telemetry DLQ storage account
const droneTelemetryDeadLetterStorageQueueAccount = new storage.StorageAccount(`${appName}dlq`, {
    accountName: `${appName}dlqsa`,
    tags: {
        displayName: "Drone Telemetry DLQ Storage",
    },    
    ...storageAccountType,
});

const droneTelemetryAppInsights = new insights.Component(`${appName}-ai`, {
    resourceGroupName: resourceGroupName,
    resourceName: `${appName}-ai`,
    location: location,
    applicationType: "web",
    kind: "web",
});

const hostingPlan = new web.AppServicePlan(`${appName}-asp`, {
    resourceGroupName: resourceGroupName,
    name: `${appName}-asp`,
    location: location,
    sku: {
        name: "Y1",
        tier: "Dynamic",
    },
});

const droneTelemetryFunctionApp = new web.WebApp(`${appName}-app`, {
    resourceGroupName: resourceGroupName,
    name: "myappdf78s",
    location: location,
    serverFarmId: hostingPlan.id,
    kind: "functionapp",
    siteConfig: {
        appSettings: [
            { name: "APPINSIGHTS_INSTRUMENTATIONKEY", value: droneTelemetryAppInsights.instrumentationKey },
            { name: "APPLICATIONINSIGHTS_CONNECTION_STRING", value: pulumi.interpolate`InstrumentationKey=${droneTelemetryAppInsights.instrumentationKey}` },
            { name: "ApplicationInsightsAgent_EXTENSION_VERSION", value: "~2" },
            { name: "AzureWebJobsStorage", value: getStorageConnectionString(droneTelemetryStorageAccount) },
            { name: "COSMOSDB_CONNECTION_STRING", value: cosmos.connectionString },
            { name: "CosmosDBEndpoint", value: cosmos.endpoint },
            { name: "CosmosDBKey", value: cosmos.masterKey },
            { name: "COSMOSDB_DATABASE_NAME", value: cosmos.databaseName },
            { name: "COSMOSDB_DATABASE_COL", value: cosmos.collectionName },
            { name: "DeadLetterStorage", value: getStorageConnectionString(droneTelemetryDeadLetterStorageQueueAccount) },
            { name: "EventHubConnection", value: eventHub.listenConnectionString },
            { name: "EventHubConsumerGroup", value: eventHub.consumerGroupName },
            { name: "EventHubName", value: eventHub.name },
            { name: "FUNCTIONS_EXTENSION_VERSION", value: "~3" },            
            { name: "FUNCTIONS_WORKER_RUNTIME", value: "dotnet" },
            { name: "WEBSITE_NODE_DEFAULT_VERSION", value: "10.14.1" },
            { name: "WEBSITE_RUN_FROM_PACKAGE", value: "https://mikhailworkshop.blob.core.windows.net/zips/telemetryapp.zip" },
        ]    
    },
    tags: {
        displayName: "Drone Telemetry Function App",
    },
});
