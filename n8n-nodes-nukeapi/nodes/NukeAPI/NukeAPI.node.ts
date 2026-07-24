import {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  INodeProperties,
  INodePropertyOptions,
  JsonObject,
  NodeApiError,
} from 'n8n-workflow';

import { INTEGRATIONS, prettyLabel } from './integrations';

const INTEGRATION_OPTIONS: INodePropertyOptions[] = INTEGRATIONS.map((slug) => ({
  name: prettyLabel(slug),
  value: slug,
}));

interface NukeApiCredentials {
  apiKey: string;
  baseUrl: string;
}

interface DeleteUserResponse {
  success: boolean;
  requestId?: string;
  data?: {
    requestId?: string;
    status?: 'completed' | 'partial' | 'failed';
    results?: Array<{
      integration: string;
      status: 'success' | 'failed' | 'skipped';
      message?: string;
      error?: string;
      durationMs?: number;
    }>;
    startedAt?: string;
    completedAt?: string;
    elapsedMs?: number;
    auditSignature?: string;
    usage?: {
      plan: string;
      used: number;
      limit: number;
      remaining: number;
      overageRate?: number;
    };
  };
  error?: { code?: string; message?: string };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export class NukeAPI implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'NukeAPI',
    name: 'nukeApi',
    icon: 'file:nukeapi.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Delete users across SaaS tools for GDPR/CCPA/LGPD compliance via the NukeAPI.',
    defaults: {
      name: 'NukeAPI',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'nukeApiApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: 'deleteUser',
        options: [
          {
            name: 'Delete User',
            value: 'deleteUser',
            description: 'Delete a user across selected (or all) integrations',
          },
          {
            name: 'Get Request',
            value: 'getRequest',
            description: 'Get the status of a previous deletion request',
          },
          {
            name: 'Get Status',
            value: 'getStatus',
            description: 'Get the NukeAPI system status (public, no key required)',
          },
          {
            name: 'List Integrations',
            value: 'listIntegrations',
            description: 'Return the static list of supported integrations',
          },
        ],
      } as INodeProperties,

      // ---- Delete User ----
      {
        displayName: 'Subject Email',
        name: 'subject_email',
        type: 'string',
        required: true,
        default: '',
        placeholder: 'user@example.com',
        description: 'Email of the user to delete everywhere',
        displayOptions: { show: { operation: ['deleteUser'] } },
      },
      {
        displayName: 'Integrations',
        name: 'integrations',
        type: 'multiOptions',
        default: [],
        description:
          'Integrations to delete from. Leave empty to delete across all of your connected integrations.',
        options: INTEGRATION_OPTIONS,
        displayOptions: { show: { operation: ['deleteUser'] } },
      },
      {
        displayName: 'Subject External ID',
        name: 'subject_external_id',
        type: 'string',
        default: '',
        description: 'Optional external/secondary ID for the subject',
        displayOptions: { show: { operation: ['deleteUser'] } },
      },
      {
        displayName: 'Webhook URL',
        name: 'webhook',
        type: 'string',
        default: '',
        placeholder: 'https://example.com/hook',
        description:
          'Optional HTTPS URL that NukeAPI will POST a signed completion notification to when the deletion finishes. Leave empty for none.',
        displayOptions: { show: { operation: ['deleteUser'] } },
      },

      // ---- Get Request ----
      {
        displayName: 'Request ID',
        name: 'requestId',
        type: 'string',
        required: true,
        default: '',
        description: 'The request ID returned by a Delete User call',
        displayOptions: { show: { operation: ['getRequest'] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = (await this.getCredentials('nukeApiApi')) as NukeApiCredentials;
    const baseUrl = normalizeBaseUrl(credentials.baseUrl || 'https://app.nukeapi.com');
    const authHeader = { Authorization: `Bearer ${credentials.apiKey}` };
    const jsonHeaders = { 'Content-Type': 'application/json', ...authHeader };

    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const operation = this.getNodeParameter('operation', i) as string;

      if (operation === 'listIntegrations') {
        returnData.push({ json: { integrations: INTEGRATIONS } });
        continue;
      }

      if (operation === 'getStatus') {
        const response = await this.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/api/status`,
          headers: { 'Content-Type': 'application/json' },
        });
        returnData.push({ json: (response.data ?? response) as IDataObject });
        continue;
      }

      if (operation === 'getRequest') {
        const requestId = this.getNodeParameter('requestId', i) as string;
        const response = await this.helpers.httpRequest({
          method: 'GET',
          url: `${baseUrl}/api/v1/status/${encodeURIComponent(requestId)}`,
          headers: jsonHeaders,
        });
        returnData.push({ json: (response.data ?? response) as IDataObject });
        continue;
      }

      if (operation === 'deleteUser') {
        const subjectEmail = this.getNodeParameter('subject_email', i) as string;
        const integrations = this.getNodeParameter('integrations', i) as string[];
        const externalId = this.getNodeParameter('subject_external_id', i) as string;
        const webhook = this.getNodeParameter('webhook', i) as string;

        const body: Record<string, unknown> = { subject_email: subjectEmail };
        if (Array.isArray(integrations) && integrations.length > 0) {
          body.integrations = integrations;
        }
        if (externalId) {
          body.subject_external_id = externalId;
        }
        if (webhook) {
          body.webhook = webhook;
        }

        let response: DeleteUserResponse;
        try {
          response = (await this.helpers.httpRequest({
            method: 'POST',
            url: `${baseUrl}/api/v1/delete-user`,
            headers: jsonHeaders,
            body,
          })) as DeleteUserResponse;
        } catch (error) {
          // Non-2xx already surfaces as a NodeApiError from httpRequest.
          throw error;
        }

        // Surface logical failures that still returned HTTP 200.
        if (response && response.success === false) {
          throw new NodeApiError(this.getNode(), {
            message: response.error?.message || 'NukeAPI returned success: false',
            code: response.error?.code,
          } as unknown as JsonObject);
        }

        if (response?.data?.status === 'failed') {
          const detail = (response.data.results ?? [])
            .map((r) => r.message || r.error || r.integration)
            .filter(Boolean)
            .join('; ');
          throw new NodeApiError(this.getNode(), {
            message: `Deletion failed: ${detail || 'all integrations reported failure'}`,
          } as unknown as JsonObject);
        }

        returnData.push({ json: (response.data ?? response) as IDataObject });
        continue;
      }

      throw new NodeApiError(this.getNode(), {
        message: `Unknown operation: ${operation}`,
      } as unknown as JsonObject);
    }

    return [returnData];
  }
}
