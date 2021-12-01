import { Component, OnInit } from '@angular/core';
import { CellRendererContext } from '@c8y/ngx-components';
import { IManagedObject } from '@c8y/client';
import { getDashboardName } from "../../../utils/utils";

@Component({
    selector: 'dashboard-name-cell-renderer',
    templateUrl: './dashboard-name-renderer.component.html'
})
export class DashboardNameCellRendererComponent implements OnInit {

    constructor(public context: CellRendererContext) { }

    ngOnInit(): void { }

    getDashboardName(): string {
        return getDashboardName(this.context.item as IManagedObject);
    }
}
