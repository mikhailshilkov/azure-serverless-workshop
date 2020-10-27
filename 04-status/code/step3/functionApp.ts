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

const telemetry = new pulumi.StackReference("mikhailshilkov/telemetry/dev");
const cosmosDatabaseName = telemetry.requireOutput("cosmosDatabaseName");
const cosmosCollectionName = telemetry.requireOutput("cosmosCollectionName");
const cosmosConnectionString = telemetry.requireOutput("cosmosConnectionString");
const cosmosEndpoint = telemetry.requireOutput("cosmosEndpoint");
const cosmosMasterKey = telemetry.requireOutput("cosmosMasterKey");
