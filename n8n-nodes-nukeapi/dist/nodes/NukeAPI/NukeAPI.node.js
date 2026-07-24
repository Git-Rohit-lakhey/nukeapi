"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NukeAPI = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const integrations_1 = require("./integrations");
const INTEGRATION_OPTIONS = integrations_1.INTEGRATIONS.map((slug) => ({
    name: (0, integrations_1.prettyLabel)(slug),
    value: slug,
}));
function normalizeBaseUrl(baseUrl) {
    return baseUrl.replace(/\/+$/, '');
}
class NukeAPI {
    constructor() {
        this.description = {
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
                },
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
                    description: 'Integrations to delete from. Leave empty to delete across all of your connected integrations.',
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
                    description: 'Optional HTTPS URL that NukeAPI will POST a signed completion notification to when the deletion finishes. Leave empty for none.',
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
    }
    async execute() {
        const credentials = (await this.getCredentials('nukeApiApi'));
        const baseUrl = normalizeBaseUrl(credentials.baseUrl || 'https://app.nukeapi.com');
        const authHeader = { Authorization: `Bearer ${credentials.apiKey}` };
        const jsonHeaders = { 'Content-Type': 'application/json', ...authHeader };
        const items = this.getInputData();
        const returnData = [];
        for (let i = 0; i < items.length; i++) {
            const operation = this.getNodeParameter('operation', i);
            if (operation === 'listIntegrations') {
                returnData.push({ json: { integrations: integrations_1.INTEGRATIONS } });
                continue;
            }
            if (operation === 'getStatus') {
                const response = await this.helpers.httpRequest({
                    method: 'GET',
                    url: `${baseUrl}/api/status`,
                    headers: { 'Content-Type': 'application/json' },
                });
                returnData.push({ json: (response.data ?? response) });
                continue;
            }
            if (operation === 'getRequest') {
                const requestId = this.getNodeParameter('requestId', i);
                const response = await this.helpers.httpRequest({
                    method: 'GET',
                    url: `${baseUrl}/api/v1/status/${encodeURIComponent(requestId)}`,
                    headers: jsonHeaders,
                });
                returnData.push({ json: (response.data ?? response) });
                continue;
            }
            if (operation === 'deleteUser') {
                const subjectEmail = this.getNodeParameter('subject_email', i);
                const integrations = this.getNodeParameter('integrations', i);
                const externalId = this.getNodeParameter('subject_external_id', i);
                const webhook = this.getNodeParameter('webhook', i);
                const body = { subject_email: subjectEmail };
                if (Array.isArray(integrations) && integrations.length > 0) {
                    body.integrations = integrations;
                }
                if (externalId) {
                    body.subject_external_id = externalId;
                }
                if (webhook) {
                    body.webhook = webhook;
                }
                let response;
                try {
                    response = (await this.helpers.httpRequest({
                        method: 'POST',
                        url: `${baseUrl}/api/v1/delete-user`,
                        headers: jsonHeaders,
                        body,
                    }));
                }
                catch (error) {
                    // Non-2xx already surfaces as a NodeApiError from httpRequest.
                    throw error;
                }
                // Surface logical failures that still returned HTTP 200.
                if (response && response.success === false) {
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), {
                        message: response.error?.message || 'NukeAPI returned success: false',
                        code: response.error?.code,
                    });
                }
                if (response?.data?.status === 'failed') {
                    const detail = (response.data.results ?? [])
                        .map((r) => r.message || r.error || r.integration)
                        .filter(Boolean)
                        .join('; ');
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), {
                        message: `Deletion failed: ${detail || 'all integrations reported failure'}`,
                    });
                }
                returnData.push({ json: (response.data ?? response) });
                continue;
            }
            throw new n8n_workflow_1.NodeApiError(this.getNode(), {
                message: `Unknown operation: ${operation}`,
            });
        }
        return [returnData];
    }
}
exports.NukeAPI = NukeAPI;
