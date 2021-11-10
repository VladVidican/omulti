import { hrtime } from "process";
import { Writable } from "stream";
import { Omulti } from "../../lib";
import { createFakeRequest, keepRunning } from "../util";

let i = 0;
const results: number[] = [];
let keepRun = keepRunning();
function runTest() {
    const req = createFakeRequest(1 * 1024 * 1024, "large-single.req");
    const myWritable = new Writable({
        write(chunk, encoding, callback) {
            callback();
        },
    });
    const start = hrtime.bigint();
    const multi = new Omulti(req);
    multi.on("file", (file) => {
        file.stream.pipe(myWritable);
    });
    multi.on("finished", () => {
        const end = hrtime.bigint();
        const millis = (end - start) / BigInt(1000000);
        results.push(Number(millis));
        i++;
        if (i < 10) {
            runTest();
        } else {
            const average =
                results.reduce(function (sum, value) {
                    return sum + value;
                }, 0) / results.length;
            console.log(`1 file - 100MB per file: ${average}ms`);
            keepRun.unref();
        }
    });
}
runTest();
