import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import { appName, resourceGroupName } from "./common";

export const storageAccount = new azure.storage.Account(`${appName}fe`, {
    resourceGroupName: resourceGroupName,
    tags: {
        displayName: "Drone Front End Storage Account",
    },    
    accountTier: "Standard",
    accountReplicationType: "LRS",
    staticWebsite: {
        indexDocument: "index.html",
        error404Document: "404.html",
    },
});

export const storageAccountUrl = storageAccount.primaryWebEndpoint;

const cdnProfile = new azure.cdn.Profile("profile", {
    resourceGroupName: resourceGroupName,
    sku: "Standard_Microsoft",
});

const cdnEndpoint = new azure.cdn.Endpoint("endpoint", {
    resourceGroupName: resourceGroupName,
    profileName: cdnProfile.name,
    isHttpAllowed: false,
    origins: [{ name: "origin", hostName: storageAccount.primaryWebHost }],
    originHostHeader: storageAccount.primaryWebHost,
});

export const cdnUrl = pulumi.interpolate`https://${cdnEndpoint.hostName}`;
