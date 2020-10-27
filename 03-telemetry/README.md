# Lab 3: Deploying a Data Processing pipeline

In this lab, you will deploy a Azure Function App that is triggered by messages in an Event Hub. The device data from the messages will be saved to Azure Cosmos DB. You will also setup a dead-letter queue for messages that failed to be processed and Azure Application Insights for monitoring.

Create a new Pulumi project called `telemetry` from your root workshop folder:

```bash
mkdir telemetry
cd telemetry
pulumi new azure-nextgen-typescript -y
```

Remove all the code from `index.ts`: this time, we'll structure the program differently. In this lab, you need to create resources in three functional areas: Cosmos DB, Event Hubs, and Function Apps. Let's split these resources into five TypeScript files:

- `common.ts` - shared resources (e.g. a Resource Group)
- `cosmos.ts` - Cosmos DB resources
- `eventHub.ts` - Event Hub resources
- `functionApp.ts` - Azure Functions
- `index.ts` main file that imports all the others.

## Step 1 &mdash; Create a Resource Group

Create a new file called `common.ts` in the same `telemetry` folder where `index.ts` exists. Add the following lines to it:

```ts
import * as resources from "@pulumi/azure-nextgen/resources/latest";

export const appName = "telemetry";

const resourceGroup = new resources.ResourceGroup(`${appName}-rg`, {
    resourceGroupName: `${appName}-rg`,
    location: "WestEurope",
});
```

You are going to name all resources with a common prefix `telemetry`, so you declare and export a variable `appName` to avoid copy-pasting. The third line creates a new resource group `telemetry-rg`.

Now, you need to export two more pieces of shared metadata: a resource group name for all other resources in this stack and the location that they should use. Add these two lines to the `common.ts` file:

```ts
export const resourceGroupName = resourceGroup.name;
export const location = resourceGroup.location;
```

A new file isn't executed by Pulumi unless you import it in the `index.ts` file. Go ahead and add this line to `index.ts`:

```ts
import "./common";
```

> :white_check_mark: After these changes, your files should [look like this](./code/step1).

## Step 2 &mdash; Create a Cosmos DB Account, a Database, and a Collection

Next, you define a NoSQL database to store the telemetry data. Azure Cosmos DB suits perfectly for our use case.

Create a new file `cosmos.ts`. Use the following import statements to load Pulumi and the common variables that we defined in step 1:

```ts
import * as pulumi from "@pulumi/pulumi";
import * as documentdb from "@pulumi/azure-nextgen/documentdb/latest";
import { appName, location, resourceGroupName } from "./common";
```

Define a Cosmos DB account:

```ts
const databaseAccount = new documentdb.DatabaseAccount(`${appName}-acc`, {
    resourceGroupName: resourceGroupName,
    accountName: `${appName}-acc`,
    location: location,
    databaseAccountOfferType: "Standard",
    capabilities: [{
        name: "EnableServerless",
    }],
    locations: [{ locationName: location, failoverPriority: 0 }],
    consistencyPolicy: {
        defaultConsistencyLevel: "Session",
    },
});
```

Notably, we deploy Cosmos DB to a single region using the "serverless" tier: this saves cost for the workshop resources. A geo-redundant deployment would remove the `EnableServerless` capability and add more entries to the array above. We also defined our consistency policy to `Session`.

Add a database to this account:

```ts
export const databaseName = "db";
const database = new documentdb.SqlResourceSqlDatabase(databaseName, {    
    databaseName: databaseName,
    resourceGroupName: resourceGroupName,
    accountName: databaseAccount.name,
    resource: {
        id: databaseName,
    },
    options: {},
}, { parent: databaseAccount });
```

Note that we set the `parent` option to the `databaseAccount` resource. This is not required, but this option gives a hint to Pulumi preview to display the `db` resource under the `telemetry-acc` resource.

Finally, add a SQL collection to the database:

```ts
export const collectionName = "items";
const collection = new documentdb.SqlResourceSqlContainer(collectionName, {
    containerName: collectionName,
    resourceGroupName: resourceGroupName,
    accountName: databaseAccount.name,
    databaseName: database.name,
    resource: {
        id: collectionName,
        partitionKey: {
            paths: ["/id"]
        },
    },
    options: {},
}, { parent: database });
```

Note the partition key: it has to be set to `/id`, otherwise the application won't be able to execute the queries.

You also need to export several pieces of connection information to be used in the application:

