<p align="center">
    <img src='./logo.png' width='120'>
</p>

<h1 align="center">
Omulti - Node.js HTTP file uploads
</h1>

![tests](https://github.com/VladVidican/omulti/actions/workflows/main.yml/badge.svg)

## Getting started

`Omulti` is a Node.js library that handles HTTP file uploads.

-   Fast
-   Easy to use
-   Written in Typescript
-   It has very few dependencies

To install it run:

```bash
npm i omulti
```

## How to use it

### Basic usage with Node.js HTTP server

To use it with a Node.js HTTP server simply create a new HTTP server an pass the `request` object into the `Omulti` constructor like so:

```typescript
import { createServer } from "http";
import { Omulti } from "omulti";

const httpServer = createServer(async (req, res) => {
    const omulti = new Omulti(req);

    for await (const file of omulti.getFiles()) {
        await file.saveToDisk("/path/where/to/save/file");
    }
});

httpServer.listen(3000);
```

As you can see the `omulti.getFiles()` function returns an async generator that allows you to iterate over evey file.

Alternatively, you can also use events if you want:

```typescript
import { createServer } from "http";
import { Omulti } from "omulti";

const httpServer = createServer(async (req, res) => {
    const omulti = new Omulti(req);

    omulti.on("file", (file) => {
        console.log(file.filename);
    });
});

httpServer.listen(3000);
```

Since `Omulti` handles multipart/form-data this means that besides files we might also receive input data from form fields.

To get just the fields do:

```typescript
import { createServer } from "http";
import { Omulti } from "omulti";

const httpServer = createServer(async (req, res) => {
    const omulti = new Omulti(req);

    for await (const field of omulti.getFields()) {
        console.log(field.name);
    }
});

httpServer.listen(3000);
```

To get both files and fields you can use the `getAll()` method. However you need to distinguish between these two types when working with them:

```typescript
import { createServer } from "http";
import { Omulti } from "omulti";

const httpServer = createServer(async (req, res) => {
    const omulti = new Omulti(req);

    for await (const part of omulti.getAll()) {
        if (part.isFile()) {
            // it's a file
        } else {
            // it's a field
        }
    }
});

httpServer.listen(3000);
```

As before you can use events here instead, so to get the fields listen on the `field` event.

```typescript
import { createServer } from "http";
import { Omulti } from "omulti";

const httpServer = createServer(async (req, res) => {
    const omulti = new Omulti(req);

    omulti.on("field", (field) => {
        console.log(file.name);
    });
});

httpServer.listen(3000);
```

Or to get both files and fields, use the `part` event:

```typescript
import { createServer } from "http";
import { Omulti } from "omulti";

const httpServer = createServer(async (req, res) => {
    const omulti = new Omulti(req);

    omulti.on("part", (part) => {
        if (part.isFile()) {
            // it's a file
        } else {
            // it's a field
        }
    });
});

httpServer.listen(3000);
```

### Options

`Omulti` allows several options to be passed to the constructor when creating a new instance. All the options are optional.

```typescript
const omulti = new Omulti(req, {
    maxTotalSize: Number,
    maxFileSize: Number,
    maxFieldSize: Number,
    maxNumberOfFiles: Number,
    maxNumberOfFields: Number,
    maxBufferSize: Number,
});
```

| Option            | Description                                                                                                                                                                                  | Default  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| maxTotalSize      | Represents the maximum number of bytes allowed for the entire request                                                                                                                        | Infinity |
| maxFileSize       | Represents the maximum number of bytes allowed per file                                                                                                                                      | Infinity |
| maxFieldSize      | Represents the maximum number of bytes allowed per field                                                                                                                                     | Infinity |
| maxNumberOfFiles  | Represents the maximum number of files allowed per request                                                                                                                                   | Infinity |
| maxNumberOfFields | Represents the maximum number of fields allowed per request                                                                                                                                  | Infinity |
| maxBufferSize     | Represents the maximum allowed number of bytes to use for the internal buffer. **Caution** This value is required for `Omulti` in order to function properly, so it's best not to change it. | 10MB     |

### Files and Fields

#### Properties

A `Field` has the following properties:

-   **name**: `string | undefined`
-   **contentType**: `string | undefined`

and a `File` has the same properties plus:

-   **filename**: `string | undefined`

Both entities have a `stream` property that is a `Readable` stream.

E.g. you can use this to pipe to a writable stream:

```typescript
import { createWriteStream } from "fs";
import { createServer } from "http";
import { Omulti } from "omulti";

const httpServer = createServer(async (req, res) => {
    const omulti = new Omulti(req);
    for await (const file of omulti.getFiles()) {
        const writeStream = createWriteStream("/some/path/to/a/dir");
        file.stream.pipe(writeStream);
    }
});

httpServer.listen(3000);
```

#### Methods

**Field**

-   getContents()

**File**

-   getContents()
-   saveToDisk(path: string)

#### `getContents()`

Both entities have a `getContents()` method that returns a `Promise<Buffer>` with the entire contents of the `Field/File`. Be careful when using this, make sure to explicitly set the `maxFieldSize` and/or the `maxFileSize`, to prevent the host machine from being starved of memory.

```typescript
import { createServer } from "http";
import { Omulti } from "omulti";

const httpServer = createServer(async (req, res) => {
    const omulti = new Omulti(req, {
        maxFileSize: 2 * 1024 * 1024, /// max 2MB
    });
    for await (const file of omulti.getFiles()) {
        const contents = (await file.getContents()).toString("utf-8");
        /// do something with the contents
    }
});

httpServer.listen(3000);
```

#### `saveToDisk(path: string)`

The `File` object also has a `saveToDisk('path/to/save/file')` method that will save the file to a provided path on the disk.
