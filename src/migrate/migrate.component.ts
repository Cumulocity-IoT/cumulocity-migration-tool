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
import {Component, TemplateRef, ViewChild} from '@angular/core';
import {IApplication, IManagedObject} from '@c8y/client';
import {DataService} from "../data.service";
import {SelectionService} from "../selection.service";
import {
    getDashboardName,
    getIdPathsFromDashboard,
    getSimulatorId,
    isSimulatorDevice,
    setFromPath
} from "../utils/utils";
import {AlertService} from "@c8y/ngx-components";
import download from "downloadjs";
import {FileDataClient} from "../FileDataClient";
import _ from "lodash";
import objectScan from "object-scan";
import {UpdateableAlert} from "../utils/UpdateableAlert";
import {IExternalId} from "../c8y-interfaces/IExternalId";
import {ISmartRuleConfig} from "../c8y-interfaces/ISmartRuleConfig";

interface ApplicationMigration {
    newName: string,
    newContextPath: string,
    application: IApplication & { binary:IManagedObject },
    updateExisting?: IApplication
}

interface ManagedObjectMigration {
    newName: string,
    managedObject: IManagedObject,
    updateExisting?: IManagedObject
}

@Component({
    templateUrl: './migrate.component.html'
})
export class MigrateComponent {
    @ViewChild('SmartRuleError') smartRuleError: TemplateRef<any>;
    @ViewChild('SimulatorError') simulatorError: TemplateRef<any>;

    from: string;
    to: string;

    appMigrations: ApplicationMigration[];
    dashboardMigrations: ManagedObjectMigration[];
    groupMigrations: ManagedObjectMigration[];
    deviceMigrations: ManagedObjectMigration[];
    simulatorMigrations: ManagedObjectMigration[];
    smartRuleMigrations: ManagedObjectMigration[];
    binaryMigrations: ManagedObjectMigration[];
    otherMigrations: ManagedObjectMigration[];

    dirty = false;
    editing: string;
    canUpdate: boolean;

    constructor(private dataService: DataService, private selectionService: SelectionService, private alertService: AlertService) {
        this.loadData();
    }

