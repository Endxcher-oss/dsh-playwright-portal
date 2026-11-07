/**
 * Local tool-definition helper.
 *
 * The upstream port originally imported `defineTool` from
 * `@deepseek-ai/dsh-tools`. A bundle installed from git/npm cannot resolve that
 * package from its own node_modules, and the Harness only intercepts the import
 * for linked bundles — so activation failed with ERR_MODULE_NOT_FOUND. This
 * module reproduces the small authoring layer we need (author schema →
 * enforced JSON Schema, argument validation, output rendering) with no
 * cross-package import.
 */

type Scalar = string | number | boolean | null;

/** Author-facing value schema subset used by this plugin. */
export interface ValueSchema {
	type?: "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";
	properties?: Record<string, ValueSchema & { required?: true }>;
	required?: true;
	additionalProperties?: boolean;
	items?: ValueSchema;
	enum?: readonly Scalar[];
	const?: Scalar;
	oneOf?: readonly ValueSchema[];
	description?: string;
	title?: string;
	default?: unknown;
	examples?: unknown;
}

/** JSON Schema node produced by compiling an author schema. */
interface JsonSchemaNode {
	type?: string;
	properties?: Record<string, JsonSchemaNode>;
	required?: string[];
	additionalProperties?: boolean;
	items?: JsonSchemaNode;
	enum?: readonly Scalar[];
	const?: Scalar;
	oneOf?: JsonSchemaNode[];
	description?: string;
	title?: string;
	default?: unknown;
	examples?: unknown;
}

function compileValue(schema: ValueSchema): JsonSchemaNode {
	if (Array.isArray(schema.oneOf)) {
		return {
			oneOf: schema.oneOf.map(compileValue),
			...(schema.description ? { description: schema.description } : {}),
		};
	}

	if (schema.type === "object") {
		const { properties, required } = compilePropertyMap(schema.properties ?? {});
		return {
			type: "object",
			properties,
			...(required ? { required } : {}),
			...(schema.additionalProperties === undefined
				? {}
				: { additionalProperties: schema.additionalProperties }),
			...(schema.description ? { description: schema.description } : {}),
		};
	}

	const node: JsonSchemaNode = {};
	if (schema.type) node.type = schema.type;
	if (schema.items) node.items = compileValue(schema.items);
	if (schema.enum) node.enum = [...schema.enum];
	if (schema.const !== undefined) node.const = schema.const;
	if (schema.description) node.description = schema.description;
	if (schema.title) node.title = schema.title;
	if (schema.default !== undefined) node.default = schema.default;
	if (schema.examples !== undefined) node.examples = schema.examples;
	return node;
}

function compilePropertyMap(
	properties: Record<string, ValueSchema & { required?: true }>,
): { properties: Record<string, JsonSchemaNode>; required?: string[] } {
	const compiled: Record<string, JsonSchemaNode> = {};
	const required: string[] = [];
	for (const [name, schema] of Object.entries(properties)) {
		compiled[name] = compileValue(schema);
		if (schema.required === true) required.push(name);
	}
	return { properties: compiled, ...(required.length > 0 ? { required } : {}) };
}

function validate(value: unknown, schema: JsonSchemaNode, path: string, violations: string[]): void {
	if (Array.isArray(schema.oneOf)) {
		const matches = schema.oneOf.filter((branch) => {
			const scratch: string[] = [];
			validate(value, branch, path, scratch);
			return scratch.length === 0;
		});
		if (matches.length !== 1) violations.push(`${path || "arguments"}: must match exactly one allowed shape`);
		return;
	}

	if (schema.enum && !schema.enum.includes(value as Scalar)) {
		violations.push(`${path || "arguments"}: must be one of ${schema.enum.map(String).join(", ")}`);
		return;
	}
	if (schema.const !== undefined && value !== schema.const) {
		violations.push(`${path || "arguments"}: must equal ${String(schema.const)}`);
		return;
	}

	switch (schema.type) {
		case "object": {
			if (typeof value !== "object" || value === null || Array.isArray(value)) {
				violations.push(`${path || "arguments"}: expected object`);
				return;
			}
			const record = value as Record<string, unknown>;
			for (const name of schema.required ?? []) {
				if (!(name in record)) violations.push(`${path ? `${path}.` : ""}${name}: required`);
			}
			if (schema.additionalProperties === false) {
				for (const key of Object.keys(record)) {
					if (!(key in (schema.properties ?? {}))) {
						violations.push(`${path ? `${path}.` : ""}${key}: unexpected property`);
					}
				}
			}
			for (const [key, child] of Object.entries(schema.properties ?? {})) {
				if (key in record) validate(record[key], child, `${path ? `${path}.` : ""}${key}`, violations);
			}
			return;
		}
		case "array": {
			if (!Array.isArray(value)) {
				violations.push(`${path || "arguments"}: expected array`);
				return;
			}
			if (schema.items) value.forEach((item, index) => validate(item, schema.items!, `${path}[${index}]`, violations));
			return;
		}
		case "string":
			if (typeof value !== "string") violations.push(`${path || "arguments"}: expected string`);
			return;
		case "number":
			if (typeof value !== "number" || !Number.isFinite(value)) violations.push(`${path || "arguments"}: expected number`);
			return;
		case "integer":
			if (typeof value !== "number" || !Number.isInteger(value)) violations.push(`${path || "arguments"}: expected integer`);
			return;
		case "boolean":
			if (typeof value !== "boolean") violations.push(`${path || "arguments"}: expected boolean`);
			return;
		case "null":
			if (value !== null) violations.push(`${path || "arguments"}: expected null`);
			return;
		default:
			return;
	}
}

export interface DefineToolOptions {
	name: string;
	description: string;
	parameters: Record<string, ValueSchema & { required?: true }>;
	output: {
		schema: ValueSchema;
		render(args: unknown, value: never): Array<{ type: "text"; text: string }> | unknown[];
	};
	execute(args: unknown, exec: never): Promise<unknown>;
}

/**
 * Build a registry-ready tool definition. Mirrors the parts of DSH's
 * `defineTool` this plugin uses: compiled JSON Schema parameters, strict
 * argument validation, and the output declaration.
 */
export function defineTool(options: DefineToolOptions): Record<string, unknown> {
	const parameters = compileValue({ type: "object", properties: options.parameters }) as JsonSchemaNode;
	const outputSchema = compileValue(options.output.schema);
	return {
		name: options.name,
		description: options.description,
		parameters,
		output: {
			schema: outputSchema,
			render: (args: unknown, value: never) => options.output.render(args, value),
		},
		async execute(args: unknown, exec: never) {
			const violations: string[] = [];
			validate(args, parameters, "", violations);
			if (violations.length > 0) {
				throw new Error(`invalid arguments: ${violations.join("; ")}`);
			}
			return options.execute(args, exec);
		},
	};
}
