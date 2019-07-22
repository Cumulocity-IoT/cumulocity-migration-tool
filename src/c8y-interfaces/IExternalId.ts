export interface IExternalId {
    managedObject: {
        self?: string,
        id: string | number
    },
    externalId: string,
    type: string,
    self?: string
}