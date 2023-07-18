import {
  APIGatewayEvent,
  APIGatewayEventRequestContextWithAuthorizer,
  APIGatewayEventDefaultAuthorizerContext,
  Context,
  Handler,
  Callback,
} from 'aws-lambda';

interface ITestBedOptions<TRequest = unknown, TAuthorizerContext = APIGatewayEventDefaultAuthorizerContext> {
  body: TRequest | null;
  headers: { [name: string]: string };
  multiValueHeaders: { [name: string]: string[] };
  httpMethod: string;
  isBase64Encoded: boolean;
  path: string;
  pathParameters: { [name: string]: string } | null;
  queryStringParameters: { [name: string]: string } | null;
  multiValueQueryStringParameters: { [name: string]: string[] } | null;
  stageVariables: { [name: string]: string } | null;
  requestContext: APIGatewayEventRequestContextWithAuthorizer<TAuthorizerContext>;
  resource: string;
}

interface IHandlerResponse<TResponse = unknown> {
  statusCode: TResponse;
  headers?: {
    [header: string]: boolean | number | string;
  };
  multiValueHeaders?: {
    [header: string]: Array<boolean | number | string>;
  };
  body: string;
  isBase64Encoded?: boolean;
}

export class TestBed<
  TRequest = unknown,
  TResponse = unknown,
  TAuthorizerContext = APIGatewayEventDefaultAuthorizerContext,
> {
  private readonly _handler: Handler;

  private _event: APIGatewayEvent;
  private _context: Context | undefined;

  constructor(handler: Handler, options?: ITestBedOptions) {
    this._handler = handler;
    this._event = TestBed._defaultEvent;
    if (options) {
      this._event = {
        ...options,
        body: JSON.stringify(options.body),
      };
    }
  }

  private static _defaultEvent: APIGatewayEvent = {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: '',
    isBase64Encoded: false,
    path: '',
    pathParameters: {},
    queryStringParameters: {},
    multiValueQueryStringParameters: {},
    stageVariables: {},
    requestContext: {
      accountId: '',
      protocol: 'http',
      authorizer: null,
      apiId: '',
      httpMethod: '',
      identity: {
        apiKey: null,
        accountId: null,
        accessKey: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoIdentityId: null,
        cognitoAuthenticationType: null,
        cognitoIdentityPoolId: null,
        apiKeyId: null,
        principalOrgId: null,
        sourceIp: '',
        user: null,
        userAgent: null,
        userArn: null,
      },
      path: '',
      stage: 'test',
      resourceId: '',
      resourcePath: '',
      requestId: 'test-request-' + Date.now(),
      requestTimeEpoch: Date.now(),
    },
    resource: '',
  };

  public pathParameters(params: { [name: string]: string }): TestBed<TRequest, TResponse, TAuthorizerContext> {
    this._event.pathParameters = {
      ...this._event.pathParameters,
      ...params,
    };
    return this;
  }

  public queryParameters(params: { [name: string]: string }): TestBed<TRequest, TResponse, TAuthorizerContext> {
    this._event.queryStringParameters = {
      ...this._event.queryStringParameters,
      ...params,
    };
    return this;
  }

  public multiValueQueryParameters(params: {
    [name: string]: string[];
  }): TestBed<TRequest, TResponse, TAuthorizerContext> {
    this._event.multiValueQueryStringParameters = {
      ...this._event.multiValueQueryStringParameters,
      ...params,
    };
    return this;
  }

  public headers(headers: { [name: string]: string }): TestBed<TRequest, TResponse, TAuthorizerContext> {
    this._event.headers = {
      ...this._event.headers,
      ...headers,
    };
    return this;
  }

  public multiValueHeaders(headers: { [name: string]: string[] }): TestBed<TRequest, TResponse, TAuthorizerContext> {
    this._event.multiValueHeaders = {
      ...this._event.multiValueHeaders,
      ...headers,
    };
    return this;
  }

  public body(payload: TRequest): TestBed<TRequest, TResponse, TAuthorizerContext> {
    this._event.body = JSON.stringify(payload);
    return this;
  }

  public base64Encoded(encoded = true): TestBed<TRequest, TResponse, TAuthorizerContext> {
    this._event.isBase64Encoded = encoded;
    return this;
  }

  public path(path: string): TestBed<TRequest, TResponse, TAuthorizerContext> {
    this._event.path = path;
    return this;
  }

  public resource(resource: string): TestBed<TRequest, TResponse, TAuthorizerContext> {
    this._event.resource = resource;
    return this;
  }

  public stageVariables(variables: { [name: string]: string }): TestBed<TRequest, TResponse, TAuthorizerContext> {
    this._event.stageVariables = {
      ...this._event.stageVariables,
      ...variables,
    };
    return this;
  }

  public context(context: Context): TestBed<TRequest, TResponse, TAuthorizerContext> {
    this._context = context;
    return this;
  }

  public requestContext(
    context: Partial<APIGatewayEventRequestContextWithAuthorizer<TAuthorizerContext>>,
  ): TestBed<TRequest, TResponse, TAuthorizerContext> {
    this._event.requestContext = {
      ...this._event.requestContext,
      ...context,
    };
    return this;
  }

  public authorize(authorizerContext: TAuthorizerContext): TestBed<TRequest, TResponse, TAuthorizerContext> {
    this._event.requestContext.authorizer = authorizerContext;
    return this;
  }

  public async exec(method: string): Promise<IHandlerResponse> {
    this._event.httpMethod = method;
    this._event.requestContext.httpMethod = method;
    const response = await this._callHandler();
    this._event = TestBed._defaultEvent;
    return response;
  }

  public async get(): Promise<IHandlerResponse> {
    return this.exec('GET');
  }

  public async head(): Promise<IHandlerResponse> {
    return this.exec('HEAD');
  }

  public async post(): Promise<IHandlerResponse> {
    return this.exec('POST');
  }

  public async put(): Promise<IHandlerResponse> {
    return this.exec('PUT');
  }

  public async delete(): Promise<IHandlerResponse> {
    return this.exec('DELETE');
  }

  public async patch(): Promise<IHandlerResponse> {
    return this.exec('PATCH');
  }

  private async _callHandler(): Promise<IHandlerResponse> {
    const response = await this._handler(this._event, this._context as Context, null as unknown as Callback);
    return {
      statusCode: response.statusCode,
      body: response.body ? JSON.parse(response.body) : null,
      headers: response.headers,
      multiValueHeaders: response.multiValueHeaders,
    };
  }
}
