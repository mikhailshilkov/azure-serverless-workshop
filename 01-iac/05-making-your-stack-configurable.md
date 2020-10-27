# Making Your Stack Configurable

Right now, the container's name is hard-coded. Next, you'll make the name configurable.

## Step 1 &mdash; Adding a Config Variable

Instead of hard-coding the `"files"` container, we will use configuration to make it easy to change the name without editing the program.

Create a file `config.ts` and add this to it:

```ts
import { Config } from "@pulumi/pulumi";

const config = new Config();
export const containerName = config.require("container");
```

## Step 2 &mdash; Populating the Container Based on Config

Add this line to your `index.ts` file's import statements:

```ts
...
import { containerName } from "./config";
...
```

And replace the hard-coded `"files"` parameter with this imported `containerName` variable:

```typescript
const container = new storage.BlobContainer("mycontainer", {
    resourceGroupName: resourceGroup.name,
    accountName: storageAccount.name,
    containerName: containerName,
});
```

> :white_check_mark: After this change, your files should [look like this](./code/05/).

## Step 3 &mdash; Deploying the Changes

Now, deploy your changes. To do so, first configure your stack. If you don't, you'll get an error:

```bash
pulumi up
```

This results in an error like the following:

```
...
ConfigMissingException: Missing Required configuration variable 'iac-workshop:container'
    	please set a value using the command `pulumi config set iac-workshop:container <value>`
...
```

Configure the `iac-workshop:container` variable:

```bash
pulumi config set container html
```

To make things interesting, I set the name to `html` which is different from the previously hard-coded value `files`.

Run `pulumi up` again. This detects that the container has changed and will perform a simple update:

```
Updating (dev):

     Type                                           Name              Status      Info
     pulumi:pulumi:Stack                            iac-workshop-dev
  +- └─ azure-nextgen:storage/latest:BlobContainer  mycontainer       replaced    [diff: ~containerName]

Outputs:
    AccountName: "myuniquename"

Resources:
    +-1 replaced
    3 unchanged

Duration: 10s

Permalink: https://app.pulumi.com/myuser/iac-workshop/dev/updates/5
```

And you will see the contents added above.

## Next Steps

* [Creating a Second Stack](./06-creating-a-second-stack.md)
