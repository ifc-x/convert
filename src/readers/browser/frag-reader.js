import { SingleThreadedFragmentsModel } from "@thatopen/fragments";
import { BaseReader } from "../../adapters/base-reader.js";
import { globalIdToGuid } from "../../utilities/guid.js";

class ExtendedSingleThreadedFragmentsModel extends SingleThreadedFragmentsModel {
  getVirtualModel() {
    return this._virtualModel;
  }
}

export default class FragReaderBrowser extends BaseReader {
  static formats = ["frag"];
  static environments = ["browser"];
  static priority = 10;
  static outputs = ["tabular"];

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
    const relationTypes = {};

    for (const line of this.model.getItemsData(this.definesByProperties)) {
      this.processedEntities++;

      this.emitProgress();

      const properties = {};
      const relations = this.model.getVirtualModel().getItemRelations(line._localId.value);

      for (const relationType of Object.keys(relations)) {
        relationTypes[relationType] = true;
      }
      (relations?.HasProperties ? this.model.getItemsData(relations?.HasProperties) : [])
      .forEach((prop) => {
        const propName = line.Name?.value + '_' + prop.Name?.value;
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

      (relations?.Quantities ? this.model.getItemsData(relations?.Quantities) : [])
      .forEach((quantity) => {
        const quantityName = line.Name?.value + '_' + quantity.Name?.value;
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
      acc[key] = null; // or any default value
      return acc;
    }, {});

    const items = this.model.getItemsOfCategories(
      this.entityTypes.map((type) => new RegExp('^' + type + '$'))
    );

    for (const ids of Object.values(items)) {
      for (const line of this.model.getItemsData(ids)) {
        this.processedEntities++;

        this.emitProgress();

        const relations = this.model.getVirtualModel().getItemRelations(line._localId.value);

        const row = Object.assign({}, defaults, {
          ExpressID: line._localId.value,
          Type: line._category.value,
          GlobalId: line._guid.value,
          GUID: globalIdToGuid(line._guid.value),
          Name: line.Name?.value,
          Description: line.Description?.value ?? null,
          Tag: line.Tag?.value ?? null,
        });

        for (const definedBy of (relations?.IsDefinedBy ?? [])) {
          Object.assign(row, propertySets[definedBy] ?? {});
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
        rows[line._localId.value] = row;
      }
    }
    return { columns, rows, relations };
  }

  getRelDefinesByProperties() {
    const items = this.model.getItemsOfCategories(
      this.model.getCategories().map((type) => new RegExp('^' + type + '$'))
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
      this.entityTypes.map((type) => new RegExp('^' + type + '$'))
    );

    this.totalEntities = Object.values(items).reduce(
      (count, item) => count + item.length, this.definesByProperties.length
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
