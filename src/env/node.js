import { Converter, registry, convert } from "../index.js";

import IfcReaderNode from "../readers/node/ifc-reader.js";
import FragReaderNode from "../readers/node/frag-reader.js";
import FragWriterNode from "../writers/node/frag-writer.js";
import SqliteWriterNode from "../writers/node/sqlite-writer.js";

registry.addReader(IfcReaderNode);
registry.addReader(FragReaderNode);
registry.addWriter(FragWriterNode);
registry.addWriter(SqliteWriterNode);

export { Converter, registry, convert };
