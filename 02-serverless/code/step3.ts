import * as pulumi from "@pulumi/pulumi";
import * as resources from "@pulumi/azure-nextgen/resources/latest";
import * as storage from "@pulumi/azure-nextgen/storage/latest";
import * as web from "@pulumi/azure-nextgen/web/latest";

const resourceGroup = new resources.ResourceGroup("my-group", {
    resourceGroupName: "my-group",
    location: "westus",
});

const storageAccount = new storage.StorageAccount("mystorage", {
    resourceGroupName: resourceGroup.name,
    accountName: "myuniquename",
    location: resourceGroup.location,
    sku: {
        name: "Standard_LRS",
    },
    kind: "StorageV2",
});

const plan = new web.AppServicePlan("asp", {
    resourceGroupName: resourceGroup.name,
    name: "consumption-plan",
    location: resourceGroup.location,
    sku: {
        name: "Y1",
        tier: "Dynamic",
    },
});

const storageAccountKeys = pulumi.all([resourceGroup.name, storageAccount.name]).apply(([resourceGroupName, accountName]) =>
    storage.listStorageAccountKeys({ resourceGroupName, accountName }));

const primaryStorageKey = storageAccountKeys.keys[0].value;
const storageConnectionString = pulumi.interpolate`DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${primaryStorageKey}`;