    async loadData() {
        this.appMigrations = [];
        this.dashboardMigrations = [];
        this.groupMigrations = [];
        this.deviceMigrations = [];
        this.simulatorMigrations = [];
        this.smartRuleMigrations = [];
        this.binaryMigrations = [];
        this.otherMigrations = [];

        const sourceClient = this.dataService.getSourceDataClient();
        this.from = `${sourceClient instanceof FileDataClient ? 'File' : 'Tenant'}: ${sourceClient.getBaseUrl()}`;
        const destinationClient = this.dataService.getDestinationDataClient();
        this.to = `${destinationClient instanceof FileDataClient ? 'File' : 'Tenant'}: ${destinationClient.getBaseUrl()}`;
        this.canUpdate = !(destinationClient instanceof FileDataClient);

        const [sourceApps, destApps] = await Promise.all([sourceClient.getApplicationsWithBinaries(), destinationClient.getApplications()]);

        const [
            sourceDashboards, sourceGroups, sourceDevices, sourceSimulators, sourceSmartRules, sourceBinaries, sourceOtherMOs,
            destDashboards, destGroups, destDevices, destSimulators, destSmartRules, destBinaries, destOtherMOs
        ] = await Promise.all([
            sourceClient.getDashboards(), sourceClient.getGroups(), sourceClient.getDevicesWithExternalIds(), sourceClient.getSimulators(), sourceClient.getSmartRules(), sourceClient.getBinaries(), sourceClient.getOtherManagedObjects(),
            destinationClient.getDashboards(), destinationClient.getGroups(), destinationClient.getDevicesWithExternalIds(), destinationClient.getSimulators(), destinationClient.getSmartRules(), destinationClient.getBinaries(), destinationClient.getOtherManagedObjects()
        ]);

        const selectedApps = sourceApps.filter(app => this.selectionService.isSelected(app.id));
        const selectedDashboards = sourceDashboards.filter(dashboard => this.selectionService.isSelected(dashboard.id));
        const selectedGroups = sourceGroups.filter(group => this.selectionService.isSelected(group.id));
        const selectedDevices = sourceDevices.filter(device => this.selectionService.isSelected(device.id));
        const selectedSimulators = sourceSimulators.filter(simulator => this.selectionService.isSelected(simulator.id));
        const selectedSmartRules = sourceSmartRules.filter(smartRule => this.selectionService.isSelected(smartRule.id));
        const selectedBinaries = sourceBinaries.filter(b => !b.hasOwnProperty('c8y_applications_storage')).filter(mo => this.selectionService.isSelected(mo.id));
        const selectedOthers = sourceOtherMOs.filter(mo => this.selectionService.isSelected(mo.id));

        if (selectedSmartRules.length > 0 && !await destinationClient.checkSupportFor('SmartRules')) {
            this.alertService.add({
                type: 'danger',
                text: this.smartRuleError,
            });
            selectedSmartRules.length = 0;
        }
        if (selectedSimulators.length > 0 && !await destinationClient.checkSupportFor('Simulators')) {
            this.alertService.add({
                type: 'danger',
                text: this.simulatorError,
            });
            selectedSimulators.length = 0;
        }

        this.appMigrations = selectedApps.map(application => ({
            newName: application.name,
            newContextPath: application.contextPath,
            application,
            updateExisting: this.findExistingApplication(application, destApps)
        }));
        this.dashboardMigrations = selectedDashboards.map(dashboard => {
            const dashboardName = getDashboardName(dashboard);
            return {
                newName: dashboardName,
                managedObject: dashboard,
                updateExisting: this.findExistingDashboard(dashboard, destDashboards)
            }
        });
        this.groupMigrations = selectedGroups.map(group => ({
            newName: group.name,
            managedObject: group,
            updateExisting: this.findExistingManagedObject(group, destGroups)
        }));
        this.deviceMigrations = selectedDevices.map(device => ({
            newName: device.name,
            managedObject: device,
            updateExisting: this.findExistingManagedObject(device, destDevices)
        }));
        this.simulatorMigrations = selectedSimulators.map(simulator => ({
            newName: simulator.name,
            managedObject: simulator,
            updateExisting: this.findExistingManagedObject(simulator, destSimulators)
        }));
        this.smartRuleMigrations = selectedSmartRules.map(smartRule => ({
            newName: smartRule.name,
            managedObject: smartRule,
            updateExisting: this.findExistingManagedObject(smartRule, destSmartRules)
        }));
        this.binaryMigrations = selectedBinaries.map(binary => ({
            newName: binary.name,
            managedObject: binary,
            updateExisting: this.findExistingManagedObject(binary, destBinaries)
        }));
        this.otherMigrations = selectedOthers.map(mo => ({
            newName: mo.name,
            managedObject: mo,
            updateExisting: this.findExistingManagedObject(mo, destOtherMOs)
        }));
    }

    getDashboardName(m: IManagedObject): string {
        return getDashboardName(m);
    }

    toggleEditMode(object: ManagedObjectMigration | ApplicationMigration) {
        if (this.isInEditMode(object)) {
            this.editing = undefined;
        } else {
            this.editing = object.hasOwnProperty('managedObject') ? (object as ManagedObjectMigration).managedObject.id.toString() : (object as ApplicationMigration).application.id.toString();
        }
        this.dirty = true;
    }

    isInEditMode(object: ManagedObjectMigration | ApplicationMigration) {
        return this.editing === (object.hasOwnProperty('managedObject') ? (object as ManagedObjectMigration).managedObject.id.toString() : (object as ApplicationMigration).application.id.toString());
    }

