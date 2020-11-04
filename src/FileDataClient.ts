/*
* Copyright (c) 2019 Software AG, Darmstadt, Germany and/or its licensors
*
* SPDX-License-Identifier: Apache-2.0
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
 */
import {IApplication, IManagedObject, ICurrentUser} from "@c8y/client";
import {DataClient} from "./DataClient";
import JSZip from "jszip";
import _ from "lodash";
import {IExternalId} from "./c8y-interfaces/IExternalId";
import {ISimulatorConfig} from "./c8y-interfaces/ISimulatorConfig";
import {ISmartRuleConfig} from "./c8y-interfaces/ISmartRuleConfig";
import { IEplFileConfiguration } from "./c8y-interfaces/IEplFileConfig";

export interface ExportJsonFormat {
    applications: IApplication[],
    managedObjects: IManagedObject[],
    eplFiles: IEplFileConfiguration[],
    externalIds: {
        [key: string]: IExternalId[]
    }
}

export class FileDataClient extends DataClient {
        
    private readonly exportJsonFormat: Promise<ExportJsonFormat>;

    private currentManagedObjectId = 1000;

    constructor(public file: Blob | undefined, public fileName: string = '') {
        super();
        this.exportJsonFormat = this.readFile();
    }

    private async readFile(): Promise<ExportJsonFormat> {
        if (this.file != undefined) {
            const zip = await JSZip.loadAsync(this.file);
            const jsonString = await zip.file('data.json').async('text');
            return JSON.parse(jsonString) as ExportJsonFormat;
        } else {
            const zip = new JSZip();
            zip.file('data.json', JSON.stringify({
                applications: [],
                managedObjects: [],
                eplFiles: [],
                externalIds: {}
            }));
            zip.folder('binaries');
            this.file = await zip.generateAsync({type:"blob"});
            return this.readFile();
        }
    }

    async getBinaryBlob(binary: IManagedObject, onProgress?: (progress: number) => any): Promise<Blob> {
        return (await JSZip.loadAsync(this.file))
            .folder('binaries')
            .file(`${binary.id}.zip`)
            .async('blob');
    }

    getApplicationBlob(app: IApplication & { binary: IManagedObject }, onProgress?: (progress: number) => any): Promise<Blob> {
        if (app.binary == undefined) {
            return undefined;
        }
        
        return this.getBinaryBlob(app.binary, onProgress);
    }

    async getApplications(): Promise<IApplication[]> {
        return (await this.exportJsonFormat).applications;
    }

    async getAllManagedObjects(): Promise<IManagedObject[]> {
        return (await this.exportJsonFormat).managedObjects;
    }

    async getEplFiles(cached?: boolean): Promise<IEplFileConfiguration[]> {
        return (await this.exportJsonFormat).eplFiles;
    }

    async getUser(): Promise<ICurrentUser> {
        const json = await this.exportJsonFormat;
        if (!_.isArray(json.applications)) {
            throw new Error('Invalid file');
        }
        if (!_.isArray(json.managedObjects)) {
            throw new Error('Invalid file');
        }
        return {
            userName: "file",
            displayName: "file"
        }
    }

    async createApplication(app: IApplication & {applicationBuilder?: any}, blob?: Blob): Promise<string | number> {
        app = _.cloneDeep(app);
        app.id = this.getNextManagedObjectId();
        if (app.applicationBuilder) {
            app.externalUrl = app.externalUrl.split('UNKNOWN-APP-ID').join(app.id.toString());
        }
        const json = await this.exportJsonFormat;
        if (blob != undefined) {
            app.activeVersionId = this.getNextManagedObjectId();
        }
        json.applications.push(app);
        if (blob != undefined) {
            json.managedObjects.push({
                owner: "file",
                name: `${app.name}.zip`,
                id: app.activeVersionId,
                c8y_applications_storage: "",
                c8y_IsBinary: "",
                length: 305,
                c8y_application_context_path: "file/unknown",
                contentType: "application/x-zip-compressed"
            } as any);
        }
        const zip = (await JSZip.loadAsync(this.file));
        if (blob != undefined) {
            zip.file(`binaries/${app.activeVersionId}.zip`, blob);
        }
        zip.file('data.json', JSON.stringify(await this.exportJsonFormat, undefined, 2));
        this.file = await zip.generateAsync({type: 'blob'});
        return app.id;
    }

    async createEplFile(eplFileConfiguration: IEplFileConfiguration): Promise<string | number> {
        eplFileConfiguration = _.cloneDeep(eplFileConfiguration) as IEplFileConfiguration;
        eplFileConfiguration.id = this.getNextManagedObjectId();

        const json = await this.exportJsonFormat;
        json.eplFiles.push(eplFileConfiguration);

        const zip = (await JSZip.loadAsync(this.file));
        zip.file('data.json', JSON.stringify(await this.exportJsonFormat, undefined, 2));
        this.file = await zip.generateAsync({type: 'blob'});
        return eplFileConfiguration.id;
    }

    async createManagedObject(managedObject: IManagedObject): Promise<string | number> {
        managedObject = _.cloneDeep(managedObject) as IManagedObject;
        managedObject.id = this.getNextManagedObjectId();
        const json = await this.exportJsonFormat;
        json.managedObjects.push(managedObject);
        const zip = (await JSZip.loadAsync(this.file));
        zip.file('data.json', JSON.stringify(await this.exportJsonFormat, undefined, 2));
        this.file = await zip.generateAsync({type: 'blob'});
        return managedObject.id;
    }

