# Lab 4: Deploying a Status Function App

In this lab, you will deploy an Azure Function App that retrieves data from the Cosmos DB collection. That's the first step to building a web application that shows drone data to end users.

Create a new Pulumi project called `statusapp` from your root workshop folder (next to `telemetry`):

```bash
mkdir statusapp
cd statusapp
pulumi new azure-typescript -y
```

Remove all the code from `index.ts`.

## Step 1 &mdash; Create a Resource Group

Create a new file called `common.ts` in the same `statusapp` folder where `index.ts` exists. Add the following lines to it:

```ts
import * as resources from "@pulumi/azure-nextgen/resources/latest";

export const appName = "status";

const resourceGroup = new resources.ResourceGroup(`${appName}-rg`, {
    resourceGroupName: `${appName}-rg`,
    location: "WestEurope",
});

export const resourceGroupName = resourceGroup.name;
export const resourceGroupId = resourceGroup.id;
export const location = resourceGroup.location;
```

Add an import line to `index.ts`:

```ts
import "./common";
```

> :white_check_mark: After these changes, your files should [look like this](./code/step1).

## Step 2 &mdash; Create a Storage Account, Application Insights, and a Hosting Plan

These resources are very familiar to you by now. Create a `functionApp.ts` file with the following lines:

```ts
import * as insights from "@pulumi/azure-nextgen/insights/latest";
import * as storage from "@pulumi/azure-nextgen/storage/latest";
import * as web from "@pulumi/azure-nextgen/web/latest";
import { appName, location, resourceGroupName } from "./common";

const droneStatusStorageAccount = new storage.StorageAccount(`${appName}sa`, {
    resourceGroupName: resourceGroupName,
    location: location,
    accountName: `${appName}sa`,
    sku: {
        name: "Standard_LRS",
    },
    kind: "StorageV2",
    tags: {
        displayName: "Drone Status Function App",
    },    
});

const droneStatusAppInsights = new insights.Component(`${appName}-ai`, {
    resourceGroupName: resourceGroupName,
    resourceName: `${appName}-ai`,
    location: location,
    applicationType: "web",
    kind: "web",
});

const hostingPlan = new web.AppServicePlan(`${appName}-asp`, {
    resourceGroupName: resourceGroupName,
    name: `${appName}-asp`,
    location: location,
    sku: {
        name: "Y1",
        tier: "Dynamic",
    },
});
```

> :white_check_mark: After these changes, your files should [look like this](./code/step2).

## Step 3 &mdash; Import Cosmos DB credentials with Stack References

You are currently working within the `statusapp` project. However, your application needs to retrieve data from the Cosmos DB database from the `telemetry` project.

Stack references enable you to import the values from another stack to the current stack. Add the following code to `functionApp.ts`. Replace `yourpulumiuser` with your Pulumi user name (run `pulumi whoami` if you forgot it).

```ts
const telemetry = new pulumi.StackReference("yourpulumiuser/telemetry/dev");
const cosmosDatabaseName = telemetry.requireOutput("cosmosDatabaseName");
const cosmosCollectionName = telemetry.requireOutput("cosmosCollectionName");
const cosmosConnectionString = telemetry.requireOutput("cosmosConnectionString");
const cosmosEndpoint = telemetry.requireOutput("cosmosEndpoint");
const cosmosMasterKey = telemetry.requireOutput("cosmosMasterKey");
```

> :white_check_mark: After these changes, your files should [look like this](./code/step3).

## Step 4 &mdash; Add a Function App

Now, copy the `getStorageConnectionString` function from Lab 3 and define a new resource for another Function App.

