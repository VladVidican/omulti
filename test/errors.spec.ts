import assert from "assert";
import { Omulti } from "../lib";
import { createFakeRequest } from "./util";

describe("errors triggered because of options values", function () {
    it("should throw a total size error", async function () {
        await assert.rejects(async () => {
            const req = createFakeRequest(20, "multi.req");
            const multi = new Omulti(req, { maxTotalSize: 1000 });

            for await (const part of multi.getAll()) {
            }
        }, new Error("Total size bytes exceeds maximum total size of 1000 bytes"));
    });

    it("should throw a buffer size error", async function () {
        await assert.rejects(async () => {
            const req = createFakeRequest(20, "multi.req");
            const multi = new Omulti(req, { maxBufferSize: 10 });

            for await (const part of multi.getAll()) {
            }
        }, new Error("Buffer size 140 bytes exceeds maximum allowed of 10 bytes"));
    });

    it("should throw a max file size error", async function () {
        await assert.rejects(async () => {
            const req = createFakeRequest(20, "multi.req");
            const multi = new Omulti(req, { maxFileSize: 1000 });

            for await (const part of multi.getAll()) {
            }
        }, new Error('File "small.txt" exceeds maximum allowed size of 1000 bytes'));
    });

    it("should throw a max field size error", async function () {
        await assert.rejects(async () => {
            const req = createFakeRequest(20, "multi.req");
            const multi = new Omulti(req, { maxFieldSize: 10 });

            for await (const part of multi.getAll()) {
            }
        }, new Error('Field "test_text1" exceeds maximum allowed size of 10 bytes'));
    });

    it("should throw a max number of files error", async function () {
        await assert.rejects(async () => {
            const req = createFakeRequest(20, "multi.req");
            const multi = new Omulti(req, { maxNumberOfFiles: 1 });

            for await (const part of multi.getAll()) {
            }
        }, new Error("Number of files received: 2, exceeds maximum allowed number of files allowed: 1"));
    });

    it("should throw a max number of fields error", async function () {
        await assert.rejects(async () => {
            const req = createFakeRequest(20, "multi.req");
            const multi = new Omulti(req, { maxNumberOfFields: 1 });

            for await (const part of multi.getAll()) {
            }
        }, new Error("Number of fields received: 2, exceeds maximum allowed number of fields allowed: 1"));
    });
});
