import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";

const resourceGroup = new azure.core.ResourceGroup("my-group");

const storageAccount = new azure.storage.Account("storage", {
    resourceGroupName: resourceGroup.name,
    accountReplicationType: "LRS",
    accountTier: "Standard",
});

const plan = new azure.appservice.Plan("asp", {
    resourceGroupName: resourceGroup.name,
    kind: "FunctionApp",
    sku: {
        tier: "Dynamic",
        size: "Y1",
    },
});

const container = new azure.storage.Container("zips", {
    storageAccountName: storageAccount.name,
    containerAccessType: "private",
});

const blob = new azure.storage.Blob("zip", {
    storageAccountName: storageAccount.name,
    storageContainerName: container.name,
    type: "Block",
    source: new pulumi.asset.FileArchive("./functions"),
});

const codeBlobUrl = azure.storage.signedBlobReadUrl(blob, storageAccount);

const app = new azure.appservice.FunctionApp("fa", {
    resourceGroupName: resourceGroup.name,
    appServicePlanId: plan.id,
    storageAccountName: storageAccount.name,
    storageAccountAccessKey: storageAccount.primaryAccessKey,
    version: "~3",
    appSettings: {
        FUNCTIONS_WORKER_RUNTIME: "node",
        WEBSITE_NODE_DEFAULT_VERSION: "10.14.1",
        WEBSITE_RUN_FROM_PACKAGE: codeBlobUrl,
    }
});

export const endpoint = pulumi.interpolate`https://${app.defaultHostname}/api/hello`;
