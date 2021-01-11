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
import {getDashboardName} from "../utils/utils";
import {AlertService} from "@c8y/ngx-components";
import download from "downloadjs";
import {FileDataClient} from "../FileDataClient";
import {UpdateableAlert} from "../utils/UpdateableAlert";
import {
    ApplicationMigration,
    EplFileMigration,
    ManagedObjectMigration,
    Migration,
    MigrationLogEvent,
    MigrationLogLevel
} from "./migration.service";
import {filter} from 'rxjs/operators';
import {BehaviorSubject} from "rxjs";
import { IEplFileConfiguration } from 'src/c8y-interfaces/IEplFileConfig';


@Component({
    templateUrl: './migrate.component.html'
})
export class MigrateComponent {
    @ViewChild('SmartRuleError') smartRuleError: TemplateRef<any>;
    @ViewChild('SimulatorError') simulatorError: TemplateRef<any>;
    @ViewChild('ApamaError') apamaError: TemplateRef<any>;

    from: string;
    to: string;

    appMigrations: ApplicationMigration[];
    eplFileMigrations: EplFileMigration[];
    smartRestTemplatesMigrations: ManagedObjectMigration[];
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

    isMigrateExternalIds = true;

    constructor(private dataService: DataService, private selectionService: SelectionService, private alertService: AlertService) {
        this.loadData();
    }

