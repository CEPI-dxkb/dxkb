/**
 * Example usage and tests for workspace type validators
 *
 * This file demonstrates how to use the validator functions
 * to ensure workspace object types are valid.
 */

import {
  isValidWorkspaceObjectType,
  validateWorkspaceObjectTypes,
  getValidWorkspaceObjectTypes,
} from "./helpers";
import { ValidWorkspaceObjectTypes } from "./types";

// Example 1: Validate a single type
function validateSingleType(type: string): boolean {
  if (isValidWorkspaceObjectType(type)) {
    console.log(`✅ "${type}" is a valid upload type`);
    return true;
  } else {
    console.error(`❌ "${type}" is NOT a valid upload type`);
    return false;
  }
}

// Example usage:
// validateSingleType("reads"); // ✅ true
// validateSingleType("invalid_type"); // ❌ false
// validateSingleType("csv"); // ✅ true

// Example 2: Validate multiple types
function validateMultipleTypes(types: string[]): void {
  const { valid, invalid } = validateWorkspaceObjectTypes(types);

  if (invalid.length > 0) {
    console.error(`Found invalid types: ${invalid.join(", ")}`);
    console.log(`Valid types found: ${valid.join(", ")}`);
  } else {
    console.log(`✅ All types are valid: ${valid.join(", ")}`);
  }
}

// Example usage:
// validateMultipleTypes(["reads", "contigs", "csv"]); // All valid
// validateMultipleTypes(["reads", "invalid", "csv"]); // Mixed valid/invalid

// Example 3: Get all available types
function listAllAvailableTypes(): void {
  const allTypes = getValidWorkspaceObjectTypes();
  console.log("Available workspace object types:");
  allTypes.forEach((type) => console.log(`  - ${type}`));
}

// Example 4: Type guard usage
function processWorkspaceObjectType(type: string): void {
  // Using the type guard ensures TypeScript knows the type is valid
  if (isValidWorkspaceObjectType(type)) {
    // TypeScript now knows 'type' is ValidWorkspaceObjectTypes
    const validType: ValidWorkspaceObjectTypes = type;
    console.log(`Processing valid type: ${validType}`);
    // Your workspace object logic here
  } else {
    throw new Error(`Invalid workspace object type: ${type}`);
  }
}

// Example 5: Component prop validation
function validateComponentProps(
  types?: ValidWorkspaceObjectTypes | ValidWorkspaceObjectTypes[],
): string[] | undefined {
  if (!types) {
    return undefined;
  }

  const typesArray = Array.isArray(types) ? types : [types];
  const { valid, invalid } = validateWorkspaceObjectTypes(typesArray);

  if (invalid.length > 0) {
    throw new Error(`Invalid workspace object types provided: ${invalid.join(", ")}`);
  }

  return valid;
}

// Example usage:
// validateComponentProps("reads"); // ["reads"]
// validateComponentProps(["reads", "csv", "contigs"]); // ["reads", "csv", "contigs"]
// validateComponentProps(["reads", "invalid"]); // Throws error

export {
  validateSingleType,
  validateMultipleTypes,
  listAllAvailableTypes,
  processWorkspaceObjectType,
  validateComponentProps,
};