    resetApplicationMigration(appMigration: ApplicationMigration) {
        if (appMigration.updateExisting) {
            appMigration.newName = appMigration.updateExisting.name;
            appMigration.newContextPath = appMigration.updateExisting.contextPath;
        } else {
            appMigration.newName = appMigration.application.name;
            appMigration.newContextPath = appMigration.application.contextPath;
        }
    }

    resetDashboardMigration(dashboardMigration: ManagedObjectMigration) {
        if (dashboardMigration.updateExisting) {
            dashboardMigration.newName =  getDashboardName(dashboardMigration.updateExisting);
        } else {
            dashboardMigration.newName = getDashboardName(dashboardMigration.managedObject);
        }
    }

    resetManagedObjectMigration(managedObjectMigration: ManagedObjectMigration) {
        if (managedObjectMigration.updateExisting) {
            managedObjectMigration.newName =  managedObjectMigration.updateExisting.name;
        } else {
            managedObjectMigration.newName =  managedObjectMigration.managedObject.name;
        }
    }

    canMigrate(): boolean {
        return this.appMigrations.length > 0
            || this.dashboardMigrations.length > 0
            || this.groupMigrations.length > 0
            || this.deviceMigrations.length > 0
            || this.simulatorMigrations.length > 0
            || this.smartRuleMigrations.length > 0
            || this.binaryMigrations.length > 0
            || this.otherMigrations.length > 0;
    }

