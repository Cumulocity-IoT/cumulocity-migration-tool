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
import JSZip from "jszip";
import {IManagedObject, ICurrentUser, IApplication} from "@c8y/client";
import _ from "lodash";
import {getIdPathsFromApplication, getIdPathsFromDashboard, getSimulatorId} from "./utils/utils";
import {IExternalId} from "./c8y-interfaces/IExternalId";
import {ISimulatorConfig} from "./c8y-interfaces/ISimulatorConfig";
import {ISmartRuleConfig} from "./c8y-interfaces/ISmartRuleConfig";

export abstract class DataClient {
    abstract getBinaryBlob(binary: IManagedObject, onProgress?: (progress: number) => any): Promise<Blob>;
    abstract getApplicationBlob(app: IApplication & { binary: IManagedObject }, onProgress?: (progress: number) => any): Promise<Blob>;
    abstract getApplications(cached?: boolean): Promise<IApplication[]>;
    abstract getExternalIdsFor(managedObjectId: string | number, cached?: boolean): Promise<IExternalId[]>;
    abstract getAllManagedObjects(cached?: boolean): Promise<IManagedObject[]>;
    abstract getUser(): Promise<ICurrentUser>;

    /**
     * Gets the base URL or undefined if not available
     */
    abstract getBaseUrl(): string | undefined;

    abstract checkSupportFor(type: string): Promise<boolean>;

    abstract invalidateCache();

    abstract createApplication(app: IApplication, blob?: Blob): Promise<string | number>;
    abstract createManagedObject(managedObject: IManagedObject): Promise<string | number>;
    abstract createSimulator(simulatorConfig: Partial<ISimulatorConfig>): Promise<{ simulatorId: string, deviceIds: (string | number)[]}>;
    abstract createSmartRule(smartRuleConfig: ISmartRuleConfig): Promise<string|number>;
    abstract createBinary(binary: IManagedObject, blob: Blob): Promise<string|number>;
    abstract createLinkages(
        managedObjectId: string,
        linkages: {
            additionParents: string[],
            childAdditions: string[],
            assetParents: string[],
            childAssets: string[],
            childDevices: string[],
            deviceParents: string[]
        }
    ): Promise<void>;

    abstract updateApplication(app: IApplication, blob?: Blob): Promise<string | number>;
    abstract updateBinary(binary: IManagedObject, blob: Blob): Promise<string | number>;
    abstract updateManagedObject(managedObject: IManagedObject): Promise<string | number>;
    abstract updateSimulator(simulatorConfig: Partial<ISimulatorConfig>): Promise<{ simulatorId: string, deviceIds: (string | number)[]}>;
    abstract updateSmartRule(smartRuleConfig: Partial<ISmartRuleConfig>): Promise<string | number>;

    async getBinaries(cached = true): Promise<IManagedObject[]> {
        return (await this.getAllManagedObjects(cached))
            .filter(mo => mo.hasOwnProperty('c8y_applications_storage') || mo.hasOwnProperty('c8y_IsBinary'));
    }

    async getDashboards(cached = true): Promise<IManagedObject[]> {
        return (await this.getAllManagedObjects(cached))
            .filter(mo => mo.hasOwnProperty('c8y_Dashboard'));
    }

    async getGroups(cached = true): Promise<IManagedObject[]> {
        return (await this.getAllManagedObjects(cached))
            .filter(mo => mo.hasOwnProperty('c8y_IsDeviceGroup') || ['c8y_DeviceGroup', 'c8y_DeviceSubgroup'].includes(mo.type));
    }

    async getDevices(cached = true): Promise<IManagedObject[]> {
        return (await this.getAllManagedObjects(cached))
            .filter(mo => mo.hasOwnProperty('c8y_IsDevice'));
    }

    async getSimulators(cached = true): Promise<IManagedObject[]> {
        return (await this.getAllManagedObjects(cached))
            .filter(mo => mo.hasOwnProperty('c8y_DeviceSimulator'));
    }

    async getSmartRules(cached = true): Promise<IManagedObject[]> {
        return (await this.getAllManagedObjects(cached))
            .filter(mo => mo.hasOwnProperty('ruleTemplateName'));
    }

