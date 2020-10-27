# Creating a Second Stack

It is easy to create multiple instances of the same project. This is called a stack. This is handy for multiple development or test environments, staging versus production, and scaling a given infrastructure across many regions.

## Step 1 &mdash; Create and Configure a New Stack

Create a new stack:

```bash
pulumi stack init prod
```

Next, configure its required variable:

```bash
pulumi config set container htmlprod
```

If you are ever curious to see the list of stacks for your current project, run this command:

```bash
pulumi stack ls
```

It will print all stacks for this project that are available to you:

```
NAME   LAST UPDATE     RESOURCE COUNT  URL
dev    30 minutes ago  4               https://app.pulumi.com/myuser/iac-workshop/dev
prod*  3 minutes ago   0               https://app.pulumi.com/myuser/iac-workshop/prod
```

Adjust the code to change the names of the resource group and the storage account to avoid duplication. Alternatively, you could make these names include stack names or make them configurable.

## Step 2 &mdash; Deploy the New Stack

Now deploy all of the changes:

```bash
pulumi up
```

This will create an entirely new set of resources from scratch, unrelated to the existing `dev` stack's resources.

```
Updating (prod):

     Type                                             Name               Status
 +   pulumi:pulumi:Stack                              iac-workshop-prod  created
 +   ├─ azure-nextgen:resources/latest:ResourceGroup  my-group           created     
 +   ├─ azure-nextgen:storage/latest:StorageAccount   mystorage          created     
 +   └─ azure-nextgen:storage/latest:BlobContainer    mycontainer        created

Outputs:
    AccountName: "myuniquenameprod"

Resources:
    + 4 created

Duration: 30s

Permalink: https://app.pulumi.com/myuser/iac-workshop/prod/updates/1
```

A new set of resources has been created for the `prod` stack.

## Next Steps

* [Destroying Your Infrastructure](./07-destroying-your-infrastructure.md)
