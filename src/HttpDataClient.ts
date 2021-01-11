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
import {ClientLike} from "./currentclient.service";
import _ from 'lodash';
import {IManagedObject, IApplication, ICurrentUser} from "@c8y/client";
import {DataClient} from "./DataClient";
import {delay} from "./utils/utils";
import {IExternalId} from "./c8y-interfaces/IExternalId";
import {ISimulatorConfig} from "./c8y-interfaces/ISimulatorConfig";
import {ISmartRuleConfig} from "./c8y-interfaces/ISmartRuleConfig";
import { IEplFileConfiguration } from "./c8y-interfaces/IEplFileConfig";

export class HttpDataClient extends DataClient {
    private applications: Promise<IApplication[]>;
    private allManagedObjects: Promise<IManagedObject[]>;
    private externalIds = new Map<string, Promise<IExternalId[]>>();
    private eplFiles: Promise<IEplFileConfiguration[]>;

    constructor(private client: ClientLike) {
        super();
    }

    async getUser(): Promise<ICurrentUser> {
        return this.client.user.current().then(x => x.data);
    }
    getApplications(cached = true): Promise<IApplication[]> {
        if (cached && this.applications) {
            return this.applications;
        } else {
            return this.applications = this.client.application.list({pageSize: 2000}).then(x => x.data);
        }
    }

    getAllManagedObjects(cached = true): Promise<IManagedObject[]> {
        if (cached && this.allManagedObjects) {
            return this.allManagedObjects;
        } else {
            return this.allManagedObjects = this.client.inventory.list({pageSize: 2000}).then(x => x.data)
        }
    }

    getEplFiles(cached?: boolean): Promise<IEplFileConfiguration[]> {
        if (cached && this.eplFiles) {
            return this.eplFiles;
        } 

        this.eplFiles = this.client.inventory.list({pageSize: 2000, type: 'apama_eplfile'}).then(({data}) => {
            return data.map(eplFileRaw => {
                  let eplFile = {
                    id: _.get(eplFileRaw, 'id'),
                    name: _.get(eplFileRaw, 'name'),
                    description: _.get(eplFileRaw, 'apama_eplfile.description'),
                    state: _.get(eplFileRaw, 'apama_eplfile.state'),
                    contents: _.get(eplFileRaw, 'apama_eplfile.contents') 
                  } as IEplFileConfiguration;

                  return eplFile
            });
        })

        return this.eplFiles;
    }

    async getBinaryBlob(binary: IManagedObject, onProgress?: (progress: number) => any) {
        const response = await this.client.core.fetch(`/inventory/binaries/${binary.id}`, { method: 'GET' }) as Response;

        if (!response.ok) {
            throw Error('Could not get binary');
        }

        const reader = response.body.getReader();
        const contentLength = binary.length;

        let receivedLength = 0;
        const chunks = [];
        while(true) {
            const {done, value} = await reader.read();

            if (done) {
                break;
            }

            chunks.push(value);
            receivedLength += value.length;

            if (_.isFunction(onProgress)) {
                onProgress(receivedLength/contentLength);
            }
        }

        return new Blob(chunks);
    }

    getApplicationBlob(app: (IApplication & {binary: IManagedObject}), onProgress?: (progress: number) => any) {
        if (app.binary == undefined) {
            return undefined;
        }
       return this.getBinaryBlob(app.binary, onProgress);
    }

    async createApplication(app: IApplication & {applicationBuilder?: any}, blob?: Blob): Promise<string | number> {
        // Create the app
        const newApp = (await this.client.application.create(app)).data;

        // Update the external URL for applicationBuilder apps
        if (app.applicationBuilder) {
            newApp.externalUrl = newApp.externalUrl.split('UNKNOWN-APP-ID').join(newApp.id.toString());
        }

        // Create the binary
        await this.updateApplication(newApp, blob);

        return newApp.id
    }

    async createManagedObject(managedObject: Partial<IManagedObject>): Promise<string | number> {
        return (await this.client.inventory.create(managedObject)).data.id;
    }

    async createLinkages(
        managedObjectId: string,
        linkages: {
            additionParents: string[],
            childAdditions: string[],
            assetParents: string[],
            childAssets: string[],
            childDevices: string[],
            deviceParents: string[]
        }
    ): Promise<any> {
        return Promise.all([
            ...linkages.additionParents.map(id => this.client.inventory.childAdditionsAdd(managedObjectId, id)),
            ...linkages.childAdditions.map(id => this.client.inventory.childAdditionsAdd(id, managedObjectId)),
            ...linkages.assetParents.map(id => this.client.inventory.childAssetsAdd(managedObjectId, id)),
            ...linkages.childAssets.map(id => this.client.inventory.childAssetsAdd(id, managedObjectId)),
            ...linkages.deviceParents.map(id => this.client.inventory.childDevicesAdd(managedObjectId, id)),
            ...linkages.childDevices.map(id => this.client.inventory.childDevicesAdd(id, managedObjectId))
        ]);
    }

