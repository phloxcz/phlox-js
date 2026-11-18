/**
 * Choosing files, like addUpload() and addMultiUpload() in Nette. The look is taken over from phloxcz/components-upload:
 * a drop zone with a button, and a table of the chosen files. Nothing is uploaded here: the value is the File objects,
 * and onSuccess decides how to send them (chunks over RPC, a stream to REST...).
 */
import type { Child } from '../ui/dom';
import { FormControl } from './controls';
import type { ExtraAttributes } from './controls';
/** Size for people, like in phloxcz/components-upload: 512 B, 1.5 KB, 3.2 MB. */
export declare function formatFileSize(bytes: number): string;
/** One file (File | null) or several (File[]). */
export declare class UploadControl<T extends File | null | File[]> extends FormControl<T> {
    readonly multiple: boolean;
    static texts: {
        dropzoneMultiple: string;
        dropzoneSingle: string;
        headingMultiple: string;
        headingSingle: string;
        or: string;
        browseMultiple: string;
        browseSingle: string;
        remove: string;
    };
    readonly files: import("..").State<File[]>;
    /** The accept attribute, from the rules MimeType and Image, as in Nette. */
    readonly accept: import("..").Accessor<string>;
    constructor(label?: string, multiple?: boolean);
    getValue(): T;
    setValue(value: T): void;
    isFilled(): boolean;
    /** Adds chosen or dropped files. A single upload keeps only the last one. The rules are checked at once. */
    addFiles(files: Iterable<File>): void;
    removeFile(file: File): void;
    /** Whether the file meets the rules about one file (size, type), for marking it in the list. */
    isValidFile(file: File): boolean;
    render(attributes: ExtraAttributes): Child;
}
