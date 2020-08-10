import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import { appName, resourceGroupName } from "./common";

const droneStatusStorageAccount = new azure.storage.Account(`${appName}sa`, {
    resourceGroupName: resourceGroupName,
    tags: {
        displayName: "Drone Status Function App",
    },    
    accountTier: "Standard",
    accountReplicationType: "LRS",
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

const telemetry = new pulumi.StackReference("yourpulumiuser/telemetry/dev");
const cosmosDatabaseName = telemetry.requireOutput("cosmosDatabaseName");
const cosmosCollectionName = telemetry.requireOutput("cosmosCollectionName");
const cosmosConnectionString = telemetry.requireOutput("cosmosConnectionString");
const cosmosEndpoint = telemetry.requireOutput("cosmosEndpoint");
const cosmosMasterKey = telemetry.requireOutput("cosmosMasterKey");
