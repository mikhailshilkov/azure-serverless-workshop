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

const versionSet = new apimanagement.ApiVersionSet("dronestatusversionset", {
    resourceGroupName: resourceGroupName,
    serviceName: apiManagement.name,
    versionSetId: "dronestatusversionset",
    displayName: "Drone Delivery API",
    versioningScheme: "Segment",
});

const api = new apimanagement.Api("dronedeliveryapiv1", {
    resourceGroupName: resourceGroupName,
    serviceName: apiManagementName,
    apiId: "dronedeliveryapiv1",
    displayName: "Drone Delivery API",
    description: "Drone Delivery API",
    path: "api",
    apiVersion: "v1",
    apiRevision: "1",
    apiVersionSetId: versionSet.id,
    protocols: ["https"],
});

const apiOperation = new apimanagement.ApiOperation("dronestatusGET", {
    resourceGroupName: resourceGroupName,
    serviceName: apiManagementName,
    apiId: api.name,
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

const backend = new apimanagement.Backend("dronestatusdotnet", {
    resourceGroupName: resourceGroupName,
    serviceName: apiManagementName,
    backendId: "dronestatusdotnet",
    resourceId: pulumi.interpolate`https://management.azure.com/${functionApp.id}`,
    // credentials: {
    //     query: {
    //         code: pulumi.interpolate`{{${apiValueFunctionCode.name}}}`,
    //     },
    // },
    url: functionApp.appUrl,
    protocol: "http",
});

const apiPolicy = new apimanagement.ApiPolicy("policy", {
    resourceGroupName: resourceGroupName,
    serviceName: apiManagementName,
    apiId: api.name,
    policyId: "policy",
    value: pulumi.interpolate`
<policies>
    <inbound>
        <base />
        <cors allow-credentials="true">
            <allowed-origins>
                <origin>${website.storageAccountUrl}</origin>
                <origin>${website.cdnUrl}</origin>
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

const product = new apimanagement.Product("dronedeliveryprodapi", {
    resourceGroupName: resourceGroupName,
    serviceName: apiManagementName,
    productId: "dronedeliveryprodapi",
    displayName: "drone delivery product api",
    description: "drone delivery product api",
    terms: "terms for example product",
    subscriptionRequired: false,    
    state: "published",
});

const productApi = new azure.apimanagement.ProductApi("dronedeliveryapiv1", {
    resourceGroupName: resourceGroupName,
    apiManagementName: apiManagementName,
    apiName: api.name,
    productId: product.name,
});

export const apiUrl = pulumi.interpolate`https://${apiManagementName}.azure-api.net/${api.path}/v1/dronestatus/`;
