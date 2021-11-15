import { IncomingMessage } from "http";
import { Field } from "./field";
import { File } from "./file";
import { Header } from "./header";
import { TypedEmitter } from "tiny-typed-emitter";
import { OmultiEvents } from "./omulti-events.interface";

export { Field, File };

enum Mode {
    BOUNDARY,
    HEADER,
}

export interface OmultiOptions {
    maxBufferSize: number;
    maxTotalSize: number;
    maxFileSize: number;
    maxFieldSize: number;
    maxNumberOfFiles: number;
    maxNumberOfFields: number;
}

export class Omulti extends TypedEmitter<OmultiEvents> {
    /**
     * There are two modes in which Omulti can be in: BOUNDARY & HEADER.
     *
     * In BOUNDARY mode which is the default, it searches for a new boundary
     * and if none is found it adds the data to the currently processing part (if any).
     *
     * In HEADER mode it takes in all the chunks it receives until it has the entire header in memory.
     */
    private mode = Mode.BOUNDARY;

    /**
     * Keeps at the most two chunks so that it can check for a boundary
     * Used only in BOUNDARY mode
     */
    private internalBuffer: Buffer[] = [];

    /**
     * Keeps track if at least two chunks have been added to the internal buffer.
     * If two chunks have been added so far, the internal buffer is "fresh".
     * On the third it changes to false.
     */
    private internalBufferFresh = true;

    /**
     * Stores the header data
     * Used only in HEADER mode
     */
    private headerBuffer = Buffer.alloc(0);

    /**
     * A chunk can't be smaller than the size of the endBoundary,
     * so this cache is used to aggregate smaller chunks
     */
    private chunkCache = Buffer.alloc(0);

    /**
     * The data getter is basically a concat of all internal buffer chunks.
     * Since buffer concat is expensive we would like to avoid doing it if possible,
     * therefore whenever we do it once, we cache it and after a new chunk has arrived we invalidate it
     */
    private dataCache = Buffer.alloc(0);
    private invalidateDataCache = true;

    /**
     * The current header and part that are being processed
     */
    private currentHeader: Header | null = null;
    private currentPart: Field | null = null;

    private requestHasFinished = false;
    private endReached = false;

    private CRLF = Buffer.from("\r\n");

    /**
     * A header is ended by an empty line
     */
    private headerEnd = Buffer.concat([this.CRLF, this.CRLF]);

    private boundary = "";
    private endBoundary = "";
    private endBoundaryLength: number;

    private options: OmultiOptions = {
        maxBufferSize: 1e7, // default of 10MB
        maxTotalSize: Infinity,
        maxFieldSize: Infinity,
        maxFileSize: Infinity,
        maxNumberOfFields: Infinity,
        maxNumberOfFiles: Infinity,
    };

    private currentPartSize = 0;
    private totalSize = 0;
    private numberOfFiles = 0;
    private numberOfFields = 0;

    constructor(private req: IncomingMessage, options?: Partial<OmultiOptions>) {
        super();
        const boundaryToken = this.getBoundaryToken();
        this.boundary = "--" + boundaryToken;
        this.endBoundary = this.boundary + "--";
        this.endBoundaryLength = this.endBoundary.length;
        this.options = { ...this.options, ...options };

        this.once("newListener", async (event) => {
            if (["file", "field", "part"].includes(event)) {
                this.handleRequestEvents();
            }
        });
    }

    /**
     * @returns The boundary token from the content-type header
     */
    private getBoundaryToken() {
        const contentType = this.req.headers["content-type"];
        if (!contentType) {
            throw new Error("Missing content-type header");
        }
        const contentTypeParts = contentType.split(";");
        if (!contentTypeParts.includes("multipart/form-data")) {
            throw new Error("Not a multipart/form-data request");
        }
        const boundary = contentTypeParts.filter((value) => value.includes("boundary") === true).pop();
        if (!boundary) {
            throw new Error("Could not process boundary");
        }
        const boundaryToken = boundary.split("=").pop();

        if (!boundaryToken) {
            throw new Error("Could not process boundary");
        }

        return boundaryToken;
    }

    private handleRequestEvents() {
        const handleData = (chunk: any, force = false) => {
            try {
                this.handleData(chunk, force);
            } catch (err) {
                this.req.removeListener("data", handleData);
                if (this.listenerCount("error")) {
                    this.emit("error", err);
                }
            }
        };

        this.req.on("data", handleData);

        this.req.on("close", () => {
            this.requestHasFinished = true;
        });

        this.req.on("end", () => {
            this.requestHasFinished = true;
            if (!this.endReached && this.internalBuffer.length === 1) {
                handleData(null, true);
            }
        });
    }

    /**
     * @description Get only the fields, ignoring the files
     */
    async *getFields() {
        this.handleRequestEvents();

        let nextPart;
        do {
            nextPart = await this.getNextPart();
            if (nextPart !== null && nextPart instanceof Field) {
                yield nextPart;
            }
        } while (nextPart !== null);
    }

