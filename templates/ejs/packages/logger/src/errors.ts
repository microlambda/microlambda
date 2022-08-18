export const errorValidation = (requestId: string, error: any): { statusCode: number; body: any } => {
  return {
    body: {
      'message': 'Validation error',
      'data': error?.details,
      'X-Request-Id': requestId,
    },
    statusCode: 422,
  };
};

export const errorBadRequest = (requestId: string, msg?: string): { statusCode: number; body: any } => {
  return {
    body: {
      'message': msg || 'Bad Request',
      'X-Request-Id': requestId,
    },
    statusCode: 400,
  };
};

export const errorUnauthorized = (requestId: string): { statusCode: number; body: any } => {
  return {
    body: {
      'message': 'Unauthorized',
      'X-Request-Id': requestId,
    },
    statusCode: 401,
  };
};

export const errorNotFound = (requestId: string, msg?: string): { statusCode: number; body: any } => {
  return {
    body: {
      'message': msg || 'Not Found',
      'X-Request-Id': requestId,
    },
    statusCode: 404,
  };
};

export const errorForbidden = (requestId: string, msg?: string): { statusCode: number; body: any } => {
  return {
    body: {
      'message': msg || 'Forbidden',
      'X-Request-Id': requestId,
    },
    statusCode: 403,
  };
};

export const errorInternal = (requestId: string, error: any): { statusCode: number; body: any } => {
  return {
    body: {
      'message': 'Internal Server Error',
      'data': error,
      'X-Request-Id': requestId,
    },
    statusCode: 500,
  };
};
