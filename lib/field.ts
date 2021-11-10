import { IncomingMessage } from "http";
import { Readable } from "stream";
import { File } from "./file";

export class Field {
    public stream: Readable;

    constructor(req: IncomingMessage, public name: string | undefined, public contentType: string | undefined) {
        if (name === "") {
            this.name = undefined;
        }

        if (contentType === "") {
            this.contentType = undefined;
        }
        this.stream = new Readable({
            read() {
                req.resume();
            },
        });
    }

    getContents(): Promise<Buffer> {
        return new Promise<Buffer>((resolve) => {
            let contents: Buffer[] = [];

            this.stream.on("data", (data) => {
                contents.push(data);
            });

            this.stream.on("end", () => {
                resolve(Buffer.concat(contents));
            });
        });
    }

    isFile(): this is File {
        return false;
    }
}