    async migrate() {
        const alrt = new UpdateableAlert(this.alertService);
        const sourceClient = this.dataService.getSourceDataClient();
        const destinationClient = this.dataService.getDestinationDataClient();

        try {
            // Migrate the standard managedObjects
            alrt.update("Migrating Groups, Devices, and Other ManagedObjects...");
            const [simulatorDeviceMigrations, nonSimulatorDeviceMigrations] = _.partition(this.deviceMigrations, deviceMigration => {
                if (!isSimulatorDevice(deviceMigration.managedObject)) return false;
                const simulatorId = getSimulatorId(deviceMigration.managedObject as (IManagedObject & {externalIds: IExternalId[]}));
                return this.simulatorMigrations.some(simMigration => simMigration.managedObject.id.toString() === simulatorId);
            });

            const oldIdsToNewIds = [];

            oldIdsToNewIds.push(...await Promise.all(
                [...this.groupMigrations, ...nonSimulatorDeviceMigrations, ...this.otherMigrations]
                    .map(async (moMigration) => {
                        if (moMigration.updateExisting) {
                            const mo = this.managedObjectMigrationToManagedObject(moMigration);
                            mo.id = moMigration.updateExisting.id;
                            return [moMigration.managedObject.id.toString(), await destinationClient.updateManagedObject(mo)]
                        } else {
                            return [moMigration.managedObject.id.toString(), await destinationClient.createManagedObject(this.managedObjectMigrationToManagedObject(moMigration))];
                        }
                    })));

            // Migrate the simulators
            alrt.update("Migrating Simulators...");
            const simulatorDeviceMigrationsBySimulatorId = simulatorDeviceMigrations.reduce((acc, simulatorDeviceMigration) => {
                const simulatorDevice = simulatorDeviceMigration.managedObject  as (IManagedObject & {externalIds: IExternalId[]});
                const simulatorId = getSimulatorId(simulatorDevice);
                if (simulatorId) {
                    if (!acc.has(simulatorId)) {
                        acc.set(simulatorId, []);
                    }
                    acc.get(simulatorId).push(simulatorDeviceMigration);
                } else {
                    this.alertService.danger('Unable to migrate' + JSON.stringify(simulatorDevice));
                }
                return acc;
            }, new Map<string, ManagedObjectMigration[]>());

            oldIdsToNewIds.push(..._.flatten(await Promise.all(Array.from(simulatorDeviceMigrationsBySimulatorId).map(async ([simulatorId, simDeviceMigrations]) => {
               const simulatorMigration = this.simulatorMigrations.find(simMigration => simMigration.managedObject.id.toString() === simulatorId);
               if (simulatorMigration) {
                   const simulatorConfig = _.omit(_.cloneDeep(simulatorMigration.managedObject.c8y_DeviceSimulator), 'id');
                   simulatorConfig.name = simulatorMigration.newName;

                   let newSimulatorId: string|number;
                   let deviceIds: (string|number)[];
                   if (simulatorMigration.updateExisting) {
                       simulatorConfig.id = simulatorMigration.updateExisting.id;
                       simulatorConfig.instances = Math.max(simDeviceMigrations.length, simulatorConfig.instances);
                       ({simulatorId: newSimulatorId, deviceIds: deviceIds} = await destinationClient.updateSimulator(simulatorConfig));
                   } else {
                       // Create the simulator (which creates the simulator devices
                       simulatorConfig.instances = simDeviceMigrations.length;
                       ({simulatorId: newSimulatorId, deviceIds: deviceIds} = await destinationClient.createSimulator(simulatorConfig));
                   }

                   // Update the simulator devices
                   const oldIdsToNewIds = await Promise.all(_.zip(simDeviceMigrations, deviceIds).map(async ([simDeviceMigration, newDeviceId]) => {
                       const update = this.managedObjectMigrationToManagedObject(simDeviceMigration);
                       update.id = newDeviceId.toString();
                       await destinationClient.updateManagedObject(update);
                       return [simDeviceMigration.managedObject.id.toString(), newDeviceId];
                   }));

                   return [
                       [simulatorId.toString(), newSimulatorId],
                       ...oldIdsToNewIds
                   ];
               } else {
                   this.alertService.danger('Unable to find simulator' + simulatorId);
                   return [];
               }
            }))));

            // Migrate the SmartRules
            alrt.update("Migrating Smart Rules...");
            oldIdsToNewIds.push(...await Promise.all(
                this.smartRuleMigrations
                    .map(async (srMigration) => {
                        if (srMigration.updateExisting) {
                            const srConfig = _.omit(this.smartRuleMigrationToSmartRuleConfig(srMigration, new Map(oldIdsToNewIds)),'type');
                            srConfig.id = srMigration.updateExisting.id;
                            return [srMigration.managedObject.id.toString(), await destinationClient.updateSmartRule(srConfig)];
                        } else {
                            return [srMigration.managedObject.id.toString(), await destinationClient.createSmartRule(this.smartRuleMigrationToSmartRuleConfig(srMigration, new Map(oldIdsToNewIds)))];
                        }
                    })));

            // Migrate the Binaries
            alrt.update("Migrating Binaries...");
            oldIdsToNewIds.push(...await Promise.all(
                this.binaryMigrations
                    .map(async (bMigration) => {
                        const blob = await sourceClient.getBinaryBlob(bMigration.managedObject);
                        if (bMigration.updateExisting) {
                            const mo = this.managedObjectMigrationToManagedObject(bMigration);
                            mo.id = bMigration.updateExisting.id;
                            return [bMigration.managedObject.id.toString(), await destinationClient.updateBinary(mo, blob)]
                        } else {
                            return [bMigration.managedObject.id.toString(), await destinationClient.createBinary(this.managedObjectMigrationToManagedObject(bMigration), blob)];
                        }
                    })));

            // Migrate the dashboards
            alrt.update("Migrating Dashboards...");
            oldIdsToNewIds.push(...await Promise.all(
                this.dashboardMigrations
                    .map(async (dashboardMigration) => {
                        if (dashboardMigration.updateExisting) {
                            const db = this.dashboardMigrationToManagedObject(dashboardMigration, new Map(oldIdsToNewIds));
                            db.id = dashboardMigration.updateExisting.id;
                            return [dashboardMigration.managedObject.id.toString(), await destinationClient.updateManagedObject(db)]
                        } else {
                            return [dashboardMigration.managedObject.id.toString(), await destinationClient.createManagedObject(this.dashboardMigrationToManagedObject(dashboardMigration, new Map(oldIdsToNewIds)))]
                        }
                    })
            ));

            const oldIdsToNewIdsMap = new Map<string, string|number>(oldIdsToNewIds);

            // Create the parent child linkages
            alrt.update("Migrating Parent/Child linkages...");
            await Promise.all([...this.dashboardMigrations, ...this.groupMigrations, ...this.deviceMigrations, ...this.otherMigrations]
                .map(moMigration =>
                    destinationClient.createLinkages(oldIdsToNewIdsMap.get(moMigration.managedObject.id.toString()).toString(), this.managedObjectMigrationToManagedObjectLinkages(moMigration, oldIdsToNewIdsMap))));

            // Migrate the applications
            alrt.update("Migrating Applications...");
            await Promise.all(this.appMigrations.map(async (appMigration) => {
                const blob = await sourceClient.getApplicationBlob(appMigration.application);
                if (appMigration.updateExisting) {
                    return destinationClient.updateApplication(appMigration.updateExisting, blob);
                } else {
                    return destinationClient.createApplication(MigrateComponent.appMigrationToApp(appMigration), blob);
                }
            }));

            if (destinationClient instanceof FileDataClient) {
                alrt.update("Opening...");
                alrt.close(4500);
                download(destinationClient.file, destinationClient.fileName);
            } else {
                alrt.update("Done!", 'success');
                alrt.close(1000);
            }
            this.dirty = false;
        } catch(e) {
            alrt.update('Error: ' + e.toString(), 'danger');
            throw(e);
        } finally {
            this.reset();
        }
    }