```ts
const keys = pulumi.all([resourceGroupName, databaseAccount.name])
    .apply(([resourceGroupName, accountName]) =>
        documentdb.listDatabaseAccountKeys({ resourceGroupName, accountName }));

const connectionStrings = pulumi.all([resourceGroupName, databaseAccount.name])
    .apply(([resourceGroupName, accountName]) =>
        documentdb.listDatabaseAccountConnectionStrings({ resourceGroupName, accountName }));

export const connectionString = connectionStrings.apply(cs => cs.connectionStrings![0].connectionString);
export const endpoint = databaseAccount.documentEndpoint;
export const masterKey = keys.primaryMasterKey;
```

Also, add a new import to the `index.ts` file. Also, export Cosmos DB credentials: you will use them in the following labs.

```ts
import * as cosmos from "./cosmos";

export const cosmosDatabaseName = cosmos.databaseName;
export const cosmosCollectionName = cosmos.collectionName;
export const cosmosConnectionString = cosmos.connectionString;
export const cosmosEndpoint = cosmos.endpoint;
export const cosmosMasterKey = cosmos.masterKey;
```

> :white_check_mark: After these changes, your files should [look like this](./code/step2).

Note: it takes 10-15 minutes to provision a new Cosmos DB account. Go ahead and deploy your `telemetry` program now with `pulumi up`:

```
$ pulumi up
...
Updating (dev):
     Type                                                              Name           Plan       
 +   pulumi:pulumi:Stack                                               telemetry-dev  created    
 +   ├─ azure-nextgen:resources/latest:ResourceGroup                   telemetry-rg   created    
 +   └─ azure-nextgen:documentdb/latest:DatabaseAccount                telemetry-acc  created    
 +      └─ azure-nextgen:documentdb/latest:SqlResourceSqlDatabase      db             created    
 +         └─ azure-nextgen:documentdb/latest:SqlResourceSqlContainer  items          created    
 
Resources:
    + 5 created

Duration: 14m22s
```

You may continue with the next steps while the deployment is running.

## Step 3 &mdash; Create an Event Hub

Azure Event Hubs are a log-based messaging services. In our sample scenario, Event Hubs will receive telemetry messages from IoT devices (drones).

Create a new file `eventHub.ts` and initialize its imports:

```ts
import * as pulumi from "@pulumi/pulumi";
import * as eventhub from "@pulumi/azure-nextgen/eventhub/latest";
import { appName, location, resourceGroupName } from "./common";
```

Start with a namespace for Event Hubs:

```ts
const eventHubNamespace = new eventhub.Namespace(`${appName}-ns`, {
    resourceGroupName: resourceGroupName,
    namespaceName: `${appName}-ns`,
    location: location,
    sku: {
        name: "Standard",
    },
});
```

Then, add a new Event Hub to this namespace:

```ts
const eventHub = new eventhub.EventHub(`${appName}-eh`, {
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    eventHubName: `${appName}-eh`,
    messageRetentionInDays: 1,
    partitionCount: 4,
}, { parent: eventHubNamespace });
```

Event Hub messages are always received in a context of a consumer group: a logical name of the consumers. These names enable multiple "destinations" for the same messages. For this lab, you could use the built-in default consumer group, but it's best to define an explicit new one called `dronetelemetry`:

```ts
export const consumerGroupName = "dronetelemetry";
const consumerGroup = new eventhub.ConsumerGroup(consumerGroupName, {
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    eventHubName: eventHub.name,
    consumerGroupName: consumerGroupName,
}, { parent: eventHub });
```

Export the namespace and hub names:

```ts
export const namespace = eventHubNamespace.name;
export const name = eventHub.name;
```

Besides, let's define two access keys: one key to send data to the Event Hub and another one to listen to messages from it:

```ts
const sendEventSourceKey = new eventhub.EventHubAuthorizationRule("send", {
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    eventHubName: eventHub.name,
    authorizationRuleName: "send",
    rights: ["send"],
}, { parent: eventHub });

const listenEventSourceKey = new eventhub.EventHubAuthorizationRule("listen", {
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    eventHubName: eventHub.name,
    authorizationRuleName: "listen",
    rights: ["listen"],
}, { parent: eventHub });
```

Finally, we need to invoke functions to retrieve the connection strings for each of the authorization rule:

```ts
const sendKeys = pulumi.all([resourceGroupName, eventHubNamespace.name, eventHub.name, sendEventSourceKey.name])
    .apply(([resourceGroupName, namespaceName, eventHubName, authorizationRuleName]) =>
        eventhub.listEventHubKeys({
            resourceGroupName,
            namespaceName,
            eventHubName,
            authorizationRuleName,
        }));
export const sendConnectionString = sendKeys.primaryConnectionString;

const listenKeys = pulumi.all([resourceGroupName, eventHubNamespace.name, eventHub.name, listenEventSourceKey.name])
    .apply(([resourceGroupName, namespaceName, eventHubName, authorizationRuleName]) =>
        eventhub.listEventHubKeys({
            resourceGroupName,
            namespaceName,
            eventHubName,
            authorizationRuleName,
        }));
export const listenConnectionString = listenKeys.primaryConnectionString;
```

