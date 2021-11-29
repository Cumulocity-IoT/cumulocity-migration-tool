import { Component, OnInit } from '@angular/core';
import { IManagedObject } from '@c8y/client';
import { CellRendererContext } from '@c8y/ngx-components';
import { isSimulatorDevice, sortById } from "../../../utils/utils";

@Component({
    selector: 'simulator-cell-renderer',
    templateUrl: './simulator-renderer.component.html'
})
export class SimulatorCellRendererComponent implements OnInit {
    
    constructor(public context: CellRendererContext) { }

    ngOnInit(): void { }

    isSimulated(): boolean {
        return isSimulatorDevice(this.context.value as IManagedObject)
    }
}
