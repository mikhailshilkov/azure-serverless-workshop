// ------------------------------------------------------------
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License (MIT). See License.txt in the repo root for license information.
// ------------------------------------------------------------

export const getAdalConfig = () => {
  return {
    apiId: "[APP_ID]",
    clientId: "[CLIENT_ID]",
    instance: `https://login.microsoftonline.com/`,
    postLogoutRedirectUri: window.location.origin,
    tenant: "[TENANT_ID]",
  };
}

export const getApiConfig = () =>
{
  return {
    url: "[API_URL]"
  };
}