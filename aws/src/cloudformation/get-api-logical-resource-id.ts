import { ApiType } from "@microlambda/types";

export const getApiLogicalResourceId = (apiType: ApiType): string => {
  switch (apiType) {
    case "http":
      return "HttpApi";
    case "rest":
      return "ApiGatewayRestApi";
    case "websocket":
      return "WebsocketsApi";
  }
};