    /**
     * @description Get only the files, ignoring the fields
     */
    async *getFiles() {
        this.handleRequestEvents();

        let nextPart;
        do {
            nextPart = await this.getNextPart();

            if (nextPart !== null && nextPart instanceof File) {
                yield nextPart;
            }
        } while (nextPart !== null);
    }

    /**
     * @description Get all files and fields
     */
    async *getAll() {
        this.handleRequestEvents();

        let nextPart;
        do {
            nextPart = await this.getNextPart();
            if (nextPart !== null) {
                yield nextPart;
            }
        } while (nextPart !== null);
    }

    private async getNextPart() {
        const nextPartPromise = new Promise<File | Field | null>((resolve, rejects) => {
            const handleError = (err: any) => {
                clearListeners();
                if (!this.listenerCount("error")) {
                    rejects(err);
                }
            };

            const handleFinished = () => {
                resolve(null);
                clearListeners();
            };

            const handlePart = (part: File | Field) => {
                resolve(part);
                clearListeners();
            };

            const clearListeners = () => {
                this.removeListener("error", handleError);
                this.removeListener("finished", handleFinished);
                this.removeListener("part", handlePart);
            };

            if (this.endReached) {
                resolve(null);
                return;
            }

            this.on("error", handleError);
            this.on("finished", handleFinished);
            this.on("part", handlePart);
        });
        return nextPartPromise;
    }

    private handleData(chunk: Buffer | null, force = false) {
        const shouldContinue = this.addChunkToInternalBuffer(chunk);

        // if we don't have enough data we shouldn't go past this point
        if (!shouldContinue) {
            return;
        }

        if (this.mode === Mode.BOUNDARY) {
            if (this.internalBuffer.length < 2 && !force) {
                return;
            }

            const nextBoundaryIndex = this.getNextBoundaryIndex();
            this.endReached = this.checkIfEndReached(nextBoundaryIndex);

            if (nextBoundaryIndex !== -1) {
                this.switchMode(Mode.HEADER);
                if (this.currentPart) {
                    const remainingData = this.data.slice(0, nextBoundaryIndex - this.CRLF.length);
                    if (remainingData.length > 0) {
                        this.currentPart.stream.push(remainingData);
                    }
                    this.currentPart.stream.push(null);
                }

                if (!this.endReached) {
                    this.headerBuffer = this.data.slice(nextBoundaryIndex);
                }
            } else {
                if (!this.currentPart!.stream.push(this.internalBuffer[0])) {
                    return this.req.pause();
                }
            }
        }

        if (this.endReached) {
            this.emit("finished");
            return;
        }

        if (this.mode === Mode.HEADER) {
            this.internalBuffer = [];
            this.internalBufferFresh = true;
            const headerEndIndex = this.getHeaderEndIndex();
            if (headerEndIndex !== -1) {
                this.processHeader(headerEndIndex);
                if (this.requestHasFinished) {
                    this.handleData(null, true);
                }
            }
        }
    }

    private getHeaderEndIndex() {
        return this.headerBuffer.indexOf(this.headerEnd);
    }

    private switchMode(mode: Mode) {
        this.mode = mode;
    }

    /**
     *  @descriptions Creates a new header when the entire header data has been buffered
     *  and after that creates a new part and switchs to BOUNDARY mode
     */
    private processHeader(headerEndIndex: number) {
        this.currentHeader = new Header();
        this.currentPartSize = 0;

        this.currentHeader.content = this.headerBuffer
            .slice(this.boundary.length + this.CRLF.length, headerEndIndex)
            .toString("utf-8");

        this.switchMode(Mode.BOUNDARY);

        this.createNewPart();

        // at this point we need to move the remaining data that was not part of the header (i.e. the body of part)
        // into the internal buffer
        const remainingData = this.headerBuffer.slice(headerEndIndex + this.headerEnd.length);
        this.headerBuffer = Buffer.alloc(0);
        if (remainingData.length > 0) {
            this.addChunkToInternalBuffer(remainingData);
        }
    }

    /**
     * @description Creates a new part (file or field) and stores it and
     * emits a "part" event and a "file" or "field" event
     */
    private createNewPart(): void {
        if (this.currentHeader!.isFile) {
            this.numberOfFiles++;
            this.currentPart = new File(
                this.req,
                this.currentHeader!.name,
                this.currentHeader!.contentType,
                this.currentHeader!.filename
            );
        } else {
            this.currentPart = new Field(this.req, this.currentHeader!.name, this.currentHeader!.contentType);
            this.numberOfFields++;
        }

        this.checkMaxParts();
        this.emit("part", this.currentPart);
        if (this.currentPart instanceof File) {
            this.emit("file", this.currentPart);
        } else {
            this.emit("field", this.currentPart);
        }
    }

