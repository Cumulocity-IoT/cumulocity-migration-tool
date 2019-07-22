import {Component, Inject, TemplateRef} from '@angular/core';
import {CredentialsService, IConnectionDetails, IFileConnectionDetails} from "../../credentials.service";
import {BehaviorSubject} from "rxjs";
import {AlertService} from "@c8y/ngx-components";
import {ClientLike} from "../../currentclient.service";
import {HttpDataClient} from "../../HttpDataClient";
import {ICurrentUser} from '@c8y/client';
import {DataService} from "../../data.service";
import {SelectionService} from "../../selection.service";

@Component({
    templateUrl: './credentials.component.html'
})
export class CredentialsComponent {
    connectionDetails$: BehaviorSubject<IConnectionDetails>;
    currentUser: ICurrentUser;
    currentTenantUrl: string;

    constructor(private credentialsSvc: CredentialsService, private alertService: AlertService, private dataService: DataService, @Inject('currentClient') private currentClient: ClientLike, private selectionService: SelectionService) {
        this.connectionDetails$ = credentialsSvc.source$;
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
        this.selectionService.deselectAll();
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

    onFileChange(connectionDetails: IFileConnectionDetails, event: Event) {
        connectionDetails.file = (event.target as HTMLInputElement).files[0];
        connectionDetails.fileName = (event.target as HTMLInputElement).files[0].name;
        return Promise.all([this.dataService.getSourceDataClient().getApplications(), this.dataService.getSourceDataClient().getAllManagedObjects()])
            .then(([applications, managedObjects]) => {
                [...applications, ...managedObjects].filter(b => !b.hasOwnProperty('c8y_applications_storage')).forEach(appOrMo => {
                    this.selectionService.select(appOrMo.id)
                })
            });
    }
}