    async createLinkages(managedObjectId: string, linkages: { additionParents: string[]; assetParents: string[]; childAssets: string[]; childDevices: string[]; deviceParents: string[] }): Promise<void> {
        const json = await this.exportJsonFormat;

        const managedObject = json.managedObjects.find(mo => mo.id === managedObjectId);

        managedObject.additionParents = { references: linkages.additionParents.map(id => ({managedObject: {id}})) };
        managedObject.assetParents = { references: linkages.assetParents.map(id => ({managedObject: {id}})) };
        managedObject.childAssets = { references: linkages.childAssets.map(id => ({managedObject: {id}})) };
        managedObject.childDevices = { references: linkages.childDevices.map(id => ({managedObject: {id}})) };
        managedObject.deviceParents = { references: linkages.deviceParents.map(id => ({managedObject: {id}})) };

        const zip = (await JSZip.loadAsync(this.file));
        zip.file('data.json', JSON.stringify(await this.exportJsonFormat, undefined, 2));
        this.file = await zip.generateAsync({type: 'blob'});
    }

    private async createExternalId(deviceId: string|number, externalId: IExternalId) {
        const json = await this.exportJsonFormat;

        if (!json.externalIds[deviceId.toString()]) {
            json.externalIds[deviceId.toString()] = [];
        }
        json.externalIds[deviceId.toString()].push(externalId);
    }

    private getNextManagedObjectId() {
        return (++this.currentManagedObjectId).toString();
    }

    invalidateCache() {
        // No-op - File client doesn't cache
    }

    async createSimulator(simulatorConfig: Partial<ISimulatorConfig>): Promise<{ simulatorId: string, deviceIds: (string | number)[]}> {
        const simulatorId = (await this.createManagedObject({
            c8y_DeviceSimulator: simulatorConfig
        } as any)).toString();

        const deviceIds = await Promise.all([...new Array(simulatorConfig.instances)].map(() => this.createManagedObject({
            c8y_IsDevice: {}
        } as any)));

        await Promise.all(deviceIds.map((id, i) => this.createExternalId(id, {
            externalId: `simulator_${simulatorId}_${i}`,
            type: 'c8y_Serial',
            managedObject: {
                id
            }
        })));

        const zip = (await JSZip.loadAsync(this.file));
        zip.file('data.json', JSON.stringify(await this.exportJsonFormat, undefined, 2));
        this.file = await zip.generateAsync({type: 'blob'});

        return {
            simulatorId,
            deviceIds
        }
    }

    async updateManagedObject(managedObject: IManagedObject): Promise<string | number> {
        const json = await this.exportJsonFormat;

        const currentMo = json.managedObjects.find(mo => mo.id.toString() === managedObject.id.toString());

        Object.assign(currentMo, managedObject);

        const zip = (await JSZip.loadAsync(this.file));
        zip.file('data.json', JSON.stringify(await this.exportJsonFormat, undefined, 2));
        this.file = await zip.generateAsync({type: 'blob'});

        return currentMo.id
    }

    async getExternalIdsFor(managedObjectId: string | number): Promise<IExternalId[]> {
        const json = await this.exportJsonFormat;

        if (!json.externalIds[managedObjectId.toString()]) {
            return [];
        } else {
            return json.externalIds[managedObjectId.toString()];
        }
    }

    getBaseUrl(): string | undefined {
        return this.fileName;
    }

    createSmartRule(smartRuleConfig: ISmartRuleConfig): Promise<string | number> {
        return this.createManagedObject(smartRuleConfig as any);
    }

    async checkSupportFor(type: string): Promise<boolean> {
        return true;
    }

    updateApplication(app: IApplication, blob: Blob): Promise<string | number> {
        // No need to implement this... we always create a new file
        throw Error("Unimplemented: Can't update an application binary in a file");
    }

    async createBinary(binary: IManagedObject, blob: Blob): Promise<string | number> {
        const binaryId = await this.createManagedObject(binary);
        const zip = (await JSZip.loadAsync(this.file));
        zip.file(`binaries/${binaryId}.zip`, blob);
        this.file = await zip.generateAsync({type: 'blob'});
        return binaryId;
    }

    updateBinary(binary: IManagedObject, blob: Blob): Promise<string | number> {
        // No need to implement this... we always create a new file
        throw Error("Unimplemented: Can't update a binary in a file");
    }

    async updateEplFile(eplFileConfiguration: IEplFileConfiguration): Promise<string | number> {
        // No need to implement this... we always create a new file
        throw Error("Unimplemented: Can't update a epl file in a file");
    }

    updateSimulator(simulatorConfig: Partial<ISimulatorConfig>): Promise<{ simulatorId: string; deviceIds: (string | number)[] }> {
        // No need to implement this... we always create a new file
        throw Error("Unimplemented: Can't update a simulator in a file");
    }

    updateSmartRule(smartRuleConfig: Partial<ISmartRuleConfig>): Promise<string | number> {
        // No need to implement this... we always create a new file
        throw Error("Unimplemented: Can't update a smartrule in a file");
    }
}