We want to import these resources in the `index.ts` file. Also, we want to export two of them as Pulumi exports:

```ts
import { namespace, sendConnectionString } from "./eventHub";

export const eventHubNamespace = namespace;
export const eventHubSendConnectionString = sendConnectionString;
```

You will use these outputs to send sample data to the Event Hub.

> :white_check_mark: After these changes, your files should [look like this](./code/step3).

## Step 4 &mdash; Add a Function App

Next, you'll create an Azure Function App. This time, the Function will be triggered by events (messages), not HTTP requests. It glues together all the services we defined so far.

Create a new file `functionApp.ts` and add these import lines:

```ts
import * as pulumi from "@pulumi/pulumi";
import * as insights from "@pulumi/azure-nextgen/insights/latest";
import * as storage from "@pulumi/azure-nextgen/storage/latest";
import * as web from "@pulumi/azure-nextgen/web/latest";
import { appName, location, resourceGroupName } from "./common";
import * as cosmos from "./cosmos";
import * as eventHub from "./eventHub";
```

We need two storage accounts: one account to be used by the Function App, and another one for dead-letter messages. Let's add some helper code to avoid duplication:

```ts
const storageAccountType = {
    resourceGroupName: resourceGroupName,
    location: location,
    sku: {
        name: "Standard_LRS",
    },
    kind: "StorageV2",
};

function getStorageConnectionString(account: storage.StorageAccount): pulumi.Output<string> {
    const keys = pulumi.all([resourceGroupName, account.name]).apply(([resourceGroupName, accountName]) =>
        storage.listStorageAccountKeys({ resourceGroupName, accountName }));
    const key = keys.keys[0].value;
    return pulumi.interpolate`DefaultEndpointsProtocol=https;AccountName=${account.name};AccountKey=${key}`;
}
```

Now, use them to define the storage accounts:

```ts
// Drone Telemetry storage account
const droneTelemetryStorageAccount = new storage.StorageAccount(`${appName}sa`, {
    accountName: `${appName}funcappsa`,
    tags: {
        displayName: "Drone Telemetry Function App Storage",
    },    
    ...storageAccountType,
});

// Drone Telemetry DLQ storage account
const droneTelemetryDeadLetterStorageQueueAccount = new storage.StorageAccount(`${appName}dlq`, {
    accountName: `${appName}dlqsa`,
    tags: {
        displayName: "Drone Telemetry DLQ Storage",
    },    
    ...storageAccountType,
});
```

Note a pattern of defining common property bags in a variable like `storageAccountType` and then reusing them for multiple definitions.

Add an Azure Application Insights account to collect telemetry from our processing pipeline:

```ts
const droneTelemetryAppInsights = new insights.Component(`${appName}-ai`, {
    resourceGroupName: resourceGroupName,
    resourceName: `${appName}-ai`,
    location: location,
    applicationType: "web",
    kind: "web",
});
```

Define a consumption plan:

