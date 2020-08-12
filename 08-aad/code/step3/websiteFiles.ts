import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import * as website from "./website";
import * as mime from "mime";
import * as nodedir from "node-dir";
import * as fs from "fs";
import * as api from "./api";

const folderName = "droneapp-auth";
const files = nodedir.files(folderName, { sync: true });
for (const file of files) {
    const name = file.substring(folderName.length+1);
    const contentType = mime.getType(file) || undefined;

    const rawText = fs.readFileSync(file, "utf8").toString();
    const asset = pulumi.all([api.apiUrl, website.tenantId, website.applicationId])
        .apply(([url, tenant, app]) => 
            rawText.replace("[API_URL]", url)
                .replace("[TENANT_ID]", tenant)
                .replace("[APP_ID]", app)
                .replace("[CLIENT_ID]", app))
        .apply(text => new pulumi.asset.StringAsset(text));

    const myObject = new azure.storage.Blob(name, {
        name,
        storageAccountName: website.storageAccount.name,
        storageContainerName: "$web",
        type: "Block",
        source: asset,
        contentType,
    }, { parent: website.storageAccount });
}