    async loadData() {
        this.appMigrations = [];
        this.eplFileMigrations = [];
        this.smartRestTemplatesMigrations = [];
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

        const [sourceEplFiles, destEplFiles] = await Promise.all([sourceClient.getEplFiles(), destinationClient.getEplFiles()]);

        const [
            sourceDashboards, sourceGroups, sourceDevices, sourceSimulators, sourceSmartRules, sourceSmartRestTemplates, sourceBinaries, sourceOtherMOs,
            destDashboards, destGroups, destDevices, destSimulators, destSmartRules, destSmartRestTemplates, destBinaries, destOtherMOs
        ] = await Promise.all([
            sourceClient.getDashboards(), sourceClient.getGroups(), sourceClient.getDevicesWithExternalIds(), sourceClient.getSimulators(), sourceClient.getSmartRules(), sourceClient.getSmartRestWithExternalIds(), sourceClient.getBinaries(), sourceClient.getOtherManagedObjects(),
            destinationClient.getDashboards(), destinationClient.getGroups(), destinationClient.getDevicesWithExternalIds(), destinationClient.getSimulators(), destinationClient.getSmartRules(), destinationClient.getSmartRestWithExternalIds(), destinationClient.getBinaries(), destinationClient.getOtherManagedObjects()
        ]);

        const selectedApps = sourceApps.filter(app => this.selectionService.isSelected(app.id));
        const selectedEplFiles = sourceEplFiles.filter(eplFile => this.selectionService.isSelected(eplFile.id));
        const selectedSmartRestTemplates = sourceSmartRestTemplates.filter(template => this.selectionService.isSelected(template.id));
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

        if (selectedEplFiles.length > 0 && !await destinationClient.checkSupportFor('Apama')) {
            this.alertService.add({
                type: 'danger',
                text: this.apamaError,
            });
            selectedEplFiles.length = 0;
        }

        this.appMigrations = selectedApps.map(application => ({
            newName: application.name,
            newContextPath: application.contextPath,
            newAppKey: application.key,
            application,
            updateExisting: this.findExistingApplication(application, destApps)
        }));

        this.eplFileMigrations = selectedEplFiles.map(eplFile => ({
            newName: eplFile.name,
            eplFile: eplFile,
            updateExisting: this.findExistingEplFile(eplFile, destEplFiles)
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

        this.smartRestTemplatesMigrations = selectedSmartRestTemplates.map(template => ({
            newName: template.name,
            managedObject: template,
            updateExisting: this.findExistingManagedObject(template, destSmartRestTemplates)
        }))

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

    toggleEditMode(object: ManagedObjectMigration | ApplicationMigration | EplFileMigration) {
        if (this.isInEditMode(object)) {
            this.editing = undefined;
        } else {
            this.editing = this.getObjectId(object);
        }
        this.dirty = true;
    }

    isInEditMode(object: ManagedObjectMigration | ApplicationMigration | EplFileMigration) {
        let objectId = this.getObjectId(object);
        return this.editing && this.editing === objectId;
    }

    getObjectId(object: ManagedObjectMigration | ApplicationMigration | EplFileMigration) : string {
        if (object.hasOwnProperty('managedObject')) {
            return (object as ManagedObjectMigration).managedObject.id.toString();
        }

        if (object.hasOwnProperty('application')) {
            return (object as ApplicationMigration).application.id.toString();
        }

        if (object.hasOwnProperty('eplFile')) {
            return (object as EplFileMigration).eplFile.id.toString();
        }

        return undefined;
    }

    resetApplicationMigration(appMigration: ApplicationMigration) {
        if (appMigration.updateExisting) {
            appMigration.newName = appMigration.updateExisting.name;
            appMigration.newContextPath = appMigration.updateExisting.contextPath;
            appMigration.newAppKey = appMigration.updateExisting.key;
        } else {
            appMigration.newName = appMigration.application.name;
            appMigration.newContextPath = appMigration.application.contextPath;
            appMigration.newAppKey = appMigration.application.key;
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

    resetEplFileMigration(eplFileMigration: EplFileMigration) {
        if (eplFileMigration.updateExisting) {
            eplFileMigration.newName = eplFileMigration.updateExisting.name;
        } else {
            eplFileMigration.newName = eplFileMigration.eplFile.name;
        }
    }

    canMigrate(): boolean {
        return this.appMigrations.length > 0
            || this.dashboardMigrations.length > 0
            || this.groupMigrations.length > 0
            || this.deviceMigrations.length > 0
            || this.simulatorMigrations.length > 0
            || this.smartRuleMigrations.length > 0
            || this.smartRestTemplatesMigrations.length > 0
            || this.eplFileMigrations.length > 0
            || this.binaryMigrations.length > 0
            || this.otherMigrations.length > 0;
    }

    async migrate() {
        const alrt = new UpdateableAlert(this.alertService);
        const sourceClient = this.dataService.getSourceDataClient();
        const destinationClient = this.dataService.getDestinationDataClient();

        const migration = new Migration(sourceClient, destinationClient);

        const infoLogger = migration.log$.pipe(
            filter(log => log.level == MigrationLogLevel.Info)
        ).subscribe(log => alrt.update(log.description));

        const consoleLogger = migration.log$.subscribe(log => {
            switch(log.level) {
                case MigrationLogLevel.Verbose:
                case MigrationLogLevel.Info:
                    console.info(log.description);
                    return;
                case MigrationLogLevel.Error:
                    console.error(log.description);
                    return;
            }
        });

        const lastLogMessage = new BehaviorSubject<MigrationLogEvent|undefined>(undefined);
        const lastLogSubscriber = migration.log$.subscribe(lastLogMessage);

        try {
            await migration.migrate(this.deviceMigrations, this.simulatorMigrations, this.groupMigrations, this.otherMigrations, 
                this.smartRuleMigrations, this.smartRestTemplatesMigrations, this.dashboardMigrations, this.binaryMigrations, 
                this.appMigrations, this.eplFileMigrations, this.isMigrateExternalIds);

            if (destinationClient instanceof FileDataClient) {
                alrt.update("Opening...");
                alrt.close(4500);
                await destinationClient.finishMigration();
                download(destinationClient.file, destinationClient.fileName);
            } else {
                alrt.update("Done!", 'success');
                alrt.close(1000);
            }
            this.dirty = false;
        } catch(e) {
            if (lastLogMessage.getValue() != undefined) {
                alrt.update(`Failed to migrate!\nFailed at: ${lastLogMessage.getValue().description}\n${this.getErrorMessage(e)}\nCheck browser console for more details`, 'danger');
            } else {
                alrt.update(`Failed to migrate!\n${this.getErrorMessage(e)}\nCheck browser console for more details`, 'danger');
            }

            throw(e);
        } finally {
            infoLogger.unsubscribe();
            consoleLogger.unsubscribe();
            lastLogSubscriber.unsubscribe();
            this.reset();
        }
    }

    getErrorMessage(e) {
        if (e instanceof Error) {
            return `${e.name || 'Error'}: ${e.message}`;
        } else if (e.data && e.data.error) {
            return `Error: ${e.data.error} - ${e.data.message}`;
        } else {
            return 'Error: An Unknown Error occurred';
        }
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

    async changeEplFileMigrationUpdateExisting(eplFile: EplFileMigration, existingId: string | undefined) {
        if (existingId) {
            const destinationClient = this.dataService.getDestinationDataClient();
            eplFile.updateExisting = (await destinationClient.getEplFiles()).find(eplFileUpdat => eplFile.eplFile.id.toString() === existingId);
        } else {
            eplFile.updateExisting = undefined;
        }

        this.resetEplFileMigration(eplFile);
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

    findExistingEplFile(eplFile: IEplFileConfiguration, existingList: IEplFileConfiguration[]) {
        const filteredList = existingList.filter(existing => eplFile.name === existing.name);

        return filteredList.find(existing => existing.id.toString() === eplFile.id.toString()) ||
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
            ...this.smartRestTemplatesMigrations,
            ...this.eplFileMigrations,
            ...this.binaryMigrations,
            ...this.otherMigrations
        ].forEach(migration => {
            migration.updateExisting = undefined;
        })
    }
}
