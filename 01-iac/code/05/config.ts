import { Config } from "@pulumi/pulumi";

const config = new Config();
export const containerName = config.require("container");
