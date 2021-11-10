import assert from "assert";
import { Omulti } from "../lib";
import { createFakeRequest } from "./util";

describe("check that events are working as expected", function () {
    it("receive two 'file' events and a 'finished' event", function (done) {
        this.timeout(1000);
        const req = createFakeRequest(1000, "multi.req");
        const omulti = new Omulti(req);

        let error: any;
        let fileEvents = 0;
        omulti.on("file", (file) => {
            fileEvents++;
            try {
                assert.strictEqual(file.filename, "small.txt");
            } catch (err) {
                error = err;
            }
        });

        omulti.on("finished", () => {
            try {
                assert.strictEqual(fileEvents, 2);
            } catch (err) {
                error = err;
            }

            done(error);
        });
    });

    it("receive two 'field' events and a 'finished' event", function (done) {
        this.timeout(1000);
        const req = createFakeRequest(1000, "multi.req");
        const omulti = new Omulti(req);

        let error: any;
        let fieldEvents = 0;
        omulti.on("field", (field) => {
            fieldEvents++;

            try {
                if (fieldEvents === 1) {
                    assert.strictEqual(field.name, "test_text1");
                } else {
                    assert.strictEqual(field.name, "test_text2");
                }
            } catch (err) {
                error = err;
            }
        });

        omulti.on("finished", () => {
            try {
                assert.strictEqual(fieldEvents, 2);
            } catch (err) {
                error = err;
            }

            done(error);
        });
    });

    it("receive four 'part' events and a 'finished' event", function (done) {
        this.timeout(1000);
        const req = createFakeRequest(1000, "multi.req");
        const omulti = new Omulti(req);

        let error: any;
        let partEvents = 0;

        omulti.on("part", (part) => {
            partEvents++;
        });

        omulti.on("finished", () => {
            try {
                assert.strictEqual(partEvents, 4);
            } catch (err) {
                error = err;
            }

            done(error);
        });
    });
});
