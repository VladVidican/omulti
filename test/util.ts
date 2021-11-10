import { createReadStream } from "fs";
import { IncomingMessage } from "http";
import path from "path/posix";
import { Readable } from "stream";

interface FakeIncommingMessage extends Readable {
    headers: Record<string, string>;
}

export function createFakeRequest(chunkSize: number, requestFixtureFilename: string): IncomingMessage {
    const reqPath = path.join(__dirname, "data", requestFixtureFilename);

    const req: Readable = createReadStream(reqPath, {
        highWaterMark: Math.round(chunkSize),
    });

    (req as FakeIncommingMessage).headers = {
        "content-type": "multipart/form-data; boundary=----WebKitFormBoundaryyBxsRq8ZuE1dSHlY",
    };

    return req as IncomingMessage;
}

export function keepRunning(): NodeJS.Timeout {
    return setTimeout(() => keepRunning(), 100000);
}
