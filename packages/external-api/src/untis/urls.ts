import { externalApiHttpConfig } from "../http/config";

const untisApiBasePath = "/WebUntis/api/rest/view/v1";

const withLeadingSlash = (path: string) => (path.startsWith("/") ? path : `/${path}`);

export const untisLegacyBaseUrl = externalApiHttpConfig.untis.legacyBaseUrl;

export const untisSchoolSearchUrl = `${externalApiHttpConfig.untis.schoolSearchBaseUrl}/schoolquery2`;

export const untisSchoolBaseUrl = (server: string) => `https://${server}`;

export const untisLegacyApiUrl = (path: string) => `${untisLegacyBaseUrl}${untisApiBasePath}${withLeadingSlash(path)}`;