    static appMigrationToApp(appMigration: ApplicationMigration): IApplication {
        const result: IApplication = {};

        // Blacklist certain fields
        function isBlacklistedKey(key) {
            if (key.length) {
                switch(key[0]) {
                    case 'downloading': // we added downloading so remove it
                    case 'binary': // we added the binary key so remove it
                    case 'activeVersionId':
                        return true;
                }

                switch(key[key.length - 1]) {
                    case 'owner':
                    case 'self':
                        return true;
                }
            }
            return false;
        }

        const paths = objectScan(['**.*'], {useArraySelector: false, joined: false, breakFn: (key, value) => isBlacklistedKey(key), filterFn: (key, value) => {
            if (isBlacklistedKey(key)) {
                return false;
            }

            // We want to copy the leaf nodes (and will create their paths) so we skip anything that isn't a leaf node
            // In other words: only values (string or number) and empty objects or arrays
            return _.isString(value) || _.isNumber(value) || _.isNull(value) || Object.keys(value).length === 0;
        }})(appMigration.application);

        paths.forEach(path => {
            _.set(result, path, _.get(appMigration.application, path));
        });

        // Update the application with the user provided changes...
        result.contextPath = appMigration.newContextPath;
        result.name = appMigration.newName;

        return result;
    }

    dashboardMigrationToManagedObject(dashboardMigration: ManagedObjectMigration, oldDeviceIdToNew: Map<string, string|number>): IManagedObject {
        let result = this.managedObjectMigrationToManagedObject(dashboardMigration);

        // Update all of the device/group ids to be the new ones
        const idPaths = getIdPathsFromDashboard(result);
        idPaths.forEach(path => {
            if (_.has(result, path)) {
                const oldId = _.get(result, path);
                if (oldDeviceIdToNew.has(oldId.toString())) {
                    _.set(result, path, oldDeviceIdToNew.get(oldId.toString()));
                } else {
                    // TODO: add to warning
                }
            }
        });

        // Update the c8y_Dashboard!device!1263673 property to point at the new id
        const dashboardRegex = /^c8y_Dashboard!(group|device)!(\d+)$/;
        const key = Object.keys(result).find(key => dashboardRegex.test(key));
        if (key) {
            const match = key.match(dashboardRegex);
            if (oldDeviceIdToNew.has(match[2])) {
                const value = result[key];
                result = _.omit(result, key) as IManagedObject;
                result[`c8y_Dashboard!${match[1]}!${oldDeviceIdToNew.get(match[2])}`] = value;
            } else {
                // TODO: add to warning
            }
        } else {
            // TODO: warn?
        }

        return result;
    }

