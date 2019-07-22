import {Component, EventEmitter, Input, OnDestroy, Output, ViewChild} from "@angular/core";
import {DataClient} from "../../DataClient";
import {DataService} from "../../data.service";
import {sortById} from "../../utils/utils";
import {IManagedObject, IApplication} from "@c8y/client";
import {ModalDirective} from "ngx-bootstrap/modal";
import {BehaviorSubject, Subscription} from "rxjs";
import {SelectionService} from "../../selection.service";

@Component({
    templateUrl: './select-application.component.html',
    selector: 'selectApplication'
})
export class SelectApplicationComponent implements OnDestroy{
    @Input() selected: string;
    @Output() selectedChange: EventEmitter<string> = new EventEmitter<string>();

    @ViewChild(ModalDirective) modal: ModalDirective;

    private dataClient: DataClient;
    showAll$: BehaviorSubject<boolean> = new BehaviorSubject(false);
    allApplications: Promise<(IApplication & {id: string|number, binary: IManagedObject})[]>;
    filteredApplications: Promise<(IApplication & {id: string|number, binary: IManagedObject, downloading?:boolean})[]>;

    showAllSubscription: Subscription;

    constructor(private dataService: DataService, private selectionService: SelectionService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allApplications = this.dataClient.getApplicationsWithBinaries();
        this.showAllSubscription = this.showAll$.subscribe(showAll => {
            this.filteredApplications = this.allApplications.then(apps => sortById(apps.filter(app => showAll || app.binary)));
        });
    }

    isSelected(app: {id: string|number}) {
        return app.id.toString() == this.selected;
    }

    toggleSelection(app: {id: string|number}) {
        if (this.isSelected(app)) {
            this.selected = undefined;
        } else {
            this.selected = app.id.toString();
        }
    }

    trackById(index, value) {
        return value.id;
    }

    getName(app: IApplication) {
        return app.name || '-';
    }

    openApplication(event: MouseEvent, app: IApplication) {
        event.stopPropagation();
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/${app.contextPath}`, '_blank');
    }

    reload() {
        this.dataClient.invalidateCache();
        this.load();
    }

    open() {
        this.modal.show();
    }

    close(success: boolean = true) {
        if (success) {
            this.selectedChange.emit(this.selected);
        }
        this.modal.hide();
    }

    ngOnDestroy(): void {
        this.showAllSubscription.unsubscribe();
    }
}