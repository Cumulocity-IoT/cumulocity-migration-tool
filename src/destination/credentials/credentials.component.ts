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
import {Component, Inject, TemplateRef} from '@angular/core';
import {CredentialsService, IConnectionDetails, ITenantConnectionDetails} from "../../credentials.service";
import {BehaviorSubject} from "rxjs";
import {AlertService, AppStateService} from "@c8y/ngx-components";
import {ClientLike} from "../../currentclient.service";
import {HttpDataClient} from "../../HttpDataClient";
import {ICurrentUser} from '@c8y/client';
import {DataService} from "../../data.service";
import {MigrateComponent} from "../../migrate/migrate.component";
import {UpdateableAlert} from "../../utils/UpdateableAlert";
import {delay} from "../../utils/utils";
import {Migration} from "../../migrate/migration.service";

@Component({
    templateUrl: './credentials.component.html'
})
export class CredentialsComponent {
    connectionDetails$: BehaviorSubject<IConnectionDetails>;
    currentUser: ICurrentUser;
    currentTenantUrl: string;

    constructor(private credentialsSvc: CredentialsService, private alertService: AlertService, private dataService: DataService, @Inject('currentClient') private currentClient: ClientLike, private appState: AppStateService) {
        this.connectionDetails$ = credentialsSvc.destination$;
        new HttpDataClient(this.currentClient).getUser().then(user => {
            this.currentUser = user;
        });
        this.currentTenantUrl = this.currentClient.core.baseUrl;
    }

    save({username, password, baseUrl}: {username: string, password: string, baseUrl: string}) {
        this.connectionDetails$.next({
            type: "tenant",
            credentials: {
                user: username,
                password
            },
            baseUrl
        } as IConnectionDetails)
    }

    changeConnectionType(connectionDetails: IConnectionDetails) {
        this.connectionDetails$.next(connectionDetails);
    }

    async checkConnection(connectionError: TemplateRef<any>, connectionDetails: IConnectionDetails) {
        try {
            await this.dataService.createDataClient(connectionDetails).getUser();
            this.alertService.success(`Connection succeeded`);
        } catch(e) {
            this.alertService.add({
                type: 'danger',
                text: connectionError,
            });
        }
    }

    async deployMigrationToOther(connectionDetails: ITenantConnectionDetails) {
        const alrt = new UpdateableAlert(this.alertService);
        const dataClient = this.dataService.createDataClient(connectionDetails);
        const currentDataClient = this.dataService.currentClientDataClient;
        try {
            await dataClient.getUser();
        } catch (e) {
            alrt.update("Could not connect to tenant, try 'Check connection' for more details", 'danger');
            throw e;
        }
        const path = window.location.pathname;
        try {
            // Check if the migration tool already exists on this server
            alrt.update("Checking for existing Migration Tool");
            const existingApps = await dataClient.getApplications();
            if (existingApps.some(app => app.contextPath === 'migration-tool')) {
                alrt.update('Already exists! Redirecting...', 'success');
                await delay(1000);
                window.location.href = `${connectionDetails.baseUrl}/apps/migration-tool`;
                return;
            }

            // If it doesn't then migrate it from wherever we're currently running
            alrt.update("Downloading Migration Tool...");
            const contextPath = this.appState.state.app.contextPath;
            const migrationToolApp = (await currentDataClient.getApplicationsWithBinaries()).find(app => app.contextPath === contextPath);
            const binaryBlob = await currentDataClient.getBinaryBlob(migrationToolApp.binary, (progress) => {
                alrt.update(`Downloading Migration Tool... ${(progress * 100).toFixed(0)}%`);
            }); // TODO: progress
            alrt.update('Uploading to tenant...');
            const newApp = Migration.appMigrationToApp({
                newName: 'Migration Tool',
                newContextPath: 'migration-tool',
                newAppKey: 'migration-tool-application-key',
                application: migrationToolApp
            }, new Map<string, string|number>());
            await dataClient.createApplication(newApp, binaryBlob);
            alrt.update('Done! Redirecting...', 'success');
            await delay(1000);
            window.location.href = `${connectionDetails.baseUrl}/apps/migration-tool`;
        } catch(e) {
            alrt.update('Managed to connect to tenant but could not migrate the Migration Tool, you can try manually migrating it', 'danger');
            throw e;
        }
    }
}
