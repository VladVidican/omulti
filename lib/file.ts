import { createWriteStream } from "fs";
import { stat } from "fs/promises";
import { IncomingMessage } from "http";
import * as nodePath from "path";
import { Field } from "./field";

export class File extends Field {
    constructor(
        req: IncomingMessage,
        name: string | undefined,
        contentType: string | undefined,
        public filename: string | undefined
    ) {
        super(req, name, contentType);
        if (filename === "") {
            this.filename = undefined;
        }
    }

    async saveToDisk(path: string) {
        if (!this.filename) {
            throw new Error(`Can't write to ${path} as filename is missing`);
        }

        const stats = await stat(path);

        if (!stats.isDirectory()) {
            throw new Error("Path must be a directory");
        }

        path = nodePath.join(path, this.filename);

        const writeStream = createWriteStream(path);
        return new Promise((resolve, reject) => {
            this.stream
                .pipe(writeStream)
                .on("finish", () => {
                    resolve(true);
                })
                .on("error", (err) => {
                    reject(err);
                });
        });
    }

    isFile(): this is File {
        return true;
    }
}