```ts
const droneStatusFunctionApp = new web.WebApp(`${appName}-app`, {
    resourceGroupName: resourceGroupName,
    name: `${appName}-app`,
    location: location,
    serverFarmId: hostingPlan.id,
    kind: "functionapp",
    siteConfig: {
        appSettings: [
            { name: "APPINSIGHTS_INSTRUMENTATIONKEY", value: droneStatusAppInsights.instrumentationKey },
            { name: "APPLICATIONINSIGHTS_CONNECTION_STRING", value: pulumi.interpolate`InstrumentationKey=${droneStatusAppInsights.instrumentationKey}` },
            { name: "ApplicationInsightsAgent_EXTENSION_VERSION", value: "~2" },
            { name: "AzureWebJobsStorage", value: getStorageConnectionString(droneStatusStorageAccount) },
            { name: "COSMOSDB_CONNECTION_STRING", value: cosmosConnectionString },
            { name: "CosmosDBEndpoint", value: cosmosEndpoint },
            { name: "CosmosDBKey", value: cosmosMasterKey },
            { name: "COSMOSDB_DATABASE_NAME", value: cosmosDatabaseName },
            { name: "COSMOSDB_DATABASE_COL", value: cosmosCollectionName },
            { name: "FUNCTIONS_EXTENSION_VERSION", value: "~3" },            
            { name: "FUNCTIONS_WORKER_RUNTIME", value: "dotnet" },
            { name: "WEBSITE_NODE_DEFAULT_VERSION", value: "10.14.1" },
            { name: "WEBSITE_RUN_FROM_PACKAGE", value: "https://mikhailworkshop.blob.core.windows.net/zips/statusapp.zip" },
        ],
        cors: {
            allowedOrigins: ["*"],
        },
    },
    tags: {
        displayName: "Drone Telemetry Function App",
    },
});

export const functionUrl = pulumi.interpolate`https://${droneStatusFunctionApp.defaultHostName}/api/GetStatusFunction?deviceId=`;
```

A couple of important things to notice:

- The CORS block enables direct access from the browsers (you can restrict the wildcard at a later lab).
- The `functionUrl` variable exports the full URL of an HTTP endpoint. Retrieving information for a given drone is as simple as appending its ID to this URL (see an example below).

The application uses a pre-built deployment package. If you have time, feel free to download the package to your computer and read or modify the code.

Modify `index.ts` to import the `functionApp.ts` file and export the function URL from the Pulumi stack:

```ts
import * as functions from "./functionApp";

export const functionUrl = functions.functionUrl;
```

> :white_check_mark: After these changes, your files should [look like this](./code/step4).

## Step 5 &mdash; Deploy and Test the Stack

Deploy the stack

```bash
$ pulumi up
...
Updating (dev):
     Type                                             Name           Status      
     pulumi:pulumi:Stack                              statusapp-dev              
 +   ├─ azure-nextgen:resources/latest:ResourceGroup  status-rg      created     
 +   ├─ azure-nextgen:insights/latest:Component       status-ai      created     
 +   ├─ azure-nextgen:web/latest:AppServicePlan       status-asp     created     
 +   ├─ azure-nextgen:storage/latest:StorageAccount   statussa       created     
 +   └─ azure-nextgen:web/latest:WebApp               status-app     created   
 
Outputs:
    functionUrl: "https://status-app47012f49.azurewebsites.net/api/GetStatusFunction?deviceId="

Resources:
    + 6 created
```

Run the following command to retrieve the status of a device:

```
# curl "$(pulumi stack output functionUrl)drone-543"          
{"id":"drone-543","_rid":"NaUDAJvRtdQBAAAAAAAAAA==","_self":"dbs/NaUDAA==/colls/NaUDAJvRtdQ=/docs/NaUDAJvRtdQBAAAAAAAAAA==/","_ts":1597094407,"_etag":"\"9100dc32-0000-0700-0000-5f31ba070000\"","Battery":1,"FlightMode":5,"Latitude":47.476075,"Longitude":-122.192026,"Altitude":0,"GyrometerOK":true,"AccelerometerOK":true,"MagnetometerOK":true}%
```

If needed, replace `drone-543` with a name of drone as seen in Lab 3.

## Next Steps

Congratulations! :tada: You have successfully provisioned an Azure Function that can retrieve data from Azure Cosmos DB in another stack.

Next, you will add an HTML frontend application that displays drone status data.

[Get Started with Lab 5](../05-frontend/README.md)