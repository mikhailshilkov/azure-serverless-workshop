import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import { appName, resourceGroupName } from "./common";

const storageAccountType = {
    accountTier: "Standard",
    accountReplicationType: "LRS",
};

const droneStatusStorageAccount = new azure.storage.Account(`${appName}sa`, {
    resourceGroupName: resourceGroupName,
    tags: {
        displayName: "Drone Status Function App",
    },    
    ...storageAccountType,
});

const droneStatusAppInsights = new azure.appinsights.Insights(`${appName}-ai`, {
    resourceGroupName: resourceGroupName,
    applicationType: "web",
});

const hostingPlan = new azure.appservice.Plan(`${appName}-asp`, {
    resourceGroupName: resourceGroupName,
    kind: "FunctionApp",
    sku: { tier: "Dynamic", size: "Y1" },
});

const telemetry = new pulumi.StackReference("mikhailshilkov/iac-workshop-azure/dev");
const cosmosDatabaseName = telemetry.requireOutput("cosmosDatabaseName");
const cosmosCollectionName = telemetry.requireOutput("cosmosCollectionName");
const cosmosConnectionString = telemetry.requireOutput("cosmosConnectionString");
const cosmosEndpoint = telemetry.requireOutput("cosmosEndpoint");
const cosmosMasterKey = telemetry.requireOutput("cosmosMasterKey");

const droneStatusFunctionApp = new azure.appservice.FunctionApp(`${appName}-app`, {
    resourceGroupName: resourceGroupName,
    appServicePlanId: hostingPlan.id,
    appSettings: {
        APPINSIGHTS_INSTRUMENTATIONKEY: droneStatusAppInsights.instrumentationKey,
        APPLICATIONINSIGHTS_CONNECTION_STRING: pulumi.interpolate`InstrumentationKey=${droneStatusAppInsights.instrumentationKey}`,
        ApplicationInsightsAgent_EXTENSION_VERSION: "~2",
        COSMOSDB_CONNECTION_STRING: cosmosConnectionString,
        CosmosDBEndpoint: cosmosEndpoint,
        CosmosDBKey: cosmosMasterKey,
        COSMOSDB_DATABASE_NAME: cosmosDatabaseName,
        COSMOSDB_DATABASE_COL: cosmosCollectionName,
        WEBSITE_RUN_FROM_PACKAGE: "https://mikhailworkshop.blob.core.windows.net/zips/statusapp.zip",
    },
    storageAccountName: droneStatusStorageAccount.name,
    storageAccountAccessKey: droneStatusStorageAccount.primaryAccessKey,
    tags: {
        displayName: "Drone Status Function App",
    },
    siteConfig: {
        cors: {
            allowedOrigins: ["*"],
        },
    },
    version: "~3",
});

export const id = droneStatusFunctionApp.id;
export const appUrl = pulumi.interpolate`https://${droneStatusFunctionApp.defaultHostname}/api`;
export const key = droneStatusFunctionApp.getFunctionKeys("GetStatusFunction").default;
export const functionUrl = pulumi.interpolate`https://${droneStatusFunctionApp.defaultHostname}/api/GetStatusFunction?deviceId=`;
