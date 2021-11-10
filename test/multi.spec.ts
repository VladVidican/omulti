import assert from "assert";
import { Omulti } from "../lib";
import { createFakeRequest } from "./util";

describe("should handle multiple parts of mixed fields and files", function () {
    it("should have 2 files and 2 fields - 20 byte chunks", async function () {
        const req = createFakeRequest(20, "multi.req");
        const multi = new Omulti(req);

        let receivedFields = 0;
        let receivedFiles = 0;

        for await (const part of multi.getAll()) {
            if (part.isFile()) {
                receivedFiles++;
            } else {
                receivedFields++;
            }
        }

        assert.strictEqual(receivedFiles, 2);
        assert.strictEqual(receivedFields, 2);
    });

    it("should have 2 files and 2 fields - 100 byte chunks", async function () {
        const req = createFakeRequest(100, "multi.req");
        const multi = new Omulti(req);

        let receivedFields = 0;
        let receivedFiles = 0;

        for await (const part of multi.getAll()) {
            if (part.isFile()) {
                receivedFiles++;
            } else {
                receivedFields++;
            }
        }

        assert.strictEqual(receivedFiles, 2);
        assert.strictEqual(receivedFields, 2);
    });

    it("should have 2 files and 2 fields - 1000 byte chunks", async function () {
        const req = createFakeRequest(1000, "multi.req");
        const multi = new Omulti(req);

        let receivedFields = 0;
        let receivedFiles = 0;

        for await (const part of multi.getAll()) {
            if (part.isFile()) {
                receivedFiles++;
            } else {
                receivedFields++;
            }
        }

        assert.strictEqual(receivedFiles, 2);
        assert.strictEqual(receivedFields, 2);
    });
});
