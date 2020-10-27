# Lab 6: Deploying Azure API Management

Currently, your frontend website retrieves data directly from a Function App.

In this lab, you will extend the `statusapp` project to add an API Management service in front of the Azure Function. You will change the website to talk to that API Management service.

Make sure you are still in the `statusapp` folder with the same files that you created in Labs 4-5.

## Step 1 &mdash; Add Extra Exports to Function App

Add several extra lines to the `functionApp.ts` file to export information required for API Management:

```ts
export const id = droneStatusFunctionApp.id;
export const appUrl = pulumi.interpolate`https://${droneStatusFunctionApp.defaultHostname}/api`;
```

> :white_check_mark: After these changes, your files should [look like this](./code/step1).

## Step 2 &mdash; Create a New File

Create a new file called `api.ts` in the same `statusapp` folder. Add the following import lines to it:

```ts
import * as pulumi from "@pulumi/pulumi";
import * as apimanagement from "@pulumi/azure-nextgen/apimanagement/latest";
import * as azure from "@pulumi/azure";
import { appName, location, resourceGroupName } from "./common";
import * as functionApp from "./functionApp";
import * as website from "./website";
```

## Step 3 &mdash; Deploy an API Management Service

Define an API Management Service at Consumption tier. Add this code to `api.ts`:

```ts
const apiManagementName = `${appName}-apim`;
const apiManagement = new apimanagement.ApiManagementService(apiManagementName, {
    resourceGroupName: resourceGroupName,
    serviceName: apiManagementName,
    location: location,
    sku: {
        name: "Consumption",
        capacity: 0,
    },
    publisherEmail: "drones@contoso.com",
    publisherName: "contoso",
});
const apiManagementId = apiManagement.id;
```

> :white_check_mark: After these changes, your files should [look like this](./code/step3).

## Step 4 &mdash; Define API Management Resources

There are quite a few resources to define in API Management. Let's add them one by one to the `api.ts` file.

API Management has version management capabilities. Define a version set, even though you will only have a single version in this lab. 

```ts
const versionSet = new apimanagement.ApiVersionSet("dronestatusversionset", {
    resourceGroupName: resourceGroupName,
    serviceName: apiManagement.name,
    versionSetId: "dronestatusversionset",
    displayName: "Drone Delivery API",
    versioningScheme: "Segment",
});
```

Add the API definition for our Drone Status functionality:

```ts
const api = new apimanagement.Api("dronedeliveryapiv1", {
    resourceGroupName: resourceGroupName,
    serviceName: apiManagementName,
    apiId: "dronedeliveryapiv1",
    displayName: "Drone Delivery API",
    description: "Drone Delivery API",
    path: "api",
    apiVersion: "v1",
    apiRevision: "1",
    apiVersionSetId: versionSet.id,
    protocols: ["https"],
});
```

Add an operation to this API:

```ts
const apiOperation = new apimanagement.ApiOperation("dronestatusGET", {
    resourceGroupName: resourceGroupName,
    serviceName: apiManagementName,
    apiId: api.name,
    operationId: "dronestatusGET",
    displayName: "Retrieve drone status",
    description: "Retrieve drone status",
    method: "GET",
    urlTemplate: "/dronestatus/{deviceid}",
    templateParameters: [
        {
            name: "deviceid",
            description: "device id",
            type: "string",
            required: true,
        },
    ],
});
```

Add a backend that points to our existing Function App:

```ts
const backend = new apimanagement.Backend("dronestatusdotnet", {
    resourceGroupName: resourceGroupName,
    serviceName: apiManagementName,
    backendId: "dronestatusdotnet",
    resourceId: pulumi.interpolate`https://management.azure.com/${functionApp.id}`,
    url: functionApp.appUrl,
    protocol: "http",
});
```

Add an API Policy that defines the behavior of the operation:

```ts
const apiPolicy = new apimanagement.ApiPolicy("policy", {
    resourceGroupName: resourceGroupName,
    serviceName: apiManagementName,
    apiId: api.name,
    policyId: "policy",
    value: pulumi.interpolate`
<policies>
    <inbound>
        <base />
        <cors allow-credentials="true">
            <allowed-origins>
                <origin>${website.storageAccountUrl}</origin>
            </allowed-origins>
            <allowed-methods><method>GET</method></allowed-methods>
            <allowed-headers><header>*</header></allowed-headers>
        </cors>
        <rewrite-uri template="GetStatusFunction?deviceId={deviceid}" />
        <set-backend-service id="apim-generated-policy" backend-id="${backend.name}" />
    </inbound>
    <backend>
        <forward-request />
    </backend>
    <outbound>
        <base />
    </outbound>
    <on-error>
        <base />
    </on-error>
</policies>`,
});
```

Note the CORS policy that allows requests from our static website. You will extend this policy in labs 7 and 8.

Add a product and a product API link:

```ts
const product = new apimanagement.Product("dronedeliveryprodapi", {
    resourceGroupName: resourceGroupName,
    serviceName: apiManagementName,
    productId: "dronedeliveryprodapi",
    displayName: "drone delivery product api",
    description: "drone delivery product api",
    terms: "terms for example product",
    subscriptionRequired: false,    
    state: "published",
});

