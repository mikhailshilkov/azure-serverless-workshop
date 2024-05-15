# Configuring Azure

Now that you have a basic project, let's configure Azure support for it.

## Step 1 &mdash; Install the Azure Native Package

Run the following command to install the Azure Native package:

```bash
npm install @pulumi/azure-native
```

The package will be added to `node_modules/`, `package.json`, and `package-lock.json`.

## Step 2 &mdash; Use the Azure Native Package

Now that the Azure Native package is installed, add the following lines to `index.ts` to import two modules from it. We will use one module to define a resource group and another one to define a storage account.

```ts
...
import * as resources from "@pulumi/azure-native/resources";
import * as storage from "@pulumi/azure-native/storage";
```

## Step 3 &mdash; Login to Azure

Simply login to the Azure CLI and Pulumi will automatically use your credentials:

```
az login
...
You have logged in. Now let us find all the subscriptions to which you have access...
...
```

The Azure CLI, and thus Pulumi, will use the Default Subscription by default, however it is possible to override the subscription, by simply setting your subscription ID to the id output from `az account list`’s output:

```
$ az account list
```

Pick out the `<id>` from the list and run:

```
$ az account set --subscription=<id>
```

## Next Steps

* [Provisioning a Resource Group](./03-provisioning-infrastructure.md)
