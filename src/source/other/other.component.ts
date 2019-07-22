import {Component} from '@angular/core';
import {IManagedObject} from '@c8y/client';
import {DataService} from "../../data.service";
import {SelectionService} from "../../selection.service";
import {sortById} from "../../utils/utils";
import {UpdateableAlert} from "../../utils/UpdateableAlert";
import {AlertService} from "@c8y/ngx-components";
import {DataClient} from 'src/DataClient';

@Component({
    templateUrl: './other.component.html'
})
export class OtherComponent {
    private dataClient: DataClient;
    allOtherManagedObjects: Promise<IManagedObject[]>;

    constructor(private dataService: DataService, private selectionService: SelectionService, private alertService: AlertService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allOtherManagedObjects = this.dataClient.getOtherManagedObjects().then(d => sortById(d));
    }

    async toggleSelection(mo: IManagedObject) {
        if (this.isSelected(mo)) {
            this.selectionService.deselect(mo.id);
        } else {
            const alrt = new UpdateableAlert(this.alertService);
            this.selectionService.select(mo.id);
            alrt.update(`Searching for linked Groups and Devices...`);
            const {groups, devices, simulators, smartRules, other, childParentLinks} = await this.dataClient.findLinkedFrom(mo);
            childParentLinks.forEach(({child, parent}) => {
                this.selectionService.select(child, parent);
            });
            alrt.update(`Links found: ${groups.length} Groups, ${devices.length} Devices, ${simulators.length} Simulators, ${smartRules.length} Smart Rules, ${other.length-1} Other`);
            alrt.close(5000);
        }
    }

    isSelected(o: {id: string|number}) {
        return this.selectionService.isSelected(o.id);
    }

    trackById(index, value) {
        return value.id;
    }

    getName(managedObject: IManagedObject) {
        return managedObject.name || '-';
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
}
