import {Component, EventEmitter, Input, Output, ViewChild} from "@angular/core";
import {DataClient} from "../../DataClient";
import {DataService} from "../../data.service";
import {sortById} from "../../utils/utils";
import {IManagedObject} from "@c8y/client";
import {ModalDirective} from "ngx-bootstrap/modal";

@Component({
    templateUrl: './select-simulator.component.html',
    selector: 'selectSimulator'
})
export class SelectSimulatorComponent {
    @Input() selected: string;
    @Output() selectedChange: EventEmitter<string> = new EventEmitter<string>();

    @ViewChild(ModalDirective) modal: ModalDirective;

    private dataClient: DataClient;
    allSimulators: Promise<IManagedObject[]>;

    constructor(private dataService: DataService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getDestinationDataClient();
        this.allSimulators = this.dataClient.getSimulators().then(d => sortById(d));
    }

    isSelected(simulator: IManagedObject): boolean {
        return simulator.id.toString() == this.selected;
    }

    toggleSelection(simulator: IManagedObject) {
        if (this.isSelected(simulator)) {
            this.selected = undefined;
        } else {
            this.selected = simulator.id.toString();
        }
    }

    trackById(index, value) {
        return value.id;
    }

    getName(simulator: IManagedObject) {
        return simulator.name || '-';
    }

    viewManagedObject(event: MouseEvent, managedObject: IManagedObject) {
        event.stopPropagation();
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    viewSimulator(event: MouseEvent, simulator: IManagedObject) {
        event.stopPropagation();
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/devicemanagement/index.html#/simulators/${simulator.id}`, '_blank');
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