interface BaseSwaggerStruct {
    swagger: string;
    info: any;
    host: string;
    schemes: string[];
    basePath: string;
    consumes: string[];
    produces: string[];
    securityDefinitions: any;
    security: any[];
    paths: { [name: string]: PathStruct };
    definitions: { [name: string]: DefinitionStruct };
}

interface LineWriteStruct {
    tabs: number;
    text: string;
}

type PathStruct = {
    [key in PathMethodsType]?: PathMethodStruct;
} & {
    parameters: PathParameterPath[];
};
interface PathParameterBody {
    name: 'data';
    in: 'body';
    required: boolean;
    schema: PathMethodResponseSchemaType;
}
interface PathParameterQuery {
    name: string;
    in: 'query';
    description: string;
    default?: string;
    type?: string;
}
interface PathParameterPath {
    name: string;
    in: 'path';
    type: string;
    description?: string;
}
interface PathMethodStruct {
    operationId: string;
    summary: string;
    description: string;
    parameters: PathParameter[];
    responses: { [name: string]: PathMethodResponseStruct };
    tags: string[];
}
interface PathMethodResponseStruct {
    description: string;
    schema?: PathMethodResponseSchemaType;
}

type PathParameter = PathParameterBody | PathParameterQuery | PathParameterPath;
type PathMethodResponseSchemaType = DefinitionPropertyType | DefinitionStruct;
type PathMethodsType = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface DefinitionStruct {
    required: string[];
    type: 'object';
    properties: DefinitionPropertiesType;
}
interface DefinitionPropertyStruct {
    title: string;
    type: 'integer' | 'number' | 'string' | 'boolean';
    'x-nullable'?: boolean;
}
interface DefinitionPropertyArrayStruct {
    type: 'array';
    items: DefinitionPropertyType;
    'x-nullable'?: boolean;
}
interface DefinitionPropertyObjectStruct {
    type: undefined;
    $ref: string;
    'x-nullable'?: boolean;
}

type DefinitionPropertiesType = { [name: string]: DefinitionPropertyType };
type DefinitionPropertyType = DefinitionPropertyStruct | DefinitionPropertyArrayStruct | DefinitionPropertyObjectStruct;

type TypeAssociationsNameType = string;
type TypeAssociationsPathType = string;
type TypeAssociationsStruct = { [name: string]: [TypeAssociationsNameType, TypeAssociationsPathType?] };
