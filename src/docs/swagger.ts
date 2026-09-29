/**
 * OpenAPI 3.0 Specification for Notification Inbox APIs
 */
export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Notification Inbox API',
    version: '1.0.0',
    description:
      'Production-ready REST API service for managing user in-app notifications with user-scoped data access, pagination, and read-state management.',
    contact: {
      name: 'Abhishek',
      email: 'abhiabhi29283@gmail.com',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  components: {
    securitySchemes: {
      UserIdHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'x-user-id',
        description: 'User ID header simulating authentication context (e.g. user-123)',
      },
    },
    schemas: {
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'd8c474d2-fbb8-4fbb-bf29-c88f15ef27b3' },
          userId: { type: 'string', example: 'user-1' },
          kind: { type: 'string', example: 'job_succeeded' },
          title: { type: 'string', example: 'File Processing Complete' },
          body: { type: 'string', example: 'Your document report.pdf has been parsed successfully.' },
          resourceType: { type: 'string', example: 'document', nullable: true },
          resourceId: { type: 'string', example: 'doc-99', nullable: true },
          readAt: { type: 'string', format: 'date-time', nullable: true, example: null },
          createdAt: { type: 'string', format: 'date-time', example: '2026-09-26T12:00:00.000Z' },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 10 },
          total: { type: 'integer', example: 25 },
          totalPages: { type: 'integer', example: 3 },
          hasNextPage: { type: 'boolean', example: true },
          hasPrevPage: { type: 'boolean', example: false },
        },
      },
      PaginatedNotificationList: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Notification' },
          },
          pagination: { $ref: '#/components/schemas/PaginationMeta' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'NotFound' },
          message: { type: 'string', example: 'Notification not found' },
        },
      },
    },
  },
  security: [
    {
      UserIdHeader: [],
    },
  ],
  paths: {
    '/notifications': {
      get: {
        summary: 'List user notifications',
        description:
          'Returns current authenticated user’s notifications, sorted newest first, with mandatory pagination and optional unread filter. Limits capped at 50.',
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Page number (>= 1, default 1)',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Items per page (default 10, max 50)',
            schema: { type: 'integer', default: 10, maximum: 50 },
          },
          {
            name: 'unread',
            in: 'query',
            description: 'Filter for unread notifications only when set to true',
            schema: { type: 'boolean', default: false },
          },
        ],
        responses: {
          200: {
            description: 'List of notifications',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginatedNotificationList' },
              },
            },
          },
          401: {
            description: 'Missing or invalid x-user-id header',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/notifications/{id}/read': {
      post: {
        summary: 'Mark a single notification as read',
        description:
          'Marks a single notification as read. If the notification does not exist OR belongs to another user, returns a 404 to prevent ID enumeration and data leakage.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Notification unique ID',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Notification marked as read',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Notification marked as read' },
                    data: { $ref: '#/components/schemas/Notification' },
                  },
                },
              },
            },
          },
          404: {
            description: 'Notification not found (or belongs to another user)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          401: {
            description: 'Missing or invalid x-user-id header',
          },
        },
      },
    },
    '/notifications/read-all': {
      post: {
        summary: 'Mark all notifications as read',
        description:
          'Marks all notifications belonging to current user as read. Strictly isolates and affects only calling user.',
        responses: {
          200: {
            description: 'All notifications marked as read',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Successfully marked 3 notification(s) as read' },
                    updatedCount: { type: 'integer', example: 3 },
                  },
                },
              },
            },
          },
          401: {
            description: 'Missing or invalid x-user-id header',
          },
        },
      },
    },
    '/notifications/{id}': {
      get: {
        summary: 'Get single notification by ID',
        description:
          'Fetches notification by ID. Returns 404 if notification belongs to another user (anti-IDOR).',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Notification unique ID',
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Notification retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { $ref: '#/components/schemas/Notification' },
                  },
                },
              },
            },
          },
          404: {
            description: 'Notification not found (or belongs to another user)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          401: {
            description: 'Missing or invalid x-user-id header',
          },
        },
      },
    },
  },
};