    managedObjectMigrationToManagedObject(managedObjectMigration: ManagedObjectMigration): IManagedObject {
        const result: IManagedObject = {} as any;

        function isBlacklistedKey(key) {
            if (key.length) {
                switch(key[0]) {
                    case 'id':
                    case 'lastUpdated':
                    case 'additionParents':
                    case 'assetParents':
                    case 'childAdditions':
                    case 'childAssets':
                    case 'childDevices':
                    case 'c8y_Availability':
                    case 'c8y_Connection':
                    case 'c8y_ActiveAlarmsStatus':
                    case 'externalIds': // we added the externalIds key so remove it
                        return true;
                }

                switch(key[key.length - 1]) {
                    case 'owner':
                    case 'self':
                        return true;
                }
            }
            return false;
        }

        const paths = objectScan(['**.*'], {useArraySelector: false, joined: false, breakFn: (key, value) => isBlacklistedKey(key), filterFn: (key, value) => {
                if (isBlacklistedKey(key)) {
                    return false;
                }

                // We want to copy the leaf nodes (and will create their paths) so we skip anything that isn't a leaf node
                // In other words: only values (string or number) and empty objects or arrays
                return _.isString(value) || _.isNumber(value) || _.isNull(value) || Object.keys(value).length === 0;
            }})(managedObjectMigration.managedObject);

        paths.forEach(path => {
            setFromPath(result, path, _.get(managedObjectMigration.managedObject, path));
        });

        // Update the managedObject with the user provided changes...
        if (result.name != null) {
            result.name = managedObjectMigration.newName;
        }

        return result;
    }

    managedObjectMigrationToManagedObjectLinkages(managedObjectMigration: ManagedObjectMigration, oldDeviceIdToNew: Map<string, string|number>):
        {
            additionParents: string[],
            childAdditions: string[],
            assetParents: string[],
            childAssets: string[],
            childDevices: string[],
            deviceParents: string[]
        }
    {
        return {
            // TODO: add missing to warnings
            additionParents: _.flatMap(_.get(managedObjectMigration.managedObject, 'additionParents.references', []),
                reference => oldDeviceIdToNew.has(reference.managedObject.id.toString()) ? oldDeviceIdToNew.get(reference.managedObject.id.toString()) : []),
            childAdditions: _.flatMap(_.get(managedObjectMigration.managedObject, 'childAdditions.references', []),
                reference => oldDeviceIdToNew.has(reference.managedObject.id.toString()) ? oldDeviceIdToNew.get(reference.managedObject.id.toString()) : []),
            assetParents: _.flatMap(_.get(managedObjectMigration.managedObject, 'assetParents.references', []),
                reference => oldDeviceIdToNew.has(reference.managedObject.id.toString()) ? oldDeviceIdToNew.get(reference.managedObject.id.toString()) : []),
            childAssets: _.flatMap(_.get(managedObjectMigration.managedObject, 'childAssets.references', []),
                reference => oldDeviceIdToNew.has(reference.managedObject.id.toString()) ? oldDeviceIdToNew.get(reference.managedObject.id.toString()) : []),
            childDevices: _.flatMap(_.get(managedObjectMigration.managedObject, 'childDevices.references', []),
                reference => oldDeviceIdToNew.has(reference.managedObject.id.toString()) ? oldDeviceIdToNew.get(reference.managedObject.id.toString()) : []),
            deviceParents: _.flatMap(_.get(managedObjectMigration.managedObject, 'deviceParents.references', []),
                reference => oldDeviceIdToNew.has(reference.managedObject.id.toString()) ? oldDeviceIdToNew.get(reference.managedObject.id.toString()) : [])
        }
    }

