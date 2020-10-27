# Lab 7: Deploying Website Behind Azure CDN

Currently, your frontend website is served directly from the Storage Account. You can improve the performance of serving static web files for users around the world using a Content Delivery Network (CDN).

In this lab, you will extend the `statusapp` project to add an Azure CDN service in front of the Storage Account.

Make sure you are still in the `statusapp` folder with the same files that you created in Labs 4-6.

## Step 1 &mdash; Add Azure CDN Profile and Endpoint

Extend the existing `website.ts` file with these resources:

```ts
import * as pulumi from "@pulumi/pulumi";
import * as cdn from "@pulumi/azure-nextgen/cdn/latest";
import { appName, location, resourceGroupName } from "./common";

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
```

Adjust the `endpointName` property value to a globally unique string.

Also, export the CDN URL from the `index.ts` file:

```ts
export const cdnUrl = website.cdnUrl;
```

> :white_check_mark: After these changes, your files should [look like this](./code/step1).

## Step 2 &mdash; Add the CDN Endpoint to API CORS

Open the file `api.ts`, find the `ApiPolicy` resource and add a new line to its CORS definitions node:

```ts
const apiPolicy = new azure.apimanagement.ApiPolicy("policy", {
...
            <allowed-origins>
                <origin>${website.storageAccountUrl}</origin>
                <origin>${website.cdnUrl}</origin>
            </allowed-origins>
...
```

> :white_check_mark: After these changes, your files should [look like this](./code/step2).

## Step 3 &mdash; Deploy and Test the Stack

Deploy the stack

```bash
$ pulumi up
...
Updating (dev):
     Type                                             Name             Status      Info
     pulumi:pulumi:Stack                              statusapp-dev              
 +   ├─ azure-nextgen:cdn/latest:Profile              profile          created
 +   ├─ azure-nextgen:cdn/latest:Endpoint             endpoint         created     
 ~   └─ azure-nextgen:apimanagement/latest:ApiPolicy  policy           updated    [diff: ~value]
 
Outputs:
  + cdnUrl           : "https://endpoint0962acd7.azureedge.net"
    functionUrl      : "https://status-app47000f49.azurewebsites.net/api/GetStatusFunction?deviceId="
    storageAccountUrl: "https://statusfe1867bccd.z6.web.core.windows.net/"

Resources:
    + 2 created
    ~ 1 updated
    3 changes. 35 unchanged
```

Navigate to the `cdnUrl` in a browser and make sure that the app still works. Note that CDN propagation may take up to several minutes, so if you get 404s, wait a bit and retry.

## Next Steps

Congratulations! :tada: You have successfully provisioned Azure CDN resources that stand in front of Azure Storage to provide users with faster static websites.

Next, you will enable Azure Active Directory OAuth2 authentication in the status website.

[Get Started with Lab 8](../08-aad/README.md)