const productApi = new azure.apimanagement.ProductApi("dronedeliveryapiv1", {
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    apiName: api.name,
    productId: product.name,
});
```

Note that the product API is defined using a resource from the Terraform-based Azure provider due a limitation in the current version of the Azure NextGen provider.

Finally, export the API URL:

```ts
export const apiUrl = pulumi.interpolate`https://${apiManagementName}.azure-api.net/${api.path}/v1/dronestatus/`;
```

> :white_check_mark: After these changes, your files should [look like this](./code/step4).

## Step 5 &mdash; Point Your Frontend Site to API Management

Edit the `websiteFiles.ts`. First, add an extra import:

```ts
import * as api from "./api";
```

Then, replace the `API_URL` assignment lines with

```ts
    const asset = api.apiUrl
        .apply(url => rawText.replace("[API_URL]", url))
        .apply(text => new pulumi.asset.StringAsset(text));
```

> :white_check_mark: After these changes, your files should [look like this](./code/step5).

## Step 6 &mdash; Deploy and Test the Stack

Deploy the stack

```bash
$ pulumi up
...
Updating (dev):
     Type                                                        Name                                            Status
     pulumi:pulumi:Stack                                         workshop-nextgen-status-dev                                        
 +   └─ azure-nextgen:apimanagement/latest:ApiManagementService  status-apim                                     created
 +   ├─ azure-nextgen:apimanagement/latest:Product               dronedeliveryprodapi                            created    
 +   ├─ azure-nextgen:apimanagement/latest:ApiVersionSet         dronestatusversionset                           created    
 +   ├─ azure-nextgen:apimanagement/latest:Backend               dronestatusdotnet                               created    
 +   ├─ azure-nextgen:apimanagement/latest:Api                   dronedeliveryapiv1                              created    
     ├─ azure:storage:Account                                    statusfe                                                                
 +-  │  ├─ azure:storage:Blob                                    component---src-pages-index-tsx-5b72260.js      replaced 
 +-  │  └─ azure:storage:Blob                                    component---src-pages-index-tsx-5b72260.js.map  replaced 
 +   ├─ azure:apimanagement:ProductApi                           dronedeliveryapiv1                              created    
 +   ├─ azure-nextgen:apimanagement/latest:ApiPolicy             policy                                          created    
 +   └─ azure-nextgen:apimanagement/latest:ApiOperation          dronestatusGET                                  created     
 
Outputs:
    functionUrl      : "https://status-app471111f49.azurewebsites.net/api/GetStatusFunction?deviceId="
    storageAccountUrl: "https://statusfe2867cccd.z6.web.core.windows.net/"

Resources:
    + 8 created
    +-2 replaced
    10 changes. 26 unchanged
```

Navigate to the `storageAccountUrl` in a browser, hit refresh, and make sure that the app still works. You may turn on a network tab in browser developer tools and see that the request comes to API Management instead of Function Apps.

## Next Steps

Congratulations! :tada: You have successfully provisioned API Management resources that stand in front of Azure Functions to provide API for a static website.

Next, you will add an Azure CDN service in front of the Storage Account.

[Get Started with Lab 7](../07-cdn/README.md)
