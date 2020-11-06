import {DataClient} from "../DataClient";
import {IApplication, IManagedObject} from "@c8y/client";
import _ from "lodash";
import objectScan from "object-scan";
import {
    getIdPathsFromApplication,
    getIdPathsFromDashboard,
    getSimulatorId,
    isSimulatorDevice,
    setFromPath
} from "../utils/utils";
import {IExternalId} from "../c8y-interfaces/IExternalId";
import {Subject} from "rxjs";
import {ISmartRuleConfig} from "../c8y-interfaces/ISmartRuleConfig";
import { IEplFileConfiguration } from "src/c8y-interfaces/IEplFileConfig";

export interface ApplicationMigration {
    newName: string,
    newContextPath: string,
    newAppKey: string,
    application: IApplication & { binary:IManagedObject },
    updateExisting?: IApplication
}

export interface ManagedObjectMigration {
    newName: string,
    managedObject: IManagedObject,
    updateExisting?: IManagedObject
}

export interface EplFileMigration {
    newName: string,
    eplFile: IEplFileConfiguration,
    updateExisting?: IEplFileConfiguration
}

export enum MigrationLogLevel {
    Verbose,
    Info,
    Error
}

export class MigrationLogEvent {
    public timestamp: string;
    constructor(public level: MigrationLogLevel, public description: string, timestamp?: string) {
        if (timestamp !== undefined) {
            this.timestamp = timestamp
        } else {
            this.timestamp = new Date().toISOString();
        }
    }

    static verbose(description: string): MigrationLogEvent {
        return new MigrationLogEvent(MigrationLogLevel.Verbose, description)
    }

    static info(description: string): MigrationLogEvent {
        return new MigrationLogEvent(MigrationLogLevel.Info, description)
    }

    static error(description: string): MigrationLogEvent {
        return new MigrationLogEvent(MigrationLogLevel.Error, description)
    }
}

export class Migration {
    log$ = new Subject<MigrationLogEvent>();

    constructor(private sourceClient: DataClient, private destinationClient: DataClient) {}

