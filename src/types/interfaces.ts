/** @format */

export interface Package {
	version: string;
	dependencies?: { [index: string]: string };
}

export interface Config {
	// Whether to check for dependency updates.
	update: boolean;
	// Whether to bundle the project with tsup.
	bundle: boolean;
	// Whether to check if export types are exported correctly.
	checkTypes: boolean;
	// Whether to generate type documentation with typedoc.
	typedoc: boolean;
	// Folders to format with prettier.
	formatFolders: Array<string>;
}

export type ConfigType = null | Config;
