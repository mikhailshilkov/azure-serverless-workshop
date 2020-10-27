import * as pulumi from "@pulumi/pulumi";
import * as apimanagement from "@pulumi/azure-nextgen/apimanagement/latest";
import * as azure from "@pulumi/azure";
import { appName, location, resourceGroupName } from "./common";
import * as functionApp from "./functionApp";
import * as website from "./website";

const apiManagementName = `${appName}-apim`;
const apiManagement = new apimanagement.ApiManagementService(apiManagementName, {
    resourceGroupName: resourceGroupName,
    serviceName: apiManagementName,
    location: location,
    sku: {
        name: "Consumption",
        capacity: 0,
    },
    publisherEmail: "drones@contoso.com",
    publisherName: "contoso",
});
const apiManagementId = apiManagement.id;
