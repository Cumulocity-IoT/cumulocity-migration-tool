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
import { Component, Inject, OnInit, TemplateRef } from '@angular/core';
import { CredentialsService, IConnectionDetails, IFileConnectionDetails, ITenantConnectionDetails } from "../../credentials.service";
import { BehaviorSubject } from "rxjs";
import { AlertService } from "@c8y/ngx-components";
import { ClientLike } from "../../currentclient.service";
import { HttpDataClient } from "../../HttpDataClient";
import { ICurrentUser } from '@c8y/client';
import { DataService } from "../../data.service";
import { SelectionService } from "../../selection.service";
import { TOUCH_BUFFER_MS } from '@angular/cdk/a11y';

@Component({
    templateUrl: './connection-details.component.html'
})
export class ConnectionDetailsComponent implements OnInit {
    connectionDetails$: BehaviorSubject<IConnectionDetails>;
    
    currentUser: ICurrentUser;
    
    currentTenantUrl: string;

    customFragments: string;

    isOnlyBaseObjects: boolean = false;

    constructor(private credentialsService: CredentialsService, private alertService: AlertService,
        private dataService: DataService, @Inject('currentClient') private currentClient: ClientLike,
        private selectionService: SelectionService) {
        this.connectionDetails$ = credentialsService.source$;
        new HttpDataClient(this.currentClient, this.dataService).getUser().then(user => {
            this.currentUser = user;
        });
        this.currentTenantUrl = this.currentClient.core.baseUrl;
    }

    ngOnInit(): void {
        this.initCustomFragments();
    }

    initCustomFragments(): void {
        if (!this.dataService.isFilterOnCustomFragments()) {
            return;
        }

        this.isOnlyBaseObjects = this.dataService.isOnlyLoadBasicObjects();
        this.customFragments = this.dataService.getCustomFragments().join('\n');
    }

    save({ username, password, baseUrl }: { username: string, password: string, baseUrl: string }) {
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
        this.selectionService.deselectAll();
    }

    async checkConnection(connectionDetails: IConnectionDetails) {
        try {
            await this.dataService.createDataClient(connectionDetails).getUser();
            this.alertService.success(`Connection succeeded`);
        } catch (e) {
            this.alertService.add({
                type: 'danger',
                allowHtml: true,
                text: this.credentialsService.getErrorMessage(connectionDetails),
            });
        }
    }

    onFileChange(connectionDetails: IFileConnectionDetails, event: Event) {
        connectionDetails.file = (event.target as HTMLInputElement).files[0];
        connectionDetails.fileName = (event.target as HTMLInputElement).files[0].name;
        this.connectionDetails$.next(connectionDetails);
        return Promise.all([this.dataService.getSourceDataClient().getApplications(),
        this.dataService.getSourceDataClient().getAllManagedObjects(), this.dataService.getSourceDataClient().getEplFiles()])
            .then(([applications, managedObjects, eplFiles]) => {
                [...applications, ...managedObjects, ...eplFiles].filter(b => !b.hasOwnProperty('c8y_applications_storage')).forEach(asset => {
                    this.selectionService.select(asset.id)
                })
            });
    }

    onCustomFragmentSaveButtonClicked(): void {
        this.dataService.setOnlyLoadBasicObjects(this.isOnlyBaseObjects);

        if (this.customFragments && this.customFragments.trim().length >= 0) {
            this.dataService.setCustomFragments(this.customFragments.split('\n'));
        }

        this.alertService.success('Settings saved successfully!');
    }

    onCustomFragmentsResetButtonClicked(): void {
        this.customFragments = undefined;
        this.dataService.setCustomFragments([]);
        this.alertService.success('Custom Fragments reset successfully!');
    }
}
