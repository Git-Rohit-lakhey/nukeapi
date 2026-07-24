import {
  ICredentialType,
  INodeProperties,
  IAuthenticateGeneric,
} from 'n8n-workflow';

export class NukeApiApi implements ICredentialType {
  name = 'nukeApiApi';
  displayName = 'NukeAPI Api';
  documentationUrl = 'https://app.nukeapi.com';
  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      required: true,
      default: '',
      description: 'Your NukeAPI key (starts with nk_live_…), created in the NukeAPI dashboard under /keys.',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      required: true,
      default: 'https://app.nukeapi.com',
      description: 'The NukeAPI instance base URL.',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiKey}}',
      },
    },
  };

  // Validates that the Base URL is reachable. The public /api/status
  // endpoint requires no key (the API key is verified at execution time
  // against the authenticated /api/v1/* routes, since the contract
  // exposes no dedicated key-validation endpoint).
  test = {
    request: {
      baseURL: '={{ $credentials.baseUrl }}',
      url: '/api/status',
      method: 'GET' as const,
    },
  };
}
