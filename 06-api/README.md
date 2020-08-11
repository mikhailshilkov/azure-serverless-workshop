# Deploying Azure API Management

Currently, your frontend website retrieves data directly from a Function App.

In this lab, you will extend the `statusapp` stack to add an API Management service in front of the Azure Function. You will change the website to talk to that API Management service.

Make sure you are still in the `statusapp` folder with the same files that you created in Labs 4-5.

## Step 1 &mdash; Add Extra Exports to Function App

Add several extra lines to the `functionApp.ts` file to export information required for API Management:

```ts
export const id = droneStatusFunctionApp.id;
export const appUrl = pulumi.interpolate`https://${droneStatusFunctionApp.defaultHostname}/api`;
export const key = droneStatusFunctionApp.getFunctionKeys("GetStatusFunction").default;
export const functionUrl = pulumi.interpolate`https://${droneStatusFunctionApp.defaultHostname}/api/GetStatusFunction?deviceId=`;
```

> :white_check_mark: After these changes, your files should [look like this](./code/step1).

## Step 2 &mdash; Create a New File

Create a new file called `api.ts` in the same `statusapp` folder. Add the following import lines to it:

```ts
import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import { appName, resourceGroupId, resourceGroupName } from "./common";
import * as functionApp from "./functionApp";
import * as website from "./website";
```

## Step 3 &mdash; Deploy an API Management Service

As of today, there is a bug in the Pulumi's Azure provider that prevents provisioning an API Management Service at Consumption tier. When this bug is fixed, the following code would create a service:

```ts
// This will work when this issue is fixed:
// https://github.com/terraform-providers/terraform-provider-azurerm/issues/6730
//
// const apiManagement = new azure.apimanagement.Service(apiManagementName, {
//     resourceGroupName: resourceGroupName,
//     skuName: "Consumption_0",
//     publisherEmail: "drones@contoso.com",
//     publisherName: "contoso",
// });
//const apiManagementId = apiManagement.id;
```

To work around this issue, deploy the service with an inline ARM Template. Add this code to `api.ts`:

```ts
const apiManagementName = `${appName}-apim`;
const arm = `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [{
        "apiVersion": "2019-12-01",
        "name": "${apiManagementName}",
        "type": "Microsoft.ApiManagement/service",
        "location": "westeurope",
        "sku": {
            "name": "Consumption",
            "capacity": "0"
        },
        "properties": {
            "publisherEmail": "drones@contoso.com",
            "publisherName": "contoso"
        }
    }]
}`;

const template = new azure.core.TemplateDeployment(`${appName}-at`, {
    resourceGroupName: resourceGroupName,
    templateBody: arm,
    deploymentMode: "Incremental",
});
const apiManagementId = `${resourceGroupId}/providers/Microsoft.ApiManagement/service/${apiManagementName}`;
```

> :white_check_mark: After these changes, your files should [look like this](./code/step3).

## Step 4 &mdash; Define API Management Resources

There are quite a few resources to define in API Management. Let's add them one by one to the `api.ts` file.

API Management has version management capabilities. Define a version set, even though you will only have a single version in this lab. 

```ts
const versionSet = new azure.apimanagement.ApiVersionSet("dronestatusversionset", {
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    name: "dronestatusversionset",
    displayName: "Drone Delivery API",
    versioningScheme: "Segment",
}, { dependsOn: template });
```

Add the API definition for our Drone Status functionality:

```ts
const api = new azure.apimanagement.Api("dronedeliveryapiv1", {
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    displayName: "Drone Delivery API",
    description: "Drone Delivery API",
    path: "api",
    version: "v1",
    revision: "1",
    versionSetId: versionSet.id,
    protocols: ["https"],
});
```

Add an operation to this API:

```ts
const apiOperation = new azure.apimanagement.ApiOperation("dronestatusGET", {
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    apiName: api.name,
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

Add a named config value to store the Function Key to authorize in Azure Functions:

```ts
const apiValueFunctionCode = new azure.apimanagement.NamedValue("getstatusfunctionapp-code", {
    name: "getstatusfunctionapp-code",
    displayName: "getstatusfunctionapp-code",
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    tags: ["key", "function", "code"],
    secret: true,
    value: functionApp.key,
}, { dependsOn: template });
```

Add a backend that points to our existing Function App:

```ts
const backend = new azure.apimanagement.Backend("dronestatusdotnet", {
    name: "dronestatusdotnet",
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    resourceId: pulumi.interpolate`https://management.azure.com/${functionApp.id}`,
    credentials: {
        query: {
            code: pulumi.interpolate`{{${apiValueFunctionCode.name}}}`,
        },
    },
    url: functionApp.appUrl,
    protocol: "http",
});
```

Add an API Policy that defines the behavior of the operation:

```ts
const apiPolicy = new azure.apimanagement.ApiPolicy("policy", {
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    apiName: api.name,
    xmlContent: pulumi.interpolate`
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
const product = new azure.apimanagement.Product("dronedeliveryprodapi", {
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    productId: "dronedeliveryprodapi",
    displayName: "drone delivery product api",
    description: "drone delivery product api",
    terms: "terms for example product",
    subscriptionRequired: false,
    published: true,
}, { dependsOn: template });

const productApi = new azure.apimanagement.ProductApi("dronedeliveryapiv1", {
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    apiName: api.name,
    productId: product.productId,
});
```

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
     Type                                  Name                                                         Status       Info
     pulumi:pulumi:Stack                   statusapp-dev                                                             
 +   ├─ azure:core:TemplateDeployment      status-at                                                    created      
 +   ├─ azure:apimanagement:NamedValue     getstatusfunctionapp-code                                    created      
 +   ├─ azure:apimanagement:ApiVersionSet  dronestatusversionset                                        created      
 +   ├─ azure:apimanagement:Product        dronedeliveryprodapi                                         created      
 +   ├─ azure:apimanagement:Backend        dronestatusdotnet                                            created      
 +   ├─ azure:apimanagement:Api            dronedeliveryapiv1                                           created      
     ├─ azure:storage:Account              statusfe                                                                  
 +-  │  ├─ azure:storage:Blob              component---src-pages-index-tsx-5b72260d4d41d26e7efc.js      replaced     [di
 +-  │  └─ azure:storage:Blob              component---src-pages-index-tsx-5b72260d4d41d26e7efc.js.map  replaced     [di
 +   ├─ azure:apimanagement:ApiPolicy      policy                                                       created      
 +   ├─ azure:apimanagement:ProductApi     dronedeliveryapiv1                                           created      
 +   └─ azure:apimanagement:ApiOperation   dronestatusGET                                               created      
 
Outputs:
    functionUrl      : "https://status-app471111f49.azurewebsites.net/api/GetStatusFunction?deviceId="
    storageAccountUrl: "https://statusfe2867cccd.z6.web.core.windows.net/"

Resources:
    + 9 created
    +-2 replaced
    11 changes. 25 unchanged
```

Navigate to the `storageAccountUrl` in a browser, hit refresh, and make sure that the app still works. You may turn on a network tab on browser developer tools and see that the request comes to API Management instead of Function Apps.

## Next Steps

Congratulations! :tada: You have successfully provisioned API Management resources that stand in front of Azure Functions to provide API for a static website.

Next, TODO
