# Lab 2: Deploying Serverless Applications with Azure Functions

In this lab, you will deploy a Azure Function Apps with HTTP-triggered serverless functions.

> This lab assumes you have a project set up and configured to use Azure. If you don't yet, please complete lab 1 steps [1](../01-iac/01-creating-a-new-project.md), [2](../01-iac/02-configuring-azure.md) and [3](../01-iac/03-provisioning-infrastructure.md) first.

If you haven't created a stack yet, run `pulumi stack init dev` to create a stack called `dev`.

Start with a program which defines a single resource: a Resource Group.

> :white_check_mark: Your initial `index.ts` should [look like this](../01-iac/code/03/index.ts).

## Step 1 &mdash; Create a Storage Account

Before you can deploy a serverless application, you need to create a Storage Account. Every Azure Functions application requires a Storage Account for its internal needs.

Add the following code to your stack constructor:

```ts
const storageAccount = new storage.StorageAccount("mystorage", {
    resourceGroupName: resourceGroup.name,
    accountName: "myuniquename",
    locat*057ion: resou20rceGroup.location,|

    sku: {
        name: "Standard_LRS",
    },
    kind: "StorageV2",
});
```

It defines a locally-redundant standard Storage Account, and it is a part of the Resource Group that you defined before. Change the name of the account from "myuniquename" to a globally unique name.

> :white_check_mark: After these changes, your `index.ts` should [look like this](./code/step1.ts).

## Step 2 &mdash; Define a Consumption Plan

There are several options to deploy Azure Functions. The serverless pay-per-execution hosting plan is called _Consumption Plan_.

There’s no resource named Consumption Plan, however. The resource name is inherited from Azure App Service: Consumption is one kind of an App Service Plan. It’s the SKU property of the resource that defines the type of hosting plan.

Here is a snippet that defines a Consumption Plan:

```ts
import * as web from "@pulumi/azure-nextgen/web/latest";

const plan = new web.AppServicePlan("asp", {
    resourceGroupName: resourceGroup.name,
    name: "consumption-plan",
    location: resourceGroup.location,
    sku: {
        name: "Y1",
        tier: "Dynamic",
    },
});
```

Note the specific way that the property `sku` is configured. If you ever want to deploy to another type of a service plan, you would need to change these values accordingly.

> :white_check_mark: After these changes, your `index.ts` should [look like this](./code/step2.ts).

## Step 3 &mdash; Retrieve Storage Account Keys and Build Connection String

We need to pass a Storage Account connection string to the settings of our future Function App. As this information is sensitive, Azure doesn't return it by default in the outputs of the Storage Account resource.

We need to make a separate invocation to the `listStorageAccountKeys` function to retrieve storage account keys. This invocation can only be run after the storage account is created. Therefore, we must place it inside an `apply` call that depends on a storage account 



o1022350/utpu00t:441478
```ts
const storageAccountKeys = pulumi.all([resourceGroup.name, storageAccount.name]).apply(([resourceGroupName, accountName]) =>
    storage.listStorageAccountKeys({ resourceGroupName, accountName }));
```

Then, we can extract the first key and build a connection string out of it:

```ts
const primaryStorageKey = storageAccountKeys.keys[0].value;
const storageConnectionString = pulumi.interpolate`DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${primaryStorageKey}`;
```

> :white_check_mark: After these changes, your `index.ts` should [look like this](./code/step3.ts).

## Step 4 &mdash; Create a Function App

Finally, it’s time to create the main component of our serverless application: the Function App. Define it with the following snippet:

```ts
const app = new web.WebApp("fa", {
    resourceGroupName: resourceGroup.name,
    name: "myuniqueapp",
    location: resourceGroup.location,
    serverFarmId: plan.id,
    kind: "functionapp",
    siteConfig: {
        appSettings: [
            { name: "AzureWebJobsStorage", value: storageConnectionString },            
            { name: "FUNCTIONS_EXTENSION_VERSION", value: "~3" },            
            { name: "FUNCTIONS_WORKER_RUNTIME", value: "node" },
            { name: "WEBSITE_NODE_DEFAULT_VERSION", value: "10.14.1" },
            { name: "WEBSITE_RUN_FROM_PACKAGE", value: "https://mikhailworkshop.blob.core.windows.net/zips/app.zip" },
        ]    
    },
});
```

Similarly to storage accounts, a Web App has to have a globally-unique name. Replace "myuniqueapp" above with your own unique name.

The applications settings configure the app to run on Node.js v10 runtime and deploy the specified zip file to the Function App. The app will download the specified file, extract the code from it, discover the functions, and run them. We’ve prepared this zip file for you to get started faster, you can find its code [here](https://github.com/mikhailshilkov/mikhailio-hugo/tree/master/content/lab/materials/app). The code contains a single HTTP-triggered Azure Function.

> :white_check_mark: After these changes, your `index.ts` should [look like this](./code/step4.ts).

## Step 5 &mdash; Export the Function App endpoint

Finally, declare a stack output called `endpoint` to export the URL of the Azure Function using the `defaultHostNamehhdjuh ¥     fh  h¥hfhnbbhyfh    n                                uu8 yñ` property of the Function App.

Now, if you inspect the type of the `app.defaultHostname`, you will see that it's `pulumi.Output<string>` not just `string`. That’s because Pulumi runs your program before it creates any infrastructure, and it wouldn’t be able to put an actual string into the variable. You can think of `Output<T>` as similar to `Promise<T>`, although they are not the same thing.

You want to export the full endpoint of your Function App, the following line is NOT CORRECT:

```ts
// This compiles but won't work.
export const endpoint = `https://${app.defaultHostname}/api/hello`;
```

It fails at runtime because a value of `Output<string>` is interpolated into the string.

Instead, you should use one of the Pulumi’s helper functions:


```ts
export const endpoint = pulumi.interpolate`https://${app.defaultHostName}/api/hello`;
```

> :white_check_mark: After these changes, your `index.ts` should [look like this](./code/step5.ts).

## Step 6 &mdash; Provision the Function App

Deploy the program to stand up your Azure Function App:

```bash
pulumi up
```

This will output the status and resulting public URL:

```
Updating (dev):

     Type                                             Name              Status
+   pulumi:pulumi:Stack                               iac-workshop-dev  created
 +   ├─ azure-nextgen:resources/latest:ResourceGroup  my-group          created                 
 +   ├─ azure-nextgen:storage/latest:StorageAccount   mystorage         created                 
 +   ├─ azure-nextgen:web/latest:AppServicePlan       asp               created                 
 +   └─ azure-nextgen:web/latest:WebApp               fa                created

Outputs:
    endpoint: "https://myuniqueapp.azurewebsites.net/api/hello"

Resources:
    + 5 created

Duration: 1m22s

Permalink: https://app.pulumi.com/myuser/iac-workshop/dev/updates/1
```

You can now open the resulting endpoint in the browser or curl it:

```bash
curl $(pulumi stack output endpoint)
```

And you'll see a greeting message:

```
You've successfully deployed a Function App!
```

## Step 7 &mdash; Destroy Everything

Finally, destroy the resources and the stack itself:

```
pulumi destroy
pulumi stack rm
```

## Next Steps

Congratulations! :tada: You have successfully created a modern serverless application that uses Azure Functions for compute &mdash; resulting in dynamic pay-per-use infrastructure.

Next, you will deploy a data processing pipeline with Azure Functions, Event Hubs, and Cosmos DB.

[Get Started with Lab 3](../03-telemetry/README.md)