    async migrate(deviceMigrations: ManagedObjectMigration[], simulatorMigrations: ManagedObjectMigration[], 
        groupMigrations: ManagedObjectMigration[], otherMigrations: ManagedObjectMigration[], 
        smartRuleMigrations: ManagedObjectMigration[], dashboardMigrations: ManagedObjectMigration[], 
        binaryMigrations: ManagedObjectMigration[], appMigrations: ApplicationMigration[],
        eplFileMigrations: EplFileMigration[]) {
        // Separate the simulated devices from the non-simulated devices
        const [simulatorDeviceMigrations, nonSimulatorDeviceMigrations] = _.partition(deviceMigrations, deviceMigration => {
            if (!isSimulatorDevice(deviceMigration.managedObject)) return false;
            const simulatorId = getSimulatorId(deviceMigration.managedObject as (IManagedObject & {externalIds: IExternalId[]}));
            return simulatorMigrations.some(simMigration => simMigration.managedObject.id.toString() === simulatorId);
        });

        const oldIdsToNewIds = new Map<string, string|number>();
        
        // Migrate the standard managedObjects
        this.log$.next(MigrationLogEvent.info("Migrating Groups, Devices, and Other ManagedObjects..."));
        const standardMoMigrations = [].concat(groupMigrations, nonSimulatorDeviceMigrations, otherMigrations);
        for (let moMigration of standardMoMigrations) {
            if (moMigration.updateExisting) {
                this.log$.next(MigrationLogEvent.verbose(`Migrating: ${moMigration.managedObject.id} - Updating existing managed object: ${moMigration.updateExisting.id}.`));
                const mo = this.managedObjectMigrationToManagedObject(moMigration);
                mo.id = moMigration.updateExisting.id;
                oldIdsToNewIds.set(moMigration.managedObject.id.toString(), await this.destinationClient.updateManagedObject(mo))
            } else {
                this.log$.next(MigrationLogEvent.verbose(`Migrating: ${moMigration.managedObject.id} - Creating new managed object.`));
                oldIdsToNewIds.set(moMigration.managedObject.id.toString(), await this.destinationClient.createManagedObject(this.managedObjectMigrationToManagedObject(moMigration)));
            }
        }

        // Migrate the simulators
        this.log$.next(MigrationLogEvent.info("Migrating Simulators..."));

        // First find all of the devices linked to a simulator
        const simulatorDeviceMigrationsBySimulatorId = new Map<string, ManagedObjectMigration[]>();
        for (let simulatorDeviceMigration of simulatorDeviceMigrations) {
            const simulatorDevice = simulatorDeviceMigration.managedObject  as (IManagedObject & {externalIds: IExternalId[]});
            const simulatorId = getSimulatorId(simulatorDevice);
            if (simulatorId) {
                if (!simulatorDeviceMigrationsBySimulatorId.has(simulatorId)) {
                    simulatorDeviceMigrationsBySimulatorId.set(simulatorId, []);
                }
                simulatorDeviceMigrationsBySimulatorId.get(simulatorId).push(simulatorDeviceMigration);
            } else {
                throw Error(`Unable to migrate simulator for device: ${simulatorDevice.id}, cannot find matching simulator definition`);
            }
        }

        // Then migrate all of those devices and the simulator
        for (let [simulatorId, simDeviceMigrations] of simulatorDeviceMigrationsBySimulatorId) {
            const simulatorMigration = simulatorMigrations.find(simMigration => simMigration.managedObject.id.toString() === simulatorId);
            if (simulatorMigration) {
                const simulatorConfig = _.omit(_.cloneDeep(simulatorMigration.managedObject.c8y_DeviceSimulator), 'id');
                simulatorConfig.name = simulatorMigration.newName;

                let newSimulatorId: string|number;
                let deviceIds: (string|number)[];
                if (simulatorMigration.updateExisting) {
                    simulatorConfig.id = simulatorMigration.updateExisting.id;
                    simulatorConfig.instances = Math.max(simDeviceMigrations.length, simulatorConfig.instances);
                    this.log$.next(MigrationLogEvent.verbose(`Migrating: ${simulatorMigration.managedObject.id} - Updating existing simulator: ${simulatorMigration.updateExisting.id}, with ${simulatorConfig.instances} instances.`));
                    ({simulatorId: newSimulatorId, deviceIds: deviceIds} = await this.destinationClient.updateSimulator(simulatorConfig));
                } else {
                    this.log$.next(MigrationLogEvent.verbose(`Migrating: ${simulatorMigration.managedObject.id} - Creating new simulator, with ${simDeviceMigrations.length} instances.`));
                    // Create the simulator (which creates the simulator devices
                    simulatorConfig.instances = simDeviceMigrations.length;
                    ({simulatorId: newSimulatorId, deviceIds: deviceIds} = await this.destinationClient.createSimulator(simulatorConfig));
                }

                // Update the simulator devices
                for (let [simDeviceMigration, newDeviceId] of _.zip(simDeviceMigrations, deviceIds)) {
                    this.log$.next(MigrationLogEvent.verbose(`Migrating: ${simDeviceMigration.managedObject.id} - Updating simulated device: ${newDeviceId}.`));
                    const update = this.managedObjectMigrationToManagedObject(simDeviceMigration);
                    update.id = newDeviceId.toString();
                    await this.destinationClient.updateManagedObject(update);
                    oldIdsToNewIds.set(simDeviceMigration.managedObject.id.toString(), newDeviceId);
                }

                oldIdsToNewIds.set(simulatorId.toString(), newSimulatorId);
            } else {
                this.log$.next(MigrationLogEvent.error('Unable to find simulator' + simulatorId));
            }
        }

        // Migrate the SmartRules
        this.log$.next(MigrationLogEvent.info("Migrating Smart Rules..."));
        for (let srMigration of smartRuleMigrations) {
            if (srMigration.updateExisting) {
                this.log$.next(MigrationLogEvent.verbose(`Migrating: ${srMigration.managedObject.id} - Updating existing smart rule: ${srMigration.updateExisting.id}.`));
                const srConfig = _.omit(this.smartRuleMigrationToSmartRuleConfig(srMigration, oldIdsToNewIds),'type');
                srConfig.id = srMigration.updateExisting.id;
                oldIdsToNewIds.set(srMigration.managedObject.id.toString(), await this.destinationClient.updateSmartRule(srConfig));
            } else {
                this.log$.next(MigrationLogEvent.verbose(`Migrating: ${srMigration.managedObject.id} - Creating new smart rule.`));
                oldIdsToNewIds.set(srMigration.managedObject.id.toString(), await this.destinationClient.createSmartRule(this.smartRuleMigrationToSmartRuleConfig(srMigration, oldIdsToNewIds)));
            }
        }

        // Migrate the Epl Files
        this.log$.next(MigrationLogEvent.info("Migrating Epl Files..."));
        for (let eplFileMigration of eplFileMigrations) {
            if (eplFileMigration.updateExisting) {
                this.log$.next(MigrationLogEvent.verbose(`Migrating: ${eplFileMigration.eplFile.id} - Updating existing Epl File.`));
                const eplFile = this.eplFileMigrationToEplFileConfiguration(eplFileMigration, oldIdsToNewIds);
                eplFile.id = eplFileMigration.updateExisting.id;
                oldIdsToNewIds.set(eplFileMigration.eplFile.id.toString(), await this.destinationClient.updateEplFile(eplFile));
            } else {
                this.log$.next(MigrationLogEvent.verbose(`Migrating: ${eplFileMigration.eplFile.id} - Creating new Epl File.`));
                oldIdsToNewIds.set(eplFileMigration.eplFile.id.toString(), await this.destinationClient.createEplFile(this.eplFileMigrationToEplFileConfiguration(eplFileMigration, oldIdsToNewIds)));
            }
        }

        // Migrate the Binaries
        this.log$.next(MigrationLogEvent.info("Migrating Binaries..."));
        for (let bMigration of binaryMigrations) {
            const blob = await this.sourceClient.getBinaryBlob(bMigration.managedObject);
            if (bMigration.updateExisting) {
                this.log$.next(MigrationLogEvent.verbose(`Migrating: ${bMigration.managedObject.id} - Updating existing binary: ${bMigration.updateExisting.id}.`));
                const mo = this.managedObjectMigrationToManagedObject(bMigration);
                mo.id = bMigration.updateExisting.id;
                oldIdsToNewIds.set(bMigration.managedObject.id.toString(), await this.destinationClient.updateBinary(mo, blob));
            } else {
                this.log$.next(MigrationLogEvent.verbose(`Migrating: ${bMigration.managedObject.id} - Creating new binary.`));
                oldIdsToNewIds.set(bMigration.managedObject.id.toString(), await this.destinationClient.createBinary(this.managedObjectMigrationToManagedObject(bMigration), blob));
            }
        }

        // Migrate the dashboards
        this.log$.next(MigrationLogEvent.info("Migrating Dashboards..."));
        for (let dashboardMigration of dashboardMigrations) {
            if (dashboardMigration.updateExisting) {
                this.log$.next(MigrationLogEvent.verbose(`Migrating: ${dashboardMigration.managedObject.id} - Updating existing dashboard: ${dashboardMigration.updateExisting.id}.`));
                const db = this.dashboardMigrationToManagedObject(dashboardMigration, new Map(oldIdsToNewIds));
                db.id = dashboardMigration.updateExisting.id;
                oldIdsToNewIds.set(dashboardMigration.managedObject.id.toString(), await this.destinationClient.updateManagedObject(db));
            } else {
                this.log$.next(MigrationLogEvent.verbose(`Migrating: ${dashboardMigration.managedObject.id} - Creating new dashboard.`));
                oldIdsToNewIds.set(dashboardMigration.managedObject.id.toString(), await this.destinationClient.createManagedObject(this.dashboardMigrationToManagedObject(dashboardMigration, oldIdsToNewIds)));
            }
        }

        // Create the parent child linkages
        this.log$.next(MigrationLogEvent.info("Migrating Parent/Child linkages..."));
        for (let moMigration of [...dashboardMigrations, ...groupMigrations, ...deviceMigrations, ...otherMigrations]) {
            const newMoId = oldIdsToNewIds.get(moMigration.managedObject.id.toString());
            this.log$.next(MigrationLogEvent.verbose(`Creating Parent/Child linkages for: ${moMigration.managedObject.id} - Updating existing managed object: ${newMoId}.`));
            await this.destinationClient.createLinkages(newMoId.toString(), this.managedObjectMigrationToManagedObjectLinkages(moMigration, oldIdsToNewIds))
        }

        // Migrate the applications
        this.log$.next(MigrationLogEvent.info("Migrating Applications..."));
        for (let appMigration of appMigrations) {
            const blob = await this.sourceClient.getApplicationBlob(appMigration.application);
            if (appMigration.updateExisting) {
                this.log$.next(MigrationLogEvent.verbose(`Migrating: ${appMigration.application.id} - Updating existing application: ${appMigration.updateExisting.id}.`));
                const app = Migration.appMigrationToApp(appMigration, oldIdsToNewIds);
                app.id = appMigration.updateExisting.id;
                await this.destinationClient.updateApplication(app, blob);
            } else {
                this.log$.next(MigrationLogEvent.verbose(`Migrating: ${appMigration.application.id} - Creating new application.`));
                await this.destinationClient.createApplication(Migration.appMigrationToApp(appMigration, oldIdsToNewIds), blob);
            }
        }

        this.log$.next(MigrationLogEvent.info("Done"));
    }

