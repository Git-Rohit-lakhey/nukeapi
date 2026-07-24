import { ICredentialType, INodeProperties, IAuthenticateGeneric } from 'n8n-workflow';
export declare class NukeApiApi implements ICredentialType {
    name: string;
    displayName: string;
    documentationUrl: string;
    properties: INodeProperties[];
    authenticate: IAuthenticateGeneric;
    test: {
        request: {
            baseURL: string;
            url: string;
            method: "GET";
        };
    };
}
