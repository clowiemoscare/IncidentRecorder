import { templateKindFor } from "../config/ticket-routing.js";

export const TEMPLATE_DIVIDER = "---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------";

export const RESET_TEMPLATE = `Template Header (DO NOT REMOVE)
**Delete any unused sections below**
${TEMPLATE_DIVIDER}
Slack Thread URL:


Parent/PRB Template: [Update/add to section below with all required data from Parents/PRB's]


Crib/Program id: 
Program name: 
Company name: 
Site ID (If Applicable): 
Acct #:




Software Version:
Device ID (Affected): 
Machine Serial Number(s):




Badge Reader:
Model:

Phone Model:
Phone Software Version:
Application:
Application Version:
Time issue occurred:


Order #:
eConnections Status:
SAP Status/EBU Number:
Does user want order reposted:`;

const value = (fields, key) => String(fields?.[key] || "").trim();

function identityTemplate(fields) {
  return `Template Header (DO NOT REMOVE)
**Delete any unused sections below**
${TEMPLATE_DIVIDER}
Slack Thread URL:

Parent/PRB Template: [Update/add to section below with all required data from Parents/PRB's]

Crib/Program id: ${value(fields, "cribProgramId")}
Program name: ${value(fields, "programName")}
Company name: ${value(fields, "companyName")}
Site ID (If Applicable): ${value(fields, "siteId")}
Acct #: ${value(fields, "accountNumber")}`;
}

function machineTemplate(fields) {
  return `${identityTemplate(fields)}


Software Version: ${value(fields, "softwareVersion")}
Device ID (Affected): ${value(fields, "deviceId")}
Machine Serial Number(s): ${value(fields, "machineSerial")}`;
}

export function renderDetailedDescription({ categoryId, subcategoryId, fields }) {
  const kind = templateKindFor(categoryId, subcategoryId);
  if (kind === "onsite") return identityTemplate(fields);
  if (kind === "machine") return machineTemplate(fields);
  if (kind === "cellular") {
    return `${machineTemplate(fields)}

Cradlepoint Serial Number: ${value(fields, "cradlepointSerial")}
IMEI: ${value(fields, "imei")}
Carrier: ${value(fields, "carrier")}`;
  }
  if (kind === "badge") {
    return `${machineTemplate(fields)}


Badge Reader: ${value(fields, "badgeReader")}
Model: ${value(fields, "model")}`;
  }
  return `${machineTemplate(fields)}

Cradlepoint Serial Number: ${value(fields, "cradlepointSerial")}
IMEI: ${value(fields, "imei")}
Carrier: ${value(fields, "carrier")}

Badge Reader: ${value(fields, "badgeReader")}
Model: ${value(fields, "model")}

Phone Model: ${value(fields, "phoneModel")}
Phone Software Version: ${value(fields, "phoneSoftwareVersion")}
Application: ${value(fields, "application")}
Application Version: ${value(fields, "applicationVersion")}
Time issue occurred: ${value(fields, "timeIssueOccurred")}

Order #: ${value(fields, "orderNumber")}
eConnections Status: ${value(fields, "econnectionsStatus")}
SAP Status/EBU Number: ${value(fields, "sapStatusEbu")}
Does user want order reposted: ${value(fields, "orderReposted")}`;
}
