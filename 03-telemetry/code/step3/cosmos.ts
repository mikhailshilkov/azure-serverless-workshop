import * as pulumi from "@pulumi/pulumi";
import * as documentdb from "@pulumi/azure-nextgen/documentdb/latest";
import { appName, location, resourceGroupName } from "./common";

const databaseAccount = new documentdb.DatabaseAccount(`${appName}-acc`, {
    resourceGroupName: resourceGroupName,
    accountName: `${appName}-acc`,
    location: location,
    databaseAccountOfferType: "Standard",
    capabilities: [{
        name: "EnableServerless",
    }],
    locations: [{ locationName: location, failoverPriority: 0 }],
    consistencyPolicy: {
        defaultConsistencyLevel: "Session",
    },
});

export const databaseName = "db";
const database = new documentdb.SqlResourceSqlDatabase(databaseName, {    
    databaseName: databaseName,
    resourceGroupName: resourceGroupName,
    accountName: databaseAccount.name,
    resource: {
        id: databaseName,
    },
    options: {},
}, { parent: databaseAccount });

export const collectionName = "items";
const collection = new documentdb.SqlResourceSqlContainer(collectionName, {
    containerName: collectionName,
    resourceGroupName: resourceGroupName,
    accountName: databaseAccount.name,
    databaseName: database.name,
    resource: {
        id: collectionName,
        partitionKey: {
            paths: ["/id"]
        },
    },
    options: {},
}, { parent: database });

const keys = pulumi.all([resourceGroupName, databaseAccount.name])
    .apply(([resourceGroupName, accountName]) =>
        documentdb.listDatabaseAccountKeys({ resourceGroupName, accountName }));

const connectionStrings = pulumi.all([resourceGroupName, databaseAccount.name])
    .apply(([resourceGroupName, accountName]) =>
        documentdb.listDatabaseAccountConnectionStrings({ resourceGroupName, accountName }));

export const connectionString = connectionStrings.apply(cs => cs.connectionStrings![0].connectionString);
export const endpoint = databaseAccount.documentEndpoint;
export const masterKey = keys.primaryMasterKey;
