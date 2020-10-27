# Provisioning Infrastructure

Now that you have a project configured to use Azure, you'll create some basic infrastructure in it. We will start with a Resource Group.

## Step 1 &mdash; Declare a New Resource Group

Add the following to your `index.ts` file:

```ts
...
const resourceGroup = new resources.ResourceGroup("my-group", {
    resourceGroupName: "my-group",
    location: "westus",
});
```

Feel free to choose any Azure region that supports the services used in these labs ([see this infographic](https://azure.microsoft.com/en-us/global-infrastructure/regions/) for a list of available regions).

Note that we specified the resource name twice. The first name is a logical name of the Pulumi resource that you see in the previews and logs. The second name is the physical name of the resource in Azure. The names may match, as above, but may also be different, if that makes sense in your case.

> :white_check_mark: After this change, your `index.ts` should [look like this](./code/03/index.ts).

## Step 2 &mdash; Preview Your Changes

Now preview your changes:

```
pulumi up
```

This command evaluates your program, determines the resource updates to make, and shows you an outline of these changes:

```
Previewing update (dev):

     Type                                             Name              Plan
 +   pulumi:pulumi:Stack                              iac-workshop-dev  create
 +   └─ azure-nextgen:resources/latest:ResourceGroup  my-group          create

Resources:
    + 2 to create

Do you want to perform this update?
  yes
> no
  details
```

This is a summary view. Select `details` to view the full set of properties:

```
+ pulumi:pulumi:Stack: (create)
    [urn=urn:pulumi:dev::iac-workshop::pulumi:pulumi:Stack::iac-workshop-dev]
    + azure-nextgen:resources/latest:ResourceGroup: (create)
        [urn=urn:pulumi:dev::iac-workshop::azure-nextgen:resources/latest:ResourceGroup::my-group]
        [provider=urn:pulumi:dev::iac-workshop::pulumi:providers:azure-nextgen::default_0_2_3::04da6b54-80e4-46f7-96ec-b56ff0331ba9]
        location         : "westus"
        resourceGroupName: "my-group"

Do you want to perform this update?
  yes
> no
  details
```

The stack resource is a synthetic resource that all resources your program creates are parented to.

## Step 3 &mdash; Deploy Your Changes

Now that we've seen the full set of changes, let's deploy them. Select `yes`:

```
Updating (dev):

     Type                                             Name              Status
 +   pulumi:pulumi:Stack                              iac-workshop-dev  created
 +   └─ azure-nextgen:resources/latest:ResourceGroup  my-group          created

Resources:
    + 2 created

Duration: 8s

Permalink: https://app.pulumi.com/myuser/iac-workshop/dev/updates/1
```

Now your resource group has been created in your Azure account. Feel free to click the Permalink URL and explore; this will take you to the [Pulumi Console](https://www.pulumi.com/docs/intro/console/), which records your deployment history.

## Next Steps

* [Updating Your Infrastructure](./04-updating-your-infrastructure.md)
