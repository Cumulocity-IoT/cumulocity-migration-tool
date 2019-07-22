import {Component, EventEmitter, Input, Output, ViewChild} from "@angular/core";
import {DataClient} from "../../DataClient";
import {DataService} from "../../data.service";
import {sortById} from "../../utils/utils";
import {IManagedObject} from "@c8y/client";
import {ModalDirective} from "ngx-bootstrap/modal";

@Component({
    templateUrl: './select-other.component.html',
    selector: 'selectOther'
})
export class SelectOtherComponent {
    @Input() selected: string;
    @Output() selectedChange: EventEmitter<string> = new EventEmitter<string>();

    @ViewChild(ModalDirective) modal: ModalDirective;

    private dataClient: DataClient;
    allOthers: Promise<IManagedObject[]>;

    constructor(private dataService: DataService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getDestinationDataClient();
        this.allOthers = this.dataClient.getOtherManagedObjects().then(d => sortById(d));
    }

    isSelected(other: IManagedObject): boolean {
        return other.id.toString() == this.selected;
    }

    toggleSelection(other: IManagedObject) {
        if (this.isSelected(other)) {
            this.selected = undefined;
        } else {
            this.selected = other.id.toString();
        }
    }

    trackById(index, value) {
        return value.id;
    }

    getDeviceName(other: IManagedObject) {
        return other.name || '-';
    }

    viewManagedObject(event: MouseEvent, managedObject: IManagedObject) {
        event.stopPropagation();
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
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