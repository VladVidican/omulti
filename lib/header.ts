export class Header {
    content = "";

    get isFile(): boolean {
        return this.content.includes("filename") || this.contentType === "application/octet-stream";
    }

    get name(): string {
        const regex = /name="([^"]*)"/g;
        const matches = regex.exec(this.content);
        if (matches) {
            const [, value] = matches;
            return value;
        }
        return "";
    }

    get filename(): string {
        const regex = /filename="([^"]*)"/g;
        const matches = regex.exec(this.content);
        if (matches) {
            const [, value] = matches;
            return value;
        }
        return "";
    }

    get contentType(): string {
        const regex = /^content-type: ?([^\s]*)/gim;
        const matches = regex.exec(this.content);
        if (matches) {
            const [, value] = matches;
            return value;
        }
        return "";
    }
}
