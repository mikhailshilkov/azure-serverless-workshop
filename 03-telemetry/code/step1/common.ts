import * as azure from "@pulumi/azure";

export const appName = "telemetry";

const resourceGroup = new azure.core.ResourceGroup(`${appName}-rg`);
export const resourceGroupName = resourceGroup.name;
export const location = resourceGroup.location;
