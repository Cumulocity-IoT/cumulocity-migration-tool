import {Component} from '@angular/core';
import {IManagedObject} from '@c8y/client';
import {DataService} from "../../data.service";
import {SelectionService} from "../../selection.service";
import {sortById} from "../../utils/utils";
import {DataClient} from 'src/DataClient';
import {UpdateableAlert} from "../../utils/UpdateableAlert";
import {AlertService} from "@c8y/ngx-components";

@Component({
    templateUrl: './simulator.component.html'
})
export class SimulatorComponent {
    private dataClient: DataClient;
    allSimulators: Promise<IManagedObject[]>;

    constructor(private dataService: DataService, private selectionService: SelectionService, private alertService: AlertService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allSimulators = this.dataClient.getSimulators().then(d => sortById(d));
    }

    async toggleSelection(simulator: IManagedObject) {
        if (this.isSelected(simulator)) {
            this.selectionService.deselect(simulator.id);
        } else {
            const alrt = new UpdateableAlert(this.alertService);
            this.selectionService.select(simulator.id);
            alrt.update(`Searching for linked Groups and Devices...`);
            const {groups, devices, simulators, smartRules, other, childParentLinks} = await this.dataClient.findLinkedFrom(simulator);
            childParentLinks.forEach(({child, parent}) => {
                this.selectionService.select(child, parent);
            });
            alrt.update(`Links found: ${groups.length} Groups, ${devices.length} Devices, ${simulators.length-1} Simulators, ${smartRules.length} Smart Rules, ${other.length} Other`);
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

    viewSimulator(event: MouseEvent, simulator: IManagedObject) {
        event.stopPropagation();
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/devicemanagement/index.html#/simulators/${simulator.id}`, '_blank');
    }

    reload() {
        this.dataClient.invalidateCache();
        this.load();
    }
}
