import {Component, EventEmitter, Input, Output, ViewChild} from "@angular/core";
import {DataClient} from "../../DataClient";
import {DataService} from "../../data.service";
import {getDashboardName, sortById} from "../../utils/utils";
import {IManagedObject} from "@c8y/client";
import {ModalDirective} from "ngx-bootstrap/modal";

@Component({
    templateUrl: './select-dashboard.component.html',
    selector: 'selectDashboard'
})
export class SelectDashboardComponent {
    @Input() selected: string;
    @Output() selectedChange: EventEmitter<string> = new EventEmitter<string>();

    @ViewChild(ModalDirective) modal: ModalDirective;

    private dataClient: DataClient;
    allDashboards: Promise<IManagedObject[]>;

    constructor(private dataService: DataService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getDestinationDataClient();
        this.allDashboards = this.dataClient.getDashboards().then(d => sortById(d));
    }

    isSelected(db: IManagedObject): boolean {
        return db.id.toString() == this.selected;
    }

    toggleSelection(db: IManagedObject) {
        if (this.isSelected(db)) {
            this.selected = undefined;
        } else {
            this.selected = db.id.toString();
        }
    }

    trackById(index, value) {
        return value.id;
    }

    readonly getDashboardName = getDashboardName;

    viewManagedObject(event: MouseEvent, managedObject: IManagedObject) {
        event.stopPropagation();
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    getDashboardUrl(dashboard: IManagedObject): string | undefined {
        const baseUrl = this.dataClient.getBaseUrl();
        if (!baseUrl) return undefined;

        const keyRegex = /^c8y_Dashboard!(device|group)!(\d+)$/
        const matchingKey = Object.keys(dashboard).find(key => keyRegex.test(key));
        if (matchingKey) {
            const [, groupOrDevice, deviceOrGroupId] = matchingKey.match(keyRegex);
            return `${baseUrl}/apps/cockpit/index.html#/${groupOrDevice}/${deviceOrGroupId}/dashboard/${dashboard.id}`;
        }
        return undefined;
    }

    openDashboard(event: MouseEvent, dashboard: IManagedObject) {
        event.stopPropagation();
        window.open(this.getDashboardUrl(dashboard), '_blank');
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
}