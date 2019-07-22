import {Component, EventEmitter, Input, Output, ViewChild} from "@angular/core";
import {DataClient} from "../../DataClient";
import {DataService} from "../../data.service";
import {sortById} from "../../utils/utils";
import {IManagedObject} from "@c8y/client";
import {ModalDirective} from "ngx-bootstrap/modal";

@Component({
    templateUrl: './select-binary.component.html',
    selector: 'selectBinary'
})
export class SelectBinaryComponent {
    @Input() selected: string;
    @Output() selectedChange: EventEmitter<string> = new EventEmitter<string>();

    @ViewChild(ModalDirective) modal: ModalDirective;

    private dataClient: DataClient;
    allBinaries: Promise<IManagedObject[]>;

    constructor(private dataService: DataService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getDestinationDataClient();
        this.allBinaries = this.dataClient.getBinaries()
            .then(binaries => binaries.filter(b => !b.hasOwnProperty('c8y_applications_storage')))
            .then(d => sortById(d));
    }

    isSelected(b: IManagedObject): boolean {
        return b.id.toString() == this.selected;
    }

    toggleSelection(b: IManagedObject) {
        if (this.isSelected(b)) {
            this.selected = undefined;
        } else {
            this.selected = b.id.toString();
        }
    }

    trackById(index, value) {
        return value.id;
    }

    getName(b: IManagedObject) {
        return b.name || '-';
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