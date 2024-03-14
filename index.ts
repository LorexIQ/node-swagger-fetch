import config from './swagger-parser.config.json';
import * as AxiosAll from 'axios';
import fs from 'fs';
import path from 'path';

const axios = AxiosAll.default;
// const config = {
//     swaggerURL: "",
//     dirPath: "./api",
//     isAllKeysRequired: false,
//     updateEntity: true,
//     updateAPI: true,
//     updateSystemTypes: true,
//     ..._config
// };
const entityDir = path.resolve(config.dirPath, 'entity');

const typeAssociations: TypeAssociationsStruct = {
    'count-name-previous-results': ['ApiPagination']
};

async function getSwaggerJson(): Promise<BaseSwaggerStruct> {
    return await axios
        .get<BaseSwaggerStruct>(config.swaggerURL)
        .then(res => res.data);
}

function writeToFile(name: string, data: LineWriteStruct[]) {
    function tab(n: number) {
        return [...Array(n)].map(() => '\t').join('');
    }

    fs.writeFileSync(name, data.map(row => `${tab(row.tabs)}${row.text}`).join('\n'));
}
function mergeLineWithList(line: LineWriteStruct, list: LineWriteStruct[]): LineWriteStruct[] {
    const slicedList = list.slice(1);
    line.text += list[0].text;
    return [line, ...slicedList];
}

function getNameByRef(ref: string): string {
    return ref.split('/').at(-1)! + 'Entity';
}
function getObjectFromPropertiesWithIncludes(properties: DefinitionPropertiesType): [Set<string>, string[]] {
    const propertiesList: string[] = [];
    const importsList = new Set<string>();

    for (const property of Object.keys(properties)) {
        const [includedInterface, keyType] = getEntityProperty(properties[property], property);

        if (includedInterface) importsList.add(includedInterface);

        propertiesList.push(`${keyType};`);
    }

    return [importsList, propertiesList];
}
function getEntityProperty(property: DefinitionPropertyType, key?: string): [string | undefined, string] {
    const isRequired = config.isAllKeysRequired || !property["x-nullable"];

    if (!property.type) {
        const refName = getNameByRef(property.$ref);
        return [refName, key ? `${key}${isRequired ? '' : '?'}: ${refName}` : refName];
    } else if (property.type === 'array') {
        const [prevImport, prevProperty] = getEntityProperty(property.items, key);
        return [prevImport, `${prevProperty}[]`];
    } else {
        const type = ['number', 'integer'].includes(property.type) ? 'number' : property.type;
        return [undefined, key ? `${key}${isRequired ? '' : '?'}: ${type}` : type];
    }
}

function createIndexEntityFile(keys: string[]): void {
    const keysStr = keys
        .map(key => `export * from './${key}.entity';`)
        .sort((a, b) => a.length > b.length ? -1 : 1)
        .join('\n');
    fs.writeFileSync(path.resolve(entityDir, 'index.ts'), keysStr);
}
function createOrSkipFolderCreation(): void {
    function enableFullRefresh(): void {
        config.updateEntity = true;
        config.updateAPI = true;
        config.updateSystemTypes = true;
    }

    if (!fs.existsSync(config.dirPath)) {
        fs.mkdirSync(config.dirPath);
        enableFullRefresh();
    }
    if (!fs.existsSync(entityDir)) {
        fs.mkdirSync(entityDir);
        enableFullRefresh();
    }
}
function createEntityInterfaceFile(key: string, definition: DefinitionStruct): void {
    const [importsList, propertiesList] = getObjectFromPropertiesWithIncludes(definition.properties);

    const includesResult = `import {\n\t${[...importsList].join(',\n\t')}\n} from '../entity';\n\n`;
    const interfaceResult = `export interface ${key}Entity {\n\t${propertiesList.join('\n\t')}\n}`;

    fs.writeFileSync(
        path.resolve(entityDir, `${key}.entity.ts`),
        `${importsList.size ? `${includesResult}` : ''}${interfaceResult}`
    );
}
function parseAndWriteDefinitions(json: BaseSwaggerStruct): void {
    const keys = Object.keys(json.definitions);

    createIndexEntityFile(keys);

    for (const key of keys) createEntityInterfaceFile(key, json.definitions[key]);
}

