import { templateKindFor } from "../config/ticket-routing.js";

export const TEMPLATE_DIVIDER = "---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------";
export const GEN2_DIVIDER = "----------------------------------------------------";

export const STANDARD_RESET_TEMPLATE = `Template Header (DO NOT REMOVE)
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

Cradlepoint Serial Number:
IMEI:
Carrier:

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

export const GEN2_RESET_TEMPLATE = `Template Header (DO NOT REMOVE)
**Update and Delete Systems Not Used**
${GEN2_DIVIDER}
Slack Thread URL:

•Workstation:
Site Name:
Account Number (optional):
Time of Issue:
Screenshot ( if possible):

•Onsite App:
Site Name:
Account Number (optional):
Current Task:
Time of Issue:
Screenshot ( if possible):
IOS Version:
App Version:
Device ID (If vending related Task):

•GVEND3:
Site Name:
Account Number (optional):
Storage Unit: 
Time of Issue:
Software Version:
Screenshot ( if possible):
Device ID:

•KS WEB Customer:
Site Name:
Account Number (optional):
Customer Admin Name: 
Customer Admin Email: 
Browser:  
Time of Issue: 
Screenshot ( if possible): attached

**[Update before closing INC, remove description in between parenthesis ( ) ]**
Issue: 
Troubleshooting:
Resolution:
Root Cause:
Issue Type: (Data Load Failure, Data Maintenance, Knowledge Gap, System, Hardware)
Why are we making changes to the data:`;

// Backward-compatible export name used by older tests/imports.
export const RESET_TEMPLATE = STANDARD_RESET_TEMPLATE;

const value = (fields, key) => String(fields?.[key] || "").trim();

function standardHeader() {
  return `Template Header (DO NOT REMOVE)
**Delete any unused sections below**
${TEMPLATE_DIVIDER}
Slack Thread URL:

Parent/PRB Template: [Update/add to section below with all required data from Parents/PRB's]`;
}

function identityTemplate(fields) {
  return `${standardHeader()}

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

function pcDataTemplate(fields) {
  return `${machineTemplate(fields)}

Cradlepoint Serial Number: ${value(fields, "cradlepointSerial")}
IMEI: ${value(fields, "imei")}
Carrier: ${value(fields, "carrier")}

Badge Reader: ${value(fields, "badgeReader")}
Model: ${value(fields, "model")}`;
}

function gcomAppTemplate(fields) {
  return `${identityTemplate(fields)}


Phone Model: ${value(fields, "phoneModel")}
Phone Software Version: ${value(fields, "phoneSoftwareVersion")}
Application: ${value(fields, "application")}
Application Version: ${value(fields, "applicationVersion")}
Time issue occurred: ${value(fields, "timeIssueOccurred")}`;
}

function standardTemplate(fields) {
  return `${pcDataTemplate(fields)}

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

function gen2Header() {
  return `Template Header (DO NOT REMOVE)
**Update and Delete Systems Not Used**
${GEN2_DIVIDER}
Slack Thread URL:`;
}

function gen2Closing(fields, analysis = {}) {
  const issue = String(analysis?.issueSummary || "").trim();
  const steps = Array.isArray(analysis?.troubleshootingSteps) ? analysis.troubleshootingSteps.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const troubleshooting = steps.length ? `\n${steps.map((step) => `- ${step}`).join("\n")}` : "";
  const resolution = String(analysis?.resolution || "").trim();
  const rootCause = value(fields, "rootCause");
  const issueType = value(fields, "issueType");
  const whyDataChanges = value(fields, "whyDataChanges");
  return `**[Update before closing INC, remove description in between parenthesis ( ) ]**
Issue: ${issue}
Troubleshooting:${troubleshooting}
Resolution: ${resolution}
Root Cause: ${rootCause}
Issue Type: ${issueType || "(Data Load Failure, Data Maintenance, Knowledge Gap, System, Hardware)"}
Why are we making changes to the data: ${whyDataChanges}`;
}


function gen2WorkstationTemplate(fields, analysis) {
  return `${gen2Header()}

•Workstation:
Site Name: ${value(fields, "siteName")}
Account Number (optional): ${value(fields, "accountNumber")}
Time of Issue: ${value(fields, "timeIssueOccurred")}
Screenshot ( if possible): ${value(fields, "screenshot")}

${gen2Closing(fields, analysis)}`;
}

function gen2OnsiteMobileTemplate(fields, analysis) {
  return `${gen2Header()}

•Onsite App:
Site Name: ${value(fields, "siteName")}
Account Number (optional): ${value(fields, "accountNumber")}
Current Task: ${value(fields, "currentTask")}
Time of Issue: ${value(fields, "timeIssueOccurred")}
Screenshot ( if possible): ${value(fields, "screenshot")}
IOS Version: ${value(fields, "iosVersion")}
App Version: ${value(fields, "appVersion")}
Device ID (If vending related Task): ${value(fields, "deviceId")}

${gen2Closing(fields, analysis)}`;
}

function gen2WebCustomerTemplate(fields, analysis) {
  return `${gen2Header()}

•KS WEB Customer:
Site Name: ${value(fields, "siteName")}
Account Number (optional): ${value(fields, "accountNumber")}
Customer Admin Name: ${value(fields, "customerAdminName")}
Customer Admin Email: ${value(fields, "customerAdminEmail")}
Browser: ${value(fields, "browser")}
Time of Issue: ${value(fields, "timeIssueOccurred")}
Screenshot ( if possible): ${value(fields, "screenshot") || "attached"}

${gen2Closing(fields, analysis)}`;
}

function gen2Gvend3Template(fields, analysis) {
  return `${gen2Header()}

•GVEND3:
Site Name: ${value(fields, "siteName")}
Account Number (optional): ${value(fields, "accountNumber")}
Storage Unit: ${value(fields, "storageUnit")}
Time of Issue: ${value(fields, "timeIssueOccurred")}
Software Version: ${value(fields, "softwareVersion")}
Screenshot ( if possible): ${value(fields, "screenshot")}
Device ID: ${value(fields, "deviceId")}

•KS WEB Customer:
Site Name: ${value(fields, "siteName")}
Account Number (optional): ${value(fields, "accountNumber")}
Customer Admin Name: ${value(fields, "customerAdminName")}
Customer Admin Email: ${value(fields, "customerAdminEmail")}
Browser: ${value(fields, "browser")}
Time of Issue: ${value(fields, "timeIssueOccurred")}
Screenshot ( if possible): ${value(fields, "screenshot") || "attached"}

${gen2Closing(fields, analysis)}`;
}

export function renderDetailedDescription({ categoryId, subcategoryId, fields, analysis = {} }) {
  const kind = templateKindFor(categoryId, subcategoryId);
  if (kind === "onsite") return identityTemplate(fields);
  if (kind === "machine") return machineTemplate(fields);
  if (kind === "pc_data") return pcDataTemplate(fields);
  if (kind === "gcom_app") return gcomAppTemplate(fields);
  if (kind === "gen2_workstation") return gen2WorkstationTemplate(fields, analysis);
  if (kind === "gen2_onsite_mobile_app") return gen2OnsiteMobileTemplate(fields, analysis);
  if (kind === "gen2_web_customer") return gen2WebCustomerTemplate(fields, analysis);
  if (kind === "gen2_gvend3") return gen2Gvend3Template(fields, analysis);
  return standardTemplate(fields);
}
