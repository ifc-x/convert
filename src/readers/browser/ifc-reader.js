import * as WebIfc from 'web-ifc';
import { BaseReader } from "../../adapters/base-reader.js";
import wasmUrl from 'web-ifc/web-ifc.wasm?url';
import { globalIdToGuid } from "../../utilities/guid.js";

export default class IfcReaderBrowser extends BaseReader {
  static formats = ["ifc"];
  static environments = ["browser"];
  static priority = 10;

  entityTypes = [
    // Spatial Elements
    "IFCPROJECT",
    "IFCSITE",
    "IFCBUILDING",
    "IFCBUILDINGSTOREY",
    "IFCSPACE",
    "IFCZONE",

    // Building Elements
    "IFCWALL",
    "IFCSLAB",
    "IFCBEAM",
    "IFCCOLUMN",
    "IFCDOOR",
    "IFCWINDOW",
    "IFCSTAIR",
    "IFCSTAIRFLIGHT",
    "IFCRAILING",
    "IFCROOF",
    "IFCCURTAINWALL",
    "IFCMEMBER",
    "IFCPILE",
    "IFCFOOTING",
    "IFCCOVERING",
    "IFCCHIMNEY",
    "IFCPLATE",
    "IFCELEMENTASSEMBLY",
    "IFCBUILDINGELEMENTPART",
    "IFCBUILDINGELEMENTPROXY",

    // Distribution Elements (MEP)
    "IFCFLOWSEGMENT",
    "IFCFLOWFITTING",
    "IFCFLOWTERMINAL",
    "IFCFLOWCONTROLLER",
    "IFCDISTRIBUTIONCHAMBERELEMENT",
    "IFCENERGYCONVERSIONDEVICE",
    "IFCFLOWSTORAGEDEVICE",
    "IFCFLOWMOVINGDEVICE",
    "IFCFLOWTREATMENTDEVICE",

    // Furnishings & Equipment
    "IFCFURNISHINGELEMENT",
    "IFCTRANSPORTELEMENT",
    "IFCELECTRICALELEMENT",
    "IFCEQUIPMENTELEMENT",

    // Structural & Detailing
    "IFCDISCRETEACCESSORY",
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
    "IFCBRIDGEPART",
    "IFCGEOTECHNICALELEMENT",
    "IFCROAD",
    "IFCCIVILELEMENT",

    // Features & Openings
    "IFCOPENINGELEMENT",
    "IFCVOIDINGFEATURE",
    "IFCFEATUREELEMENTADDITION",
    "IFCFEATUREELEMENTSUBTRACTION",
    "IFCPROJECTIONELEMENT"
  ];

  constructor() {
    super();

    this.ifcAPI = new WebIfc.IfcAPI();

    this.modelID = null;
  }

  async read(input, { progressCallback }) {
    this.initProgress();

    this.progressCallback = progressCallback;

    this.emitProgress();

    await this.ifcAPI.Init((fileName) => {
      if (fileName === 'web-ifc.wasm') {
        return wasmUrl;
      }
      return fileName;
    });
    
    this.ifcAPI.SetLogLevel(WebIfc.LogLevel.LOG_LEVEL_OFF);

    this.modelID = this.ifcAPI.OpenModel(input);

    if (this.modelID < 0) {
      throw new Error('Failed to open IFC model');
    }
    const relations = this.buildRelationsClosure(this.getRelations());

    this.updateTotalEntities();

    const ids = this.ifcAPI.GetLineIDsWithType(this.modelID, WebIfc.IFCRELDEFINESBYPROPERTIES);
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
        const propName = line.RelatingPropertyDefinition.Name?.value + '_' + prop.Name?.value;
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
        const quantityName = line.RelatingPropertyDefinition.Name?.value + '_' + quantity.Name?.value;
        let columnType = columns[quantityName] ?? 0;
        let quantityValue = 0;

        if (quantity.type === WebIfc.IFCQUANTITYLENGTH) {
          quantityValue = quantity.LengthValue?._representationValue ?? 0;
        } else if (quantity.type === WebIfc.IFCQUANTITYAREA) {
          quantityValue = quantity.AreaValue?._representationValue ?? 0;
        } else if (quantity.type === WebIfc.IFCQUANTITYVOLUME) {
          quantityValue = quantity.VolumeValue?._representationValue ?? 0;
        } else if (quantity.type === WebIfc.IFCQUANTITYWEIGHT) {
          quantityValue = quantity.WeightValue?._representationValue ?? 0;
        } else if (quantity.type === WebIfc.IFCQUANTITYCOUNT) {
          quantityValue = quantity.CountValue?._representationValue ?? 0;
        } else if (quantity.type === WebIfc.IFCQUANTITYTIME) {
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
      acc[key] = null; // or any default value
      return acc;
    }, {});

    for (const entityTypeName of this.entityTypes) {
      const ids = this.ifcAPI.GetLineIDsWithType(this.modelID, WebIfc[entityTypeName]);

      for (let i = 0; i < ids.size(); i++) {
        this.processedEntities++;

        this.emitProgress();

        const expressID = ids.get(i);

        const line = this.ifcAPI.GetLine(this.modelID, expressID, false, true, 'IsDefinedBy');

        if (!line) {
          contimue;
        }
        const row = Object.assign({}, defaults, {
          ExpressID: expressID,
          Type: entityTypeName,
          GlobalId: line.GlobalId.value,
          GUID: globalIdToGuid(line.GlobalId.value),
          Name: line.Name?.value,
          Description: line.Description?.value ?? null,
          Tag: line.Tag?.value ?? null,
        });

        for (const definedBy of (line.IsDefinedBy ?? [])) {
          Object.assign(row, propertySets[definedBy.value] ?? {});
        }
        for (const propKey in row) {
          const columnType = columns[propKey];

          if (columnType === 1) {
            row[propKey] = row[propKey] === true ? 1 : (row[propKey] === false ? 0 : null);
          } else if (columnType === 2) {
            row[propKey] = this.isEmpty(row[propKey]) ? null : (parseInt(row[propKey]) ?? null);
          } else if (columnType === 3) {
            row[propKey] = this.isEmpty(row[propKey]) ? null : (parseFloat(row[propKey]) ?? null);
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
  
  updateTotalEntities() {
    this.totalEntities = 0;

    const entityTypes = this.entityTypes.slice(0);
    entityTypes.push('IFCRELDEFINESBYPROPERTIES');

    for (const entityTypeName of entityTypes) {
      const ids = this.ifcAPI.GetLineIDsWithType(this.modelID, WebIfc[entityTypeName]);
      
      this.totalEntities += ids.size();
    }
  }

  getRelations() {
    const relations = {};
    const aggregates = this.ifcAPI.GetLineIDsWithType(this.modelID, WebIfc.IFCRELAGGREGATES);

    for (let i = 0; i < aggregates.size(); i++) {
      const relID = aggregates.get(i);
      const rel = this.ifcAPI.GetLine(this.modelID, relID);

      const parentID = rel.RelatingObject.value;

      relations[parentID] ??= [];

      for (const obj of rel.RelatedObjects) {
        relations[parentID].push(obj.value);
      }
    }
    const contained = this.ifcAPI.GetLineIDsWithType(this.modelID, WebIfc.IFCRELCONTAINEDINSPATIALSTRUCTURE);

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

    this.modelID = null;
  }

  isInteger(value) {
    if (typeof value === 'number') {
      return Number.isInteger(value);
    }
    if (typeof value === 'string') {
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
    return val === null || val === undefined;
  }
}
