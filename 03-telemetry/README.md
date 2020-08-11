# Deploying a Data Processing pipeline

In this lab, you will deploy a Azure Function Apps that is triggered by messages in an Event Hub. The device data from the messages will be saved to Azure Cosmos DB. You will also setup a dead-letter queue for messages that failed to be processed, and Azure Application Insights for monitoring.

Create a new Pulumi project called `telemetry` from your root workshop folder:

```bash
mkdir telemetry
cd telemetry
pulumi new azure-typescript -y
```

Run `pulumi config set azure:location westeurope --stack dev` to create a stack called `dev` and to set your Azure region (replace `westeurope` with the closest one).

Remove all the code from `index.ts`: this time, we'll structure the program differently. In this lab, you need to create resources in three functional areas: Cosmos DB, Event Hubs, and Function Apps. Let's split these resources into five TypeScript files:

- `common.ts` - shared resources (e.g. a Resource Group)
- `cosmos.ts` - Cosmos DB resources
- `eventHub.ts` - Event Hub resources
- `functionApp.ts` - Azure Functions
- `index.ts` main file that imports all the others.

## Step 1 &mdash; Create a Resource Group

Create a new file called `common.ts` in the same `telemetry` folder where `index.ts` exists. Add the following lines to it:

```ts
import * as azure from "@pulumi/azure";

export const appName = "telemetry";

const resourceGroup = new azure.core.ResourceGroup(`${appName}-rg`);
```

You are going to name all resources with a common prefix `telemetry`, so you declare and export a variable `appName`. The third line creates a new resource group `telemetry-rg`.

Now, you need to export two more pieces of shared metadata: a resource group name for all other resources in this stack, and the location that they should use. Add these two lines to the `common.ts` file:

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

Create a new file `cosmos.ts`. Use the following import statements to load Pulumi and the common variables that we defined on step 1:

```ts
import * as azure from "@pulumi/azure";
import { appName, location, resourceGroupName } from "./common";
```

Define a Cosmos DB account:

```ts
const databaseAccount = new azure.cosmosdb.Account(`${appName}-acc`, {
    resourceGroupName: resourceGroupName,
    offerType: "Standard",
    geoLocations: [{ location: location, failoverPriority: 0 }],
    consistencyPolicy: {
        consistencyLevel: "Session",
    },
});
```

Notably, we deploy Cosmos DB to a single region: this saves cost for the workshop resources. A geo-redundant deployment would simply add more entries to the array above. We also defined our consistency policy to `Session`.

Add a database to this account:

```ts
export const databaseName = "db";
const database = new azure.cosmosdb.SqlDatabase(databaseName, {
    name: databaseName,
    resourceGroupName: resourceGroupName,
    accountName: databaseAccount.name,
}, { parent: databaseAccount });
```

Note two things about this definition:

- You set an explicit value for the `name` property. This turns off autonaming by Pulumi, so that the actual name of the Azure resource is `db`.
- You set the `parent` option to the `databaseAccount` resource. This is not required, but this option gives a hint to Pulumi preview to display the `db` resource under the `telemetry-acc` resource.

Finally, add a SQL collection to the database:

```ts
export const collectionName = "items";
const collection = new azure.cosmosdb.SqlContainer(collectionName, {
    name: collectionName,
    resourceGroupName: resourceGroupName,
    accountName: databaseAccount.name,
    databaseName: database.name,
    partitionKeyPath: "/id",
}, { parent: database });
```

Note the partition key: it has to be set to `/id`, otherwise the application won't be able to execute the queries.

You also need to export several pieces of connection information to be used in the application:

```ts
export const connectionString = databaseAccount.connectionStrings[0];
export const endpoint = databaseAccount.endpoint;
export const masterKey = databaseAccount.primaryMasterKey;
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

Node: it takes 10-15 minutes to provision a new Cosmos DB account. Go ahead and deploy your `telemetry` program now with `pulumi up`:

```
$ pulumi up
...
Updating (dev):
     Type                                  Name           Status      
 +   pulumi:pulumi:Stack                   telemetry-dev  created     
 +   ├─ azure:core:ResourceGroup           telemetry-rg   created     
 +   └─ azure:cosmosdb:Account             telemetry-acc  created     
 +      └─ azure:cosmosdb:SqlDatabase      db             created     
 +         └─ azure:cosmosdb:SqlContainer  items          created     
 
