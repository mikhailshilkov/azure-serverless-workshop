import "./common";
import * as cosmos from "./cosmos";
import { namespace, sendConnectionString } from "./eventHub";

export const cosmosDatabaseName = cosmos.databaseName;
export const cosmosCollectionName = cosmos.collectionName;
export const cosmosConnectionString = cosmos.connectionString;
export const cosmosEndpoint = cosmos.endpoint;
export const cosmosMasterKey = cosmos.masterKey;

export const eventHubNamespace = namespace;
export const eventHubSendConnectionString = sendConnectionString;
