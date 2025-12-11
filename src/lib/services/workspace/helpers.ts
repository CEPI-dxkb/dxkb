import { ValidWorkspaceObjectTypes, knownUploadTypes, otherWorkspaceObjectTypes, viewableTypes } from "./types";

export function metaListToObj(list: any) {
    return {
      id: list[4],
      path: list[2] + list[0],
      name: list[0],
      type: list[1],
      creation_time: list[3],
      link_reference: list[11],
      owner_id: list[5],
      size: list[6],
      userMeta: list[7],
      autoMeta: list[8],
      user_permission: list[9],
      global_permission: list[10],
    timestamp: Date.parse(list[3]),
  };
}

// Validator function to check if a type is a valid knownUploadType
export function isValidWorkspaceObjectType(type: string): type is ValidWorkspaceObjectTypes {
  const validTypes = getValidWorkspaceObjectTypes();
  return validTypes.includes(type as ValidWorkspaceObjectTypes);
}

// Get all valid upload type keys
export function getValidWorkspaceObjectTypes(): ValidWorkspaceObjectTypes[] {
  return [
    ...Object.keys(knownUploadTypes),
    ...otherWorkspaceObjectTypes,
    ...viewableTypes,
  ] as ValidWorkspaceObjectTypes[];
}

// Validate multiple types at once
export function validateWorkspaceObjectTypes(types: string[]): {
  valid: ValidWorkspaceObjectTypes[];
  invalid: string[];
} {
  const valid: ValidWorkspaceObjectTypes[] = [];
  const invalid: string[] = [];

  types.forEach((type) => {
    if (isValidWorkspaceObjectType(type)) {
      valid.push(type);
    } else {
      invalid.push(type);
    }
  });

  return { valid, invalid };
}