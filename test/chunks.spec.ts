import assert from "assert";
import { Omulti } from "../lib";
import { createFakeRequest } from "./util";

describe("check if part contents is correct with different chunk sizes", function () {
    const body = "hello\r\n";

    it("should return the full file contents for 10 byte chunks", async function () {
        const req = createFakeRequest(10, "small.req");
        const multi = new Omulti(req);
        for await (const file of multi.getAll()) {
            const contents = await file.getContents();
            assert.strictEqual(contents.toString(), body);
        }
    });

    it("should return the full file contents for 20 byte chunks", async function () {
        const req = createFakeRequest(20, "small.req");
        const multi = new Omulti(req);
        for await (const file of multi.getAll()) {
            const contents = await file.getContents();
            assert.strictEqual(contents.toString(), body);
        }
    });

    it("should return the full file contents for 50 byte chunks", async function () {
        const req = createFakeRequest(50, "small.req");
        const multi = new Omulti(req);
        for await (const file of multi.getAll()) {
            const contents = await file.getContents();
            assert.strictEqual(contents.toString(), body);
        }
    });

    it("should return the full file contents for 100 byte chunks", async function () {
        const req = createFakeRequest(100, "small.req");
        const multi = new Omulti(req);
        for await (const file of multi.getAll()) {
            const contents = await file.getContents();
            assert.strictEqual(contents.toString(), body);
        }
    });

    it("should return the full file contents for 200 byte chunks", async function () {
        const req = createFakeRequest(200, "small.req");
        const multi = new Omulti(req);
        for await (const file of multi.getAll()) {
            const contents = await file.getContents();
            assert.strictEqual(contents.toString(), body);
        }
    });
});