```ts
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

Finally, add a Function App:

```ts
const droneTelemetryFunctionApp = new web.WebApp(`${appName}-app`, {
    resourceGroupName: resourceGroupName,
    name: "myappdf78s",
    location: location,
    serverFarmId: hostingPlan.id,
    kind: "functionapp",
    siteConfig: {
        appSettings: [
            { name: "APPINSIGHTS_INSTRUMENTATIONKEY", value: droneTelemetryAppInsights.instrumentationKey },
            { name: "APPLICATIONINSIGHTS_CONNECTION_STRING", value: pulumi.interpolate`InstrumentationKey=${droneTelemetryAppInsights.instrumentationKey}` },
            { name: "ApplicationInsightsAgent_EXTENSION_VERSION", value: "~2" },
            { name: "AzureWebJobsStorage", value: getStorageConnectionString(droneTelemetryStorageAccount) },
            { name: "COSMOSDB_CONNECTION_STRING", value: cosmos.connectionString },
            { name: "CosmosDBEndpoint", value: cosmos.endpoint },
            { name: "CosmosDBKey", value: cosmos.masterKey },
            { name: "COSMOSDB_DATABASE_NAME", value: cosmos.databaseName },
            { name: "COSMOSDB_DATABASE_COL", value: cosmos.collectionName },
            { name: "DeadLetterStorage", value: getStorageConnectionString(droneTelemetryDeadLetterStorageQueueAccount) },
            { name: "EventHubConnection", value: eventHub.listenConnectionString },
            { name: "EventHubConsumerGroup", value: eventHub.consumerGroupName },
            { name: "EventHubName", value: eventHub.name },
            { name: "FUNCTIONS_EXTENSION_VERSION", value: "~3" },            
            { name: "FUNCTIONS_WORKER_RUNTIME", value: "dotnet" },
            { name: "WEBSITE_RUN_FROM_PACKAGE", value: "https://mikhailworkshop.blob.core.windows.net/zips/telemetryapp.zip" },
        ]    
    },
    tags: {
        displayName: "Drone Telemetry Function App",
    },
});
```

The application uses a pre-built deployment package. If you have time, feel free to download the package to your computer and read or modify the code.

Add another import to `index.ts`:

```ts
import "./functionApp";
```

> :white_check_mark: After these changes, your files should [look like this](./code/step4).

## Step 5 &mdash; Deploy and Send Data

Provided your Cosmos DB is now provisioned, re-deploy your `telemetry` application with `pulumi up`:

```
$ pulumi up
...
Updating (dev):
     Type                                                              Name            Status      
     pulumi:pulumi:Stack                                               telemetry-dev               
 +   ├─ azure-nextgen:web/latest:AppServicePlan                        telemetry-asp   create     
 +   ├─ azure-nextgen:eventhub/latest:Namespace                        telemetry-ns    create     
 +   │  └─ azure-nextgen:eventhub/latest:EventHub                      telemetry-eh    create     
 +   │     ├─ azure-nextgen:eventhub/latest:ConsumerGroup              dronetelemetry  create     
 +   │     ├─ azure-nextgen:eventhub/latest:EventHubAuthorizationRule  send            create     
 +   │     └─ azure-nextgen:eventhub/latest:EventHubAuthorizationRule  listen          create     
 +   ├─ azure-nextgen:insights/latest:Component                        telemetry-ai    create     
 +   ├─ azure-nextgen:storage/latest:StorageAccount                    telemetrydlq    create     
 +   ├─ azure-nextgen:storage/latest:StorageAccount                    telemetrysa     create     
 +   └─ azure-nextgen:web/latest:WebApp                                telemetry-app   create     
 
Outputs:
  + eventHubNamespace           : "telemetry-ns24c12345"
  + eventHubSendConnectionString: "Endpoint=sb://telemetry-ns24c12345.servicebus.windows.net/;SharedAccessKeyName=senda456760b;SharedAccessKey=somelongsecretkey=;EntityPath=telemetry-eh4563e58c"
```

While the stack is deploying, download a sample application that can send telemetry to your Event Hubs:

1. Download the [zip file](https://mikhailworkshop.blob.core.windows.net/zips/TelemetryGenerator.zip).
2. Extract it to a `TelemetryGenerator` folder under your `telemetry` stack folder.
3. Make sure that you have .NET Core SDK installed, or install it from [here](https://dotnet.microsoft.com/download).
4. Wait until the stack deployment above completes and succeeds.
5. Run the client application:

```
export EH_NAMESPACE=$(pulumi stack output eventHubNamespace) 
export EVENT_HUB_CONNECTION_STRING="$(pulumi stack output eventHubSendConnectionString)"
dotnet TelemetryGenerator/Serverless.Simulator.dll
```

Note: the above commands are specific to macOS/Linux. Change the top two lines to set environment variables for your operating system, if needed.

If everything is correct, you should see a lot of messages like

```
...
Created 2 records for drone-240
Created 2 records for drone-253
Created 2 records for drone-264
Created 2 records for drone-271
...
```

Stop the program at any moment with `Ctrl-C`. 

Go ahead and explore Event Hubs, Application Insights, Cosmos DB in the Azure Portal. You should be able to see:

- A spike of incoming and outgoing messages in Event Hubs
- A spike of log messages and function calls in Application Insights
- Multiple documents in the `items` collection in Cosmos DB. Note an ID of a device there (e.g., "drone-543").

> Some users reported a delay before Azure Functions start processing the messages. If that happens, try restarting the Function App in the portal, or call [Sync triggers](https://docs.microsoft.com/en-us/azure/azure-functions/functions-deployment-technologies#trigger-syncing).

## Next Steps

Congratulations! :tada: You have successfully provisioned a data processing pipeline using managed Azure services for messaging, database, and compute.

Note: do not destroy the stack, the later labs will interact with it.

Next, you will deploy an Azure Function App that retrieves data from the Cosmos DB collection.

[Get Started with Lab 4](../04-status/README.md)
