export interface ElementDefinitionType {
  code: string;
  targetProfile?: string[];
  profile?: string[];
}

export interface ElementDefinitionBinding {
  strength: "required" | "extensible" | "preferred" | "example";
  valueSet?: string;
}

export interface ElementDefinitionConstraint {
  key: string;
  severity: "error" | "warning";
  human: string;
  expression?: string;
}

export interface ElementDefinition {
  id?: string;
  path: string;
  min?: number;
  max?: string;
  short?: string;
  definition?: string;
  mustSupport?: boolean;
  type?: ElementDefinitionType[];
  binding?: ElementDefinitionBinding;
  constraint?: ElementDefinitionConstraint[];
}

export interface StructureDefinition {
  id: string;
  url: string;
  name: string;
  type: string;
  kind: "resource" | "complex-type" | "primitive-type" | "logical";
  abstract: boolean;
  baseDefinition?: string;
  derivation?: string;
  snapshot?: {
    element: ElementDefinition[];
  };
}

export interface DefinitionIndex {
  definitions: StructureDefinition[];
  resources: Record<string, number>;
  types: Record<string, number>;
  byUrl: Record<string, number>;
}