    invalidateCache() {
        this.applications = undefined;
        this.allManagedObjects = undefined;
        this.externalIds.clear();
    }

    async createSimulator(simulatorConfig: Partial<ISimulatorConfig>): Promise<{ simulatorId: string, deviceIds: (string | number)[]}> {
        // Simulators in Cumulocity are made of 2 (or more) managedObjects...
        // 1 - The definition
        // 2+ - The device(s)
        // So we create the definition (via the simulator api), then find the other managedObjects

        simulatorConfig.state = 'RUNNING'; // Has to be running to create the device

        // Create the definition
        const attemptToCreateSimulator = () => this.client.core.fetch('/service/device-simulator/simulators', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(simulatorConfig)
        });

        // The simulator service on C8Y seems to be somewhat flaky so we retry this if it fails...
        let maxAttempts = 5;
        let success = false;
        let attempt;
        while (maxAttempts > 0) {
            maxAttempts --;
            attempt = await attemptToCreateSimulator();
            if (attempt.status >= 200 && attempt.status < 300) {
                success = true;
                break;
            }
            await delay(1000);
        }

        if (!success) throw Error("Couldn't create simulator: " + await (attempt as Response).text());

        const simulatorCreationResponse = await (attempt).json();

        const simulatorId: string = simulatorCreationResponse.id;

        // Wait for the service to create the device(s)
        await delay(1000);

