import {Component, EventEmitter, Input, Output, ViewChild} from "@angular/core";
import {DataClient} from "../../DataClient";
import {DataService} from "../../data.service";
import {sortById} from "../../utils/utils";
import {IManagedObject} from "@c8y/client";
import {ModalDirective} from "ngx-bootstrap/modal";

@Component({
    templateUrl: './select-smart-rule.component.html',
    selector: 'selectSmartRule'
})
export class SelectSmartRuleComponent {
    @Input() selected: string;
    @Output() selectedChange: EventEmitter<string> = new EventEmitter<string>();

    @ViewChild(ModalDirective) modal: ModalDirective;

    private dataClient: DataClient;
    allSmartRules: Promise<IManagedObject[]>;

    constructor(private dataService: DataService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getDestinationDataClient();
        this.allSmartRules = this.dataClient.getSmartRules().then(d => sortById(d));
    }

    isSelected(sr: IManagedObject): boolean {
        return sr.id.toString() == this.selected;
    }

    toggleSelection(sr: IManagedObject) {
        if (this.isSelected(sr)) {
            this.selected = undefined;
        } else {
            this.selected = sr.id.toString();
        }
    }

    trackById(index, value) {
        return value.id;
    }

    getName(sr: IManagedObject) {
        return sr.name || '-';
    }

    viewManagedObject(event: MouseEvent, managedObject: IManagedObject) {
        event.stopPropagation();
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    viewSmartRule(event: MouseEvent, smartRule: IManagedObject) {
        event.stopPropagation();
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/cockpit/index.html#/device/${smartRule.c8y_Context.id}/info`, '_blank');
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