import * as resources from "@pulumi/azure-nextgen/resources/latest";

export const appName = "status";

const resourceGroup = new resources.ResourceGroup(`${appName}-rg`, {
    resourceGroupName: `${appName}-rg`,
    location: "WestEurope",
});

export const resourceGroupName = resourceGroup.name;
export const resourceGroupId = resourceGroup.id;
export const location = resourceGroup.location;