        // Find the device(s) that were created
        const externalIds = await Promise.all([...Array(simulatorConfig.instances)].map(async (val,i) => await (await this.client.core.fetch(`/identity/externalIds/c8y_Serial/simulator_${simulatorId}_${i}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })).json() as IExternalId));

        // Return the id of the device(s) that was created
        return {
            simulatorId,
            deviceIds: externalIds.map(externalId => externalId.managedObject.id)
        };
    }

    async createExternalId(deviceId: string | number, externalId: IExternalId) {
        try {
            this.client.core.fetch(`/identity/globalIds/${deviceId}/externalIds`, {
                method: 'POST',
                headers: {"Content-Type": 'application/json'},
                body: JSON.stringify({
                    externalId: externalId.externalId,
                    type: externalId.type
                })
            });
        } catch (error) {
            console.error("Failed to create identity.", error);
        }       
    }

    async updateApplication(app: IApplication & {applicationBuilder?: any}, blob?: Blob): Promise<string | number> {
        if (blob != undefined) {
            // Create the binary
            const fd = new FormData();
            fd.append('file', blob, `${app.name.replace(/\s/g, '-').replace(/[^a-zA-Z0-9\-]/g, '') || 'application'}.zip`);

            app.activeVersionId = (await (await this.client.core.fetch(`/application/applications/${app.id}/binaries`, {
                method: 'POST',
                body: fd,
                headers: {
                    Accept: 'application/json'
                }
            })).json()).id;
        }

        await this.client.application.update({id: app.id, activeVersionId: app.activeVersionId, externalUrl: app.externalUrl, applicationBuilder: app.applicationBuilder} as IApplication);

        return app.id
    }

    async updateManagedObject(managedObject: IManagedObject): Promise<string | number> {
        return (await this.client.inventory.update(managedObject)).data.id;
    }

    async getExternalIdsFor(managedObjectId: string | number, cached?: boolean): Promise<IExternalId[]> {
        if (cached && this.externalIds.has(managedObjectId.toString())) {
            return this.externalIds.get(managedObjectId.toString());
        } else {
            const result = this.client.core.fetch(`/identity/globalIds/${managedObjectId}/externalIds`, {
                method: 'GET',
                headers: {Accept: 'application/json'}
            })
                .then(response => response.json())
                .then(json => json.externalIds)
                .catch(err => {
                    console.log("Couldn't get external ids of", managedObjectId);
                    return [];
                });
            this.externalIds.set(managedObjectId.toString(), result);
            return result;
        }
    }

    getBaseUrl(): string {
        return this.client.core.baseUrl;
    }

    private getSmartRuleUrl(smartRuleConfig: Partial<ISmartRuleConfig>): string {
        if (_.has(smartRuleConfig,['c8y_Context', 'id'])) {
            return `/service/smartrule/managedObjects/${smartRuleConfig.c8y_Context.id}/smartrules`;
        } else {
            return '/service/smartrule/smartrules';
        }
    }

    async createSmartRule(smartRuleConfig: ISmartRuleConfig): Promise<string|number> {
        return (await (await this.client.core.fetch(this.getSmartRuleUrl(smartRuleConfig), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(smartRuleConfig)
        })).json()).id;
    }

    async createEplFile(eplFileConfiguration: IEplFileConfiguration): Promise<string | number> {
        return (await(await this.client.core.fetch('/service/cep/eplfiles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eplFileConfiguration),
        })).json()).id;
    }

    async updateEplFile(eplFileConfiguration: IEplFileConfiguration): Promise<string | number> {
        return (await(await this.client.core.fetch(`/service/cep/eplfiles/${eplFileConfiguration.id.toString()}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: eplFileConfiguration.name,
                contents: eplFileConfiguration.contents,
                description: eplFileConfiguration.description,
                state: eplFileConfiguration.state
            }),
        })).json()).id;
    }

    async checkSupportFor(type: 'Simulators'|'SmartRules'|'Apama'): Promise<boolean> {
        switch(type) {
            case 'Simulators': {
                try {
                    const response = await this.client.core.fetch('/service/device-simulator/simulators');
                    return response.status >= 200 && response.status < 300;
                } catch(e) {
                    return false;
                }
            }
            case 'SmartRules': {
                try {
                    const managedObject = (await this.getAllManagedObjects())[0];
                    const response = await this.client.core.fetch(`/service/smartrule/managedObjects/${managedObject.id}/smartrules`);
                    return response.status >= 200 && response.status < 300;
                } catch(e) {
                    return false;
                }
            }
            case 'Apama': {
                try {
                    const response = await this.client.core.fetch('/service/cep/eplfiles');
                    return response.status >= 200 && response.status < 300;
                } catch(e) {
                    return false;
                }
            }
            default: return false;
        }
    }

    async createBinary(binary: IManagedObject, blob: Blob): Promise<string | number> {
        return (await this.client.inventoryBinary.create(blob, binary)).data.id;
    }

    async updateBinary(binary: IManagedObject, blob: Blob): Promise<string | number> {
        await this.client.inventoryBinary.delete(binary.id);
        const newBinary = _.omit(binary, 'id');
        return (await this.client.inventoryBinary.create(blob, newBinary)).data.id;
    }

    async updateSmartRule(smartRuleConfig: Partial<ISmartRuleConfig>): Promise<string | number> {
        return (await (await this.client.core.fetch(`${this.getSmartRuleUrl(smartRuleConfig)}/${smartRuleConfig.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(smartRuleConfig)
        })).json()).id;
    }

    async updateSimulator(simulatorConfig: Partial<ISimulatorConfig>): Promise<{ simulatorId: string, deviceIds: (string | number)[]}> {
        // Simulators in Cumulocity are made of 2 (or more) managedObjects...
        // 1 - The definition
        // 2+ - The device(s)
        // So we create the definition (via the simulator api), then find the other managedObjects

        simulatorConfig.state = 'RUNNING'; // Has to be running to create the device

        // Create the definition
        const attemptToUpdateCreateSimulator = () => this.client.core.fetch(`/service/device-simulator/simulators/${simulatorConfig.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(simulatorConfig)
        });

        // The simulator service on C8Y seems to be somewhat flaky so we retry this if it fails...
        let maxAttempts = 5;
        let success = false;
        let attempt;
        while (maxAttempts > 0) {
            maxAttempts --;
            attempt = await attemptToUpdateCreateSimulator();
            if (attempt.status >= 200 && attempt.status < 300) {
                success = true;
                break;
            }
            await delay(1000);
        }

        if (!success) throw Error("Couldn't update simulator: " + await (attempt as Response).text());

        const simulatorUpdateResponse = await (attempt).json();

        const simulatorId: string = simulatorUpdateResponse.id;

        // Wait for the service to create the device(s)
        await delay(1000);

        // Find the device(s) that were created
        const externalIds = await Promise.all([...Array(simulatorConfig.instances)].map(async (val,i) => await (await this.client.core.fetch(`/identity/externalIds/c8y_Serial/simulator_${simulatorId}_${i}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })).json() as IExternalId));

        // Return the id of the device(s) that was created
        return {
            simulatorId,
            deviceIds: externalIds.map(externalId => externalId.managedObject.id)
        };
    }

    async finishMigration() {
        throw new Error("Method not implemented.");
    }
}