function createSystemTypesFile(): void {
    writeToFile(
        path.resolve(config.dirPath, 'system.types.ts'),
        [
            { tabs: 0, text: 'export type APIQuery = string | number;' },
            { tabs: 0, text: 'export type APIParameter = string | number;' },
            { tabs: 0, text: 'export type APIEmpty = {};' }
        ]
    );
}
function getPathSchemaType(schema?: PathMethodResponseSchemaType, tabs: number = 0): [Set<string>, LineWriteStruct[]] {
    const emptySet = new Set<string>();

    if (!schema) return [emptySet, [ { tabs, text: 'APIEmpty;' } ]];
    else if (!schema.type) {
        const preparedName = getNameByRef(schema.$ref);
        emptySet.add(preparedName);
        return [emptySet, [ { tabs, text: `${preparedName};` } ]];
    } else if (schema.type === 'object') {
        const preparedType = getObjectFromPropertiesWithIncludes(schema.properties);
        return [preparedType[0], [
            { tabs, text: '{'},
            ...preparedType[1].map(el => ({ tabs: tabs + 1, text: el })),
            { tabs, text: '};'},
        ]];
    } else {
        const preparedType = getEntityProperty(schema);
        if (preparedType[0]) emptySet.add(preparedType[0]);
        return [emptySet, [ { tabs, text: `${preparedType[1]};` } ]];
    }
}
function getPathMethod(path: string, method: PathMethodStruct, parameters: PathParameterPath[], tabs: number = 1): [Set<string>, LineWriteStruct[]] {
    let importsList = new Set<string>();
    const responsesList: LineWriteStruct[] = [];
    const queryList: LineWriteStruct[] = [];
    const parametersList: LineWriteStruct[] = [];
    const bodyResult: LineWriteStruct[] = [];

    const responses = method.responses;
    const query = method.parameters.filter(parameter => parameter.in === 'query') as PathParameterQuery[];
    const body = method.parameters.find(parameter => parameter.in === 'body') as PathParameterBody;

    for (const responseKey of Object.keys(responses)) {
        const response = responses[responseKey];
        const responseType = getPathSchemaType(response.schema, tabs + 2);

        if (responseType[0]) importsList = new Set([...importsList, ...responseType[0]]);

        responsesList.push(...mergeLineWithList(
            { tabs: tabs + 2, text: `${responseKey}: `},
            responseType[1]
        ));
    }

    for (const queryObj of query) {
        queryList.push({ tabs: tabs + 2, text: `${queryObj.name}?: APIQuery;${queryObj.description ? ` // ${queryObj.description}` : ''}` });
    }

    for (const parameter of parameters) {
        parametersList.push({ tabs: tabs + 2, text: `${parameter.name}: APIParameter;` });
    }

    if (body) {
        const bodyType = getPathSchemaType(body.schema);
        importsList = new Set([...importsList, ...bodyType[0]]);
        bodyResult.push(
            ...mergeLineWithList(
                { tabs: tabs + 1, text: `body${body.required ? '' : '?'}: `},
                bodyType[1]
            )
        );
    }

    const summaryResult: LineWriteStruct[] = method.summary ? [
        { tabs: tabs, text: `/* ${method.summary} */` }
    ] : [];
    const responsesResult: LineWriteStruct[] = [
        { tabs: tabs + 1, text: `responses: ${responsesList.length ? '{' : 'APIEmpty'}`},
        ...(responsesList.length ? [
                ...responsesList,
                { tabs: tabs + 1, text: '};' }
        ] : [])
    ];
    const queryResult: LineWriteStruct[] = queryList.length ? [
        { tabs: tabs + 1, text: 'query?: {'},
        ...queryList,
        { tabs: tabs + 1, text: '};'},
    ] : [];
    const parametersResult = parametersList.length ? [
        { tabs: tabs + 1, text: `params: {` },
        ...parametersList,
        { tabs: tabs + 1, text: `};` },
    ] : [];

    return [
        importsList,
        [
            ...summaryResult,
            { tabs, text: `'${path}': {` },
            ...responsesResult,
            ...parametersResult,
            ...bodyResult,
            ...queryResult,
            { tabs, text: `}` }
        ]
    ]
}
function parseAndWritePaths(json: BaseSwaggerStruct): void {
    let importsList = new Set<string>();
    const pathsKeys = Object.keys(json.paths);
    const methodsPaths: { [name: string]: LineWriteStruct[] } = {};

    for (const pathKey of pathsKeys) {
        const path = json.paths[pathKey];
        const methodsKeys = Object.keys(path).filter(key => key !== 'parameters') as PathMethodsType[];

        for (const methodKey of methodsKeys) {
            const method = path[methodKey]!;
            const methodType = getPathMethod(pathKey, method, path.parameters, 2);
            importsList = new Set([...importsList, ...methodType[0]]);

            if (!methodsPaths[methodKey]) methodsPaths[methodKey] = [];

            methodsPaths[methodKey]!.push(...methodType[1]);
        }
    }

    const importsResult: LineWriteStruct[] = [
        { tabs: 0, text: 'import {' },
        { tabs: 1, text: 'APIQuery,' },
        { tabs: 1, text: 'APIParameter,' },
        { tabs: 1, text: 'APIEmpty' },
        { tabs: 0, text: `} from './system.types';` },
        { tabs: 0, text: 'import {' },
        ...[...importsList].map(el => ({ tabs: 1, text: `${el},` })),
        { tabs: 0, text: `} from './entity';` },
        { tabs: 0, text: `` }
    ];
    const typeResult: LineWriteStruct[] = [
        { tabs: 0, text: 'export type APIRoutes = {' },
        ...Object
            .keys(methodsPaths)
            .reduce((accum, method) => {
                accum.push({ tabs: 1, text: `${method.toUpperCase()}: {`});
                accum.push(...methodsPaths[method]);
                accum.push({ tabs: 1, text: `}`});

                return accum;
            }, [] as LineWriteStruct[]),
        { tabs: 0, text: '}' },
    ];

    writeToFile(path.resolve(config.dirPath, 'index.ts'), [...importsResult, ...typeResult]);
}

async function main() {
    const json = await getSwaggerJson();

    createOrSkipFolderCreation();
    if (config.updateSystemTypes) createSystemTypesFile();
    if (config.updateEntity) parseAndWriteDefinitions(json);
    if (config.updateAPI) parseAndWritePaths(json);
}

main().then()
