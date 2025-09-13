# @ifc-x/convert

A JavaScript library and CLI tool for converting **IFC** (and later, **web-ifc FRAG**) files into formats like **SQLite** and (SOON) **Excel**.
Supports both **Node.js** and **browser** environments with automatic reader/writer registration.

---

## Features

* Convert IFC models into structured SQLite or Excel files
* Works in Node.js and browser environments
* CLI utility for quick conversions
* Progress tracking and middleware support
* Extensible with custom readers and writers

---

## Installation

```bash
npm install @ifc-x/convert
```

For global CLI usage:

```bash
npm install -g @ifc-x/convert
```

---

## Usage

### CLI

```bash
ifc-x-convert <input.ifc> <output.db>
```

Example:

```bash
ifc-x-convert model.ifc model.sqlite
```

This reads an IFC file and writes the result as SQLite.
Progress updates are printed to the console.

---

### Library

#### Quick Convert

```js
import { convert } from "@ifc-x/convert";

const inputFile = "path/to/model.ifc";

const result = await convert(inputFile, {
  inputType: "ifc",
  outputType: "sqlite",
  progressCallback: (p) => console.log(`Progress: ${p}%`),
});

// result is a Uint8Array, ready to be saved
```

#### Custom Converter with Middleware

```js
import { Converter } from "@ifc-x/convert";

const converter = new Converter({ env: "node" });

// Example middleware: modify data before writing
converter.use(async (data) => {
  // custom transformation
  return data;
});

const result = await converter.convert("model.ifc", {
  inputType: "ifc",
  outputType: "sqlite",
});
```

---

## API

### `convert(input, options)`

Convert a file or buffer using the global registry.

* **input**: `string | File | Blob | ArrayBuffer | Uint8Array`
* **options**:

  * `inputType` (`string`) – type of input (e.g., `ifc`, `frag`)
  * `outputType` (`string`) – type of output (e.g., `sqlite`, `xlsx`)
  * `env` (`"node" | "browser"`) – execution environment
  * `readerClass` (`Function`) – force a specific reader
  * `writerClass` (`Function`) – force a specific writer
  * `middleware` (`Function[]`) – array of transformation functions
  * `progressCallback` (`Function`) – progress updates (0–100)

Returns: `Promise<Uint8Array>`

---

### `Converter`

Class for advanced conversion workflows.

#### `new Converter(options)`

* `env`: `"node"` or `"browser"`
* `readerClass`: custom reader
* `writerClass`: custom writer

#### Methods

* `use(fn)` – add a middleware function
* `detectType(input)` – detect file type
* `convert(input, options)` – perform conversion

---

### `registry`

A global registry that manages available **readers** and **writers**.
The converter uses it to automatically detect the best match for a given environment and format.

#### Methods

* `addReader(readerClass)` – register a new reader class
* `addWriter(writerClass)` – register a new writer class
* `findReader(env, type)` – find the best reader for an environment and input type
* `findWriter(env, format)` – find the best writer for an environment and output format

Readers and writers must define:

* `environments`: array of supported environments (`["node"]`, `["browser"]`, or both)
* `formats`: array of supported formats (e.g., `["ifc"]`, `["frag"]`, `["sqlite"]`)
* `priority`: number used to choose between multiple candidates

#### Example: Registering a custom writer

```js
class CustomWriter {
  static environments = ["node"];
  static formats = ["xlsx"];
  static priority = 10;

  async write(data, options) {
    // implement writing to Excel
    return new Uint8Array();
  }
}

import { registry } from "@ifc-x/convert";

registry.addWriter(CustomWriter);
```

---

## Development

### Scripts

* `npm run examples` – Run examples with Vite
* `npm test` – Run tests (currently placeholder)

---

## Dependencies

* [web-ifc](https://github.com/ifcjs/web-ifc) – IFC parser
* [sql.js](https://github.com/sql-js/sql.js) – SQLite in WebAssembly
* [sqlite](https://github.com/kriasoft/node-sqlite) / [sqlite3](https://github.com/TryGhost/node-sqlite3) – SQLite for Node.js

---

## License

MIT © [Lauri Tunnela](mailto:lauri@tunne.la)
