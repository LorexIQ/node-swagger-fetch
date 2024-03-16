"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const spconfig_json_1 = __importDefault(require("./spconfig.json"));
const AxiosAll = __importStar(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
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
const entityDir = path_1.default.resolve(spconfig_json_1.default.dirPath, 'entity');
const typeAssociations = {
    'count-name-previous-results': ['ApiPagination']
};
function getSwaggerJson() {
    return __awaiter(this, void 0, void 0, function* () {
        return yield axios
            .get(spconfig_json_1.default.swaggerURL)
            .then(res => res.data);
    });
}
function writeToFile(name, data) {
    function tab(n) {
        return [...Array(n)].map(() => '\t').join('');
    }
    fs_1.default.writeFileSync(name, data.map(row => `${tab(row.tabs)}${row.text}`).join('\n'));
}
function mergeLineWithList(line, list) {
    const slicedList = list.slice(1);
    line.text += list[0].text;
    return [line, ...slicedList];
}
function getNameByRef(ref) {
    return ref.split('/').at(-1) + 'Entity';
}
function getObjectFromPropertiesWithIncludes(properties) {
    const propertiesList = [];
    const importsList = new Set();
    for (const property of Object.keys(properties)) {
        const [includedInterface, keyType] = getEntityProperty(properties[property], property);
        if (includedInterface)
            importsList.add(includedInterface);
        propertiesList.push(`${keyType};`);
    }
    return [importsList, propertiesList];
}
function getEntityProperty(property, key) {
    const isRequired = spconfig_json_1.default.isAllKeysRequired || !property["x-nullable"];
    if (!property.type) {
        const refName = getNameByRef(property.$ref);
        return [refName, key ? `${key}${isRequired ? '' : '?'}: ${refName}` : refName];
    }
    else if (property.type === 'array') {
        const [prevImport, prevProperty] = getEntityProperty(property.items, key);
        return [prevImport, `${prevProperty}[]`];
    }
    else {
        const type = ['number', 'integer'].includes(property.type) ? 'number' : property.type;
        return [undefined, key ? `${key}${isRequired ? '' : '?'}: ${type}` : type];
    }
}
function createIndexEntityFile(keys) {
    const keysStr = keys
        .map(key => `export * from './${key}.entity';`)
        .sort((a, b) => a.length > b.length ? -1 : 1)
        .join('\n');
    fs_1.default.writeFileSync(path_1.default.resolve(entityDir, 'index.ts'), keysStr);
}
function createOrSkipFolderCreation() {
    function enableFullRefresh() {
        spconfig_json_1.default.updateEntity = true;
        spconfig_json_1.default.updateAPI = true;
        spconfig_json_1.default.updateSystemTypes = true;
    }
    if (!fs_1.default.existsSync(spconfig_json_1.default.dirPath)) {
        fs_1.default.mkdirSync(spconfig_json_1.default.dirPath);
        enableFullRefresh();
    }
    if (!fs_1.default.existsSync(entityDir)) {
        fs_1.default.mkdirSync(entityDir);
        enableFullRefresh();
    }
}
function createEntityInterfaceFile(key, definition) {
    const [importsList, propertiesList] = getObjectFromPropertiesWithIncludes(definition.properties);
    const includesResult = `import {\n\t${[...importsList].join(',\n\t')}\n} from '../entity';\n\n`;
    const interfaceResult = `export interface ${key}Entity {\n\t${propertiesList.join('\n\t')}\n}`;
    fs_1.default.writeFileSync(path_1.default.resolve(entityDir, `${key}.entity.ts`), `${importsList.size ? `${includesResult}` : ''}${interfaceResult}`);
}
function parseAndWriteDefinitions(json) {
    var _a;
    const definitions = (_a = json.definitions) !== null && _a !== void 0 ? _a : json.components.schemas;
    const keys = Object.keys(definitions);
    createIndexEntityFile(keys);
    for (const key of keys)
        createEntityInterfaceFile(key, definitions[key]);
}
function createSystemTypesFile() {
    writeToFile(path_1.default.resolve(spconfig_json_1.default.dirPath, 'system.types.ts'), [
        { tabs: 0, text: 'export type APIQuery = string | number;' },
        { tabs: 0, text: 'export type APIParameter = string | number;' },
        { tabs: 0, text: 'export type APIEmpty = {};' }
    ]);
}
function getPathSchemaType(schema, tabs = 0) {
    const emptySet = new Set();
    if (!schema)
        return [emptySet, [{ tabs, text: 'APIEmpty;' }]];
    else if (!schema.type) {
        const preparedName = getNameByRef(schema.$ref);
        emptySet.add(preparedName);
        return [emptySet, [{ tabs, text: `${preparedName};` }]];
    }
    else if (schema.type === 'object') {
        const preparedType = getObjectFromPropertiesWithIncludes(schema.properties);
        return [preparedType[0], [
                { tabs, text: '{' },
                ...preparedType[1].map(el => ({ tabs: tabs + 1, text: el })),
                { tabs, text: '};' },
            ]];
    }
    else {
        const preparedType = getEntityProperty(schema);
        if (preparedType[0])
            emptySet.add(preparedType[0]);
        return [emptySet, [{ tabs, text: `${preparedType[1]};` }]];
    }
}
function getPathMethod(path, method, parameters, tabs = 1) {
    var _a, _b, _c;
    let importsList = new Set();
    const responsesList = [];
    const queryList = [];
    const parametersList = [];
    const bodyResult = [];
    const responses = method.responses;
    const query = method.parameters.filter(parameter => parameter.in === 'query');
    const parametersInner = method.parameters.filter(parameter => parameter.in === 'path');
    const body = method.parameters.find(parameter => parameter.in === 'body');
    for (const responseKey of Object.keys(responses)) {
        const response = responses[responseKey];
        const responseType = getPathSchemaType((_a = response.schema) !== null && _a !== void 0 ? _a : (_c = (_b = response.content) === null || _b === void 0 ? void 0 : _b['application/json']) === null || _c === void 0 ? void 0 : _c.schema, tabs + 2);
        if (responseType[0])
            importsList = new Set([...importsList, ...responseType[0]]);
        responsesList.push(...mergeLineWithList({ tabs: tabs + 2, text: `${responseKey}: ` }, responseType[1]));
    }
    for (const queryObj of query) {
        queryList.push({ tabs: tabs + 2, text: `${queryObj.name}?: APIQuery;${queryObj.description ? ` // ${queryObj.description}` : ''}` });
    }
    for (const parameter of (parameters !== null && parameters !== void 0 ? parameters : parametersInner)) {
        parametersList.push({ tabs: tabs + 2, text: `${parameter.name}: APIParameter;` });
    }
    if (body) {
        const bodyType = getPathSchemaType(body.schema);
        importsList = new Set([...importsList, ...bodyType[0]]);
        bodyResult.push(...mergeLineWithList({ tabs: tabs + 1, text: `body${body.required ? '' : '?'}: ` }, bodyType[1]));
    }
    const summaryResult = method.summary ? [
        { tabs: tabs, text: `/* ${method.summary} */` }
    ] : [];
    const responsesResult = [
        { tabs: tabs + 1, text: `responses: ${responsesList.length ? '{' : 'APIEmpty'}` },
        ...(responsesList.length ? [
            ...responsesList,
            { tabs: tabs + 1, text: '};' }
        ] : [])
    ];
    const queryResult = queryList.length ? [
        { tabs: tabs + 1, text: 'query?: {' },
        ...queryList,
        { tabs: tabs + 1, text: '};' },
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
    ];
}
function parseAndWritePaths(json) {
    let importsList = new Set();
    const pathsKeys = Object.keys(json.paths);
    const methodsPaths = {};
    for (const pathKey of pathsKeys) {
        const path = json.paths[pathKey];
        const methodsKeys = Object.keys(path).filter(key => key !== 'parameters');
        for (const methodKey of methodsKeys) {
            const method = path[methodKey];
            const methodType = getPathMethod(pathKey, method, path.parameters, 2);
            importsList = new Set([...importsList, ...methodType[0]]);
            if (!methodsPaths[methodKey])
                methodsPaths[methodKey] = [];
            methodsPaths[methodKey].push(...methodType[1]);
        }
    }
    const importsResult = [
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
    const typeResult = [
        { tabs: 0, text: 'export type APIRoutes = {' },
        ...Object
            .keys(methodsPaths)
            .reduce((accum, method) => {
            accum.push({ tabs: 1, text: `${method.toUpperCase()}: {` });
            accum.push(...methodsPaths[method]);
            accum.push({ tabs: 1, text: `}` });
            return accum;
        }, []),
        { tabs: 0, text: '}' },
    ];
    writeToFile(path_1.default.resolve(spconfig_json_1.default.dirPath, 'index.ts'), [...importsResult, ...typeResult]);
}
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const json = yield getSwaggerJson();
        createOrSkipFolderCreation();
        if (spconfig_json_1.default.updateSystemTypes)
            createSystemTypesFile();
        if (spconfig_json_1.default.updateEntity)
            parseAndWriteDefinitions(json);
        if (spconfig_json_1.default.updateAPI)
            parseAndWritePaths(json);
    });
}
main().then();