    async getOtherManagedObjects(cached = true): Promise<IManagedObject[]> {
        const [allManagedObjects, binaries, dashboards, groups, devices, simulators, smartRules] = await Promise.all([
            this.getAllManagedObjects(cached),
            this.getBinaries(true),
            this.getDashboards(true),
            this.getGroups(true),
            this.getDevices(true),
            this.getSimulators(true),
            this.getSmartRules(true)
        ]);

        const usedIds = [...binaries, ...dashboards, ...groups, ...devices, ...simulators, ...smartRules].map(mo => mo.id.toString());

        return allManagedObjects
            .filter(mo => !usedIds.some(usedId => usedId === mo.id.toString()));
    }

    async findReferencedFromApplication(app: IApplication & { id: string | number; binary: IManagedObject }, onDownloadProgress?: (progress: number) => any): Promise<{dashboards: IManagedObject[], devices: IManagedObject[]}> {
        // App builder apps include a list of dashboards in a custom field "applicationBuilder.dashboards"
        if ((app as any).applicationBuilder) {
            const appBuilderDashboards = ((app as any).applicationBuilder.dashboards || []);
            const dashboardIds = appBuilderDashboards.map(dashboard => dashboard.id);

            const deviceIdPaths = getIdPathsFromApplication(app);
            const deviceIds = _.uniq(deviceIdPaths.map((path: string[]) => _.get(app, path)));
            const dashboardManagedObjects = await this.getDashboards();
            const deviceManagedObjects = await this.getDevices();
            return {
                dashboards: dashboardManagedObjects.filter(dashboard => dashboardIds.includes(dashboard.id)),
                devices: deviceManagedObjects.filter(device => deviceIds.includes(device.id))
            };
        // Other apps might have a zip file containing some js and html files that indicate which dashboards to use
        } else {
            const blob = await this.getApplicationBlob(app, onDownloadProgress);

            // If there's no blob then the app has no binary
            if (blob == undefined) return {devices: [], dashboards: []};

            let zip;
            try {
                zip = await JSZip.loadAsync(blob);
            } catch (e) {
                console.debug('Not a zip file');
                return {devices: [], dashboards: []};
            }

            const files = zip.file(/.*\.(js|html)/);

            const names = [];
            const partialNames = [];
            const ids = [];

            await Promise.all(
                files.map(async (file) => {
                    const text = await file.async('text');
                    let matches;
                    const nameRegex = /<c8y-dashboard-gridstack[^>]+?name=(["'])((\w|-)+?)\1.*?>/g;
                    // noinspection JSAssignmentUsedAsCondition
                    while (matches = nameRegex.exec(text)) {
                        names.push(matches[2]);
                    }

                    const nameCtrlRegex = /dashboard[-_]?[nN]ame=(["'])((\w|-)+?)\1/g;
                    // noinspection JSAssignmentUsedAsCondition
                    while (matches = nameCtrlRegex.exec(text)) {
                        partialNames.push(matches[2] + '*');
                    }

                    const nameJsRegex = /c8y_Dashboard!name!((\w|-)+)/g;
                    // noinspection JSAssignmentUsedAsCondition
                    while (matches = nameJsRegex.exec(text)) {
                        partialNames.push(matches[1] + '*');
                    }

                    // If the dashboard name is some combinations of a string and some templates, eg: 'mydashboard-{{vm.dashboardNumber}}' we might be able to guess all of the allGroups associated with an app by finding all 'mydashboard-*'
                    const partialNameRegex = /<c8y-dashboard-gridstack[^>]+?name=(["'])(.+?)\1.*?>/g;
                    // noinspection JSAssignmentUsedAsCondition
                    while (matches = partialNameRegex.exec(text)) {
                        if (!nameRegex.test(matches[0])) {
                            const partialName = matches[2]
                                .trim()
                                .replace(/{{.*?}}/g, '*'); // replace angularjs template string with wildcard matcher
                            // If the whole expression starts with '::' then it's a single run angular expression so ignore it (we can't find a dashboard from that)
                            // If the expression has enough (3 or more) non-special characters then we'll assume it might be unique enough to find a dashboard
                            if (!partialName.startsWith('::') && partialName.replace(/[-*_.:]/g, '').length >= 3) {
                                partialNames.push(partialName);
                            }
                        }
                    }
                    const idRegex = /<c8y-dashboard-gridstack[^>]+?id=(["'])((\w|-)+?)\1.*?>/g;
                    // noinspection JSAssignmentUsedAsCondition
                    while (matches = idRegex.exec(text)) {
                        ids.push(matches[2]);
                    }
                }));

            const dashboardManagedObjects = await this.getDashboards();

            return {
                devices: [],
                dashboards: _.uniqBy([
                    ..._.flatMap(names, name => {
                        const matchingManagedObject = dashboardManagedObjects.find(mo => mo[`c8y_Dashboard!name!${name}`] !== undefined);
                        if (matchingManagedObject) {
                            console.log('Found dashboard with name', name, matchingManagedObject);
                            return [matchingManagedObject];
                        } else {
                            console.error('Unable to find dashboard with name', name);
                            return [];
                        }
                    }),
                    ..._.flatMap(ids, id => {
                        const matchingManagedObject = dashboardManagedObjects.find(mo => mo.id.toString() === id.toString());
                        if (matchingManagedObject) {
                            console.log('Found dashboard with id', id, matchingManagedObject);
                            return [matchingManagedObject];
                        } else {
                            console.error('Unable to find dashboard with id', id);
                            return [];
                        }
                    }),
                    ..._.flatMap(partialNames, wildCardName => {
                        const wildCardRegex = RegExp('^c8y_Dashboard!name!' + wildCardName.split('*').map(expressionPart => _.escapeRegExp(expressionPart)).join('.*') + '$');
                        const matchingManagedObjects = dashboardManagedObjects.filter(mo => Object.keys(mo).find(key => wildCardRegex.test(key)) !== undefined);
                        if (matchingManagedObjects.length > 0) {
                            console.log('Found allGroups with wild-card name', wildCardName, matchingManagedObjects);
                            return matchingManagedObjects;
                        } else {
                            console.error('Unable to find dashboard with wild-card name', wildCardName);
                            return [];
                        }
                    }),
                ], dashboard => dashboard.id)
            };
        }
    };

    async findLinkedFromDashboard(dashboard: IManagedObject):
        Promise<{
            binaries: IManagedObject[],
            devices: IManagedObject[],
            groups: IManagedObject[],
            simulators: IManagedObject[],
            smartRules: IManagedObject[],
            other: IManagedObject[],
            childParentLinks: {child: string|number, parent: string|number}[]
        }>
    {
        const idPaths = getIdPathsFromDashboard(dashboard);

        const ids = _.uniq(idPaths.map((path: string[]) => _.get(dashboard, path)));

        const [
            allBinaries,
            allDevices,
            allGroups,
            allSimulators,
            allSmartRules,
            allOther
        ] = await Promise.all([
            this.getBinaries(),
            this.getDevicesWithExternalIds(),
            this.getGroups(),
            this.getSimulators(),
            this.getSmartRules(),
            this.getOtherManagedObjects()
        ]);
        const all = [...allBinaries, ...allDevices, ...allGroups, ...allSimulators, ...allSmartRules, ...allOther];

        const res = this.findLinkedFromIds(ids, allBinaries, allDevices, allGroups, allSimulators, allSmartRules, allOther, all, false);
        return {
            binaries: res.binaries,
            devices: res.devices,
            groups: res.groups,
            simulators: res.simulators,
            smartRules: res.smartRules,
            other: res.other,
            childParentLinks: [...res.childParentLinks, ...ids.map(child => ({child, parent: dashboard.id}))]
        }
    }
    async findLinkedFrom(managedObject: IManagedObject):
        Promise<{
            devices: IManagedObject[],
            groups: IManagedObject[],
            simulators: IManagedObject[],
            smartRules: IManagedObject[],
            other: IManagedObject[],
            childParentLinks: {child: string|number, parent: string|number}[]
        }>
    {
        const [
            allBinaries,
            allDevices,
            allGroups,
            allSimulators,
            allSmartRules,
            allOther
        ] = await Promise.all([
            this.getBinaries(),
            this.getDevicesWithExternalIds(),
            this.getGroups(),
            this.getSimulators(),
            this.getSmartRules(),
            this.getOtherManagedObjects()
        ]);
        const all = [...allBinaries, ...allDevices, ...allGroups, ...allSimulators, ...allSmartRules, ...allOther];
        return this.findLinkedFromId(managedObject.id, allBinaries, allDevices, allGroups, allSimulators, allSmartRules, allOther, all);
    }

    private findLinkedFromIds(
        ids: (string | number)[],
        binaries: IManagedObject[],
        devices: (IManagedObject & {externalIds: IExternalId[]})[],
        groups: IManagedObject[], simulators: IManagedObject[],
        smartRules: IManagedObject[],
        others: IManagedObject[],
        all: (IManagedObject|(IManagedObject & {externalIds: IExternalId[]}))[],
        wasSelectedByParent: boolean = false
    ): {
        binaries: IManagedObject[],
        devices: IManagedObject[],
        groups: IManagedObject[],
        simulators: IManagedObject[],
        smartRules: IManagedObject[],
        other: IManagedObject[],
        childParentLinks: {child: string|number, parent: string|number}[]
    } {
        return ids.reduce((acc, id) => {
            const res = this.findLinkedFromId(id, binaries, devices, groups, simulators, smartRules, others, all, wasSelectedByParent);
            return {
                binaries: _.uniq([...acc.binaries, ...res.binaries]),
                devices: _.uniq([...acc.devices, ...res.devices]),
                groups: _.uniq([...acc.groups, ...res.groups]),
                simulators: _.uniq([...acc.simulators, ...res.simulators]),
                smartRules: _.uniq([...acc.smartRules, ...res.smartRules]),
                other: _.uniq([...acc.other, ...res.other]),
                childParentLinks: [...acc.childParentLinks, ...res.childParentLinks]
            };
        }, {binaries:[], devices: [], groups: [], simulators: [], smartRules: [], other: [], childParentLinks: []})
    }

    private findLinkedFromId(
        id: string | number,
        binaries: IManagedObject[],
        devices: (IManagedObject & {externalIds: IExternalId[]})[],
        groups: IManagedObject[],
        simulators: IManagedObject[],
        smartRules: IManagedObject[],
        others: IManagedObject[],
        all: (IManagedObject|(IManagedObject & {externalIds: IExternalId[]}))[],
        wasSelectedByParent: boolean = false
    ): {
        binaries: IManagedObject[],
        devices: IManagedObject[],
        groups: IManagedObject[],
        simulators: IManagedObject[],
        smartRules: IManagedObject[],
        other: IManagedObject[],
        childParentLinks: {child: string|number, parent: string|number}[]
    } {
        const managedObject = all.find(mo => mo.id.toString() === id.toString());

        if (!managedObject) return {binaries: [], devices: [], groups: [], simulators: [], smartRules: [], other: [], childParentLinks: []};

        const childIds = [
            ...managedObject.childDevices ? managedObject.childDevices.references : [],
            ...managedObject.childAssets ? managedObject.childAssets.references : [],
            ...managedObject.childAdditions ? managedObject.childAdditions.references : []
        ]
            .map(ref => ref.managedObject.id)
            .filter(id => all.some(mo => mo.id.toString() === id.toString()));

        const linked = this.findLinkedFromIds(childIds, binaries, devices, groups, simulators, smartRules, others, all, true);
        const linkedSimulators = this.getLinkedSimulators(managedObject, simulators);
        const result = {
            binaries: linked.binaries,
            devices: linked.devices,
            groups: linked.groups,
            simulators: [...linked.simulators, ...linkedSimulators],
            smartRules: linked.smartRules,
            other: linked.other,
            childParentLinks: [
                ...linked.childParentLinks,
                ...childIds.map(child => ({
                    child,
                    parent: managedObject.id
                })),
                ...linkedSimulators.map(sim => ({child: sim.id, parent: managedObject.id}))
            ]
        };

        if (devices.some(mo => mo.id.toString() === id.toString())) {
            result.devices.push(managedObject);
        } else if (groups.some(mo => mo.id.toString() === id.toString())) {
            result.groups.push(managedObject);
        } else if (simulators.some(mo => mo.id.toString() === id.toString())) {
            result.simulators.push(managedObject);
        } else if (smartRules.some(mo => mo.id.toString() === id.toString())) {
            result.smartRules.push(managedObject);
        } else if (others.some(mo => mo.id.toString() === id.toString())) {
            result.other.push(managedObject);
        } else if (binaries.some(mo => mo.id.toString() === id.toString())) {
            result.binaries.push(managedObject);
        }

        if (!wasSelectedByParent) {
            const {parentGroups, parentDevices, childParentLinks} = this.getParentsFor(id, groups, devices, others);
            result.devices.push(...parentDevices);
            result.groups.push(...parentGroups);
            result.childParentLinks.push(...childParentLinks);
        }

        return result;
    }

    private getParentsFor(
        id: string | number,
        groups: IManagedObject[],
        devices: IManagedObject[],
        others: IManagedObject[]
    ): {
        parentGroups: IManagedObject[],
        parentDevices: IManagedObject[],
        parentOther: IManagedObject[]
        childParentLinks: {child: string|number, parent: string|number}[]
    } {
        const isDevice = devices.some(device => device.id.toString() === id.toString());
        const isGroup = !isDevice && groups.some(group => group.id.toString() === id.toString());

        // Note: Don't find parent groups for devices
        const parentGroups = isDevice ? [] : groups.filter(mo => [
                ...mo.childDevices ? mo.childDevices.references : [],
                ...mo.childAssets ? mo.childAssets.references : [],
                ...mo.childAdditions ? mo.childAdditions.references : []
            ].some(ref => ref.managedObject.id.toString() === id.toString()));
        // Note: Don't find parent devices for groups
        const parentDevices = isGroup ? [] : devices.filter(mo => [
            ...mo.childDevices ? mo.childDevices.references : [],
            ...mo.childAssets ? mo.childAssets.references : [],
            ...mo.childAdditions ? mo.childAdditions.references : []
        ].some(ref => ref.managedObject.id.toString() === id.toString()));
        // Note: Don't find parent others for groups or devices
        const parentOther = isGroup || isDevice ? [] : others.filter(mo => [
            ...mo.childDevices ? mo.childDevices.references : [],
            ...mo.childAssets ? mo.childAssets.references : [],
            ...mo.childAdditions ? mo.childAdditions.references : []
        ].some(ref => ref.managedObject.id.toString() === id.toString()));

        return [...parentGroups, ...parentDevices]
            .map(parent => this.getParentsFor(parent.id, groups, devices, others))
            .reduce((acc, parentInfo) => {
                acc.parentGroups.push(...parentInfo.parentGroups);
                acc.parentDevices.push(...parentInfo.parentDevices);
                acc.parentOther.push(...parentInfo.parentOther);
                acc.childParentLinks.push(...parentInfo.childParentLinks);
                return acc;
            }, {
                parentGroups,
                parentDevices,
                parentOther,
                // childParentLinks is used to indicate which object caused the selection (so that deselection works) so we flip which is the parent and which is the child
                childParentLinks: [...parentGroups, ...parentDevices, ...parentOther].map(parent => ({ child: parent.id, parent: id }))
            });
    }

    private getLinkedSimulators(device: IManagedObject, simulators: IManagedObject[]): IManagedObject[] {
        if (!device.hasOwnProperty('externalIds')) return [];

       const simulatorId = getSimulatorId(device as IManagedObject & {externalIds: IExternalId[]});

        if (simulatorId) {
            return simulators.filter(sim => sim.id.toString() === simulatorId);
        } else {
            return [];
        }
    }

    async getApplicationsWithBinaries(cached: boolean = true): Promise<(IApplication & {id:string|number, binary: IManagedObject})[]> {
        const [binaries, applications] = await Promise.all([this.getBinaries(cached), this.getApplications(cached)]);
        return <(IApplication & {id:string|number, binary: IManagedObject})[]> applications.map(app => ({...app, binary: binaries.find(binary => app.activeVersionId && binary.id.toString() === app.activeVersionId.toString())}))
            .filter(app => !_.isUndefined(app.id));
    }

    async getDevicesWithExternalIds(cached: boolean = true): Promise<(IManagedObject & {externalIds: IExternalId[]})[]> {
        return Promise.all((await this.getDevices(cached)).map(async (device) => ({
            ...device,
            externalIds: await this.getExternalIdsFor(device.id, cached)
        })));
    }
}