Resources:
    + 5 created

Duration: 14m22s
```

You may continue with the next steps while the deployment is running.

> :white_check_mark: After these changes, your files should [look like this](./code/step2).

## Step 3 &mdash; Create an Event Hub

Azure Event Hubs are a log-based messaging services. In our sample scenario, Event Hubs will receive telemetry messages from IoT devices (drones).

Create a new file `eventHub.ts` and initialize its imports:

```ts
import * as azure from "@pulumi/azure";
import { appName, resourceGroupName } from "./common";
```

Start with a namespace for Event Hubs:

```ts
const eventHubNamespace = new azure.eventhub.EventHubNamespace(`${appName}-ns`, {
    resourceGroupName: resourceGroupName,
    sku: "Standard",    
});
```

Then, add a new Event Hub to this namespace:

```ts
const eventHub = new azure.eventhub.EventHub(`${appName}-eh`, {
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    messageRetention: 1,
    partitionCount: 4,
}, { parent: eventHubNamespace });
```

Event Hub messages are always received in a context of a consumer group: a logical name of the consumers. These names enable multiple "destinations" for the same messages. For this lab, you could use the built-in default consumer group, but it's best to define an explicit new one called `dronetelemetry`:

```ts
export const consumerGroupName = "dronetelemetry";
const consumerGroup = new azure.eventhub.ConsumerGroup(consumerGroupName, {
    name: consumerGroupName,
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    eventhubName: eventHub.name,
}, { parent: eventHub });
```

Finally, let's define two access keys: one key to send data to the Event Hub and another one to send messages to it:

```ts
const sendEventSourceKey = new azure.eventhub.AuthorizationRule("send", {
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    eventhubName: eventHub.name,
    send: true,
}, { parent: eventHub });

const listenEventSourceKey = new azure.eventhub.AuthorizationRule("listen", {
    resourceGroupName: resourceGroupName,
    namespaceName: eventHubNamespace.name,
    eventhubName: eventHub.name,
    listen: true,
}, { parent: eventHub });
```

Export the name and connection strings at the end of the file:

```ts
export const namespace = eventHubNamespace.name;
export const name = eventHub.name;
export const listenConnectionString = listenEventSourceKey.primaryConnectionString;
export const sendConnectionString = sendEventSourceKey.primaryConnectionString;
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

Next, you'll create an Azure Function App. This time, the Function will be triggered by messages, not HTTP requests. It glues together all the services we defined so far.

Create a new file `functionApp.ts` and add these import lines:

```ts
import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import { appName, resourceGroupName } from "./common";
import * as cosmos from "./cosmos";
import * as eventHub from "./eventHub";
```

Now, define two storage accounts: one account to be used by the Function App, and another one for dead-letter messages. 

```ts
const storageAccountType = {
    accountTier: "Standard",
    accountReplicationType: "LRS",
};

// Drone Telemetry storage account
const droneTelemetryStorageAccount = new azure.storage.Account(`${appName}sa`, {
    resourceGroupName: resourceGroupName,
    tags: {
        displayName: "Drone Telemetry Function App Storage",
    },    
    ...storageAccountType,
});

// Drone Telemetry DLQ storage account
const droneTelemetryDeadLetterStorageQueueAccount = new azure.storage.Account(`${appName}dlq`, {
    resourceGroupName: resourceGroupName,
    tags: {
        displayName: "Drone Telemetry DLQ",
    },    
    ...storageAccountType,
});
```

Note a pattern of defining common property bags in a variable like `storageAccountType` and then reusing them for multiple definitions.

Add an Azure Application Insights account to collect telemetry from our processing pipeline:

