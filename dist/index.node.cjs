"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const WebIfc = require("web-ifc"), fragments = require("@thatopen/fragments"), fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto"), sqlite3 = require("sqlite3"), sqlite = require("sqlite");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : { enumerable: true, get: () => e[k] });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const WebIfc__namespace = /* @__PURE__ */ _interopNamespaceDefault(WebIfc);
class Registry {
  constructor() {
    this.readers = [];
    this.writers = [];
  }
  /**
   * Register a new reader class.
   *
   * @param {Function} readerClass - Reader class to add.
   *   Must define `environments`, `formats`, and `priority` as static fields.
   * @returns {Promise<void>}
   */
  async addReader(readerClass) {
    this.readers.push(readerClass);
  }
  /**
   * Register a new writer class.
   *
   * @param {Function} writerClass - Writer class to add.
   *   Must define `environments`, `formats`, and `priority` as static fields.
   * @returns {Promise<void>}
   */
  async addWriter(writerClass) {
    this.writers.push(writerClass);
  }
  /**
   * Find the most suitable reader for a given environment and input type.
   *
   * Readers are filtered by environment and format, then sorted by descending priority.
   * The highest-priority match is returned.
   *
   * @param {"node"|"browser"} env - Target environment.
   * @param {string} type - Input type/format (e.g., `"ifc"`, `"frag"`).
   * @returns {Function|undefined} Matching reader class, or `undefined` if none found.
   */
  findReader(env, type) {
    const matches = this.readers.filter((r) => r.environments.includes(env) && r.formats.includes(type)).sort((a, b) => b.priority - a.priority);
    return matches[0];
  }
  /**
   * Find the most suitable writer for a given environment and output format.
   *
   * Writers are filtered by environment and format, then sorted by descending priority.
   * The highest-priority match is returned.
   *
   * @param {"node"|"browser"} env - Target environment.
   * @param {string} [format="sqlite"] - Output format (e.g., `"sqlite"`, `"xlsx"`).
   * @returns {Function|undefined} Matching writer class, or `undefined` if none found.
   */
  findWriter(env, format = "sqlite") {
    const matches = this.writers.filter((w) => w.environments.includes(env) && w.formats.includes(format)).sort((a, b) => b.priority - a.priority);
    return matches[0];
  }
  /**
   * Find the most compatible reader/writer pair for a given conversion.
   *
   * The method looks up all registered readers that support the given input
   * format and environment, and all writers that support the given output
   * format and environment. It then tries to match them by checking if the
   * reader can produce a data type that the writer can consume. The highest-
   * priority matching pair is returned.
   *
   * @param {"node"|"browser"} env - Target environment in which conversion runs.
   * @param {string} inputFormat - Input format (e.g., `"ifc"`, `"frag"`).
   * @param {string} outputFormat - Output format (e.g., `"sqlite"`, `"xlsx"`).
   * @returns {{
   *   ReaderClass: Function,
   *   WriterClass: Function,
   *   dataType: string
   * } | null} Matching pair with the agreed `dataType`, or `null` if none found.
   */
  findCompatiblePair(env, inputFormat, outputFormat = "sqlite") {
    const readers = this.readers.filter((r) => r.environments.includes(env) && r.formats.includes(inputFormat));
    const writers = this.writers.filter((w) => w.environments.includes(env) && w.formats.includes(outputFormat));
    for (const ReaderClass of readers.sort((a, b) => b.priority - a.priority)) {
      for (const WriterClass of writers.sort((a, b) => b.priority - a.priority)) {
        const type = (ReaderClass.outputs || []).find((t) => (WriterClass.inputs || []).includes(t));
        if (type) {
          return { ReaderClass, WriterClass, dataType: type };
        }
      }
    }
    return null;
  }
}
const registry = new Registry();
const IS_NODE = typeof process !== "undefined" && process?.versions?.node;
const ENV = IS_NODE ? "node" : "browser";
class Converter {
  /**
   * Create a new Converter instance.
   * @param {Object} [options] - Configuration options.
   * @param {"node"|"browser"} [options.env] - Environment the converter runs in.
   * @param {Function} [options.readerClass] - Forced reader class to use instead of auto-detection.
   * @param {Function} [options.writerClass] - Forced writer class to use instead of auto-detection.
   */
  constructor({ env, readerClass, writerClass } = {}) {
    this.env = env || ENV;
    this.forcedReader = readerClass;
    this.forcedWriter = writerClass;
    this.middleware = [];
  }
  /**
   * Add a middleware function to transform data during conversion.
   * @param {Function} fn - Middleware function that receives and returns data.
   * @returns {Converter} The converter instance (chainable).
   */
  use(fn) {
    this.middleware.push(fn);
    return this;
  }
  /**
   * Get the reader instance for a given type.
   * @param {string} type - The file type to read.
   * @returns {Object} Reader instance.
   * @throws {Error} If no reader is registered for the type.
   */
  getReader(type) {
    if (this.forcedReader) return new this.forcedReader();
    const ReaderClass = registry.findReader(this.env, type);
    if (!ReaderClass) {
      throw new Error(`No reader registered for type=${type} env=${this.env}`);
    }
    return new ReaderClass();
  }
  /**
   * Get the writer instance.
   * @param {string} type - The file type to write.
   * @returns {Object} Writer instance.
   * @throws {Error} If no writer is registered for the environment.
   */
  getWriter(type) {
    if (this.forcedWriter) return new this.forcedWriter();
    const WriterClass = registry.findWriter(this.env, type);
    if (!WriterClass) {
      throw new Error(`No writer registered for type=${type} env=${this.env}`);
    }
    return new WriterClass();
  }
  /**
   * Initialize progress tracking.
   */
  initProgress() {
    this.progress = null;
    this.progressCallback = null;
  }
  /**
   * Emit progress to the registered progress callback.
   * @param {number} progress - Progress as a decimal (0–1).
   */
  emitProgress(progress) {
    var currentProgress = this.progress;
    this.progress = Math.round(progress * 100);
    if (currentProgress === this.progress) {
      return;
    }
    this.progressCallback && this.progressCallback(this.progress);
  }
  /**
   * Convert a file or buffer to the desired output format using optional middleware.
   * @param {Uint8Array} input - Input data.
   * @param {Object} [options] - Conversion options.
   * @param {string} [options.type] - Explicit type of the input.
   * @param {Function} [options.progressCallback] - Callback for progress updates (0–100).
   * @returns {Promise<Uint8Array>} Converted output as a Uint8Array.
   */
  async convert(input, { inputType, outputType, progressCallback } = {}) {
    const detectedInputType = inputType;
    const detectedOutputType = outputType;
    this.progressCallback = progressCallback;
    const pair = registry.findCompatiblePair(this.env, detectedInputType, detectedOutputType);
    if (!pair) {
      throw new Error(`No compatible reader/writer for ${detectedInputType} → ${detectedOutputType}`);
    }
    const { ReaderClass, WriterClass, dataType } = pair;
    const reader = new ReaderClass();
    const writer = new WriterClass();
    let readerProgressRatio = reader.emitsProgress(dataType) ? 0.5 : 0;
    let writerProgressRatio = writer.emitsProgress(dataType) ? 0.5 : 0;
    if (!readerProgressRatio && writerProgressRatio) {
      writerProgressRatio = 1;
    } else if (readerProgressRatio && !writerProgressRatio) {
      readerProgressRatio = 1;
    }
    let data = await reader.read(
      input,
      { type: dataType, progressCallback: (p) => this.emitProgress(p * readerProgressRatio) }
    );
    for (const fn of this.middleware) {
      data = await fn(data);
    }
    return writer.write(
      data,
      { type: dataType, progressCallback: (p) => this.emitProgress(readerProgressRatio + p * writerProgressRatio) }
    );
  }
}
async function toUint8Array(input) {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  if (typeof input === "string") {
    const response = await fetch(input);
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
  if (typeof File !== "undefined" && input instanceof File || typeof Blob !== "undefined" && input instanceof Blob) {
    const buffer = await input.arrayBuffer();
    return new Uint8Array(buffer);
  }
  throw new Error("Cannot convert input to Uint8Array");
}
function detectType(input) {
  if (typeof input === "string" && input.includes(".")) {
    return input.split(".").pop().toLowerCase();
  }
  if (typeof File !== "undefined" && input instanceof File) {
    return input.name.split(".").pop().toLowerCase();
  }
  if (typeof Blob !== "undefined" && input instanceof Blob && input.name) {
    return input.name.split(".").pop().toLowerCase();
  }
  throw new Error("Unable to detect type — pass { type } explicitly");
}
async function convert(input, options = {}) {
  const { middleware = [], readerClass, writerClass, env, outputType, progressCallback } = options;
  let { inputType } = options;
  inputType ||= detectType(input);
  const converter = new Converter({ env, readerClass, writerClass });
  middleware.forEach((fn) => converter.use(fn));
  return converter.convert(await toUint8Array(input), { inputType, outputType, progressCallback });
}
class BaseReader {
  static formats = [];
  static environments = [];
  static priority = 0;
  async read(input, options = {}) {
    throw new Error("read() not implemented");
  }
  emitsProgress(type) {
    return true;
  }
}
const base64Chars = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
  "_",
  "$"
];
const base64Map = Object.fromEntries(base64Chars.map((c, i) => [c, i]));
function globalIdToGuid(globalId) {
  if (!globalId || globalId.length !== 22) {
    throw new Error("Invalid IFC GlobalId");
  }
  const bytes = new Uint8Array(16);
  let num = 0n;
  for (let i = 0; i < 22; i++) {
    num = (num << 6n) + BigInt(base64Map[globalId[i]]);
  }
  for (let i = 15; i >= 0; i--) {
    bytes[i] = Number(num & 0xFFn);
    num >>= 8n;
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20)
  ].join("-");
}
const ELEMENTS = [
  // Spatial Elements
  "IFCPROJECT",
  "IFCSITE",
  "IFCBUILDING",
  "IFCBUILDINGSTOREY",
  "IFCSPACE",
  "IFCZONE",
  "IFCGRID",
  // Annotation & Virtual
  "IFCANNOTATION",
  "IFCVIRTUALELEMENT",
  // Building Elements (General)
  "IFCWALL",
  "IFCWALLSTANDARDCASE",
  "IFCWALLELEMENTEDCASE",
  "IFCSLAB",
  "IFCSLABSTANDARDCASE",
  "IFCSLABELEMENTEDCASE",
  "IFCBEAM",
  "IFCBEAMSTANDARDCASE",
  "IFCCOLUMN",
  "IFCCOLUMNSTANDARDCASE",
  "IFCDOOR",
  "IFCDOORSTANDARDCASE",
  "IFCWINDOW",
  "IFCWINDOWSTANDARDCASE",
  "IFCSTAIR",
  "IFCSTAIRFLIGHT",
  "IFCRAMP",
  "IFCRAMPFLIGHT",
  "IFCRAILING",
  "IFCROOF",
  "IFCCURTAINWALL",
  "IFCSHADINGDEVICE",
  "IFCMEMBER",
  "IFCMEMBERSTANDARDCASE",
  "IFCPILE",
  "IFCFOOTING",
  "IFCCOVERING",
  "IFCCHIMNEY",
  "IFCPLATE",
  "IFCPLATESTANDARDCASE",
  "IFCELEMENTASSEMBLY",
  "IFCBUILDINGELEMENTPART",
  "IFCBUILDINGELEMENTPROXY",
  "IFCBUILTELEMENT",
  // Furnishings & Equipment
  "IFCFURNISHINGELEMENT",
  "IFCFURNITURE",
  "IFCSYSTEMFURNITUREELEMENT",
  "IFCTRANSPORTELEMENT",
  "IFCEQUIPMENTELEMENT",
  "IFCMEDICALDEVICE",
  "IFCCOMMUNICATIONSAPPLIANCE",
  "IFCAUDIOVISUALAPPLIANCE",
  "IFCSIGN",
  // Distribution Elements (Base Classes)
  "IFCDISTRIBUTIONELEMENT",
  "IFCDISTRIBUTIONFLOWELEMENT",
  "IFCDISTRIBUTIONCHAMBERELEMENT",
  "IFCDISTRIBUTIONCONTROLELEMENT",
  // Distribution Flow Elements (MEP)
  "IFCFLOWSEGMENT",
  "IFCPIPESEGMENT",
  "IFCDUCTSEGMENT",
  "IFCCABLECARRIERSEGMENT",
  "IFCCABLESEGMENT",
  "IFCFLOWFITTING",
  "IFCPIPEFITTING",
  "IFCDUCTFITTING",
  "IFCCABLEFITTING",
  "IFCCABLECARRIERFITTING",
  "IFCFLOWTERMINAL",
  "IFCAIRTERMINAL",
  "IFCAIRTERMINALBOX",
  "IFCSTACKTERMINAL",
  "IFCSANITARYTERMINAL",
  "IFCFIRESUPPRESSIONTERMINAL",
  "IFCWASTETERMINAL",
  "IFCFLOWCONTROLLER",
  "IFCVALVE",
  "IFCDAMPER",
  "IFCPROTECTIVEDEVICE",
  "IFCPROTECTIVEDEVICETRIPPINGUNIT",
  "IFCSWITCHINGDEVICE",
  "IFCUNITARYCONTROLELEMENT",
  "IFCELECTRICTIMECONTROL",
  "IFCOUTLET",
  "IFCJUNCTIONBOX",
  "IFCSENSOR",
  "IFCACTUATOR",
  "IFCCONTROLLER",
  "IFCALARM",
  "IFCFLOWINSTRUMENT",
  "IFCLIGHTFIXTURE",
  // Distribution Equipment
  "IFCENERGYCONVERSIONDEVICE",
  "IFCBOILER",
  "IFCBURNER",
  "IFCCHILLER",
  "IFCCOMPRESSOR",
  "IFCCONDENSER",
  "IFCCOOLEDBEAM",
  "IFCCOOLINGTOWER",
  "IFCELECTRICGENERATOR",
  "IFCELECTRICMOTOR",
  "IFCFAN",
  "IFCHEATEXCHANGER",
  "IFCHUMIDIFIER",
  "IFCINTERCEPTOR",
  "IFCPUMP",
  "IFCSPACEHEATER",
  "IFCSOLARDEVICE",
  "IFCTANK",
  "IFCTRANSFORMER",
  "IFCUNITARYEQUIPMENT",
  "IFCVIBRATIONISOLATOR",
  "IFCEVAPORATOR",
  "IFCEVAPORATIVECOOLER",
  "IFCAIRTOAIRHEATRECOVERY",
  // Flow Storage & Treatment Devices
  "IFCFLOWSTORAGEDEVICE",
  "IFCELECTRICFLOWSTORAGEDEVICE",
  "IFCFLOWMOVINGDEVICE",
  "IFCFLOWTREATMENTDEVICE",
  "IFCFILTER",
  "IFCCOIL",
  "IFCTUBEBUNDLE",
  // Electrical & Controls
  "IFCELECTRICALELEMENT",
  "IFCELECTRICAPPLIANCE",
  "IFCELECTRICDISTRIBUTIONBOARD",
  "IFCMOTORCONNECTION",
  // Structural & Detailing
  "IFCDISCRETEACCESSORY",
  "IFCFASTENER",
  "IFCMECHANICALFASTENER",
  "IFCREINFORCINGELEMENT",
  "IFCREINFORCINGBAR",
  "IFCREINFORCINGMESH",
  "IFCTENDON",
  "IFCTENDONANCHOR",
  // Civil / Infrastructure (IFC4.3+)
  "IFCALIGNMENT",
  "IFCALIGNMENTELEMENT",
  "IFCTRACKELEMENT",
  "IFCRAIL",
  "IFCBRIDGEPART",
  "IFCGEOTECHNICALELEMENT",
  "IFCGEOGRAPHICELEMENT",
  "IFCCIVILELEMENT",
  "IFCROAD",
  "IFCPAVEMENT",
  "IFCCOURSE",
  "IFCEARTHWORKSCUT",
  "IFCEARTHWORKSFILL",
  // Features & Openings
  "IFCOPENINGELEMENT",
  "IFCOPENINGSTANDARDCASE",
  "IFCVOIDINGFEATURE",
  "IFCFEATUREELEMENTADDITION",
  "IFCFEATUREELEMENTSUBTRACTION",
  "IFCPROJECTIONELEMENT",
  "IFCSURFACEFEATURE"
];
class IfcReaderNode extends BaseReader {
  static formats = ["ifc"];
  static environments = ["node"];
  static priority = 10;
  static outputs = ["tabular", "ifc"];
  async read(input, { type, progressCallback }) {
    if (type == "ifc") {
      return input;
    }
    this.initProgress();
    this.progressCallback = progressCallback;
    this.emitProgress();
    this.modelID = null;
    this.ifcAPI = new WebIfc__namespace.IfcAPI();
    await this.ifcAPI.Init();
    this.ifcAPI.SetLogLevel(WebIfc__namespace.LogLevel.LOG_LEVEL_OFF);
    this.modelID = this.ifcAPI.OpenModel(input);
    if (this.modelID < 0) {
      throw new Error("Failed to open IFC model");
    }
    const relations = this.buildRelationsClosure(this.getRelations());
    this.updateTotalEntities();
    const ids = this.ifcAPI.GetLineIDsWithType(this.modelID, WebIfc__namespace.IFCRELDEFINESBYPROPERTIES);
    const columns = {
      ExpressID: 2,
      Type: 4,
      GlobalId: 4,
      GUID: 4,
      Name: 4,
      Description: 4,
      Tag: 4
    };
    const propertySets = {};
    for (let i = 0; i < ids.size(); i++) {
      this.processedEntities++;
      this.emitProgress();
      const expressID = ids.get(i);
      const line = this.ifcAPI.GetLine(this.modelID, expressID, true, true);
      if (!line) {
        continue;
      }
      const properties = {};
      (line.RelatingPropertyDefinition?.HasProperties || []).forEach((prop) => {
        const propName = line.RelatingPropertyDefinition.Name?.value + "_" + prop.Name?.value;
        const propValue = prop.NominalValue?.value ?? null;
        let columnType = columns[propName] ?? 0;
        properties[propName] = propValue;
        if (this.isEmpty(propValue) && columnType <= 0) {
          columnType = 0;
        } else if (this.isBoolean(propValue) && columnType <= 1) {
          columnType = 1;
        } else if (this.isInteger(propValue) && columnType <= 2) {
          columnType = 2;
        } else if (this.isNumeric(propValue) && columnType <= 3) {
          columnType = 3;
        } else {
          columnType = 4;
        }
        if (!this.isEmpty(propValue)) {
          columns[propName] = columnType;
        }
      });
      (line.RelatingPropertyDefinition?.Quantities || []).forEach((quantity) => {
        const quantityName = line.RelatingPropertyDefinition.Name?.value + "_" + quantity.Name?.value;
        let columnType = columns[quantityName] ?? 0;
        let quantityValue = 0;
        if (quantity.type === WebIfc__namespace.IFCQUANTITYLENGTH) {
          quantityValue = quantity.LengthValue?._representationValue ?? 0;
        } else if (quantity.type === WebIfc__namespace.IFCQUANTITYAREA) {
          quantityValue = quantity.AreaValue?._representationValue ?? 0;
        } else if (quantity.type === WebIfc__namespace.IFCQUANTITYVOLUME) {
          quantityValue = quantity.VolumeValue?._representationValue ?? 0;
        } else if (quantity.type === WebIfc__namespace.IFCQUANTITYWEIGHT) {
          quantityValue = quantity.WeightValue?._representationValue ?? 0;
        } else if (quantity.type === WebIfc__namespace.IFCQUANTITYCOUNT) {
          quantityValue = quantity.CountValue?._representationValue ?? 0;
        } else if (quantity.type === WebIfc__namespace.IFCQUANTITYTIME) {
          quantityValue = quantity.TimeValue?._representationValue ?? 0;
        }
        properties[quantityName] = quantityValue;
        if (this.isEmpty(quantityValue) && columnType <= 0) {
          columnType = 0;
        } else if (this.isBoolean(quantityValue) && columnType <= 1) {
          columnType = 1;
        } else if (this.isInteger(quantityValue) && columnType <= 2) {
          columnType = 2;
        } else if (this.isNumeric(quantityValue) && columnType <= 3) {
          columnType = 3;
        } else {
          columnType = 4;
        }
        if (!this.isEmpty(quantityValue)) {
          columns[quantityName] = columnType;
        }
      });
      propertySets[expressID] = properties;
    }
    const rows = {};
    const columnNames = Object.keys(columns);
    const defaults = columnNames.reduce((acc, key) => {
      acc[key] = null;
      return acc;
    }, {});
    for (const entityTypeName of ELEMENTS) {
      const ids2 = this.ifcAPI.GetLineIDsWithType(this.modelID, WebIfc__namespace[entityTypeName]);
      for (let i = 0; i < ids2.size(); i++) {
        this.processedEntities++;
        this.emitProgress();
        const expressID = ids2.get(i);
        const line = this.ifcAPI.GetLine(this.modelID, expressID, false, true, "IsDefinedBy");
        if (!line) {
          continue;
        }
        const row = Object.assign({}, defaults, {
          ExpressID: expressID,
          Type: entityTypeName,
          GlobalId: line.GlobalId.value,
          GUID: globalIdToGuid(line.GlobalId.value),
          Name: line.Name?.value,
          Description: line.Description?.value ?? null,
          Tag: line.Tag?.value ?? null
        });
        for (const definedBy of line.IsDefinedBy ?? []) {
          Object.assign(row, propertySets[definedBy.value] ?? {});
        }
        for (const propKey in row) {
          const columnType = columns[propKey];
          if (columnType === 1) {
            row[propKey] = row[propKey] === true ? 1 : row[propKey] === false ? 0 : null;
          } else if (columnType === 2) {
            row[propKey] = this.isEmpty(row[propKey]) ? null : parseInt(row[propKey]) ?? null;
          } else if (columnType === 3) {
            row[propKey] = this.isEmpty(row[propKey]) ? null : parseFloat(row[propKey]) ?? null;
          } else if (columnType === 4) {
            row[propKey] = row[propKey] ?? null;
          }
        }
        rows[expressID] = row;
      }
    }
    this.close();
    return { columns, rows, relations };
  }
  emitsProgress(type) {
    return type != "ifc";
  }
  updateTotalEntities() {
    this.totalEntities = 0;
    const entityTypes = ELEMENTS.slice(0);
    entityTypes.push("IFCRELDEFINESBYPROPERTIES");
    for (const entityTypeName of entityTypes) {
      const ids = this.ifcAPI.GetLineIDsWithType(this.modelID, WebIfc__namespace[entityTypeName]);
      this.totalEntities += ids.size();
    }
  }
  getRelations() {
    const relations = {};
    const aggregates = this.ifcAPI.GetLineIDsWithType(this.modelID, WebIfc__namespace.IFCRELAGGREGATES);
    for (let i = 0; i < aggregates.size(); i++) {
      const relID = aggregates.get(i);
      const rel = this.ifcAPI.GetLine(this.modelID, relID);
      const parentID = rel.RelatingObject.value;
      relations[parentID] ??= [];
      for (const obj of rel.RelatedObjects) {
        relations[parentID].push(obj.value);
      }
    }
    const contained = this.ifcAPI.GetLineIDsWithType(this.modelID, WebIfc__namespace.IFCRELCONTAINEDINSPATIALSTRUCTURE);
    for (let i = 0; i < contained.size(); i++) {
      const relID = contained.get(i);
      const rel = this.ifcAPI.GetLine(this.modelID, relID);
      const parentID = rel.RelatingStructure.value;
      relations[parentID] ??= [];
      for (const obj of rel.RelatedElements) {
        relations[parentID].push(obj.value);
      }
    }
    return relations;
  }
  buildRelationsClosure(relations) {
    const closure = [];
    function dfs(ancestor, descendant, depth) {
      closure.push({ ancestor, descendant, depth });
      const children = relations[descendant] || [];
      for (const child of children) {
        dfs(ancestor, child, depth + 1);
      }
    }
    for (const parentID in relations) {
      dfs(Number(parentID), Number(parentID), 0);
    }
    return closure;
  }
  initProgress() {
    this.totalEntities = 0;
    this.processedEntities = 0;
    this.progressCallback = null;
  }
  emitProgress() {
    this.progressCallback(this.processedEntities / (this.totalEntities || 1));
  }
  close() {
    if (this.modelID === null) {
      return;
    }
    this.ifcAPI.CloseModel(this.modelID);
    this.ifcAPI.Dispose();
    this.modelID = null;
  }
  isInteger(value) {
    if (typeof value === "number") {
      return Number.isInteger(value);
    }
    if (typeof value === "string") {
      return /^-?\d+$/.test(value);
    }
    return false;
  }
  isNumeric(value) {
    return !isNaN(value) && !isNaN(parseFloat(value));
  }
  isBoolean(val) {
    return val === false || val === true;
  }
  isEmpty(val) {
    return val === null || val === void 0;
  }
}
class ExtendedSingleThreadedFragmentsModel extends fragments.SingleThreadedFragmentsModel {
  getVirtualModel() {
    return this._virtualModel;
  }
}
class FragReaderNode extends BaseReader {
  static formats = ["frag"];
  static environments = ["node"];
  static priority = 10;
  static outputs = ["tabular"];
  constructor() {
    super();
  }
  async read(input, { progressCallback }) {
    this.initProgress();
    this.progressCallback = progressCallback;
    this.emitProgress();
    this.model = new ExtendedSingleThreadedFragmentsModel(
      "model",
      input
    );
    const relations = this.buildRelationsClosure(this.getRelations());
    this.definesByProperties = this.getRelDefinesByProperties();
    this.updateTotalEntities();
    const columns = {
      ExpressID: 2,
      Type: 4,
      GlobalId: 4,
      GUID: 4,
      Name: 4,
      Description: 4,
      Tag: 4
    };
    const propertySets = {};
    for (const line of this.model.getItemsData(this.definesByProperties)) {
      this.processedEntities++;
      this.emitProgress();
      const properties = {};
      const relations2 = this.model.getVirtualModel().getItemRelations(line._localId.value);
      for (const relationType of Object.keys(relations2)) {
      }
      (relations2?.HasProperties ? this.model.getItemsData(relations2?.HasProperties) : []).forEach((prop) => {
        const propName = line.Name?.value + "_" + prop.Name?.value;
        const propValue = prop.NominalValue?.value ?? null;
        let columnType = columns[propName] ?? 0;
        properties[propName] = propValue;
        if (this.isEmpty(propValue) && columnType <= 0) {
          columnType = 0;
        } else if (this.isBoolean(propValue) && columnType <= 1) {
          columnType = 1;
        } else if (this.isInteger(propValue) && columnType <= 2) {
          columnType = 2;
        } else if (this.isNumeric(propValue) && columnType <= 3) {
          columnType = 3;
        } else {
          columnType = 4;
        }
        if (!this.isEmpty(propValue)) {
          columns[propName] = columnType;
        }
      });
      (relations2?.Quantities ? this.model.getItemsData(relations2?.Quantities) : []).forEach((quantity) => {
        const quantityName = line.Name?.value + "_" + quantity.Name?.value;
        let columnType = columns[quantityName] ?? 0;
        let quantityValue = 0;
        if (quantity._category.value === "IFCQUANTITYLENGTH") {
          quantityValue = quantity.LengthValue?.value ?? 0;
        } else if (quantity._category.value === "IFCQUANTITYAREA") {
          quantityValue = quantity.AreaValue?.value ?? 0;
        } else if (quantity._category.value === "IFCQUANTITYVOLUME") {
          quantityValue = quantity.VolumeValue?.value ?? 0;
        } else if (quantity._category.value === "IFCQUANTITYWEIGHT") {
          quantityValue = quantity.WeightValue?.value ?? 0;
        } else if (quantity._category.value === "IFCQUANTITYCOUNT") {
          quantityValue = quantity.CountValue?.value ?? 0;
        } else if (quantity._category.value === "IFCQUANTITYTIME") {
          quantityValue = quantity.TimeValue?.value ?? 0;
        }
        properties[quantityName] = quantityValue;
        if (this.isEmpty(quantityValue) && columnType <= 0) {
          columnType = 0;
        } else if (this.isBoolean(quantityValue) && columnType <= 1) {
          columnType = 1;
        } else if (this.isInteger(quantityValue) && columnType <= 2) {
          columnType = 2;
        } else if (this.isNumeric(quantityValue) && columnType <= 3) {
          columnType = 3;
        } else {
          columnType = 4;
        }
        if (!this.isEmpty(quantityValue)) {
          columns[quantityName] = columnType;
        }
      });
      propertySets[line._localId.value] = properties;
    }
    const rows = {};
    const columnNames = Object.keys(columns);
    const defaults = columnNames.reduce((acc, key) => {
      acc[key] = null;
      return acc;
    }, {});
    const items = this.model.getItemsOfCategories(
      ELEMENTS.map((type) => new RegExp("^" + type + "$"))
    );
    for (const ids of Object.values(items)) {
      for (const line of this.model.getItemsData(ids)) {
        this.processedEntities++;
        this.emitProgress();
        const relations2 = this.model.getVirtualModel().getItemRelations(line._localId.value);
        const row = Object.assign({}, defaults, {
          ExpressID: line._localId.value,
          Type: line._category.value,
          GlobalId: line._guid.value,
          GUID: globalIdToGuid(line._guid.value),
          Name: line.Name?.value,
          Description: line.Description?.value ?? null,
          Tag: line.Tag?.value ?? null
        });
        for (const definedBy of relations2?.IsDefinedBy ?? []) {
          Object.assign(row, propertySets[definedBy] ?? {});
        }
        for (const propKey in row) {
          const columnType = columns[propKey];
          if (columnType === 1) {
            row[propKey] = row[propKey] === true ? 1 : row[propKey] === false ? 0 : null;
          } else if (columnType === 2) {
            row[propKey] = this.isEmpty(row[propKey]) ? null : parseInt(row[propKey]) ?? null;
          } else if (columnType === 3) {
            row[propKey] = this.isEmpty(row[propKey]) ? null : parseFloat(row[propKey]) ?? null;
          } else if (columnType === 4) {
            row[propKey] = row[propKey] ?? null;
          }
        }
        rows[line._localId.value] = row;
      }
    }
    return { columns, rows, relations };
  }
  getRelDefinesByProperties() {
    const items = this.model.getItemsOfCategories(
      this.model.getCategories().map((type) => new RegExp("^" + type + "$"))
    );
    const definedBys = {};
    for (const ids of Object.values(items)) {
      for (const id of ids) {
        const relations = this.model.getVirtualModel().getItemRelations(id);
        if (!relations?.IsDefinedBy) {
          continue;
        }
        for (const definedBy of relations.IsDefinedBy) {
          definedBys[definedBy] = definedBy;
        }
      }
    }
    return Object.values(definedBys);
  }
  updateTotalEntities() {
    const items = this.model.getItemsOfCategories(
      ELEMENTS.map((type) => new RegExp("^" + type + "$"))
    );
    this.totalEntities = Object.values(items).reduce(
      (count, item) => count + item.length,
      this.definesByProperties.length
    );
  }
  getRelations() {
    const relations = {};
    function traverse(current) {
      if (!current || !current.children) return;
      if (current.localId !== null) {
        const childIds = [];
        for (const child of current.children) {
          if (child.children) {
            for (const grandChild of child.children) {
              if (grandChild.localId !== null) {
                childIds.push(grandChild.localId);
              }
              traverse(grandChild);
            }
          }
        }
        relations[current.localId] = childIds;
      } else {
        for (const child of current.children) {
          traverse(child);
        }
      }
    }
    traverse(this.model.getSpatialStructure());
    return relations;
  }
  buildRelationsClosure(relations) {
    const closure = [];
    function dfs(ancestor, descendant, depth) {
      closure.push({ ancestor, descendant, depth });
      const children = relations[descendant] || [];
      for (const child of children) {
        dfs(ancestor, child, depth + 1);
      }
    }
    for (const parentID in relations) {
      dfs(Number(parentID), Number(parentID), 0);
    }
    return closure;
  }
  initProgress() {
    this.totalEntities = 0;
    this.processedEntities = 0;
    this.progressCallback = null;
  }
  emitProgress() {
    this.progressCallback(this.processedEntities / (this.totalEntities || 1));
  }
  isInteger(value) {
    if (typeof value === "number") {
      return Number.isInteger(value);
    }
    if (typeof value === "string") {
      return /^-?\d+$/.test(value);
    }
    return false;
  }
  isNumeric(value) {
    return !isNaN(value) && !isNaN(parseFloat(value));
  }
  isBoolean(val) {
    return val === false || val === true;
  }
  isEmpty(val) {
    return val === null || val === void 0;
  }
}
class BaseWriter {
  static formats = [];
  static environments = [];
  static priority = 0;
  async write(data, options = {}) {
    throw new Error("write() not implemented");
  }
  emitsProgress(type) {
    return true;
  }
}
async function downloadFileToLocal(url) {
  const hash = crypto.createHash("sha256").update(url).digest("hex");
  const cacheDir = path.join(os.tmpdir(), hash);
  const fileName = path.basename(new URL(url).pathname);
  const filePath = path.join(cacheDir, fileName);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  return filePath;
}
class FragWriterNode extends BaseWriter {
  /** @type {string[]} Supported output formats */
  static formats = ["frag"];
  /** @type {string[]} Supported environments */
  static environments = ["node"];
  /** @type {number} Priority when multiple writers are registered */
  static priority = 10;
  /** @type {string[]} Supported input types */
  static inputs = ["ifc"];
  /**
   * Write parsed data into a fragment format.
   *
   * @param {Object} input - IFC bytes
   * 
   * @param {Object} options - Write options.
   * @param {(progress: number) => void} [options.progressCallback] - Progress callback (0–1).
   *
   * @returns {Promise<Uint8Array>} Fragment file contents as a `Uint8Array`.
   */
  async write(input, { progressCallback }) {
    this.initProgress();
    this.progressCallback = progressCallback;
    this.emitProgress();
    const serializer = new fragments.IfcImporter();
    const wasmPath = await downloadFileToLocal("https://unpkg.com/web-ifc@latest/web-ifc-node.wasm");
    serializer.wasm = { absolute: true, path: path.dirname(wasmPath) + "/" };
    const fragmentBytes = await serializer.process({
      bytes: input,
      progressCallback: (progress, data) => {
        this.progress = progress;
        this.emitProgress();
      }
    });
    serializer.clean();
    return fragmentBytes;
  }
  /**
   * Initialize internal progress counters.
   */
  initProgress() {
    this.progress = 0;
    this.progressCallback = null;
  }
  /**
   * Emit progress to the callback if defined.
   *
   * - Rows contribute up to 50% of total progress.
   * - Relations contribute up to 50% (after step 2 begins).
   *
   * @private
   */
  emitProgress() {
    if (!this.progressCallback) return;
    this.progressCallback(this.progress);
  }
}
class SqliteWriter extends BaseWriter {
  /** @type {string[]} Supported output formats */
  static formats = ["db", "db3", "sqlite", "sqlite3"];
  /** @type {string[]} Supported environments */
  static environments = ["node"];
  /** @type {number} Priority when multiple writers are registered */
  static priority = 10;
  /** @type {string[]} Supported input types */
  static inputs = ["tabular"];
  /**
   * Write parsed data into a SQLite database file.
   *
   * @param {Object} data - Structured model data.
   * @param {Object.<string, number>} data.columns - Column definitions where keys are column names and values are numeric type codes (1=INTEGER, 2=INTEGER, 3=REAL, else TEXT).
   * @param {Object.<string, Object>} data.rows - Entity rows keyed by ID, each containing column-value pairs.
   * @param {Array<{ancestor: number, descendant: number, depth: number}>} data.relations - Hierarchical relations between entities.
   *
   * @param {Object} options - Write options.
   * @param {(progress: number) => void} [options.progressCallback] - Progress callback (0–1).
   *
   * @returns {Promise<Uint8Array>} SQLite file contents as a `Uint8Array`.
   */
  async write({ columns, rows, relations }, { progressCallback }) {
    this.initProgress();
    this.totalRows = Object.keys(rows).length;
    this.progressCallback = progressCallback;
    this.emitProgress();
    const db = await sqlite.open({
      filename: ":memory:",
      driver: sqlite3.Database
    });
    await db.exec("PRAGMA foreign_keys = OFF;");
    await db.exec("DROP TABLE IF EXISTS Entities;");
    await db.exec("DROP TABLE IF EXISTS Hierarchy;");
    await db.exec("PRAGMA foreign_keys = ON;");
    const columnNames = Object.keys(columns);
    const keys = {
      ExpressID: "PRIMARY KEY",
      GlobalId: "UNIQUE"
    };
    const columnSQLs = [];
    for (const columnName in columns) {
      const columnType = columns[columnName];
      let typeName = "TEXT";
      let columnKey = keys[columnName] ?? "";
      if (columnType === 1) {
        typeName = "INTEGER";
      } else if (columnType === 2) {
        typeName = "INTEGER";
      } else if (columnType === 3) {
        typeName = "REAL";
      }
      columnSQLs.push(`"${columnName}" ${typeName} ${columnKey}`);
    }
    const columnsSQL = columnSQLs.join(",\n");
    await db.exec(`
      CREATE TABLE Entities (
        ${columnsSQL}
      );
    `);
    await db.exec(`
      CREATE TABLE Hierarchy (
        ParentID INTEGER,
        ChildID INTEGER,
        Depth INTEGER,
        FOREIGN KEY(ParentID) REFERENCES Entities(ExpressID),
        FOREIGN KEY(ChildID) REFERENCES Entities(ExpressID)
      );
    `);
    const insertStmt = await db.prepare(
      `INSERT INTO Entities (${columnNames.map((c) => `"${c}"`).join(",")})
       VALUES (${columnNames.map(() => "?").join(",")});`
    );
    for (const row of Object.values(rows)) {
      this.processedRows++;
      this.emitProgress();
      const values = columnNames.map((c) => row[c] ?? null);
      await insertStmt.run(...values);
    }
    await insertStmt.finalize();
    this.totalRelations = relations.length;
    this.step++;
    for (const relation of relations) {
      this.processedRelations++;
      this.emitProgress();
      try {
        await db.run(
          `INSERT INTO Hierarchy (ParentID, ChildID, Depth) VALUES (?, ?, ?);`,
          relation.ancestor,
          relation.descendant,
          relation.depth
        );
      } catch (e) {
      }
    }
    const tempFilePath = path.join(os.tmpdir(), `tempdb-${Date.now()}.sqlite`);
    await new Promise((resolve, reject) => {
      const backup = db.getDatabaseInstance().backup(tempFilePath);
      backup.step(-1, function(err) {
        if (err) {
          reject(err);
          return;
        }
        backup.finish(function(err2) {
          if (err2) {
            reject(err2);
            return;
          }
          resolve();
        });
      });
    });
    const data = new Uint8Array(fs.readFileSync(tempFilePath));
    await db.close();
    return data;
  }
  /**
   * Initialize internal progress counters.
   */
  initProgress() {
    this.step = 1;
    this.totalRows = 0;
    this.processedRows = 0;
    this.totalRelations = 0;
    this.processedRelations = 0;
    this.progressCallback = null;
  }
  /**
   * Emit progress to the callback if defined.
   *
   * - Rows contribute up to 50% of total progress.
   * - Relations contribute up to 50% (after step 2 begins).
   *
   * @private
   */
  emitProgress() {
    if (!this.progressCallback) return;
    const totalRows = this.processedRows / (this.totalRows || 1) * 0.5;
    const totalRelations = this.step >= 2 ? this.processedRelations / (this.totalRelations || 1) * 0.5 : 0;
    this.progressCallback(totalRows + totalRelations);
  }
}
registry.addReader(IfcReaderNode);
registry.addReader(FragReaderNode);
registry.addWriter(FragWriterNode);
registry.addWriter(SqliteWriter);
exports.Converter = Converter;
exports.convert = convert;
exports.registry = registry;
