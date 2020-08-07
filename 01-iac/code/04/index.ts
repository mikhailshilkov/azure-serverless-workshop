import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";

const resourceGroup = new azure.core.ResourceGroup("my-group");

const storageAccount = new azure.storage.Account("mystorage", {
    resourceGroupName: resourceGroup.name,
    accountReplicationType: "LRS",
    accountTier: "Standard",
});

const container = new azure.storage.Container("mycontainer", {
    name: "files",
    storageAccountName: storageAccount.name,
});

export const accountName = storageAccount.name;