    /**
     * @description In BOUNDARY MODE adds a new chunk to the internalBuffer
     * if the size of the chunk is large enough, if not uses the chunkCache
     *
     * In HEADER mode simply adds the chunk to the headerBuffer
     * @returns A boolean that let's he invoking function it internalBuffer has enough data to continue processing
     */
    private addChunkToInternalBuffer(chunk: Buffer | null): boolean {
        if (chunk === null) {
            if (this.chunkCache.length) {
                this.internalBuffer.push(this.chunkCache);
                this.chunkCache = Buffer.alloc(0);
            }
            return true;
        }

        this.incrementSize(chunk.length);

        if (this.mode === Mode.BOUNDARY) {
            this.invalidateDataCache = true;

            if (this.chunkCache.length > 0 || chunk.length < this.endBoundaryLength) {
                this.chunkCache = Buffer.concat([this.chunkCache, chunk]);
            }

            if (this.chunkCache.length > 0) {
                if (this.chunkCache.length >= this.endBoundaryLength) {
                    chunk = this.chunkCache;
                    this.chunkCache = Buffer.alloc(0);
                } else {
                    return false;
                }
            }

            if (this.internalBuffer.length < 2) {
                this.internalBuffer.push(chunk);
            } else {
                this.internalBuffer = [this.internalBuffer[1], chunk];
                this.internalBufferFresh = false;
            }
            return true;
        } else {
            this.headerBuffer = Buffer.concat([this.headerBuffer, chunk]);
            this.checkBufferSize();
            return true;
        }
    }

    private checkBufferSize() {
        if (this.headerBuffer.length > this.options.maxBufferSize) {
            throw new Error(
                `Buffer size ${this.headerBuffer.length} bytes exceeds maximum allowed of ${this.options.maxBufferSize} bytes`
            );
        }
    }

    private incrementSize(noOfbytes: number) {
        this.currentPartSize += noOfbytes;
        this.totalSize += noOfbytes;
        this.checkMaxSize();
    }

    private checkMaxSize() {
        if (this.totalSize > this.options.maxTotalSize) {
            throw new Error(`Total size bytes exceeds maximum total size of ${this.options.maxTotalSize} bytes`);
        }

        if (this.currentHeader && this.currentHeader.isFile && this.currentPartSize > this.options.maxFileSize) {
            throw new Error(
                `File "${
                    this.currentHeader.filename ? this.currentHeader.filename : this.currentHeader.name
                }" exceeds maximum allowed size of ${this.options.maxFileSize} bytes`
            );
        }

        if (this.currentHeader && !this.currentHeader.isFile && this.currentPartSize > this.options.maxFieldSize) {
            throw new Error(
                `Field "${this.currentHeader.name}" exceeds maximum allowed size of ${this.options.maxFieldSize} bytes`
            );
        }
    }

    private checkMaxParts() {
        if (this.numberOfFiles > this.options.maxNumberOfFiles) {
            throw new Error(
                `Number of files received: ${this.numberOfFiles}, exceeds maximum allowed number of files allowed: ${this.options.maxNumberOfFiles}`
            );
        }
        if (this.numberOfFields > this.options.maxNumberOfFields) {
            throw new Error(
                `Number of fields received: ${this.numberOfFields}, exceeds maximum allowed number of fields allowed: ${this.options.maxNumberOfFields}`
            );
        }
    }

    private get data() {
        if (this.invalidateDataCache) {
            this.dataCache = Buffer.concat(this.internalBuffer);
            this.invalidateDataCache = false;
        }
        return this.dataCache;
    }

    /**
     * @description Since the internalBuffer keeps two chunks of data in memory
     * to search for the next boundary, we actually don't need to search the entire first chunk
     * only the the last few bytes, where the number of bytes corresponds to the length of the endBoundary
     * @returns The number of bytes to exclude from the first chunk
     */
    private boundarySearchOffset(): number {
        // we should be applying the offset algorithm only after
        // there were at least two chunks in the internal buffer
        if (this.internalBufferFresh) {
            return 0;
        }

        if (
            this.internalBuffer[0].length <= this.endBoundaryLength ||
            this.internalBuffer[1].length <= this.endBoundaryLength
        ) {
            return 0;
        }

        return this.internalBuffer[0].length - this.endBoundaryLength;
    }

    /**
     * @description This method is only called when in BOUNDARY mode
     * It takes into account the offset (if any) to exclude from the first chunk
     * @returns Returns the index of the next boundary, or -1 if not found
     */
    private getNextBoundaryIndex(): number {
        return this.data.indexOf(this.boundary, this.boundarySearchOffset());
    }

    /**
     *  @description Checks if the data contains the end boundary
     */
    private checkIfEndReached(boundaryIndex: number): boolean {
        if (
            boundaryIndex !== -1 &&
            this.data
                .slice(boundaryIndex, boundaryIndex + this.endBoundary.length)
                .equals(Buffer.from(this.endBoundary))
        ) {
            return true;
        }
        return false;
    }
}
