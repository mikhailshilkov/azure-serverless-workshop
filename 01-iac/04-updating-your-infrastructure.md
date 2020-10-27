# Updating Your Infrastructure

We just saw how to create new infrastructure from scratch. Next, let's add an Azure Storage Account to the existing resource group.

This demonstrates how declarative infrastructure as code tools can be used not just for initial provisioning, but also subsequent changes to existing resources.

## Step 1 &mdash; Add a Storage Account

And then add these lines to `index.ts` right after creating the resource group:

```ts
...
const storageAccount = new storage.StorageAccount("mystorage", {
    resourceGroupName: resourceGroup.name,
    accountName: "myuniquename",
    location: resourceGroup.location,
    sku: {
        name: "Standard_LRS",
    },
    kind: "StorageV2",
});
```

Azure requires each storage account to have a globally unique names across all tenants. Change the `accountName` parameter from "myuniquename" to a globally unique name that you can think of. This is a good example of when a logical resource name may differ from a physical name.

Deploy the changes:

```bash
pulumi up
```

This will give you a preview and selecting `yes` will apply the changes:

```
Updating (dev):

     Type                                            Name              Status
     pulumi:pulumi:Stack                             iac-workshop-dev
 +   └─ azure-nextgen:storage/latest:StorageAccount  mystorage         created

Resources:
    + 1 created
    2 unchanged

Duration: 4s

Permalink: https://app.pulumi.com/myuser/iac-workshop/dev/updates/2
```

A single resource is added and two existing resources are left unchanged. This is a key attribute of infrastructure as code &mdash; such tools determine the minimal set of changes necessary to update your infrastructure from one version to the next.

## Step 2 &mdash; Export Your New Storage Account Name

Programs can export variables which are shown in the CLI and recorded for each deployment. Export your account's name by adding this line to `index.ts`:

```ts
export const accountName = storageAccount.name;
```

Now deploy the changes:

```bash
pulumi up
```

Notice a new `Outputs` section is included in the output containing the account's name:

```
...

Outputs:
  + accountName: "myuniquename"

Resources:
    3 unchanged

Duration: 7s

Permalink: https://app.pulumi.com/myuser/iac-workshop/dev/updates/3
```

## Step 3 &mdash; Inspect Your New Storage Account

Now run the `az` CLI to list the containers in this new account:

```
az storage container list --account-name $(pulumi stack output accountName)
[]
```

Note that the account is currently empty.

## Step 4 &mdash; Add a Container to Your Storage Account

Add these lines to the `index.ts` file:

```ts
...
const container = new storage.BlobContainer("mycontainer", {
    resourceGroupName: resourceGroup.name,
    accountName: storageAccount.name,
    containerName: "files",
});
...
```

> :white_check_mark: After this change, your `index.ts` should [look like this](./code/04/index.ts).

Deploy the changes:

```bash
pulumi up
```

This will give you a preview and selecting `yes` will apply the changes:

```
Updating (dev):

     Type                                           Name              Status
     pulumi:pulumi:Stack                            iac-workshop-dev
 +   └─ azure-nextgen:storage/latest:BlobContainer  mycontainer       created

Resources:
    + 1 created
    3 unchanged

Duration: 9s

Permalink: https://app.pulumi.com/myuser/iac-workshop/dev/updates/4

Finally, relist the contents of your account:

```bash
az storage container list --account-name $(pulumi stack output accountName) -o table
Name    Lease Status    Last Modified
------  --------------  -------------------------
files   unlocked        2020-02-10T12:51:16+00:00
```

Notice that your `files` container has been added.

## Next Steps

* [Making Your Stack Configurable](./05-making-your-stack-configurable.md)
