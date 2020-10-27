import * as azure from "@pulumi/azure";
import * as pulumi from "@pulumi/pulumi";
import * as cdn from "@pulumi/azure-nextgen/cdn/latest";
import { appName, location, resourceGroupName } from "./common";

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

const cdnProfile = new cdn.Profile("profile", {
    resourceGroupName: resourceGroupName,
    profileName: `${appName}-cdn`,
    location: location,
    sku: { name: "Standard_Microsoft" },
});

const cdnEndpoint = new cdn.Endpoint("endpoint", {
    resourceGroupName: resourceGroupName,
    profileName: cdnProfile.name,
    endpointName: `${appName}-endpoint`,
    location: location,
    isHttpAllowed: false,
    origins: [{ name: "origin", hostName: storageAccount.primaryWebHost }],
    originHostHeader: storageAccount.primaryWebHost,
});

export const cdnUrl = pulumi.interpolate`https://${cdnEndpoint.hostName}`;
