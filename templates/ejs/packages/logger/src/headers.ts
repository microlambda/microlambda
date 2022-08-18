export interface IEventWithHeaders {
  headers: any;
  [other: string]: any;
}

export const getHeader = (event: IEventWithHeaders, name: string): string => {
  const headerName = Object.keys(event.headers).find((h) => h.toLowerCase() === name.toLowerCase());
  return headerName ? event.headers[headerName] : null;
};
