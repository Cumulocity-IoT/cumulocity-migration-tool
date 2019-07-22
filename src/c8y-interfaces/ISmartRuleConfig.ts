export interface ISmartRuleConfig {
    id?: string|number
    name: string;
    type: string;
    enabled: boolean;
    ruleTemplateName: string;
    config: any;
    c8y_Context: {
        context: string;
        id: string;
    };
    enabledSources: string[];
}