import * as azure from "@pulumi/azure";
import { appName, location, resourceGroupName } from "./common";

const databaseAccount = new azure.cosmosdb.Account(`${appName}-acc`, {
    resourceGroupName: resourceGroupName,
    offerType: "Standard",
    geoLocations: [{ location: location, failoverPriority: 0 }],
    consistencyPolicy: {
        consistencyLevel: "Session",
    },
});

export const databaseName = "db";
const database = new azure.cosmosdb.SqlDatabase(databaseName, {
    name: databaseName,
    resourceGroupName: resourceGroupName,
    accountName: databaseAccount.name,
}, { parent: databaseAccount });

export const collectionName = "items";
const collection = new azure.cosmosdb.SqlContainer(collectionName, {
    name: collectionName,
    resourceGroupName: resourceGroupName,
    accountName: databaseAccount.name,
    databaseName: database.name,
    partitionKeyPath: "/id",
}, { parent: database });

export const connectionString = databaseAccount.connectionStrings[0];
export const endpoint = databaseAccount.endpoint;
export const masterKey = databaseAccount.primaryMasterKey;