```ts
const droneTelemetryAppInsights = new azure.appinsights.Insights(`${appName}-ai`, {
    resourceGroupName: resourceGroupName,
    applicationType: "web",
});
```

Define a consumption plan:

```ts
const hostingPlan = new azure.appservice.Plan(`${appName}-asp`, {
    resourceGroupName: resourceGroupName,
    kind: "FunctionApp",
    sku: { tier: "Dynamic", size: "Y1" },
});
```

Finally, add a Function App:

```ts
const droneTelemetryFunctionApp = new azure.appservice.FunctionApp(`${appName}-app`, {
    resourceGroupName: resourceGroupName,
    appServicePlanId: hostingPlan.id,
    appSettings: {
        APPINSIGHTS_INSTRUMENTATIONKEY: droneTelemetryAppInsights.instrumentationKey,
        APPLICATIONINSIGHTS_CONNECTION_STRING: pulumi.interpolate`InstrumentationKey=${droneTelemetryAppInsights.instrumentationKey}`,
        ApplicationInsightsAgent_EXTENSION_VERSION: "~2",
        COSMOSDB_CONNECTION_STRING: cosmos.connectionString,
        CosmosDBEndpoint: cosmos.endpoint,
        CosmosDBKey: cosmos.masterKey,
        COSMOSDB_DATABASE_NAME: cosmos.databaseName,
        COSMOSDB_DATABASE_COL: cosmos.collectionName,
        EventHubConnection: eventHub.listenConnectionString,
        EventHubConsumerGroup: eventHub.consumerGroupName,
        EventHubName: eventHub.name,
        DeadLetterStorage: droneTelemetryDeadLetterStorageQueueAccount.primaryConnectionString,
        WEBSITE_RUN_FROM_PACKAGE: "https://mikhailworkshop.blob.core.windows.net/zips/telemetryapp.zip",
    },
    storageAccountName: droneTelemetryStorageAccount.name,
    storageAccountAccessKey: droneTelemetryStorageAccount.primaryAccessKey,
    tags: {
        displayName: "Drone Telemetry Function App",
    },
    version: "~3",
});
```

The application uses a pre-built deployment package. If you have time, feel free to download the package to your computer and read or modify the code, as we learned in lab 2.

Add another import to `index.ts`:

```ts
import "./functionApp";
```

> :white_check_mark: After these changes, your files should [look like this](./code/step4).

## Step 5 &mdash; Deploy and Send Data

Re-deplooy your `telemetry` application with `pulumi up`:

```
$ pulumi up
...
Updating (dev):
     Type                                       Name            Status      
     pulumi:pulumi:Stack                        telemetry-dev               
 +   ├─ azure:storage:Account                   telemetrysa     created     
 +   ├─ azure:appinsights:Insights              telemetry-ai    created     
 +   ├─ azure:appservice:Plan                   telemetry-asp   created     
 +   ├─ azure:storage:Account                   telemetrydlq    created     
 +   ├─ azure:eventhub:EventHubNamespace        telemetry-ns    created     
 +   │  └─ azure:eventhub:EventHub              telemetry-eh    created     
 +   │     ├─ azure:eventhub:AuthorizationRule  listen          created     
 +   │     ├─ azure:eventhub:ConsumerGroup      dronetelemetry  created     
 +   │     └─ azure:eventhub:AuthorizationRule  send            created     
 +   └─ azure:appservice:FunctionApp            telemetry-app   created     
 
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
- Multiple documents in the `items` collection in Cosmos DB. Note an ID of a devide there (e.g., "drone-543").

> Some users reported a delay before Azure Functions start processing the messages. If that happens, try restarting the Function App in the portal, or call [Sync triggers](https://docs.microsoft.com/en-us/azure/azure-functions/functions-deployment-technologies#trigger-syncing).

## Next Steps

Congratulations! :tada: You have successfully provisioned a data processing pipeline using managed Azure services for messaging, database, and compute.

Note: do not destroy the stack, the later labs will interact with it.

Next, TODO