    smartRuleMigrationToSmartRuleConfig(smartRuleMigration: ManagedObjectMigration, oldDeviceIdToNew: Map<string, string|number>): ISmartRuleConfig {
        const managedObject = this.managedObjectMigrationToManagedObject(smartRuleMigration);

        const result: ISmartRuleConfig = _.pick(managedObject, ['c8y_Context', 'config', 'enabled', 'enabledSources', 'name', 'ruleTemplateName', 'type']);

        if (result.c8y_Context && result.c8y_Context.id && oldDeviceIdToNew.has(result.c8y_Context.id)) {
            result.c8y_Context.id = oldDeviceIdToNew.get(result.c8y_Context.id).toString();
        }
        // TODO: warn about missing?
        if (_.isArray(result.enabledSources)) {
            result.enabledSources = result.enabledSources.map(enabledSource => oldDeviceIdToNew.has(enabledSource) ? oldDeviceIdToNew.get(enabledSource).toString() : enabledSource);
        }

        return result;
    }

    async changeManagedObjectMigrationUpdateExisting(m: ManagedObjectMigration, existingId: string | undefined) {
        if (existingId) {
            const destinationClient = this.dataService.getDestinationDataClient();
            m.updateExisting = (await destinationClient.getAllManagedObjects()).find(mo => mo.id.toString() === existingId);
        } else {
            m.updateExisting = undefined;
        }
        this.resetManagedObjectMigration(m);
        this.dirty = true;
    }

    async changeDashboardMigrationUpdateExisting(m: ManagedObjectMigration, existingId: string | undefined) {
        if (existingId) {
            const destinationClient = this.dataService.getDestinationDataClient();
            m.updateExisting = (await destinationClient.getAllManagedObjects()).find(mo => mo.id.toString() === existingId);
        } else {
            m.updateExisting = undefined;
        }
        this.resetDashboardMigration(m);
        this.dirty = true;
    }

    async changeApplicationMigrationUpdateExisting(m: ApplicationMigration, existingId: string | undefined) {
        if (existingId) {
            const destinationClient = this.dataService.getDestinationDataClient();
            m.updateExisting = (await destinationClient.getApplicationsWithBinaries()).find(mo => mo.id.toString() === existingId);
        } else {
            m.updateExisting = undefined;
        }
        this.resetApplicationMigration(m);
        this.dirty = true;
    }

    findExistingManagedObject(m: IManagedObject, existingList: IManagedObject[]) {
        const filteredList = existingList.filter(existing => m.name === existing.name);

        return filteredList.find(existing => existing.id.toString() === m.id.toString()) ||
            (filteredList.length > 0 ? filteredList[0] : undefined);
    }

    findExistingDashboard(m: IManagedObject, existingList: IManagedObject[]) {
        const filteredList = existingList.filter(existing => getDashboardName(m) === getDashboardName(existing));

        return filteredList.find(existing => existing.id.toString() === m.id.toString()) ||
            (filteredList.length > 0 ? filteredList[0] : undefined);
    }

    findExistingApplication(m: IApplication, existingList: IApplication[]) {
        const filteredList = existingList.filter(existing => m.name === existing.name || m.contextPath === existing.contextPath);

        return filteredList.find(existing => existing.id.toString() === m.id.toString()) ||
            (filteredList.length > 0 ? filteredList[0] : undefined);
    }

    reset() {
        this.dataService.getSourceDataClient().invalidateCache();
        this.dataService.getDestinationDataClient().invalidateCache();
        this.editing = undefined;
        this.dirty = false;
        this.loadData();
    }

    markAllAsCreate() {
        [
            ...this.appMigrations,
            ...this.dashboardMigrations,
            ...this.groupMigrations,
            ...this.deviceMigrations,
            ...this.simulatorMigrations,
            ...this.smartRuleMigrations,
            ...this.binaryMigrations,
            ...this.otherMigrations
        ].forEach(migration => {
            migration.updateExisting = undefined;
        })
    }
}
