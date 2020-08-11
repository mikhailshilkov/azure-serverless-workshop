import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import { appName, resourceGroupId, resourceGroupName } from "./common";
import * as functionApp from "./functionApp";
import * as website from "./website";

const apiManagementName = `${appName}-apim`;
const arm = `{
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [{
        "apiVersion": "2019-12-01",
        "name": "${apiManagementName}",
        "type": "Microsoft.ApiManagement/service",
        "location": "westeurope",
        "sku": {
            "name": "Consumption",
            "capacity": "0"
        },
        "properties": {
            "publisherEmail": "drones@contoso.com",
            "publisherName": "contoso"
        }
    }]
}`;

const template = new azure.core.TemplateDeployment(`${appName}-at`, {
    resourceGroupName: resourceGroupName,
    templateBody: arm,
    deploymentMode: "Incremental",
});
const apiManagementId = `${resourceGroupId}/providers/Microsoft.ApiManagement/service/${apiManagementName}`;

const versionSet = new azure.apimanagement.ApiVersionSet("dronestatusversionset", {
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    name: "dronestatusversionset",
    displayName: "Drone Delivery API",
    versioningScheme: "Segment",
});

const api = new azure.apimanagement.Api("dronedeliveryapiv1", {
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    displayName: "Drone Delivery API",
    description: "Drone Delivery API",
    path: "api",
    version: "v1",
    revision: "1",
    versionSetId: versionSet.id,
    protocols: ["https"],
});

const apiOperation = new azure.apimanagement.ApiOperation("dronestatusGET", {
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    apiName: api.name,
    operationId: "dronestatusGET",
    displayName: "Retrieve drone status",
    description: "Retrieve drone status",
    method: "GET",
    urlTemplate: "/dronestatus/{deviceid}",
    templateParameters: [
        {
            name: "deviceid",
            description: "device id",
            type: "string",
            required: true,
        },
    ],
});

const apiValueFunctionCode = new azure.apimanagement.NamedValue("getstatusfunctionapp-code", {
    name: "getstatusfunctionapp-code",
    displayName: "getstatusfunctionapp-code",
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    tags: ["key", "function", "code"],
    secret: true,
    value: functionApp.key,
});

const backend = new azure.apimanagement.Backend("dronestatusdotnet", {
    name: "dronestatusdotnet",
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    resourceId: pulumi.interpolate`https://management.azure.com/${functionApp.id}`,
    credentials: {
        query: {
            code: pulumi.interpolate`{{${apiValueFunctionCode.name}}}`,
        },
    },
    url: functionApp.appUrl,
    protocol: "http",
});

const apiPolicy = new azure.apimanagement.ApiPolicy("policy", {
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    apiName: api.name,
    xmlContent: pulumi.interpolate`
<policies>
    <inbound>
        <base />
        <cors allow-credentials="true">
            <allowed-origins>
                <origin>${website.storageAccountUrl}</origin>
            </allowed-origins>
            <allowed-methods><method>GET</method></allowed-methods>
            <allowed-headers><header>*</header></allowed-headers>
        </cors>
        <rewrite-uri template="GetStatusFunction?deviceId={deviceid}" />
        <set-backend-service id="apim-generated-policy" backend-id="${backend.name}" />
    </inbound>
    <backend>
        <forward-request />
    </backend>
    <outbound>
        <base />
    </outbound>
    <on-error>
        <base />
    </on-error>
</policies>`,
});

const product = new azure.apimanagement.Product("dronedeliveryprodapi", {
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    productId: "dronedeliveryprodapi",
    displayName: "drone delivery product api",
    description: "drone delivery product api",
    terms: "terms for example product",
    subscriptionRequired: false,
    published: true,
});

const productApi = new azure.apimanagement.ProductApi("dronedeliveryapiv1", {
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    apiName: api.name,
    productId: product.productId,
});

export const apiUrl = pulumi.interpolate`https://${apiManagementName}.azure-api.net/${api.path}/v1/dronestatus/`;
