import { Field } from "./field";
import { File } from "./file";

export interface OmultiEvents {
    part: (part: Field | File) => void;
    file: (file: File) => void;
    field: (field: Field) => void;
    finished: () => void;
    error: (error: unknown) => void;
    newListener: (event: string, listener: Function) => void;
}
