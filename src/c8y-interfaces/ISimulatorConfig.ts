export interface ISimulatorConfig {
    id: string;
    name: string;
    instances: number;
    state: 'PAUSED' | 'RUNNING';
    commandQueue: any[];
}