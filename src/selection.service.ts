import {Injectable} from "@angular/core";
import {Subject} from "rxjs";

@Injectable({providedIn: 'root'})
export class SelectionService {
    idAddedBy = new Map<string, Set<string>>();

    selectionChange$ = new Subject<string[]>();

    select(id: string|number, addedById?: string|number) {
        const idString = id.toString();
        const parentString = addedById != null ? addedById.toString() : undefined;
        if (this.idAddedBy.has(idString)) {
            const addedBy = this.idAddedBy.get(idString);
            if (addedById != null) {
                addedBy.add(parentString);
            } else {
                addedBy.add(idString);
            }
        } else {
            if (addedById != null) {
                this.idAddedBy.set(idString, new Set<string>([parentString]));
            } else {
                this.idAddedBy.set(idString, new Set<string>([idString]));
            }
            this.selectionChange$.next(this.getSelected());
        }
    }

    isSelected(id: string|number) {
        return this.idAddedBy.has(id.toString());
    }

    deselect(id: string|number, force: boolean = true) {
        const idString = id.toString();

        this.idAddedBy.forEach((addedBy, key) => {
            addedBy.delete(idString);
            if (addedBy.size === 0) {
                if (key === idString) {
                    this.idAddedBy.delete(key);
                    this.selectionChange$.next(this.getSelected());
                } else {
                    this.deselect(key, false);
                }
            }
        });
        if (force) {
            this.idAddedBy.delete(idString);
            this.selectionChange$.next(this.getSelected());
        }
    }

    deselectAll() {
        this.idAddedBy.clear();
        this.selectionChange$.next(this.getSelected());
    }

    getSelected(): string[] {
        return Array.from(this.idAddedBy.keys());
    }

    updateId(oldId: string | number, newId: string | number) {
        const oldIdString = oldId.toString();
        const newIdString = newId.toString();

        const replaceIfOld = (id: string) => id === oldIdString ? newIdString : id;

        this.idAddedBy = new Map([...this.idAddedBy.entries()].map(([key, set]) => [replaceIfOld(key), new Set([...set.values()].map(replaceIfOld))] as [string, Set<string>]))
        this.selectionChange$.next(this.getSelected());
    }
}