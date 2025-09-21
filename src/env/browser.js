import { Converter, registry, convert } from "../index.js";

import IfcReaderBrowser from "../readers/browser/ifc-reader-async.js";
import FragReaderBrowser from "../readers/browser/frag-reader-async.js";
import FragWriterBrowser from "../writers/browser/frag-writer-async.js";
import SqliteWriterBrowser from "../writers/browser/sqlite-writer-async.js";

registry.addReader(IfcReaderBrowser);
registry.addReader(FragReaderBrowser);
registry.addWriter(FragWriterBrowser);
registry.addWriter(SqliteWriterBrowser);

export { Converter, registry, convert };
