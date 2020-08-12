import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import * as azuread from "@pulumi/azuread";
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

export const tenantId = pulumi.output(azure.core.getClientConfig()).tenantId;
const apiAppName=`${appName}-api`;

const apiApp = new azuread.Application(apiAppName, {
    name: apiAppName,
    oauth2AllowImplicitFlow: true,
    replyUrls: [storageAccountUrl, cdnUrl],
    identifierUris: [`http://${apiAppName}`],
    appRoles: [{  
        allowedMemberTypes: [ "User" ], 
        description:"Access to device status", 
        displayName:"Get Device Status", 
        isEnabled:true,
        value: "GetStatus",
    }],
    requiredResourceAccesses: [{
        resourceAppId: "00000003-0000-0000-c000-000000000000",
        resourceAccesses: [ { id: "e1fe6dd8-ba31-4d61-89e7-88639da4683d", type: "Scope" } ],
    }],
});
export const applicationId = apiApp.applicationId;
