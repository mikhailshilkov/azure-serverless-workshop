# Deploying a Status Function App

In this lab, you will deploy a Azure Function Apps that retrieves data from the Cosmos DB collection. That's the first step to building a web application that shows drone data to end users.

Create a new Pulumi project called `statusapp` from your root workshop folder (next to `telemetry`):

```bash
mkdir statusapp
cd statusapp
pulumi new azure-typescript -y
```

Run `pulumi config set azure:location westeurope --stack dev` to create a stack called `dev` and to set your Azure region (replace `westeurope` with the closest one).

Remove all the code from `index.ts`.

## Step 1 &mdash; Create a Resource Group

Create a new file called `common.ts` in the same `statusapp` folder where `index.ts` exists. Add the following lines to it:

```ts
import * as azure from "@pulumi/azure";

export const appName = "status";

const resourceGroup = new azure.core.ResourceGroup(`${appName}-rg`);
export const resourceGroupName = resourceGroup.name;
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
import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import { appName, resourceGroupName } from "./common";

const droneStatusStorageAccount = new azure.storage.Account(`${appName}sa`, {
    resourceGroupName: resourceGroupName,
    tags: {
        displayName: "Drone Status Function App",
    },    
    accountTier: "Standard",
    accountReplicationType: "LRS",
});

const droneStatusAppInsights = new azure.appinsights.Insights(`${appName}-ai`, {
    resourceGroupName: resourceGroupName,
    applicationType: "web",
});

const hostingPlan = new azure.appservice.Plan(`${appName}-asp`, {
    resourceGroupName: resourceGroupName,
    kind: "FunctionApp",
    sku: { tier: "Dynamic", size: "Y1" },
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

Now, define a new resource for another Function App.

```ts
const droneStatusFunctionApp = new azure.appservice.FunctionApp(`${appName}-app`, {
    resourceGroupName: resourceGroupName,
    appServicePlanId: hostingPlan.id,
    appSettings: {
        APPINSIGHTS_INSTRUMENTATIONKEY: droneStatusAppInsights.instrumentationKey,
        APPLICATIONINSIGHTS_CONNECTION_STRING: pulumi.interpolate`InstrumentationKey=${droneStatusAppInsights.instrumentationKey}`,
        ApplicationInsightsAgent_EXTENSION_VERSION: "~2",
        COSMOSDB_CONNECTION_STRING: cosmosConnectionString,
        CosmosDBEndpoint: cosmosEndpoint,
        CosmosDBKey: cosmosMasterKey,
        COSMOSDB_DATABASE_NAME: cosmosDatabaseName,
        COSMOSDB_DATABASE_COL: cosmosCollectionName,
        WEBSITE_RUN_FROM_PACKAGE: "https://mikhailworkshop.blob.core.windows.net/zips/statusapp.zip",
    },
    storageAccountName: droneStatusStorageAccount.name,
    storageAccountAccessKey: droneStatusStorageAccount.primaryAccessKey,
    tags: {
        displayName: "Drone Status Function App",
    },
    siteConfig: {
        cors: {
            allowedOrigins: ["*"],
        },
    },
    version: "~3",
});

export const functionUrl = pulumi.interpolate`https://${droneStatusFunctionApp.defaultHostname}/api/GetStatusFunction?deviceId=`;
```

A couple of important things to notice:

- The CORS block enables direct access from the browsers (you can restrict the wildcard at a later lab).
- The `functionUrl` variable exports the full URL of an HTTP endpoint. Retrieving information for a given drone is as simple as appending its ID to this URL (see an example below).

The application uses a pre-built deployment package. If you have time, feel free to download the package to your computer and read or modify the code, as we learned in lab 2.

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
     Type                             Name           Status      
 +   pulumi:pulumi:Stack              statusapp-dev  created     
 +   ├─ azure:core:ResourceGroup      status-rg      created     
 +   ├─ azure:appinsights:Insights    status-ai      created     
 +   ├─ azure:storage:Account         statussa       created     
 +   ├─ azure:appservice:Plan         status-asp     created     
 +   └─ azure:appservice:FunctionApp  status-app     created     
 
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

If needed, replace `drone-543` with a name of drone as seen in lab 3.

## Next Steps

Congratulations! :tada: You have successfully provisioned an Azure Function that can retrieve data from Azure Cosmos DB in another stack.

Next, TODO