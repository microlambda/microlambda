import {
  errorBadRequest,
  errorForbidden,
  errorInternal,
  errorNotFound,
  errorUnauthorized,
  errorValidation,
} from '../../src';

describe('Test Errors', () => {
  const requestId = '123456789';
  const error = {
    details: {
      msg: 'detailed message of the error',
    },
  };
  let errorMessage = error.details.msg;
  let validErrorResponse: any;
  let validErrorResponseWithData: any;

  beforeEach(() => {
    const error = {
      details: {
        msg: 'detailed message of the error',
      },
    };

    errorMessage = error.details.msg;

    validErrorResponse = {
      body: {
        'message': '',
        'X-Request-Id': requestId,
      },
      statusCode: 0,
    };

    validErrorResponseWithData = {
      body: {
        'message': '',
        'data': {
          msg: 'detailed message of the error',
        },
        'X-Request-Id': requestId,
      },
      statusCode: 0,
    };
  });

  describe('Test errorValidation', () => {
    it('Should return a well formatted object', () => {
      validErrorResponseWithData.body.message = 'Validation error';
      validErrorResponseWithData.statusCode = 422;

      expect(errorValidation(requestId, error)).toEqual(validErrorResponseWithData);
    });
  });

  describe('Test errorBadRequest', () => {
    it('Should return a well formatted object', () => {
      validErrorResponse.body.message = errorMessage;
      validErrorResponse.statusCode = 400;

      expect(errorBadRequest(requestId, errorMessage)).toEqual(validErrorResponse);
    });

    it('Should return a well formatted object with default message', () => {
      validErrorResponse.body.message = 'Bad Request';
      validErrorResponse.statusCode = 400;

      expect(errorBadRequest(requestId)).toEqual(validErrorResponse);
    });
  });

  describe('Test errorUnauthorized', () => {
    it('Should return a well formatted object', () => {
      validErrorResponse.body.message = 'Unauthorized';
      validErrorResponse.statusCode = 401;

      expect(errorUnauthorized(requestId)).toEqual(validErrorResponse);
    });
  });

  describe('Test errorNotFound', () => {
    it('Should return a well formatted object', () => {
      validErrorResponse.body.message = errorMessage;
      validErrorResponse.statusCode = 404;

      expect(errorNotFound(requestId, errorMessage)).toEqual(validErrorResponse);
    });

    it('Should return a well formatted object with default message', () => {
      validErrorResponse.body.message = 'Not Found';
      validErrorResponse.statusCode = 404;

      expect(errorNotFound(requestId)).toEqual(validErrorResponse);
    });
  });

  describe('Test errorForbidden', () => {
    it('Should return a well formatted object', () => {
      validErrorResponse.body.message = errorMessage;
      validErrorResponse.statusCode = 403;

      expect(errorForbidden(requestId, errorMessage)).toEqual(validErrorResponse);
    });

    it('Should return a well formatted object with default message', () => {
      validErrorResponse.body.message = 'Forbidden';
      validErrorResponse.statusCode = 403;

      expect(errorForbidden(requestId)).toEqual(validErrorResponse);
    });
  });

  describe('Test errorInternal', () => {
    it('Should return a well formatted object', () => {
      validErrorResponseWithData.body.message = 'Internal Server Error';
      validErrorResponseWithData.body.data = error;
      validErrorResponseWithData.statusCode = 500;

      expect(errorInternal(requestId, error)).toEqual(validErrorResponseWithData);
    });
  });
});
