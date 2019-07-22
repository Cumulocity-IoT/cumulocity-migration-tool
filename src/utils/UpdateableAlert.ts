import {Alert, AlertService} from "@c8y/ngx-components";
import _ from "lodash";
import {delay} from "./utils";

export class UpdateableAlert {
    previousAlert: Alert;
    stop: boolean = false;
    public update: (msg: string, type?: 'success' | 'warning' | 'danger' | 'info' | 'system') => void = _.throttle(this._update, 500, { leading: true, trailing: true });

    constructor(private alertService: AlertService) {}

    private _update(msg: string, type?: 'success' | 'warning' | 'danger' | 'info' | 'system') {
        if (this.stop) return;
        if (this.previousAlert) {
            this.alertService.remove(this.previousAlert);
            type = type || this.previousAlert.type;
        }
        const alert = this.previousAlert = {
            text: msg,
            type: type || 'info',
            onClose: () => this._onClose()
        };
        this.alertService.add(alert);
    }

    private _onClose() {
        this.stop = true;
    }

    async close(timeout = 500) {
        await delay(timeout);
        this.stop = true;
        if (this.previousAlert) {
            this.alertService.remove(this.previousAlert);
        }
    }
}