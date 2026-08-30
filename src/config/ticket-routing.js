const pair = (id, label, template = null) => ({ id, label, ...(template ? { template } : {}) });

const IDENTITY_FIELDS = ["cribProgramId", "programName", "companyName", "siteId", "accountNumber"];
const MACHINE_FIELDS = [...IDENTITY_FIELDS, "softwareVersion", "deviceId", "machineSerial"];
const PC_DATA_FIELDS = [...MACHINE_FIELDS, "cradlepointSerial", "imei", "carrier", "badgeReader", "model"];
const GCOM_FIELDS = [...IDENTITY_FIELDS, "phoneModel", "phoneSoftwareVersion", "application", "applicationVersion", "timeIssueOccurred"];
const STANDARD_FIELDS = [
  ...PC_DATA_FIELDS,
  "phoneModel", "phoneSoftwareVersion", "application", "applicationVersion", "timeIssueOccurred",
  "orderNumber", "econnectionsStatus", "sapStatusEbu", "orderReposted"
];
const GEN2_CLOSE_FIELDS = ["rootCause", "issueType", "whyDataChanges"];

export const TICKET_ROUTES = [
  {
    id: "keepstock_mobilecast",
    label: "Keepstock - MobileCast",
    template: "standard",
    templateFamily: "standard",
    verifyFields: STANDARD_FIELDS,
    subcategories: [
      pair("mobilecast_access_login", "Access/login"),
      pair("mobilecast_routing", "Routing"),
      pair("mobilecast_other", "other")
    ]
  },
  {
    id: "keepstock_gcom_mobile_app",
    label: "Keepstock - GCOM App",
    template: "gcom_app",
    templateFamily: "standard",
    verifyFields: GCOM_FIELDS,
    subcategories: [
      pair("gcom_access_login", "access/login"),
      pair("gcom_barcode_label", "Barcode label"),
      pair("gcom_bluetooth_scanner", "Bluetooth Scanner"),
      pair("gcom_camera_scanner", "Camera Scanner"),
      pair("gcom_cart", "Cart"),
      pair("gcom_ks_items", "Ks Items"),
      pair("gcom_other", "other")
    ]
  },
  {
    id: "keepstock_canada_onsite",
    label: "Keepstock Canada - Onsite",
    template: "onsite",
    templateFamily: "standard",
    verifyFields: IDENTITY_FIELDS,
    subcategories: [
      pair("canada_access_login", "Access/Login"),
      pair("canada_cs_software", "CS Software"),
      pair("canada_email_notification", "Email notification"),
      pair("canada_item_data", "Item Data"),
      pair("canada_item_maintenance", "Item maintenance"),
      pair("canada_mrf_issue", "MRF Issue"),
      pair("canada_mrf_required", "MRF required"),
      pair("canada_order_approval", "order approval"),
      pair("canada_program_maintenance", "program maintenance"),
      pair("canada_other", "other")
    ]
  },
  {
    id: "keepstock_seaga_cm",
    label: "Keepstock - Seaga / CM",
    template: "machine",
    templateFamily: "standard",
    verifyFields: MACHINE_FIELDS,
    subcategories: [
      pair("machine_drop_sensor", "Hardware issue: - Drop sensor"),
      pair("machine_lightning", "Hardware issue: - lightning"),
      pair("machine_transformer", "Hardware issue: - transformer"),
      pair("machine_fuses", "Hardware issue: - Fuses"),
      pair("machine_internal_keypad", "Hardware issue: - Internal Keypad"),
      pair("machine_main_board", "Hardware issue: - Main board"),
      pair("machine_main_harness", "Hardware issue: - Main harness"),
      pair("machine_motors", "Hardware issue: - Motors"),
      pair("machine_power_supply", "Hardware issue: - Power supply"),
      pair("machine_tray", "Hardware issue: - Tray"),
      pair("machine_tray_harness", "Hardware issue: - Tray harness"),
      pair("machine_replacement", "Hardware issue: - Machine Replacement Request"),
      pair("machine_physical_damage", "physical damage"),
      pair("machine_product_sizing", "Product sizing"),
      pair("machine_other", "other")
    ]
  },
  {
    id: "keepstock_cm_pc_data",
    label: "Keepstock - CM - PC/Data",
    template: "pc_data",
    templateFamily: "standard",
    verifyFields: PC_DATA_FIELDS,
    subcategories: [
      pair("cm_data_atr", "Data issue ATR setting"),
      pair("cm_craftcodes_uda", "craftcodes/uda"),
      pair("cm_item_data", "item data"),
      pair("cm_user_login", "data issue-user/login"),
      pair("cm_comports", "hardware issue - ComPorts"),
      pair("cm_badge_existing", "hardware issue - Existing badge reader"),
      pair("cm_badge_new", "hardware issue - New badge reader"),
      pair("cm_touchscreen", "hardware issue - Touchscreen"),
      pair("cm_network_cellular", "Network issue - Cellular"),
      pair("cm_network_customer", "Network issue - Customer network"),
      pair("cm_reporting_po", "reporting-PO issue"),
      pair("cm_software_issue", "Software issue"),
      pair("cm_other", "other")
    ]
  },
  {
    id: "keepstock_seaga_pc_data",
    label: "Keepstock - Seaga - PC/Data",
    template: "pc_data",
    templateFamily: "standard",
    verifyFields: PC_DATA_FIELDS,
    subcategories: [
      pair("seaga_data_atr", "Data issue ATR setting"),
      pair("seaga_craftcodes_uda", "craftcodes/uda"),
      pair("seaga_item_data", "item data"),
      pair("seaga_user_login", "data issue-user/login"),
      pair("seaga_comports", "hardware issue - ComPorts"),
      pair("seaga_badge_existing", "hardware issue - Existing badge reader"),
      pair("seaga_badge_new", "hardware issue - New badge reader"),
      pair("seaga_touchscreen", "hardware issue - Touchscreen"),
      pair("seaga_network_cellular", "Network issue - Cellular"),
      pair("seaga_network_customer", "Network issue - Customer network"),
      pair("seaga_reporting_po", "reporting-PO issue"),
      pair("seaga_software_issue", "Software issue"),
      pair("seaga_other", "other")
    ]
  },
  {
    id: "keepstock_onsite",
    label: "Keepstock - Onsite",
    template: "onsite",
    templateFamily: "standard",
    verifyFields: IDENTITY_FIELDS,
    subcategories: [
      pair("onsite_email_notification", "Email notification"),
      pair("onsite_drop_call", "Drop call-immediately"),
      pair("onsite_ks_console", "KS console"),
      pair("onsite_ks_console_access", "KS console - access/login"),
      pair("onsite_ks_console_reports", "KS console - Report manager"),
      pair("onsite_web_groups", "KS Web - User groups/Product groups"),
      pair("onsite_web_access", "KS Web - Access/login"),
      pair("onsite_web_item_management", "KS Web - item management"),
      pair("onsite_web_labels", "KS Web - Labels"),
      pair("onsite_web_reporting", "KS Web - Reporting"),
      pair("onsite_web_order_status", "KS Web - Order Status Viewer"),
      pair("onsite_web_user_management", "KS Web - User management"),
      pair("onsite_consignment", "consignment issue"),
      pair("onsite_cmi_scanner", "CMI scanner"),
      pair("onsite_mrf_issue", "MRF Issue"),
      pair("onsite_mrf_required", "MRF required"),
      pair("onsite_new_customer", "New customer request"),
      pair("onsite_approver_update", "Approver update"),
      pair("onsite_order_cs", "Order issue - CS"),
      pair("onsite_order_epro", "Order issue - Epro"),
      pair("onsite_order_gcom", "Order issue - GCOM"),
      pair("onsite_parts_assistance", "Parts Assistance"),
      pair("onsite_other", "other")
    ]
  },
  {
    id: "keepstock_gen2_onsite_mobile_app",
    label: "Keepstock Gen2 - Onsite Mobile App",
    template: "gen2_onsite_mobile_app",
    templateFamily: "gen2",
    verifyFields: ["siteName", "accountNumber", "currentTask", "timeIssueOccurred", "screenshot", "iosVersion", "appVersion", "deviceId", ...GEN2_CLOSE_FIELDS],
    subcategories: [pair("gen2_onsite_mobile_other", "other")]
  },
  {
    id: "keepstock_gen2_web_customer",
    label: "Keepstock Gen2 - Web Customer",
    template: "gen2_web_customer",
    templateFamily: "gen2",
    verifyFields: ["siteName", "accountNumber", "customerAdminName", "customerAdminEmail", "browser", "timeIssueOccurred", "screenshot", ...GEN2_CLOSE_FIELDS],
    subcategories: [pair("gen2_web_customer_other", "other")]
  },
  {
    id: "keepstock_gen2_gvend3",
    label: "Keepstock Gen2 - GVEND 3",
    template: "gen2_gvend3",
    templateFamily: "gen2",
    verifyFields: ["siteName", "accountNumber", "storageUnit", "timeIssueOccurred", "softwareVersion", "screenshot", "deviceId", "customerAdminName", "customerAdminEmail", "browser", ...GEN2_CLOSE_FIELDS],
    subcategories: [pair("gen2_gvend3_other", "other")]
  }
];