    static appMigrationToApp(appMigration: ApplicationMigration, oldIdsToNewIds: Map<string, string|number>): IApplication {
        const result: IApplication & {applicationBuilder?: any} = {};

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

        const deviceIdPaths = getIdPathsFromApplication(appMigration.application);
        deviceIdPaths.forEach(path => {
            if (_.has(result, path)) {
                const oldId = _.get(result, path);
                if (oldIdsToNewIds.has(oldId.toString())) {
                    _.set(result, path, oldIdsToNewIds.get(oldId.toString()));
                } else {
                    // TODO: add to warning
                }
            }
        });

        if (result.applicationBuilder) {
            result.externalUrl = appMigration.application.externalUrl.split(appMigration.application.id.toString()).join('UNKNOWN-APP-ID');
            // Update application builder dashboard ids
            if (result.applicationBuilder.dashboards) {
                result.applicationBuilder.dashboards.forEach(dashboard => {
                    if (oldIdsToNewIds.has(dashboard.id.toString())) {
                        dashboard.id = oldIdsToNewIds.get(dashboard.id.toString());
                    } else {
                        // TODO: add to warning
                    }
                })
            } else {
                // Should always have a dashboards property, even if empty
                result.applicationBuilder.dashboards = [];
            }
        }

        // Update the application with the user provided changes...
        result.contextPath = appMigration.newContextPath;
        result.name = appMigration.newName;
        result.key = appMigration.newAppKey;

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

    eplFileMigrationToEplFileConfiguration(eplFileMigration: EplFileMigration, oldDeviceIdToNew: Map<string, string|number>) : IEplFileConfiguration {
        const result: IEplFileConfiguration = _.cloneDeep(eplFileMigration.eplFile);
        result.name = eplFileMigration.newName;
        
        return result;
    }
}
