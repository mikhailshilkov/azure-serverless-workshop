import * as pulumi from "@pulumi/pulumi";
import * as insights from "@pulumi/azure-nextgen/insights/latest";
import * as storage from "@pulumi/azure-nextgen/storage/latest";
import * as web from "@pulumi/azure-nextgen/web/latest";
import { appName, location, resourceGroupName } from "./common";

const droneStatusStorageAccount = new storage.StorageAccount(`${appName}sa`, {
    resourceGroupName: resourceGroupName,
    location: location,
    accountName: `${appName}sa`,
    sku: {
        name: "Standard_LRS",
    },
    kind: "StorageV2",
    tags: {
        displayName: "Drone Status Function App",
    },    
});

function getStorageConnectionString(account: storage.StorageAccount): pulumi.Output<string> {
    const keys = pulumi.all([resourceGroupName, account.name]).apply(([resourceGroupName, accountName]) =>
        storage.listStorageAccountKeys({ resourceGroupName, accountName }));
    const key = keys.keys[0].value;
    return pulumi.interpolate`DefaultEndpointsProtocol=https;AccountName=${account.name};AccountKey=${key}`;
}

const droneStatusAppInsights = new insights.Component(`${appName}-ai`, {
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

const telemetry = new pulumi.StackReference("mikhailshilkov/telemetry-nextgen/dev");
const cosmosDatabaseName = telemetry.requireOutput("cosmosDatabaseName");
const cosmosCollectionName = telemetry.requireOutput("cosmosCollectionName");
const cosmosConnectionString = telemetry.requireOutput("cosmosConnectionString");
const cosmosEndpoint = telemetry.requireOutput("cosmosEndpoint");
const cosmosMasterKey = telemetry.requireOutput("cosmosMasterKey");

const droneStatusFunctionApp = new web.WebApp(`${appName}-app`, {
    resourceGroupName: resourceGroupName,
    name: `${appName}-app123`,
    location: location,
    serverFarmId: hostingPlan.id,
    kind: "functionapp",
    siteConfig: {
        appSettings: [
            { name: "APPINSIGHTS_INSTRUMENTATIONKEY", value: droneStatusAppInsights.instrumentationKey },
            { name: "APPLICATIONINSIGHTS_CONNECTION_STRING", value: pulumi.interpolate`InstrumentationKey=${droneStatusAppInsights.instrumentationKey}` },
            { name: "ApplicationInsightsAgent_EXTENSION_VERSION", value: "~2" },
            { name: "AzureWebJobsStorage", value: getStorageConnectionString(droneStatusStorageAccount) },
            { name: "COSMOSDB_CONNECTION_STRING", value: cosmosConnectionString },
            { name: "CosmosDBEndpoint", value: cosmosEndpoint },
            { name: "CosmosDBKey", value: cosmosMasterKey },
            { name: "COSMOSDB_DATABASE_NAME", value: cosmosDatabaseName },
            { name: "COSMOSDB_DATABASE_COL", value: cosmosCollectionName },
            { name: "FUNCTIONS_EXTENSION_VERSION", value: "~3" },            
            { name: "FUNCTIONS_WORKER_RUNTIME", value: "dotnet" },
            { name: "WEBSITE_NODE_DEFAULT_VERSION", value: "10.14.1" },
            { name: "WEBSITE_RUN_FROM_PACKAGE", value: "https://mikhailworkshop.blob.core.windows.net/zips/statusapp.zip" },
        ],
        cors: {
            allowedOrigins: ["*"],
        },
    },
    tags: {
        displayName: "Drone Telemetry Function App",
    },
});

export const functionUrl = pulumi.interpolate`https://${droneStatusFunctionApp.defaultHostName}/api/GetStatusFunction?deviceId=`;