const LEGACY_CATEGORY_MAP = new Map([
  ["keepstock - cm - ams toolbox", "keepstock_seaga_cm"],
  ["keepstock - cm - locker", "keepstock_seaga_cm"],
  ["keepstock - cm - carousel", "keepstock_seaga_cm"],
  ["keepstock - seaga - coil", "keepstock_seaga_cm"],
  ["keepstock - seaga - locker", "keepstock_seaga_cm"],
  ["keepstock - gcom mobile app", "keepstock_gcom_mobile_app"]
]);

const normalize = (value) => String(value || "").toLowerCase().replace(/\s+/g, " ").trim();

export function getCategory(categoryId) {
  return TICKET_ROUTES.find((item) => item.id === categoryId) || null;
}

export function getSubcategory(categoryId, subcategoryId) {
  return getCategory(categoryId)?.subcategories.find((item) => item.id === subcategoryId) || null;
}

export function categoryLabel(categoryId) {
  return getCategory(categoryId)?.label || "";
}

export function subcategoryLabel(categoryId, subcategoryId) {
  return getSubcategory(categoryId, subcategoryId)?.label || "";
}

export function templateKindFor(categoryId, subcategoryId) {
  const category = getCategory(categoryId);
  if (!category) return "standard";
  return getSubcategory(categoryId, subcategoryId)?.template || category.template || "standard";
}

export function templateFamilyFor(categoryId) {
  return getCategory(categoryId)?.templateFamily || "standard";
}

export function verifyFieldIdsFor(categoryId) {
  return [...(getCategory(categoryId)?.verifyFields || [])];
}

export function resolveCategoryId(value) {
  if (!value) return "";
  if (getCategory(value)) return value;
  const normalized = normalize(value);
  if (LEGACY_CATEGORY_MAP.has(normalized)) return LEGACY_CATEGORY_MAP.get(normalized);
  return TICKET_ROUTES.find((item) => normalize(item.label) === normalized)?.id || "";
}

export function resolveSubcategoryId(categoryId, value) {
  if (!value) return "";
  const category = getCategory(categoryId);
  if (!category) return "";
  if (category.subcategories.some((item) => item.id === value)) return value;
  const normalized = normalize(value);
  return category.subcategories.find((item) => normalize(item.label) === normalized)?.id || "";
}

export function defaultCategoryId() {
  return "";
}
