import { hrtime } from "process";
import { Omulti } from "../../lib";
import { createFakeRequest, keepRunning } from "../util";

let i = 0;
const results: number[] = [];
let keepRun = keepRunning();
function runTest() {
    const req = createFakeRequest(0.5 * 1024 * 1024, "large-multi.req");
    const start = hrtime.bigint();
    const multi = new Omulti(req);
    multi.on("part", (part) => {
        part.getContents();
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
            console.log(`10 files - 10MB per file: ${average}ms`);
            keepRun.unref();
        }
    });
}
runTest();
